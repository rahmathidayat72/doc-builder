"""
Satukit File Shelf Background Worker
Task: FS-07 (Phase File Shelf)
Handles:
- Processing CHECKING items: Antivirus, deep inspection, AES-256-GCM encryption, R2 upload
- Sweeping file_deletion_jobs: Async R2 deletion (<24 hours)
- Auto-deleting expired files (30 days retention)
- Polling Cloudflare GraphQL API for R2 usage metrics every 15 minutes (fail-closed >30m)
"""

from __future__ import annotations

import datetime
import logging
import os
import signal
import time
import uuid
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.file_shelf import check_r2_storage_health
from app.core.config import settings
from app.db.models import FileDeletionJob, FileShelfItem, RuntimeState
from app.db.postgres import get_db_session
from app.services.file_crypto import encrypt_file_envelope
from app.services.file_inspector import (
    FileInspectionError,
    QuarantineManager,
    inspect_file_safety,
)
from app.services.file_scanner import ClamAVError, get_clamav_scanner
from app.services.r2_storage import get_r2_storage

logger = logging.getLogger("satukit.file_worker")

CLOUDFLARE_GRAPHQL_QUERY = """
query GetR2Usage($accountTag: string!, $filter: AccountR2StorageAdaptiveGroupsFilterInput!) {
  viewer {
    accounts(filter: { accountTag: $accountTag }) {
      r2StorageAdaptiveGroups(filter: $filter, limit: 1) {
        max {
          payloadSize
        }
      }
      r2OperationsAdaptiveGroups(filter: $filter, limit: 100) {
        dimensions {
          actionType
        }
        sum {
          requests
        }
      }
    }
  }
}
"""


def poll_cloudflare_graphql_metrics(
    session: Session,
    api_token: str | None = None,
    account_id: str | None = None,
    graphql_url: str | None = None,
    http_client: Any | None = None,
) -> dict[str, Any]:
    """
    Polls Cloudflare GraphQL API for account-wide R2 storage bytes and Class A/B operation counts.
    Saves metrics into RuntimeState(key="r2_metrics").
    """
    token = api_token or settings.CLOUDFLARE_API_TOKEN
    acc_id = account_id or settings.CLOUDFLARE_ACCOUNT_ID
    url = graphql_url or settings.CLOUDFLARE_GRAPHQL_URL
    now = time.time()

    storage_bytes = 0
    class_a_ops = 0
    class_b_ops = 0

    if token and acc_id:
        now_dt = datetime.datetime.now(datetime.UTC)
        start_of_month = now_dt.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        ).strftime("%Y-%m-%dT%H:%M:%SZ")
        end_of_month = now_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        variables = {
            "accountTag": acc_id,
            "filter": {
                "datetime_geq": start_of_month,
                "datetime_leq": end_of_month,
            },
        }
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        try:
            if http_client is not None:
                resp = http_client.post(
                    url,
                    headers=headers,
                    json={"query": CLOUDFLARE_GRAPHQL_QUERY, "variables": variables},
                    timeout=15.0,
                )
            else:
                with httpx.Client(timeout=15.0) as client:
                    resp = client.post(
                        url,
                        headers=headers,
                        json={"query": CLOUDFLARE_GRAPHQL_QUERY, "variables": variables},
                    )

            if resp.status_code == 200:
                body = resp.json()
                accounts = (
                    body.get("data", {}).get("viewer", {}).get("accounts", [])
                )
                if accounts:
                    acc_data = accounts[0]
                    storage_groups = acc_data.get("r2StorageAdaptiveGroups", [])
                    if storage_groups:
                        storage_bytes = (
                            storage_groups[0].get("max", {}).get("payloadSize", 0) or 0
                        )

                    ops_groups = acc_data.get("r2OperationsAdaptiveGroups", [])
                    for op in ops_groups:
                        action = op.get("dimensions", {}).get("actionType", "")
                        count = op.get("sum", {}).get("requests", 0) or 0
                        # Class A: PutObject, ListObjects, CreateBucket, etc.
                        # Class B: GetObject, HeadObject, etc.
                        if action in ("PutObject", "ListObjects", "CopyObject"):
                            class_a_ops += count
                        elif action in ("GetObject", "HeadObject"):
                            class_b_ops += count
            else:
                logger.warning(
                    "Cloudflare GraphQL returned non-200 status: %d", resp.status_code
                )
        except Exception as e:
            logger.error("Failed to query Cloudflare GraphQL API: %s", e)
            if settings.IS_PRODUCTION:
                # Do not refresh last_polled_at to allow fail-closed trigger after 30 min
                return {}
    else:
        # Development / non-configured fallback
        existing_state = session.get(RuntimeState, "r2_metrics")
        if existing_state and existing_state.value:
            storage_bytes = existing_state.value.get("storage_bytes", 0)
            class_a_ops = existing_state.value.get("class_a_operations", 0)
            class_b_ops = existing_state.value.get("class_b_operations", 0)

    metrics_data = {
        "storage_bytes": storage_bytes,
        "class_a_operations": class_a_ops,
        "class_b_operations": class_b_ops,
        "last_polled_at": now,
    }

    state = session.get(RuntimeState, "r2_metrics")
    if not state:
        state = RuntimeState(key="r2_metrics", value=metrics_data, updated_at=now)
        session.add(state)
    else:
        state.value = metrics_data
        state.updated_at = now

    session.flush()
    return metrics_data


