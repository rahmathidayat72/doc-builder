"""Unit tests untuk ClamAV streaming, sandbox, probe, & FFmpeg compressor (VC-02)."""

from __future__ import annotations

import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

from app.core.config import settings
from app.services.file_scanner import (
    ClamAVScanner,
    ClamAVUnavailableError,
    MockClamAVScanner,
    ScanResult,
)
from app.services.video_compressor import (
    AudioExtractionResult,
    AudioProbeInfo,
    OutputNotSmallerError,
    VideoCompressionCancelledError,
    VideoCompressionTimeoutError,
    VideoEncodeError,
    VideoProbeError,
    VideoProbeInfo,
    VideoSandboxUnavailableError,
    VideoScanError,
    build_audio_ffmpeg_command,
    build_ffmpeg_command,
    build_sandboxed_command,
    compress_video_file,
    compute_target_encoding_params,
    extract_audio_file,
    probe_audio_extraction,
    probe_video,
    scan_video_file,
    terminate_process_group,
)


def _read_exact(conn: socket.socket, size: int) -> bytes:
    buf = bytearray()
    while len(buf) < size:
        chunk = conn.recv(size - len(buf))
        if not chunk:
            raise EOFError("Socket closed early")
        buf.extend(chunk)
    return bytes(buf)


