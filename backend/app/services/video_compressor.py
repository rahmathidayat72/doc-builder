"""Layanan keamanan, inspeksi, sandbox, dan transcoding video FFmpeg (CR-021 / VC-02)."""

from __future__ import annotations

import json
import math
import os
import shutil
import signal
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.core.config import settings
from app.services.file_scanner import ClamAVError, MockClamAVScanner, get_clamav_scanner

PRESET_CONFIGS: dict[str, dict[str, str | int]] = {
    "light": {"crf": 23, "audio_bitrate": "128k"},
    "balanced": {"crf": 28, "audio_bitrate": "96k"},
    "maximum": {"crf": 32, "audio_bitrate": "64k"},
}

VALID_AUDIO_PRESETS: tuple[str, ...] = ("128k", "192k", "320k")

ALLOWED_WEBM_CODECS: frozenset[str] = frozenset({"vp8", "vp9", "av1"})
_UNSET = object()


class VideoCompressionError(Exception):
    """Base exception terstruktur untuk alur pemrosesan video worker."""

    def __init__(self, error_code: str, message: str) -> None:
        super().__init__(message)
        self.error_code = error_code
        self.message = message


class VideoScanError(VideoCompressionError):
    """Pemindaian antivirus ClamAV gagal atau menemukan malware."""


class VideoSandboxUnavailableError(VideoCompressionError):
    """Binary sistem wajib (bwrap / ffmpeg / ffprobe) tidak tersedia."""


class VideoProbeError(VideoCompressionError):
    """Metadata video tidak memenuhi batas format, durasi, resolusi, atau FPS."""


class VideoEncodeError(VideoCompressionError):
    """Proses transcoding FFmpeg gagal atau menghasilkan berkas tidak valid."""


class VideoCompressionTimeoutError(VideoCompressionError):
    """Proses encoding melebihi batas waktu maksimum (45 menit)."""


class VideoCompressionCancelledError(VideoCompressionError):
    """Tugas dibatalkan oleh pengguna atau penghentian worker."""


class OutputNotSmallerError(VideoCompressionError):
    """Hasil kompresi berukuran lebih besar atau sama dengan berkas asli."""


@dataclass(frozen=True)
class VideoProbeInfo:
    container_format: str
    video_codec: str
    duration_sec: float
    width: int
    height: int
    fps: float
    has_audio: bool


@dataclass(frozen=True)
class TargetEncodingParams:
    preset: str
    crf: int
    audio_bitrate: str
    target_width: int
    target_height: int
    needs_scale: bool
    target_fps: float
    cap_fps: bool


@dataclass(frozen=True)
class VideoCompressionResult:
    output_path: Path
    output_size_bytes: int
    output_width: int
    output_height: int
    probe: VideoProbeInfo


@dataclass(frozen=True)
class AudioProbeInfo:
    container_format: str
    audio_codec: str
    duration_sec: float
    channels: int
    target_channels: int
    sample_rate: int
    selected_stream_index: int
    bitrate: int | None = None


@dataclass(frozen=True)
class AudioExtractionResult:
    output_path: Path
    output_size_bytes: int
    probe: AudioProbeInfo
    output_width: int | None = None
    output_height: int | None = None


def detect_ffmpeg_binaries() -> tuple[str | None, str | None]:
    """Mendeteksi ketersediaan `ffmpeg` dan `ffprobe` dari PATH sistem (`apt`)."""
    return shutil.which("ffmpeg"), shutil.which("ffprobe")


def _new_process_group_kwargs() -> dict[str, Any]:
    if os.name == "nt":
        create_new_group = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        return {"creationflags": create_new_group} if create_new_group else {}
    return {"start_new_session": True}


def terminate_process_group(proc: subprocess.Popen[str], grace_seconds: float = 3.0) -> None:
    """Menghentikan child process beserta seluruh turunannya per process-group."""
    if proc.poll() is not None:
        return

    if os.name != "nt":
        try:
            pgid = os.getpgid(proc.pid)
        except OSError:
            pgid = None

        if pgid is not None:
            try:
                os.killpg(pgid, signal.SIGTERM)
                proc.wait(timeout=grace_seconds)
                return
            except subprocess.TimeoutExpired:
                try:
                    os.killpg(pgid, signal.SIGKILL)
                except OSError:
                    pass
                try:
                    proc.wait(timeout=5.0)
                except subprocess.TimeoutExpired:
                    pass
                return
            except OSError:
                pass

    try:
        proc.terminate()
        proc.wait(timeout=grace_seconds)
    except subprocess.TimeoutExpired:
        proc.kill()
        try:
            proc.wait(timeout=5.0)
        except subprocess.TimeoutExpired:
            pass
    except OSError:
        pass


