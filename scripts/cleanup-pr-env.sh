#!/bin/bash

# Cleanup PR environment
# Usage: PR_NUMBER=123 ./scripts/cleanup-pr-env.sh

set -e

PR_NUMBER=${PR_NUMBER:-$(git rev-parse --abbrev-ref HEAD | grep -o '[0-9]\+' | head -1)}

echo "🧹 Cleaning up PR environment..."
echo "   PR Number: ${PR_NUMBER:-"main"}"

if [ -n "$PR_NUMBER" ] && [ "$PR_NUMBER" != "0" ]; then
    # Stop PR-specific containers
    if [ -f "docker-compose.pr-${PR_NUMBER}.yml" ]; then
        echo "   Stopping PR-specific containers and removing volumes..."
        docker compose -f docker-compose.pr-${PR_NUMBER}.yml down -v
        
        echo "   Removing PR-specific docker-compose file..."
        rm docker-compose.pr-${PR_NUMBER}.yml
    else
        echo "   No PR-specific docker-compose file found"
        
        # Try to clean up containers directly if compose file is missing
        echo "   Checking for orphaned PR containers..."
        
        # Stop and remove containers
        docker ps -a --format "{{.Names}}" | grep -E "vibestack-(postgres|neon-proxy)-${PR_NUMBER}" | while read container; do
            echo "   Stopping container: $container"
            docker stop "$container" 2>/dev/null || true
            docker rm "$container" 2>/dev/null || true
        done
        
        # Remove volumes
        docker volume ls --format "{{.Name}}" | grep -E "(issue-${PR_NUMBER}|pr.*${PR_NUMBER})" | while read volume; do
            echo "   Removing volume: $volume"
            docker volume rm "$volume" 2>/dev/null || true
        done
    fi
    
    # Clean up generated configs
    echo "   Cleaning up generated config files..."
    rm -f apps/server/wrangler.pr-${PR_NUMBER}.toml
    rm -f apps/web/vite.pr-${PR_NUMBER}.config.js
    rm -f apps/web/.env.pr-${PR_NUMBER}
else
    # Stop default containers
    echo "   Stopping default containers..."
    docker-compose down
fi

echo "✅ Cleanup complete!"