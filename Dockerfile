FROM node:24-bookworm-slim AS tools
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm --mount=type=secret,id=registry_ca if [ -s /run/secrets/registry_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/registry_ca npm ci --fetch-timeout=60000 --fetch-retries=1 --loglevel=http; else npm ci --fetch-timeout=60000 --fetch-retries=1; fi
COPY --chown=node:node . .
RUN mkdir -p .storage && chown node:node /app && chown -R node:node .storage public && DATABASE_URL=postgresql://build:build@localhost:5432/build npm run db:generate
USER node

FROM tools AS builder
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build BETTER_AUTH_SECRET=build-only-placeholder-32-characters MEDIA_SIGNING_SECRET=build-only-placeholder-32-characters BETTER_AUTH_URL=http://localhost:3000 npm run build

FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir .storage && chown node:node .storage
USER node
EXPOSE 3000
CMD ["node","server.js"]
