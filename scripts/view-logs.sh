#!/bin/bash

# Simple log viewer for server logs

LOG_DIR="apps/server/logs"
LOG_FILE="$LOG_DIR/server.log"

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default lines to show
LINES=50

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -e|--errors)
            echo -e "${RED}Showing recent errors:${NC}"
            grep -iE "(error|fail|exception|crash)" $LOG_FILE | tail -n $LINES
            exit 0
            ;;
        -s|--search)
            PATTERN="$2"
            echo -e "${BLUE}Searching for '$PATTERN':${NC}"
            grep -i "$PATTERN" $LOG_FILE | tail -n $LINES
            exit 0
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -n, --lines N    Show last N lines (default: 50)"
            echo "  -e, --errors     Show only errors"
            echo "  -s, --search STR Search for string in logs"
            echo "  -h, --help       Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Check if log file exists
if [ ! -f "$LOG_FILE" ]; then
    echo -e "${YELLOW}Log file not found: $LOG_FILE${NC}"
    echo "The server may not have been started with logging enabled."
    echo "Run the server with: pnpm --filter server dev"
    exit 1
fi

# Display logs
echo -e "${BLUE}Showing last $LINES lines from: $LOG_FILE${NC}"
echo "----------------------------------------"

tail -n $LINES "$LOG_FILE"