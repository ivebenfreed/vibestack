#!/bin/bash

# Simplified logging focus for development
# Usage: ./scripts/set-log-focus.sh [contexts]
# Contexts: sync,state,ui,data,auth,routing,performance,testing,debug

set -e

CONTEXTS=${1:-"help"}

# Auto-detect environment file
SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_LOCAL="$REPO_ROOT/apps/worker/.env.local"

show_help() {
    echo "🎯 Simple logging focus for development"
    echo ""
    echo "Usage: $0 [contexts|preset]"
    echo ""
    echo "Presets:"
    echo "  sync       Only sync and state logs"
    echo "  ui         Only UI logs" 
    echo "  data       Only data logs"
    echo "  state      Only state management logs"
    echo "  all        All contexts (default)"
    echo "  none       No logs (errors only)"
    echo "  clear      Remove logging config"
    echo ""
    echo "Custom contexts (comma-separated):"
    echo "  sync,state       Multiple contexts"
    echo "  ui,data,auth     Custom combination"
    echo ""
    echo "Available contexts: sync, state, ui, data, auth, routing, performance, testing, debug"
    echo ""
    echo "Examples:"
    echo "  $0 sync          # Focus on sync operations"
    echo "  $0 sync,state    # Focus on sync and state management"
    echo "  $0 ui,data       # Focus on UI and data operations"
    echo "  $0 all           # Enable all logging"
    echo "  $0 none          # Disable all logging"
}

if [ "$CONTEXTS" = "help" ] || [ "$CONTEXTS" = "-h" ] || [ "$CONTEXTS" = "--help" ]; then
    show_help
    exit 0
fi

if [ ! -f "$ENV_LOCAL" ]; then
    echo "❌ No .env.local found. Run 'pnpm setup:env' first."
    exit 1
fi

# Remove any existing log configuration
sed -i '/^VITE_LOG_/d' "$ENV_LOCAL" 2>/dev/null || true

case $CONTEXTS in
    "sync")
        echo "🔄 Focusing on sync operations..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: Sync operations" >> "$ENV_LOCAL"
        echo "VITE_LOG_CONTEXTS=sync,state" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=debug" >> "$ENV_LOCAL"
        ;;
    
    "state")
        echo "📊 Focusing on state management..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: State management" >> "$ENV_LOCAL"
        echo "VITE_LOG_CONTEXTS=state,data" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=debug" >> "$ENV_LOCAL"
        ;;
    
    "ui")
        echo "🎨 Focusing on UI components..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: UI components" >> "$ENV_LOCAL"
        echo "VITE_LOG_CONTEXTS=ui" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=info" >> "$ENV_LOCAL"
        ;;
    
    "data")
        echo "💾 Focusing on data operations..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: Data operations" >> "$ENV_LOCAL"
        echo "VITE_LOG_CONTEXTS=data" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=info" >> "$ENV_LOCAL"
        ;;
        
    "all")
        echo "🌍 Enabling all logging..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: All contexts enabled" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=info" >> "$ENV_LOCAL"
        ;;
    
    "none")
        echo "🔇 Disabling all logging (errors only)..."
        echo "" >> "$ENV_LOCAL"
        echo "# Logging focus: Errors only" >> "$ENV_LOCAL"
        echo "VITE_LOG_CONTEXTS=" >> "$ENV_LOCAL"
        echo "VITE_LOG_LEVEL=error" >> "$ENV_LOCAL"
        ;;
    
    "clear")
        echo "🗑️  Cleared logging configuration"
        ;;
    
    *)
        # Custom contexts (comma-separated)
        if [[ "$CONTEXTS" =~ ^[a-z,]+$ ]]; then
            echo "🎯 Setting custom contexts: $CONTEXTS"
            echo "" >> "$ENV_LOCAL"
            echo "# Logging focus: Custom contexts" >> "$ENV_LOCAL"
            echo "VITE_LOG_CONTEXTS=$CONTEXTS" >> "$ENV_LOCAL"
            echo "VITE_LOG_LEVEL=debug" >> "$ENV_LOCAL"
        else
            echo "❌ Invalid contexts: $CONTEXTS"
            echo "Valid contexts: sync, state, ui, data, auth, routing, performance, testing, debug"
            echo "Use comma separation for multiple: sync,state,ui"
            exit 1
        fi
        ;;
esac

echo "✅ Logging focus updated in $ENV_LOCAL"
echo "💡 Restart your dev server to apply changes"
echo "🌐 Or use browser console: logControl.only('$CONTEXTS')"