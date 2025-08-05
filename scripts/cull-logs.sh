#!/bin/bash

# Manual log culling script
# Use this to force a log rotation without waiting 24 hours

LOG_DIR="apps/server/logs"
LOG_FILE="$LOG_DIR/server.log"
LOG_TIMESTAMP_FILE="$LOG_DIR/.last-cull-timestamp"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo -e "${YELLOW}No log directory found at $LOG_DIR${NC}"
    echo "The server may not have been started yet."
    exit 1
fi

# Function to format file size
format_size() {
    local size=$1
    if [ $size -gt 1048576 ]; then
        echo "$(( size / 1048576 ))MB"
    elif [ $size -gt 1024 ]; then
        echo "$(( size / 1024 ))KB"
    else
        echo "${size}B"
    fi
}

# Show current log status
echo -e "${BLUE}Current log status:${NC}"
if [ -f "$LOG_FILE" ]; then
    size=$(stat -f%z "$LOG_FILE" 2>/dev/null || stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
    echo "  Log file: $(format_size $size)"
fi

# Show last cull time
if [ -f "$LOG_TIMESTAMP_FILE" ]; then
    last_cull=$(cat "$LOG_TIMESTAMP_FILE")
    last_cull_date=$(date -r $last_cull 2>/dev/null || date -d @$last_cull 2>/dev/null || echo "Unknown")
    echo "  Last culled: $last_cull_date"
fi

echo ""

# Ask for confirmation
read -p "Cull logs now? This will archive current logs. (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Archive old logs with timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    
    echo -e "${YELLOW}Archiving logs...${NC}"
    
    if [ -f "$LOG_FILE" ]; then
        mv "$LOG_FILE" "$LOG_FILE.$timestamp"
        echo "$(date '+%Y-%m-%d %H:%M:%S') - Log file manually culled" > "$LOG_FILE"
        echo -e "${GREEN}✓ Archived: server.log.$timestamp${NC}"
    fi
    
    # Update timestamp
    date +%s > "$LOG_TIMESTAMP_FILE"
    
    # Show archived logs
    echo ""
    echo -e "${BLUE}Archived logs in $LOG_DIR:${NC}"
    ls -lh "$LOG_DIR"/*.log.* 2>/dev/null | tail -5 || echo "  No archived logs found"
    
    # Clean up old archived logs (keep last 7 days)
    old_count=$(find "$LOG_DIR" -name "*.log.*" -mtime +7 2>/dev/null | wc -l)
    if [ $old_count -gt 0 ]; then
        echo ""
        echo -e "${YELLOW}Cleaning up $old_count archived logs older than 7 days...${NC}"
        find "$LOG_DIR" -name "*.log.*" -mtime +7 -delete 2>/dev/null || true
    fi
    
    echo ""
    echo -e "${GREEN}✅ Log culling complete!${NC}"
else
    echo -e "${BLUE}Log culling cancelled.${NC}"
fi