#!/bin/bash

# worktree-start.sh - Start container for specific worktree issue
# Usage: ./scripts/worktree-start.sh <issue-number>

set -euo pipefail

ISSUE_NUMBER="$1"
CONTAINER_NAME="vibestack-issue-${ISSUE_NUMBER}"

echo "🚀 Starting worktree container for Issue #${ISSUE_NUMBER}..."

# Calculate external ports
EXTERNAL_WEB_PORT=$((6000 + ISSUE_NUMBER))
EXTERNAL_API_PORT=$((6100 + ISSUE_NUMBER))
EXTERNAL_DB_PORT=$((6400 + ISSUE_NUMBER))

echo "📋 Copying database from git-tracked live data..."

# Create container volume from git-tracked postgres data
docker volume create "vibestack-db-issue-${ISSUE_NUMBER}" >/dev/null 2>&1 || true

# Copy git-tracked live postgres data to container volume
docker run --rm \
  -v "${PWD}/data/postgres-live:/source:ro" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/target" \
  alpine:latest \
  sh -c "cp -a /source/. /target/"

echo "🎯 Starting container with ports ${EXTERNAL_WEB_PORT}, ${EXTERNAL_API_PORT}, ${EXTERNAL_DB_PORT}..."

# Start container with git-synced database  
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${EXTERNAL_WEB_PORT}:5173" \
  -p "${EXTERNAL_API_PORT}:8787" \
  -p "${EXTERNAL_DB_PORT}:5432" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/var/lib/postgresql/data" \
  -v "${PWD}:/app" \
  -w /app \
  --env-file .env.local \
  node:18-slim \
  /bin/bash -c "
    apt-get update && apt-get install -y postgresql-14 supervisor && \
    service postgresql start && \
    npm install -g pnpm && \
    pnpm install && \
    pnpm dev
  "

echo "✅ Container ready! Access at:"
echo "   🌐 Web: http://localhost:${EXTERNAL_WEB_PORT}"
echo "   🔧 API: http://localhost:${EXTERNAL_API_PORT}"
echo "   💾 DB:  localhost:${EXTERNAL_DB_PORT}"