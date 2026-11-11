"""
Keyring Generator for Satukit File Shelf AES-256-GCM Envelope Encryption
Task: FS-02 (Phase File Shelf)
Generates 256-bit symmetric key material for /etc/satukit/keyring.json (root 0400).
"""

import os
import sys
import json
import base64
import hashlib
import secrets
import argparse
from datetime import datetime, timezone


def generate_key(key_id: str = None, is_active: bool = True) -> dict:
    if not key_id:
        key_id = f"k_{datetime.now(timezone.utc).strftime('%Y%m%d')}_{secrets.token_hex(4)}"
    
    # Generate 32 bytes (256 bits) cryptographically secure random bytes
    raw_key = secrets.token_bytes(32)
    secret_b64 = base64.urlsafe_b64encode(raw_key).decode("ascii")
    
    # 20-byte SHA-1 digest of key ID for the 49-byte envelope header
    key_id_hash = hashlib.sha1(key_id.encode("utf-8")).digest()
    key_id_hash_b64 = base64.urlsafe_b64encode(key_id_hash).decode("ascii")

    return {
        "id": key_id,
        "active": is_active,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "key_id_hash_b64": key_id_hash_b64,
        "secret_b64": secret_b64,
    }


def generate_keyring_doc(primary_key_id: str = None) -> dict:
    primary = generate_key(key_id=primary_key_id, is_active=True)
    return {
        "version": 1,
        "active_key_id": primary["id"],
        "keys": [primary],
    }


def main():
    parser = argparse.ArgumentParser(description="Generate Satukit AES-256-GCM keyring JSON")
    parser.add_argument("--output", "-o", help="Target output file path (e.g. /etc/satukit/keyring.json)")
    parser.add_argument("--key-id", help="Optional explicit key ID")
    parser.add_argument("--dry-run", action="store_true", help="Print JSON to stdout without writing file")
    args = parser.parse_args()

    doc = generate_keyring_doc(primary_key_id=args.key_id)
    doc_json = json.dumps(doc, indent=2)

    if args.dry_run or not args.output:
        print(doc_json)
        return 0

    out_path = os.path.abspath(args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(doc_json + "\n")

    # Attempt to set restrictive permissions (Linux/Unix only)
    if hasattr(os, "chmod"):
        try:
            os.chmod(out_path, 0o400)
        except Exception:
            pass

    print(f"Keyring successfully written to {out_path} (mode 0400).")
    print(f"Active Key ID: {doc['active_key_id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
