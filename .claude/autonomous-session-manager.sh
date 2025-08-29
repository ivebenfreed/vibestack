#!/bin/bash

# Autonomous Session Manager - Combined planner and summarizer
# Uses Gemini 2.5 Flash API to update plans and create comprehensive summaries
# Only runs on Stop hook for sessions with meaningful work

HOOK_TYPE="${1:-Stop}"

# Check for required Gemini API key
if [ -z "$GEMINI_API_KEY" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: ERROR - GEMINI_API_KEY environment variable not set" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo '{"shouldBlock": false}'
    exit 0
fi

SESSION_DIR="$CLAUDE_PROJECT_DIR/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $SESSION_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Only run on Stop hook
if [ "$HOOK_TYPE" != "Stop" ]; then
    echo '{"shouldBlock": false}'
    exit 0
fi

# Gather session data
WORK_LOG="$LATEST_SESSION/work-log.md"
PLAN_FILE="$LATEST_SESSION/plan.md"
SESSION_NAME=$(basename "$LATEST_SESSION")
SUMMARY_FILE="$LATEST_SESSION/session-summary.md"

# Check if there's actual work to analyze
WORK_COUNT=0
if [ -f "$WORK_LOG" ]; then
    WORK_COUNT=$(grep -c "Read:\|Modified:\|Executed:" "$WORK_LOG" 2>/dev/null | head -1 || echo 0)
    # Ensure WORK_COUNT is a valid integer
    WORK_COUNT=$(echo "$WORK_COUNT" | grep -o '[0-9]*' | head -1)
    WORK_COUNT=${WORK_COUNT:-0}
fi

# If no work logged, check git activity since session start
if [ "$WORK_COUNT" -eq 0 ] && [ -d "$LATEST_SESSION" ] && git rev-parse --git-dir >/dev/null 2>&1; then
    SESSION_START=$(stat -c %Y "$LATEST_SESSION" 2>/dev/null || echo 0)
    
    # Count commits since session start
    COMMIT_COUNT=0
    if [ "$SESSION_START" -gt 0 ]; then
        COMMIT_COUNT=$(git rev-list --count --since="@$SESSION_START" HEAD 2>/dev/null || echo 0)
    fi
    
    # Count modified files (staged + unstaged)
    MODIFIED_COUNT=$(git diff --name-only HEAD 2>/dev/null | wc -l || echo 0)
    STAGED_COUNT=$(git diff --name-only --cached 2>/dev/null | wc -l || echo 0)
    
    GIT_ACTIVITY=$((COMMIT_COUNT + MODIFIED_COUNT + STAGED_COUNT))
    
    if [ "$GIT_ACTIVITY" -gt 0 ]; then
        WORK_COUNT=$GIT_ACTIVITY
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Using git activity: ${COMMIT_COUNT} commits, ${MODIFIED_COUNT} modified, ${STAGED_COUNT} staged = $WORK_COUNT total" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    fi
fi

# Skip autonomous processing for sessions with minimal activity
if [ "$WORK_COUNT" -lt 5 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Skipping short session ($WORK_COUNT actions)" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo '{"shouldBlock": false}'
    exit 0
fi

# Gather rich git context for analysis
GIT_CONTEXT=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Get recent commits since session start
    SESSION_START=$(stat -c %Y "$LATEST_SESSION" 2>/dev/null || echo 0)
    RECENT_COMMITS=""
    if [ "$SESSION_START" -gt 0 ]; then
        RECENT_COMMITS=$(git log --oneline --since="@$SESSION_START" 2>/dev/null | head -5)
    fi
    
    # Get condensed diff summary (file changes only, limit size)
    DIFF_SUMMARY=$(git diff --stat HEAD~1 2>/dev/null | head -20 || echo "No recent changes")
    
    # Get modified file list with change types
    MODIFIED_FILES=$(git diff --name-status HEAD~1 2>/dev/null | head -15 || echo "No changes")
    
    GIT_CONTEXT="
RECENT COMMITS:
$RECENT_COMMITS

DIFF SUMMARY:
$DIFF_SUMMARY

MODIFIED FILES:
$MODIFIED_FILES"
fi

# Read current files for context
PLAN_CONTENT=""
WORK_LOG_CONTENT=""
if [ -f "$PLAN_FILE" ]; then
    PLAN_CONTENT=$(cat "$PLAN_FILE" 2>/dev/null || echo "No plan file found")
fi
if [ -f "$WORK_LOG" ]; then
    WORK_LOG_CONTENT=$(cat "$WORK_LOG" 2>/dev/null || echo "No work log found")
fi

# Create actionable prompt with file contents and git context
AUTONOMOUS_PROMPT="You are analyzing a Claude Code session with $WORK_COUNT git activities. 

CURRENT PLAN FILE ($PLAN_FILE):
$PLAN_CONTENT

CURRENT WORK LOG ($WORK_LOG):
$WORK_LOG_CONTENT

GIT ANALYSIS CONTEXT:$GIT_CONTEXT

TASK: Analyze the actual code changes and git activity to provide updates in this EXACT format:

## PLAN UPDATES
# Session 2 Plan: Complete Frontend Logging Migration
[... rest of updated plan content with ✅ marks for completed items based on git activity ...]

## SESSION SUMMARY
**Session Objectives:** [Brief description based on plan]
**Key Accomplishments:** [Analyze git diff and commits to identify specific completions]  
**Code Changes:** [Specific insights from diff summary - what types of changes were made]
**Files Modified:** [List key files from git status with change significance]
**Technical Progress:** [Analyze commit messages and diffs for technical insights]
**Next Steps:** [Smart recommendations based on actual progress]
**Activity Summary:** $WORK_COUNT git changes analyzed from actual diffs and commits

Focus on actionable updates based on the git activity detected."

# Log the autonomous execution attempt
echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Starting Gemini 2.5 Flash Lite API call for session management $SESSION_NAME ($WORK_COUNT actions)" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"

# Execute Gemini 2.5 Flash Lite API call with high token limit and better prompt
cd "$CLAUDE_PROJECT_DIR"
GEMINI_OUTPUT=$(curl -s -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"contents\":[{
      \"parts\":[{\"text\":\"$AUTONOMOUS_PROMPT\"}]
    }],
    \"generationConfig\":{
      \"temperature\":0.1,
      \"maxOutputTokens\":4000
    }
  }" 2>&1)
