"""
Unit tests for File Shelf AES-256-GCM Envelope Encryption (49-Byte) and R2 Storage Adapter
Task: FS-04 (Phase File Shelf)
"""

from __future__ import annotations

import base64
import hashlib
import secrets

import pytest

from app.services.file_crypto import (
    HEADER_SIZE_BYTES,
    AADAuthenticationError,
    CryptoEnvelopeError,
    KeyNotFoundError,
    KeyringManager,
    compute_canonical_aad,
    decrypt_file_envelope,
    encrypt_file_envelope,
)
from app.services.r2_storage import (
    InMemoryR2StorageClient,
    R2ObjectNotFoundError,
)


@pytest.fixture
def test_keyring() -> KeyringManager:
    """Create a multi-key keyring doc for testing rotation and lookup."""
    k1_raw = secrets.token_bytes(32)
    k2_raw = secrets.token_bytes(32)

    k1_id = "k_20261101_primary"
    k2_id = "k_20261111_active"

    k1_hash_b64 = base64.urlsafe_b64encode(hashlib.sha1(k1_id.encode()).digest()).decode()
    k2_hash_b64 = base64.urlsafe_b64encode(hashlib.sha1(k2_id.encode()).digest()).decode()

    doc = {
        "version": 1,
        "active_key_id": k2_id,
        "keys": [
            {
                "id": k1_id,
                "active": False,
                "created_at": "2026-11-01T00:00:00Z",
                "key_id_hash_b64": k1_hash_b64,
                "secret_b64": base64.urlsafe_b64encode(k1_raw).decode(),
            },
            {
                "id": k2_id,
                "active": True,
                "created_at": "2026-11-11T00:00:00Z",
                "key_id_hash_b64": k2_hash_b64,
                "secret_b64": base64.urlsafe_b64encode(k2_raw).decode(),
            },
        ],
    }
    return KeyringManager(keyring_doc=doc)


def test_encrypt_decrypt_roundtrip(test_keyring: KeyringManager):
    payload = b"Hello, this is a secret user document in Satukit File Shelf!"
    user_id = "usr_123"
    item_id = "item_abc"
    content_type = "application/pdf"

    envelope, key_id = encrypt_file_envelope(
        plaintext=payload,
        user_id=user_id,
        item_id=item_id,
        content_type=content_type,
        keyring=test_keyring,
    )

    assert key_id == "k_20261111_active"
    assert len(envelope) == HEADER_SIZE_BYTES + len(payload)

    decrypted = decrypt_file_envelope(
        envelope=envelope,
        user_id=user_id,
        item_id=item_id,
        content_type=content_type,
        keyring=test_keyring,
    )
    assert decrypted == payload


def test_envelope_header_structure_49_bytes(test_keyring: KeyringManager):
    payload = b"Small binary payload"
    envelope, key_id = encrypt_file_envelope(
        plaintext=payload,
        user_id="u1",
        item_id="i1",
        content_type="image/png",
        keyring=test_keyring,
    )

    # 1. Version byte
    assert envelope[0] == 0x01

    # 2. IV: bytes 1..13 (12 bytes)
    iv = envelope[1:13]
    assert len(iv) == 12

    # 3. Auth Tag: bytes 13..29 (16 bytes)
    tag = envelope[13:29]
    assert len(tag) == 16

    # 4. Key ID Hash: bytes 29..49 (20 bytes SHA-1)
    key_hash = envelope[29:49]
    assert len(key_hash) == 20
    expected_hash = hashlib.sha1(key_id.encode()).digest()
    assert key_hash == expected_hash

    # Header total: exactly 49 bytes
    header = envelope[:49]
    assert len(header) == 49


def test_aad_mismatch_cross_tenant_swap_rejected(test_keyring: KeyringManager):
    """
    Mitigates THR-023: Swapping ciphertext or changing tenant context must fail closed.
    """
    payload = b"Confidential financial statement"
    envelope, _ = encrypt_file_envelope(
        plaintext=payload,
        user_id="alice",
        item_id="doc_1",
        content_type="application/pdf",
        keyring=test_keyring,
    )

    # 1. Wrong user_id (Tenant swap)
    with pytest.raises(AADAuthenticationError):
        decrypt_file_envelope(
            envelope=envelope,
            user_id="bob",
            item_id="doc_1",
            content_type="application/pdf",
            keyring=test_keyring,
        )

    # 2. Wrong item_id (File ID swap)
    with pytest.raises(AADAuthenticationError):
        decrypt_file_envelope(
            envelope=envelope,
            user_id="alice",
            item_id="doc_2",
            content_type="application/pdf",
            keyring=test_keyring,
        )

    # 3. Wrong content_type (MIME confusion attack)
    with pytest.raises(AADAuthenticationError):
        decrypt_file_envelope(
            envelope=envelope,
            user_id="alice",
            item_id="doc_1",
            content_type="text/plain",
            keyring=test_keyring,
        )


