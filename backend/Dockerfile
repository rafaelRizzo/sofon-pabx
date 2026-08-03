# syntax=docker/dockerfile:1
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
# cache mount desligado por ora (buildkit cache preso travando disco na VPS, ver rsync.sh/docker builder prune)
# RUN --mount=type=cache,target=/root/.bun/install/cache \
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
COPY prisma.config.ts ./
# Placeholder só pra prisma.config.ts conseguir carregar durante o generate — a URL real de runtime vem do compose
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"
RUN bunx prisma generate
COPY . .
RUN bun run build

FROM oven/bun:1 AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
# cache mount desligado por ora (buildkit cache preso travando disco na VPS, ver rsync.sh/docker builder prune)
# RUN --mount=type=cache,target=/root/.bun/install/cache \
RUN bun install --frozen-lockfile --production

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production

# sox: conversão de áudio em src/utils/audio-convert.ts. Reload do dialplan vai via AMI
# (src/asterisk/ami-client.ts), não precisa mais do binário CLI do Asterisk aqui.
# cache mount desligado por ora (buildkit cache preso travando disco na VPS, ver rsync.sh/docker builder prune)
# RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
#     --mount=type=cache,target=/var/lib/apt,sharing=locked \
RUN apt-get update \
    && apt-get install -y --no-install-recommends sox libsox-fmt-mp3

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/generated ./generated
COPY --from=builder /app/prisma ./prisma
COPY package.json prisma.config.ts entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3333
EXPOSE 4573

ENTRYPOINT ["./entrypoint.sh"]