def test_clamav_scanner_instream_chunks_and_found_before_ok(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    payload = b"A" * 100 + b"B" * 100 + b"C" * 50
    sample = tmp_path / "video.mp4"
    sample.write_bytes(payload)

    received_chunks: list[bytes] = []
    server_errors: list[Exception] = []

    def _run_mock_clamd(server_sock: socket.socket, response: bytes) -> None:
        try:
            cmd = bytearray()
            while not cmd.endswith(b"\0"):
                cmd.extend(_read_exact(server_sock, 1))
            assert bytes(cmd) == b"zINSTREAM\0"

            while True:
                length = struct.unpack(">I", _read_exact(server_sock, 4))[0]
                if length == 0:
                    break
                received_chunks.append(_read_exact(server_sock, length))
            server_sock.sendall(response)
        except Exception as exc:  # pragma: no cover - surfaced by assert below
            server_errors.append(exc)
        finally:
            server_sock.close()

    c_sock, s_sock = socket.socketpair()
    t = threading.Thread(target=_run_mock_clamd, args=(s_sock, b"stream: OK\0"), daemon=True)
    t.start()

    scanner = ClamAVScanner(socket_path=str(tmp_path / "missing.ctl"), db_dir=tmp_path)
    monkeypatch.setattr(scanner, "_open_socket", lambda: c_sock)

    res = scanner.scan_file(sample, chunk_size=64)
    t.join(timeout=2.0)

    assert not server_errors
    assert res.is_clean is True
    assert [len(c) for c in received_chunks] == [64, 64, 64, 58]
    assert b"".join(received_chunks) == payload

    # Uji parsing "FOUND" mendahului substring "OK" (mis. nama malware mengandung "OK")
    c_sock2, s_sock2 = socket.socketpair()
    t2 = threading.Thread(
        target=_run_mock_clamd,
        args=(s_sock2, b"stream: Win.OK_Trojan FOUND\0"),
        daemon=True,
    )
    t2.start()
    monkeypatch.setattr(scanner, "_open_socket", lambda: c_sock2)
    res2 = scanner.scan_bytes(b"infected-data")
    t2.join(timeout=2.0)

    assert not server_errors
    assert res2.is_clean is False
    assert res2.virus_name == "Win.OK_Trojan"


def test_clamav_signature_freshness_version_and_mtime_fallback(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    scanner = ClamAVScanner(socket_path=str(tmp_path / "clamd.ctl"), db_dir=tmp_path)
    now = 1_762_900_000.0
    fresh_dt = time.strftime("%a %b %d %H:%M:%S %Y", time.localtime(now - 3600))
    stale_dt = time.strftime("%a %b %d %H:%M:%S %Y", time.localtime(now - 90_000))

    def _serve_version(resp: bytes) -> None:
        c_sock, s_sock = socket.socketpair()

        def _server() -> None:
            try:
                cmd = bytearray()
                while not cmd.endswith(b"\0"):
                    cmd.extend(_read_exact(s_sock, 1))
                assert bytes(cmd) == b"zVERSION\0"
                s_sock.sendall(resp)
            finally:
                s_sock.close()

        threading.Thread(target=_server, daemon=True).start()
        monkeypatch.setattr(scanner, "_open_socket", lambda: c_sock)

    # 1. zVERSION segar (< 24 jam)
    _serve_version(f"ClamAV 1.4.0/27450/{fresh_dt}\0".encode())
    sig_ts = scanner.ensure_fresh_signatures(now=now)
    assert abs(sig_ts - (now - 3600)) < 2.0

    # 2. zVERSION kedaluwarsa (> 24 jam) -> fail-closed
    _serve_version(f"ClamAV 1.4.0/27400/{stale_dt}\0".encode())
    with pytest.raises(ClamAVUnavailableError, match="kedaluwarsa"):
        scanner.ensure_fresh_signatures(now=now)

    # 3. zVERSION tanpa tanggal -> fallback ke mtime daily.cld
    daily = tmp_path / "daily.cld"
    daily.write_bytes(b"db")
    os.utime(daily, (now - 1800, now - 1800))
    _serve_version(b"ClamAV 1.4.0\0")
    assert abs(scanner.ensure_fresh_signatures(now=now) - (now - 1800)) < 2.0

    # 4. daily.cld juga kedaluwarsa (> 24 jam)
    os.utime(daily, (now - 100_000, now - 100_000))
    _serve_version(b"ClamAV 1.4.0\0")
    with pytest.raises(ClamAVUnavailableError, match="kedaluwarsa"):
        scanner.ensure_fresh_signatures(now=now)


def test_mock_clamav_scan_file_detects_eicar_across_chunk_boundary(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    test_sig = b"SATUKIT_TEST_MALWARE_SIG_CHUNK_BOUNDARY_CHECK"
    monkeypatch.setattr("app.services.file_scanner.EICAR_SIGNATURE", test_sig)

    scanner = MockClamAVScanner()
    sample = tmp_path / "split_sig.mp4"
    sample.write_bytes(b"PREFIX_12345" + test_sig + b"_SUFFIX")

    res = scanner.scan_file(sample, chunk_size=16)
    assert res.is_clean is False
    assert res.virus_name == "Eicar-Test-Signature"

    clean = tmp_path / "clean.mp4"
    clean.write_bytes(b"0" * 1024)
    assert scanner.scan_file(clean, chunk_size=16).is_clean is True


def test_scan_video_file_fail_closed_in_production(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    sample = tmp_path / "video.mp4"
    sample.write_bytes(b"dummy")

    monkeypatch.setattr(settings, "IS_PRODUCTION", True)
    monkeypatch.setattr(
        "app.services.video_compressor.get_clamav_scanner",
        lambda: MockClamAVScanner(),
    )
    with pytest.raises(VideoScanError) as exc_info:
        scan_video_file(sample)
    assert exc_info.value.error_code == "CLAMAV_UNAVAILABLE"

    # Non-produksi dengan hasil scan terinfeksi
    class _InfectedScanner:
        def ensure_fresh_signatures(self) -> float:
            return time.time()

        def scan_file(self, filepath: str) -> ScanResult:
            return ScanResult(
                is_clean=False,
                virus_name="Win.Test.Malware",
                raw_response="stream: Win.Test.Malware FOUND",
            )

    monkeypatch.setattr(settings, "IS_PRODUCTION", False)
    with pytest.raises(VideoScanError) as malware_exc:
        scan_video_file(sample, scanner=_InfectedScanner())
    assert malware_exc.value.error_code == "MALWARE_DETECTED"


def test_build_sandboxed_command_tmpfs_before_job_bind_and_fail_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-1"
    wrapped = build_sandboxed_command(
        ["ffmpeg", "-i", "in.mp4"],
        job_dir=job_dir,
        writable=True,
        platform="linux",
        bwrap_bin="/usr/bin/bwrap",
    )
    assert wrapped[0] == "/usr/bin/bwrap"
    assert "--unshare-net" in wrapped
    assert "--die-with-parent" in wrapped
    tmpfs_idx = wrapped.index("--tmpfs")
    bind_idx = wrapped.index("--bind")
    assert tmpfs_idx < bind_idx
    assert wrapped[bind_idx + 1] == str(job_dir)

    ro_wrapped = build_sandboxed_command(
        ["ffprobe", "in.mp4"],
        job_dir=job_dir,
        writable=False,
        platform="linux",
        bwrap_bin="/usr/bin/bwrap",
    )
    ro_tmpfs_idx = ro_wrapped.index("--tmpfs")
    job_ro_idx = ro_wrapped.index("--ro-bind", ro_tmpfs_idx)
    assert ro_tmpfs_idx < job_ro_idx
    assert ro_wrapped[job_ro_idx + 1] == str(job_dir)

    monkeypatch.setattr(settings, "IS_PRODUCTION", True)
    with pytest.raises(VideoSandboxUnavailableError) as exc_info:
        build_sandboxed_command(
            ["ffmpeg"],
            job_dir=job_dir,
            platform="linux",
            bwrap_bin=None,
        )
    assert exc_info.value.error_code == "SANDBOX_UNAVAILABLE"


def _make_fake_probe_popen(stdout_obj: dict[str, Any] | str, rc: int = 0) -> Any:
    text_out = stdout_obj if isinstance(stdout_obj, str) else json.dumps(stdout_obj)

    class _FakeProc:
        pid = 4242
        returncode = rc

        def poll(self) -> int:
            return self.returncode

        def communicate(self, timeout: float | None = None) -> tuple[str, str]:
            return text_out, ""

    return lambda *a, **kw: _FakeProc()


def test_probe_video_valid_rotated_4k_and_rejections(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-probe"
    job_dir.mkdir()
    sample = job_dir / "input.bin"
    sample.write_bytes(b"mp4-placeholder")

    monkeypatch.setattr(
        "app.services.video_compressor.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    # 1. Portrait 4K via rotasi 90 derajat (coded 3840x2160 -> display 2160x3840)
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "120.5"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 3840,
                        "height": 2160,
                        "avg_frame_rate": "60/1",
                        "tags": {"rotate": "90"},
                    },
                    {"codec_type": "audio", "codec_name": "aac"},
                ],
            }
        ),
    )
    info = probe_video(sample, job_dir, original_ext=".mp4")
    assert info.width == 2160
    assert info.height == 3840
    assert info.fps == 60.0
    assert info.duration_sec == 120.5
    assert info.has_audio is True

    # 2. WebM dengan codec vp9 valid; jika codec h264 pada .webm -> ditolak
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "matroska,webm", "duration": "30"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "vp9",
                        "width": 1280,
                        "height": 720,
                        "avg_frame_rate": "30000/1001",
                    }
                ],
            }
        ),
    )
    webm_info = probe_video(sample, job_dir, original_ext=".webm")
    assert webm_info.video_codec == "vp9"
    assert webm_info.has_audio is False

    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "matroska,webm", "duration": "30"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 1280,
                        "height": 720,
                        "avg_frame_rate": "30/1",
                    }
                ],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as bad_webm:
        probe_video(sample, job_dir, original_ext=".webm")
    assert bad_webm.value.error_code == "INVALID_MEDIA"

    # 3. Durasi > 600 detik
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "601.0"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 1920,
                        "height": 1080,
                        "avg_frame_rate": "30/1",
                    }
                ],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as dur_err:
        probe_video(sample, job_dir, original_ext=".mp4")
    assert dur_err.value.error_code == "DURATION_EXCEEDED"

    # 4. Resolusi > 4K
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "20.0"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 4096,
                        "height": 2160,
                        "avg_frame_rate": "30/1",
                    }
                ],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as res_err:
        probe_video(sample, job_dir, original_ext=".mp4")
    assert res_err.value.error_code == "RESOLUTION_EXCEEDED"

    # 5. FPS > 60
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "20.0"},
                "streams": [
                    {
                        "codec_type": "video",
                        "codec_name": "h264",
                        "width": 1920,
                        "height": 1080,
                        "avg_frame_rate": "120/1",
                    }
                ],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as fps_err:
        probe_video(sample, job_dir, original_ext=".mp4")
    assert fps_err.value.error_code == "FPS_EXCEEDED"


