# Runbook Deployment Produksi Satukit

Dokumen ini adalah panduan operasional langkah demi langkah untuk melakukan deployment platform **Satukit** pada Virtual Private Server (VPS) berspesifikasi minimal **1 vCPU / 2.2 GiB RAM** dengan sistem operasi **Ubuntu 24.04 LTS**.

---

## 1. Arsitektur Deployment Produksi

```
                     +---------------------------------------+
                     |         Internet / Pengguna           |
                     +---------------------------------------+
                                         |
                                HTTPS (Port 443)
                                         v
                     +---------------------------------------+
                     |         Caddy Web Server              |
                     |  - Automatic TLS (Let's Encrypt / CF) |
                     |  - Static Assets (/var/www/.../dist)  |
                     |  - Reverse Proxy /api ke loopback     |
                     +---------------------------------------+
                                         |
                         HTTP (127.0.0.1:8000 loopback)
                                         v
                     +---------------------------------------+
                     |     FastAPI Backend (Systemd Unit)    |
                     |  - Uvicorn (2 workers, async)         |
                     |  - Sandboxing (ProtectSystem, Limits) |
                     |  - Brevo Email API (HTTPS Outbound)   |
                     +---------------------------------------+
                         |                    |
                         v                    v
         +-----------------------+   +-----------------------+
         |  PostgreSQL 16 Local  |   |  Subprocess Sandbox   |
         |  (Port 5432 loopback) |   |  - LibreOffice (PDF)  |
         +-----------------------+   |  - Tesseract (OCR)    |
                                     |  - ONNX Runtime (CPU) |
                                     +-----------------------+
                                         |
                       Backup Harian Terenkripsi (Cron 03:00)
                                         v
                     +---------------------------------------+
                     |     Cloudflare R2 Object Storage      |
                     |     (AES-256-GCM Encrypted Tarball)   |
                     +---------------------------------------+
```

---

## 2. Persiapan Server & Paket Sistem

Jalankan perintah berikut sebagai `root` atau pengguna dengan hak akses `sudo`:

```bash
# 1. Update paket dan dependensi sistem
sudo apt update && sudo apt upgrade -y

# 2. Pasang dependensi esensial, basis data, dan engine dokumen
sudo apt install -y \
    curl wget git ufw htop \
    build-essential python3-dev python3-venv python3-pip \
    postgresql postgresql-contrib \
    libreoffice libreoffice-writer libreoffice-calc libreoffice-impress \
    tesseract-ocr tesseract-ocr-ind tesseract-ocr-eng \
    bubblewrap clamav clamav-daemon \
    awscli openssl

# 3. Pasang Caddy Web Server (Official Debian/Ubuntu repo)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy

# 4. Konfigurasi Swapfile 2GB (Penting untuk alokasi memori 2.2 GiB RAM)
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

# 5. Konfigurasi Firewall UFW
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw --force enable
```

---

## 3. Konfigurasi Pengguna & Basis Data PostgreSQL

```bash
# 1. Buat pengguna sistem terisolasi untuk Satukit
sudo useradd -r -s /bin/bash -d /var/www/satukit satukit || true
sudo mkdir -p /var/www/satukit /etc/satukit /var/log/satukit
sudo chown -R satukit:satukit /var/www/satukit /etc/satukit /var/log/satukit

# 2. Buat Basis Data dan Role PostgreSQL
sudo -u postgres psql <<EOF
CREATE DATABASE satukit;
CREATE USER satukit_user WITH ENCRYPTED PASSWORD 'PASSWORD_DATABASE_KUAT_ANDA';
GRANT ALL PRIVILEGES ON DATABASE satukit TO satukit_user;
ALTER DATABASE satukit OWNER TO satukit_user;
\c satukit
GRANT ALL ON SCHEMA public TO satukit_user;
EOF
```

---

## 4. Setup Kode Sumber & Virtualenv Backend

