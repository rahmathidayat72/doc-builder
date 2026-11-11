from __future__ import annotations

import re
import time

from fastapi.testclient import TestClient

from app.main import app
from app.services.bot_challenge import BotChallengeService, bot_challenge_service

client = TestClient(app)


def solve_challenge_question(question: str) -> int:
    """Helper pemecah soal matematika kelas 1 SD untuk pengujian otomatis."""
    nums = [int(n) for n in re.findall(r"\d+", question)]
    assert len(nums) == 2, f"Pertanyaan harus memiliki 2 angka: {question}"
    if "-" in question or "dikurangi" in question:
        return nums[0] - nums[1]
    return nums[0] + nums[1]


def test_generate_challenge_structure():
    """Memverifikasi struktur payload tantangan bot yang dihasilkan."""
    ch = bot_challenge_service.generate_challenge()
    assert "challenge_token" in ch
    assert "question" in ch
    assert ch["expires_in"] == 300

    parts = ch["challenge_token"].split(".")
    assert len(parts) == 3
    expires_at = int(parts[0])
    assert expires_at > int(time.time())


def test_sd_kelas_1_math_range_and_correctness_multi_run():
    """Memverifikasi seluruh soal yang di-generate memenuhi kriteria SD Kelas 1 (0-20)
    dan jawaban matematika selalu terverifikasi benar."""
    for _ in range(100):
        ch = bot_challenge_service.generate_challenge()
        q = ch["question"]
        token = ch["challenge_token"]

        ans = solve_challenge_question(q)
        assert 0 <= ans <= 20, f"Hasil soal SD Kelas 1 harus 0-20, didapat {ans} dari '{q}'"

        # Verifikasi jawaban benar diterima
        is_valid, err, uid = bot_challenge_service.verify_challenge(token, ans)
        assert is_valid is True
        assert err is None

        # Verifikasi input string angka juga diterima
        is_valid_str, _, _ = bot_challenge_service.verify_challenge(token, str(ans))
        assert is_valid_str is True


def test_verify_challenge_rejects_wrong_answer():
    """Memverifikasi jawaban salah selalu ditolak."""
    ch = bot_challenge_service.generate_challenge()
    ans = solve_challenge_question(ch["question"])
    wrong_ans = ans + 1 if ans < 20 else ans - 1

    is_valid, err, _ = bot_challenge_service.verify_challenge(ch["challenge_token"], wrong_ans)
    assert is_valid is False
    assert "Jawaban soal anti-bot salah" in (err or "")


def test_verify_challenge_rejects_tampered_token():
    """Memverifikasi modifikasi token HMAC menyebabkan verifikasi gagal (anti-tamper)."""
    ch = bot_challenge_service.generate_challenge()
    ans = solve_challenge_question(ch["question"])
    parts = ch["challenge_token"].split(".")

    # Ubah signature HMAC
    tampered_sig = parts[0] + "." + parts[1] + "." + ("0" * len(parts[2]))
    is_valid, _, _ = bot_challenge_service.verify_challenge(tampered_sig, ans)
    assert is_valid is False

    # Ubah nonce
    tampered_nonce = parts[0] + ".ffffffff." + parts[2]
    is_valid2, _, _ = bot_challenge_service.verify_challenge(tampered_nonce, ans)
    assert is_valid2 is False


def test_verify_challenge_rejects_expired_token():
    """Memverifikasi token yang telah melewati batas 5 menit kedaluwarsa."""
    expired_service = BotChallengeService(ttl_seconds=-10)
    ch = expired_service.generate_challenge()
    ans = solve_challenge_question(ch["question"])

    is_valid, err, _ = expired_service.verify_challenge(ch["challenge_token"], ans)
    assert is_valid is False
    assert "kedaluwarsa" in (err or "").lower()


def test_verify_challenge_rejects_invalid_inputs():
    """Memverifikasi penanganan input tidak valid (bukan angka, token korup)."""
    ch = bot_challenge_service.generate_challenge()

    # Jawaban bukan angka
    is_valid, err, _ = bot_challenge_service.verify_challenge(ch["challenge_token"], "bukan-angka")
    assert is_valid is False
    assert "angka" in (err or "").lower()

    # Token acak / tidak bertitik
    is_valid2, err2, _ = bot_challenge_service.verify_challenge("token-rusak-tanpa-titik", 5)
    assert is_valid2 is False
    assert "Format token" in (err2 or "")


def test_verify_challenge_with_user_id():
    """Memverifikasi challenge yang terikat user_id mengembalikan user_id yang tepat."""
    ch = bot_challenge_service.generate_challenge(user_id="user-12345")
    ans = solve_challenge_question(ch["question"])
    is_valid, err, uid = bot_challenge_service.verify_challenge(ch["challenge_token"], ans)
    assert is_valid is True
    assert err is None
    assert uid == "user-12345"


def test_api_challenge_endpoint_public():
    """Memverifikasi endpoint HTTP /api/auth/challenge dapat diakses publik tanpa sesi."""
    res = client.post("/api/auth/challenge")
    assert res.status_code == 200
    data = res.json()
    assert "challenge_token" in data
    assert "question" in data
    assert data["expires_in"] == 300
