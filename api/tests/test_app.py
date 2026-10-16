"""Failure paths of the HTTP layer: sign-in checks, input limits, and what errors reveal."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402

import app as api  # noqa: E402
import llm  # noqa: E402
import pipeline  # noqa: E402

GOOD = {"text": "When I was ten, I built a robot.", "question": "Who helped?", "others": []}


@pytest.fixture
def client(monkeypatch):
    monkeypatch.delenv("SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_ANON_KEY", raising=False)
    monkeypatch.setenv("ECHOES_DEV_NO_AUTH", "1")
    return api.app.test_client()


def test_refuses_requests_when_sign_in_checks_are_not_configured(client, monkeypatch):
    monkeypatch.delenv("ECHOES_DEV_NO_AUTH")
    r = client.post("/ask", json=GOOD)
    assert r.status_code == 503


def test_requires_a_bearer_token_when_configured(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://example.invalid")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "anon")
    r = client.post("/ask", json=GOOD)  # no Authorization header: rejected before any network call
    assert r.status_code == 401


@pytest.mark.parametrize("path,payload,word", [
    ("/ask", {**GOOD, "question": "x" * 501}, "too long"),
    ("/ask", {**GOOD, "text": "x" * 20_001}, "too long"),
    ("/ask", {**GOOD, "text": ""}, "non-empty"),
    ("/ask", {**GOOD, "others": "nope"}, "others"),
    ("/ask", {**GOOD, "others": [{"label": "T2", "text": 5}]}, "others"),
    ("/extract", {"text": ["not", "text"]}, "non-empty"),
    ("/align", {"old": "a", "new": []}, "old"),
    ("/align", {"old": ["a"] * 81, "new": []}, "old"),
])
def test_rejects_bad_input_with_400(client, path, payload, word):
    r = client.post(path, json=payload)
    assert r.status_code == 400
    assert word in r.get_json()["error"]


def test_rejects_non_json(client):
    r = client.post("/ask", data="hello", content_type="text/plain")
    assert r.status_code == 400


def test_rejects_huge_bodies(client):
    r = client.post("/ask", data="x" * (600 * 1024), content_type="application/json")
    assert r.status_code == 413
    assert "error" in r.get_json()


def test_internal_errors_stay_in_the_log(client, monkeypatch):
    def boom(*a, **k):
        raise ValueError("secret detail sk-123")
    monkeypatch.setattr(pipeline, "guard", boom)
    r = client.post("/ask", json=GOOD)
    assert r.status_code == 500
    assert "secret" not in r.get_data(as_text=True)


def test_ai_service_problems_are_explained(client, monkeypatch):
    def busy(*a, **k):
        raise llm.AIServiceError("The AI service is busy (rate limit reached). Wait a few seconds and try again.")
    monkeypatch.setattr(pipeline, "guard", busy)
    r = client.post("/ask", json=GOOD)
    assert r.status_code == 503
    assert "busy" in r.get_json()["error"]


def test_valid_request_reaches_the_pipeline(client, monkeypatch):
    monkeypatch.setattr(pipeline, "guard", lambda *a, **k: [])
    monkeypatch.setattr(pipeline, "answer", lambda *a, **k: [{"text": "x", "type": "unknown"}])
    r = client.post("/ask", json=GOOD)
    assert r.status_code == 200
    assert r.get_json()["claims"][0]["type"] == "unknown"
