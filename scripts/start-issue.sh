#!/bin/bash

# Start work on a GitHub issue
# Usage: ./scripts/start-issue.sh [ISSUE_NUMBER]

set -e

ISSUE_NUMBER="$1"

# Validate input
if [ -z "$ISSUE_NUMBER" ]; then
    echo "❌ Error: Issue number is required"
    echo ""
    echo "Usage: ./scripts/start-issue.sh [ISSUE_NUMBER]"
    echo ""
    echo "Example:"
    echo "  ./scripts/start-issue.sh 123"
    echo ""
    echo "This will:"
    echo "  1. Create worktree ../vibestack-issue-123"
    echo "  2. Create branch issue-123"
    echo "  3. Setup PR environment with isolated database"
    echo "  4. Start development server"
    exit 1
fi

# Validate issue number is numeric
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: Issue number must be numeric"
    exit 1
fi

BRANCH_NAME="issue-${ISSUE_NUMBER}"
WORKTREE_PATH="../vibestack-issue-${ISSUE_NUMBER}"

echo "🚀 Starting work on GitHub issue #${ISSUE_NUMBER}"
echo ""

# Check if worktree already exists
if [ -d "$WORKTREE_PATH" ]; then
    echo "⚠️  Worktree already exists: $WORKTREE_PATH"
    echo "   Do you want to:"
    echo "   1) Remove existing and create fresh (r)"
    echo "   2) Switch to existing worktree (s)"
    echo "   3) Cancel (c)"
    read -p "   Choice (r/s/c): " -n 1 -r
    echo
    
    case $REPLY in
        [Rr])
            echo "🗑️  Removing existing worktree..."
            # Cleanup existing PR environment first
            cd "$WORKTREE_PATH" 2>/dev/null && PR_NUMBER="$ISSUE_NUMBER" ./scripts/cleanup-pr-env.sh 2>/dev/null || true
            cd "$(dirname "$0")/.."
            git worktree remove "$WORKTREE_PATH" --force
            ;;
        [Ss])
            echo "📂 Switching to existing worktree..."
            cd "$WORKTREE_PATH"
            echo ""
            echo "✅ Switched to existing worktree for issue #${ISSUE_NUMBER}"
            echo ""
            echo "🎯 Quick commands:"
            echo "   pnpm dev:local     # Start development server"
            echo "   pnpm forge:migrate:run:local  # Run migrations"
            echo ""
            echo "📱 Your environment:"
            echo "   Web:    http://localhost:$((5173 + ISSUE_NUMBER * 10))"
            echo "   API:    http://localhost:$((8787 + ISSUE_NUMBER * 10))"
            echo "   DB:     localhost:$((5432 + ISSUE_NUMBER * 10))"
            exit 0
            ;;
        *)
            echo "❌ Cancelled"
            exit 1
            ;;
    esac
fi

# Check if branch already exists remotely
if git ls-remote --heads origin "$BRANCH_NAME" | grep -q "$BRANCH_NAME"; then
    echo "⚠️  Branch $BRANCH_NAME already exists on remote"
    echo "   Creating worktree from existing remote branch..."
    git worktree add "$WORKTREE_PATH" "$BRANCH_NAME"
else
    echo "1️⃣ Creating new worktree and branch..."
    git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"
fi

# Switch to worktree
cd "$WORKTREE_PATH"

# Copy Claude configuration if it exists
echo ""
echo "1.5️⃣ Copying Claude configuration..."
if [ -d "../vibestack/.claude" ]; then
    cp -r ../vibestack/.claude ./.claude
    echo "   ✅ Claude config copied to worktree"
else
    echo "   ⚠️  No Claude config found to copy"
fi

echo ""
echo "2️⃣ Installing dependencies..."
echo "   🔄 Running pnpm install..."
pnpm install

echo ""
echo "2.5️⃣ Copying generated files..."
echo "   📁 Copying DataForge generated files from main repo..."
if [ -d "../vibestack/packages/dataforge/src/generated" ]; then
    cp -r ../vibestack/packages/dataforge/src/generated/* ./packages/dataforge/src/generated/ 2>/dev/null || true
    echo "   ✅ Generated files copied"
else
    echo "   ⚠️  No generated files found to copy"
fi

echo ""
echo "3️⃣ Setting up PR environment..."
if [ -f "./scripts/setup-pr-env.sh" ]; then
    PR_NUMBER="$ISSUE_NUMBER" ./scripts/setup-pr-env.sh
else
    echo "   ❌ Setup script not found in worktree"
    echo "   This might be because the scripts weren't committed when the worktree was created."
    echo "   Please run the setup manually or merge the latest changes."
    exit 1
fi

echo ""
echo "✅ Issue #${ISSUE_NUMBER} environment ready!"
echo ""
echo "📍 Current location: $(pwd)"
echo ""
echo "🎯 Next steps:"
echo "   • Start coding your solution"
echo "   • Run: pnpm dev:local"
echo "   • Visit: http://localhost:$((5173 + ISSUE_NUMBER * 10))"
echo "   • API: http://localhost:$((8787 + ISSUE_NUMBER * 10))"
echo ""
echo "📝 When ready for PR:"
echo "   git add . && git commit -m 'Your changes'"
echo "   git push -u origin $BRANCH_NAME"
echo "   # Create PR with title: [#${ISSUE_NUMBER}] Your description"
echo "   # Include 'Fixes #${ISSUE_NUMBER}' in PR description"
echo ""
echo "🧹 When done:"
echo "   ./scripts/finish-issue.sh ${ISSUE_NUMBER}"