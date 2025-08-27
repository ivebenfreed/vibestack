#!/bin/bash

# Autonomous Planner Hook - Uses Claude CLI subprocess to automatically update planning docs
# This hook runs Claude Code in subprocess to analyze sessions and update plans

HOOK_TYPE="${1:-Stop}"
SESSION_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Gather session intelligence
WORK_LOG="$LATEST_SESSION/work-log.md"
PLAN_FILE="$LATEST_SESSION/plan.md"
SESSION_NAME=$(basename "$LATEST_SESSION")

# Only run on Stop hook
if [ "$HOOK_TYPE" != "Stop" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Create autonomous Claude prompt
AUTONOMOUS_PROMPT="🤖 **Autonomous Session Analysis**

I am running as an autonomous subprocess from a hook. Please analyze the current session and update the planning documents.

**Session Context:**
- Current session: $SESSION_NAME
- Plan file: $PLAN_FILE
- Work log: $WORK_LOG

**Your Task:**
1. Read the current plan file to understand the goals
2. Read the work log to see what was accomplished  
3. Update the plan file to:
   - Mark completed goals with ✅
   - Add any new goals discovered during the session
   - Update next steps based on current progress
   - Add a brief session summary

**Output Format:**
Only show what you changed in the plan, not the entire conversation process.

Please proceed now."

# Log the autonomous execution attempt
echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Starting Claude subprocess for session $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"

# Execute Claude CLI in subprocess with --print for non-interactive output
cd "$CLAUDE_PROJECT_DIR"
CLAUDE_OUTPUT=$(echo "$AUTONOMOUS_PROMPT" | claude --print --dangerously-skip-permissions --allowed-tools="Read Edit Write" 2>&1)
CLAUDE_EXIT_CODE=$?

# Log the result
if [ $CLAUDE_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: SUCCESS - Plan updated for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "$CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: FAILED - Exit code $CLAUDE_EXIT_CODE for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "ERROR: $CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
fi

# Always return success for the hook
echo '{"shouldBlock": false}'
exit 0