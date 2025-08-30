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
if [ "$WORK_COUNT" -lt 1 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] AUTONOMOUS: Skipping short session ($WORK_COUNT actions)" >> "$CLAUDE_PROJECT_DIR/.claude/autonomous.log"
    echo '{"shouldBlock": false}'
    exit 0
fi

# Analyze current work state and gaps
CURRENT_WORK_ANALYSIS=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Get uncommitted changes (what's actually being worked on)
    UNCOMMITTED_STATUS=$(git status --porcelain 2>/dev/null | head -20)
    UNCOMMITTED_CHANGES=$(git diff --name-only 2>/dev/null | head -15)
    STAGED_CHANGES=$(git diff --name-only --cached 2>/dev/null | head -15)
    
    # Get recent commits since session started for context
    SESSION_START=$(stat -c %Y "$LATEST_SESSION" 2>/dev/null || echo 0)
    SESSION_COMMITS=""
    if [ "$SESSION_START" -gt 0 ]; then
        SESSION_COMMITS=$(git log --oneline --since="@$SESSION_START" 2>/dev/null | head -3)
    fi
    
    # Count different types of changes
    UNTRACKED_COUNT=$(echo "$UNCOMMITTED_STATUS" | grep -c "^??" 2>/dev/null || echo 0)
    MODIFIED_COUNT=$(echo "$UNCOMMITTED_STATUS" | grep -c "^ M\|^M " 2>/dev/null || echo 0)
    ADDED_COUNT=$(echo "$UNCOMMITTED_STATUS" | grep -c "^A " 2>/dev/null || echo 0)
    DELETED_COUNT=$(echo "$UNCOMMITTED_STATUS" | grep -c "^ D\|^D " 2>/dev/null || echo 0)
    
    CURRENT_WORK_ANALYSIS="
CURRENT SESSION COMMITS:
$SESSION_COMMITS

UNCOMMITTED WORK (what's being worked on right now):
$UNCOMMITTED_STATUS

WORK BREAKDOWN:
- $UNTRACKED_COUNT new files created
- $MODIFIED_COUNT files modified  
- $ADDED_COUNT files staged for commit
- $DELETED_COUNT files deleted

MODIFIED FILES NEEDING COMMIT:
$UNCOMMITTED_CHANGES

STAGED FILES READY TO COMMIT:
$STAGED_CHANGES"
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

# Create actionable prompt focusing on current work and planning gaps
AUTONOMOUS_PROMPT="You are analyzing a Claude Code session to identify planning gaps and current work status.

CURRENT PLAN FILE ($PLAN_FILE):
$PLAN_CONTENT

CURRENT WORK LOG ($WORK_LOG):
$WORK_LOG_CONTENT

CURRENT WORK STATE ANALYSIS:$CURRENT_WORK_ANALYSIS

TASK: Analyze the uncommitted changes, work-in-progress, and planning gaps. Focus on:
1. What work is currently in progress but not committed?
2. Are there gaps between the plan and actual work being done? 
3. What files/changes suggest work that isn't reflected in the plan?
4. What should be committed or cleaned up?

Provide updates in this EXACT format:

## PLAN UPDATES
# Session 2 Plan: Complete Frontend Logging Migration
[... rest of updated plan content with ✅ marks for completed items based on git activity ...]

## SESSION SUMMARY
**Work in Progress:** [What uncommitted changes show is being worked on]
**Planning Gaps:** [Work being done that's not reflected in the plan]
**Uncommitted Changes:** [Files that need to be committed or cleaned up]
**Plan vs Reality:** [How actual work differs from the planned approach]
**Immediate Actions:** [What should be committed, staged, or planned next]
**Session Progress:** [Real assessment of what was accomplished vs planned]

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