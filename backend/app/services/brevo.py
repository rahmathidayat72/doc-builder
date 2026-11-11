from __future__ import annotations

import json
import logging
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings

logger = logging.getLogger("satukit.brevo")

# ponytail: stdlib urllib handles Brevo transactional emails, add async httpx client when high-volume batch queues needed.
class BrevoEmailService:
    """Layanan pengiriman email transaksional via REST API Brevo menggunakan stdlib urllib."""

    API_URL = "https://api.brevo.com/v3/smtp/email"

    def send_transactional_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str,
    ) -> bool:
        """Mengirim email transaksional tunggal. Jika API key belum disetel, catat log simulasi tanpa error."""
        if not settings.BREVO_API_KEY or not settings.BREVO_SENDER_EMAIL:
            logger.info("Brevo API key / sender belum disetel. Simulasi email '%s' ke %s", subject, to_email)
            return True

        sender_name = settings.BREVO_SENDER_NAME or "Satukit"
        sender_email = settings.BREVO_SENDER_EMAIL

        payload = {
            "sender": {"name": sender_name, "email": sender_email},
            "to": [{"email": to_email, "name": to_name or to_email}],
            "subject": subject,
            "htmlContent": html_content,
        }

        data_bytes = json.dumps(payload).encode("utf-8")
        req = Request(
            self.API_URL,
            data=data_bytes,
            headers={
                "api-key": settings.BREVO_API_KEY,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=10) as resp:
                status = resp.status
                return 200 <= status < 300
        except HTTPError as err:
            logger.error("Gagal mengirim email Brevo (HTTP %d): %s", err.code, err.reason)
            return False
        except (URLError, TimeoutError) as err:
            logger.error("Koneksi Brevo timeout/gagal: %s", str(err))
            return False
        except Exception as exc:
            logger.error("Kesalahan tak terduga pengiriman email Brevo: %s", str(exc))
            return False

    def send_verification_email(
        self,
        email: str,
        name: str,
        raw_token: str,
        base_url: str,
    ) -> bool:
        """Mengirimkan email berisi tautan verifikasi akun (TTL 15 menit)."""
        clean_base = base_url.rstrip("/")
        verify_url = f"{clean_base}/verify-email?token={raw_token}"
        subject = "Verifikasi Alamat Email Anda - Satukit"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1c1917;">
            <h2 style="color: #0f766e; margin-bottom: 16px;">Selamat Datang di Satukit</h2>
            <p>Halo <strong>{name}</strong>,</p>
            <p>Terima kasih telah mendaftar di Satukit. Silakan klik tombol di bawah ini untuk memverifikasi alamat email Anda sebelum mulai menggunakan layanan kami:</p>
            <div style="margin: 32px 0;">
                <a href="{verify_url}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Verifikasi Email Saya</a>
            </div>
            <p style="font-size: 13px; color: #78716c;">Tautan ini hanya berlaku selama 15 menit. Jika Anda tidak merasa mendaftar di Satukit, abaikan email ini.</p>
            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
            <p style="font-size: 11px; color: #a8a29e;">Satukit &bull; Solusi Dokumen Terintegrasi & Aman</p>
        </div>
        """
        return self.send_transactional_email(email, name, subject, html)

    def send_password_reset_email(
        self,
        email: str,
        name: str,
        raw_token: str,
        base_url: str,
    ) -> bool:
        """Mengirimkan email berisi tautan reset kata sandi (single-use, TTL 15 menit)."""
        clean_base = base_url.rstrip("/")
        reset_url = f"{clean_base}/reset-password?token={raw_token}"
        subject = "Permintaan Reset Kata Sandi - Satukit"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1c1917;">
            <h2 style="color: #0f766e; margin-bottom: 16px;">Reset Kata Sandi Akun Satukit</h2>
            <p>Halo <strong>{name}</strong>,</p>
            <p>Kami menerima permintaan untuk mereset kata sandi akun Satukit Anda. Silakan klik tautan di bawah ini untuk mengatur kata sandi baru:</p>
            <div style="margin: 32px 0;">
                <a href="{reset_url}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Atur Kata Sandi Baru</a>
            </div>
            <p style="font-size: 13px; color: #78716c;">Tautan ini hanya berlaku selama 15 menit dan hanya dapat digunakan satu kali. Jika Anda tidak meminta reset kata sandi, akun Anda tetap aman dan abaikan email ini.</p>
            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
            <p style="font-size: 11px; color: #a8a29e;">Satukit &bull; Solusi Dokumen Terintegrasi & Aman</p>
        </div>
        """
        return self.send_transactional_email(email, name, subject, html)

    def send_draft_retention_warning_email(
        self,
        email: str,
        name: str,
        days_left: int,
        base_url: str,
    ) -> bool:
        """Mengirimkan email peringatan kedaluwarsa draf akun (H-14, H-7, H-1). Zero CV PII."""
        clean_base = base_url.rstrip("/")
        login_url = f"{clean_base}/login"
        subject = f"Pemberitahuan Retensi Draf: {days_left} Hari Tersisa - Satukit"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1c1917;">
            <h2 style="color: #b45309; margin-bottom: 16px;">Pengingat Retensi Draf Dokumen</h2>
            <p>Halo <strong>{name}</strong>,</p>
            <p>Sesuai kebijakan privasi Satukit, draf dokumen yang tidak aktif selama 30 hari akan dihapus otomatis secara permanen demi keamanan data Anda.</p>
            <p>Draf Anda akan kedaluwarsa dalam <strong>{days_left} hari</strong>. Untuk memperpanjang masa simpan draf, cukup masuk ke akun Anda:</p>
            <div style="margin: 32px 0;">
                <a href="{login_url}" style="background-color: #0f766e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">Buka Akun Satukit</a>
            </div>
            <hr style="border: none; border-top: 1px solid #e7e5e4; margin: 24px 0;" />
            <p style="font-size: 11px; color: #a8a29e;">Satukit &bull; Solusi Dokumen Terintegrasi & Aman</p>
        </div>
        """
        return self.send_transactional_email(email, name, subject, html)


brevo_service = BrevoEmailService()
