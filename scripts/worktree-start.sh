#!/bin/bash

# worktree-start.sh - Start container for specific worktree issue with secure secrets
# Usage: ./scripts/worktree-start.sh <issue-number>

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

ISSUE_NUMBER="$1"
CONTAINER_NAME="vibestack-issue-${ISSUE_NUMBER}"

echo "🚀 Starting worktree container for Issue #${ISSUE_NUMBER}..."

# Setup secure secrets first
echo "🔐 Setting up secure secrets..."
if ! "${SCRIPT_DIR}/setup-master-password.sh"; then
    echo "❌ Failed to setup secure secrets"
    exit 1
fi

# Calculate external ports
EXTERNAL_WEB_PORT=$((6000 + ISSUE_NUMBER))
EXTERNAL_API_PORT=$((6100 + ISSUE_NUMBER))
EXTERNAL_DB_PORT=$((6400 + ISSUE_NUMBER))

echo "📋 Preparing database from git-tracked SQL dump..."

# Create container volume for database
docker volume create "vibestack-db-issue-${ISSUE_NUMBER}" >/dev/null 2>&1 || true

echo "🎯 Starting container with ports ${EXTERNAL_WEB_PORT}, ${EXTERNAL_API_PORT}, ${EXTERNAL_DB_PORT}..."

# Pass master password to container via environment
MASTER_PASSWORD=""
if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
    MASTER_PASSWORD=$(grep "^VIBESTACK_MASTER_PASSWORD=" "${PROJECT_ROOT}/.env.local" | cut -d'=' -f2- || true)
fi

# Start container with git-synced database and secure secrets  
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${EXTERNAL_WEB_PORT}:5173" \
  -p "${EXTERNAL_API_PORT}:8787" \
  -p "${EXTERNAL_DB_PORT}:5432" \
  -v "vibestack-db-issue-${ISSUE_NUMBER}:/var/lib/postgresql/data" \
  -v "${PWD}:/app" \
  -w /app \
  --env-file .env.local \
  -e "VIBESTACK_MASTER_PASSWORD=${MASTER_PASSWORD}" \
  node:18-slim \
  /bin/bash -c "
    apt-get update && apt-get install -y postgresql-14 supervisor && \
    service postgresql start && \
    
    # Wait for PostgreSQL to be ready
    until pg_isready -h localhost -p 5432; do
      echo 'Waiting for PostgreSQL to be ready...'
      sleep 2
    done
    
    # Initialize database from SQL dump
    echo '📊 Restoring database from SQL dump...'
    createdb vibestack_dev || echo 'Database already exists'
    if [[ -f /app/data/database-seed.sql ]]; then
      psql vibestack_dev < /app/data/database-seed.sql
      echo '✅ Database restored from SQL dump'
    else
      echo '⚠️ No SQL dump found, using empty database'
    fi
    
    # Load encrypted secrets into environment
    echo '🔐 Loading encrypted secrets...'
    source /app/scripts/load-secrets.sh --source || echo 'Warning: Could not load secrets'
    
    npm install -g pnpm && \
    pnpm install && \
    pnpm dev
  "

echo "✅ Container ready! Access at:"
echo "   🌐 Web: http://localhost:${EXTERNAL_WEB_PORT}"
echo "   🔧 API: http://localhost:${EXTERNAL_API_PORT}"
echo "   💾 DB:  localhost:${EXTERNAL_DB_PORT}"