"""Router Adapter Layanan Pemendek URL untuk Frontend Satukit
Menghubungkan antarmuka Satukit ke Cloudflare Workers Edge API (atau Local Fallback PostgreSQL).
"""

from __future__ import annotations

import hashlib
import hmac
import ipaddress
import re
import secrets
import string
import time
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.core.config import settings
from app.db.repositories.shortener_repository import ShortenerRepository

router = APIRouter(prefix="/shortener", tags=["shortener"])
redirect_router = APIRouter(tags=["redirect"])

SLUG_REGEX = re.compile(r"^[a-zA-Z0-9_-]{1,100}$")


class CreateShortUrlRequest(BaseModel):
    destination_url: str = Field(..., max_length=2048)
    slug: str | None = Field(None, max_length=100)


def validate_anti_ssrf(url_str: str) -> None:
    """Validasi ketat Anti-SSRF pada URL tujuan sesuai NFR-SEC-008."""
    if not url_str or not isinstance(url_str, str):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL tujuan wajib diisi.",
        )

    parsed = urlparse(url_str.strip())

    # 1. Wajib HTTPS publik
    if parsed.scheme.lower() != "https":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Hanya skema HTTPS publik yang diizinkan (Anti-SSRF).",
        )

    # 2. Larangan kredensial pengguna dalam URL
    if parsed.username or parsed.password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL tujuan dilarang memuat kredensial pengguna.",
        )

    hostname = (parsed.hostname or "").lower().strip()
    if not hostname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Hostname URL tujuan tidak valid.",
        )

    # 3. Larangan localhost dan domain internal
    forbidden_suffixes = (
        "localhost",
        ".localhost",
        ".local",
        ".internal",
        ".lan",
        ".home",
        ".corp",
        ".test",
    )
    if hostname == "localhost" or any(hostname.endswith(s) for s in forbidden_suffixes):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Hostname lokal atau jaringan internal dilarang (Anti-SSRF).",
        )

    # 4. Deteksi dan larangan IP privat / loopback / link-local
    try:
        ip = ipaddress.ip_address(hostname)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_reserved
            or ip.is_multicast
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Alamat IP privat, loopback, link-local, atau reserved dilarang.",
            )
    except ValueError:
        # Hostname berupa nama domain umum
        pass

    # 5. Domain publik harus memuat titik
    if "." not in hostname:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="URL tujuan harus berupa nama domain publik yang valid.",
        )


def generate_random_slug(length: int = 6) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def get_shortener_repo() -> ShortenerRepository:
    """Mengembalikan repository shortener aktif (PostgreSQL atau isolated SQLite fallback)."""
    default_sqlite_path = settings.BASE_DIR / "data" / "shortener_fallback.db"
    if settings.SHORTENER_FALLBACK_DB_PATH != default_sqlite_path:
        return ShortenerRepository.from_db_path(settings.SHORTENER_FALLBACK_DB_PATH)
    try:
        repo = ShortenerRepository()
        with repo._session() as session:
            session.execute(select(1))
        return repo
    except Exception:
        return ShortenerRepository.from_db_path(settings.SHORTENER_FALLBACK_DB_PATH)


@router.post("/create")
async def create_short_url(payload: CreateShortUrlRequest, request: Request):
    """Membuat tautan singkat baru melalui Edge Worker atau Local Fallback."""
    dest_url = payload.destination_url.strip()
    validate_anti_ssrf(dest_url)

    slug = (payload.slug or "").strip()
    if not slug:
        slug = generate_random_slug()
    else:
        if not SLUG_REGEX.match(slug):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "Format slug tidak valid "
                    "(hanya huruf, angka, dash, underscore, 1-100 karakter)."
                ),
            )

    # 1. Coba hubungi Cloudflare Workers Edge API jika dikonfigurasi
    edge_url = settings.SHORTENER_EDGE_URL.rstrip("/")
    api_target = f"{edge_url}/api/links"
    secret = settings.SHORTENER_ADMIN_HMAC_SECRET

    timestamp = int(time.time() * 1000)
    nonce = secrets.token_hex(8)
    body_payload = f'{{"slug":"{slug}","destination_url":"{dest_url}"}}'
    canonical = f"POST:/api/links:{timestamp}:{nonce}:{body_payload}"
    signature = hmac.new(
        secret.encode("utf-8"), canonical.encode("utf-8"), hashlib.sha256
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "X-Timestamp": str(timestamp),
        "X-Nonce": nonce,
    }

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.post(api_target, content=body_payload, headers=headers)
            if resp.status_code == 201:
                return {
                    "success": True,
                    "slug": slug,
                    "destination_url": dest_url,
                    "short_url": f"{edge_url}/{slug}",
                    "source": "cloudflare-workers",
                    "status": "active",
                }
            elif resp.status_code == 409:
                err = resp.json().get("error", "Slug telah digunakan.")
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=err)
            elif resp.status_code == 422:
                err = resp.json().get("error", "URL ditolak oleh anti-SSRF.")
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=err
                )
    except (httpx.RequestError, httpx.TimeoutException):
        # Edge tidak merespons / offline -> gunakan Local Fallback
        pass

    # 2. Local Fallback via ShortenerRepository
    repo = get_shortener_repo()
    existing = repo.get_by_slug(slug)
    if existing:
        if existing["status"] in ("revoked", "tombstone"):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=(
                    "Slug ini telah dicabut dan dilarang digunakan kembali "
                    "secara permanen (no slug reuse)."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Slug ini telah digunakan oleh tautan aktif lain.",
        )

    repo.create(slug=slug, destination_url=dest_url)

    return {
        "success": True,
        "slug": slug,
        "destination_url": dest_url,
        "short_url": f"{edge_url}/{slug}",
        "source": "local-fallback",
        "status": "active",
    }


@router.get("/config")
async def get_shortener_config():
    """Mengembalikan konfigurasi domain shortener untuk klien frontend."""
    return {
        "base_url": settings.SHORTENER_EDGE_URL.rstrip("/"),
        "admin_portal_url": f"{settings.SHORTENER_EDGE_URL.rstrip('/')}/admin",
    }


@redirect_router.get("/s/{slug}")
def redirect_short_url(slug: str):
    """Handler HTTP 302 Redirect Lokal untuk tautan singkat di fallback persistensi."""
    repo = get_shortener_repo()
    result = repo.record_click(slug)
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tautan singkat tidak ditemukan.",
        )

    dest_url, link_status = result
    if link_status in ("revoked", "tombstone"):
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="Tautan singkat ini telah dicabut.",
        )

    return RedirectResponse(url=dest_url, status_code=status.HTTP_302_FOUND)
