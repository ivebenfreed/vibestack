#!/bin/bash

echo "## Development Environment Status"
echo ""

# Check git status
echo "### Git Status"
echo "Branch: $(git branch --show-current)"
echo ""

# Check tmux sessions
echo "### Active tmux Sessions"
tmux ls 2>/dev/null | grep -E "vibestack-" || echo "No active vibestack tmux sessions"
echo ""

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

# Check if dev servers are running
echo "### Development Servers"
ISSUE_NUMBER=$(detect_issue_number)
if [ "$ISSUE_NUMBER" != "0" ]; then
    SESSION_NAME="vibestack-dev-issue-$ISSUE_NUMBER"
else
    SESSION_NAME="vibestack-dev-main"
fi

if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo "✅ Development servers are running in $SESSION_NAME session"
    echo "   Use './scripts/bg-logs.sh $SESSION_NAME' to view logs"
else
    echo "❌ Development servers are not running"
    echo "   Use '/start' or './scripts/dev-start.sh' to start them"
fi
echo ""

# Calculate and show ports
OFFSET=$((ISSUE_NUMBER * 10))
WEB_PORT=$((5173 + OFFSET))
SERVER_PORT=$((8787 + OFFSET))
DB_PORT=$((5432 + OFFSET))
PROXY_PORT=$((4444 + OFFSET))

echo "### Environment Ports"
echo "- Web app: $WEB_PORT"
echo "- API server: $SERVER_PORT"
echo "- Database: $DB_PORT"
echo "- Proxy: $PROXY_PORT"

# Check if in PR worktree
if [ "$ISSUE_NUMBER" != "0" ]; then
    echo ""
    echo "### Issue/PR Environment"
    echo "You are in Issue/PR #${ISSUE_NUMBER} environment"
fi