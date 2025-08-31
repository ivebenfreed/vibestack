#!/bin/bash

# Set logging focus for development
# Usage: ./scripts/set-log-focus.sh [focus-type]
# Focus types: vibegrid, sync, ui, data, auth, quiet, all

set -e

FOCUS_TYPE=${1:-"help"}

# Auto-detect which app to use based on current directory
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

if [[ $PWD == *"/apps/worker"* ]] || [[ $PWD == */apps/worker ]]; then
    ENV_LOCAL="$REPO_ROOT/apps/worker/.env.local"
    APP_NAME="unified worker"
elif [[ $PWD == *"/apps/web"* ]] || [[ $PWD == */apps/web ]]; then
    ENV_LOCAL="$REPO_ROOT/apps/web/.env.local"
    APP_NAME="web app"
else
    # Default to web for backwards compatibility when run from root
    ENV_LOCAL="$REPO_ROOT/apps/web/.env.local"
    APP_NAME="web app (default)"
fi

show_help() {
    echo "🎯 Set logging focus for development"
    echo ""
    echo "Usage: $0 [focus-type]"
    echo ""
    echo "Focus types:"
    echo "  vibegrid   Focus on VibeGrid components (UI debugging)"
    echo "  sync       Focus on sync operations and state machines"  
    echo "  ui         Focus on all UI components and interactions"
    echo "  data       Focus on data operations, CRUD, queries"
    echo "  auth       Focus on authentication and permissions"
    echo "  state      Focus on state management and stores"
    echo "  quiet      Silent mode (errors only)"
    echo "  quiet-except 'files'  Quiet mode except specific files"
    echo "  all        Enable all logging (default)"
    echo "  clear      Remove all logging configuration"
    echo ""
    echo "Examples:"
    echo "  $0 vibegrid    # Focus on VibeGrid development"
    echo "  $0 sync        # Debug sync issues"
    echo "  $0 quiet       # Clean console for MCP work"
    echo "  $0 quiet-except 'components/custom/vibegrid/VibeGrid.tsx'  # Only one file logs"
}

if [ "$FOCUS_TYPE" = "help" ] || [ "$FOCUS_TYPE" = "-h" ] || [ "$FOCUS_TYPE" = "--help" ]; then
    show_help
    exit 0
fi

if [ ! -f "$ENV_LOCAL" ]; then
    echo "❌ No .env.local found. Run 'pnpm setup:env' first."
    exit 1
fi

# Remove any existing log configuration
sed -i '/^VITE_LOG_/d' "$ENV_LOCAL" 2>/dev/null || true

case $FOCUS_TYPE in
    "vibegrid")
        echo "🎯 Setting focus to VibeGrid components..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: VibeGrid development
VITE_LOG_PATTERNS=components/custom/vibegrid/*,components/tables/UltraTable/*
VITE_LOG_CONTEXTS=ui,state
VITE_LOG_LEVEL=debug
VITE_LOG_DISABLED_PATTERNS=sync/*,auth/*,tests/*,archive/*
EOF
        ;;
    
    "sync")
        echo "🔄 Setting focus to sync operations..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: Sync debugging
VITE_LOG_PATTERNS=sync/*,state-machines/*
VITE_LOG_CONTEXTS=sync,state
VITE_LOG_LEVEL=debug
VITE_LOG_DISABLED_PATTERNS=components/*,tests/*,archive/*
EOF
        ;;
    
    "ui")
        echo "🎨 Setting focus to UI components..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: UI components
VITE_LOG_CONTEXTS=ui
VITE_LOG_LEVEL=info
VITE_LOG_DISABLED_PATTERNS=sync/*,auth/*,tests/*,archive/*
EOF
        ;;
    
    "data")
        echo "💾 Setting focus to data operations..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: Data operations
VITE_LOG_PATTERNS=stores/*,lib/*,api/*
VITE_LOG_CONTEXTS=data,state
VITE_LOG_LEVEL=info
VITE_LOG_DISABLED_PATTERNS=components/*,tests/*,archive/*
EOF
        ;;
    
    "auth")
        echo "🔐 Setting focus to authentication..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: Authentication
VITE_LOG_PATTERNS=auth/*,lib/auth*,routes/*auth*
VITE_LOG_CONTEXTS=auth,routing
VITE_LOG_LEVEL=info
VITE_LOG_DISABLED_PATTERNS=components/*,sync/*,tests/*,archive/*
EOF
        ;;
    
    "state")
        echo "📊 Setting focus to state management..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: State management
VITE_LOG_PATTERNS=stores/*,state-machines/*,legend-state/*
VITE_LOG_CONTEXTS=state,data
VITE_LOG_LEVEL=debug
VITE_LOG_DISABLED_PATTERNS=components/*,tests/*,archive/*
EOF
        ;;
    
    "quiet")
        echo "🔇 Setting quiet mode (errors only)..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: Quiet mode (errors only)
VITE_LOG_FOCUS_MODE=none
VITE_LOG_LEVEL=error
EOF
        ;;
    
    "quiet-except")
        if [ -z "$2" ]; then
            echo "❌ Usage: $0 quiet-except 'pattern1,pattern2'"
            echo "Example: $0 quiet-except 'components/custom/vibegrid/VibeGrid.tsx,sync/WebSocketService.ts'"
            exit 1
        fi
        PATTERNS="$2"
        echo "🔇 Setting quiet mode with exceptions for: $PATTERNS"
        cat >> "$ENV_LOCAL" << EOF

# Logging focus: Quiet mode with specific file exceptions
VITE_LOG_FOCUS_MODE=none
VITE_LOG_LEVEL=error
# Override for specific files:
VITE_LOG_PATTERNS=$PATTERNS
VITE_LOG_CONTEXTS=ui,sync,data
EOF
        ;;
    
    "all")
        echo "📋 Enabling all logging..."
        cat >> "$ENV_LOCAL" << 'EOF'

# Logging focus: All logging enabled
VITE_LOG_FOCUS_MODE=all
VITE_LOG_LEVEL=info
EOF
        ;;
    
    "clear")
        echo "🗑️  Cleared logging configuration"
        ;;
    
    *)
        echo "❌ Unknown focus type: $FOCUS_TYPE"
        echo "Run '$0 help' for available options."
        exit 1
        ;;
esac

echo "✅ Logging focus updated in $ENV_LOCAL ($APP_NAME)"
echo "💡 Restart your dev server to apply changes"
echo "🌐 Or use browser console: logControl.focus('$FOCUS_TYPE')"