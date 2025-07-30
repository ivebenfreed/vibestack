#\!/bin/bash
# Fix optional dependencies in worktree
# Usage: ./scripts/fix-worktree-optional-deps.sh [WORKTREE_PATH]

set -e

WORKTREE_PATH="$1"

if [ -z "$WORKTREE_PATH" ]; then
    echo "❌ Error: Worktree path is required"
    exit 1
fi

echo "🔧 Fixing optional dependencies in worktree: $WORKTREE_PATH"
cd "$WORKTREE_PATH"

# Remove node_modules and reinstall without optional deps
echo "1️⃣ Removing node_modules..."
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules

echo "2️⃣ Installing without optional dependencies..."
pnpm install --no-optional

echo "✅ Dependencies fixed\!"
