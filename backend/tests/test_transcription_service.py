"""Pengujian unit untuk transcription_service (CR-023 / FR-061).

Memvalidasi:
- Timestamp formatting (.srt dan .txt)
- Generator berkas: TXT, SRT, DOCX, preview.json
- ZIP packager (persis 3 berkas, flat arcname)
- Model loader & transkripsi dengan mock faster-whisper
- Deteksi NO_SPEECH & penanganan pembatalan
- Pembersihan berkas sementara WAV & unzipped artifacts
"""

from __future__ import annotations

import json
import zipfile
from pathlib import Path
from typing import Any

import docx
import pytest

from app.services.transcription_service import (
    TranscriptionCancelledError,
    TranscriptionError,
    TranscriptionResult,
    TranscriptionSegment,
    create_transcription_zip,
    format_timestamp_srt,
    format_timestamp_txt,
    generate_docx,
    generate_srt,
    generate_txt,
    process_transcription_job,
    transcribe_audio_file,
    write_preview_json,
)
from app.services.video_compressor import (
    AudioProbeInfo,
    build_transcription_wav_command,
)


class MockWhisperSegment:
    def __init__(self, start: float, end: float, text: str) -> None:
        self.start = start
        self.end = end
        self.text = text


class MockWhisperInfo:
    def __init__(self, language: str = "id", duration: float = 125.0) -> None:
        self.language = language
        self.duration = duration


class MockWhisperModel:
    def __init__(
        self,
        segments: list[MockWhisperSegment] | None = None,
        info: MockWhisperInfo | None = None,
        raise_exc: Exception | None = None,
    ) -> None:
        self.segments = segments if segments is not None else [
            MockWhisperSegment(0.0, 2.5, "Halo selamat datang di Satukit."),
            MockWhisperSegment(2.6, 5.0, "Alat transkripsi video ke teks lokal."),
        ]
        self.info = info or MockWhisperInfo()
        self.raise_exc = raise_exc
        self.transcribe_calls: list[dict[str, Any]] = []

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
        vad_filter: bool = True,
        beam_size: int = 5,
    ) -> tuple[list[MockWhisperSegment], MockWhisperInfo]:
        self.transcribe_calls.append(
            {
                "audio_path": audio_path,
                "language": language,
                "vad_filter": vad_filter,
                "beam_size": beam_size,
            }
        )
        if self.raise_exc is not None:
            raise self.raise_exc
        return iter(self.segments), self.info


def test_timestamp_formatting() -> None:
    # SRT formatting: HH:MM:SS,mmm
    assert format_timestamp_srt(0.0) == "00:00:00,000"
    assert format_timestamp_srt(65.432) == "00:01:05,432"
    assert format_timestamp_srt(3661.05) == "01:01:01,050"

    # TXT formatting: [MM:SS] or [HH:MM:SS]
    assert format_timestamp_txt(0.0) == "[00:00]"
    assert format_timestamp_txt(65.4) == "[01:05]"
    assert format_timestamp_txt(3661.0) == "[01:01:01]"


def test_generate_txt(tmp_path: Path) -> None:
    result = TranscriptionResult(
        language="id",
        duration=75.0,
        segments=[
            TranscriptionSegment(0.0, 3.2, "Halo dunia."),
            TranscriptionSegment(3.5, 6.0, "Uji coba transkripsi."),
        ],
        full_text="Halo dunia. Uji coba transkripsi.",
    )
    txt_path = tmp_path / "test.txt"
    generate_txt(result, txt_path, original_filename="video.mp4")

    content = txt_path.read_text(encoding="utf-8")
    assert "TRANSKRIPSI VIDEO" in content
    assert "Berkas Asli: video.mp4" in content
    assert "Bahasa: ID" in content
    assert "Durasi: 01:15" in content
    assert "[00:00] Halo dunia." in content
    assert "[00:03] Uji coba transkripsi." in content
    assert "Halo dunia. Uji coba transkripsi." in content


def test_generate_srt(tmp_path: Path) -> None:
    result = TranscriptionResult(
        language="en",
        duration=10.0,
        segments=[
            TranscriptionSegment(0.0, 2.5, "First sentence."),
            TranscriptionSegment(2.6, 5.0, "Second sentence."),
        ],
        full_text="First sentence. Second sentence.",
    )
    srt_path = tmp_path / "test.srt"
    generate_srt(result, srt_path)

    content = srt_path.read_text(encoding="utf-8")
    expected = (
        "1\n00:00:00,000 --> 00:00:02,500\nFirst sentence.\n\n"
        "2\n00:00:02,600 --> 00:00:05,000\nSecond sentence."
    )
    assert content.strip() == expected


