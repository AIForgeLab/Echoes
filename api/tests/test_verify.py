"""tools/verify.py must never call an archive intact when it couldn't check everything."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "tools"))

import verify as v  # noqa: E402


def sealed(text, prev="genesis", n=1, at="2026-10-16T00:00:00Z"):
    c = v.sha256(v.canonicalize(text))
    return {"version_no": n, "text": text, "content_hash": c, "prev_hash": prev, "sealed_at": at, "chain_hash": v.sha256(f"{prev}|{c}|{at}")}


def run(*tellings):
    return v.verify({"echoes": [{"title": "t", "tellings": list(tellings)}]})


def test_intact_chain_passes():
    t1 = sealed("first")
    assert run(t1, sealed("second", t1["chain_hash"], 2)) == 0


def test_changed_text_fails():
    t = sealed("first")
    t["text"] = "first!"
    assert run(t) == 1


def test_unreadable_sealed_text_fails():
    t = sealed("first")
    t["text"] = None  # e.g. ciphertext altered, so it no longer decrypts
    assert run(t) == 1


def test_broken_chain_fails():
    t1 = sealed("first")
    assert run(t1, sealed("second", "not-the-previous-hash", 2)) == 1


def test_forgotten_tellings_make_the_result_incomplete():
    t1 = sealed("first")
    t2 = sealed("second", t1["chain_hash"], 2)
    t1["text"], t1["content_hash"] = None, None
    assert run(t1, t2) == 2


def test_empty_export_is_not_intact():
    assert run() == 2
