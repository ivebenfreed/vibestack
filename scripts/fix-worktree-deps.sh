#!/bin/bash

# Fix dependency issues in worktrees
# Usage: ./scripts/fix-worktree-deps.sh [WORKTREE_PATH]

set -e

WORKTREE_PATH="$1"

if [ -z "$WORKTREE_PATH" ]; then
    echo "❌ Error: Worktree path is required"
    echo ""
    echo "Usage: ./scripts/fix-worktree-deps.sh [WORKTREE_PATH]"
    echo ""
    echo "Example:"
    echo "  ./scripts/fix-worktree-deps.sh ../vibestack-issue-1"
    exit 1
fi

if [ ! -d "$WORKTREE_PATH" ]; then
    echo "❌ Error: Worktree path does not exist: $WORKTREE_PATH"
    exit 1
fi

echo "🔧 Fixing dependencies in worktree: $WORKTREE_PATH"
echo ""

# Remove existing node_modules and pnpm-lock.yaml
echo "1️⃣ Cleaning existing dependencies..."
rm -rf "$WORKTREE_PATH/node_modules"
rm -rf "$WORKTREE_PATH/packages/*/node_modules"
rm -rf "$WORKTREE_PATH/apps/*/node_modules"
rm -f "$WORKTREE_PATH/pnpm-lock.yaml"

# Copy pnpm-lock.yaml from main repo
echo "2️⃣ Copying lockfile from main repository..."
cp pnpm-lock.yaml "$WORKTREE_PATH/"

# Install dependencies fresh
echo "3️⃣ Installing dependencies..."
cd "$WORKTREE_PATH"
pnpm install --force

# Copy generated files
echo "4️⃣ Copying generated files..."
if [ -d "../vibestack/packages/dataforge/src/generated" ]; then
    mkdir -p packages/dataforge/src/generated
    cp -r ../vibestack/packages/dataforge/src/generated/* packages/dataforge/src/generated/
    echo "   ✅ Generated files copied"
fi

# Build dataforge to verify
echo "5️⃣ Testing dataforge build..."
pnpm --filter @repo/dataforge build

echo ""
echo "✅ Dependencies fixed successfully!"
echo ""
echo "You can now run development commands in the worktree:"
echo "  cd $WORKTREE_PATH"
echo "  pnpm dev:local"