def test_generate_docx(tmp_path: Path) -> None:
    result = TranscriptionResult(
        language="id",
        duration=130.0,
        segments=[
            TranscriptionSegment(0.0, 4.0, "Kalimat pembuka."),
            TranscriptionSegment(4.5, 8.0, "Kalimat penutup."),
        ],
        full_text="Kalimat pembuka. Kalimat penutup.",
    )
    docx_path = tmp_path / "test.docx"
    generate_docx(result, docx_path, original_filename="pertemuan.mp4")

    assert docx_path.is_file()
    doc = docx.Document(str(docx_path))
    headings = [p.text for p in doc.paragraphs if p.text]
    assert "Transkripsi Video" in headings[0]
    assert any("Berkas Asli: pertemuan.mp4" in p.text for p in doc.paragraphs)
    assert any("Bahasa Terdeteksi: ID" in p.text for p in doc.paragraphs)
    assert any("Kalimat pembuka. Kalimat penutup." in p.text for p in doc.paragraphs)

    assert len(doc.tables) == 1
    table = doc.tables[0]
    assert len(table.rows) == 3  # Header + 2 data rows
    assert table.rows[1].cells[2].text == "Kalimat pembuka."
    assert table.rows[2].cells[2].text == "Kalimat penutup."


def test_write_preview_json(tmp_path: Path) -> None:
    result = TranscriptionResult(
        language="id",
        duration=60.0,
        segments=[
            TranscriptionSegment(0.0, 2.0, "Halo."),
        ],
        full_text="Halo.",
    )
    preview_path = tmp_path / "preview.json"
    write_preview_json(result, preview_path)

    data = json.loads(preview_path.read_text(encoding="utf-8"))
    assert data["language"] == "id"
    assert data["duration"] == 60.0
    assert data["full_text"] == "Halo."
    assert len(data["segments"]) == 1
    assert data["segments"][0]["text"] == "Halo."


def test_create_transcription_zip(tmp_path: Path) -> None:
    txt = tmp_path / "clip_transcript.txt"
    srt = tmp_path / "clip_transcript.srt"
    doc = tmp_path / "clip_transcript.docx"
    zip_p = tmp_path / "clip_transcript.zip"

    txt.write_text("txt content", encoding="utf-8")
    srt.write_text("srt content", encoding="utf-8")
    doc.write_text("docx content", encoding="utf-8")

    create_transcription_zip(txt, srt, doc, zip_p)

    assert zip_p.is_file()
    with zipfile.ZipFile(zip_p, "r") as zf:
        names = zf.namelist()
        assert len(names) == 3
        assert set(names) == {
            "clip_transcript.txt",
            "clip_transcript.srt",
            "clip_transcript.docx",
        }
        assert zf.read("clip_transcript.txt").decode("utf-8") == "txt content"


def test_transcribe_audio_file_success(tmp_path: Path) -> None:
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"RIFF dummy wav data")

    model = MockWhisperModel(
        segments=[
            MockWhisperSegment(0.0, 1.5, "Uji coba sukses."),
        ],
        info=MockWhisperInfo(language="id", duration=15.0),
    )

    progresses: list[float] = []
    res = transcribe_audio_file(
        audio,
        language="id",
        model=model,
        on_progress=progresses.append,
    )

    assert res.language == "id"
    assert res.duration == 15.0
    assert res.full_text == "Uji coba sukses."
    assert len(res.segments) == 1
    assert model.transcribe_calls[0]["language"] == "id"


def test_transcribe_audio_file_auto_language(tmp_path: Path) -> None:
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"RIFF dummy wav data")

    model = MockWhisperModel(
        segments=[MockWhisperSegment(0.0, 2.0, "Good morning.")],
        info=MockWhisperInfo(language="en", duration=10.0),
    )

    res = transcribe_audio_file(audio, language="auto", model=model)
    assert res.language == "en"
    # When preset is auto, model.transcribe is called with language=None for auto-detection
    assert model.transcribe_calls[0]["language"] is None


