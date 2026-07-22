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
| **LLM** | OpenRouter (default `deepseek/deepseek-v4-flash`) — summaries + drill-down chat |
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

## How it works

```
RSS feeds (Punch, Vanguard, Premium Times, Channels, TechCabal, Techpoint,
Nairametrics, BusinessDay, Complete Sports, BBC, Al Jazeera, Guardian)
        │  NewsService — fetch, dedupe, keep last 36h
        ▼
OpenRouter LLM — SummarizeService — per-section spoken scripts, story
summaries, intro & sign-off (each section isolated; one failure can't sink the brief)
        ▼
Kokoro TTS — TtsService — one WAV with per-section time markers
        ▼
PostgreSQL — BriefStore — briefs + sections + stories, audio as bytea
        ▼
Next.js PWA — player with an "on-air" bar; "Ask" on any story chats with the
LLM grounded in that article's text
```

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
- **Automatic prompt caching.** DeepSeek caches identical prompt prefixes
  (cache reads at 0.1× input price). The stable editor/system prompt is sent
  first on every call, so the 6 section calls and multi-turn chats reuse it for free.

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
