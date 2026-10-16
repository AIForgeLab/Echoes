"""Echoes API. Run:  python app.py   (listens on http://localhost:5001)

Production rules: sign-in is required unless ECHOES_DEV_NO_AUTH=1 is set on purpose, debug is off
unless FLASK_DEBUG=1, every input is type- and size-checked, and clients get generic errors while
the details go to the server log.
"""
import os
import threading
import time
from collections import defaultdict, deque

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

load_dotenv()

import llm  # noqa: E402  (needs env loaded first)
import pipeline  # noqa: E402

# Size limits: one request can't run up a huge AI bill or tie up the server.
MAX_TEXT = 20_000       # characters in one telling
MAX_QUESTION = 500
MAX_OTHERS = 10         # other tellings sent along for the assumption check
MAX_LABEL = 80
MAX_CLAIMS = 80         # facts per telling sent to /align
MAX_CLAIM = 600

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 512 * 1024
CORS(app, origins=os.environ.get("WEB_ORIGIN", "http://localhost:5173").split(","))


class BadInput(ValueError):
    """A request the caller has to fix. Its message is safe to show."""


# Per-user rate limit, so one account can't use up the AI quota. Kept in memory: it applies per server
# process, which is enough for one instance; several instances would need a shared store.
_hits = defaultdict(deque)
_hits_lock = threading.Lock()


def allow_request(who):
    per_minute = int(os.environ.get("RATE_PER_MINUTE", "20"))
    per_day = int(os.environ.get("RATE_PER_DAY", "400"))
    now = time.time()
    with _hits_lock:
        q = _hits[who]
        while q and now - q[0] > 86400:
            q.popleft()
        if len(q) >= per_day or sum(1 for t in q if now - t < 60) >= per_minute:
            return False
        q.append(now)
        return True


def limited():
    return jsonify(error="That's a lot of AI requests in a short time. Please wait a minute and try again."), 429


def require_user():
    """Only signed-in Echoes users may call the AI routes (checks the Supabase token). Fails closed."""
    url, anon = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_ANON_KEY")
    if not url or not anon:
        if os.environ.get("ECHOES_DEV_NO_AUTH") == "1":  # deliberate local development without accounts
            return None if allow_request(f"ip:{request.remote_addr}") else limited()
        app.logger.error("SUPABASE_URL / SUPABASE_ANON_KEY are not set: refusing AI requests")
        return jsonify(error="The AI server isn't set up to check sign-ins."), 503
    token = request.headers.get("Authorization", "")
    if not token.startswith("Bearer "):
        return jsonify(error="Please sign in."), 401
    try:
        r = requests.get(f"{url}/auth/v1/user", headers={"Authorization": token, "apikey": anon}, timeout=10)
    except requests.RequestException:
        app.logger.exception("sign-in check failed")
        return jsonify(error="Couldn't check your sign-in. Please try again."), 503
    if r.status_code != 200:
        return jsonify(error="Please sign in."), 401
    user_id = (r.json() or {}).get("id") or token
    return None if allow_request(f"user:{user_id}") else limited()


def body():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadInput("Send a JSON object.")
    return data


def text_field(data, key, limit):
    v = data.get(key)
    if not isinstance(v, str) or not v.strip():
        raise BadInput(f"'{key}' must be non-empty text.")
    if len(v) > limit:
        raise BadInput(f"'{key}' is too long (at most {limit} characters).")
    return v


def text_list(data, key, max_items, max_len):
    v = data.get(key, [])
    if not isinstance(v, list) or len(v) > max_items or not all(isinstance(x, str) and 0 < len(x) <= max_len for x in v):
        raise BadInput(f"'{key}' must be a list of at most {max_items} texts, each up to {max_len} characters.")
    return v


def other_tellings(data):
    v = data.get("others", [])
    ok = isinstance(v, list) and len(v) <= MAX_OTHERS and all(
        isinstance(o, dict) and isinstance(o.get("label"), str) and len(o["label"]) <= MAX_LABEL
        and isinstance(o.get("text"), str) and 0 < len(o["text"]) <= MAX_TEXT for o in v)
    if not ok:
        raise BadInput(f"'others' must be a list of at most {MAX_OTHERS} tellings with a label and text.")
    return [{"label": o["label"], "text": o["text"]} for o in v]


@app.errorhandler(BadInput)
def on_bad_input(e):
    return jsonify(error=str(e)), 400


@app.errorhandler(HTTPException)
def on_http_error(e):
    if e.code and e.code >= 500:
        app.logger.error("HTTP %s: %s", e.code, e.description)
        return jsonify(error="Something went wrong on the AI server. Please try again."), e.code
    return jsonify(error=e.description), e.code


@app.errorhandler(Exception)
def on_error(e):
    app.logger.exception(e)  # full details stay in the server log
    if isinstance(e, llm.AIServiceError):
        return jsonify(error=str(e)), 503  # written for users: busy, timed out, unreadable reply
    return jsonify(error="Something went wrong on the AI server. Please try again."), 500


@app.get("/health")
def health():
    return {"ok": True, "model": llm.model_name()}


@app.post("/extract")
def extract():
    if (err := require_user()):
        return err
    data = body()
    return pipeline.extract(text_field(data, "text", MAX_TEXT), llm.generate_json)


@app.post("/ask")
def ask():
    if (err := require_user()):
        return err
    data = body()
    text, question, others = text_field(data, "text", MAX_TEXT), text_field(data, "question", MAX_QUESTION), other_tellings(data)
    assumptions = pipeline.guard(text, question, others, llm.generate_json)
    flagged = [a["assumption"] for a in assumptions if a["status"] != "supported"]
    claims = pipeline.answer(text, question, flagged, llm.generate_json)
    return {"assumptions": assumptions, "claims": claims}


@app.post("/align")
def align():
    if (err := require_user()):
        return err
    data = body()
    old, new = text_list(data, "old", MAX_CLAIMS, MAX_CLAIM), text_list(data, "new", MAX_CLAIMS, MAX_CLAIM)
    emb = llm.embed if os.environ.get("EMBED_API_KEY") else None  # None = built-in local similarity
    return {"pairs": pipeline.pentimento(old, new, llm.generate_json, emb)}


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5001)), debug=os.environ.get("FLASK_DEBUG") == "1")
