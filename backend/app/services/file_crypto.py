"""
Cryptographic service for Satukit File Shelf AES-256-GCM Envelope Encryption (49-Byte Header)
Task: FS-04 (Phase File Shelf)
Enforces identity-bound Associated Authenticated Data (AAD) and root-owned keyring integration.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import secrets
from pathlib import Path
from typing import Any

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ENVELOPE_VERSION = 0x01
IV_SIZE_BYTES = 12
TAG_SIZE_BYTES = 16
KEY_HASH_SIZE_BYTES = 20
HEADER_SIZE_BYTES = 1 + IV_SIZE_BYTES + TAG_SIZE_BYTES + KEY_HASH_SIZE_BYTES  # 49 bytes


class FileCryptoError(Exception):
    """Base exception for file shelf cryptographic operations."""
    pass


class KeyringError(FileCryptoError):
    pass


class KeyNotFoundError(FileCryptoError):
    pass


class CryptoEnvelopeError(FileCryptoError):
    pass


class AADAuthenticationError(FileCryptoError):
    pass


def compute_canonical_aad(user_id: str, item_id: str, content_type: str) -> bytes:
    """
    Construct canonical AAD strictly binding file content to user identity, item ID, and MIME type.
    Mitigates THR-023 (cross-tenant ciphertext reuse / swap in R2).
    """
    return f"satukit:fileshelf:v1:{user_id}:{item_id}:{content_type}".encode()


class KeyringManager:
    """Manages symmetric 256-bit encryption keys loaded from root-owned keyring JSON."""

    def __init__(self, keyring_doc: dict[str, Any] | None = None, keyring_path: str | None = None):
        self.keys_by_id: dict[str, bytes] = {}
        self.keys_by_hash: dict[bytes, tuple[str, bytes]] = {}
        self.active_key_id: str = ""
        self.active_key_bytes: bytes = b""

        if keyring_doc:
            self._load_from_dict(keyring_doc)
        elif keyring_path:
            self._load_from_file(keyring_path)
        else:
            self._discover_and_load()

    def _discover_and_load(self) -> None:
        # 1. Systemd LoadCredential path
        cred_dir = os.environ.get("CREDENTIALS_DIRECTORY")
        if cred_dir:
            systemd_path = Path(cred_dir) / "keyring"
            if systemd_path.exists():
                self._load_from_file(str(systemd_path))
                return

        # 2. Explicit environment variable
        env_path = os.environ.get("SATUKIT_KEYRING_PATH")
        if env_path and Path(env_path).exists():
            self._load_from_file(env_path)
            return

        # 3. Default host path
        default_host_path = Path("/etc/satukit/keyring.json")
        if default_host_path.exists():
            self._load_from_file(str(default_host_path))
            return

        # 4. Fallback for test / dev environment
        dev_path = Path("backend/tests/fixtures/test_keyring.json")
        if dev_path.exists():
            self._load_from_file(str(dev_path))
            return

        # Generate ephemeral in-memory test key if no persistent keyring found in dev/test
        self._generate_ephemeral_key()

    def _generate_ephemeral_key(self) -> None:
        key_id = "k_ephemeral_test"
        raw_key = secrets.token_bytes(32)
        key_hash = hashlib.sha1(key_id.encode("utf-8")).digest()
        self.keys_by_id[key_id] = raw_key
        self.keys_by_hash[key_hash] = (key_id, raw_key)
        self.active_key_id = key_id
        self.active_key_bytes = raw_key

    def _load_from_file(self, filepath: str) -> None:
        try:
            with open(filepath, encoding="utf-8") as f:
                doc = json.load(f)
            self._load_from_dict(doc)
        except Exception as e:
            raise KeyringError(f"Gagal memuat keyring dari berkas {filepath}: {e}") from e

    def _load_from_dict(self, doc: dict[str, Any]) -> None:
        active_id = doc.get("active_key_id")
        keys = doc.get("keys", [])

        if not active_id or not keys:
            raise KeyringError("Keyring tidak valid: 'active_key_id' atau 'keys' kosong.")

        for k in keys:
            kid = k["id"]
            secret_b64 = k["secret_b64"]
            raw_key = base64.urlsafe_b64decode(secret_b64)
            if len(raw_key) != 32:
                msg = f"Panjang kunci {kid} tidak valid ({len(raw_key)} byte, wajib 32 byte)."
                raise KeyringError(msg)

            key_hash = hashlib.sha1(kid.encode("utf-8")).digest()
            self.keys_by_id[kid] = raw_key
            self.keys_by_hash[key_hash] = (kid, raw_key)

        if active_id not in self.keys_by_id:
            raise KeyringError(f"Kunci aktif {active_id} tidak ditemukan di keyring.")

        self.active_key_id = active_id
        self.active_key_bytes = self.keys_by_id[active_id]

    def get_key_by_id(self, key_id: str) -> bytes:
        if key_id not in self.keys_by_id:
            raise KeyNotFoundError(f"Kunci dengan ID '{key_id}' tidak ditemukan di keyring.")
        return self.keys_by_id[key_id]

    def get_key_by_hash(self, key_hash: bytes) -> tuple[str, bytes]:
        if key_hash not in self.keys_by_hash:
            raise KeyNotFoundError("Kunci dengan SHA-1 digest tersebut tidak ditemukan di keyring.")
        return self.keys_by_hash[key_hash]


_GLOBAL_KEYRING: KeyringManager | None = None


def get_keyring_manager() -> KeyringManager:
    global _GLOBAL_KEYRING
    if _GLOBAL_KEYRING is None:
        _GLOBAL_KEYRING = KeyringManager()
    return _GLOBAL_KEYRING


def set_global_keyring_manager(keyring: KeyringManager | None) -> None:
    global _GLOBAL_KEYRING
    _GLOBAL_KEYRING = keyring


def encrypt_file_envelope(
    plaintext: bytes,
    user_id: str,
    item_id: str,
    content_type: str,
    keyring: KeyringManager | None = None,
    key_id: str | None = None,
) -> tuple[bytes, str]:
    """
    Encrypt plaintext into a 49-byte envelope header + ciphertext.
    Header structure (49 bytes):
      - 0x01 (1 byte, version)
      - IV (12 bytes, random cryptographic nonce)
      - Auth Tag (16 bytes, GCM authentication tag)
      - Key ID Hash (20 bytes, SHA-1 of active key ID)
    """
    kr = keyring or get_keyring_manager()
    target_key_id = key_id or kr.active_key_id
    key_bytes = kr.get_key_by_id(target_key_id)

    iv = secrets.token_bytes(IV_SIZE_BYTES)
    key_hash = hashlib.sha1(target_key_id.encode("utf-8")).digest()
    aad = compute_canonical_aad(user_id=user_id, item_id=item_id, content_type=content_type)

    aesgcm = AESGCM(key_bytes)
    # aesgcm.encrypt returns ciphertext + tag appended at the end (16 bytes)
    encrypted = aesgcm.encrypt(iv, plaintext, aad)
    ciphertext = encrypted[:-TAG_SIZE_BYTES]
    tag = encrypted[-TAG_SIZE_BYTES:]

    # Construct exactly 49-byte header: 1 + 12 + 16 + 20
    header = bytes([ENVELOPE_VERSION]) + iv + tag + key_hash
    if len(header) != HEADER_SIZE_BYTES:
        raise CryptoEnvelopeError("Internal error: header length is not 49 bytes.")

    envelope = header + ciphertext
    return envelope, target_key_id


def decrypt_file_envelope(
    envelope: bytes,
    user_id: str,
    item_id: str,
    content_type: str,
    keyring: KeyringManager | None = None,
) -> bytes:
    """
    Decrypt a 49-byte envelope header + ciphertext.
    Enforces identity-bound AAD verification against user_id, item_id, and content_type.
    """
    if len(envelope) < HEADER_SIZE_BYTES:
        msg = f"Envelope terlalu pendek ({len(envelope)} byte, minimal {HEADER_SIZE_BYTES} byte)."
        raise CryptoEnvelopeError(msg)

    version = envelope[0]
    if version != ENVELOPE_VERSION:
        raise CryptoEnvelopeError(f"Versi envelope enkripsi tidak didukung (0x{version:02x}).")

    iv = envelope[1:1 + IV_SIZE_BYTES]
    tag = envelope[1 + IV_SIZE_BYTES:1 + IV_SIZE_BYTES + TAG_SIZE_BYTES]
    key_hash = envelope[
        1 + IV_SIZE_BYTES + TAG_SIZE_BYTES:
        1 + IV_SIZE_BYTES + TAG_SIZE_BYTES + KEY_HASH_SIZE_BYTES
    ]
    ciphertext = envelope[HEADER_SIZE_BYTES:]

    kr = keyring or get_keyring_manager()
    _, key_bytes = kr.get_key_by_hash(key_hash)

    aad = compute_canonical_aad(user_id=user_id, item_id=item_id, content_type=content_type)
    aesgcm = AESGCM(key_bytes)

    try:
        plaintext = aesgcm.decrypt(iv, ciphertext + tag, aad)
        return plaintext
    except InvalidTag as e:
        msg = "Otentikasi enkripsi gagal: integritas berkas rusak atau parameter AAD tidak cocok."
        raise AADAuthenticationError(msg) from e
