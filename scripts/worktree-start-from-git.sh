#!/bin/bash

# worktree-start-from-git.sh - Start worktree using git-tracked container
# Usage: ./scripts/worktree-start-from-git.sh <issue-number>

set -euo pipefail

ISSUE_NUMBER="$1"
CONTAINER_NAME="vibestack-issue-${ISSUE_NUMBER}"

echo "🚀 Starting worktree container for Issue #${ISSUE_NUMBER} from git-tracked image..."

# Calculate external ports
EXTERNAL_WEB_PORT=$((6000 + ISSUE_NUMBER))
EXTERNAL_API_PORT=$((6100 + ISSUE_NUMBER))
EXTERNAL_DB_PORT=$((6400 + ISSUE_NUMBER))

# Check if git-tracked container image exists
if ! docker images vibestack:git-main -q | grep -q .; then
    echo "📥 Git-tracked container not found, importing..."
    ./scripts/import-container-from-git.sh
fi

# Stop existing container if running
if docker ps -q --filter "name=$CONTAINER_NAME" | grep -q .; then
    echo "🛑 Stopping existing container..."
    docker stop "$CONTAINER_NAME"
    docker rm "$CONTAINER_NAME"
fi

echo "🎯 Starting container with ports ${EXTERNAL_WEB_PORT}, ${EXTERNAL_API_PORT}, ${EXTERNAL_DB_PORT}..."

# Start container from git-tracked image
docker run -d \
  --name "$CONTAINER_NAME" \
  -p "${EXTERNAL_WEB_PORT}:5173" \
  -p "${EXTERNAL_API_PORT}:8787" \
  -p "${EXTERNAL_DB_PORT}:5432" \
  vibestack:git-main \
  /bin/bash -c "
    # Start PostgreSQL
    su - postgres -c '/usr/lib/postgresql/*/bin/postgres -D /var/lib/postgresql/data' &
    
    # Wait for PostgreSQL to be ready
    while ! pg_isready -h localhost -p 5432; do sleep 1; done
    
    # Start web and API servers
    cd /app && pnpm dev
  "

echo "✅ Container ready! Access at:"
echo "   🌐 Web: http://localhost:${EXTERNAL_WEB_PORT}"
echo "   🔧 API: http://localhost:${EXTERNAL_API_PORT}" 
echo "   💾 DB:  localhost:${EXTERNAL_DB_PORT}"
echo ""
echo "🔍 Container logs:"
echo "  docker logs -f $CONTAINER_NAME"
echo ""
echo "🛑 Stop container:"
echo "  docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"