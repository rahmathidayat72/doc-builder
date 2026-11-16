import os
import sys
from pathlib import Path
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.api.health import set_health_engine_override
from app.core.sandbox import ExecutionResult
from app.core.security import CSRF_HEADER_NAME, SESSION_COOKIE_NAME, session_manager
from app.db.models import RuntimeState
from app.db.postgres import Base
from app.main import app
from app.services.job_manager import ConversionJobManager
from app.services.libreoffice import (
    LIBREOFFICE_LEASE_KEY,
    LibreOfficeBusyError,
    acquire_libreoffice_slot,
    build_libreoffice_command,
    convert_bytes_to_pdf_sandboxed,
    run_libreoffice_conversion,
    validate_pdf_bytes,
    validate_pdf_file,
)


def test_build_libreoffice_command(tmp_path):
    lo_bin = "soffice"
    input_file = tmp_path / "input.docx"
    out_dir = tmp_path / "out"
    profile_dir = tmp_path / "profile_dir"

    cmd = build_libreoffice_command(lo_bin, input_file, out_dir, profile_dir)

    assert cmd[0] == lo_bin
    assert cmd[1].startswith("-env:UserInstallation=")
    assert profile_dir.resolve().as_uri() in cmd[1]
    assert "--headless" in cmd
    assert "--invisible" in cmd
    assert "--nocrashreport" in cmd
    assert "--nodefault" in cmd
    assert "--nofirststartwizard" in cmd
    assert "--nologo" in cmd
    assert "--norestore" in cmd
    assert "--nolockcheck" in cmd
    assert "--convert-to" in cmd
    assert "pdf" in cmd
    assert str(input_file) in cmd
    assert "--outdir" in cmd
    assert str(out_dir) in cmd


def test_validate_pdf_bytes():
    assert validate_pdf_bytes(b"%PDF-1.7\nsome data") is True
    assert validate_pdf_bytes(b"%PDF-") is True
    assert validate_pdf_bytes(b"PK\x03\x04") is False
    assert validate_pdf_bytes(b"") is False
    assert validate_pdf_bytes(b"%PDF") is False


def test_validate_pdf_file(tmp_path):
    valid_pdf = tmp_path / "doc.pdf"
    valid_pdf.write_bytes(b"%PDF-1.4\nendobj\n%%EOF")
    assert validate_pdf_file(valid_pdf) is True

    corrupt_pdf = tmp_path / "corrupt.pdf"
    corrupt_pdf.write_bytes(b"NOT_A_PDF_CONTENT")
    assert validate_pdf_file(corrupt_pdf) is False

    empty_pdf = tmp_path / "empty.pdf"
    empty_pdf.write_bytes(b"")
    assert validate_pdf_file(empty_pdf) is False

    non_existent = tmp_path / "none.pdf"
    assert validate_pdf_file(non_existent) is False


def test_run_libreoffice_conversion_raises_when_lo_missing(tmp_path):
    with patch("app.services.libreoffice.detect_libreoffice", return_value=(False, None)):
        with pytest.raises(FileNotFoundError, match="LIBREOFFICE_NOT_FOUND"):
            run_libreoffice_conversion(tmp_path / "in.docx", tmp_path)


def test_run_libreoffice_conversion_success(tmp_path):
    input_file = tmp_path / "sample.docx"
    input_file.write_bytes(b"dummy docx")

    def fake_subprocess(cmd, cfg):
        # Simulasi output PDF ditulis ke outdir
        out_pdf = cfg.working_dir / "sample.pdf"
        out_pdf.write_bytes(b"%PDF-1.4\ncontent")
        return ExecutionResult(command=cmd, exit_code=0, stdout="", stderr="", duration_sec=0.1)

    with (
        patch("app.services.libreoffice.detect_libreoffice", return_value=(True, "/bin/soffice")),
        patch("app.services.libreoffice.run_sandboxed_subprocess", side_effect=fake_subprocess),
    ):
        out_path = run_libreoffice_conversion(input_file, tmp_path)
        assert out_path.exists()
        assert out_path.name == "sample.pdf"


def test_run_libreoffice_conversion_fails_on_nonzero_exit(tmp_path):
    input_file = tmp_path / "sample.docx"
    input_file.write_bytes(b"dummy docx")

    def fake_failing_subprocess(cmd, cfg):
        return ExecutionResult(
            command=cmd, exit_code=1, stdout="", stderr="Crash report error", duration_sec=0.1
        )

    with (
        patch("app.services.libreoffice.detect_libreoffice", return_value=(True, "/bin/soffice")),
        patch(
            "app.services.libreoffice.run_sandboxed_subprocess",
            side_effect=fake_failing_subprocess,
        ),
    ):
        with pytest.raises(RuntimeError, match="LibreOffice conversion failed"):
            run_libreoffice_conversion(input_file, tmp_path)


