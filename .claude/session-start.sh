#!/bin/bash

# Get today's date
DATE=$(date '+%Y-%m-%d')
DATE_DIR=".claude/sessions/${DATE}"

# Create date directory if it doesn't exist
mkdir -p "$DATE_DIR"

# Find the last session number for today
SESSION_NUM=1
if [ -d "$DATE_DIR" ]; then
    LAST_SESSION=$(ls -d ${DATE_DIR}/session-* 2>/dev/null | sort -V | tail -1)
    if [ -n "$LAST_SESSION" ]; then
        # Extract the session number and increment
        LAST_NUM=$(basename "$LAST_SESSION" | sed 's/session-//')
        SESSION_NUM=$((LAST_NUM + 1))
    fi
fi

# Create the new session directory
NEW_SESSION_DIR="${DATE_DIR}/session-${SESSION_NUM}"
mkdir -p "$NEW_SESSION_DIR"

# Log the session start
echo "[$(date '+%Y-%m-%d %H:%M:%S')] SESSION START - Directory: $NEW_SESSION_DIR" >> .claude/session.log

# Save current session info for other hooks to use
echo "$NEW_SESSION_DIR" > .claude/current-session