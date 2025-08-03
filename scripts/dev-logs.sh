#!/bin/bash

# dev-logs.sh - Quick access to dev server logs
# Usage: ./scripts/dev-logs.sh [lines]
# Example: ./scripts/dev-logs.sh 100
#          ./scripts/dev-logs.sh     # Default 50 lines

set -euo pipefail

SESSION_NAME="vibestack-dev"
LINES="${1:-50}"

echo "📄 Development server logs (last $LINES lines)"
echo "Session: $SESSION_NAME"
echo ""

# Use the bg-logs.sh script to get logs from the dev session
./scripts/bg-logs.sh "$SESSION_NAME" "$LINES"