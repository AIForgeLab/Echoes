"""The Echoes pipelines. `gen` is a function (system, prompt) -> dict, so tests can pass a fake."""
import json
import re

from core import _tokens, align_claims, canonicalize, find_span, lexical_vectors

CATEGORIES = ["Personal", "Learning", "Projects", "Travel", "People", "Ideas"]

# ---------------------------------------------------------------- extract
EXTRACT_SYSTEM = f"""You turn one personal memory into structured data. Return JSON:
{{"title": "<= 6 words, evocative, no quotes",
  "summary": "one sentence, second person, using ONLY facts written in the memory",
  "category": one of {CATEGORIES},
  "tags": ["3-6 lowercase single words or short names: people, places, objects, themes"],
  "claims": [{{"text": "one atomic fact, second person (e.g. 'You built a robot with your father')",
              "quote": "the shortest EXACT substring of the memory that states this fact"}}]}}
Rules: every fact in the memory becomes one claim; never add facts that are not written;
quotes must be copied character-for-character from the memory."""


def extract(text, gen):
    text = canonicalize(text)
    out = gen(EXTRACT_SYSTEM, f"MEMORY:\n{text}")
    claims = []
    for c in out.get("claims", []):
        span = find_span(text, c.get("quote", ""))
        if span:  # code decides: a claim without a real quote is dropped
            claims.append({"text": c.get("text", "").strip(), "quote": text[span[0]:span[1]],
                           "start": span[0], "end": span[1]})
    category = out.get("category") if out.get("category") in CATEGORIES else "Personal"
    tags = sorted({str(t).strip().lower().lstrip("#") for t in out.get("tags", []) if str(t).strip()})[:6]
    return {"title": (out.get("title") or "Untitled echo").strip()[:60],
            "summary": (out.get("summary") or "").strip()[:300], "category": category,
            "tags": tags, "claims": claims}


# ---------------------------------------------------------------- guard
GUARD_SYSTEM = """You check the hidden assumptions (presuppositions) of a question about a memory.
An assumption is something the question TAKES FOR GRANTED in order to make sense. It is NOT the thing being asked.
Examples:
- "Was Dad proud when the robot won the competition?" takes for granted "the robot won a competition".
  It ASKS whether Dad was proud, so "Dad was proud" is NOT an assumption.
- "Was my father an engineer?" takes nothing for granted beyond having a father. It ASKS whether he was an
  engineer, so "my father was an engineer" is NOT an assumption.
- "Why was this moment important?" takes for granted that the moment mattered; that is fine if the memory supports it.
Return JSON: {"assumptions": [{"assumption": "...",
  "status": "supported" | "not_mentioned" | "contradicted",
  "quote": "exact substring of the MEMORY that supports or contradicts it, or empty",
  "other_label": "label of an OTHER TELLING that states it, or empty",
  "other_quote": "exact substring of that other telling, or empty"}]}
Use "contradicted" only when the memory says the opposite; if it simply doesn't say, use "not_mentioned".
List at most 3 assumptions, only facts about the memory. If the question assumes nothing notable, return [].
Quotes must be copied character-for-character."""


def guard(text, question, others, gen):
    text = canonicalize(text)
    other_block = "\n".join(f"[{o['label']}] {canonicalize(o['text'])}" for o in others) or "(none)"
    out = gen(GUARD_SYSTEM, f"MEMORY:\n{text}\n\nOTHER TELLINGS:\n{other_block}\n\nQUESTION:\n{question}")
    checked = []
    for a in out.get("assumptions", []):
        status = a.get("status", "not_mentioned")
        span = find_span(text, a.get("quote", "")) if a.get("quote") else None
        if status in ("supported", "contradicted") and not span:
            status = "not_mentioned"  # the model claimed evidence it could not show
        item = {"assumption": a.get("assumption", ""), "status": status,
                "quote": text[span[0]:span[1]] if span else None,
                "start": span[0] if span else None, "end": span[1] if span else None,
                "found_in": None}
        if status == "not_mentioned":
            item["found_in"] = _find_in_others(a, text, others)
        checked.append(item)
    return checked


