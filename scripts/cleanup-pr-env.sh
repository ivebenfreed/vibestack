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
        echo "   Stopping PR-specific containers..."
        docker-compose -f docker-compose.pr-${PR_NUMBER}.yml down
        
        echo "   Removing PR-specific docker-compose file..."
        rm docker-compose.pr-${PR_NUMBER}.yml
    else
        echo "   No PR-specific containers found"
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