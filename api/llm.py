"""AI connector. Any OpenAI-compatible provider works.

Chat (answers, checks):  Groq by default    -> CHAT_BASE_URL / CHAT_API_KEY (or GROQ_API_KEY) / CHAT_MODEL
Embeddings (optional):   EMBED_BASE_URL / EMBED_API_KEY / EMBED_MODEL. Without them, Pentimento uses
                         local TF-IDF similarity (core.lexical_vectors) and needs no embedding API.
Every chat call uses temperature 0 and asks for one JSON object.
"""
import json
import os
import re
import time

from openai import APIStatusError, APITimeoutError, BadRequestError, OpenAI, RateLimitError

_clients = {}


def _env(*names, default=None):
    for n in names:
        v = os.environ.get(n, "").strip()
        if v:
            return v
    return default


def _client(kind: str) -> OpenAI:
    if kind not in _clients:
        if kind == "chat":
            base = _env("CHAT_BASE_URL", default="https://api.groq.com/openai/v1")
            key = _env("CHAT_API_KEY", "GROQ_API_KEY")
        else:
            base = _env("EMBED_BASE_URL", default="https://integrate.api.nvidia.com/v1")
            key = _env("EMBED_API_KEY")
        if not key:
            raise RuntimeError(f"No API key for {kind} - set it in api/.env")
        _clients[kind] = OpenAI(base_url=base, api_key=key, timeout=float(_env("AI_TIMEOUT", default="45")), max_retries=0)
    return _clients[kind]


class AIServiceError(RuntimeError):
    """A problem with the AI provider, described in words that are safe to show users."""


def model_name():
    return _env("CHAT_MODEL", default="openai/gpt-oss-120b")


def embed_model_name():
    return _env("EMBED_MODEL", default="nvidia/nemotron-3-embed-1b")


def _with_retry(call):
    """Retry rate limits (429), timeouts and server errors (5xx) with backoff: 2s, 4s, 8s."""
    delay = 2
    for attempt in range(4):
        try:
            return call()
        except RateLimitError:
            if attempt == 3:
                raise AIServiceError("The AI service is busy (rate limit reached). Wait a few seconds and try again.")
        except APITimeoutError:
            if attempt >= 1:
                raise AIServiceError("The AI model took too long to answer. Please try again.")
        except APIStatusError as e:
            if e.status_code < 500 or attempt == 3:
                raise
        time.sleep(delay)
        delay *= 2


def parse_json(raw: str) -> dict:
    """Pull one JSON object out of a model reply (handles <think> blocks and ``` fences)."""
    raw = re.sub(r"<think>.*?</think>", "", raw or "", flags=re.S)
    raw = re.sub(r"```(?:json)?", "", raw).strip()
    start, end = raw.find("{"), raw.rfind("}")
    if start == -1 or end <= start:
        raise ValueError("no JSON object in the reply")
    return json.loads(raw[start:end + 1])


def _chat_options(model: str) -> dict:
    opts = {"response_format": {"type": "json_object"}}
    effort = _env("CHAT_REASONING_EFFORT")
    if effort and "gpt-oss" in model:
        opts["extra_body"] = {"reasoning_effort": effort}
    if "qwen" in model:
        opts["extra_body"] = {"reasoning_format": "hidden"}
    return opts


def generate_json(system: str, prompt: str, model: str | None = None) -> dict:
    """Ask the chat model for JSON. Retries once if the reply does not parse."""
    model = model or model_name()
    messages = [{"role": "system", "content": system + "\nReply with exactly ONE JSON object. No prose, no markdown."},
                {"role": "user", "content": prompt}]
    opts = _chat_options(model)
    last_error = None
    for _ in range(2):
        def call():
            return _client("chat").chat.completions.create(model=model, messages=messages, temperature=0, max_tokens=4096, **opts)
        try:
            resp = _with_retry(call)
        except BadRequestError:
            opts.pop("response_format", None)  # provider/model without JSON mode: fall back to plain text
            resp = _with_retry(call)
        try:
            return parse_json(resp.choices[0].message.content)
        except (ValueError, json.JSONDecodeError) as e:
            last_error = e
    raise AIServiceError("The AI model gave an answer Echoes couldn't read. Please try again.") from last_error


def embed(texts, model: str | None = None):
    """Embeddings for Pentimento alignment. NVIDIA retrieval models need input_type."""
    texts = list(texts)
    name = model or embed_model_name()
    try:
        resp = _with_retry(lambda: _client("embed").embeddings.create(
            model=name, input=texts, encoding_format="float", extra_body={"input_type": "passage", "truncate": "END"}))
    except BadRequestError:
        resp = _with_retry(lambda: _client("embed").embeddings.create(model=name, input=texts, encoding_format="float"))
    return [d.embedding for d in resp.data]
