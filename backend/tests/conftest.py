from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings

LEGACY_GATED_ENDPOINT_SUITES = {
    "test_media_downloader.py",
    "test_pdf_tools.py",
    "test_video_compression_api.py",
    "test_video_compression_upload.py",
}


@pytest.fixture(autouse=True)
def _toggle_beta_gate_for_legacy_suites(
    request: pytest.FixtureRequest, monkeypatch: pytest.MonkeyPatch
) -> None:
    if request.node.fspath.basename in LEGACY_GATED_ENDPOINT_SUITES:
        monkeypatch.setattr(settings, "BETA_COMING_SOON_GATES_ENABLED", False)