def test_convert_bytes_to_pdf_sandboxed_success():
    fake_pdf = b"%PDF-1.5 test document"

    def fake_conv(input_path, output_dir, **kwargs):
        out = output_dir / f"{input_path.stem}.pdf"
        out.write_bytes(fake_pdf)
        return out

    with (
        patch("app.services.libreoffice.detect_libreoffice", return_value=(True, "soffice")),
        patch("app.services.libreoffice.run_libreoffice_conversion", side_effect=fake_conv),
    ):
        stream, err = convert_bytes_to_pdf_sandboxed(b"dummy bytes", "document.docx")
        assert err is None
        assert stream is not None
        assert stream.getvalue() == fake_pdf


def test_convert_bytes_to_pdf_sandboxed_handles_lo_not_found():
    with patch("app.services.libreoffice.detect_libreoffice", return_value=(False, None)):
        stream, err = convert_bytes_to_pdf_sandboxed(b"dummy bytes", "document.docx")
        assert stream is None
        assert err == "LIBREOFFICE_NOT_FOUND"


def test_convert_bytes_to_pdf_sandboxed_returns_conversion_busy():
    with (
        patch("app.services.libreoffice.detect_libreoffice", return_value=(True, "soffice")),
        patch(
            "app.services.libreoffice.run_libreoffice_conversion",
            side_effect=LibreOfficeBusyError("Server sedang memproses dokumen Office lain."),
        ),
    ):
        stream, err = convert_bytes_to_pdf_sandboxed(b"dummy bytes", "document.docx")
        assert stream is None
        assert err is not None
        assert err.startswith("CONVERSION_BUSY:")


def test_libreoffice_lease_single_active_and_release(tmp_path):
    db_file = tmp_path / "lease_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with acquire_libreoffice_slot(
        job_type="docx-to-pdf", ttl_sec=60.0, session_factory=factory
    ) as lease_id:
        with factory() as s:
            state = s.get(RuntimeState, LIBREOFFICE_LEASE_KEY)
            assert state is not None
            assert state.value["active"] is True
            assert state.value["lease_id"] == lease_id

        with pytest.raises(LibreOfficeBusyError, match="Server sedang memproses"):
            with acquire_libreoffice_slot(
                job_type="pptx-to-pdf", ttl_sec=60.0, session_factory=factory
            ):
                pass

    with factory() as s:
        state = s.get(RuntimeState, LIBREOFFICE_LEASE_KEY)
        assert state is not None
        assert state.value["active"] is False

    with acquire_libreoffice_slot(
        job_type="xlsx-to-pdf", ttl_sec=60.0, session_factory=factory
    ) as next_lease:
        assert next_lease != lease_id

    engine.dispose()


def test_libreoffice_lease_reclaims_expired_stale_lock(tmp_path):
    db_file = tmp_path / "stale_lease_test.db"
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    with factory() as s:
        s.add(
            RuntimeState(
                key=LIBREOFFICE_LEASE_KEY,
                value={
                    "active": True,
                    "lease_id": "crashed_worker_lease",
                    "pid": 12345,
                    "job_type": "docx-to-pdf",
                    "acquired_at": 1000.0,
                    "expires_at": 1300.0,
                },
                updated_at=1000.0,
            )
        )
        s.commit()

    with pytest.raises(LibreOfficeBusyError):
        with acquire_libreoffice_slot(
            job_type="resume-pdf",
            ttl_sec=60.0,
            session_factory=factory,
            now_fn=lambda: 1200.0,
        ):
            pass

    with acquire_libreoffice_slot(
        job_type="resume-pdf",
        ttl_sec=60.0,
        session_factory=factory,
        now_fn=lambda: 1301.0,
    ) as fresh_lease:
        assert fresh_lease != "crashed_worker_lease"
        with factory() as s:
            state = s.get(RuntimeState, LIBREOFFICE_LEASE_KEY)
            assert state is not None
            assert state.value["active"] is True
            assert state.value["lease_id"] == fresh_lease

    engine.dispose()


