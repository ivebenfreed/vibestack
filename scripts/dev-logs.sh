#!/bin/bash

# dev-logs.sh - Quick access to dev server logs
# Usage: ./scripts/dev-logs.sh [lines]
# Example: ./scripts/dev-logs.sh 100
#          ./scripts/dev-logs.sh     # Default 50 lines

set -euo pipefail

# Function to detect issue number from branch/directory
detect_issue_number() {
    # 1. Environment variable (manual override)
    if [ -n "${PR_NUMBER:-}" ]; then
        echo "$PR_NUMBER"
        return
    fi
    
    # 2. Git branch name (issue-123, feature-456, pr-789)
    if command -v git &> /dev/null; then
        local branch=$(git branch --show-current 2>/dev/null || true)
        if [[ "$branch" =~ (issue-|feature-|pr-)([0-9]+) ]]; then
            echo "${BASH_REMATCH[2]}"
            return
        fi
    fi
    
    # 3. Working directory name (worktrees/issue-123)
    local cwd=$(pwd)
    if [[ "$cwd" =~ /issue-([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    
    # Default to 0 (main development)
    echo "0"
}

# Calculate session name based on issue number
ISSUE_NUMBER=$(detect_issue_number)
if [ "$ISSUE_NUMBER" != "0" ]; then
    SESSION_NAME="vibestack-dev-issue-$ISSUE_NUMBER"
else
    SESSION_NAME="vibestack-dev-main"
fi

LINES="${1:-50}"

echo "📄 Development server logs (last $LINES lines)"
echo "Session: $SESSION_NAME"
echo ""

# Use the bg-logs.sh script to get logs from the dev session
./scripts/bg-logs.sh "$SESSION_NAME" "$LINES"