def build_sandboxed_command(
    cmd: list[str],
    job_dir: Path,
    *,
    writable: bool = False,
    platform: str | None = None,
    bwrap_bin: Any = _UNSET,
) -> list[str]:
    """Membungkus command `ffprobe`/`ffmpeg` ke namespace `bubblewrap` di Linux."""
    target_platform = sys.platform if platform is None else platform
    is_linux = target_platform.startswith("linux")
    resolved_bwrap = shutil.which("bwrap") if bwrap_bin is _UNSET else bwrap_bin

    if is_linux:
        if resolved_bwrap:
            bind_flag = "--bind" if writable else "--ro-bind"
            return [
                str(resolved_bwrap),
                "--ro-bind",
                "/",
                "/",
                "--dev",
                "/dev",
                "--proc",
                "/proc",
                "--tmpfs",
                "/tmp",
                bind_flag,
                str(job_dir),
                str(job_dir),
                "--unshare-net",
                "--unshare-ipc",
                "--unshare-pid",
                "--die-with-parent",
                *cmd,
            ]
        if settings.IS_PRODUCTION:
            raise VideoSandboxUnavailableError(
                "SANDBOX_UNAVAILABLE",
                "Sandbox isolasi bubblewrap tidak tersedia pada environment produksi.",
            )

    return list(cmd)


def scan_video_file(input_path: Path, scanner: Any | None = None) -> None:
    """Memindai berkas video secara streaming 64 KiB fail-closed sebelum `ffprobe`."""
    active_scanner = get_clamav_scanner() if scanner is None else scanner
    if scanner is None and settings.IS_PRODUCTION and isinstance(active_scanner, MockClamAVScanner):
        raise VideoScanError(
            "CLAMAV_UNAVAILABLE",
            "Daemon antivirus ClamAV tidak tersedia pada mode produksi.",
        )

    try:
        if hasattr(active_scanner, "ensure_fresh_signatures"):
            active_scanner.ensure_fresh_signatures()
        scan_res = active_scanner.scan_file(str(input_path))
    except ClamAVError as exc:
        raise VideoScanError(
            "CLAMAV_UNAVAILABLE",
            "Pemindaian antivirus gagal atau database signature kedaluwarsa.",
        ) from exc

    if not scan_res.is_clean:
        raise VideoScanError(
            "MALWARE_DETECTED",
            "Berkas video ditolak karena terdeteksi memuat malware.",
        )


def _parse_frame_rate(raw_rate: Any) -> float | None:
    if raw_rate is None:
        return None
    text_val = str(raw_rate).strip()
    if not text_val:
        return None
    if "/" in text_val:
        num_str, den_str = text_val.split("/", 1)
        try:
            num = float(num_str)
            den = float(den_str)
        except ValueError:
            return None
        if den <= 0 or num <= 0:
            return None
        fps = num / den
    else:
        try:
            fps = float(text_val)
        except ValueError:
            return None
    if not math.isfinite(fps) or fps <= 0:
        return None
    return fps


def _extract_rotation_degrees(video_stream: dict[str, Any]) -> int:
    tags = video_stream.get("tags") or {}
    raw_rot = tags.get("rotate")
    if raw_rot is None:
        for side_item in video_stream.get("side_data_list") or []:
            if isinstance(side_item, dict) and "rotation" in side_item:
                raw_rot = side_item.get("rotation")
                break
    if raw_rot is None:
        return 0
    try:
        return int(round(float(raw_rot)))
    except (TypeError, ValueError):
        return 0


def _within_4k_bounds(width: int, height: int) -> bool:
    max_w = settings.VIDEO_COMPRESSION_MAX_WIDTH
    max_h = settings.VIDEO_COMPRESSION_MAX_HEIGHT
    return (width <= max_w and height <= max_h) or (width <= max_h and height <= max_w)