def test_six_office_endpoints_return_429_when_conversion_busy():
    client = TestClient(app)
    client.cookies.set(SESSION_COOKIE_NAME, session_manager.session_token)
    headers = {
        CSRF_HEADER_NAME: session_manager.csrf_token,
        "Origin": "http://localhost:5173",
    }
    busy_ret = (None, "CONVERSION_BUSY: Server sedang memproses dokumen Office lain.")

    with (
        patch("app.services.converter.convert_bytes_to_pdf_sandboxed", return_value=busy_ret),
        patch(
            "app.services.office_converter.convert_bytes_to_pdf_sandboxed",
            return_value=busy_ret,
        ),
        patch("app.api.export.generate_resume_pdf", return_value=busy_ret),
        patch(
            "app.api.ats.generate_ats_report_pdf",
            return_value=busy_ret,
        ),
    ):
        r1 = client.post(
            "/api/converter/docx-to-pdf",
            files={"file": ("sample.docx", b"PK\x03\x04dummy", "application/octet-stream")},
            headers=headers,
        )
        assert r1.status_code == 429
        assert "memproses dokumen Office" in r1.json()["detail"]

        r2 = client.post(
            "/api/converter/presentation-to-pdf",
            files={
                "file": (
                    "slide.ppt",
                    b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1dummy",
                    "application/octet-stream",
                )
            },
            headers=headers,
        )
        assert r2.status_code == 429
        assert "memproses dokumen Office" in r2.json()["detail"]

        r3 = client.post(
            "/api/converter/spreadsheet-to-pdf",
            files={
                "file": (
                    "sheet.xls",
                    b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1dummy",
                    "application/octet-stream",
                )
            },
            headers=headers,
        )
        assert r3.status_code == 429
        assert "memproses dokumen Office" in r3.json()["detail"]

        r4 = client.post(
            "/api/pdf-tools/merge",
            files=[("files", ("input.docx", b"PK\x03\x04dummy", "application/octet-stream"))],
            headers=headers,
        )
        assert r4.status_code == 429
        assert "memproses dokumen Office" in r4.json()["detail"]

        r5 = client.post(
            "/api/export/pdf",
            json={"title": "CV Budi", "personal_info": {"full_name": "Budi"}},
            headers=headers,
        )
        assert r5.status_code == 429
        assert "memproses dokumen Office" in r5.json()["detail"]

        r6 = client.post(
            "/api/ats/export-report-pdf",
            json={
                "resume_title": "CV Budi",
                "analysis": {"overall_score": 85, "checklist": [], "recommendations": []},
            },
            headers=headers,
        )
        assert r6.status_code == 429
        assert "memproses dokumen Office" in r6.json()["detail"]


def test_sweeper_cleans_expired_orphan_libreoffice_profiles(tmp_path):
    ws_root = tmp_path / "workspaces"
    fake_tmp = tmp_path / "sys_tmp"
    fake_tmp.mkdir(parents=True)

    expired_prof = fake_tmp / "docbuilder_lo_prof_old123"
    expired_prof.mkdir()
    os.utime(expired_prof, (1000.0, 1000.0))

    fresh_prof = fake_tmp / "docbuilder_lo_prof_new456"
    fresh_prof.mkdir()
    os.utime(fresh_prof, (4900.0, 4900.0))

    unrelated_dir = fake_tmp / "other_app_temp"
    unrelated_dir.mkdir()
    os.utime(unrelated_dir, (1000.0, 1000.0))

    mgr = ConversionJobManager(workspace_root=ws_root, ttl_seconds=3600)
    removed = mgr.sweep_expired_workspaces(now=5000.0, temp_root=fake_tmp)

    assert expired_prof in removed
    assert not expired_prof.exists()
    assert fresh_prof.exists()
    assert unrelated_dir.exists()


def test_health_reports_libreoffice_lease_status(tmp_path):
    db_file = tmp_path / "health_lo_lease.db"
    engine = create_engine(f"sqlite:///{db_file}")
    Base.metadata.create_all(engine)
    factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    set_health_engine_override(engine)

    client = TestClient(app)
    try:
        r_idle = client.get("/api/health")
        assert r_idle.status_code == 200
        lo_worker = r_idle.json()["libreoffice_worker"]
        assert lo_worker["busy"] is False
        assert lo_worker["job_type"] is None

        with acquire_libreoffice_slot(
            job_type="docx-to-pdf", ttl_sec=120.0, session_factory=factory
        ):
            r_busy = client.get("/api/health")
            assert r_busy.status_code == 200
            lo_busy = r_busy.json()["libreoffice_worker"]
            assert lo_busy["busy"] is True
            assert lo_busy["job_type"] == "docx-to-pdf"
            assert lo_busy["lease_expires_in_seconds"] > 0

        r_released = client.get("/api/health")
        assert r_released.status_code == 200
        assert r_released.json()["libreoffice_worker"]["busy"] is False
    finally:
        set_health_engine_override(None)
        engine.dispose()
