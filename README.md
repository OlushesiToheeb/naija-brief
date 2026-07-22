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
| **Storage** | PostgreSQL via TypeORM (briefs, sections, stories, audio as `bytea`) |
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
createdb naija_brief            # or set DATABASE_URL / PG* vars in .env
cp .env.example .env            # then paste your OPENROUTER_API_KEY
```

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

## Useful env flags

| Flag | Purpose |
| --- | --- |
| `MOCK_LLM=1` | Build the brief from raw headlines without calling OpenRouter (no key needed) |
| `SKIP_TTS=1` | Skip audio generation (text-only brief, much faster) |
| `OPENROUTER_MODEL` | Any OpenRouter chat model id |
| `TTS_VOICE` | Kokoro voice: `af_heart`, `af_bella`, `bf_emma`, … |
| `BRIEF_CRON` | When the daily brief generates (Africa/Lagos) |
| `DB_SYNC=0` | Disable TypeORM schema auto-sync (use migrations in production) |

## Notes

- TypeORM `synchronize` is on by default for a smooth first run against a dev
  database. Switch to migrations (`DB_SYNC=0`) before running anything you can't
  afford to drop.
- The daily 6am job only fires while the API process is running. For a real
  daily habit, run the API on an always-on host.
