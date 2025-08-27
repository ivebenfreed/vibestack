#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Extract the event name from the input
EVENT_NAME=$(echo "$INPUT" | jq -r '.hookEventName // empty')

# If this is a SessionStart event, add visible output and return
if [[ "$EVENT_NAME" == "SessionStart" ]]; then
    echo "🚀 VibeStack Session Started - Project context loaded successfully!" >&2
    echo "📍 Current directory: $(pwd)" >&2  
    echo "🌿 Git branch: $(git branch --show-current 2>/dev/null || echo 'unknown')" >&2
    echo "$INPUT"
    exit 0
fi

# For UserPromptSubmit events, continue with context addition
# Check if we're in a worktree
WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
IS_WORKTREE=$(git rev-parse --is-inside-work-tree 2>/dev/null || echo "false")
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "unknown")

# Get actual environment variables and context
# For default branch, use standard ports from wrangler.toml
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

# Check for running background processes via Claude Code
BACKGROUND_PROCESSES=$(ps aux | grep -E "(pnpm dev|npm run dev)" | grep -v grep | wc -l || echo "0")

# Build context based on actual environment
CONTEXT_REMINDER="
## Important Project Context:

### Current Environment:
- Working Directory: $(pwd)
- Git Branch: $BRANCH_NAME
$([ -n "$PR_NUMBER" ] && echo "- PR/Issue Number: $PR_NUMBER")
- Background dev processes: ${BACKGROUND_PROCESSES} running

### Development Servers:
- Start with: 'Bash(command=\"pnpm dev\", run_in_background=true)'
- Use Claude Code's native background process management
- Monitor with BashOutput tool to check logs
- Stop with KillBash tool

### Current Ports:
- Web app: ${WEB_PORT}
- API server: ${SERVER_PORT}
- Database: ${DB_PORT}
- Proxy: ${PROXY_PORT}
$([ -n "$PR_NUMBER" ] && echo "- Note: This is PR $PR_NUMBER environment with custom ports")

### Testing with Playwright:
- Navigate to http://localhost:${WEB_PORT}
- Always take snapshots before interactions
- Use mcp__playwright__browser_snapshot to understand page structure

### Database:
- Current DB_PORT: ${DB_PORT}
$([ -n "$PR_NUMBER" ] && echo "- PR Database: vibestack_dev_issue_${PR_NUMBER}")
- Connection: postgres://postgres:postgres@localhost:${DB_PORT}/$([ -n "$PR_NUMBER" ] && echo "vibestack_dev_issue_${PR_NUMBER}" || echo "vibestack_dev")

### Common Commands:
- Type check: 'pnpm type-check'
- Lint: 'pnpm lint'
- Full check: 'pnpm check'
"

# Only add context for UserPromptSubmit events
if [[ "$EVENT_NAME" == "UserPromptSubmit" ]]; then
    # Create the output with the additional context
    OUTPUT=$(echo "$INPUT" | jq --arg context "$CONTEXT_REMINDER" '.hookSpecificOutput.additionalContext = $context')
    echo "$OUTPUT"
else
    # For any other event, return the input unchanged
    echo "$INPUT"
fi