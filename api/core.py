"""Pure logic for Echoes: no network calls here, so it is easy to test.

- canonicalize(): the exact same text normalisation the browser uses before hashing
- find_span():    code (not the model) decides whether a quote really is in the memory
- align_claims(): Pentimento - pair claims across two tellings, then label them
"""
import re
import unicodedata

import numpy as np
from scipy.optimize import linear_sum_assignment


def canonicalize(text: str) -> str:
    """Unicode NFC + collapse all whitespace to single spaces + trim.
    Must match canonicalize() in web/src/lib/seal.js."""
    return re.sub(r"\s+", " ", unicodedata.normalize("NFC", text or "")).strip()


_EDGE_PUNCT = " \"'“”‘’.,;:!?"


def find_span(text: str, quote: str):
    """Return (start, end) of quote inside text, or None.

    Accepts an exact match, or a case-insensitive match after trimming
    surrounding quote marks/punctuation. Nothing fuzzier: if the model
    paraphrased, the claim does NOT count as 'said'."""
    text = canonicalize(text)
    quote = canonicalize(quote)
    if not quote:
        return None
    i = text.find(quote)
    if i != -1:
        return i, i + len(quote)
    trimmed = quote.strip(_EDGE_PUNCT)
    if len(trimmed) < 3:
        return None
    i = text.find(trimmed)
    if i != -1:
        return i, i + len(trimmed)
    low_text, low_q = text.lower(), trimmed.lower()
    if len(low_text) == len(text) and len(low_q) == len(trimmed):
        i = low_text.find(low_q)
        if i != -1:
            return i, i + len(trimmed)
    return None


def cosine_matrix(a, b):
    a = np.asarray(a, dtype=float)
    b = np.asarray(b, dtype=float)
    a = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-12)
    b = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-12)
    return a @ b.T


def align_claims(old, new, embed_fn, judge_fn, threshold=0.6):
    """Pentimento alignment.

    old, new : lists of claim strings (earlier telling, later telling)
    embed_fn : list[str] -> list[vector]
    judge_fn : list[{"id", "old", "new"}] -> {id: "consistent"|"changed"|"unrelated"}

    1. embed every claim, build a cosine-similarity matrix
    2. Hungarian algorithm = best one-to-one pairing of old and new claims
    3. drop weak pairs (< threshold), ask the judge about the rest
    4. anything unpaired is 'omitted' (only in old) or 'new' (only in new)
    """
    result = []
    paired_old, paired_new = set(), set()
    if old and new:
        vecs = embed_fn(list(old) + list(new))
        sim = cosine_matrix(vecs[: len(old)], vecs[len(old):])
        rows, cols = linear_sum_assignment(-sim)
        candidates = [
            {"id": k, "old": old[r], "new": new[c], "r": int(r), "c": int(c), "sim": float(sim[r, c])}
            for k, (r, c) in enumerate(zip(rows, cols))
            if sim[r, c] >= threshold
        ]
        verdicts = judge_fn([{"id": p["id"], "old": p["old"], "new": p["new"]} for p in candidates]) if candidates else {}
        for p in candidates:
            label = verdicts.get(p["id"], "unrelated")
            if label in ("consistent", "changed"):
                result.append({"label": label, "old": p["old"], "new": p["new"], "similarity": round(p["sim"], 3)})
                paired_old.add(p["r"])
                paired_new.add(p["c"])
    for i, c in enumerate(old):
        if i not in paired_old:
            result.append({"label": "omitted", "old": c, "new": None})
    for j, c in enumerate(new):
        if j not in paired_new:
            result.append({"label": "new", "old": None, "new": c})
    order = {"consistent": 0, "changed": 1, "omitted": 2, "new": 3}
    result.sort(key=lambda x: order[x["label"]])
    return result