```bash
# 1. Pindahkan atau clone repositori ke /var/www/satukit
cd /var/www/satukit
# (Salin source code repositori ke direktori ini)

# 2. Setup direktori kerja dan permissions
sudo -u satukit mkdir -p \
    /var/www/satukit/backend/data \
    /var/www/satukit/backend/logs \
    /var/www/satukit/backend/temp_workspace \
    /var/www/satukit/backend/models

# 3. Setup Virtualenv Python & Pasang Dependensi
cd /var/www/satukit/backend
sudo -u satukit python3 -m venv .venv
sudo -u satukit .venv/bin/pip install --upgrade pip setuptools wheel
sudo -u satukit .venv/bin/pip install -r requirements.txt

# 4. Unduh Model ONNX AI U2NetP (Segmentasi Latar Belakang)
if [ ! -f /var/www/satukit/backend/models/u2netp.onnx ]; then
    sudo -u satukit wget -O /var/www/satukit/backend/models/u2netp.onnx \
        "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx"
fi
```

---

## 5. Konfigurasi Rahasia & Environment Produksi

```bash
# 1. Buat berkas kunci enkripsi backup AES-256 (32 bytes base64)
sudo openssl rand -base64 32 | sudo tee /etc/satukit/backup_aes256.key > /dev/null
sudo chmod 400 /etc/satukit/backup_aes256.key
sudo chown satukit:satukit /etc/satukit/backup_aes256.key

# 2. Salin template environment produksi
sudo cp /var/www/satukit/deploy/satukit.env.example /etc/satukit/satukit.env
sudo chown satukit:satukit /etc/satukit/satukit.env
sudo chmod 600 /etc/satukit/satukit.env

# 3. Generate Keyring AES-256-GCM untuk Rak Berkas (Root-Owned 0400)
sudo python3 /var/www/satukit/backend/scripts/generate_keyring.py -o /etc/satukit/keyring.json
sudo chmod 400 /etc/satukit/keyring.json
sudo chown root:root /etc/satukit/keyring.json

# 4. Siapkan direktori karantina berkas terisolasi
sudo mkdir -p /var/lib/satukit/quarantine
sudo chown satukit:satukit /var/lib/satukit/quarantine
sudo chmod 700 /var/lib/satukit/quarantine

# 5. Edit /etc/satukit/satukit.env dan sesuaikan nilai:
#    - PUBLIC_BASE_URL (misal: https://satukit.id)
#    - ALLOWED_ORIGINS (misal: https://satukit.id)
#    - TRUSTED_HOSTS (misal: satukit.id,127.0.0.1,localhost)
#    - DATABASE_URL (password yang telah dibuat pada langkah 3)
#    - BOT_CHALLENGE_SECRET (hasil: openssl rand -hex 32)
#    - SHORTENER_ADMIN_HMAC_SECRET (hasil: openssl rand -hex 32)
#    - BREVO_API_KEY & BREVO_SENDER_EMAIL
#    - Kredensial Cloudflare R2 (R2_ENDPOINT_URL, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
sudo nano /etc/satukit/satukit.env
```

---

## 6. Build Frontend & Konfigurasi Caddy

```bash
# 1. Build frontend artefak statis (jalankan di local dev atau di server jika Node terpasang)
cd /var/www/satukit/frontend
npm install
npm run build

# Pastikan folder /var/www/satukit/frontend/dist berisi index.html dan assets/
sudo chown -R satukit:www-data /var/www/satukit/frontend/dist
sudo chmod -R 755 /var/www/satukit/frontend/dist

# 2. Pasang Caddyfile
sudo cp /var/www/satukit/deploy/Caddyfile.example /etc/caddy/Caddyfile
# Ganti example.com pada /etc/caddy/Caddyfile dengan domain produksi Anda
sudo nano /etc/caddy/Caddyfile

# 3. Validasi konfigurasi Caddy dan reload
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

---

## 7. Aktivasi Systemd Service Backend, ClamAV, & Worker Rak Berkas

```bash
# 1. Konfigurasi dan pastikan daemon ClamAV aktif dengan Unix Socket
sudo systemctl stop clamav-freshclam
sudo freshclam
sudo systemctl enable --now clamav-freshclam
sudo systemctl enable --now clamav-daemon
# Verifikasi socket Unix ClamAV tersedia
ls -la /run/clamav/clamd.ctl

