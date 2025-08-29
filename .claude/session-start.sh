#!/bin/bash

# Get today's date
DATE=$(date '+%Y-%m-%d')
DATE_DIR="$CLAUDE_PROJECT_DIR/sessions/${DATE}"

# Create date directory if it doesn't exist
mkdir -p "$DATE_DIR"

# Check if we should reuse an existing session
REUSE_WINDOW=7200  # 2 hours in seconds
CURRENT_TIME=$(date +%s)

# Find the most recent session for today
LAST_SESSION=$(ls -d ${DATE_DIR}/session-* 2>/dev/null | sort -V | tail -1)

if [ -n "$LAST_SESSION" ]; then
    # Check if the session is recent enough to reuse
    SESSION_TIME=$(stat -c %Y "$LAST_SESSION" 2>/dev/null || stat -f %m "$LAST_SESSION" 2>/dev/null)
    if [ -n "$SESSION_TIME" ]; then
        TIME_DIFF=$((CURRENT_TIME - SESSION_TIME))
        
        if [ $TIME_DIFF -lt $REUSE_WINDOW ]; then
            # Reuse existing session
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION REUSE - Directory: $LAST_SESSION" >> "$CLAUDE_PROJECT_DIR/sessions/session.log"
            echo "$LAST_SESSION" > "$CLAUDE_PROJECT_DIR/sessions/current-session"
            echo "Reusing existing session: $LAST_SESSION"
            exit 0
        fi
    fi
fi

# Create new session if none exists or last one is too old
SESSION_NUM=1
if [ -n "$LAST_SESSION" ]; then
    # Extract the session number and increment
    LAST_NUM=$(basename "$LAST_SESSION" | sed 's/session-//')
    SESSION_NUM=$((LAST_NUM + 1))
fi

# Create the new session directory
NEW_SESSION_DIR="${DATE_DIR}/session-${SESSION_NUM}"
mkdir -p "$NEW_SESSION_DIR"

# Log the session start
echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION START - Directory: $NEW_SESSION_DIR" >> "$CLAUDE_PROJECT_DIR/sessions/session.log"

# Save current session info for other hooks to use
echo "$NEW_SESSION_DIR" > "$CLAUDE_PROJECT_DIR/sessions/current-session"

echo "Created new session: $NEW_SESSION_DIR"