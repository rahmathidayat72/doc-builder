#!/usr/bin/env bash
# ==============================================================================
# Satukit - Automated Encrypted Backup to Cloudflare R2
# Script: deploy/backup_r2.sh
# Frequency: Daily cron (e.g., 03:00 UTC)
# ==============================================================================

set -euo pipefail

# 1. Konfigurasi Path & Environment
ENV_FILE="${ENV_FILE:-/etc/satukit/satukit.env}"
BACKUP_TMP_DIR="${BACKUP_TMP_DIR:-/tmp/satukit_backup_$$}"
DATE_TAG="$(date -u +%Y%m%d_%H%M%SZ)"
ARCHIVE_NAME="satukit_backup_${DATE_TAG}.tar.gz"
ENCRYPTED_NAME="${ARCHIVE_NAME}.enc"

log() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [BACKUP] $*"
}

error_exit() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" >&2
    cleanup
    exit 1
}

cleanup() {
    if [[ -d "${BACKUP_TMP_DIR}" ]]; then
        rm -rf "${BACKUP_TMP_DIR}"
    fi
}
trap cleanup EXIT INT TERM

# 2. Muat Variabel Lingkungan
if [[ ! -f "${ENV_FILE}" ]]; then
    error_exit "Berkas konfigurasi ${ENV_FILE} tidak ditemukan."
fi

# Load env variables safely
set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

# 3. Validasi Dependensi Wajib
command -v pg_dump >/dev/null 2>&1 || error_exit "pg_dump tidak ditemukan di PATH."
command -v openssl >/dev/null 2>&1 || error_exit "openssl tidak ditemukan di PATH."
command -v aws >/dev/null 2>&1 || error_exit "aws cli tidak ditemukan di PATH."

if [[ -z "${DATABASE_URL:-}" ]]; then
    error_exit "DATABASE_URL belum diatur di ${ENV_FILE}."
fi

if [[ -z "${R2_ENDPOINT_URL:-}" || -z "${R2_BUCKET:-}" || -z "${R2_ACCESS_KEY_ID:-}" || -z "${R2_SECRET_ACCESS_KEY:-}" ]]; then
    error_exit "Kredensial Cloudflare R2 (R2_ENDPOINT_URL, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY) belum lengkap."
fi

if [[ -z "${BACKUP_ENCRYPTION_KEY_FILE:-}" || ! -f "${BACKUP_ENCRYPTION_KEY_FILE}" ]]; then
    error_exit "Berkas kunci enkripsi ${BACKUP_ENCRYPTION_KEY_FILE:-} tidak ditemukan. Buat dengan: openssl rand -base64 32 > /etc/satukit/backup_aes256.key && chmod 400 /etc/satukit/backup_aes256.key"
fi

mkdir -p "${BACKUP_TMP_DIR}"
chmod 700 "${BACKUP_TMP_DIR}"

log "Memulai proses backup Satukit (${DATE_TAG})..."

# 4. Dump Basis Data PostgreSQL
# Normalisasi URL SQLAlchemy (postgresql+psycopg:// -> postgresql://)
RAW_PG_URL="${DATABASE_URL/postgresql+psycopg:\/\//postgresql:\/\/}"
DUMP_SQL="${BACKUP_TMP_DIR}/satukit_db.sql"

log "Melakukan pg_dump ke ${DUMP_SQL}..."
pg_dump --dbname="${RAW_PG_URL}" --clean --if-exists --no-owner --no-privileges -f "${DUMP_SQL}"

# 5. Salin Direktori Audit Logs & Data Penting
DATA_COPY_DIR="${BACKUP_TMP_DIR}/data"
mkdir -p "${DATA_COPY_DIR}"

if [[ -d "/var/www/satukit/backend/logs" ]]; then
    cp -r "/var/www/satukit/backend/logs" "${DATA_COPY_DIR}/logs" 2>/dev/null || true
fi

# 6. Buat Tarball Terkompresi
RAW_TAR="${BACKUP_TMP_DIR}/${ARCHIVE_NAME}"
log "Mengompresi data ke ${ARCHIVE_NAME}..."
tar -czf "${RAW_TAR}" -C "${BACKUP_TMP_DIR}" satukit_db.sql data

# 7. Enkripsi AES-256-GCM dengan OpenSSL
ENCRYPTED_FILE="${BACKUP_TMP_DIR}/${ENCRYPTED_NAME}"
log "Mengenkripsi arsip dengan OpenSSL AES-256-GCM (PBKDF2 100k iter)..."
openssl enc -aes-256-gcm \
    -salt \
    -pbkdf2 \
    -iter 100000 \
    -pass "file:${BACKUP_ENCRYPTION_KEY_FILE}" \
    -in "${RAW_TAR}" \
    -out "${ENCRYPTED_FILE}"

# 8. Unggah ke Cloudflare R2 via AWS CLI (S3 Compatible API)
log "Mengunggah ${ENCRYPTED_NAME} ke Cloudflare R2 (bucket: ${R2_BUCKET})..."
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
AWS_DEFAULT_REGION="auto" \
aws s3 cp "${ENCRYPTED_FILE}" "s3://${R2_BUCKET}/backups/${ENCRYPTED_NAME}" \
    --endpoint-url "${R2_ENDPOINT_URL}" \
    --no-progress

log "Unggah selesai: s3://${R2_BUCKET}/backups/${ENCRYPTED_NAME}"

# 9. Rotasi Otomatis (Retensi 7 Hari Terakhir di Cloudflare R2)
log "Menjalankan rotasi backup lama (> 7 hari)..."
CUTOFF_DATE="$(date -u -d '7 days ago' +%Y%m%d 2>/dev/null || date -u -v-7d +%Y%m%d)"

AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
AWS_DEFAULT_REGION="auto" \
aws s3 ls "s3://${R2_BUCKET}/backups/" --endpoint-url "${R2_ENDPOINT_URL}" | while read -r line; do
    BACKUP_FILE="$(echo "${line}" | awk '{print $4}')"
    if [[ "${BACKUP_FILE}" =~ satukit_backup_([0-9]{8})_.*\.enc ]]; then
        FILE_DATE="${BASH_REMATCH[1]}"
        if [[ "${FILE_DATE}" < "${CUTOFF_DATE}" ]]; then
            log "Menghapus backup kedaluwarsa dari R2: ${BACKUP_FILE}"
            AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
            AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
            AWS_DEFAULT_REGION="auto" \
            aws s3 rm "s3://${R2_BUCKET}/backups/${BACKUP_FILE}" --endpoint-url "${R2_ENDPOINT_URL}"
        fi
    fi
done

log "Proses backup terenkripsi selesai dengan sukses."
