# syntax=docker/dockerfile:1.7
# Build and runtime are separated so the published image carries no sources, no toolchain and no
# dev dependencies. Every stage starts from the same pinned base, so one bump moves all of them.
FROM node:22-alpine AS base
WORKDIR /app
# @cosmic-arcana/sdk is installed straight from its repository, which npm can only do with git.
RUN apk add --no-cache git

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS build
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
# The browser connects to this address, and Next inlines NEXT_PUBLIC_* values into the bundle at
# build time, so it cannot be changed when the container starts. The default suits a stack where
# tarot-service-api is published on the same machine as the browser; build with --build-arg for
# any other place.
ARG NEXT_PUBLIC_TAROT_WS_URL=ws://localhost:3004/live
ENV NEXT_PUBLIC_TAROT_WS_URL=$NEXT_PUBLIC_TAROT_WS_URL \
    NEXT_OUTPUT=standalone
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    # Docker sets HOSTNAME to the container id, which would make the server listen on that one
    # interface only and fail the health check on 127.0.0.1.
    HOSTNAME=0.0.0.0
WORKDIR /app
# The standalone output carries the server, the few node_modules it uses, the config (and with it
# the security headers) and the proxy. Static assets and public files are served from beside it.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
