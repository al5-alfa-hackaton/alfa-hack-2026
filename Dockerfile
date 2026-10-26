# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS base

# Optional trusted CA for environments with a TLS-inspecting package proxy.
# BuildKit secrets are mounted only during the RUN and are not stored in the image.
RUN --mount=type=secret,id=extra_ca \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm install --global pnpm@11.25.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY projects/frontend/package.json ./projects/frontend/package.json
COPY projects/backend/package.json ./projects/backend/package.json
COPY packages/api-client/package.json ./packages/api-client/package.json
COPY packages/agent/package.json ./packages/agent/package.json
RUN --mount=type=secret,id=extra_ca \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY projects ./projects
COPY packages ./packages
RUN pnpm --filter @alfa/agent build


# Production image (Coolify): `docker build --target prod .`
FROM base AS prod
# Nitro bakes the /api proxy target into the frontend bundle at build time.
ARG API_PROXY_TARGET=http://backend:3001
ENV API_PROXY_TARGET=$API_PROXY_TARGET
RUN pnpm build
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@alfa/backend", "start"]

# Default target keeps local `docker compose` on the dev servers.
FROM base AS dev
CMD ["pnpm", "dev"]
