"""Layanan transkripsi audio video ke teks lokal berbasis faster-whisper (CR-023 / FR-061).

Menyediakan:
- Loader model faster-whisper CPU (CTranslate2 int8)
- Transkripsi WAV 16kHz mono dengan VAD filter & deteksi NO_SPEECH
- Generator format berkas transkrip: .txt, .srt, .docx
- Bundler paket unduhan ZIP (berisi tepat 3 berkas)
- Pratinjau transkrip ephemeral (preview.json)
"""

from __future__ import annotations

import json
import logging
import os
import threading
import zipfile
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.services.video_compressor import (
    AudioProbeInfo,
    VideoCompressionCancelledError,
    VideoCompressionError,
    extract_transcription_wav,
)

logger = logging.getLogger("satukit.transcription")

_MODEL_CACHE: dict[str, Any] = {}
_MODEL_LOCK = threading.Lock()


class TranscriptionError(VideoCompressionError):
    """Base error untuk kegagalan transkripsi video ke teks."""


class TranscriptionCancelledError(VideoCompressionCancelledError):
    """Transkripsi dibatalkan oleh pengguna atau penghentian worker."""


@dataclass(frozen=True)
class TranscriptionSegment:
    """Satu potongan segmen ucapan dengan timestamp awal, akhir, dan teks."""

    start: float
    end: float
    text: str


@dataclass(frozen=True)
class TranscriptionResult:
    """Hasil akhir proses inferensi model transkripsi."""

    language: str
    duration: float
    segments: list[TranscriptionSegment]
    full_text: str


@dataclass(frozen=True)
class TranscriptionJobResult:
    """Hasil penyelesaian satu tugas worker transkripsi siap diunduh."""

    output_path: Path
    output_size_bytes: int
    duration_sec: float
    language: str
    preview_path: Path


def format_timestamp_srt(seconds: float) -> str:
    """Mengonversi detik ke format timestamp SRT: HH:MM:SS,mmm."""
    total_ms = max(0, int(round(seconds * 1000)))
    hours = total_ms // 3_600_000
    rem = total_ms % 3_600_000
    minutes = rem // 60_000
    rem = rem % 60_000
    secs = rem // 1_000
    ms = rem % 1_000
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{ms:03d}"


def format_timestamp_txt(seconds: float) -> str:
    """Mengonversi detik ke format timestamp teks: [MM:SS] atau [HH:MM:SS]."""
    total_s = max(0, int(seconds))
    hours = total_s // 3600
    minutes = (total_s % 3600) // 60
    secs = total_s % 60
    if hours > 0:
        return f"[{hours:02d}:{minutes:02d}:{secs:02d}]"
    return f"[{minutes:02d}:{secs:02d}]"