def process_checking_items(session: Session, limit: int = 10) -> int:
    """
    Processes file_shelf_items in status CHECKING:
    1. Scan antivirus via ClamAV socket INSTREAM
    2. Deep format safety inspection
    3. AES-256-GCM envelope 49B encryption with canonical identity AAD
    4. Cloudflare R2 upload
    5. Promotion to AVAILABLE (or FAILED on error)
    """
    stmt = (
        select(FileShelfItem)
        .where(
            FileShelfItem.status == "CHECKING",
            FileShelfItem.deleted_at.is_(None),
        )
        .order_by(FileShelfItem.uploaded_at.asc())
        .limit(limit)
    )
    items = list(session.execute(stmt).scalars().all())
    processed_count = 0

    qm = QuarantineManager()
    scanner = get_clamav_scanner()
    r2 = get_r2_storage()

    for item in items:
        processed_count += 1
        qpath = item.quarantine_path
        if not qpath or not os.path.exists(qpath):
            item.status = "FAILED"
            item.error_message = "Berkas dalam karantina lokal tidak ditemukan."
            session.flush()
            continue

        try:
            with open(qpath, "rb") as f:
                raw_bytes = f.read()

            # 1. Antivirus scan via ClamAV
            try:
                scan_res = scanner.scan_bytes(raw_bytes)
                if not scan_res.is_clean:
                    item.status = "FAILED"
                    item.error_message = (
                        f"Malware terdeteksi oleh antivirus: {scan_res.virus_name}"
                    )
                    qm.remove_file(qpath)
                    session.flush()
                    continue
            except ClamAVError as ce:
                logger.error("ClamAV scan error for item %s: %s", item.id, ce)
                item.status = "FAILED"
                item.error_message = f"Pemindaian antivirus gagal: {ce}"
                qm.remove_file(qpath)
                session.flush()
                continue

            # 2. Format safety inspection
            try:
                inspection = inspect_file_safety(raw_bytes, item.filename)
            except FileInspectionError as fie:
                logger.warning("File inspection rejected item %s: %s", item.id, fie)
                item.status = "FAILED"
                item.error_message = f"Validasi keamanan berkas gagal: {fie}"
                qm.remove_file(qpath)
                session.flush()
                continue

            # 3. Check R2 storage health & capacity ceiling
            _status_str, can_upload, _ = check_r2_storage_health(session)
            if not can_upload:
                item.status = "FAILED"
                item.error_message = (
                    "Kapasitas penyimpanan cloud penuh atau operasi Class A dibatasi."
                )
                qm.remove_file(qpath)
                session.flush()
                continue

            # 4. Encrypt with AES-256-GCM envelope 49B + identity AAD
            target_content_type = inspection.content_type or item.content_type
            encrypted_bytes, key_id = encrypt_file_envelope(
                plaintext=raw_bytes,
                user_id=item.user_id,
                item_id=item.id,
                content_type=target_content_type,
            )

            # 5. Upload ciphertext to Cloudflare R2
            r2_key = f"files/{item.user_id}/{item.id}/payload.enc"
            r2.upload_object(r2_key, encrypted_bytes)

            # 6. Update database record to AVAILABLE
            now = time.time()
            item.status = "AVAILABLE"
            item.available_at = now
            item.expires_at = now + (30 * 86400)  # 30 days retention
            item.sha256_hash = inspection.sha256_hash
            item.r2_object_key = r2_key
            item.r2_key_id = key_id
            item.content_type = target_content_type
            item.has_exif_warning = inspection.has_exif_warning
            item.error_message = None

            # 7. Remove quarantine file
            qm.remove_file(qpath)
            session.flush()

        except Exception as exc:
            logger.exception("Unexpected error processing file item %s: %s", item.id, exc)
            item.status = "FAILED"
            item.error_message = f"Kegagalan sistem pemrosesan berkas: {exc}"
            qm.remove_file(qpath)
            session.flush()

    return processed_count


