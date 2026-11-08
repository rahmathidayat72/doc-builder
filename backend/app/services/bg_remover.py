from __future__ import annotations

import argparse
import io
import json
import os
import queue
import subprocess
import sys
import threading
import time
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from PIL import Image

from app.core.config import settings

# Format tensor model U2NetP
MODEL_INPUT_SIZE = (320, 320)
MAX_RESOLUTION_PIXELS = 2500 * 2500  # Max dimension cap untuk menjaga memori < 400 MB


class BackgroundRemoverBusyError(HTTPException):
    """Dilempar saat kapasitas antrean remove-background penuh (HTTP 429)."""

    def __init__(
        self,
        detail: str = (
            "Sistem sedang memproses gambar lain. Antrean penuh, "
            "silakan coba kembali dalam 30 detik."
        ),
    ) -> None:
        super().__init__(
            status_code=429,
            detail=detail,
            headers={
                "Retry-After": "30",
                "X-Error-Code": "CONCURRENCY_LIMIT_REACHED",
            },
        )


class BackgroundRemoverTimeoutError(HTTPException):
    """Dilempar saat durasi inferensi melebihi batas waktu SLA 30 detik (HTTP 504)."""

    def __init__(
        self, detail: str = "Waktu pemrosesan penghapusan latar belakang melebihi batas 30 detik."
    ) -> None:
        super().__init__(status_code=504, detail=detail)


def validate_image_payload(file_bytes: bytes) -> str:
    """Memvalidasi ukuran dan magic bytes berkas gambar (JPG, PNG, WebP)."""
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Berkas gambar kosong.")

    max_bytes = settings.BG_REMOVER_MAX_IMAGE_MB * 1024 * 1024
    if len(file_bytes) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"Ukuran berkas melebihi batas maksimal {settings.BG_REMOVER_MAX_IMAGE_MB} MB.",
        )

    # Deteksi magic bytes
    if file_bytes.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if file_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if file_bytes.startswith(b"RIFF") and len(file_bytes) >= 12 and file_bytes[8:12] == b"WEBP":
        return "webp"

    raise HTTPException(
        status_code=422,
        detail="Format berkas tidak didukung. Harap unggah gambar JPG, PNG, atau WebP yang valid.",
    )