def probe_video(
    input_path: Path,
    job_dir: Path,
    *,
    original_ext: str | None = None,
    timeout_seconds: float = 30.0,
) -> VideoProbeInfo:
    """Memvalidasi container, durasi, resolusi <= 4K, dan FPS <= 60 via `ffprobe`."""
    _ffmpeg_bin, ffprobe_bin = detect_ffmpeg_binaries()
    if not ffprobe_bin:
        raise VideoSandboxUnavailableError(
            "TOOLS_UNAVAILABLE",
            "Perangkat ffprobe tidak tersedia pada server.",
        )

    cmd = build_sandboxed_command(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-print_format",
            "json",
            str(input_path),
        ],
        job_dir=job_dir,
        writable=False,
    )

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_process_group_kwargs(),
    )
    try:
        stdout_text, _stderr_text = proc.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        terminate_process_group(proc)
        try:
            proc.communicate(timeout=2.0)
        except Exception:
            pass
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Pemeriksaan metadata video melebihi batas waktu.",
        ) from exc

    if proc.returncode != 0:
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Berkas video rusak atau formatnya tidak valid.",
        )

    try:
        payload = json.loads(stdout_text or "{}")
    except json.JSONDecodeError as exc:
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Metadata berkas video tidak dapat dibaca.",
        ) from exc

    if not isinstance(payload, dict):
        raise VideoProbeError("INVALID_MEDIA", "Metadata berkas video tidak valid.")

    fmt = payload.get("format") or {}
    streams = payload.get("streams") or []
    if not isinstance(fmt, dict) or not isinstance(streams, list):
        raise VideoProbeError("INVALID_MEDIA", "Struktur metadata video tidak valid.")

    video_stream: dict[str, Any] | None = None
    has_audio = False
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        codec_type = stream.get("codec_type")
        if codec_type == "video" and video_stream is None:
            disposition = stream.get("disposition") or {}
            if disposition.get("attached_pic") == 1:
                continue
            video_stream = stream
        elif codec_type == "audio":
            has_audio = True

    if video_stream is None:
        raise VideoProbeError("INVALID_MEDIA", "Berkas tidak mengandung aliran video aktif.")

    fmt_tokens = {
        tok.strip().lower() for tok in str(fmt.get("format_name") or "").split(",") if tok.strip()
    }
    video_codec = str(video_stream.get("codec_name") or "").strip().lower()
    ext = (original_ext or "").strip().lower()

    if ext == ".webm":
        if "webm" not in fmt_tokens or video_codec not in ALLOWED_WEBM_CODECS:
            raise VideoProbeError(
                "INVALID_MEDIA",
                "Konten WebM tidak valid atau codec video tidak didukung.",
            )
    elif ext in (".mp4", ".mov"):
        if not (fmt_tokens & {"mp4", "mov"}):
            raise VideoProbeError(
                "INVALID_MEDIA",
                "Format konten tidak cocok dengan ekstensi MP4/MOV.",
            )
    else:
        if not (fmt_tokens & {"mp4", "mov", "webm"}):
            raise VideoProbeError(
                "INVALID_MEDIA",
                "Format video tidak didukung. Gunakan MP4, MOV, atau WebM.",
            )
        if (
            "webm" in fmt_tokens
            and not (fmt_tokens & {"mp4", "mov"})
            and video_codec not in ALLOWED_WEBM_CODECS
        ):
            raise VideoProbeError(
                "INVALID_MEDIA",
                "Codec WebM tidak didukung.",
            )

    try:
        coded_w = int(video_stream.get("width") or 0)
        coded_h = int(video_stream.get("height") or 0)
    except (TypeError, ValueError) as exc:
        raise VideoProbeError("INVALID_MEDIA", "Dimensi resolusi video tidak valid.") from exc

    if coded_w <= 0 or coded_h <= 0:
        raise VideoProbeError("INVALID_MEDIA", "Dimensi resolusi video tidak valid.")

    rotation = _extract_rotation_degrees(video_stream)
    if abs(rotation) % 180 == 90:
        disp_w, disp_h = coded_h, coded_w
    else:
        disp_w, disp_h = coded_w, coded_h

    if not (_within_4k_bounds(coded_w, coded_h) and _within_4k_bounds(disp_w, disp_h)):
        raise VideoProbeError(
            "RESOLUTION_EXCEEDED",
            "Resolusi video melebihi batas maksimal 4K (3840x2160 landscape / 2160x3840 portrait).",
        )

    raw_duration = fmt.get("duration") or video_stream.get("duration")
    try:
        duration_sec = float(raw_duration)
    except (TypeError, ValueError) as exc:
        raise VideoProbeError("INVALID_MEDIA", "Durasi video tidak dapat ditentukan.") from exc

    if not math.isfinite(duration_sec) or duration_sec <= 0:
        raise VideoProbeError("INVALID_MEDIA", "Durasi video tidak valid.")

    if duration_sec > float(settings.VIDEO_COMPRESSION_MAX_DURATION_SECONDS):
        raise VideoProbeError(
            "DURATION_EXCEEDED",
            f"Durasi video melebihi batas maksimal "
            f"{settings.VIDEO_COMPRESSION_MAX_DURATION_SECONDS} detik (10 menit).",
        )

    fps = _parse_frame_rate(video_stream.get("avg_frame_rate")) or _parse_frame_rate(
        video_stream.get("r_frame_rate")
    )
    if fps is None:
        raise VideoProbeError("INVALID_MEDIA", "Frame rate video tidak valid.")

    if fps > float(settings.VIDEO_COMPRESSION_MAX_FPS):
        raise VideoProbeError(
            "FPS_EXCEEDED",
            f"Frame rate video ({fps:.2f} FPS) melebihi batas maksimal "
            f"{settings.VIDEO_COMPRESSION_MAX_FPS} FPS.",
        )

    return VideoProbeInfo(
        container_format=",".join(sorted(fmt_tokens)),
        video_codec=video_codec,
        duration_sec=duration_sec,
        width=disp_w,
        height=disp_h,
        fps=fps,
        has_audio=has_audio,
    )


