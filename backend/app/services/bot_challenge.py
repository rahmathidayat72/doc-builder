from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Any

from app.core.config import settings


class BotChallengeService:
    """Service pembuat dan pemverifikasi soal tantangan anti-bot matematika SD Kelas 1."""

    def __init__(self, secret: str | None = None, ttl_seconds: int | None = None):
        self._secret = secret or settings.BOT_CHALLENGE_SECRET
        self._ttl_seconds = ttl_seconds or settings.BOT_CHALLENGE_TTL_SECONDS

    def generate_challenge(self, user_id: str = "") -> dict[str, Any]:
        """Menghasilkan pertanyaan matematika dasar SD kelas 1 dan token HMAC yang aman."""
        # 0 = penjumlahan, 1 = pengurangan
        op_type = secrets.randbelow(2)

        if op_type == 0:
            a = secrets.randbelow(10) + 1  # 1..10
            b = secrets.randbelow(10) + 1  # 1..10
            answer = a + b
            templates = [
                f"Berapa hasil dari {a} + {b}?",
                f"Hitung penjumlahan: {a} + {b} = ?",
                f"{a} ditambah {b} sama dengan berapa?",
            ]
        else:
            a = secrets.randbelow(14) + 2  # 2..15
            b = secrets.randbelow(a) + 1  # 1..a
            answer = a - b
            templates = [
                f"Berapa hasil dari {a} - {b}?",
                f"Hitung pengurangan: {a} - {b} = ?",
                f"{a} dikurangi {b} sama dengan berapa?",
            ]

        question = templates[secrets.randbelow(len(templates))]
        now = int(time.time())
        expires_at = now + self._ttl_seconds
        nonce = secrets.token_hex(8)

        signature = self._compute_signature(answer, expires_at, nonce, user_id)
        token = (
            f"{expires_at}.{nonce}.{user_id}.{signature}"
            if user_id
            else f"{expires_at}.{nonce}.{signature}"
        )

        return {
            "challenge_token": token,
            "question": question,
            "expires_in": self._ttl_seconds,
        }

    def verify_challenge(
        self, token: str, answer_input: int | str
    ) -> tuple[bool, str | None, str]:
        """Memverifikasi token tantangan dan jawaban pengguna.
        Mengembalikan (is_valid, error_message, user_id).
        """
        if not token or not isinstance(token, str):
            return False, "Token tantangan anti-bot wajib disertakan.", ""

        parts = token.split(".")
        if len(parts) == 4:
            expires_at_str, nonce, user_id, signature = parts
        elif len(parts) == 3:
            expires_at_str, nonce, signature = parts
            user_id = ""
        else:
            return False, "Format token tantangan anti-bot tidak valid.", ""

        try:
            expires_at = int(expires_at_str)
        except ValueError:
            return False, "Struktur masa berlaku token tidak valid.", user_id

        if time.time() > expires_at:
            return False, "Tantangan anti-bot telah kedaluwarsa. Silakan muat soal baru.", user_id

        # Parse jawaban integer
        try:
            if isinstance(answer_input, str):
                cleaned = answer_input.strip()
                answer_int = int(cleaned)
            elif isinstance(answer_input, (int, float)):
                answer_int = int(answer_input)
            else:
                return False, "Jawaban anti-bot harus berupa angka.", user_id
        except (ValueError, TypeError):
            return False, "Jawaban anti-bot harus berupa angka yang valid.", user_id

        expected_sig = self._compute_signature(answer_int, expires_at, nonce, user_id)
        if not hmac.compare_digest(signature, expected_sig):
            return False, "Jawaban soal anti-bot salah. Silakan coba lagi.", user_id

        return True, None, user_id

    def _compute_signature(
        self, answer: int, expires_at: int, nonce: str, user_id: str = ""
    ) -> str:
        payload = (
            f"{answer}:{expires_at}:{nonce}:{user_id}"
            if user_id
            else f"{answer}:{expires_at}:{nonce}"
        )
        return hmac.new(
            self._secret.encode("utf-8"), payload.encode("utf-8"), hashlib.sha256
        ).hexdigest()


bot_challenge_service = BotChallengeService()