def test_ciphertext_and_tag_tampering(test_keyring: KeyringManager):
    payload = b"Original pristine bytes"
    envelope, _ = encrypt_file_envelope(
        plaintext=payload,
        user_id="u1",
        item_id="i1",
        content_type="application/pdf",
        keyring=test_keyring,
    )

    # Tamper byte in ciphertext
    corrupted_cipher = bytearray(envelope)
    corrupted_cipher[-1] ^= 0x01
    with pytest.raises(AADAuthenticationError):
        decrypt_file_envelope(
            envelope=bytes(corrupted_cipher),
            user_id="u1",
            item_id="i1",
            content_type="application/pdf",
            keyring=test_keyring,
        )

    # Tamper byte in tag (byte 15)
    corrupted_tag = bytearray(envelope)
    corrupted_tag[15] ^= 0xFF
    with pytest.raises(AADAuthenticationError):
        decrypt_file_envelope(
            envelope=bytes(corrupted_tag),
            user_id="u1",
            item_id="i1",
            content_type="application/pdf",
            keyring=test_keyring,
        )


def test_short_and_invalid_envelope(test_keyring: KeyringManager):
    # Envelope shorter than 49 bytes
    with pytest.raises(CryptoEnvelopeError) as exc:
        decrypt_file_envelope(
            envelope=b"too short",
            user_id="u1",
            item_id="i1",
            content_type="application/pdf",
            keyring=test_keyring,
        )
    assert "terlalu pendek" in str(exc.value)

    # Invalid version byte (0x02 instead of 0x01)
    fake_header = bytes([0x02]) + b"\x00" * 48
    with pytest.raises(CryptoEnvelopeError) as exc:
        decrypt_file_envelope(
            envelope=fake_header,
            user_id="u1",
            item_id="i1",
            content_type="application/pdf",
            keyring=test_keyring,
        )
    assert "tidak didukung" in str(exc.value)


def test_key_rotation_decrypts_with_historical_key(test_keyring: KeyringManager):
    payload = b"Archived document encrypted with older key k1"
    # Encrypt explicitly with non-active k1
    envelope, key_id = encrypt_file_envelope(
        plaintext=payload,
        user_id="u1",
        item_id="i1",
        content_type="application/pdf",
        keyring=test_keyring,
        key_id="k_20261101_primary",
    )
    assert key_id == "k_20261101_primary"

    # Decrypt without specifying key_id (keyring automatically selects k1 via 20-byte hash)
    decrypted = decrypt_file_envelope(
        envelope=envelope,
        user_id="u1",
        item_id="i1",
        content_type="application/pdf",
        keyring=test_keyring,
    )
    assert decrypted == payload


def test_unknown_key_hash_fails(test_keyring: KeyringManager):
    payload = b"Test unknown key"
    envelope, _ = encrypt_file_envelope(
        plaintext=payload,
        user_id="u1",
        item_id="i1",
        content_type="application/pdf",
        keyring=test_keyring,
    )

    # Tamper key hash (bytes 29..49) to unknown hash
    tampered_hash = bytearray(envelope)
    tampered_hash[29:49] = b"\xaa" * 20
    with pytest.raises(KeyNotFoundError):
        decrypt_file_envelope(
            envelope=bytes(tampered_hash),
            user_id="u1",
            item_id="i1",
            content_type="application/pdf",
            keyring=test_keyring,
        )


def test_empty_file_roundtrip(test_keyring: KeyringManager):
    envelope, _ = encrypt_file_envelope(
        plaintext=b"",
        user_id="u1",
        item_id="empty_item",
        content_type="text/plain",
        keyring=test_keyring,
    )
    assert len(envelope) == 49

    decrypted = decrypt_file_envelope(
        envelope=envelope,
        user_id="u1",
        item_id="empty_item",
        content_type="text/plain",
        keyring=test_keyring,
    )
    assert decrypted == b""


def test_canonical_aad_format():
    aad = compute_canonical_aad("usr_abc", "item_xyz", "application/pdf")
    assert aad == b"satukit:fileshelf:v1:usr_abc:item_xyz:application/pdf"


def test_in_memory_r2_storage_crud():
    r2 = InMemoryR2StorageClient()
    r2.clear()

    key = "usr_1/item_1.enc"
    data = b"ENCRYPTED_BINARY_PAYLOAD_HERE"

    # 1. Upload
    etag = r2.upload_object(key=key, data=data, content_type="application/octet-stream")
    assert etag is not None

    # 2. Head
    meta = r2.head_object(key)
    assert meta is not None
    assert meta["key"] == key
    assert meta["size"] == len(data)
    assert meta["content_type"] == "application/octet-stream"

    # 3. Get
    fetched = r2.get_object(key)
    assert fetched == data

    # 4. List
    keys = r2.list_objects(prefix="usr_1/")
    assert keys == [key]

    # 5. Delete
    assert r2.delete_object(key) is True
    assert r2.head_object(key) is None

    # 6. Get non-existent
    with pytest.raises(R2ObjectNotFoundError):
        r2.get_object(key)
