from __future__ import annotations

from pathlib import Path

from scripts.postgres.check_postgres_hardening import (
    calculate_max_memory_mb,
    parse_conf_file,
    verify_hardening_specs,
)

workspace_dir = Path(__file__).resolve().parent.parent.parent


def test_postgres_hardening_configuration_and_memory_ceiling() -> None:
    conf_path = workspace_dir / "scripts" / "postgres" / "satukit_postgres.conf"
    sql_path = workspace_dir / "scripts" / "postgres" / "init_least_privilege_user.sql"

    assert conf_path.exists(), "satukit_postgres.conf harus ada di scripts/postgres"
    assert sql_path.exists(), "init_least_privilege_user.sql harus ada di scripts/postgres"

    # Verifikasi konfigurasi hardening
    errors = verify_hardening_specs(conf_path, sql_path)
    assert not errors, f"Pelanggaran hardening ditemukan: {errors}"

    configs = parse_conf_file(conf_path)
    assert configs["listen_addresses"] == "127.0.0.1"
    assert configs["shared_buffers"] == "128MB"
    assert configs["password_encryption"] == "scram-sha-256"

    # Verifikasi plafon memori total < 400 MB (DEC-021 untuk VPS 2.2 GiB RAM)
    max_mem_mb = calculate_max_memory_mb(configs)
    assert max_mem_mb < 400.0, f"Estimasi RAM {max_mem_mb} MB melebihi batas 400 MB"
    assert max_mem_mb == 128.0 + (30 * 4.0) + 32.0  # 128 + 120 + 32 = 280 MB


def test_least_privilege_sql_privileges() -> None:
    sql_path = workspace_dir / "scripts" / "postgres" / "init_least_privilege_user.sql"
    sql = sql_path.read_text(encoding="utf-8")

    assert "satukit_user" in sql
    assert "NOSUPERUSER" in sql
    assert "NOCREATEDB" in sql
    assert "NOCREATEROLE" in sql
    assert "NOINHERIT" in sql
    assert "REVOKE CREATE ON SCHEMA public FROM PUBLIC;" in sql
