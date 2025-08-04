#!/bin/bash

# Read the JSON input
INPUT=$(cat)

# Extract the command using jq
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""')

# Check if it's a pnpm dev, pnpm dev:*, or pnpm build command
if [[ "$COMMAND" =~ ^pnpm[[:space:]]+(dev|dev:|build) ]]; then
    # Log the blocked command
    echo "[$(date)] Blocked command: $COMMAND" >> ~/.claude/blocked-pnpm-dev.log
    
    # Determine the appropriate message
    if [[ "$COMMAND" =~ ^pnpm[[:space:]]+build ]]; then
        REASON="Command blocked: All builds are HMR (Hot Module Replacement) and don't need manual build commands. The dev server handles building automatically."
    else
        REASON="Command blocked: pnpm dev commands should be run in tmux. Use: ./scripts/dev-start.sh"
    fi
    
    # Output the proper blocking response for Claude
    cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": "$REASON"
  }
}
EOF
    exit 2
else
    # Pass through all other commands unchanged
    echo "$INPUT"
fi