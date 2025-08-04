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

# Check if dev servers are running
echo "### Development Servers"
if tmux has-session -t vibestack-dev 2>/dev/null; then
    echo "✅ Development servers are running in vibestack-dev session"
    echo "   Use './scripts/bg-logs.sh vibestack-dev' to view logs"
else
    echo "❌ Development servers are not running"
    echo "   Use '/start' or './scripts/dev-start.sh' to start them"
fi
echo ""

# Check ports
echo "### Environment Ports"
echo "- Web app: ${WEB_PORT:-5173}"
echo "- API server: ${SERVER_PORT:-8787}"
echo "- Database: ${DB_PORT:-5432}"
echo "- Proxy: ${PROXY_PORT:-4444}"

# Check if in PR worktree
if [[ $(pwd) =~ vibestack-issue-([0-9]+) ]]; then
    PR_NUM="${BASH_REMATCH[1]}"
    echo ""
    echo "### PR Environment"
    echo "You are in PR #${PR_NUM} worktree"
fi