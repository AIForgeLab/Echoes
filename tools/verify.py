"""Verify an Echoes export without Echoes.

    python tools/verify.py echoes-archive-2026-10-16.json

Recomputes every SHA-256 seal and chain link from the exported text, using the same
canonical form as the app (Unicode NFC, whitespace collapsed to single spaces).
Exit code 0 = everything intact, 1 = something changed.
"""
import hashlib
import json
import re
import sys
import unicodedata


def canonicalize(text: str) -> str:
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text or "")).strip()


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def verify(bundle: dict) -> bool:
    all_ok = True
    for echo in bundle.get("echoes", []):
        title = echo.get("title") or "(forgotten memory)"
        print(f"\n{title}")
        expected_prev = "genesis"
        for t in sorted(echo.get("tellings", []), key=lambda x: x["version_no"]):
            label = f"  telling {t['version_no']}"
            if t.get("text") is None or t.get("content_hash") is None:
                print(f"{label}: forgotten or unreadable - nothing to check")
                expected_prev = t["chain_hash"]
                continue
            problems = []
            if t["prev_hash"] != expected_prev:
                problems.append("chain link broken")
            if sha256(canonicalize(t["text"])) != t["content_hash"]:
                problems.append("text does not match its seal")
            if sha256(f"{t['prev_hash']}|{t['content_hash']}|{t['sealed_at']}") != t["chain_hash"]:
                problems.append("chain hash mismatch")
            print(f"{label}: {'OK' if not problems else 'FAILED - ' + ', '.join(problems)}")
            all_ok &= not problems
            expected_prev = t["chain_hash"]
    print("\nAll seals intact." if all_ok else "\nSome seals FAILED: the text changed after it was sealed.")
    return all_ok


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as f:
        sys.exit(0 if verify(json.load(f)) else 1)