def test_encoding_params_no_upscale_and_ffmpeg_args() -> None:
    hd_probe = VideoProbeInfo(
        container_format="mp4",
        video_codec="h264",
        duration_sec=30.0,
        width=1280,
        height=720,
        fps=24.0,
        has_audio=True,
    )
    p_hd = compute_target_encoding_params(hd_probe, "light")
    assert p_hd.target_width == 1280
    assert p_hd.target_height == 720
    assert p_hd.needs_scale is False
    assert p_hd.cap_fps is False
    assert p_hd.crf == 23
    assert p_hd.audio_bitrate == "128k"

    cmd_hd = build_ffmpeg_command("ffmpeg", Path("in.bin"), Path("out.mp4"), hd_probe, p_hd)
    assert "-vf" not in cmd_hd
    assert "-map_metadata" in cmd_hd and "-1" in cmd_hd
    assert "-map_chapters" in cmd_hd
    assert "-movflags" in cmd_hd and "+faststart" in cmd_hd
    assert "-threads" in cmd_hd and "1" in cmd_hd

    uhd_portrait = VideoProbeInfo(
        container_format="mp4",
        video_codec="hevc",
        duration_sec=45.0,
        width=2160,
        height=3840,
        fps=60.0,
        has_audio=False,
    )
    p_max = compute_target_encoding_params(uhd_portrait, "maximum")
    assert p_max.target_width == 1080
    assert p_max.target_height == 1920
    assert p_max.needs_scale is True
    assert p_max.cap_fps is True
    assert p_max.crf == 32

    cmd_uhd = build_ffmpeg_command(
        "ffmpeg", Path("in.bin"), Path("out.mp4"), uhd_portrait, p_max
    )
    vf_val = cmd_uhd[cmd_uhd.index("-vf") + 1]
    assert vf_val == "scale=1080:1920,fps=30"
    assert "-an" in cmd_uhd


