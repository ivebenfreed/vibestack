#!/bin/bash

# Simple helper to show available logging dev scripts
# The actual logging is controlled by dev scripts in package.json

set -e

show_commands() {
    echo "🎯 Logging Focus Commands"
    echo ""
    echo "Use these pnpm scripts to control logging during development:"
    echo ""
    echo "  pnpm dev:quiet    # Silent mode (errors only)"
    echo "  pnpm dev:sync     # Focus on sync and state operations"
    echo "  pnpm dev:ui       # Focus on UI components only"
    echo "  pnpm dev:debug    # Debug mode (sync, state, ui, data contexts)"
    echo "  pnpm dev:all      # All contexts enabled"
    echo "  pnpm dev          # Normal development (no special logging)"
    echo ""
    echo "Runtime control (in browser console):"
    echo "  logControl.focus('ui')          # Only UI logs"
    echo "  logControl.focus('none')        # Silent mode"
    echo "  logControl.only('ui', 'sync')   # Multiple contexts"
    echo "  logControl.clear()              # Clear context filters"
    echo "  logControl.status()             # Check current filters"
    echo ""
    echo "Available contexts: sync, state, ui, data, auth, routing, performance, testing, debug"
    echo ""
    echo "Note: Logging is controlled via environment variables passed directly"
    echo "      to the dev scripts. No .env file modification needed."
}

# Always show help
show_commands