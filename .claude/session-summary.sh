#!/bin/bash

# Session Summary Generator - Creates summary of current session
# Can be triggered manually or by Stop hook

DATE_DIR="$CLAUDE_PROJECT_DIR/.claude/sessions/$(date +%Y-%m-%d)"
LATEST_SESSION=$(ls -d $DATE_DIR/session-* 2>/dev/null | sort -V | tail -1)

if [ -z "$LATEST_SESSION" ]; then
    echo "No active session found"
    exit 0
fi

PLAN_FILE="$LATEST_SESSION/plan.md"
WORK_LOG="$LATEST_SESSION/work-log.md"
SUMMARY_FILE="$LATEST_SESSION/summary.md"

# Generate summary
cat > "$SUMMARY_FILE" <<EOF
# Session Summary - $(date +"%Y-%m-%d %H:%M")

## Session Duration
- Started: $(stat -c %y "$LATEST_SESSION" 2>/dev/null | cut -d' ' -f2 | cut -d'.' -f1)
- Current: $(date +"%H:%M:%S")

## Goals Achieved
EOF

# Extract completed goals from plan if exists
if [ -f "$PLAN_FILE" ]; then
    echo "### From Plan:" >> "$SUMMARY_FILE"
    grep "✅" "$PLAN_FILE" 2>/dev/null >> "$SUMMARY_FILE" || echo "- No completed goals marked" >> "$SUMMARY_FILE"
fi

echo "" >> "$SUMMARY_FILE"
echo "## Activity Summary" >> "$SUMMARY_FILE"

# Count activities from work log
if [ -f "$WORK_LOG" ]; then
    READS=$(grep -c "Read:" "$WORK_LOG" 2>/dev/null || echo 0)
    MODS=$(grep -c "Modified:" "$WORK_LOG" 2>/dev/null || echo 0)
    EXECS=$(grep -c "Executed:" "$WORK_LOG" 2>/dev/null || echo 0)
    
    echo "- Files read: $READS" >> "$SUMMARY_FILE"
    echo "- Files modified: $MODS" >> "$SUMMARY_FILE"
    echo "- Commands executed: $EXECS" >> "$SUMMARY_FILE"
    
    echo "" >> "$SUMMARY_FILE"
    echo "## Recent Activity" >> "$SUMMARY_FILE"
    tail -10 "$WORK_LOG" >> "$SUMMARY_FILE"
fi

# Git activity if repo exists
if git rev-parse --git-dir > /dev/null 2>&1; then
    echo "" >> "$SUMMARY_FILE"
    echo "## Git Activity" >> "$SUMMARY_FILE"
    echo "\`\`\`" >> "$SUMMARY_FILE"
    git log --oneline -5 2>/dev/null >> "$SUMMARY_FILE"
    echo "\`\`\`" >> "$SUMMARY_FILE"
fi

echo "Session summary created: $SUMMARY_FILE"