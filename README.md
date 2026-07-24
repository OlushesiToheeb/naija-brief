# Naija Brief

A Nigeria-first morning news briefing that reads itself to you. Every morning it
pulls headlines from Nigerian and world sources across **politics, tech,
business, the stock market, sport and world news**, writes a spoken script with
an LLM (via OpenRouter), voices it with a local neural TTS (Kokoro — free, runs
on your machine), and serves it as an installable web app (PWA) where you can
play the briefing and ask follow-up questions about any story.

## Stack

A TypeScript monorepo (npm workspaces):

| Piece | Tech |
| --- | --- |
| **Frontend** | Next.js 16 (App Router, React 19) as an installable **PWA** |
| **Backend** | NestJS 11 REST API |
| **Storage** | PostgreSQL via TypeORM + migrations (briefs, sections, stories, audio as `bytea`, durable jobs) |
| **LLM** | OpenRouter (default `z-ai/glm-5.2`, swappable) — summaries + drill-down chat |
| **Voice** | `kokoro-js` — Kokoro-82M ONNX TTS, runs locally |
| **Schedule** | `@nestjs/schedule` cron — a fresh brief every morning |

```
apps/
  api/   → NestJS backend  (news ingestion, LLM, TTS, Postgres, cron)
  web/   → Next.js PWA      (player, on-air bar, per-story chat)
packages/
  shared/ → type-only contracts shared by both apps
```

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (or a `DATABASE_URL`)
- An OpenRouter API key — <https://openrouter.ai/keys>

## Setup

```bash
npm install
createdb naija_brief                  # or set DATABASE_URL / PG* vars in .env
cp .env.example .env                  # then paste your OPENROUTER_API_KEY
npm run migration:run -w apps/api     # create the schema (briefs, sections, stories, jobs)
```

> **Already have a database from an earlier build?** It was created by TypeORM
> auto-sync, which is now off by default. Give it the new `generation_jobs` table
> either by starting the API once with `DB_SYNC=1` (additive — leaves your data),
> or, since briefs are regenerated daily, reset for a clean migration baseline:
> `dropdb naija_brief && createdb naija_brief && npm run migration:run -w apps/api`.

Key `.env` values (see `.env.example` for all):

```
OPENROUTER_API_KEY=sk-or-...
PGDATABASE=naija_brief
API_PORT=3001
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Run

```bash
npm run dev        # starts the API (:3001) and the web app (:3000) together
```

Open <http://localhost:3000> and press **Generate today's brief**. The first run
downloads the ~90 MB Kokoro voice model; then fetching + summarizing + voicing
takes a few minutes. After that, a fresh brief is generated automatically every
morning at 6:00 Lagos time (`BRIEF_CRON`) while the API is running.

On a phone, open the site and choose **Add to Home Screen** to install it as an
app.

## How it works — the AI engineering

Two flows: **making** the brief overnight, and **listening** to it — including the
live "interrupt the voice and ask" loop.

### 1. Making the morning brief

A durable, Postgres-backed job runs the pipeline at 6:00 Lagos time (or on demand):

```
~20 RSS feeds        NewsService        fetch in parallel · strip HTML · dedupe by
(Nigerian + world) ─►                    normalized title · keep last 36h · each feed's
                                         failure isolated (recorded, never fatal)
      │
      ▼
SummarizeService ──► LLM (OpenRouter)    per section: a fenced prompt of candidate
                                         articles → JSON { spoken script, story picks },
                                         plus a separate intro & sign-off call
      │  the text brief is saved to Postgres first
      ▼
TtsService ────────► Kokoro-82M (local)  the whole brief → one MP3 with per-segment
                                         time markers (ffmpeg-compressed)
      │
      ▼
