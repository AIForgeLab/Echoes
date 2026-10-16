"""Thin wrapper around the Gemini API. Every call uses temperature 0 and JSON output."""
import json
import os
import re

from google import genai
from google.genai import types

_client = None


def client():
    global _client
    if _client is None:
        key = os.environ.get("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is missing - put it in api/.env")
        _client = genai.Client(api_key=key)
    return _client


def model_name():
    return os.environ.get("GEMINI_MODEL", "gemini-2.5-flash")


def generate_json(system: str, prompt: str) -> dict:
    """Ask the model for JSON. Retries once if the output does not parse."""
    last_error = None
    for _ in range(2):
        resp = client().models.generate_content(
            model=model_name(),
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=system,
                temperature=0,
                response_mime_type="application/json",
            ),
        )
        raw = (resp.text or "").strip()
        raw = re.sub(r"^```(?:json)?|```$", "", raw).strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            last_error = e
    raise RuntimeError(f"Model did not return valid JSON: {last_error}")


def embed(texts):
    resp = client().models.embed_content(
        model=os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001"),
        contents=list(texts),
    )
    return [e.values for e in resp.embeddings]
