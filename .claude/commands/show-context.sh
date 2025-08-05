#!/bin/bash

# This script shows the same context that the SessionStart hook adds

# Get environment information
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
IS_WORKTREE=$(git rev-parse --is-inside-work-tree 2>/dev/null || echo "false")
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "unknown")

# Get actual environment variables and context
SERVER_PORT=${SERVER_PORT:-$(grep -oP 'port\s*=\s*\K\d+' apps/server/wrangler.toml 2>/dev/null | head -1 || echo "8787")}
WEB_PORT=${WEB_PORT:-5173}
DB_PORT=${DB_PORT:-5432}
PROXY_PORT=${PROXY_PORT:-4444}

# Check if we're in a PR worktree which might have different ports
if [[ "$WORKTREE_PATH" =~ vibestack-issue-([0-9]+) ]]; then
    # PR environments have custom ports based on PR number
    PR_NUM="${BASH_REMATCH[1]}"
    # These would be set by the setup scripts
    WEB_PORT=${WEB_PORT:-$((5170 + PR_NUM))}
    SERVER_PORT=${SERVER_PORT:-$((8780 + PR_NUM))}
    DB_PORT=${DB_PORT:-$((5440 + PR_NUM))}
    PROXY_PORT=${PROXY_PORT:-$((4450 + PR_NUM))}
fi

# Detect if this is a PR worktree by checking the path
PR_NUMBER=""
if [[ "$WORKTREE_PATH" =~ vibestack-issue-([0-9]+) ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
fi

# Get running tmux sessions
TMUX_SESSIONS=$(tmux ls 2>/dev/null | grep -E "vibestack-" | awk -F: '{print $1}' | tr '\n' ', ' | sed 's/,$//' || echo "none")

# Display the context
echo "## Important Project Context:"
echo ""
echo "### Current Environment:"
echo "- Working Directory: $(pwd)"
echo "- Git Branch: $BRANCH_NAME"
[ -n "$PR_NUMBER" ] && echo "- PR/Issue Number: $PR_NUMBER"
echo "- Active tmux sessions: ${TMUX_SESSIONS:-none}"
echo ""
echo "### Development Servers:"
echo "- Use './scripts/tmux-bg.sh vibestack-dev \"pnpm dev\"' to start dev servers in background"
echo "- Check running servers with './scripts/bg-status.sh'"
echo "- View logs with './scripts/bg-logs.sh vibestack-dev'"
echo "- Stop servers with './scripts/bg-stop.sh vibestack-dev'"
echo ""
echo "### Current Ports:"
echo "- Web app: ${WEB_PORT}"
echo "- API server: ${SERVER_PORT}"
echo "- Database: ${DB_PORT}"
echo "- Proxy: ${PROXY_PORT}"
[ -n "$PR_NUMBER" ] && echo "- Note: This is PR $PR_NUMBER environment with custom ports"
echo ""
echo "### Testing with Playwright:"
echo "- Navigate to http://localhost:${WEB_PORT}"
echo "- Always take snapshots before interactions"
echo "- Use mcp__playwright__browser_snapshot to understand page structure"
echo ""
echo "### Database:"
echo "- Current DB_PORT: ${DB_PORT}"
[ -n "$PR_NUMBER" ] && echo "- PR Database: vibestack_dev_issue_${PR_NUMBER}"
echo "- Connection: postgres://postgres:postgres@localhost:${DB_PORT}/$([ -n "$PR_NUMBER" ] && echo "vibestack_dev_issue_${PR_NUMBER}" || echo "vibestack_dev")"
echo ""
echo "### Common Commands:"
echo "- Type check: 'pnpm type-check'"
echo "- Lint: 'pnpm lint'"
echo "- Full check: 'pnpm check'"
echo ""
echo "---"
echo "Note: This context is automatically added at the start of each Claude session via the SessionStart hook."