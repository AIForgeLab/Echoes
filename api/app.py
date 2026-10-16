"""Echoes API. Run:  python app.py   (listens on http://localhost:5001)"""
import os

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

import llm  # noqa: E402  (needs env loaded first)
import pipeline  # noqa: E402

app = Flask(__name__)
CORS(app, origins=os.environ.get("WEB_ORIGIN", "http://localhost:5173").split(","))


def require_user():
    """Only logged-in Echoes users may call the AI routes (checks the Supabase token)."""
    url, anon = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_ANON_KEY")
    if not url or not anon:
        return None  # dev mode: no check configured
    token = request.headers.get("Authorization", "")
    r = requests.get(f"{url}/auth/v1/user", headers={"Authorization": token, "apikey": anon}, timeout=10)
    if r.status_code != 200:
        return (jsonify(error="not logged in"), 401)
    return None


@app.errorhandler(Exception)
def on_error(e):
    app.logger.exception(e)
    return jsonify(error=str(e)), 500


@app.get("/health")
def health():
    return {"ok": True, "model": llm.model_name()}


@app.post("/extract")
def extract():
    if (err := require_user()):
        return err
    body = request.get_json(force=True)
    return pipeline.extract(body["text"], llm.generate_json)


@app.post("/ask")
def ask():
    if (err := require_user()):
        return err
    body = request.get_json(force=True)
    text, question = body["text"], body["question"]
    others = body.get("others", [])  # [{label, text}] other tellings of the same memory
    assumptions = pipeline.guard(text, question, others, llm.generate_json)
    flagged = [a["assumption"] for a in assumptions if a["status"] != "supported"]
    claims = pipeline.answer(text, question, flagged, llm.generate_json)
    return {"assumptions": assumptions, "claims": claims}


@app.post("/align")
def align():
    if (err := require_user()):
        return err
    body = request.get_json(force=True)
    return {"pairs": pipeline.pentimento(body["old"], body["new"], llm.generate_json, llm.embed)}


if __name__ == "__main__":
    app.run(port=int(os.environ.get("PORT", 5001)), debug=True)
