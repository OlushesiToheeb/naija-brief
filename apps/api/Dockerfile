# syntax=docker/dockerfile:1
#
# The Naija Brief API — NestJS + the local Kokoro voice.
# Build from the REPO ROOT (this is a monorepo):
#   docker build -f apps/api/Dockerfile -t naija-brief-api .
#
# Debian slim (not alpine): the voice stack ships prebuilt binaries that expect
# glibc, and ffmpeg arrives through the bundled ffmpeg-static package.

# ── build ───────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Manifests first, so the dependency layer caches independently of source edits.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

# The shared package is type-only and ships raw TypeScript, so the API build
# just needs it on disk.
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build --workspace apps/api

# Everything the server needs at runtime lives in "dependencies".
RUN npm prune --omit=dev

# ── run ─────────────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
ENV NODE_ENV=production
# Keep the model cache inside the image so a fresh container can speak
# immediately — container disks don't survive a redeploy.
ENV HF_HOME=/app/.cache/huggingface
ENV TRANSFORMERS_CACHE=/app/.cache/huggingface
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Best-effort: bake the ~90MB Kokoro voice into the image. If the download is
# unavailable at build time the image still ships and the model is fetched on
# first use instead — slower first brief, but never a failed build.
RUN node -e "import('kokoro-js').then((m) => m.KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'cpu' })).then(() => console.log('kokoro model baked in')).catch((e) => console.warn('kokoro prewarm skipped:', e.message))" || true

WORKDIR /app/apps/api

# Render (and most hosts) inject PORT; main.ts honours it.
EXPOSE 3001

# Migrations are idempotent — already-applied ones are skipped — so running them
# on boot keeps the schema in step with the image without a separate release
# phase. Run exactly ONE instance: the cron and job queue assume single-flight.
CMD ["sh", "-c", "npm run migration:run:prod && node dist/main"]
