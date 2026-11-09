from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.ats import router as ats_router
from app.api.auth import router as auth_router
from app.api.converter import router as converter_router
from app.api.export import router as export_router
from app.api.health import router as health_router
from app.api.image_tools import router as image_tools_router
from app.api.import_cv import router as import_router
from app.api.media_downloader import router as media_downloader_router
from app.api.pdf_tools import router as pdf_tools_router
from app.api.shortener import router as shortener_router
from app.core.config import settings
from app.core.disk_guard import DiskSpaceExhaustedError
from app.core.jobs import background_sweeper
from app.core.middleware import SecurityMiddleware
from app.core.security import session_manager
from app.db.session import init_db
from app.services.media_downloader import media_downloader


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    # Inisialisasi basis data SQLite dan tabel multi-user
    init_db()
    # Startup: jalankan background periodic sweeper & worker unduhan media
    background_sweeper.start()
    media_downloader.start()
    try:
        yield
    finally:
        # Shutdown: hentikan background sweeper & worker secara bersih
        media_downloader.stop()
        background_sweeper.stop()


def create_app() -> FastAPI:
    # Inisialisasi basis data SQLite dan tabel multi-user
    init_db()
    # Inisialisasi token lokal saat startup
    session_manager.initialize_token_file(settings.BASE_DIR)

    app = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        docs_url="/docs",
        redoc_url=None,
        lifespan=lifespan,
    )

    # Middleware Keamanan (Security Hardening & CSRF)
    app.add_middleware(SecurityMiddleware)

    # Exception handler fail-closed kapasitas disk penuh (BRULE-014 / NFR-SEC-012)
    @app.exception_handler(DiskSpaceExhaustedError)
    async def disk_exhausted_handler(_: Request, exc: DiskSpaceExhaustedError) -> JSONResponse:
        return JSONResponse(
            status_code=507,
            content={
                "success": False,
                "error": str(exc.detail if hasattr(exc, "detail") else exc),
                "code": "DISK_SPACE_EXHAUSTED",
            },
        )

    # Batasi CORS hanya pada origin frontend terdaftar
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=[
            "Content-Disposition",
            "X-Job-ID",
            "X-Compression-Applied",
            "X-Original-Size",
            "X-Output-Size",
            "X-Pages-Recovered",
            "X-OCR-Pages",
            "X-Watermarked-Pages",
            "X-Numbered-Pages",
            "X-Total-Pages",
            "X-Converted-Pages",
            "X-Markdown-Length",
        ],
    )

    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(export_router, prefix="/api")
    app.include_router(import_router, prefix="/api")
    app.include_router(ats_router, prefix="/api")
    app.include_router(converter_router, prefix="/api")
    app.include_router(pdf_tools_router, prefix="/api")
    app.include_router(image_tools_router, prefix="/api")
    app.include_router(shortener_router, prefix="/api")
    app.include_router(media_downloader_router, prefix="/api")

    # Sajikan static frontend SPA jika folder dist tersedia (mode rilis / distribusi lokal)
    frontend_dist = settings.BASE_DIR.parent / "frontend" / "dist"
    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        from starlette.staticfiles import StaticFiles

        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")

    return app


app = create_app()