def test_compress_video_file_success_progress_and_output_not_smaller(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-encode"
    job_dir.mkdir()
    in_path = job_dir / "input.bin"
    out_path = job_dir / "output.mp4"
    in_path.write_bytes(b"X" * 2000)

    probe = VideoProbeInfo("mp4", "h264", 10.0, 1920, 1080, 30.0, True)
    monkeypatch.setattr(
        "app.services.video_compressor.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    def _fake_popen_factory(out_bytes: bytes, rc: int = 0):
        class _FakeFfmpegProc:
            pid = 5150

            def __init__(self, *args: Any, **kwargs: Any) -> None:
                self.stdout = iter(["out_time_us=5000000\n", "out_time_us=10000000\n"])
                self.stderr = iter([])
                self.returncode: int | None = None
                self._done = False

            def poll(self) -> int | None:
                if not self._done:
                    out_path.write_bytes(out_bytes)
                    self._done = True
                    return None
                self.returncode = rc
                return rc

            def wait(self, timeout: float | None = None) -> int:
                self.returncode = rc
                return rc

        return _FakeFfmpegProc

    # 1. Sukses & progress tercatat
    progress_seen: list[float] = []
    monkeypatch.setattr(subprocess, "Popen", _fake_popen_factory(b"Y" * 900, 0))
    res = compress_video_file(
        in_path,
        out_path,
        job_dir,
        preset="balanced",
        probe=probe,
        poll_interval=0.01,
        on_progress=progress_seen.append,
    )
    assert res.output_size_bytes == 900
    assert out_path.is_file()
    assert any(p >= 55.0 for p in progress_seen)

    # 2. Output >= input -> hapus output dan raise OUTPUT_NOT_SMALLER
    monkeypatch.setattr(subprocess, "Popen", _fake_popen_factory(b"Z" * 2000, 0))
    with pytest.raises(OutputNotSmallerError) as not_smaller:
        compress_video_file(
            in_path,
            out_path,
            job_dir,
            preset="light",
            probe=probe,
            poll_interval=0.01,
        )
    assert not_smaller.value.error_code == "OUTPUT_NOT_SMALLER"
    assert not out_path.exists()

    # 3. Return code non-zero -> ENCODE_FAILED & hapus output
    monkeypatch.setattr(subprocess, "Popen", _fake_popen_factory(b"partial", 1))
    with pytest.raises(VideoEncodeError) as enc_err:
        compress_video_file(
            in_path,
            out_path,
            job_dir,
            preset="balanced",
            probe=probe,
            poll_interval=0.01,
        )
    assert enc_err.value.error_code == "ENCODE_FAILED"
    assert not out_path.exists()


def test_compress_video_file_timeout_cancel_and_real_process_group_kill(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-kill"
    job_dir.mkdir()
    in_path = job_dir / "input.bin"
    out_path = job_dir / "output.mp4"
    in_path.write_bytes(b"X" * 1024)
    probe = VideoProbeInfo("mp4", "h264", 10.0, 1280, 720, 30.0, True)

    monkeypatch.setattr(
        "app.services.video_compressor.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    killed_pgids: list[int] = []

    class _HangingProc:
        pid = 9991

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.stdout = iter([])
            self.stderr = iter([])
            self.terminated = False
            out_path.write_bytes(b"partial-output")

        def poll(self) -> int | None:
            return -15 if self.terminated else None

        def terminate(self) -> None:
            self.terminated = True

        def kill(self) -> None:
            self.terminated = True

        def wait(self, timeout: float | None = None) -> int:
            return -15

    monkeypatch.setattr(subprocess, "Popen", _HangingProc)
    monkeypatch.setattr(
        "app.services.video_compressor.terminate_process_group",
        lambda proc: (killed_pgids.append(proc.pid), proc.terminate()),
    )

    # 1. Timeout
    with pytest.raises(VideoCompressionTimeoutError) as t_exc:
        compress_video_file(
            in_path,
            out_path,
            job_dir,
            probe=probe,
            timeout_seconds=0.02,
            poll_interval=0.01,
        )
    assert t_exc.value.error_code == "ENCODE_TIMEOUT"
    assert killed_pgids == [9991]
    assert not out_path.exists()

    # 2. Cancel
    with pytest.raises(VideoCompressionCancelledError) as c_exc:
        compress_video_file(
            in_path,
            out_path,
            job_dir,
            probe=probe,
            poll_interval=0.01,
            should_cancel=lambda: True,
        )
    assert c_exc.value.error_code == "CANCELLED"
    assert killed_pgids == [9991, 9991]
    assert not out_path.exists()


def test_terminate_process_group_real_child_and_posix_killpg(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    # Real OS child process termination
    proc = subprocess.Popen(
        [sys.executable, "-c", "import time; time.sleep(30)"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    assert proc.poll() is None
    terminate_process_group(proc, grace_seconds=0.5)
    assert proc.poll() is not None

    # Simulasi branch POSIX os.killpg SIGTERM -> SIGKILL
    signals_sent: list[tuple[int, int]] = []

    class _PosixProc:
        pid = 7777

        def __init__(self) -> None:
            self.calls = 0

        def poll(self) -> None:
            return None

        def wait(self, timeout: float | None = None) -> int:
            self.calls += 1
            if self.calls == 1:
                raise subprocess.TimeoutExpired("ffmpeg", timeout or 3.0)
            return -9

    monkeypatch.setattr(
        "app.services.video_compressor.os",
        SimpleNamespace(
            name="posix",
            getpgid=lambda pid: 7777,
            killpg=lambda pgid, sig: signals_sent.append((pgid, int(sig))),
            chmod=lambda *a, **kw: None,
        ),
    )
    monkeypatch.setattr(
        "app.services.video_compressor.signal",
        SimpleNamespace(SIGTERM=15, SIGKILL=9),
    )
    terminate_process_group(_PosixProc(), grace_seconds=0.1)  # type: ignore[arg-type]
    assert signals_sent == [(7777, 15), (7777, 9)]


def test_probe_audio_extraction_valid_downmix_default_stream_and_rejections(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-audio-probe"
    job_dir.mkdir()
    sample = job_dir / "input.bin"
    sample.write_bytes(b"mp4-audio-placeholder")

    monkeypatch.setattr(
        "app.services.video_compressor.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    # 1. Valid MP4 dengan 1 video + 1 stereo audio
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {
                    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
                    "duration": "120.0",
                    "bit_rate": "320000",
                },
                "streams": [
                    {"codec_type": "video", "codec_name": "h264"},
                    {
                        "codec_type": "audio",
                        "codec_name": "aac",
                        "channels": 2,
                        "sample_rate": "44100",
                        "bit_rate": "192000",
                    },
                ],
            }
        ),
    )
    probe1 = probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert probe1.audio_codec == "aac"
    assert probe1.channels == 2
    assert probe1.target_channels == 2
    assert probe1.sample_rate == 44100
    assert probe1.selected_stream_index == 0
    assert probe1.duration_sec == 120.0

    # 2. 5.1 surround audio (6 channels) -> auto-downmix target_channels == 2
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "95.5"},
                "streams": [
                    {
                        "codec_type": "audio",
                        "codec_name": "ac3",
                        "channels": 6,
                        "sample_rate": "48000",
                    },
                ],
            }
        ),
    )
    probe_surround = probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert probe_surround.channels == 6
    assert probe_surround.target_channels == 2

    # 3. Multi-audio stream: stream ke-2 memiliki disposition.default = 1
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "60.0"},
                "streams": [
                    {"codec_type": "video", "codec_name": "h264"},
                    {
                        "codec_type": "audio",
                        "codec_name": "aac",
                        "channels": 2,
                        "disposition": {"default": 0},
                    },
                    {
                        "codec_type": "audio",
                        "codec_name": "mp3",
                        "channels": 2,
                        "disposition": {"default": 1},
                    },
                ],
            }
        ),
    )
    probe_multi = probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert probe_multi.selected_stream_index == 1
    assert probe_multi.audio_codec == "mp3"

    # 4. Fail-closed: MP4 tanpa audio stream -> NO_AUDIO_STREAM
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "45.0"},
                "streams": [
                    {"codec_type": "video", "codec_name": "h264"},
                ],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as no_audio_exc:
        probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert no_audio_exc.value.error_code == "NO_AUDIO_STREAM"

    # 5. Ekstensi non-MP4 (mis. .mov atau .webm) ditolak -> INVALID_CONTAINER
    with pytest.raises(VideoProbeError) as non_mp4_exc:
        probe_audio_extraction(sample, job_dir, original_ext=".mov")
    assert non_mp4_exc.value.error_code == "INVALID_CONTAINER"

    # 6. Container non-MP4 (mis. webm) ditolak
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "matroska,webm", "duration": "30.0"},
                "streams": [{"codec_type": "audio", "codec_name": "opus"}],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as bad_container_exc:
        probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert bad_container_exc.value.error_code == "INVALID_CONTAINER"

    # 7. Durasi > 600 detik -> DURATION_EXCEEDED
    monkeypatch.setattr(
        subprocess,
        "Popen",
        _make_fake_probe_popen(
            {
                "format": {"format_name": "mp4", "duration": "601.0"},
                "streams": [{"codec_type": "audio", "codec_name": "aac", "channels": 2}],
            }
        ),
    )
    with pytest.raises(VideoProbeError) as dur_exc:
        probe_audio_extraction(sample, job_dir, original_ext=".mp4")
    assert dur_exc.value.error_code == "DURATION_EXCEEDED"


