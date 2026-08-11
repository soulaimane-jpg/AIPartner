# syntax=docker/dockerfile:1.6
# ─────────────────────────────────────────────────────────────────────────────
# AI Partner — Next.js 15 on Google Cloud Run
#
# Multi-stage build:
#   1. deps     → install npm deps + generate Prisma client
#   2. builder  → run `next build` (emits .next/standalone)
#   3. runner   → minimal production image, runs `node server.js`
#
# Cloud Run injects $PORT (default 8080). The app listens on 0.0.0.0:$PORT.
# ─────────────────────────────────────────────────────────────────────────────

ARG NODE_VERSION=20-alpine

# 1) deps ─────────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS deps
WORKDIR /app

# libc6-compat needed by some Next.js native deps (sharp, etc.)
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json* ./

# npm ci honors the lockfile.
RUN npm ci --no-audit --no-fund

# 2) builder ──────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS builder
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Next.js build (and its workers) are memory-hungry; raise the V8 heap so the
# build doesn't OOM. Inherited by `next build` worker processes.
# Configurable so constrained/emulated local builds can cap the heap (Cloud
# Build has plenty of RAM, so the default stays high).
ARG NODE_MAX_OLD_SPACE=6144
ENV NODE_OPTIONS=--max-old-space-size=${NODE_MAX_OLD_SPACE}

# Build-time placeholders so `src/env.ts` (which hard-fails in production when
# DATABASE_URL/AUTH_SECRET are missing) passes during `next build`. These are
# NEVER used at runtime: they live only in the builder stage and are not copied
# into the final runner image. Cloud Run injects the real values from Secret
# Manager. Override with --build-arg if you ever need real build-time values.
ARG DATABASE_URL="postgresql://build:build@localhost:5432/build_placeholder"
ARG AUTH_SECRET="build_time_placeholder_secret_at_least_32_chars_long"
ENV DATABASE_URL=$DATABASE_URL
ENV AUTH_SECRET=$AUTH_SECRET

# Public site origin — NEXT_PUBLIC_* vars are inlined into the client bundle at
# build time, so this MUST be the real prod origin. If left as the localhost
# default, invite links, the Google Calendar OAuth redirect_uri, and passkey
# RP ID all break in production.
ARG NEXT_PUBLIC_APP_URL=https://aipartner.cloud
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build

# 3) runner ───────────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Server code reads NEXT_PUBLIC_APP_URL from process.env at RUNTIME (only the
# client bundle gets the build-time inlined value), so the runner stage needs
# it too — otherwise emails/links fall back to the localhost default.
ARG NEXT_PUBLIC_APP_URL=https://aipartner.cloud
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
# Cloud Run sets PORT; default to 8080 for local `docker run` parity.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache openssl \
  nss \
  freetype \
  freetype-dev \
  harfbuzz \
  ca-certificates \
  ttf-freefont \
  && addgroup --system --gid 1001 nodejs \
  && adduser  --system --uid 1001 nextjs

# Standalone Next.js output (self-contained node_modules + server.js).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static     ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public           ./public

USER nextjs
EXPOSE 8080

CMD ["node", "server.js"]
