#!/bin/bash

# Development Server with Logging
# This script runs the wrangler dev server and pipes output to log files

# Get the script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Determine if we're running from turbo (in apps/server) or from scripts
if [[ "$PWD" == *"apps/server"* ]]; then
    # Running from apps/server directory (via turbo)
    LOG_DIR="logs"
    WRANGLER_CMD="wrangler dev --var LOG_LEVEL:info --ip 127.0.0.1 --port 8787"
else
    # Running from project root or scripts directory
    LOG_DIR="$PROJECT_ROOT/apps/server/logs"
    WRANGLER_CMD="cd $PROJECT_ROOT/apps/server && wrangler dev --var LOG_LEVEL:info --ip 127.0.0.1 --port 8787"
fi

LOG_FILE="$LOG_DIR/server.log"
MAX_LOG_SIZE=10485760  # 10MB in bytes
LOG_TIMESTAMP_FILE="$LOG_DIR/.last-cull-timestamp"

# Create log directory if it doesn't exist
mkdir -p $LOG_DIR

# Function to check if 24 hours have passed
should_cull_logs() {
    if [ ! -f "$LOG_TIMESTAMP_FILE" ]; then
        return 0  # No timestamp file, should cull
    fi
    
    last_cull=$(cat "$LOG_TIMESTAMP_FILE" 2>/dev/null || echo 0)
    current_time=$(date +%s)
    diff=$((current_time - last_cull))
    
    # 86400 seconds = 24 hours
    if [ $diff -gt 86400 ]; then
        return 0  # Should cull
    else
        return 1  # Don't cull yet
    fi
}

# Function to cull old logs (24hr rotation)
cull_logs() {
    if should_cull_logs; then
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Performing 24-hour log rotation"
        
        # Archive old logs with timestamp
        timestamp=$(date +%Y%m%d_%H%M%S)
        if [ -f "$LOG_FILE" ]; then
            mv "$LOG_FILE" "$LOG_FILE.$timestamp"
            echo "$(date '+%Y-%m-%d %H:%M:%S') - Log file culled (24hr rotation)" > "$LOG_FILE"
        fi
        
        # Update timestamp
        date +%s > "$LOG_TIMESTAMP_FILE"
        
        # Clean up old archived logs (keep last 7 days)
        find "$LOG_DIR" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
    fi
}

# Rotate logs if they get too large
rotate_logs() {
    if [ -f "$1" ] && [ $(stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null) -gt $MAX_LOG_SIZE ]; then
        mv "$1" "$1.old"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Log rotated (size limit)" > "$1"
    fi
}

# Check for 24-hour culling first
cull_logs

# Rotate existing logs if needed (size-based)
rotate_logs "$LOG_FILE"

echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting Wrangler Dev Server with logging" | tee -a $LOG_FILE
echo "Logs: $LOG_FILE" | tee -a $LOG_FILE
echo "----------------------------------------" | tee -a $LOG_FILE

# Run wrangler and tee output to both terminal and log file
eval "$WRANGLER_CMD" 2>&1 | tee -a $LOG_FILE

# Handle script exit
echo "$(date '+%Y-%m-%d %H:%M:%S') - Wrangler Dev Server stopped" | tee -a $LOG_FILE