#!/bin/bash

# Development server wrapper with logging configuration
# Usage: ./scripts/dev-with-logging.sh [preset] [additional-args]
# 
# Presets:
#   quiet - Errors only (perfect for MCP/testing)
#   sync - Sync and state contexts
#   ui - UI context only
#   ui-quiet-vibegrid - UI context with quiet VibeGrid
#   debug - Multiple debug contexts
#   all - All contexts
#   vibegrid-only - Only VibeGrid components at debug level
#   custom - Custom configuration (see below)
#
# Custom usage:
#   ./scripts/dev-with-logging.sh custom --contexts=ui,sync --level=debug --file-levels=vibegrid:warn,universe-loader:info

set -e

PRESET=${1:-"dev"}
shift || true  # Remove first argument if it exists

# Set default values
CONTEXTS=""
LEVEL="error"
FILE_LEVELS=""
MUTED_FILES=""
ONLY_FILES=""

# Parse preset or custom configuration
case $PRESET in
    "quiet")
        CONTEXTS=""
        LEVEL="error"
        ;;
    
    "sync")
        CONTEXTS="sync,state"
        LEVEL="debug"
        ;;
    
    "ui")
        CONTEXTS="ui"
        LEVEL="debug"
        ;;
    
    "ui-quiet-vibegrid")
        # Keep most UI quiet but show VibeGrid details
        CONTEXTS="ui"
        LEVEL="error"  # Most UI components only show errors (quiet)
        FILE_LEVELS="vibegrid:info"  # VibeGrid shows info level and above
        ;;
    
    "ui-focus-vibegrid")
        # Quiet everything except VibeGrid
        CONTEXTS="ui"
        LEVEL="error"  # Most UI components only show errors
        FILE_LEVELS="vibegrid:debug"  # VibeGrid shows everything
        ;;
    
    "debug")
        CONTEXTS="sync,state,ui,data"
        LEVEL="debug"
        ;;
    
    "debug-quiet-vibegrid")
        CONTEXTS="sync,state,ui,data"
        LEVEL="debug"
        FILE_LEVELS="vibegrid:warn"
        ;;
    
    "all")
        CONTEXTS="sync,state,ui,data,auth,routing,performance,testing,debug"
        LEVEL="debug"
        ;;
    
    "vibegrid-only")
        # Only show VibeGrid component logs at debug level
        CONTEXTS="none"
        LEVEL="error"
        FILE_LEVELS="vibegrid:debug"
        ;;
    
    "focus-file")
        # Example: ./scripts/dev-with-logging.sh focus-file universe-loader
        CONTEXTS="ui,state"
        LEVEL="error"
        ONLY_FILES="${1:-universe-loader}"
        shift || true
        ;;
    
    "custom")
        # Parse custom arguments
        for arg in "$@"; do
            case $arg in
                --contexts=*)
                    CONTEXTS="${arg#*=}"
                    ;;
                --level=*)
                    LEVEL="${arg#*=}"
                    ;;
                --file-levels=*)
                    FILE_LEVELS="${arg#*=}"
                    ;;
                --muted=*)
                    MUTED_FILES="${arg#*=}"
                    ;;
                --only=*)
                    ONLY_FILES="${arg#*=}"
                    ;;
            esac
        done
        ;;
    
    "dev"|*)
        # Default development mode - no special logging
        CONTEXTS=""
        LEVEL="error"
        ;;
esac

# Build the environment variable exports
ENV_VARS=""
ENV_VARS="VITE_LOG_CONTEXTS='$CONTEXTS'"
ENV_VARS="$ENV_VARS VITE_LOG_LEVEL='$LEVEL'"

if [ -n "$FILE_LEVELS" ]; then
    ENV_VARS="$ENV_VARS VITE_LOG_FILE_LEVELS='$FILE_LEVELS'"
fi

if [ -n "$MUTED_FILES" ]; then
    ENV_VARS="$ENV_VARS VITE_LOG_MUTED_FILES='$MUTED_FILES'"
fi

if [ -n "$ONLY_FILES" ]; then
    ENV_VARS="$ENV_VARS VITE_LOG_ONLY_FILES='$ONLY_FILES'"
fi

# Display configuration
echo "🎯 Starting dev server with logging configuration:"
echo "  Contexts: ${CONTEXTS:-none}"
echo "  Level: $LEVEL"
[ -n "$FILE_LEVELS" ] && echo "  File levels: $FILE_LEVELS"
[ -n "$MUTED_FILES" ] && echo "  Muted files: $MUTED_FILES"
[ -n "$ONLY_FILES" ] && echo "  Only files: $ONLY_FILES"
echo ""

# Ensure Docker is running
pnpm ensure-docker:local

# Start the dev server with the environment variables
eval "$ENV_VARS pnpm --filter ./apps/worker dev"