def run_worker_internal(model_path: Path, input_path: Path, output_path: Path) -> dict[str, Any]:
    """Eksekusi inferensi U2NetP ONNX di dalam subprocess terisolasi."""
    import numpy as np
    import onnxruntime as ort

    t_start = time.perf_counter()

    imagenet_mean = np.array([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
    imagenet_std = np.array([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)

    with Image.open(input_path) as raw_img:
        orig_img = raw_img.convert("RGB")
        orig_w, orig_h = orig_img.size

        # Downscale jika resolusi ekstrem untuk menjaga batas memori 400 MB pada VPS
        if orig_w * orig_h > MAX_RESOLUTION_PIXELS:
            ratio = (MAX_RESOLUTION_PIXELS / (orig_w * orig_h)) ** 0.5
            new_w = max(320, int(orig_w * ratio))
            new_h = max(320, int(orig_h * ratio))
            orig_img = orig_img.resize((new_w, new_h), Image.Resampling.BILINEAR)
            orig_w, orig_h = orig_img.size

    t_loaded = time.perf_counter()

    # 1. Preprocess: Resize ke (320, 320) & normalisasi ImageNet
    resized = orig_img.resize(MODEL_INPUT_SIZE, Image.Resampling.BILINEAR)
    img_np = np.asarray(resized, dtype=np.float32) / 255.0
    normalized = (img_np - imagenet_mean) / imagenet_std
    tensor = np.transpose(normalized, (2, 0, 1))[np.newaxis, ...]

    # 2. Inisialisasi ONNX Runtime (CPU-only, thread tunggal untuk 1 vCPU)
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 1
    opts.inter_op_num_threads = 1
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    session = ort.InferenceSession(
        str(model_path), sess_options=opts, providers=["CPUExecutionProvider"]
    )
    input_name = session.get_inputs()[0].name
    output_name = session.get_outputs()[0].name

    t_session = time.perf_counter()

    # 3. Model Inference
    ort_outs = session.run([output_name], {input_name: tensor})
    t_inferred = time.perf_counter()

    # 4. Postprocess: Sigmoid & resize mask kembali ke dimensi asal
    pred = ort_outs[0][:, 0, :, :]
    pred = np.squeeze(pred)
    ma = float(np.max(pred))
    mi = float(np.min(pred))
    norm_pred = (pred - mi) / (ma - mi + 1e-8)
    mask_np = (norm_pred * 255.0).astype(np.uint8)

    mask_img = Image.fromarray(mask_np, mode="L")
    mask_resized = mask_img.resize((orig_w, orig_h), Image.Resampling.LANCZOS)

    # 5. Rakit citra RGBA dengan alpha mask
    rgba_img = orig_img.convert("RGBA")
    rgba_img.putalpha(mask_resized)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    # Simpan sebagai PNG tanpa metadata EXIF
    rgba_img.save(output_path, format="PNG", optimize=True)

    t_end = time.perf_counter()

    return {
        "success": True,
        "resolution": f"{orig_w}x{orig_h}",
        "load_time_ms": round((t_loaded - t_start) * 1000, 2),
        "inference_time_ms": round((t_inferred - t_session) * 1000, 2),
        "total_time_ms": round((t_end - t_start) * 1000, 2),
    }


class BackgroundRemovalManager:
    """Manajer antrean dan orkestrasi inferensi U2NetP dalam subprocess terisolasi."""

    def __init__(
        self,
        model_path: Path | None = None,
        timeout_seconds: int | None = None,
        concurrency_limit: int | None = None,
        queue_capacity: int | None = None,
    ) -> None:
        self.model_path = model_path or settings.U2NETP_MODEL_PATH
        self.timeout_seconds = timeout_seconds or settings.BG_REMOVER_TIMEOUT_SECONDS
        self.concurrency_limit = concurrency_limit or settings.BG_REMOVER_CONCURRENCY
        self.queue_capacity = queue_capacity or settings.BG_REMOVER_QUEUE_CAPACITY

        self._active_workers = 0
        self._waiting_queue: queue.Queue[str] = queue.Queue(maxsize=self.queue_capacity)
        self._lock = threading.Lock()

    def remove_background(
        self, file_bytes: bytes, filename: str = "image.png"
    ) -> tuple[io.BytesIO, dict[str, Any]]:
        """Mengeksekusi penghapusan latar belakang dengan proteksi antrean dan batas memori."""
        validate_image_payload(file_bytes)

        if not self.model_path.is_file():
            raise HTTPException(
                status_code=500,
                detail="Model U2NetP belum terpasang di server. Harap hubungi administrator.",
            )

        job_id = uuid.uuid4().hex[:8]

        # Penegakan kuota antrean dan konkurensi (fail-closed HTTP 429)
        with self._lock:
            if self._active_workers < self.concurrency_limit:
                self._active_workers += 1
            else:
                try:
                    self._waiting_queue.put_nowait(job_id)
                except queue.Full:
                    raise BackgroundRemoverBusyError() from None

        # Workspace sementara dengan izin ketat 0700
        workspace_dir = settings.TEMP_WORKSPACE_DIR / f"rembg_{job_id}"
        workspace_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            os.chmod(workspace_dir, 0o700)
        except OSError:
            pass

        input_file = workspace_dir / f"input_{job_id}.bin"
        output_file = workspace_dir / f"output_{job_id}.png"

        try:
            input_file.write_bytes(file_bytes)

            cmd = [
                sys.executable,
                "-m",
                "app.services.bg_remover",
                "--worker",
                "--model",
                str(self.model_path),
                "--input",
                str(input_file),
                "--output",
                str(output_file),
            ]

            t_sub_start = time.perf_counter()
            try:
                proc = subprocess.run(
                    cmd,
                    cwd=str(settings.BASE_DIR),
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    check=False,
                )
            except subprocess.TimeoutExpired as exc:
                raise BackgroundRemoverTimeoutError() from exc

            t_sub_end = time.perf_counter()

            if proc.returncode != 0:
                err_detail = proc.stderr.strip() or proc.stdout.strip() or "Subprocess error"
                raise HTTPException(
                    status_code=500,
                    detail=f"Gagal memproses penghapusan latar belakang: {err_detail}",
                )

            try:
                metrics = json.loads(proc.stdout.strip())
            except json.JSONDecodeError:
                metrics = {"success": True}

            metrics["wall_time_ms"] = round((t_sub_end - t_sub_start) * 1000, 2)

            if not output_file.is_file() or output_file.stat().st_size == 0:
                raise HTTPException(
                    status_code=500, detail="Berkas hasil segmentasi tidak ditemukan."
                )

            output_bytes = output_file.read_bytes()
            metrics["processed_size_bytes"] = len(output_bytes)
            metrics["original_size_bytes"] = len(file_bytes)

            buf = io.BytesIO(output_bytes)
            buf.seek(0)
            return buf, metrics

        finally:
            # Bersihkan berkas sementara
            for temp_f in (input_file, output_file):
                try:
                    if temp_f.exists():
                        temp_f.unlink()
                except OSError:
                    pass
            try:
                if workspace_dir.exists():
                    workspace_dir.rmdir()
            except OSError:
                pass

            # Lepaskan slot konkurensi
            with self._lock:
                if not self._waiting_queue.empty():
                    try:
                        self._waiting_queue.get_nowait()
                    except queue.Empty:
                        self._active_workers = max(0, self._active_workers - 1)
                else:
                    self._active_workers = max(0, self._active_workers - 1)


bg_remover_manager = BackgroundRemovalManager()


def main():
    """Entry point worker subprocess saat dijalankan via CLI."""
    parser = argparse.ArgumentParser(description="U2NetP Isolated Subprocess Worker")
    parser.add_argument("--worker", action="store_true", help="Menjalankan mode worker internal")
    parser.add_argument("--model", type=Path, required=True, help="Path ke model u2netp.onnx")
    parser.add_argument("--input", type=Path, required=True, help="Path ke berkas citra masukan")
    parser.add_argument("--output", type=Path, required=True, help="Path ke berkas PNG keluaran")
    args = parser.parse_args()

    try:
        metrics = run_worker_internal(args.model, args.input, args.output)
        print(json.dumps(metrics))
        sys.exit(0)
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
