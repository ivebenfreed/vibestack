#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Extract the command using jq
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Check if it's a pnpm dev or pnpm dev:* command
if [[ "$COMMAND" =~ ^pnpm[[:space:]]+(dev|dev:) ]]; then
    # Log the blocked command
    echo "[$(date)] Blocked command: $COMMAND" >> ~/.claude/blocked-pnpm-dev.log
    
    # Output the proper blocking response for Claude
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "Command blocked: pnpm dev commands should be run in tmux. Use: ./scripts/tmux-bg.sh vibestack-dev 'pnpm dev'"
  }
}
EOF
    exit 2
else
    # Pass through all other commands unchanged
    echo "$INPUT"
fi