def test_build_audio_ffmpeg_command_and_presets(tmp_path: Path) -> None:
    job_dir = tmp_path / "job-audio-cmd"
    in_path = job_dir / "input.bin"
    out_path = job_dir / "output.mp3"
    probe = AudioProbeInfo(
        container_format="mp4",
        audio_codec="aac",
        duration_sec=120.0,
        channels=6,
        target_channels=2,
        sample_rate=44100,
        selected_stream_index=1,
    )

    # Valid presets: 128k, 192k, 320k
    for p in ("128k", "192k", "320k"):
        cmd = build_audio_ffmpeg_command("ffmpeg", in_path, out_path, probe, p, job_dir)
        assert "-map" in cmd
        map_idx = cmd.index("-map")
        assert cmd[map_idx + 1] == "0:a:1"
        assert "-vn" in cmd
        assert "-c:a" in cmd
        ca_idx = cmd.index("-c:a")
        assert cmd[ca_idx + 1] == "libmp3lame"
        assert "-b:a" in cmd
        ba_idx = cmd.index("-b:a")
        assert cmd[ba_idx + 1] == p
        assert "-ac" in cmd
        ac_idx = cmd.index("-ac")
        assert cmd[ac_idx + 1] == "2"
        assert "-map_metadata" in cmd
        assert "-map_chapters" in cmd

    # Invalid preset
    with pytest.raises(VideoEncodeError) as bad_preset:
        build_audio_ffmpeg_command("ffmpeg", in_path, out_path, probe, "balanced", job_dir)
    assert bad_preset.value.error_code == "INVALID_PRESET"