PostgreSQL           briefs · sections · stories · audio (bytea) · durable job rows
```

`generate` and `tts` are **separate durable jobs**: the LLM output is saved before
voicing, so a TTS failure retries only the audio and never re-pays for the model.

### 2. Listening, and interrupting to ask

The PWA streams the Kokoro MP3 and tracks position by the time markers. Tap **Ask** and:

1. The briefing **pauses**; the segment that was playing is remembered.
2. Your **browser's speech-to-text** (Web Speech API, on-device) transcribes your spoken question.
3. `POST /api/ask` → the **LLM** answers, grounded *only* in that segment — the section's
   stories and the script it just read (or a whole-brief overview during the intro/sign-off) —
   in 1–3 spoken sentences.
4. Your **browser's text-to-speech** reads the answer back instantly (no server audio round-trip).
5. Tap **Resume** and playback continues from the exact second it paused.

Two voices, on purpose: the **briefing** is Kokoro (server, pre-recorded, high quality);
the **live answer** is the browser's voice (instant, conversational).

### 3. "Tell me more" — per-story chat

Tap any headline to chat about that one story. `POST /api/chat` fetches the **full article**
from its link on demand (`ArticleService`) and grounds a deeper answer in the whole piece —
so "go deeper" pulls the real detail, not just the summary.

### The models, and how they're kept honest

| Job | Model / tech | Where |
| --- | --- | --- |
| Write scripts + answer questions | **LLM via OpenRouter** — default `z-ai/glm-5.2`, swappable | Cloud |
| Briefing voice | **Kokoro-82M** (local ONNX TTS) | API server |
| Transcribe your interrupt | **Web Speech API** — speech-to-text | Browser |
| Speak the interrupt answer | **Web Speech API** — text-to-speech | Browser |

- **Grounded, never freewheeling.** Every LLM call is given only the day's articles or the
  current segment and told to answer from that alone — not from its own memory.
- **Prompt-injection fenced.** All feed text sits inside `<<<ARTICLE>>>` / `<<<STORY>>>` markers
  the model is told never to obey, and our own markers are neutralized if they appear in feed
  text — so a booby-trapped headline can't hijack the output.
- **Cheap by design.** Reasoning tokens are disabled (`LLM_REASONING_EFFORT=none`, since the
  work is extractive) and the shared editor prompt is prompt-cached across the section calls.
  A day's brief costs roughly a cent or two.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run API + web together |
| `npm run dev:api` / `npm run dev:web` | Run one side |
| `npm run build` | Production build of both apps |
| `npm test` | Unit tests (API Jest + web Vitest) |
| `npm run test:e2e` | API end-to-end tests (needs Postgres) |
| `npm run migration:run -w apps/api` | Apply pending DB migrations |
| `npm run migration:generate -w apps/api` | Generate a migration from entity changes (diff vs an empty DB) |
| `npm run migration:revert -w apps/api` | Roll back the last migration |

## Useful env flags

| Flag | Purpose |
| --- | --- |
| `MOCK_LLM=1` | Build the brief from raw headlines without calling OpenRouter (no key needed) |
| `SKIP_TTS=1` | Skip audio generation (text-only brief, much faster) |
| `OPENROUTER_MODEL` | Any OpenRouter chat model id |
| `LLM_REASONING_EFFORT` | `none` (default) disables reasoning tokens — cheaper, avoids JSON truncation; `low`/`medium`/`default` to re-enable |
| `AUDIO_FORMAT` | `mp3` (default, universal), `opus` (smaller), or `wav` (uncompressed) |
| `AUDIO_BITRATE` | Audio bitrate, e.g. `64k` |
| `TTS_VOICE` | Kokoro voice: `af_heart`, `af_bella`, `bf_emma`, … |
| `BRIEF_CRON` | When the daily brief generates (Africa/Lagos) |
| `DB_SYNC=1` | Opt in to TypeORM schema auto-sync for throwaway local iteration (off by default — use migrations) |
| `THROTTLE_LIMIT` / `THROTTLE_TTL` | Global per-IP rate limit (default 120 req / 60 s) |

## Cost & caching

The app is built to stay cheap:

- **Shared brief.** The daily brief is generated once and served to everyone —
  LLM cost is fixed per day, not per user. Only the per-story chat scales with use.
- **Compressed audio.** Briefs are stored and streamed as MP3 (~64 kbps mono),
  roughly 8–12× smaller than raw WAV — far less DB storage and egress. Encoding
  uses a bundled `ffmpeg-static`; if it fails, the app keeps the WAV.
- **No reasoning-token waste.** Summarization/chat run with reasoning disabled
  (`LLM_REASONING_EFFORT=none`) — the work is extractive, so reasoning tokens are
  pure cost and also risk truncating the JSON.
- **Automatic prompt caching.** The default model (GLM-5.2) caches identical prompt
  prefixes at a fraction of the input price. The stable editor/system prompt is sent
  first on every call, so the section calls and multi-turn chats reuse it for free.

## Production hardening

- **Migrations, not auto-sync.** The schema is owned by TypeORM migrations
  (`npm run migration:run`); auto-sync is off unless you set `DB_SYNC=1`. On
  boot the API checks `GET /api/health` with a real `SELECT 1`, returning 503 if
  the database is unreachable.
- **Durable background jobs (Postgres, no Redis).** Generation runs as a
  persisted job in `generation_jobs`: a `generate` job fetches + summarizes +
  saves the text brief, then chains a separate `tts` job that voices it — so a
  TTS failure retries **only** the audio, never re-paying for the LLM. Jobs have
  bounded retries with exponential backoff, run one-at-a-time (single-flight),
  and any job a crash left mid-flight is recovered on the next boot. `POST
  /api/generate` enqueues; `GET /api/status` reflects the latest job.
- **Rate limiting.** Per-IP throttling protects the paid endpoints (`/chat`,
  `/ask`, `/generate`); `/health` and `/status` are exempt so status polling is
  never blocked. Behind a proxy the app trusts the first hop for real client IPs.
- **Graceful shutdown.** SIGTERM/SIGINT drain the cron, the retry sweep and any
  in-flight job cleanly; whatever doesn't finish in time is requeued on restart.
- The daily 6am job only fires while the API process is running. For a real
  daily habit, run the API on an always-on host.

## Deploy (Supabase + Render)

Three pieces: the **database** on Supabase, the **API + Kokoro voice** in a
container on Render, and the **web app**. The API must be a single always-on
instance — it owns the 6am cron and the job queue.

**1 · Database (Supabase).** Create a project, then copy
*Project Settings → Database → Connection string (URI)*. Prefer the **session
pooler** host: it's IPv4-friendly and keeps the long-lived connections a
persistent server wants.

**2 · API (Render).** Dashboard → **New → Blueprint** → point at this repo; it
reads [`render.yaml`](render.yaml). Then set the three secrets on the
`naija-brief-api` service:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Supabase URI from step 1 |
| `OPENROUTER_API_KEY` | your key from <https://openrouter.ai/keys> |
| `CORS_ORIGINS` | the web app's URL (fill in after step 3) |

`DB_SSL=1` is already set — managed Postgres requires TLS. **Migrations run
automatically on every boot** (they're idempotent), so the schema builds itself
on the first deploy.

**3 · Web app.** Set `NEXT_PUBLIC_API_URL` to the API's URL *before* the first
build — Next.js bakes it into the browser bundle. Then put that web URL into the
API's `CORS_ORIGINS` and redeploy the API.

**4 · Check it.** `curl https://<api>/api/health` should return
`{"status":"ok"}` (it does a real `SELECT 1`). Open the web app and press
**Generate today's brief** — the text lands in ~1 minute and the audio attaches a
few minutes later, on its own.

**Sizing.** Kokoro loads an ONNX voice model, so give the API ~2 GB RAM (Render
`standard`); 512 MB risks an OOM kill. The model is baked into the image, so a
cold container can speak immediately. Keep `numInstances: 1`.

**Cheaper option.** The web app is a static-ish PWA — deploying it to Cloudflare
Pages (free) instead of Render and deleting that service from `render.yaml`
leaves the API as the only paid piece.
