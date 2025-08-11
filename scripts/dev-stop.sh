#!/bin/bash

# dev-stop.sh - Stop development servers and database monitor
# Usage: ./scripts/dev-stop.sh

set -euo pipefail

# Function to detect issue number
detect_issue_number() {
    if [ -n "${PR_NUMBER:-}" ]; then
        echo "$PR_NUMBER"
        return
    fi
    
    if command -v git &> /dev/null; then
        local branch=$(git branch --show-current 2>/dev/null || true)
        if [[ "$branch" =~ (issue-|feature-|pr-)([0-9]+) ]]; then
            echo "${BASH_REMATCH[2]}"
            return
        fi
    fi
    
    local cwd=$(pwd)
    if [[ "$cwd" =~ /issue-([0-9]+) ]]; then
        echo "${BASH_REMATCH[1]}"
        return
    fi
    
    echo "0"
}

ISSUE_NUMBER=$(detect_issue_number)

# Determine session names
if [ "$ISSUE_NUMBER" != "0" ]; then
    DEV_SESSION="vibestack-dev-issue-$ISSUE_NUMBER"
    MONITOR_SESSION="db-monitor-issue-$ISSUE_NUMBER"
else
    DEV_SESSION="vibestack-dev-main"
    MONITOR_SESSION="db-monitor-main"
fi

echo "Stopping development environment..."

# Stop dev servers
if tmux has-session -t "$DEV_SESSION" 2>/dev/null; then
    echo "  Stopping dev servers ($DEV_SESSION)..."
    ./scripts/bg-stop.sh "$DEV_SESSION"
else
    echo "  Dev servers not running"
fi

# Stop database monitor
if tmux has-session -t "$MONITOR_SESSION" 2>/dev/null; then
    echo "  Stopping database monitor ($MONITOR_SESSION)..."
    ./scripts/bg-stop.sh "$MONITOR_SESSION"
else
    echo "  Database monitor not running"
fi

echo ""
echo "✅ Development environment stopped"