GEMINI_EXIT_CODE=$?

# Extract the text content from Gemini response
if [ $GEMINI_EXIT_CODE -eq 0 ] && echo "$GEMINI_OUTPUT" | grep -q '"text"'; then
    CLAUDE_OUTPUT=$(echo "$GEMINI_OUTPUT" | python3 -c "import sys, json; print(json.loads(sys.stdin.read())['candidates'][0]['content']['parts'][0]['text'])" 2>/dev/null || echo "Failed to parse Gemini response")
    CLAUDE_EXIT_CODE=0
    
    # Process the structured response to update files
    if echo "$CLAUDE_OUTPUT" | grep -q "## PLAN UPDATES"; then
        # Extract plan updates (handle markdown code blocks)
        PLAN_UPDATES=$(echo "$CLAUDE_OUTPUT" | sed -n '/## PLAN UPDATES/,/## SESSION SUMMARY/p' | sed '1d;$d' | grep -v '```' | sed '/^$/d')
        if [ -n "$PLAN_UPDATES" ] && [ "$PLAN_UPDATES" != "## SESSION SUMMARY" ]; then
            echo "$PLAN_UPDATES" > "$PLAN_FILE"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Updated plan file $PLAN_FILE" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
        fi
        
        # Extract session summary (handle markdown code blocks)
        SESSION_SUMMARY=$(echo "$CLAUDE_OUTPUT" | sed -n '/## SESSION SUMMARY/,$p' | sed '1d' | grep -v '```' | sed '/^$/d')
        if [ -n "$SESSION_SUMMARY" ]; then
            echo "# Session Summary - $(date '+%Y-%m-%d %H:%M')" > "$SUMMARY_FILE"
            echo "" >> "$SUMMARY_FILE"
            echo "$SESSION_SUMMARY" >> "$SUMMARY_FILE"
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Created session summary $SUMMARY_FILE" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
        fi
    fi
else
    CLAUDE_OUTPUT="Gemini API call failed: $GEMINI_OUTPUT"
    CLAUDE_EXIT_CODE=1
fi

# Log the result
if [ $CLAUDE_EXIT_CODE -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: SUCCESS - Session processed for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "=== Session $SESSION_NAME Output ===" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
    echo "$CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
    echo "===================================" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
else
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: FAILED - Exit code $CLAUDE_EXIT_CODE for $SESSION_NAME" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo "ERROR in $SESSION_NAME: $CLAUDE_OUTPUT" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous-output.log"
fi

# Always return success for the hook
echo '{"shouldBlock": false}'
exit 0