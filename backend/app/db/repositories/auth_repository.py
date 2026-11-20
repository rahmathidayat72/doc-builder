from __future__ import annotations

import time
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from sqlalchemy import Engine, create_engine, delete, func, select, update
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import AuthToken, OAuthAccount, OAuthTransaction, User, UserSession
from app.db.postgres import Base, SessionLocal


@dataclass
class UserRecord:
    id: str
    email: str
    password_hash: str | None
    name: str
    email_verified: bool
    created_at: float
    updated_at: float
    avatar_url: str | None = None

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None and len(self.password_hash) > 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "name": self.name,
            "email_verified": self.email_verified,
            "has_password": self.has_password,
            "avatar_url": self.avatar_url,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }


@dataclass
class OAuthTransactionRecord:
    state_hash: str
    provider: str
    intent: str
    user_id: str | None
    browser_binding_hash: str
    code_verifier: str
    nonce: str
    created_at: float
    expires_at: float
    used_at: float | None


def user_to_record(user: User) -> UserRecord:
    return UserRecord(
        id=user.id,
        email=user.email,
        password_hash=user.password_hash,
        name=user.name,
        email_verified=bool(user.email_verified),
        created_at=user.created_at,
        updated_at=user.updated_at,
        avatar_url=getattr(user, "avatar_url", None),
    )


