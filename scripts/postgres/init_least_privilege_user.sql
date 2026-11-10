-- ==============================================================================
-- Satukit PostgreSQL Least-Privilege Role & Database Provisioning
-- Hardening: Non-Superuser, Limited Schema Ownership, No Cluster-Wide Privileges
-- ==============================================================================

-- 1. Buat database satukit jika belum ada
SELECT 'CREATE DATABASE satukit WITH ENCODING = ''UTF8'' TEMPLATE = template1'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'satukit')\gexec

-- Pindah konteks ke database satukit
\c satukit

-- 2. Revoke default public schema privileges dari PUBLIC (NFR-SEC-012)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE satukit FROM PUBLIC;

-- 3. Buat role pengguna aplikasi tanpa atribut superuser / createdb / createrole
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'satukit_user') THEN
        CREATE ROLE satukit_user WITH
            LOGIN
            NOSUPERUSER
            NOCREATEDB
            NOCREATEROLE
            NOINHERIT
            NOREPLICATION
            BYPASSRLS
            ENCRYPTED PASSWORD 'satukit_secure_pass_change_in_vps_env';
    END IF;
END $$;

-- 4. Berikan izin yang presisi (least privilege) pada database dan schema
GRANT CONNECT ON DATABASE satukit TO satukit_user;
GRANT USAGE, CREATE ON SCHEMA public TO satukit_user;

-- 5. Default privileges untuk tabel dan sequence masa depan
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO satukit_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO satukit_user;
