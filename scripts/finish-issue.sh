#!/bin/bash

# Finish work on a GitHub issue and cleanup
# Usage: ./scripts/finish-issue.sh [ISSUE_NUMBER]

set -e

ISSUE_NUMBER="$1"

# Validate input
if [ -z "$ISSUE_NUMBER" ]; then
    echo "❌ Error: Issue number is required"
    echo ""
    echo "Usage: ./scripts/finish-issue.sh [ISSUE_NUMBER]"
    echo ""
    echo "Example:"
    echo "  ./scripts/finish-issue.sh 123"
    echo ""
    echo "This will:"
    echo "  1. Stop PR environment containers"
    echo "  2. Remove worktree ./worktrees/issue-123"
    echo "  3. Clean up generated config files"
    exit 1
fi

# Validate issue number is numeric
if ! [[ "$ISSUE_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "❌ Error: Issue number must be numeric"
    exit 1
fi

BRANCH_NAME="issue-${ISSUE_NUMBER}"
WORKTREE_PATH="./worktrees/issue-${ISSUE_NUMBER}"

echo "🧹 Finishing work on GitHub issue #${ISSUE_NUMBER}"
echo ""

# Check if we're currently in the worktree
CURRENT_DIR=$(pwd)
if [[ "$CURRENT_DIR" == *"vibestack-issue-${ISSUE_NUMBER}"* ]]; then
    echo "📂 You're currently in the issue worktree"
    echo "   Switching back to main worktree..."
    cd "$(dirname "$0")/.."
fi

# Check if worktree exists
if [ ! -d "$WORKTREE_PATH" ]; then
    echo "⚠️  Worktree not found: $WORKTREE_PATH"
    echo "   Nothing to clean up."
    exit 0
fi

# Cleanup PR environment
echo "1️⃣ Cleaning up PR environment..."
cd "$WORKTREE_PATH"
PR_NUMBER="$ISSUE_NUMBER" ./scripts/cleanup-pr-env.sh

# Go back to main worktree
cd "$(dirname "$0")/.."

echo ""
echo "2️⃣ Removing worktree..."
git worktree remove "$WORKTREE_PATH" --force

echo ""
echo "3️⃣ Checking branch status..."

# Check if branch exists locally
if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME"; then
    echo "   Local branch $BRANCH_NAME still exists"
    
    # Check if branch has been merged
    if git merge-base --is-ancestor "$BRANCH_NAME" HEAD 2>/dev/null; then
        echo "   Branch appears to be merged, safe to delete"
        read -p "   Delete local branch $BRANCH_NAME? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git branch -d "$BRANCH_NAME"
            echo "   ✅ Deleted local branch $BRANCH_NAME"
        fi
    else
        echo "   ⚠️  Branch may not be merged yet"
        echo "   Keeping local branch $BRANCH_NAME"
        echo "   You can delete it manually later with: git branch -D $BRANCH_NAME"
    fi
else
    echo "   No local branch to clean up"
fi

echo ""
echo "✅ Cleanup complete for issue #${ISSUE_NUMBER}!"
echo ""
echo "📊 Current worktrees:"
git worktree list
echo ""
echo "🎯 To work on another issue:"
echo "   ./scripts/start-issue.sh [ISSUE_NUMBER]"