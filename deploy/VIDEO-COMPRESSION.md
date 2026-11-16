# Panduan Deployment & Staging Compress Video (`CR-021`)

Panduan ini melengkapi artefak produksi `deploy/satukit-video-worker.service` dan `deploy/Caddyfile.example` khusus untuk fitur **Compress Video** (`CR-021`) pada VPS Ubuntu 24.04 (`1 vCPU / 2.2 GiB RAM / 4 GiB Swap`).

> **Catatan keamanan:** Pastikan perubahan `RISK-SEC-023` (`Q-007`) diverifikasi di environment staging Ubuntu menggunakan langkah di dokumen ini sebelum membuka fitur ke trafik produksi.

---

## 1. Instalasi Paket Sistem (`apt`)

Pasang FFmpeg, ClamAV daemon, dan Bubblewrap dari repositori resmi Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y ffmpeg clamav-daemon clamav-freshclam bubblewrap
```

Verifikasi biner terpasang:

```bash
command -v ffmpeg ffprobe bwrap clamdscan
ffmpeg -version | head -n 2
```

---

## 2. Konfigurasi Wajib ClamAV (`StreamMaxLength` > 250 MB)

Fitur Compress Video memindai berkas hingga `250.000.000` byte via Unix socket `INSTREAM` sebelum `ffprobe` dijalankan. Nilai default `clamd.conf` (`StreamMaxLength 25M` / `100M`) **akan menolak unggahan video besar secara fail-closed**.

Pastikan `/etc/clamav/clamd.conf` minimal mengatur:

```text
LocalSocket /run/clamav/clamd.ctl
LocalSocketMode 666
StreamMaxLength 300M
MaxFileSize 300M
MaxScanSize 350M
```

Lalu aktifkan pembaruan signature dan restart daemon (`ensure_fresh_signatures()` menolak signature lebih tua dari 24 jam):

```bash
sudo systemctl enable --now clamav-freshclam clamav-daemon
sudo systemctl restart clamav-daemon
sudo systemctl status clamav-daemon --no-pager
```

---

## 3. Direktori Workspace Bersama (`PrivateTmp=true` Compatibility)

Unit `deploy/satukit.service` (Uvicorn API) dan `deploy/satukit-video-worker.service` sama-sama mengaktifkan `PrivateTmp=true`. Jika `VIDEO_COMPRESSION_WORKSPACE_DIR` dibiarkan mengarah ke `/tmp/...`, API dan worker akan melihat namespace `/tmp` yang terpisah sehingga worker tidak menemukan `input.bin` maupun API tidak menemukan `output.mp4`.

1. Buat direktori bersama berizin ketat `0700`:

   ```bash
   sudo install -d -o satukit -g satukit -m 0700 /var/lib/satukit/video_jobs
   ```

2. Tambahkan pada `/etc/satukit/satukit.env`:

   ```ini
   VIDEO_COMPRESSION_WORKSPACE_DIR=/var/lib/satukit/video_jobs
   ```

   (`deploy/satukit.service` memakai `ProtectSystem=full` sehingga `/var/lib/satukit/video_jobs` dapat ditulis, sedangkan `deploy/satukit-video-worker.service` memakai `ProtectSystem=strict` dengan `ReadWritePaths=/var/lib/satukit/video_jobs ...`.)

---

## 4. Isolasi `bubblewrap` pada Ubuntu 24.04

Pada Ubuntu 24.04, `kernel.apparmor_restrict_unprivileged_userns=1` dapat memblokir `bwrap --unshare-net` oleh user non-root (`satukit`) dengan error namespace sehingga job gagal `SANDBOX_UNAVAILABLE`.

Uji langsung sebagai user `satukit`:

```bash
sudo -u satukit bwrap \
  --ro-bind / / \
  --dev /dev \
  --proc /proc \
  --tmpfs /tmp \
  --unshare-net --unshare-ipc --unshare-pid --die-with-parent \
  /usr/bin/ffmpeg -version | head -n 1
```

Jika ditolak AppArmor (`bwrap: setting up uid map: Permission denied`), terapkan profil AppArmor resmi Ubuntu untuk `bwrap` (`aa-enforce` / profil `bwrap` userns) dan uji ulang perintah di atas hingga keluar versi FFmpeg dengan exit code `0`.

---

## 5. Pemasangan Service Worker & Validasi Reverse Proxy Caddy

1. Jalankan migrasi database Alembic (`004_video_compression`):

   ```bash
   cd /var/www/satukit/backend
   sudo -u satukit .venv/bin/alembic upgrade head
   ```

2. Pasang unit worker dan validasi Caddyfile:

   ```bash
   sudo cp /var/www/satukit/deploy/satukit-video-worker.service /etc/systemd/system/
   sudo systemd-analyze verify /etc/systemd/system/satukit-video-worker.service
   sudo systemctl daemon-reload
   sudo systemctl enable --now satukit-video-worker.service
   sudo systemctl restart satukit.service
   ```

3. Terapkan `deploy/Caddyfile.example` ke `/etc/caddy/Caddyfile` (menjaga batas global `35MB` untuk seluruh endpoint kecuali matcher `@videoUpload` `POST /api/video-compressions` `260MB`) lalu validasi:

   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl reload caddy
   ```

---

## 6. Checklist Verifikasi Staging (`RISK-SEC-023` / `Q-007`)

Jalankan seluruh butir berikut sebelum menandai `RISK-SEC-023` selesai:

1. **Telemetry Health:** `curl -s https://<domain>/api/health` mengembalikan `ffmpeg_available: true`, `ffprobe_available: true`, `video_worker.status: "healthy"`, `video_worker.fresh: true`, dan tidak mengandung path filesystem internal.
2. **ClamAV 250 MB Stream:** Uji `POST /api/video-compressions` dengan berkas uji ~245–250 MB (tanpa melebihi `250.000.000` byte) melewati Caddy `@videoUpload`, ClamAV `INSTREAM` sukses tanpa error `INSTREAM size limit exceeded`, dan rute lain (misal unggahan > 35 MB selain `/api/video-compressions`) tetap ditolak HTTP `413`.
3. **EICAR Fail-Closed:** Unggahan sampel uji EICAR ditolak sebelum `ffprobe` dijalankan dan direktori job bersih.
4. **Profil RAM & CPU Staging (`1 vCPU / 2.2 GiB RAM`):** Pantau peak RSS `satukit-video-worker.service` (`systemctl status satukit-video-worker`) saat transcoding video 4K 10 menit / 1080p untuk memastikan penggunaan memori tetap aman di bawah `MemoryMax=950M` tanpa memicu OOM pada PostgreSQL maupun 2 worker Uvicorn.
5. **Single-Use & Cleanup:** Verifikasi unduhan sekali pakai mengembalikan `200`, unduhan kedua mengembalikan `409`, pembatalan saat `encoding` menghentikan seluruh process group `ffmpeg`, dan `/var/lib/satukit/video_jobs` kosong setelah job selesai/kedaluwarsa.