def test_transcribe_audio_file_no_speech(tmp_path: Path) -> None:
    audio = tmp_path / "silent.wav"
    audio.write_bytes(b"RIFF dummy wav data")

    # Empty segments
    model_empty = MockWhisperModel(segments=[], info=MockWhisperInfo())
    with pytest.raises(TranscriptionError) as exc_info:
        transcribe_audio_file(audio, model=model_empty)
    assert exc_info.value.error_code == "NO_SPEECH"

    # Only whitespace segments
    model_whitespace = MockWhisperModel(
        segments=[MockWhisperSegment(0.0, 1.0, "   ")],
        info=MockWhisperInfo(),
    )
    with pytest.raises(TranscriptionError) as exc_info2:
        transcribe_audio_file(audio, model=model_whitespace)
    assert exc_info2.value.error_code == "NO_SPEECH"


def test_transcribe_audio_file_cancellation(tmp_path: Path) -> None:
    audio = tmp_path / "audio.wav"
    audio.write_bytes(b"RIFF dummy wav data")

    model = MockWhisperModel()
    with pytest.raises(TranscriptionCancelledError):
        transcribe_audio_file(audio, model=model, should_cancel=lambda: True)


def test_build_transcription_wav_command(tmp_path: Path) -> None:
    probe = AudioProbeInfo(
        container_format="mov,mp4,m4a,3gp,3g2,mj2",
        audio_codec="aac",
        duration_sec=30.0,
        channels=2,
        target_channels=1,
        sample_rate=44100,
        selected_stream_index=0,
    )
    cmd = build_transcription_wav_command(
        ffmpeg_bin="ffmpeg",
        input_path=tmp_path / "in.mp4",
        output_path=tmp_path / "out.wav",
        probe=probe,
        job_dir=tmp_path,
    )
    cmd_str = " ".join(cmd)
    assert "-vn" in cmd_str
    assert "-acodec pcm_s16le" in cmd_str
    assert "-ar 16000" in cmd_str
    assert "-ac 1" in cmd_str


def test_process_transcription_job_end_to_end(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    job_dir = tmp_path / "job_123"
    job_dir.mkdir()
    input_file = job_dir / "input.mp4"
    input_file.write_bytes(b"fake mp4 content")
    output_zip = job_dir / "output.zip"

    probe = AudioProbeInfo(
        container_format="mov,mp4,m4a,3gp,3g2,mj2",
        audio_codec="aac",
        duration_sec=45.0,
        channels=2,
        target_channels=1,
        sample_rate=44100,
        selected_stream_index=0,
    )

    # Stub extract_transcription_wav so real FFmpeg is not required on host
    def _stub_extract_wav(in_path: Path, out_path: Path, *args: Any, **kwargs: Any) -> Path:
        out_path.write_bytes(b"RIFF mock 16khz wav")
        return out_path

    monkeypatch.setattr(
        "app.services.transcription_service.extract_transcription_wav",
        _stub_extract_wav,
    )

    model = MockWhisperModel(
        segments=[
            MockWhisperSegment(0.0, 3.0, "Pengujian worker transkripsi."),
        ],
        info=MockWhisperInfo(language="id", duration=45.0),
    )

    progresses: list[float] = []
    job_res = process_transcription_job(
        input_path=input_file,
        output_zip_path=output_zip,
        job_dir=job_dir,
        original_filename="presentasi.mp4",
        preset="id",
        probe=probe,
        on_progress=progresses.append,
        model=model,
    )

    assert job_res.output_path == output_zip
    assert output_zip.is_file()
    assert job_res.output_size_bytes > 0
    assert job_res.language == "id"
    assert job_res.duration_sec == 45.0

    # Verify preview.json exists in workspace
    preview_file = job_dir / "preview.json"
    assert preview_file.is_file()
    prev_data = json.loads(preview_file.read_text(encoding="utf-8"))
    assert prev_data["full_text"] == "Pengujian worker transkripsi."

    # Verify zip contains exactly the 3 files
    with zipfile.ZipFile(output_zip, "r") as zf:
        assert set(zf.namelist()) == {
            "presentasi_transcript.txt",
            "presentasi_transcript.srt",
            "presentasi_transcript.docx",
        }

    # Verify temporary unzipped files and temp_audio.wav were wiped
    assert not (job_dir / "temp_audio.wav").exists()
    assert not (job_dir / "presentasi_transcript.txt").exists()
    assert not (job_dir / "presentasi_transcript.srt").exists()
    assert not (job_dir / "presentasi_transcript.docx").exists()
