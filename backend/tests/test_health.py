from fastapi.testclient import TestClient

import main

client = TestClient(main.app)


def test_health_ok():
    main._health_client = None
    body = client.get("/health").json()
    assert body["ok"] is True
    assert body["db"] == "ok"
    assert body["time"].endswith("+00:00")


def test_health_reports_db_error_without_crashing(monkeypatch):
    class DownClient:
        class admin:
            @staticmethod
            def command(name):
                raise ConnectionError("db down")

    monkeypatch.setattr(main, "_health_client", DownClient())
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["ok"] is True
    assert response.json()["db"] == "error"
