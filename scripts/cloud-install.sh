#!/usr/bin/env bash
set -euo pipefail
cd /workspace/B1ueRay
export npm_config_cache=/tmp/velora-npm
export DOCKER_CONFIG=/tmp/velora-docker
npm ci
npm run setup:env
npm run db:generate
if docker container inspect velora-postgres >/dev/null 2>&1; then
  docker start velora-postgres >/dev/null
  for attempt in $(seq 1 30); do
    if docker exec velora-postgres pg_isready -U velora -d velora >/dev/null; then
      break
    fi
    sleep 1
  done
else
  docker compose up -d --wait db redis
fi
npm run db:migrate
npm run db:seed
