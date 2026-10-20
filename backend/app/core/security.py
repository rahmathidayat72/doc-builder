import hmac
import secrets
from pathlib import Path

SESSION_COOKIE_NAME = "docbuilder_session"
CSRF_HEADER_NAME = "X-CSRF-Token"


class LocalSessionManager:
    """Mengelola token sesi dan token CSRF untuk autentikasi localhost yang aman."""

    def __init__(self):
        self._bootstrap_token: str = secrets.token_urlsafe(32)
        self._session_token: str = secrets.token_urlsafe(32)
        self._csrf_token: str = secrets.token_urlsafe(32)
        self._token_file_path: Path | None = None

    def initialize_token_file(self, base_dir: Path) -> Path:
        """Menyimpan token bootstrap ke file lokal yang hanya dapat dibaca oleh user lokal."""
        token_dir = base_dir / ".local_security"
        token_dir.mkdir(parents=True, exist_ok=True)
        self._token_file_path = token_dir / "bootstrap.token"

        # Tulis token
        self._token_file_path.write_text(self._bootstrap_token, encoding="utf-8")

        # Di Linux/Unix, set izin 0600 (read/write hanya owner)
        try:
            self._token_file_path.chmod(0o600)
        except Exception:
            pass

        return self._token_file_path

    @property
    def bootstrap_token(self) -> str:
        return self._bootstrap_token

    @property
    def session_token(self) -> str:
        return self._session_token

    @property
    def csrf_token(self) -> str:
        return self._csrf_token

    def verify_bootstrap(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._bootstrap_token, token)

    def verify_session(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._session_token, token)

    def verify_csrf(self, token: str) -> bool:
        if not token:
            return False
        return hmac.compare_digest(self._csrf_token, token)


session_manager = LocalSessionManager()
