"""Script setup database PostgreSQL lokal untuk Satukit."""
from __future__ import annotations

import os
import sys

import psycopg
from psycopg import sql

PG_HOST = os.getenv("PG_HOST", "localhost")
PG_PORT = int(os.getenv("PG_PORT", "5432"))
PG_ADMIN_USER = os.getenv("PG_ADMIN_USER", "postgres")
PG_ADMIN_PASS = os.getenv("PG_ADMIN_PASS") or (sys.argv[1] if len(sys.argv) > 1 else "")
APP_DB = os.getenv("APP_DB", "satukit")
APP_USER = os.getenv("APP_USER", "satukit_user")
APP_PASS = os.getenv("APP_PASS", "satukit_pass")


def setup():
    print(f"[1/4] Menghubungkan ke PostgreSQL lokal ({PG_HOST}:{PG_PORT}) sebagai {PG_ADMIN_USER}...")
    admin_conn = psycopg.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_ADMIN_USER,
        password=PG_ADMIN_PASS,
        dbname="postgres",
        autocommit=True,
    )

    with admin_conn.cursor() as cur:
        # 1. Cek / buat database satukit
        cur.execute("SELECT 1 FROM pg_database WHERE datname = %s;", (APP_DB,))
        if not cur.fetchone():
            print(f"[2/4] Membuat database '{APP_DB}'...")
            cur.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(APP_DB)))
        else:
            print(f"[2/4] Database '{APP_DB}' sudah ada.")

        # 2. Cek / buat user satukit_user
        cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s;", (APP_USER,))
        if not cur.fetchone():
            print(f"[3/4] Membuat user '{APP_USER}'...")
            cur.execute(
                sql.SQL("CREATE USER {} WITH PASSWORD {}").format(
                    sql.Identifier(APP_USER),
                    sql.Literal(APP_PASS),
                )
            )
        else:
            print(f"[3/4] User '{APP_USER}' sudah ada. Memperbarui password...")
            cur.execute(
                sql.SQL("ALTER USER {} WITH PASSWORD {}").format(
                    sql.Identifier(APP_USER),
                    sql.Literal(APP_PASS),
                )
            )

        # 3. Beri hak akses ke satukit_user
        cur.execute(
            sql.SQL("GRANT ALL PRIVILEGES ON DATABASE {} TO {}").format(
                sql.Identifier(APP_DB), sql.Identifier(APP_USER)
            )
        )

    admin_conn.close()

    # 4. Beri hak akses pada schema public di dalam database satukit
    print(f"[4/4] Mengonfigurasi hak akses schema public pada database '{APP_DB}'...")
    app_db_conn = psycopg.connect(
        host=PG_HOST,
        port=PG_PORT,
        user=PG_ADMIN_USER,
        password=PG_ADMIN_PASS,
        dbname=APP_DB,
        autocommit=True,
    )
    with app_db_conn.cursor() as cur:
        cur.execute(
            sql.SQL("GRANT ALL ON SCHEMA public TO {}").format(sql.Identifier(APP_USER))
        )
        cur.execute(
            sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO {}").format(
                sql.Identifier(APP_USER)
            )
        )
        cur.execute(
            sql.SQL("ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO {}").format(
                sql.Identifier(APP_USER)
            )
        )
    app_db_conn.close()

    print("\n[SUKSES] Database dan pengguna PostgreSQL lokal Satukit berhasil disiapkan!")


if __name__ == "__main__":
    setup()
