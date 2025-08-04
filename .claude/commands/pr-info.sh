#!/bin/bash

# Get git information
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "unknown")

# Detect if this is a PR worktree
PR_NUMBER=""
if [[ "$WORKTREE_PATH" =~ vibestack-issue-([0-9]+) ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
fi

echo "## Current Git Information"
echo "- Branch: $BRANCH_NAME"
echo "- Working directory: $(pwd)"

if [ -n "$PR_NUMBER" ]; then
    echo ""
    echo "## PR/Issue Information"
    echo "- PR/Issue Number: #$PR_NUMBER"
    echo "- Database: vibestack_dev_issue_${PR_NUMBER}"
    echo ""
    echo "### PR-specific ports:"
    echo "- Web: $((5170 + PR_NUMBER))"
    echo "- Server: $((8780 + PR_NUMBER))"
    echo "- Database: $((5440 + PR_NUMBER))"
    echo "- Proxy: $((4450 + PR_NUMBER))"
    
    # Try to get PR info from GitHub
    if command -v gh &> /dev/null; then
        echo ""
        echo "### GitHub PR Details:"
        gh pr view "$PR_NUMBER" --json title,state,author,createdAt 2>/dev/null | jq -r '"- Title: \(.title)\n- State: \(.state)\n- Author: \(.author.login)\n- Created: \(.createdAt)"' || echo "Unable to fetch PR details"
    fi
else
    echo ""
    echo "Not in a PR worktree - using default development environment"
fi