def probe_audio_extraction(
    input_path: Path,
    job_dir: Path,
    *,
    original_ext: str | None = None,
    timeout_seconds: float = 30.0,
) -> AudioProbeInfo:
    """Memvalidasi container MP4, durasi <= 600s, dan keberadaan audio stream via `ffprobe`."""
    _ffmpeg_bin, ffprobe_bin = detect_ffmpeg_binaries()
    if not ffprobe_bin:
        raise VideoSandboxUnavailableError(
            "TOOLS_UNAVAILABLE",
            "Perangkat ffprobe tidak tersedia pada server.",
        )

    cmd = build_sandboxed_command(
        [
            ffprobe_bin,
            "-v",
            "error",
            "-show_format",
            "-show_streams",
            "-print_format",
            "json",
            str(input_path),
        ],
        job_dir=job_dir,
        writable=False,
    )

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_process_group_kwargs(),
    )
    try:
        stdout_text, _stderr_text = proc.communicate(timeout=timeout_seconds)
    except subprocess.TimeoutExpired as exc:
        terminate_process_group(proc)
        try:
            proc.communicate(timeout=2.0)
        except Exception:
            pass
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Pemeriksaan metadata video melebihi batas waktu.",
        ) from exc

    if proc.returncode != 0:
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Berkas video rusak atau formatnya tidak valid.",
        )

    try:
        payload = json.loads(stdout_text or "{}")
    except json.JSONDecodeError as exc:
        raise VideoProbeError(
            "INVALID_MEDIA",
            "Metadata berkas video tidak dapat dibaca.",
        ) from exc

    if not isinstance(payload, dict):
        raise VideoProbeError("INVALID_MEDIA", "Metadata berkas video tidak valid.")

    fmt = payload.get("format") or {}
    streams = payload.get("streams") or []
    if not isinstance(fmt, dict) or not isinstance(streams, list):
        raise VideoProbeError("INVALID_MEDIA", "Struktur metadata video tidak valid.")

    fmt_tokens = {
        tok.strip().lower() for tok in str(fmt.get("format_name") or "").split(",") if tok.strip()
    }
    ext = (original_ext or "").strip().lower()

    if ext and ext != ".mp4":
        raise VideoProbeError(
            "INVALID_CONTAINER",
            "Hanya berkas berekstensi .mp4 yang didukung untuk ekstraksi audio MP3.",
        )

    if not (fmt_tokens & {"mp4", "mov"}):
        raise VideoProbeError(
            "INVALID_CONTAINER",
            "Format konten bukan container MP4 yang valid.",
        )

    audio_streams: list[tuple[int, dict[str, Any]]] = []
    for stream in streams:
        if not isinstance(stream, dict):
            continue
        if stream.get("codec_type") == "audio":
            audio_streams.append((len(audio_streams), stream))

    if not audio_streams:
        raise VideoProbeError(
            "NO_AUDIO_STREAM",
            "Berkas MP4 tidak mengandung aliran audio untuk diekstrak.",
        )

    selected_idx = 0
    selected_stream = audio_streams[0][1]
    for a_idx, s in audio_streams:
        disp = s.get("disposition") or {}
        if disp.get("default") == 1:
            selected_idx = a_idx
            selected_stream = s
            break

    try:
        channels = int(selected_stream.get("channels") or 2)
    except (TypeError, ValueError):
        channels = 2
    if channels <= 0:
        channels = 2
    target_channels = 2 if channels > 2 else channels

    try:
        sample_rate = int(selected_stream.get("sample_rate") or 44100)
    except (TypeError, ValueError):
        sample_rate = 44100

    raw_br = selected_stream.get("bit_rate") or fmt.get("bit_rate")
    bitrate: int | None = None
    if raw_br:
        try:
            bitrate = int(raw_br)
        except (TypeError, ValueError):
            bitrate = None

    raw_duration = fmt.get("duration") or selected_stream.get("duration")
    try:
        duration_sec = float(raw_duration)
    except (TypeError, ValueError) as exc:
        raise VideoProbeError("INVALID_MEDIA", "Durasi video tidak dapat ditentukan.") from exc

    if not math.isfinite(duration_sec) or duration_sec <= 0:
        raise VideoProbeError("INVALID_MEDIA", "Durasi video tidak valid.")

    if duration_sec > float(settings.VIDEO_COMPRESSION_MAX_DURATION_SECONDS):
        raise VideoProbeError(
            "DURATION_EXCEEDED",
            f"Durasi video melebihi batas maksimal "
            f"{settings.VIDEO_COMPRESSION_MAX_DURATION_SECONDS} detik (10 menit).",
        )

    audio_codec = str(selected_stream.get("codec_name") or "unknown").strip().lower()

    return AudioProbeInfo(
        container_format=",".join(sorted(fmt_tokens)),
        audio_codec=audio_codec,
        duration_sec=duration_sec,
        channels=channels,
        target_channels=target_channels,
        sample_rate=sample_rate,
        selected_stream_index=selected_idx,
        bitrate=bitrate,
    )


