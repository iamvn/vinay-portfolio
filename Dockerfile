# syntax=docker/dockerfile:1
# Portfolio site + admin in one container. The database is a SQLite file on a volume (/data) by default,
# or your Turso database when DATABASE_URL is a libsql:// URL. See "Run with Docker" in README.md.

# ---------- dependencies (also generates the Prisma client: "postinstall") ----------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
COPY lib/db-config.ts ./lib/db-config.ts
RUN npm ci

# ---------- build ----------
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Only so the build can load its modules: nothing is read from or written to this database.
RUN DATABASE_URL=file:/tmp/build-only.db npm run build

# ---------- run ----------
FROM node:22-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL=file:/data/portfolio.db
# node_modules includes tsx and prisma: the start script uses them to set up the database.
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /data /app/prisma/sites && chown -R node:node /data /app/prisma/sites && chmod +x docker/entrypoint.sh
USER node
EXPOSE 3000
# /data: the main database (when DATABASE_URL is a file) · /app/prisma/sites: other sites' databases (multi-site, local)
VOLUME ["/data", "/app/prisma/sites"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["docker/entrypoint.sh"]
CMD ["npx", "next", "start"]
