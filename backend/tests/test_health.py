import sys
from pathlib import Path

from fastapi.testclient import TestClient

# Pastikan module app dapat di-import
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app

client = TestClient(app)


def test_health_check_returns_ready():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ("ready", "degraded")
    assert data["service"] == "Satukit Backend API"
    assert data["environment"] in ("localhost", "development")
    assert "database_connected" in data
    assert "libreoffice_available" in data
    assert "disk" in data
    assert data["disk"]["status"] in ("healthy", "warning", "critical")
    assert "used_percent" in data["disk"]
    assert "free_mb" in data["disk"]
