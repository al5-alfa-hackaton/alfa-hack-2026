# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim

# Optional trusted CA for environments with a TLS-inspecting package proxy.
# BuildKit secrets are mounted only during the RUN and are not stored in the image.
RUN --mount=type=secret,id=extra_ca \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    npm install --global pnpm@11.25.0
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY projects/frontend/package.json ./projects/frontend/package.json
COPY projects/backend/package.json ./projects/backend/package.json
RUN --mount=type=secret,id=extra_ca \
    if [ -f /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY projects ./projects

CMD ["pnpm", "dev"]
