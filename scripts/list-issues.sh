#!/bin/bash

# List current issue worktrees and their status
# Usage: ./scripts/list-issues.sh

echo "📋 Current Issue Worktrees"
echo ""

# Check if any worktrees exist
if ! git worktree list | grep -q "vibestack-issue-"; then
    echo "   No issue worktrees found"
    echo ""
    echo "🚀 To start working on an issue:"
    echo "   ./scripts/start-issue.sh [ISSUE_NUMBER]"
    exit 0
fi

echo "🔧 Active Worktrees:"
git worktree list | grep "vibestack-issue-" | while read -r line; do
    # Extract issue number from worktree path
    ISSUE_NUM=$(echo "$line" | grep -o 'vibestack-issue-[0-9]\+' | grep -o '[0-9]\+')
    WORKTREE_PATH=$(echo "$line" | awk '{print $1}')
    BRANCH_NAME=$(echo "$line" | awk '{print $2}' | tr -d '[]')
    
    echo ""
    echo "  📁 Issue #${ISSUE_NUM} (${BRANCH_NAME})"
    echo "     Path: ${WORKTREE_PATH}"
    
    # Check if containers are running for this issue
    DB_PORT=$((5432 + ISSUE_NUM))
    WEB_PORT=$((5173 + ISSUE_NUM))
    SERVER_PORT=$((8787 + ISSUE_NUM))
    
    if docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -q ":${DB_PORT}->"; then
        echo "     Status: 🟢 Running"
        echo "     Web:    http://localhost:${WEB_PORT}"
        echo "     API:    http://localhost:${SERVER_PORT}"
        echo "     DB:     localhost:${DB_PORT}"
    else
        echo "     Status: 🔴 Stopped"
    fi
    
    # Check for uncommitted changes
    if [ -d "$WORKTREE_PATH" ]; then
        cd "$WORKTREE_PATH"
        if ! git diff --quiet || ! git diff --cached --quiet; then
            echo "     Changes: ⚠️  Uncommitted changes"
        else
            echo "     Changes: ✅ Clean"
        fi
        cd - > /dev/null
    fi
done

echo ""
echo "💡 Quick Commands:"
echo "   ./scripts/start-issue.sh [N]     # Start/resume issue work"  
echo "   ./scripts/finish-issue.sh [N]    # Cleanup after PR merge"
echo "   cd ./worktrees/issue-[N]        # Switch to issue worktree"
echo "   PR_NUMBER=[N] pnpm dev:local     # Start dev server for issue"