#!/bin/bash

# Simple log tail script for real-time log viewing

LOG_DIR="apps/server/logs"
LOG_FILE="$LOG_DIR/server.log"

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo "Log file not found: $LOG_FILE"
    echo "The server may not have been started with logging enabled."
    echo "Run the server with: pnpm --filter server dev"
    exit 1
fi

echo "Tailing logs from: $LOG_FILE"
echo "Press Ctrl+C to stop"
echo "----------------------------------------"

# Tail the log file
tail -f "$LOG_FILE"