"""Run: cd api && python -m pytest -q   (no API key needed: the model is faked)"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core import align_claims, canonicalize, find_span, lexical_vectors  # noqa: E402
import pipeline  # noqa: E402

MEMORY = ("When I was ten, I built my first robot with my father.  It was raining, "
          "so we worked in the garage. That day made me want to be an engineer.")


def test_canonicalize_matches_browser_rules():
    assert canonicalize("  a\n\n b\t c  ") == "a b c"
    assert canonicalize("é") == "é"  # NFC


def test_find_span_exact_and_trimmed():
    text = canonicalize(MEMORY)
    s, e = find_span(text, "built my first robot")
    assert text[s:e] == "built my first robot"
    s, e = find_span(text, '"It was raining,"')
    assert text[s:e].startswith("It was raining")


def test_find_span_rejects_paraphrase():
    assert find_span(MEMORY, "constructed my first robot") is None


def fake_gen(responses):
    """Returns canned JSON per system prompt, in call order."""
    calls = list(responses)

    def gen(system, prompt):
        return calls.pop(0)
    return gen


def test_extract_drops_claims_without_real_quotes():
    gen = fake_gen([{
        "title": "The first robot", "summary": "You built a robot.", "category": "Projects", "tags": ["Father", "#robot"],
        "claims": [
            {"text": "You built a robot with your father", "quote": "built my first robot with my father"},
            {"text": "The robot was red", "quote": "the red robot"},  # invented -> dropped
        ]},
        {"results": [{"id": 0, "supports": True}]}])
    out = pipeline.extract(MEMORY, gen)
    assert [c["text"] for c in out["claims"]] == ["You built a robot with your father"]
    assert out["tags"] == ["father", "robot"]
    assert out["category"] == "Projects" and out["summary"] == "You built a robot."


def test_guard_downgrades_fake_evidence_and_finds_other_telling():
    later = "Dad and Uncle Raj helped me build a robot for the school competition. We won."
    gen = fake_gen([{"assumptions": [
        {"assumption": "the robot won a competition", "status": "supported", "quote": "we won the cup",
         "other_label": "2026", "other_quote": "for the school competition"},
    ]}])
    out = pipeline.guard(MEMORY, "Was Dad proud when the robot won?", [{"label": "2026", "text": later}], gen)
    assert out[0]["status"] == "not_mentioned"       # model's quote was fake
    assert out[0]["found_in"]["label"] == "2026"     # but the later telling does say it


def test_answer_demotes_unquoted_and_unsupported_said_claims():
    gen = fake_gen([
        {"claims": [
            {"text": "It made you want to be an engineer", "type": "said", "quote": "That day made me want to be an engineer"},
            {"text": "Your father was an engineer", "type": "said", "quote": "my father was an engineer"},
            {"text": "It rained that day", "type": "said", "quote": "built my first robot"},
            {"text": "The memory does not say the robot's colour", "type": "unknown", "quote": ""},
        ]},
        {"results": [{"id": 0, "supports": True}, {"id": 2, "supports": False}]},
    ])
    out = pipeline.answer(MEMORY, "Why did it matter?", [], gen)
    assert [c["type"] for c in out] == ["said", "inferred", "inferred", "unknown"]
    assert out[0]["verified"] is True
    assert "quote not found" in out[1]["note"]
    assert "does not support" in out[2]["note"]


def test_align_labels_consistent_changed_omitted_new():
    old = ["You built a robot", "Your father helped you", "It was raining"]
    new = ["You built a robot", "Dad and Uncle Raj helped you", "You entered a school competition"]
    vectors = {  # hand-made embeddings: similar meanings point the same way
        "You built a robot": [1, 0, 0, 0],
        "Your father helped you": [0, 1, 0, 0],
        "Dad and Uncle Raj helped you": [0, 0.9, 0.3, 0],
        "It was raining": [0, 0, 0, 1],
        "You entered a school competition": [0.2, 0, 1, 0.1],
    }

    def judge(pairs):
        return {p["id"]: ("consistent" if p["old"] == p["new"] else "changed") for p in pairs}

    out = align_claims(old, new, lambda t: [vectors[x] for x in t], judge)
    labels = {(r["label"], r["old"], r["new"]) for r in out}
    assert ("consistent", "You built a robot", "You built a robot") in labels
    assert ("changed", "Your father helped you", "Dad and Uncle Raj helped you") in labels
    assert ("omitted", "It was raining", None) in labels
    assert ("new", None, "You entered a school competition") in labels


def test_local_vectors_pair_the_robot_retelling():
    old = ["You were ten", "You built your first robot", "Your father helped you build it", "It was raining",
           "You worked in the garage", "That day inspired you to become an engineer"]
    new = ["You were ten", "You built a robot", "Dad and Uncle Raj helped you build it", "The robot was for a school competition",
           "You won the competition", "That was when you knew you wanted to be an engineer"]

    def judge(pairs):
        return {p["id"]: ("consistent" if p["old"] == p["new"] else "changed") for p in pairs}

    out = align_claims(old, new, lexical_vectors, judge, threshold=0.2)
    pairs = {(r["label"], r["old"], r["new"]) for r in out}
    assert ("changed", "Your father helped you build it", "Dad and Uncle Raj helped you build it") in pairs  # dad = father
    assert ("omitted", "It was raining", None) in pairs
    assert ("new", None, "You won the competition") in pairs


def test_local_vectors_pair_a_single_shared_word():
    """The sample circuit retelling: one shared word ('bulb', 'engineer') must still reach the judge."""
    from pipeline import LEXICAL_THRESHOLD
    old = ["You were fourteen", "You assembled a small battery-powered circuit", "It was for a school science exhibition",
           "The bulb flickered several times before it stayed on", "You felt you had made something real with your own hands",
           "The experience strengthened your interest in electrical engineering"]
    new = ["You were thirteen or fourteen", "Your science teacher helped you", "You wired up a circuit", "It was for the school exhibition",
           "The bulb lit up on the first try", "The judges gave you second prize", "That was the day you decided to become an engineer"]

    def judge(pairs):
        return {p["id"]: "changed" for p in pairs}

    pairs = {(r["label"], r["old"], r["new"]) for r in align_claims(old, new, lexical_vectors, judge, threshold=LEXICAL_THRESHOLD)}
    assert ("changed", old[3], new[4]) in pairs
    assert ("changed", old[5], new[6]) in pairs
    assert ("omitted", old[4], None) in pairs
    assert ("new", None, new[5]) in pairs


def test_extract_drops_facts_whose_real_quote_does_not_support_them():
    gen = fake_gen([
        {"title": "Robot", "summary": "", "category": "Projects", "tags": [], "claims": [
            {"text": "You built a robot with your father", "quote": "built my first robot with my father"},
            {"text": "Your father was an engineer", "quote": "my father"},  # quote exists, but doesn't say that
        ]},
        {"results": [{"id": 0, "supports": True}, {"id": 1, "supports": False}]},
    ])
    out = pipeline.extract(MEMORY, gen)
    assert [c["text"] for c in out["claims"]] == ["You built a robot with your father"]


def test_extract_keeps_nothing_when_the_check_is_missing_or_unclear():
    gen = fake_gen([
        {"title": "Robot", "summary": "", "category": "Projects", "tags": [], "claims": [
            {"text": "You built a robot", "quote": "built my first robot"}]},
        {"results": [{"id": 0, "supports": "yes"}]},  # not a clear true: fail closed
    ])
    assert pipeline.extract(MEMORY, gen)["claims"] == []
