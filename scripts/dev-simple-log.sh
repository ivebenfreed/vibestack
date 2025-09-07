#!/bin/bash

# Simple development server wrapper with global log level
# Usage: ./scripts/dev-simple-log.sh [log-level]
# 
# Log levels:
#   off - No logs (default)
#   error - Errors only  
#   warn - Warnings and errors
#   info - Info messages and above
#   debug - All logs
#
# To control logging per-file, edit the LOG_LEVEL const in each file:
#   const LOG_LEVEL: LogLevel = 'debug';  // Change as needed

set -e

LOG_LEVEL=${1:-"error"}

# Display configuration
echo "🎯 Starting dev server with simple logging"
echo "  Global log level: $LOG_LEVEL"
echo ""
echo "📝 To enable logs for specific files, edit the LOG_LEVEL const in each file:"
echo "   const LOG_LEVEL: LogLevel = 'debug';  // or 'info', 'warn', 'error', 'off'"
echo ""

# Ensure Docker is running
pnpm ensure-docker:local

# Start the dev server with the global log level
VITE_LOG_LEVEL="$LOG_LEVEL" pnpm --filter ./apps/worker dev