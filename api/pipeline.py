"""The Echoes pipelines. `gen` is a function (system, prompt) -> dict, so tests can pass a fake."""
import json

from core import align_claims, canonicalize, find_span

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
An assumption is something the question takes for granted, NOT what it asks.
Example: "Was Dad proud when the robot won the competition?" assumes "the robot won a competition"
and "Dad was there"; it ASKS whether Dad was proud (that is not an assumption).
Return JSON: {"assumptions": [{"assumption": "...",
  "status": "supported" | "not_mentioned" | "contradicted",
  "quote": "exact substring of the MEMORY that supports or contradicts it, or empty",
  "other_label": "label of an OTHER TELLING that states it, or empty",
  "other_quote": "exact substring of that other telling, or empty"}]}
Only list assumptions that are about facts of the memory. If the question assumes nothing, return [].
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
        if status == "not_mentioned" and a.get("other_label"):
            match = next((o for o in others if o["label"] == a["other_label"]), None)
            if match and find_span(match["text"], a.get("other_quote", "")):
                item["found_in"] = {"label": match["label"], "quote": a["other_quote"]}
        checked.append(item)
    return checked


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


def pentimento(old_claims, new_claims, gen, emb):
    def judge(pairs):
        out = gen(JUDGE_SYSTEM, json.dumps(pairs))
        return {r.get("id"): r.get("label") for r in out.get("results", [])}
    return align_claims(old_claims, new_claims, emb, judge)
