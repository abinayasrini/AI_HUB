from fastapi.testclient import TestClient
from main import app
client = TestClient(app)

def test_dashboard_returns_metrics():
    response = client.get("/api/dashboard")
    assert response.status_code == 200
    data = response.json()
    assert "kpis" in data and "trend" in data and "journeys" in data

def test_duplicate_check_detects_seed_record():
    response = client.get("/api/duplicates/check", params={
        "external_ref":"RCPT-10482","kind":"Receipt","entity":"Northstar Manufacturing",
        "amount":184500,"due_date":"2026-10-14"
    })
    assert response.status_code == 200
    assert response.json()["duplicate"] is True

def test_exceptions_include_actionable_records():
    response = client.get("/api/exceptions")
    assert response.status_code == 200
    assert any(x["severity"] == "Critical" for x in response.json())
