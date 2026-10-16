# Echoes — The Living Memory Archive

> Preserve the memory. Question the meaning. Verify the truth. Respect the right to forget.

Echoes is a personal memory archive built so that AI can't quietly rewrite what you remember.
Research shows conversational AI can implant false memories (MIT Media Lab, 2024: a chatbot asking
leading questions produced over 3× more false memories than a control group). Echoes is designed
against that risk:

| Feature | What it does |
|---|---|
| **Truth Boundary** | Every AI answer is split into *source-backed* (quoting your exact words: code confirms the quote is in the memory, and a second AI check confirms it supports the answer), *interpretation*, and *unknown*. |
| **Assumption guard** | Leading questions ("Was Dad proud when the robot won?") are checked against what you actually wrote before anything is answered. |
| **Pentimento** | Retell a memory later; Echoes X-rays the two tellings and shows what was kept, changed, faded away, or appeared later. |
| **The Seal** | Every telling is canonicalised, SHA-256 hashed and hash-chained like git commits. A portrait generated from the hash makes tampering visible. |
| **Real forgetting** | Each memory has its own AES-GCM key. Forgetting deletes derived data and destroys the key (crypto-shredding); a tombstone remains. |
| **Theatre of Memory** | Besides the graph and timeline, the map can show your memories in a Renaissance memory theatre (after Giulio Camillo, 1530s). |

## Run it (demo mode, no accounts or keys needed)

```bash
cd web
npm install
npm run dev
```

Open **http://localhost:5173** and click **Explore the demo archive**. Demo mode stores everything in
your browser; it is clearly labelled in the app and is not secure cloud storage.

AI answers in demo mode come from simple, labelled word-matching rules. For real AI, run the API:

```bash
cd api
python -m venv .venv && .venv\Scripts\activate      # Windows   (macOS/Linux: source .venv/bin/activate)
pip install -r requirements.txt
copy .env.example .env                                  # macOS/Linux: cp .env.example .env
# put your Groq API key (free at console.groq.com) in api/.env
python app.py                                           # http://localhost:5001
```

…and set `VITE_API_URL=http://localhost:5001` in `web/.env` (copy `web/.env.example`), then restart `npm run dev`.

The API refuses AI requests unless it can check sign-ins (Supabase settings in `api/.env`). For local development without accounts, set `ECHOES_DEV_NO_AUTH=1`. Debug mode is off unless `FLASK_DEBUG=1`.

## Live mode (real accounts with Supabase)

1. Create a Supabase project. In **Authentication → Sign In / Providers → Email**, decide whether
   to keep "Confirm email" on (the app handles both).
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. It creates the tables and the
   Row Level Security policies that keep each user's data private.
3. In `web/.env` set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Project Settings → API).
4. In `api/.env` set the same two values as `SUPABASE_URL` / `SUPABASE_ANON_KEY`, so the AI server
   only answers signed-in users.
5. Add `http://localhost:5173/reset-password` to **Authentication → URL Configuration → Redirect URLs**
   so password reset emails work.

## Sample memories

**Settings → Data management → Load sample memories** (or the button on an empty dashboard) adds six
memories of Rahul Mehta, a fictional person born in 1947, to the signed-in archive. They go through the
normal create path, so each is encrypted with its own key and sealed. One of them, *The Little Circuit
That Changed Everything*, has a second, invented retelling so the X-ray and the assumption guard have
something to compare. Each Echo Room for a sample memory suggests its test questions, for example
"What prize did my circuit win?" or "What was the exact amount of my first salary?". The data lives in
`web/src/services/samples.ts`; the evidence labels (family-reported, first-person, written-note) are
example tags, not checked sources.

## Scripts

| Where | Command | What |
|---|---|---|
| web | `npm run dev` | Dev server on http://localhost:5173 |
| web | `npm run build` | Type-check, then production build into `web/dist` |
| web | `npm run typecheck` | TypeScript check only |
| web | `npm test` | Unit tests (seal, encryption, portraits, Truth Boundary rules, drift) |
| api | `python -m pytest -q` | API tests (quote verification, guard, alignment), no key needed |
| tools | `python tools/verify.py <export.json>` | Verify an exported archive's seals without Echoes (exit 0 intact, 1 failed or unreadable, 2 incomplete because some tellings were forgotten) |

## Architecture

```
web/  React 19 + TypeScript + Vite + Tailwind CSS 4 + React Router + React Flow + Lucide
  src/services/adapter.ts         one DataAdapter interface
  src/services/demoAdapter.ts     browser storage (demo mode)
  src/services/supabaseAdapter.ts Supabase Auth + Postgres (live mode)
  src/services/ai.ts              calls the API; labelled offline rules when it's unreachable
  src/lib/seal.ts                 canonical text, SHA-256, chain verification
  src/lib/vault.ts                per-memory AES-GCM (Web Crypto)
  src/lib/portrait.ts             hash-seeded portraits in 5 styles
api/  Flask + Groq (gpt-oss-120b), OpenAI-compatible (the only place the AI key lives)
  core.py      canonicalize, exact-quote spans, Hungarian claim alignment
  pipeline.py  extract / guard / answer + entailment check / pentimento
supabase/schema.sql   tables + Row Level Security
tools/verify.py       standalone seal checker
```

Every "source-backed" claim must quote the memory exactly: the API checks the quote with code,
runs a second entailment check, and the browser re-checks the quote again before showing it.

## Honest limits

- **Demo mode** is single-browser storage with a local password check. It is not secure authentication.
- **What is encrypted:** each telling's text, the facts and quotes extracted from it, and AI summaries (AES-GCM, one key per memory). Titles, tags, dates, themes and covers are stored unencrypted. Keys live in a separate, access-controlled table in the same database, so this is not end-to-end encryption: it mainly makes forgetting real. A future version should wrap keys with a key derived from the user's passphrase. Facts saved before this change stay readable as they were.
  by RLS). A future version should wrap each key with a key derived from the user's password, so the
  server never holds a usable key.
- **Forgetting** destroys the key in the live database, so the copy there becomes unreadable. It does
  not reach older database backups: a backup made before you forgot a memory contains both the key and
  the ciphertext, so the memory stays readable from that backup until the backup is deleted under the
  database provider's retention schedule. Text already sent to the AI provider follows that provider's
  retention policy. EU regulators still treat encrypted data as personal data, so this means
  "unreadable in the live database", not a legal guarantee of erasure.
- **A hash proves the text didn't change**, not that the memory is true. Text is normalised (Unicode NFC, single spaces) before hashing, so whitespace-only changes don't count. The chain is not anchored anywhere outside the database: someone with full database access could rewrite text and seals together. An exported bundle, checked with `tools/verify.py`, is the independent record.
- **Drafts and Echo Room conversations** are kept in memory only and disappear when you leave the page.
- **Account deletion** needs a server-side admin action that isn't included.
- Chat conversations are kept for the browser session only.
- Demo thumbnails were cropped from the project's own design mockups; new memories use their seal portrait or an uploaded image.

## Credits

React, Vite, Tailwind CSS, React Router, React Flow (@xyflow/react), Lucide, Supabase, Flask,
Groq (gpt-oss-120b), NumPy/SciPy. Hash portraits follow Perrig & Song, *Hash Visualization* (1999).
Research: Chan et al., *Conversational AI … Amplifies False Memories* (2024); Min et al., *FActScore* (2023);
Yu et al., *CREPE* (2023); Wardell et al., autobiographical memory consistency (2025).
