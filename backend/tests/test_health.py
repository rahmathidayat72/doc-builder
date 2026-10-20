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
    assert data["status"] == "ready"
    assert data["service"] == "Doc-builder Backend"
    assert data["environment"] == "localhost"
    assert "libreoffice_available" in data
