#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

log_info "Starting all development environments"

# Check if worktrees are set up
if [[ ! -d "$(get_env_dir "dev-1")" ]] || [[ ! -d "$(get_env_dir "dev-2")" ]]; then
    log_warning "Git worktrees not found. Setting up now..."
    "$SCRIPT_DIR/setup-worktrees.sh"
fi

# Start each environment
success_count=0
total_count=${#ENVIRONMENTS[@]}

for env_name in "${!ENVIRONMENTS[@]}"; do
    log_info ""
    log_info "Starting $env_name environment..."
    
    if "$SCRIPT_DIR/start-env.sh" "$env_name"; then
        ((success_count++))
    else
        log_error "Failed to start $env_name"
    fi
done

log_info ""
log_info "=================================================="
log_success "Started $success_count/$total_count environments"
log_info "=================================================="

# Show status
"$SCRIPT_DIR/status.sh"

log_info ""
log_info "🚀 Multi-environment development is ready!"
log_info ""
log_info "Usage:"
log_info "  • Main (staging): http://localhost:5174"
log_info "  • Dev-1 (features): http://localhost:5175" 
log_info "  • Dev-2 (features): http://localhost:5176"
log_info ""
log_info "Switch environments:"
log_info "  ./dev-environments/switch-to.sh dev-1"
log_info "  ./dev-environments/switch-to.sh dev-2"
log_info ""
log_info "Management:"
log_info "  ./dev-environments/status.sh     - Check status"
log_info "  ./dev-environments/stop-all.sh   - Stop all"
log_info "  ./dev-environments/logs.sh <env> - View logs"