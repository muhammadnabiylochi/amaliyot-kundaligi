# Single-container image: Express API + built React client (served by the API in production).
# Build:  docker compose build      Run: docker compose up -d

# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY server/package*.json server/
RUN cd server && npm ci
COPY client/package*.json client/
RUN cd client && npm ci

COPY server server
COPY client client
RUN cd client && npm run build
RUN cd server && npx prisma generate && npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM node:20-bookworm-slim
# openssl: Prisma engine; fonts-dejavu-core: Unicode fonts for Uzbek text in PDF reports
RUN apt-get update && apt-get install -y --no-install-recommends openssl fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/server /app/server
COPY --from=build /app/client/dist /app/client/dist

WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=3001 \
    CLIENT_DIST=/app/client/dist
EXPOSE 3001
VOLUME ["/app/server/uploads"]

# Apply pending migrations, then start the API (which also serves the client)
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