def compute_target_encoding_params(probe: VideoProbeInfo, preset: str) -> TargetEncodingParams:
    """Menghitung parameter target kompresi <= 1080p / <= 30 FPS tanpa upscale."""
    cfg = PRESET_CONFIGS.get(preset)
    if cfg is None:
        raise ValueError(f"Preset kompresi tidak dikenal: {preset}")

    max_short = settings.VIDEO_COMPRESSION_TARGET_MAX_DIM
    max_long = (max_short * 16) // 9
    if probe.width >= probe.height:
        max_w, max_h = max_long, max_short
    else:
        max_w, max_h = max_short, max_long

    scale_ratio = min(1.0, max_w / probe.width, max_h / probe.height)
    target_w = max(2, (int(probe.width * scale_ratio) // 2) * 2)
    target_h = max(2, (int(probe.height * scale_ratio) // 2) * 2)
    target_w = min(target_w, (max_w // 2) * 2)
    target_h = min(target_h, (max_h // 2) * 2)

    needs_scale = (target_w != probe.width) or (target_h != probe.height)
    max_fps = float(settings.VIDEO_COMPRESSION_TARGET_MAX_FPS)
    cap_fps = probe.fps > max_fps
    target_fps = max_fps if cap_fps else probe.fps

    return TargetEncodingParams(
        preset=preset,
        crf=int(cfg["crf"]),
        audio_bitrate=str(cfg["audio_bitrate"]),
        target_width=target_w,
        target_height=target_h,
        needs_scale=needs_scale,
        target_fps=target_fps,
        cap_fps=cap_fps,
    )


def build_ffmpeg_command(
    ffmpeg_bin: str,
    input_path: Path,
    output_path: Path,
    probe: VideoProbeInfo,
    params: TargetEncodingParams,
) -> list[str]:
    """Menyusun argumen FFmpeg single-pass H.264/AAC tanpa metadata dan tanpa upscale."""
    cmd: list[str] = [
        ffmpeg_bin,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-i",
        str(input_path),
        "-map",
        "0:v:0",
    ]
    if probe.has_audio:
        cmd.extend(["-map", "0:a:0?"])

    vf_filters: list[str] = []
    if params.needs_scale:
        vf_filters.append(f"scale={params.target_width}:{params.target_height}")
    if params.cap_fps:
        vf_filters.append(f"fps={int(params.target_fps)}")
    if vf_filters:
        cmd.extend(["-vf", ",".join(vf_filters)])

    cmd.extend(
        [
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            str(params.crf),
            "-threads",
            "1",
            "-pix_fmt",
            "yuv420p",
        ]
    )
    if probe.has_audio:
        cmd.extend(["-c:a", "aac", "-b:a", params.audio_bitrate])
    else:
        cmd.append("-an")

    cmd.extend(
        [
            "-map_metadata",
            "-1",
            "-map_chapters",
            "-1",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    return cmd


def compress_video_file(
    input_path: Path,
    output_path: Path,
    job_dir: Path,
    *,
    preset: str = "balanced",
    input_size_bytes: int | None = None,
    probe: VideoProbeInfo,
    timeout_seconds: float | None = None,
    poll_interval: float = 0.5,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> VideoCompressionResult:
    """Menjalankan transcoding FFmpeg terisolasi dengan PGID kill dan cek ukuran output."""
    ffmpeg_bin, _ffprobe_bin = detect_ffmpeg_binaries()
    if not ffmpeg_bin:
        raise VideoSandboxUnavailableError(
            "TOOLS_UNAVAILABLE",
            "Perangkat ffmpeg tidak tersedia pada server.",
        )

    params = compute_target_encoding_params(probe, preset)
    raw_cmd = build_ffmpeg_command(ffmpeg_bin, input_path, output_path, probe, params)
    sandboxed_cmd = build_sandboxed_command(raw_cmd, job_dir=job_dir, writable=True)

    orig_size = input_path.stat().st_size if input_size_bytes is None else input_size_bytes
    max_timeout = (
        float(settings.VIDEO_COMPRESSION_TIMEOUT_SECONDS)
        if timeout_seconds is None
        else float(timeout_seconds)
    )

    proc = subprocess.Popen(
        sandboxed_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_process_group_kwargs(),
    )

    progress_lock = threading.Lock()
    latest_progress = 15.0
    last_reported = 15.0
    stderr_lines: list[str] = []

    def _read_stdout() -> None:
        nonlocal latest_progress
        if proc.stdout is None:
            return
        for line in proc.stdout:
            stripped = line.strip()
            if stripped.startswith("out_time_us=") or stripped.startswith("out_time_ms="):
                raw_val = stripped.split("=", 1)[1]
                try:
                    us = int(raw_val)
                except ValueError:
                    continue
                if us >= 0 and probe.duration_sec > 0:
                    ratio = min(1.0, (us / 1_000_000.0) / probe.duration_sec)
                    pct = round(15.0 + (ratio * 80.0), 1)
                    with progress_lock:
                        if pct > latest_progress:
                            latest_progress = min(95.0, pct)

    def _read_stderr() -> None:
        if proc.stderr is None:
            return
        total_chars = 0
        for line in proc.stderr:
            if total_chars < 16_384:
                stderr_lines.append(line)
                total_chars += len(line)

    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_err = threading.Thread(target=_read_stderr, daemon=True)
    t_out.start()
    t_err.start()

    start_mono = time.monotonic()
    try:
        while True:
            ret = proc.poll()
            if should_cancel is not None and should_cancel():
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoCompressionCancelledError(
                    "CANCELLED",
                    "Kompresi video dibatalkan sebelum selesai.",
                )

            if (time.monotonic() - start_mono) > max_timeout:
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoCompressionTimeoutError(
                    "ENCODE_TIMEOUT",
                    "Proses kompresi video melebihi batas waktu maksimal 45 menit.",
                )

            if on_progress is not None:
                with progress_lock:
                    cur = latest_progress
                if cur - last_reported >= 2.0:
                    on_progress(cur)
                    last_reported = cur

            if ret is not None:
                break

            time.sleep(poll_interval)
    finally:
        t_out.join(timeout=2.0)
        t_err.join(timeout=2.0)

    if proc.returncode != 0 or not output_path.is_file():
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Kompresi video gagal dijalankan oleh mesin pemrosesan.",
        )

    if on_progress is not None:
        with progress_lock:
            final_cur = latest_progress
        if final_cur > last_reported:
            on_progress(final_cur)

    try:
        os.chmod(output_path, 0o600)
    except OSError:
        pass

    out_size = output_path.stat().st_size
    if out_size <= 0:
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Berkas hasil kompresi kosong dan tidak valid.",
        )

    if out_size >= orig_size:
        output_path.unlink(missing_ok=True)
        raise OutputNotSmallerError(
            "OUTPUT_NOT_SMALLER",
            "Ukuran hasil kompresi tidak lebih kecil dari berkas asli. "
            "Silakan pilih preset yang lebih kuat (Seimbang atau Maksimum).",
        )

    return VideoCompressionResult(
        output_path=output_path,
        output_size_bytes=out_size,
        output_width=params.target_width,
        output_height=params.target_height,
        probe=probe,
    )


def build_audio_ffmpeg_command(
    ffmpeg_bin: str,
    input_path: Path,
    output_path: Path,
    probe: AudioProbeInfo,
    preset: str,
    job_dir: Path,
) -> list[str]:
    """Menyusun argumen FFmpeg ekstraksi audio MP3 CBR via libmp3lame dalam sandbox."""
    if preset not in VALID_AUDIO_PRESETS:
        raise VideoEncodeError(
            "INVALID_PRESET",
            f"Preset audio '{preset}' tidak valid. Pilih 128k, 192k, atau 320k.",
        )

    raw_cmd: list[str] = [
        ffmpeg_bin,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-i",
        str(input_path),
        "-map",
        f"0:a:{probe.selected_stream_index}",
        "-vn",
        "-c:a",
        "libmp3lame",
        "-b:a",
        preset,
        "-ac",
        str(probe.target_channels),
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        str(output_path),
    ]
    return build_sandboxed_command(raw_cmd, job_dir=job_dir, writable=True)


def extract_audio_file(
    input_path: Path,
    output_path: Path,
    job_dir: Path,
    *,
    preset: str = "192k",
    probe: AudioProbeInfo,
    timeout_seconds: float | None = 600.0,
    poll_interval: float = 0.5,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> AudioExtractionResult:
    """Menjalankan ekstraksi audio FFmpeg terisolasi dengan PGID kill dan progress pipe."""
    ffmpeg_bin, _ffprobe_bin = detect_ffmpeg_binaries()
    if not ffmpeg_bin:
        raise VideoSandboxUnavailableError(
            "TOOLS_UNAVAILABLE",
            "Perangkat ffmpeg tidak tersedia pada server.",
        )

    sandboxed_cmd = build_audio_ffmpeg_command(
        ffmpeg_bin, input_path, output_path, probe, preset, job_dir
    )

    max_timeout = 600.0 if timeout_seconds is None else float(timeout_seconds)

    proc = subprocess.Popen(
        sandboxed_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_process_group_kwargs(),
    )

    progress_lock = threading.Lock()
    latest_progress = 15.0
    last_reported = 15.0
    stderr_lines: list[str] = []

    def _read_stdout() -> None:
        nonlocal latest_progress
        if proc.stdout is None:
            return
        for line in proc.stdout:
            stripped = line.strip()
            if stripped.startswith("out_time_us=") or stripped.startswith("out_time_ms="):
                raw_val = stripped.split("=", 1)[1]
                try:
                    us = int(raw_val)
                except ValueError:
                    continue
                if us >= 0 and probe.duration_sec > 0:
                    ratio = min(1.0, (us / 1_000_000.0) / probe.duration_sec)
                    pct = round(15.0 + (ratio * 80.0), 1)
                    with progress_lock:
                        if pct > latest_progress:
                            latest_progress = min(95.0, pct)

    def _read_stderr() -> None:
        if proc.stderr is None:
            return
        total_chars = 0
        for line in proc.stderr:
            if total_chars < 16_384:
                stderr_lines.append(line)
                total_chars += len(line)

    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_err = threading.Thread(target=_read_stderr, daemon=True)
    t_out.start()
    t_err.start()

    start_mono = time.monotonic()
    try:
        while True:
            ret = proc.poll()
            if should_cancel is not None and should_cancel():
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoCompressionCancelledError(
                    "CANCELLED",
                    "Ekstraksi audio dibatalkan sebelum selesai.",
                )

            if (time.monotonic() - start_mono) > max_timeout:
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoCompressionTimeoutError(
                    "ENCODE_TIMEOUT",
                    "Proses ekstraksi audio melebihi batas waktu maksimal 10 menit.",
                )

            if on_progress is not None:
                with progress_lock:
                    cur = latest_progress
                if cur - last_reported >= 2.0:
                    on_progress(cur)
                    last_reported = cur

            if ret is not None:
                break

            time.sleep(poll_interval)
    finally:
        t_out.join(timeout=2.0)
        t_err.join(timeout=2.0)

    if proc.returncode != 0 or not output_path.is_file():
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Ekstraksi audio gagal dijalankan oleh mesin pemrosesan.",
        )

    if on_progress is not None:
        with progress_lock:
            final_cur = latest_progress
        if final_cur > last_reported:
            on_progress(final_cur)

    try:
        os.chmod(output_path, 0o600)
    except OSError:
        pass

    out_size = output_path.stat().st_size
    if out_size <= 0:
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Berkas hasil ekstraksi audio kosong dan tidak valid.",
        )

    return AudioExtractionResult(
        output_path=output_path,
        output_size_bytes=out_size,
        probe=probe,
    )


def build_transcription_wav_command(
    ffmpeg_bin: str,
    input_path: Path,
    output_path: Path,
    probe: AudioProbeInfo,
    job_dir: Path,
) -> list[str]:
    """Menyusun argumen FFmpeg ekstraksi audio WAV 16kHz mono 16-bit PCM dalam sandbox."""
    raw_cmd: list[str] = [
        ffmpeg_bin,
        "-y",
        "-nostdin",
        "-hide_banner",
        "-loglevel",
        "error",
        "-progress",
        "pipe:1",
        "-i",
        str(input_path),
        "-map",
        f"0:a:{probe.selected_stream_index}",
        "-vn",
        "-acodec",
        "pcm_s16le",
        "-ar",
        "16000",
        "-ac",
        "1",
        "-map_metadata",
        "-1",
        "-map_chapters",
        "-1",
        str(output_path),
    ]
    return build_sandboxed_command(raw_cmd, job_dir=job_dir, writable=True)


def extract_transcription_wav(
    input_path: Path,
    output_path: Path,
    job_dir: Path,
    *,
    probe: AudioProbeInfo,
    timeout_seconds: float | None = 600.0,
    poll_interval: float = 0.5,
    on_progress: Callable[[float], None] | None = None,
    should_cancel: Callable[[], bool] | None = None,
) -> Path:
    """Mengekstrak audio PCM 16kHz mono WAV dari MP4 via FFmpeg sandboxed."""
    ffmpeg_bin, _ffprobe_bin = detect_ffmpeg_binaries()
    if not ffmpeg_bin:
        raise VideoSandboxUnavailableError(
            "TOOLS_UNAVAILABLE",
            "Perangkat ffmpeg tidak tersedia pada server.",
        )

    sandboxed_cmd = build_transcription_wav_command(
        ffmpeg_bin, input_path, output_path, probe, job_dir
    )

    max_timeout = 600.0 if timeout_seconds is None else float(timeout_seconds)

    proc = subprocess.Popen(
        sandboxed_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        **_new_process_group_kwargs(),
    )

    progress_lock = threading.Lock()
    latest_progress = 15.0
    last_reported = 15.0
    stderr_lines: list[str] = []

    def _read_stdout() -> None:
        nonlocal latest_progress
        if proc.stdout is None:
            return
        for line in proc.stdout:
            stripped = line.strip()
            if not stripped:
                continue
            if stripped.startswith("out_time_us="):
                val_str = stripped.split("=", 1)[1].strip()
                try:
                    us_val = float(val_str)
                    cur_sec = us_val / 1_000_000.0
                    if probe.duration_sec > 0:
                        ratio = min(1.0, max(0.0, cur_sec / probe.duration_sec))
                        calc_pct = 15.0 + (ratio * 15.0)
                        with progress_lock:
                            if calc_pct > latest_progress:
                                latest_progress = calc_pct
                except (ValueError, TypeError):
                    pass

    def _read_stderr() -> None:
        if proc.stderr is None:
            return
        for line in proc.stderr:
            if line.strip():
                stderr_lines.append(line.strip())

    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_err = threading.Thread(target=_read_stderr, daemon=True)
    t_out.start()
    t_err.start()

    start_time = time.monotonic()
    try:
        while True:
            ret = proc.poll()
            if should_cancel is not None and should_cancel():
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoCompressionCancelledError(
                    "CANCELLED",
                    "Ekstraksi audio dibatalkan atas permintaan pengguna.",
                )

            elapsed = time.monotonic() - start_time
            if elapsed > max_timeout:
                terminate_process_group(proc)
                output_path.unlink(missing_ok=True)
                raise VideoEncodeError(
                    "TIMEOUT",
                    f"Ekstraksi audio melebihi batas waktu {int(max_timeout)} detik.",
                )

            if on_progress is not None:
                with progress_lock:
                    cur = latest_progress
                if cur - last_reported >= 2.0:
                    on_progress(cur)
                    last_reported = cur

            if ret is not None:
                break

            time.sleep(poll_interval)
    finally:
        t_out.join(timeout=2.0)
        t_err.join(timeout=2.0)

    if proc.returncode != 0 or not output_path.is_file():
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Ekstraksi audio WAV gagal dijalankan oleh mesin pemrosesan.",
        )

    if on_progress is not None:
        with progress_lock:
            final_cur = latest_progress
        if final_cur > last_reported:
            on_progress(final_cur)

    try:
        os.chmod(output_path, 0o600)
    except OSError:
        pass

    out_size = output_path.stat().st_size
    if out_size <= 0:
        output_path.unlink(missing_ok=True)
        raise VideoEncodeError(
            "ENCODE_FAILED",
            "Berkas audio WAV kosong dan tidak valid.",
        )

    return output_path