def _find_in_others(a, text, others):
    """Does another telling state this assumption? Trust the model's pointer only if its quote is real;
    otherwise search in code for a sentence sharing the assumption's key words that this telling lacks."""
    for o in others:
        if a.get("other_quote") and find_span(o["text"], a["other_quote"]):
            span = find_span(o["text"], a["other_quote"])
            return {"label": o["label"], "quote": canonicalize(o["text"])[span[0]:span[1]]}
    here = set(_tokens(text))
    key = [w for w in _tokens(a.get("assumption", "")) if w not in here]
    if not key:
        return None
    best = None
    for o in others:
        for sentence in re.split(r"(?<=[.!?])\s+", canonicalize(o["text"])):
            hits = len(set(key) & set(_tokens(sentence)))
            if hits and (best is None or hits > best[0]):
                best = (hits, o["label"], sentence)
    return {"label": best[1], "quote": best[2]} if best else None


# ---------------------------------------------------------------- answer
ANSWER_SYSTEM = """You answer a question about ONE personal memory, speaking to its owner.
Return JSON: {"claims": [{"text": "...", "type": "said" | "inferred" | "unknown", "quote": "..."}]}
- said: directly stated in the memory. "quote" MUST be an exact substring of the memory.
- inferred: your interpretation; phrase it tentatively ("perhaps", "it may be that"). quote may be empty.
- unknown: the memory does not say; state plainly that the memory does not say it. quote empty.
Never invent details. Never treat the UNSUPPORTED ASSUMPTIONS as true.
Keep it to 1-5 short claims."""

ENTAIL_SYSTEM = """For each item, decide whether the QUOTE, on its own, supports the CLAIM.
Return JSON: {"results": [{"id": <id>, "supports": true | false}]}"""


def answer(text, question, flagged, gen):
    text = canonicalize(text)
    flagged_block = "\n".join(f"- {a}" for a in flagged) or "(none)"
    out = gen(ANSWER_SYSTEM,
              f"MEMORY:\n{text}\n\nUNSUPPORTED ASSUMPTIONS:\n{flagged_block}\n\nQUESTION:\n{question}")
    claims = []
    for c in out.get("claims", []):
        ctype = c.get("type") if c.get("type") in ("said", "inferred", "unknown") else "inferred"
        span = find_span(text, c.get("quote", "")) if c.get("quote") else None
        item = {"text": c.get("text", "").strip(), "type": ctype, "verified": False,
                "quote": text[span[0]:span[1]] if span else None,
                "start": span[0] if span else None, "end": span[1] if span else None, "note": None}
        if ctype == "said" and not span:
            item["type"], item["note"] = "inferred", "demoted: quote not found in the memory"
        claims.append(item)

    # second check: does the quote actually support the claim?
    to_check = [{"id": i, "claim": c["text"], "quote": c["quote"]} for i, c in enumerate(claims) if c["type"] == "said"]
    if to_check:
        res = gen(ENTAIL_SYSTEM, json.dumps(to_check))
        ok = {r.get("id"): bool(r.get("supports")) for r in res.get("results", [])}
        for item in to_check:
            c = claims[item["id"]]
            if ok.get(item["id"]):
                c["verified"] = True
            else:
                c["type"], c["note"] = "inferred", "demoted: quote does not support the claim"
    return claims


# ---------------------------------------------------------------- pentimento
JUDGE_SYSTEM = """Each item pairs a detail from an EARLIER telling of a memory with a detail from a LATER telling.
Label each pair:
- "consistent": both state the same fact
- "changed": same subject, but a detail differs, was added, or was removed (e.g. "with my father" -> "with Dad and Uncle Raj")
- "unrelated": different facts
Return JSON: {"results": [{"id": <id>, "label": "consistent" | "changed" | "unrelated"}]}"""


# One shared content word between two short claims scores about 0.15-0.25 with lexical vectors,
# so keep the cut-off low: the judge model still rejects pairs that turn out to be unrelated.
LEXICAL_THRESHOLD = 0.12


def pentimento(old_claims, new_claims, gen, emb=None):
    """Pair claims (Hungarian matching on vector similarity), then let the model judge each pair.
    emb=None uses local TF-IDF vectors, so no embedding API is needed."""
    def judge(pairs):
        out = gen(JUDGE_SYSTEM, json.dumps(pairs))
        return {r.get("id"): r.get("label") for r in out.get("results", [])}
    if emb is None:
        return align_claims(old_claims, new_claims, lexical_vectors, judge, threshold=LEXICAL_THRESHOLD)
    return align_claims(old_claims, new_claims, emb, judge)
