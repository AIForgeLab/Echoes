"""Verify an Echoes export without Echoes.

    python tools/verify.py echoes-archive-2026-10-16.json

Recomputes every SHA-256 seal and chain link from the exported text, using the same
canonical form as the app (Unicode NFC, whitespace collapsed to single spaces).
Exit code 0 = every telling checked and intact
          1 = a seal failed, or a sealed telling can't be read (it may have been altered)
          2 = nothing failed, but some tellings couldn't be checked (forgotten), so the result is incomplete
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


def verify(bundle: dict) -> int:
    """Print a report and return the exit code described at the top of this file."""
    checked = failed = forgotten = 0
    for echo in bundle.get("echoes", []):
        title = echo.get("title") or "(forgotten memory)"
        print(f"\n{title}")
        expected_prev = "genesis"
        for t in sorted(echo.get("tellings", []), key=lambda x: x["version_no"]):
            label = f"  telling {t['version_no']}"
            problems = []
            if t["prev_hash"] != expected_prev:
                problems.append("chain link broken")
            if t.get("content_hash") is None:
                # Forgetting destroys the key and the seal, so there is nothing left to compare.
                print(f"{label}: forgotten - cannot be checked" + (f" ({problems[0]})" if problems else ""))
                forgotten += 1
                failed += bool(problems)
            elif t.get("text") is None:
                print(f"{label}: FAILED - sealed text can't be read (it may have been altered)")
                failed += 1
            else:
                if sha256(canonicalize(t["text"])) != t["content_hash"]:
                    problems.append("text does not match its seal")
                if sha256(f"{t['prev_hash']}|{t['content_hash']}|{t['sealed_at']}") != t["chain_hash"]:
                    problems.append("chain hash mismatch")
                print(f"{label}: {'OK' if not problems else 'FAILED - ' + ', '.join(problems)}")
                checked += 1
                failed += bool(problems)
            expected_prev = t["chain_hash"]
    if failed:
        print(f"\nFAILED: {failed} telling(s) did not pass. The stored text changed after it was sealed, or can't be read.")
        return 1
    if forgotten or not checked:
        print(f"\nINCOMPLETE: {checked} telling(s) intact, {forgotten} forgotten and not checkable.")
        return 2
    print(f"\nAll {checked} seals intact.")
    return 0


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], encoding="utf-8") as f:
        sys.exit(verify(json.load(f)))
