import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
FRONTEND_DIR = ROOT_DIR / "frontend"
DIST_DIR = FRONTEND_DIR / "dist"

sys.path.insert(0, str(BACKEND_DIR))


def test_requirements():
    print("[1/5] Memeriksa dependensi backend...")
    required_modules = [
        "fastapi",
        "uvicorn",
        "docx",
        "pypdf",
        "PIL",
        "anyio",
        "pptx",
        "openpyxl",
        "pymupdf",
    ]
    for mod in required_modules:
        try:
            __import__(mod)
            print(f"  [OK] Modul '{mod}' terpasang.")
        except ImportError:
            print(f"  [FAIL] Modul '{mod}' TIDAK ditemukan!")
            return False
    return True


def test_frontend_dist():
    print("\n[2/5] Memeriksa bundel produksi frontend...")
    index_html = DIST_DIR / "index.html"
    if not index_html.exists():
        print("  [FAIL] 'frontend/dist/index.html' tidak ditemukan!")
        return False

    size_kb = index_html.stat().st_size / 1024
    assets_dir = DIST_DIR / "assets"
    asset_files = list(assets_dir.glob("*")) if assets_dir.exists() else []

    print(f"  [OK] 'index.html' tersedia ({size_kb:.1f} KB).")
    print(f"  [OK] Direktori assets memuat {len(asset_files)} berkas ter-bundle.")
    return True


def test_launcher_scripts():
    print("\n[3/5] Memeriksa skrip peluncur distribusi...")
    scripts = [
        ROOT_DIR / "start-docbuilder.bat",
        ROOT_DIR / "start-docbuilder.ps1",
        ROOT_DIR / "start-docbuilder.sh",
    ]
    all_ok = True
    for s in scripts:
        if s.exists():
            print(f"  [OK] Skrip '{s.name}' siap.")
        else:
            print(f"  [FAIL] Skrip '{s.name}' belum tersedia!")
            all_ok = False
    return all_ok


def test_api_and_static_serving():
    print("\n[4/5] Menguji runtime FastAPI & static serving...")
    from fastapi.testclient import TestClient
    from app.main import create_app

    app = create_app()
    client = TestClient(app)

    # 1. Root static SPA
    resp_root = client.get("/")
    if resp_root.status_code != 200 or "<html" not in resp_root.text.lower():
        print(f"  [FAIL] Root '/' gagal menyajikan SPA! Status: {resp_root.status_code}")
        return False
    print("  [OK] Root '/' berhasil menyajikan antarmuka SPA React (HTTP 200).")

    # 2. Health check
    resp_health = client.get("/api/health")
    if resp_health.status_code != 200 or resp_health.json().get("status") != "ready":
        print(f"  [FAIL] '/api/health' gagal! Status: {resp_health.status_code}")
        return False
    lo_detected = resp_health.json().get("libreoffice_detected")
    print(f"  [OK] '/api/health' berstatus ready (LibreOffice detected: {lo_detected}).")

    # 3. Bootstrap token
    from app.core.security import session_manager

    resp_boot = client.post(
        "/api/auth/bootstrap",
        json={"bootstrap_token": session_manager.bootstrap_token},
    )
    if resp_boot.status_code != 200 or "csrf_token" not in resp_boot.json():
        print(f"  [FAIL] '/api/auth/bootstrap' gagal! Status: {resp_boot.status_code}")
        return False
    print("  [OK] '/api/auth/bootstrap' berhasil mengembalikan token sesi & CSRF.")

    return True


def test_libreoffice_status():
    print("\n[5/5] Memeriksa ketersediaan LibreOffice untuk konversi dokumen...")
    from app.api.health import detect_libreoffice

    available, path = detect_libreoffice()
    if available:
        print(f"  [OK] LibreOffice terdeteksi: {path}")
    else:
        print("  [INFO] LibreOffice tidak ditemukan di sistem host default.")
        print("    (Catatan: Fitur konversi DOCX<->PDF membutuhkan instalasi LibreOffice,")
        print("     sedangkan Resume Builder, ATS Checker, dan PDF Tools tetap berjalan penuh).")
    return True


def main():
    print("=" * 65)
    print("DOC-BUILDER DISTRIBUTION BUNDLE VERIFICATION")
    print("=" * 65)

    checks = [
        test_requirements(),
        test_frontend_dist(),
        test_launcher_scripts(),
        test_api_and_static_serving(),
        test_libreoffice_status(),
    ]

    print("\n" + "=" * 65)
    if all(checks):
        print("STATUS: SELURUH PRASYARAT DISTRIBUSI TERVERIFIKASI (PASS)")
        print("Doc-builder siap dirilis dan didistribusikan secara lokal.")
        print("=" * 65)
        return 0
    else:
        print("STATUS: DITEMUKAN KEGAGALAN PADA BUNDEL DISTRIBUSI (FAIL)")
        print("=" * 65)
        return 1


if __name__ == "__main__":
    sys.exit(main())
