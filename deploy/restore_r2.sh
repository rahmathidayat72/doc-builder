#!/usr/bin/env bash
# ==============================================================================
# Satukit - Disaster Recovery Restore from Cloudflare R2
# Script: deploy/restore_r2.sh
# Usage: ./restore_r2.sh [satukit_backup_YYYYMMDD_HHMMSSZ.tar.gz.enc]
# ==============================================================================

set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/satukit/satukit.env}"
RESTORE_TMP_DIR="${RESTORE_TMP_DIR:-/tmp/satukit_restore_$$}"

log() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [RESTORE] $*"
}

error_exit() {
    echo "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] [ERROR] $*" >&2
    cleanup
    exit 1
}

cleanup() {
    if [[ -d "${RESTORE_TMP_DIR}" ]]; then
        rm -rf "${RESTORE_TMP_DIR}"
    fi
}
trap cleanup EXIT INT TERM

# 1. Validasi Variabel Lingkungan
if [[ ! -f "${ENV_FILE}" ]]; then
    error_exit "Berkas konfigurasi ${ENV_FILE} tidak ditemukan."
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

command -v psql >/dev/null 2>&1 || error_exit "psql tidak ditemukan di PATH."
command -v openssl >/dev/null 2>&1 || error_exit "openssl tidak ditemukan di PATH."
command -v aws >/dev/null 2>&1 || error_exit "aws cli tidak ditemukan di PATH."

if [[ -z "${BACKUP_ENCRYPTION_KEY_FILE:-}" || ! -f "${BACKUP_ENCRYPTION_KEY_FILE}" ]]; then
    error_exit "Berkas kunci dekripsi ${BACKUP_ENCRYPTION_KEY_FILE:-} tidak ditemukan."
fi

mkdir -p "${RESTORE_TMP_DIR}"
chmod 700 "${RESTORE_TMP_DIR}"

# 2. Tentukan Berkas Backup yang Akan Direstorasi
TARGET_BACKUP="${1:-}"

if [[ -z "${TARGET_BACKUP}" ]]; then
    log "Mencari backup terbaru di s3://${R2_BUCKET}/backups/..."
    LATEST_FILE="$(
        AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
        AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
        AWS_DEFAULT_REGION="auto" \
        aws s3 ls "s3://${R2_BUCKET}/backups/" --endpoint-url "${R2_ENDPOINT_URL}" \
            | sort -k1,2 \
            | tail -n 1 \
            | awk '{print $4}'
    )"
    if [[ -z "${LATEST_FILE}" ]]; then
        error_exit "Tidak ada berkas backup yang ditemukan di R2 bucket."
    fi
    TARGET_BACKUP="${LATEST_FILE}"
    log "Backup terbaru dipilih otomatis: ${TARGET_BACKUP}"
fi

# 3. Unduh dari Cloudflare R2
ENCRYPTED_LOCAL="${RESTORE_TMP_DIR}/${TARGET_BACKUP}"
log "Mengunduh ${TARGET_BACKUP} dari R2..."
AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}" \
AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}" \
AWS_DEFAULT_REGION="auto" \
aws s3 cp "s3://${R2_BUCKET}/backups/${TARGET_BACKUP}" "${ENCRYPTED_LOCAL}" \
    --endpoint-url "${R2_ENDPOINT_URL}"

# 4. Dekripsi AES-256-GCM
RAW_TAR="${RESTORE_TMP_DIR}/restored.tar.gz"
log "Mendekripsi berkas arsip menggunakan kunci AES-256-GCM..."
openssl enc -d -aes-256-gcm \
    -pbkdf2 \
    -iter 100000 \
    -pass "file:${BACKUP_ENCRYPTION_KEY_FILE}" \
    -in "${ENCRYPTED_LOCAL}" \
    -out "${RAW_TAR}"

# 5. Ekstrak Arsip
log "Mengekstrak tarball..."
tar -xzf "${RAW_TAR}" -C "${RESTORE_TMP_DIR}"

if [[ ! -f "${RESTORE_TMP_DIR}/satukit_db.sql" ]]; then
    error_exit "File satukit_db.sql tidak ditemukan dalam arsip yang didekripsi."
fi

# 6. Konfirmasi Eksekusi Restorasi
RAW_PG_URL="${DATABASE_URL/postgresql+psycopg:\/\//postgresql:\/\/}"
log "PERINGATAN: Restorasi akan menimpa basis data yang ada saat ini."
log "Menerapkan dump SQL ke ${RAW_PG_URL}..."

psql "${RAW_PG_URL}" -f "${RESTORE_TMP_DIR}/satukit_db.sql"

# 7. Kembalikan Berkas Log/Data jika diperlukan
if [[ -d "${RESTORE_TMP_DIR}/data/logs" && -d "/var/www/satukit/backend/logs" ]]; then
    log "Memulihkan berkas audit logs..."
    cp -rn "${RESTORE_TMP_DIR}/data/logs/"* "/var/www/satukit/backend/logs/" 2>/dev/null || true
fi

log "Restorasi basis data Satukit berhasil diselesaikan!"
