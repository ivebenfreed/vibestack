#!/bin/bash
# Sync All Development Environments

set -e

echo "🔄 Syncing All Development Environments"
echo "======================================"

# Function to sync an environment if it exists
sync_env() {
    local env_name="$1"
    local env_path="environments/$env_name"
    
    if [ -f "$env_path/sync.sh" ]; then
        echo ""
        echo "🔄 Syncing $env_name environment..."
        echo "--------------------------------"
        cd "$env_path"
        ./sync.sh
        cd - > /dev/null
    else
        echo "⏭️  Skipping $env_name (not configured)"
    fi
}

# Navigate to project root
cd "$(dirname "$0")/.."

echo "📥 Pulling latest changes to main environment..."
git fetch origin
git pull origin staging

echo "📦 Installing/updating main environment dependencies..."
pnpm install

echo "🗄️  Syncing main environment database..."
if command -v ./scripts/sync-remote-to-local.sh >/dev/null 2>&1; then
    ./scripts/sync-remote-to-local.sh
else
    echo "⚠️  Database sync script not found - skipping main database sync"
fi

# Sync containerized environments
sync_env "dev-1"
sync_env "dev-2"  
sync_env "dev-3"

echo ""
echo "✅ All environment sync complete!"
echo ""
echo "Available environments:"
echo "  • Main (root) - Staging environment (ports 5173, 8787)"
echo "  • dev-1/      - Container 1 (ports 5175, 8789)"
echo "  • dev-2/      - Container 2 (not configured)"
echo "  • dev-3/      - Container 3 (not configured)"