class AuthRepository:
    """Repository database relasional untuk operasi data autentikasi dan akun pengguna."""

    def __init__(self, session_factory: sessionmaker[Session] | None = None) -> None:
        self.session_factory = session_factory or SessionLocal

    @contextmanager
    def _session(self) -> Iterator[Session]:
        session = self.session_factory()
        try:
            yield session
            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    @classmethod
    def from_engine(cls, engine: Engine) -> AuthRepository:
        """Membuat repository terikat ke engine tertentu (misal in-memory test engine)."""
        Base.metadata.create_all(engine)
        return cls(sessionmaker(autocommit=False, autoflush=False, bind=engine))

    @classmethod
    def from_db_manager(cls, db_manager: Any) -> AuthRepository:
        """Adapter kompatibilitas sementara untuk DatabaseManager SQLite lama."""
        # ponytail: Adapter jembatan selama transisi migrasi SQLite ke PostgreSQL.
        # Upgrade path: hapus saat DatabaseManager lama resmi di-retire di DB-POSTGRES-007.
        db_path = getattr(db_manager, "db_path", None)
        if db_path:
            engine = create_engine(
                f"sqlite:///{Path(db_path).as_posix()}",
                connect_args={"check_same_thread": False},
            )
            return cls.from_engine(engine)
        return cls()

    def get_user_by_id(self, user_id: str) -> UserRecord | None:
        with self._session() as session:
            user = session.get(User, user_id)
            return user_to_record(user) if user else None

    def get_user_by_email(self, email: str) -> UserRecord | None:
        with self._session() as session:
            user = session.scalars(select(User).where(User.email == email)).first()
            return user_to_record(user) if user else None

    def create_user_with_token(
        self,
        user_id: str,
        email: str,
        password_hash: str | None,
        name: str,
        email_verified: bool,
        token_hash: str,
        token_type: str,
        token_expires_at: float,
        now: float,
    ) -> UserRecord:
        with self._session() as session:
            user = User(
                id=user_id,
                email=email,
                password_hash=password_hash,
                name=name,
                email_verified=1 if email_verified else 0,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.flush()
            token = AuthToken(
                token_hash=token_hash,
                user_id=user_id,
                token_type=token_type,
                created_at=now,
                expires_at=token_expires_at,
            )
            session.add(token)
            return user_to_record(user)

    def get_user_by_google_oauth(self, provider_user_id: str) -> UserRecord | None:
        with self._session() as session:
            stmt = (
                select(User)
                .join(OAuthAccount, User.id == OAuthAccount.user_id)
                .where(
                    OAuthAccount.provider == "google",
                    OAuthAccount.provider_user_id == provider_user_id,
                )
            )
            user = session.scalars(stmt).first()
            return user_to_record(user) if user else None

    def create_google_user(
        self,
        user_id: str,
        email: str,
        name: str,
        email_verified: bool,
        provider_user_id: str,
        now: float,
        avatar_url: str | None = None,
    ) -> UserRecord:
        with self._session() as session:
            user = User(
                id=user_id,
                email=email,
                password_hash=None,
                name=name,
                avatar_url=avatar_url,
                email_verified=1 if email_verified else 0,
                created_at=now,
                updated_at=now,
            )
            session.add(user)
            session.flush()
            oauth = OAuthAccount(
                id=str(uuid.uuid4()),
                user_id=user_id,
                provider="google",
                provider_user_id=provider_user_id,
                email=email,
                created_at=now,
            )
            session.add(oauth)
            return user_to_record(user)

    def update_user_avatar(self, user_id: str, avatar_url: str | None, now: float) -> None:
        with self._session() as session:
            user = session.get(User, user_id)
            if user:
                user.avatar_url = avatar_url
                user.updated_at = now

    def create_oauth_transaction(
        self,
        state_hash: str,
        provider: str,
        intent: str,
        user_id: str | None,
        browser_binding_hash: str,
        code_verifier: str,
        nonce: str,
        created_at: float,
        expires_at: float,
    ) -> None:
        with self._session() as session:
            tx = OAuthTransaction(
                state_hash=state_hash,
                provider=provider,
                intent=intent,
                user_id=user_id,
                browser_binding_hash=browser_binding_hash,
                code_verifier=code_verifier,
                nonce=nonce,
                created_at=created_at,
                expires_at=expires_at,
                used_at=None,
            )
            session.add(tx)

    def claim_oauth_transaction(
        self,
        state_hash: str,
        browser_binding_hash: str,
        now: float,
    ) -> OAuthTransactionRecord | None:
        with self._session() as session:
            stmt = select(OAuthTransaction).where(
                OAuthTransaction.state_hash == state_hash,
                OAuthTransaction.browser_binding_hash == browser_binding_hash,
                OAuthTransaction.used_at.is_(None),
                OAuthTransaction.expires_at > now,
            )
            tx = session.scalars(stmt).first()
            if not tx:
                return None
            tx.used_at = now
            return OAuthTransactionRecord(
                state_hash=tx.state_hash,
                provider=tx.provider,
                intent=tx.intent,
                user_id=tx.user_id,
                browser_binding_hash=tx.browser_binding_hash,
                code_verifier=tx.code_verifier,
                nonce=tx.nonce,
                created_at=tx.created_at,
                expires_at=tx.expires_at,
                used_at=now,
            )

    def cleanup_expired_oauth_transactions(self, now: float) -> int:
        with self._session() as session:
            res = session.execute(
                delete(OAuthTransaction).where(
                    (OAuthTransaction.expires_at <= now) | OAuthTransaction.used_at.is_not(None)
                )
            )
            return int(res.rowcount or 0)

    def get_google_oauth_user_id(self, provider_user_id: str) -> str | None:
        with self._session() as session:
            stmt = select(OAuthAccount.user_id).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_user_id == provider_user_id,
            )
            return session.scalars(stmt).first()

    def link_google_oauth(
        self,
        oauth_id: str,
        user_id: str,
        provider_user_id: str,
        email: str,
        now: float,
    ) -> None:
        with self._session() as session:
            session.execute(
                delete(OAuthAccount).where(
                    OAuthAccount.user_id == user_id,
                    OAuthAccount.provider == "google",
                )
            )
            oauth = OAuthAccount(
                id=oauth_id,
                user_id=user_id,
                provider="google",
                provider_user_id=provider_user_id,
                email=email,
                created_at=now,
            )
            session.add(oauth)

    def unlink_google_oauth(self, user_id: str) -> None:
        with self._session() as session:
            session.execute(
                delete(OAuthAccount).where(
                    OAuthAccount.user_id == user_id,
                    OAuthAccount.provider == "google",
                )
            )

    def create_session(
        self,
        token_hash: str,
        user_id: str,
        csrf_token: str,
        ip_address: str | None,
        user_agent: str | None,
        created_at: float,
        expires_at: float,
    ) -> None:
        with self._session() as session:
            sess = UserSession(
                token_hash=token_hash,
                user_id=user_id,
                csrf_token=csrf_token,
                ip_address=ip_address,
                user_agent=user_agent,
                created_at=created_at,
                expires_at=expires_at,
            )
            session.add(sess)

    def get_session_with_user(self, token_hash: str) -> tuple[UserRecord, str, float] | None:
        with self._session() as session:
            stmt = (
                select(UserSession, User)
                .join(User, UserSession.user_id == User.id)
                .where(UserSession.token_hash == token_hash)
            )
            res = session.execute(stmt).first()
            if not res:
                return None
            sess, user = res
            return user_to_record(user), sess.csrf_token, sess.expires_at

    def revoke_session(self, token_hash: str) -> None:
        with self._session() as session:
            session.execute(delete(UserSession).where(UserSession.token_hash == token_hash))

    def revoke_all_user_sessions(self, user_id: str) -> None:
        with self._session() as session:
            session.execute(delete(UserSession).where(UserSession.user_id == user_id))

    def shorten_existing_sessions(
        self,
        *,
        ttl_hours: int = 6,
        now: float | None = None,
        delete_expired: bool = False,
    ) -> dict[str, int]:
        """Memendekkan masa berlaku sesi lama menjadi maksimal created_at + ttl_hours jam."""
        ttl_seconds = float(ttl_hours * 3600)
        ts = time.time() if now is None else now
        with self._session() as session:
            upd = session.execute(
                update(UserSession)
                .where(UserSession.expires_at > (UserSession.created_at + ttl_seconds))
                .values(expires_at=UserSession.created_at + ttl_seconds)
            )
            shortened = int(upd.rowcount or 0)

            expired = int(
                session.execute(
                    select(func.count())
                    .select_from(UserSession)
                    .where(UserSession.expires_at <= ts)
                ).scalar()
                or 0
            )

            deleted = 0
            if delete_expired:
                d_res = session.execute(delete(UserSession).where(UserSession.expires_at <= ts))
                deleted = int(d_res.rowcount or 0)

        return {"shortened": shortened, "expired": expired, "deleted": deleted}

    def create_password_reset_token(
        self,
        user_id: str,
        token_hash: str,
        created_at: float,
        expires_at: float,
    ) -> None:
        with self._session() as session:
            session.execute(
                delete(AuthToken).where(
                    AuthToken.user_id == user_id,
                    AuthToken.token_type == "password_reset",
                )
            )
            token = AuthToken(
                token_hash=token_hash,
                user_id=user_id,
                token_type="password_reset",
                created_at=created_at,
                expires_at=expires_at,
            )
            session.add(token)

    def get_password_reset_token(self, token_hash: str) -> tuple[str, float | None, float] | None:
        with self._session() as session:
            stmt = select(AuthToken).where(
                AuthToken.token_hash == token_hash,
                AuthToken.token_type == "password_reset",
            )
            token = session.scalars(stmt).first()
            if not token:
                return None
            return token.user_id, token.used_at, token.expires_at

    def consume_password_reset_token(
        self,
        user_id: str,
        new_hash: str,
        token_hash: str,
        now: float,
    ) -> UserRecord:
        with self._session() as session:
            user = session.get(User, user_id)
            if not user:
                raise ValueError("User not found")
            user.password_hash = new_hash
            user.updated_at = now

            token = session.get(AuthToken, token_hash)
            if token:
                token.used_at = now

            session.execute(delete(UserSession).where(UserSession.user_id == user_id))
            return user_to_record(user)

    def create_email_verification_token(
        self,
        user_id: str,
        token_hash: str,
        created_at: float,
        expires_at: float,
    ) -> None:
        with self._session() as session:
            session.execute(
                delete(AuthToken).where(
                    AuthToken.user_id == user_id,
                    AuthToken.token_type == "email_verification",
                )
            )
            token = AuthToken(
                token_hash=token_hash,
                user_id=user_id,
                token_type="email_verification",
                created_at=created_at,
                expires_at=expires_at,
            )
            session.add(token)

    def get_email_verification_token(
        self, token_hash: str
    ) -> tuple[str, float | None, float] | None:
        with self._session() as session:
            stmt = select(AuthToken).where(
                AuthToken.token_hash == token_hash,
                AuthToken.token_type == "email_verification",
            )
            token = session.scalars(stmt).first()
            if not token:
                return None
            return token.user_id, token.used_at, token.expires_at

    def consume_email_verification_token(
        self,
        user_id: str,
        token_hash: str,
        now: float,
    ) -> UserRecord:
        with self._session() as session:
            user = session.get(User, user_id)
            if not user:
                raise ValueError("User not found")
            user.email_verified = 1
            user.updated_at = now

            token = session.get(AuthToken, token_hash)
            if token:
                token.used_at = now

            return user_to_record(user)

    def update_user_password(self, user_id: str, new_hash: str, now: float) -> None:
        with self._session() as session:
            user = session.get(User, user_id)
            if user:
                user.password_hash = new_hash
                user.updated_at = now

    def get_oauth_accounts_for_user(self, user_id: str) -> list[dict[str, Any]]:
        with self._session() as session:
            stmt = select(OAuthAccount).where(OAuthAccount.user_id == user_id)
            accounts = session.scalars(stmt).all()
            return [
                {
                    "provider": acc.provider,
                    "email": acc.email,
                    "created_at": acc.created_at,
                }
                for acc in accounts
            ]

    def delete_user(self, user_id: str) -> None:
        with self._session() as session:
            session.execute(delete(UserSession).where(UserSession.user_id == user_id))
            session.execute(delete(AuthToken).where(AuthToken.user_id == user_id))
            session.execute(delete(OAuthAccount).where(OAuthAccount.user_id == user_id))
            user = session.get(User, user_id)
            if user:
                session.delete(user)