def test_extract_audio_file_success_progress_timeout_and_cancel(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job-audio-run"
    job_dir.mkdir()
    in_path = job_dir / "input.bin"
    out_path = job_dir / "output.mp3"
    in_path.write_bytes(b"A" * 2048)
    probe = AudioProbeInfo("mp4", "aac", 60.0, 2, 2, 44100, 0)

    monkeypatch.setattr(
        "app.services.video_compressor.detect_ffmpeg_binaries",
        lambda: ("/usr/bin/ffmpeg", "/usr/bin/ffprobe"),
    )

    def _fake_audio_popen_factory(out_bytes: bytes, rc: int = 0) -> Any:
        class _FakeFfmpegProc:
            pid = 5566

            def __init__(self, *args: Any, **kwargs: Any) -> None:
                self.stdout = iter(["out_time_us=30000000\n", "progress=continue\n"])
                self.stderr = iter(["ffmpeg mp3 log\n"])
                self.returncode: int | None = None
                self._done = False

            def poll(self) -> int | None:
                if not self._done:
                    out_path.write_bytes(out_bytes)
                    self._done = True
                    return None
                self.returncode = rc
                return rc

            def wait(self, timeout: float | None = None) -> int:
                self.returncode = rc
                return rc

        return _FakeFfmpegProc

    # 1. Sukses ekstraksi & progress tercatat
    progress_seen: list[float] = []
    monkeypatch.setattr(subprocess, "Popen", _fake_audio_popen_factory(b"ID3" + b"\x00" * 800, 0))
    res = extract_audio_file(
        in_path,
        out_path,
        job_dir,
        preset="192k",
        probe=probe,
        poll_interval=0.01,
        on_progress=progress_seen.append,
    )
    assert isinstance(res, AudioExtractionResult)
    assert res.output_size_bytes == 803
    assert res.output_width is None
    assert res.output_height is None
    assert out_path.is_file()
    assert any(p >= 50.0 for p in progress_seen)

    # 2. Return code non-zero -> ENCODE_FAILED & hapus output
    monkeypatch.setattr(subprocess, "Popen", _fake_audio_popen_factory(b"err", 1))
    with pytest.raises(VideoEncodeError) as enc_err:
        extract_audio_file(
            in_path,
            out_path,
            job_dir,
            preset="192k",
            probe=probe,
            poll_interval=0.01,
        )
    assert enc_err.value.error_code == "ENCODE_FAILED"
    assert not out_path.exists()

    # 3. Timeout & Cancel
    class _HangingProc:
        pid = 7788

        def __init__(self, *args: Any, **kwargs: Any) -> None:
            self.stdout = iter([])
            self.stderr = iter([])
            self.terminated = False
            out_path.write_bytes(b"partial-audio")

        def poll(self) -> int | None:
            return -15 if self.terminated else None

        def terminate(self) -> None:
            self.terminated = True

        def kill(self) -> None:
            self.terminated = True

        def wait(self, timeout: float | None = None) -> int:
            return -15

    killed_pgids: list[int] = []
    monkeypatch.setattr(subprocess, "Popen", _HangingProc)
    monkeypatch.setattr(
        "app.services.video_compressor.terminate_process_group",
        lambda proc: (killed_pgids.append(proc.pid), proc.terminate()),
    )

    with pytest.raises(VideoCompressionTimeoutError) as t_exc:
        extract_audio_file(
            in_path,
            out_path,
            job_dir,
            probe=probe,
            timeout_seconds=0.02,
            poll_interval=0.01,
        )
    assert t_exc.value.error_code == "ENCODE_TIMEOUT"
    assert killed_pgids == [7788]
    assert not out_path.exists()

    with pytest.raises(VideoCompressionCancelledError) as c_exc:
        extract_audio_file(
            in_path,
            out_path,
            job_dir,
            probe=probe,
            poll_interval=0.01,
            should_cancel=lambda: True,
        )
    assert c_exc.value.error_code == "CANCELLED"
    assert not out_path.exists()