def generate_txt(
    result: TranscriptionResult,
    target_path: Path,
    original_filename: str = "",
) -> None:
    """Menulis berkas transkrip teks (.txt) rapi ber-timestamp."""
    dur_min = int(result.duration // 60)
    dur_sec = int(result.duration % 60)
    lines: list[str] = [
        "TRANSKRIPSI VIDEO",
        "==================",
    ]
    if original_filename:
        lines.append(f"Berkas Asli: {original_filename}")
    lines.extend(
        [
            f"Bahasa: {result.language.upper()}",
            f"Durasi: {dur_min:02d}:{dur_sec:02d}",
            "",
            "--- Segmen Waktu ---",
        ]
    )
    for seg in result.segments:
        ts = format_timestamp_txt(seg.start)
        lines.append(f"{ts} {seg.text}")
    lines.extend(
        [
            "",
            "--- Teks Lengkap ---",
            result.full_text,
            "",
        ]
    )
    target_path.write_text("\n".join(lines), encoding="utf-8")
    try:
        os.chmod(target_path, 0o600)
    except OSError:
        pass


def generate_srt(result: TranscriptionResult, target_path: Path) -> None:
    """Menulis berkas subtitle SubRip (.srt) standar."""
    blocks: list[str] = []
    for idx, seg in enumerate(result.segments, start=1):
        start_ts = format_timestamp_srt(seg.start)
        end_ts = format_timestamp_srt(seg.end)
        blocks.append(f"{idx}\n{start_ts} --> {end_ts}\n{seg.text}\n")
    target_path.write_text("\n".join(blocks).strip() + "\n", encoding="utf-8")
    try:
        os.chmod(target_path, 0o600)
    except OSError:
        pass


def generate_docx(
    result: TranscriptionResult,
    target_path: Path,
    original_filename: str = "",
) -> None:
    """Menulis berkas dokumen Word (.docx) berstruktur rapi via python-docx."""
    import docx
    from docx.shared import Pt

    doc = docx.Document()

    title = doc.add_heading(level=0)
    title_run = title.add_run("Transkripsi Video")
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(20)
    title_run.font.bold = True

    meta_p = doc.add_paragraph()
    if original_filename:
        meta_p.add_run("Berkas Asli: ").bold = True
        meta_p.add_run(f"{original_filename}\n")
    meta_p.add_run("Bahasa Terdeteksi: ").bold = True
    meta_p.add_run(f"{result.language.upper()}\n")
    meta_p.add_run("Durasi: ").bold = True
    dur_min = int(result.duration // 60)
    dur_sec = int(result.duration % 60)
    meta_p.add_run(f"{dur_min:02d}:{dur_sec:02d}\n")

    doc.add_heading("Teks Lengkap", level=1)
    doc.add_paragraph(result.full_text)

    doc.add_heading("Segmen Berdasarkan Waktu", level=1)
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"

    hdr_cells = table.rows[0].cells
    hdr_cells[0].text = "Waktu Mulai"
    hdr_cells[1].text = "Waktu Selesai"
    hdr_cells[2].text = "Transkrip"
    for c in hdr_cells:
        for p in c.paragraphs:
            for r in p.runs:
                r.font.bold = True

    for seg in result.segments:
        row_cells = table.add_row().cells
        row_cells[0].text = format_timestamp_txt(seg.start)
        row_cells[1].text = format_timestamp_txt(seg.end)
        row_cells[2].text = seg.text

    doc.save(str(target_path))
    try:
        os.chmod(target_path, 0o600)
    except OSError:
        pass


def write_preview_json(result: TranscriptionResult, target_path: Path) -> None:
    """Menyimpan pratinjau transkrip ephemeral (.json) di direktori workspace."""
    payload = {
        "language": result.language,
        "duration": result.duration,
        "full_text": result.full_text,
        "segments": [
            {
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
            }
            for seg in result.segments
        ],
    }
    target_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    try:
        os.chmod(target_path, 0o600)
    except OSError:
        pass


def create_transcription_zip(
    txt_path: Path,
    srt_path: Path,
    docx_path: Path,
    zip_path: Path,
) -> None:
    """Mengemas tepat 3 berkas transkrip ke dalam arsip ZIP flat tanpa path traversal."""
    with zipfile.ZipFile(zip_path, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(txt_path, arcname=txt_path.name)
        zf.write(srt_path, arcname=srt_path.name)
        zf.write(docx_path, arcname=docx_path.name)
    try:
        os.chmod(zip_path, 0o600)
    except OSError:
        pass


def load_whisper_model(
    model_size: str = "base",
    device: str = "cpu",
    compute_type: str = "int8",
    cpu_threads: int = 4,
) -> Any:
    """Memuat instance WhisperModel faster-whisper dengan konfigurasi CPU int8."""
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise TranscriptionError(
            "ENGINE_UNAVAILABLE",
            "Mesin faster-whisper belum terpasang pada server.",
        ) from exc

    return WhisperModel(
        model_size,
        device=device,
        compute_type=compute_type,
        cpu_threads=cpu_threads,
    )


def get_whisper_model(
    model_size: str = "base",
    device: str = "cpu",
    compute_type: str = "int8",
    cpu_threads: int = 4,
) -> Any:
    """Mendapatkan atau membuat singleton model faster-whisper dalam thread lock."""
    key = f"{model_size}_{device}_{compute_type}_{cpu_threads}"
    with _MODEL_LOCK:
        if key not in _MODEL_CACHE:
            _MODEL_CACHE[key] = load_whisper_model(
                model_size=model_size,
                device=device,
                compute_type=compute_type,
                cpu_threads=cpu_threads,
            )
        return _MODEL_CACHE[key]


def transcribe_audio_file(
    audio_path: Path,
    *,
    language: str | None = None,
    model: Any | None = None,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> TranscriptionResult:
    """Menjalankan transkripsi audio WAV dengan VAD filter dan deteksi NO_SPEECH."""
    whisper_model = model if model is not None else get_whisper_model()
    lang = None if language in (None, "auto", "") else language

    parsed_segments: list[TranscriptionSegment] = []
    text_parts: list[str] = []

    try:
        segments, info = whisper_model.transcribe(
            str(audio_path),
            language=lang,
            vad_filter=True,
            beam_size=5,
        )
        detected_lang = str(getattr(info, "language", lang or "id")).lower()
        info_duration = float(getattr(info, "duration", 0.0))

        last_reported_pct = 35.0
        for seg in segments:
            if should_cancel is not None and should_cancel():
                raise TranscriptionCancelledError(
                    "CANCELLED",
                    "Transkripsi audio dibatalkan atas permintaan pengguna.",
                )
            clean_text = str(getattr(seg, "text", "")).strip()
            if clean_text:
                parsed_segments.append(
                    TranscriptionSegment(
                        start=float(seg.start),
                        end=float(seg.end),
                        text=clean_text,
                    )
                )
                text_parts.append(clean_text)

            if on_progress is not None and info_duration > 0:
                seg_end = float(getattr(seg, "end", 0.0))
                ratio = min(1.0, max(0.0, seg_end / info_duration))
                calc_pct = 35.0 + (ratio * 55.0)  # 35% -> 90%
                if calc_pct - last_reported_pct >= 2.0:
                    on_progress(calc_pct)
                    last_reported_pct = calc_pct

    except TranscriptionCancelledError:
        raise
    except TranscriptionError:
        raise
    except Exception as exc:
        raise TranscriptionError(
            "TRANSCRIPTION_FAILED",
            f"Gagal melakukan transkripsi audio: {exc}",
        ) from exc

    full_text = " ".join(text_parts).strip()
    if not parsed_segments or not full_text:
        raise TranscriptionError(
            "NO_SPEECH",
            "Tidak ada ucapan yang terdeteksi dalam berkas video.",
        )

    final_duration = info_duration
    if final_duration <= 0.0 and parsed_segments:
        final_duration = parsed_segments[-1].end

    return TranscriptionResult(
        language=detected_lang,
        duration=final_duration,
        segments=parsed_segments,
        full_text=full_text,
    )


def process_transcription_job(
    input_path: Path,
    output_zip_path: Path,
    job_dir: Path,
    *,
    original_filename: str,
    preset: str = "auto",
    probe: AudioProbeInfo,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
    model: Any | None = None,
) -> TranscriptionJobResult:
    """Menjalankan end-to-end ekstraksi WAV, transkripsi STT, dan pembundelan paket ZIP."""
    temp_wav_path = job_dir / "temp_audio.wav"
    stem = Path(original_filename).stem or "video"
    txt_path = job_dir / f"{stem}_transcript.txt"
    srt_path = job_dir / f"{stem}_transcript.srt"
    docx_path = job_dir / f"{stem}_transcript.docx"
    preview_path = job_dir / "preview.json"

    try:
        # 1. Ekstrak audio WAV 16kHz mono (progress 15% -> 30%)
        extract_transcription_wav(
            input_path,
            temp_wav_path,
            job_dir,
            probe=probe,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

        if should_cancel is not None and should_cancel():
            raise TranscriptionCancelledError(
                "CANCELLED",
                "Transkripsi audio dibatalkan atas permintaan pengguna.",
            )

        # 2. Transkripsi audio via faster-whisper (progress 35% -> 90%)
        result = transcribe_audio_file(
            temp_wav_path,
            language=preset,
            model=model,
            on_progress=on_progress,
            should_cancel=should_cancel,
        )

        # Hapus berkas WAV intermediate segera
        temp_wav_path.unlink(missing_ok=True)

        if should_cancel is not None and should_cancel():
            raise TranscriptionCancelledError(
                "CANCELLED",
                "Transkripsi audio dibatalkan atas permintaan pengguna.",
            )

        # 3. Format luaran: TXT, SRT, DOCX, dan preview.json (progress 90% -> 95%)
        generate_txt(result, txt_path, original_filename=original_filename)
        generate_srt(result, srt_path)
        generate_docx(result, docx_path, original_filename=original_filename)
        write_preview_json(result, preview_path)

        if on_progress is not None:
            on_progress(95.0)

        # 4. Kemas paket unduhan ZIP tepat 3 berkas (progress 95% -> 100%)
        create_transcription_zip(txt_path, srt_path, docx_path, output_zip_path)

        # Bersihkan berkas individual .txt, .srt, .docx (tinggalkan ZIP dan preview.json)
        txt_path.unlink(missing_ok=True)
        srt_path.unlink(missing_ok=True)
        docx_path.unlink(missing_ok=True)

        if on_progress is not None:
            on_progress(100.0)

        zip_size = output_zip_path.stat().st_size
        return TranscriptionJobResult(
            output_path=output_zip_path,
            output_size_bytes=zip_size,
            duration_sec=probe.duration_sec,
            language=result.language,
            preview_path=preview_path,
        )

    finally:
        # Pembersihan fail-safe file sementara jika terjadi exception
        temp_wav_path.unlink(missing_ok=True)
        txt_path.unlink(missing_ok=True)
        srt_path.unlink(missing_ok=True)
        docx_path.unlink(missing_ok=True)
