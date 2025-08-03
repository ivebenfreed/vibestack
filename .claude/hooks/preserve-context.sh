#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Get current environment info from config files
WEB_PORT=${WEB_PORT:-$(grep -oP 'WEB_PORT[=:]?\s*\K\d+' .env* 2>/dev/null | head -1 || echo "5173")}
SERVER_PORT=${SERVER_PORT:-$(grep -oP 'port\s*=\s*\K\d+' apps/server/wrangler.toml 2>/dev/null | head -1 || echo "8787")}
DB_PORT=${DB_PORT:-$(grep -oP 'DB_PORT[=:]?\s*\K\d+' .env* 2>/dev/null | head -1 || echo "5432")}

# Check generated env for API URL port
API_URL=$(grep -oP 'VITE_API_URL=.*?:(\d+)' apps/web/.env.development.generated 2>/dev/null | grep -oP ':\K\d+' || echo "")
if [ -n "$API_URL" ]; then
    SERVER_PORT=$API_URL
fi
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "unknown")

# Detect PR number from worktree path
PR_NUMBER=""
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ "$WORKTREE_PATH" =~ vibestack-issue-([0-9]+) ]]; then
    PR_NUMBER="${BASH_REMATCH[1]}"
fi

# Get active tmux sessions count
ACTIVE_SESSIONS=$(tmux ls 2>/dev/null | grep -c "vibestack-" || echo "0")

# Important context that should survive compaction
PRESERVED_CONTEXT="
## Critical Project Information (Preserved):

### Current Environment:
- Branch: $BRANCH_NAME
$([ -n "$PR_NUMBER" ] && echo "- PR/Issue: #$PR_NUMBER")
- Active tmux sessions: $ACTIVE_SESSIONS
- Check processes: './scripts/bg-status.sh'

### Key Commands:
- Dev servers: './scripts/tmux-bg.sh vibestack-dev \"pnpm dev\"' (NOT 'pnpm dev' directly)
- Type checking: 'pnpm type-check' or 'pnpm check'
- View logs: './scripts/bg-logs.sh <session-name>'

### Testing URLs:
- Web app: http://localhost:${WEB_PORT}
- API: http://localhost:${SERVER_PORT}
- Always use mcp__playwright__browser_snapshot before interactions

### Database:
- Port: ${DB_PORT}
$([ -n "$PR_NUMBER" ] && echo "- Database: vibestack_dev_issue_${PR_NUMBER}" || echo "- Database: vibestack_dev")
- Connection: postgres://postgres:postgres@localhost:${DB_PORT}/$([ -n "$PR_NUMBER" ] && echo "vibestack_dev_issue_${PR_NUMBER}" || echo "vibestack_dev")
"

# Add the preserved context to ensure it survives compaction
OUTPUT=$(echo "$INPUT" | jq --arg context "$PRESERVED_CONTEXT" '.hookSpecificOutput.preservedContext = $context')

# Return the enhanced output
echo "$OUTPUT"