from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.core.config import settings
from app.core.middleware import SecurityMiddleware
from app.core.security import session_manager


def create_app() -> FastAPI:
    # Inisialisasi token lokal saat startup
    session_manager.initialize_token_file(settings.BASE_DIR)

    app = FastAPI(
        title=settings.PROJECT_NAME, version=settings.VERSION, docs_url="/docs", redoc_url=None
    )

    # Middleware Keamanan (Security Hardening & CSRF)
    app.add_middleware(SecurityMiddleware)

    # Batasi CORS hanya pada origin frontend terdaftar
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    app.include_router(health_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host=settings.HOST, port=settings.PORT, reload=True)