# 2. Pasang systemd unit service backend dan worker
sudo cp /var/www/satukit/deploy/satukit.service /etc/systemd/system/satukit.service
sudo cp /var/www/satukit/deploy/satukit-file-worker.service /etc/systemd/system/satukit-file-worker.service
sudo chmod 644 /etc/systemd/system/satukit.service /etc/systemd/system/satukit-file-worker.service

# 3. Reload daemon dan jalankan service
sudo systemctl daemon-reload
sudo systemctl enable --now satukit.service
sudo systemctl enable --now satukit-file-worker.service

# 4. Periksa status backend dan worker
sudo systemctl status satukit.service
sudo systemctl status satukit-file-worker.service
```

---

## 8. Verifikasi & Smoke Test Deployment

Jalankan perintah pengujian kesehatan layanan:

```bash
# 1. Verifikasi endpoint internal backend loopback
curl -i http://127.0.0.1:8000/api/health
# Ekspektasi: HTTP 200 OK dengan {"status": "ok", ...}

# 2. Verifikasi endpoint publik melalui Caddy reverse proxy
curl -i https://your-domain.com/api/health
# Ekspektasi: HTTP 200 OK dengan header HSTS dan CSP aktif

# 3. Verifikasi fail-fast registrasi dan proteksi komputasi server
curl -i -X POST https://your-domain.com/api/pdf-tools/merge
# Ekspektasi: HTTP 401 Unauthorized (karena akses anonim ke komputasi server)

# 4. Verifikasi UI Frontend
# Buka https://your-domain.com pada peramban web:
# - Navigasi ke #/tools
# - Buka WebP ke JPG atau QR Code (bisa dibuka langsung tanpa login)
# - Buka DOCX ke PDF atau Kompres PDF (dialihkan ke #/login dengan pemberitahuan)
```

---

## 9. Setup Cron Backup Harian Terenkripsi ke Cloudflare R2

```bash
# 1. Berikan izin eksekusi pada skrip backup & restore
sudo chmod 750 /var/www/satukit/deploy/backup_r2.sh /var/www/satukit/deploy/restore_r2.sh
sudo chown satukit:satukit /var/www/satukit/deploy/backup_r2.sh /var/www/satukit/deploy/restore_r2.sh

# 2. Uji coba backup manual pertama
sudo -u satukit /var/www/satukit/deploy/backup_r2.sh

# 3. Daftarkan cron job pada user satukit (eksekusi setiap pukul 03.00 UTC / 10.00 WIB)
sudo crontab -u satukit -l 2>/dev/null | { cat; echo "0 3 * * * /var/www/satukit/deploy/backup_r2.sh >> /var/log/satukit/backup.log 2>&1"; } | sudo crontab -u satukit -
```

---

## 10. Panduan Operasional & Penanganan Insiden (Troubleshooting)

### A. Memeriksa Log Layanan
```bash
# Log Backend Satukit
sudo journalctl -u satukit.service -f -n 100

# Log Akses & Error Caddy
sudo tail -f /var/log/caddy/satukit_access.log
sudo journalctl -u caddy -f

# Log Backup
sudo tail -f /var/log/satukit/backup.log
```

### B. Membersihkan Proses Hang (LibreOffice Zombie)
Jika konversi dokumen macet akibat berkas dokumen bermasalah:
```bash
sudo pkill -9 -f soffice.bin
```

### C. Pemulihan Bencana (Disaster Recovery Restore)
Jika server mengalami kerusakan atau migrasi data ke instance baru:
```bash
# 1. Hentikan service backend sementara
sudo systemctl stop satukit.service

# 2. Jalankan restorasi arsip terbaru dari Cloudflare R2
sudo -u satukit /var/www/satukit/deploy/restore_r2.sh

# 3. Jalankan kembali service backend
sudo systemctl start satukit.service
```
