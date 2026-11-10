from __future__ import annotations

import re
from pathlib import Path


def parse_conf_file(conf_path: Path) -> dict[str, str]:
    """Membaca file konfigurasi postgresql.conf dan mengekstrak pasangan key-value."""
    configs: dict[str, str] = {}
    if not conf_path.exists():
        return configs

    for raw_line in conf_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            parts = line.split("=", 1)
            key = parts[0].strip()
            val = parts[1].split("#", 1)[0].strip().strip("'\"")
            configs[key] = val
    return configs


def calculate_max_memory_mb(configs: dict[str, str]) -> float:
    """Menghitung estimasi konsumsi memori maksimum (RAM RSS) PostgreSQL.
    Formula: shared_buffers + (max_connections * work_mem) + maintenance_work_mem
    """
    def to_mb(val: str, default: float = 0.0) -> float:
        match = re.match(r"^(\d+)(MB|GB|kB)?$", val, re.IGNORECASE)
        if not match:
            return default
        num = float(match.group(1))
        unit = (match.group(2) or "MB").upper()
        if unit == "GB":
            return num * 1024.0
        if unit == "KB":
            return num / 1024.0
        return num

    shared = to_mb(configs.get("shared_buffers", "128MB"))
    conns = float(configs.get("max_connections", "30"))
    work = to_mb(configs.get("work_mem", "4MB"))
    maint = to_mb(configs.get("maintenance_work_mem", "32MB"))

    # Peak theoretical usage: shared_buffers + conns*work_mem + maint
    total_mb = shared + (conns * work) + maint
    return total_mb


def verify_hardening_specs(conf_path: Path, sql_path: Path) -> list[str]:
    """Memverifikasi spesifikasi hardening DEC-021 dan least-privilege security."""
    errors: list[str] = []

    conf = parse_conf_file(conf_path)

    # 1. Loopback only
    listen = conf.get("listen_addresses", "")
    if listen not in ("127.0.0.1", "localhost"):
        errors.append(f"listen_addresses harus loopback ('127.0.0.1'), didapat: '{listen}'")

    # 2. Shared buffers <= 128MB
    shared = conf.get("shared_buffers", "")
    if shared != "128MB":
        errors.append(f"shared_buffers harus 128MB (DEC-021), didapat: '{shared}'")

    # 3. Peak memory footprint must be under 400 MB
    total_mem = calculate_max_memory_mb(conf)
    if total_mem > 400.0:
        errors.append(f"Total estimasi RAM {total_mem:.1f} MB melebihi plafon 400 MB VPS budget")

    # 4. Check SQL least privilege script
    if sql_path.exists():
        sql_content = sql_path.read_text(encoding="utf-8")
        if "NOSUPERUSER" not in sql_content:
            errors.append("init_least_privilege_user.sql wajib memuat atribut 'NOSUPERUSER'")
        if "NOCREATEDB" not in sql_content:
            errors.append("init_least_privilege_user.sql wajib memuat atribut 'NOCREATEDB'")
        if "NOCREATEROLE" not in sql_content:
            errors.append("init_least_privilege_user.sql wajib memuat atribut 'NOCREATEROLE'")
    else:
        errors.append("File init_least_privilege_user.sql tidak ditemukan")

    return errors


if __name__ == "__main__":
    base = Path(__file__).resolve().parent
    errs = verify_hardening_specs(
        base / "satukit_postgres.conf",
        base / "init_least_privilege_user.sql",
    )
    if errs:
        print("Hardening check FAILED:")
        for e in errs:
            print(f"- {e}")
        raise SystemExit(1)
    print("Hardening check PASSED! Memory and least-privilege verified.")
