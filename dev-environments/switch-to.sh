#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Function to switch to environment
switch_to_environment() {
    local env_name=$1
    local env_dir=$(get_env_dir "$env_name")
    local env_port=$(get_env_port "$env_name")
    
    # Check if environment directory exists
    if [[ ! -d "$env_dir" ]]; then
        log_error "Environment directory not found: $env_dir"
        log_info "Run ./dev-environments/setup-worktrees.sh first"
        return 1
    fi
    
    # Check if environment is running
    if ! is_env_running "$env_name"; then
        log_warning "$env_name is not running. Starting it now..."
        "$SCRIPT_DIR/start-env.sh" "$env_name" || return 1
    fi
    
    log_success "Switching to $env_name environment"
    log_info "Directory: $env_dir"
    log_info "URL: http://localhost:$env_port"
    
    # Change to environment directory
    cd "$env_dir"
    
    # Set environment variables for this session
    export ENVIRONMENT_NAME="$env_name"
    export ENVIRONMENT_PORT="$env_port"  
    export ENVIRONMENT_DIR="$env_dir"
    
    # Update shell prompt to show current environment
    export PS1="($env_name) \[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "
    
    log_info ""
    log_info "🎯 Now in $env_name environment"
    log_info "   Working directory: $(pwd)"
    log_info "   Git branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"
    log_info "   Development server: http://localhost:$env_port"
    log_info ""
    log_info "💡 Tips:"
    log_info "   • Create feature branch: git checkout -b feature/my-feature"  
    log_info "   • View logs: tail -f ${LOG_DIR}/${env_name}.log"
    log_info "   • Check status: ../../dev-environments/status.sh"
    log_info "   • Switch back: cd $MAIN_DIR"
    
    # Start a new shell in the environment directory with custom prompt
    exec bash --rcfile <(echo "
        source ~/.bashrc 2>/dev/null || true
        export PS1='($env_name) \[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ '
        export ENVIRONMENT_NAME='$env_name'
        export ENVIRONMENT_PORT='$env_port'
        export ENVIRONMENT_DIR='$env_dir'
        cd '$env_dir'
        
        # Show environment info on shell start
        echo -e '${BLUE}🎯 $env_name Environment Active${NC}'
        echo -e '   URL: ${GREEN}http://localhost:$env_port${NC}'
        echo -e '   Dir: ${YELLOW}$(pwd)${NC}'
        echo -e '   Branch: ${GREEN}$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo \"unknown\")${NC}'
        echo ''
    ")
}

# Main script logic
if [[ $# -eq 0 ]]; then
    log_error "Usage: $0 <environment_name>"
    log_info "Available environments: ${!ENVIRONMENTS[*]}"
    
    # Show current environment status
    echo ""
    "$SCRIPT_DIR/status.sh"
    exit 1
fi

env_name=$1

# Validate environment name  
if [[ -z "${ENVIRONMENTS[$env_name]}" ]]; then
    log_error "Unknown environment: $env_name"
    log_info "Available environments: ${!ENVIRONMENTS[*]}"
    exit 1
fi

switch_to_environment "$env_name"