def process_deletion_jobs(session: Session, limit: int = 50) -> int:
    """
    Processes pending file_deletion_jobs by deleting objects from Cloudflare R2.
    Ensures R2 deletion within 24 hours.
    """
    stmt = (
        select(FileDeletionJob)
        .where(FileDeletionJob.status == "PENDING")
        .order_by(FileDeletionJob.created_at.asc())
        .limit(limit)
    )
    jobs = list(session.execute(stmt).scalars().all())
    processed_count = 0
    r2 = get_r2_storage()

    for job in jobs:
        processed_count += 1
        now = time.time()
        try:
            if job.r2_object_key:
                r2.delete_object(job.r2_object_key)
            job.status = "COMPLETED"
            job.updated_at = now
            job.last_error = None
        except Exception as e:
            logger.error("Failed to delete R2 object %s: %s", job.r2_object_key, e)
            job.status = "FAILED"
            job.last_error = str(e)
            job.updated_at = now
        session.flush()

    return processed_count


def process_retention_sweep(session: Session) -> int:
    """
    Sweeps expired files (retention 30 days past available_at).
    Soft-deletes the item and enqueues an R2 deletion job.
    """
    now = time.time()
    stmt = select(FileShelfItem).where(
        FileShelfItem.status == "AVAILABLE",
        FileShelfItem.deleted_at.is_(None),
        FileShelfItem.expires_at.is_not(None),
        FileShelfItem.expires_at <= now,
    )
    expired_items = list(session.execute(stmt).scalars().all())
    expired_count = 0

    for item in expired_items:
        expired_count += 1
        item.status = "DELETED"
        item.deleted_at = now

        if item.r2_object_key:
            del_job = FileDeletionJob(
                id=str(uuid.uuid4()),
                file_id=item.id,
                user_id=item.user_id,
                r2_object_key=item.r2_object_key,
                status="PENDING",
                created_at=now,
                updated_at=now,
            )
            session.add(del_job)
        session.flush()

    return expired_count


def run_worker_pass(session: Session, poll_metrics: bool = True) -> dict[str, Any]:
    """Runs a single pass of all worker tasks."""
    stats: dict[str, Any] = {
        "checked": 0,
        "deleted": 0,
        "expired": 0,
        "metrics": {},
    }

    if poll_metrics:
        stats["metrics"] = poll_cloudflare_graphql_metrics(session)

    stats["checked"] = process_checking_items(session)
    stats["deleted"] = process_deletion_jobs(session)
    stats["expired"] = process_retention_sweep(session)

    return stats


def run_daemon_loop(
    interval_seconds: float = 5.0,
    metrics_interval_seconds: float = 900.0,
    stop_event: Any | None = None,
) -> None:
    """
    Long-running daemon loop for satukit-file-worker.service.
    """
    logger.info("Starting Satukit File Shelf Background Worker daemon...")
    last_metrics_poll = 0.0

    while True:
        if stop_event is not None and stop_event.is_set():
            logger.info("Stop event received. Exiting file worker loop.")
            break

        now = time.time()
        should_poll_metrics = (now - last_metrics_poll) >= metrics_interval_seconds

        try:
            with get_db_session() as session:
                stats = run_worker_pass(session, poll_metrics=should_poll_metrics)
                if should_poll_metrics:
                    last_metrics_poll = now
                if stats["checked"] > 0 or stats["deleted"] > 0 or stats["expired"] > 0:
                    logger.info("Worker pass stats: %s", stats)
        except Exception as e:
            logger.error("Error during worker pass: %s", e)

        time.sleep(interval_seconds)


def main() -> None:
    """Entry point for python -m app.workers.file_worker"""
    logging.basicConfig(
        level=logging.INFO,
        format="[%(asctime)s] [%(levelname)s] [satukit.file_worker] %(message)s",
    )

    class GracefulKiller:
        kill_now = False

        def __init__(self):
            signal.signal(signal.SIGINT, self.exit_gracefully)
            signal.signal(signal.SIGTERM, self.exit_gracefully)

        def exit_gracefully(self, signum, frame):
            self.kill_now = True

        def is_set(self):
            return self.kill_now

    killer = GracefulKiller()
    run_daemon_loop(interval_seconds=5.0, stop_event=killer)


if __name__ == "__main__":
    main()
