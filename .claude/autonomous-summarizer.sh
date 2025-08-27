#!/bin/bash

# Autonomous Summarizer Hook - Uses Claude CLI subprocess to create session summaries
# This runs a more comprehensive analysis including work logs, git history, and session context

HOOK_TYPE="${1:-Stop}"
SESSION_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Gather comprehensive session data
WORK_LOG="$LATEST_SESSION/work-log.md"
PLAN_FILE="$LATEST_SESSION/plan.md"
SESSION_NAME=$(basename "$LATEST_SESSION")
SUMMARY_FILE="$LATEST_SESSION/autonomous-summary.md"

# Only run on Stop hook
if [ "$HOOK_TYPE" != "Stop" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Create comprehensive analysis prompt
ANALYSIS_PROMPT="🤖 **Autonomous Session Analysis & Summarization**

I am running as an autonomous subprocess to create a comprehensive session analysis.

**Session Context:**
- Current session: $SESSION_NAME
- Plan file: $PLAN_FILE
- Work log: $WORK_LOG
- Output file: $SUMMARY_FILE

**Your Task:**
1. Read the work log to understand all activities performed
2. Read the plan file to understand goals and outcomes
3. Analyze git changes if relevant
4. Create a comprehensive summary covering:
   - Session objectives and whether they were met
   - Key accomplishments and deliverables
   - Files created, modified, or important changes made
   - Technical insights or discoveries
   - Challenges encountered and how they were resolved
   - Next steps or recommendations for future sessions

**Output Requirements:**
- Create a well-structured markdown summary
- Write to: $SUMMARY_FILE
- Include metrics: number of tool uses, files touched, time spent
- Provide both technical details and high-level insights
- Format for easy reading and future reference

Please proceed with the comprehensive analysis."

# Log the autonomous summarization attempt  
echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS-SUMMARY: Starting Claude subprocess for session $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"

# Execute Claude CLI in subprocess for summarization
cd "$CLAUDE_PROJECT_DIR"
CLAUDE_OUTPUT=$(echo "$ANALYSIS_PROMPT" | claude --print --dangerously-skip-permissions --allowed-tools="Read Write Edit Bash" 2>&1)
CLAUDE_EXIT_CODE=$?

# Log the result
if [ $CLAUDE_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS-SUMMARY: SUCCESS - Summary created for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "$CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS-SUMMARY: FAILED - Exit code $CLAUDE_EXIT_CODE for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "SUMMARY ERROR: $CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
fi

# Always return success for the hook
echo '{"shouldBlock": false}'
exit 0