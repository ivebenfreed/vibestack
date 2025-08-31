#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

# Function to start a single environment
start_environment() {
    local env_name=$1
    local env_dir=$(get_env_dir "$env_name")
    local env_port=$(get_env_port "$env_name")
    local pid_file="${PID_DIR}/${env_name}.pid"
    local log_file="${LOG_DIR}/${env_name}.log"
    
    # Check if already running
    if is_env_running "$env_name"; then
        log_warning "$env_name already running (PID: $(get_pid_for_env "$env_name"), port $env_port)"
        return 0
    fi
    
    # Check if directory exists
    if [[ ! -d "$env_dir" ]]; then
        log_error "Environment directory not found: $env_dir"
        log_info "Run ./dev-environments/setup-worktrees.sh first"
        return 1
    fi
    
    # Check if port is available
    if is_port_in_use "$env_port"; then
        log_error "Port $env_port is already in use (needed for $env_name)"
        log_info "Stop the process using: lsof -ti:$env_port | xargs kill"
        return 1
    fi
    
    log_info "Starting $env_name environment at $env_dir (port $env_port)"
    
    # Change to environment directory
    cd "$env_dir"
    
    # Ensure dependencies are installed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies for $env_name"
        pnpm install
    fi
    
    # Start the development server in background
    log_info "Starting unified Cloudflare Worker for $env_name"
    
    # Use different approach for main vs worktree environments
    if [[ "$env_name" == "main" ]]; then
        # Main environment: use existing dev process if running, otherwise start new
        if pgrep -f "pnpm dev" > /dev/null; then
            local existing_pid=$(pgrep -f "pnpm dev")
            echo "$existing_pid" > "$pid_file"
            log_success "$env_name using existing dev process (PID: $existing_pid)"
        else
            # Start new dev process for main
            nohup pnpm dev > "$log_file" 2>&1 &
            local new_pid=$!
            echo "$new_pid" > "$pid_file"
            log_success "$env_name started (PID: $new_pid, port $env_port)"
        fi
    else
        # Dev environments: always start fresh
        cd apps/worker
        nohup pnpm dev > "$log_file" 2>&1 &
        local new_pid=$!
        echo "$new_pid" > "$pid_file"
        log_success "$env_name started (PID: $new_pid, port $env_port)"
    fi
    
    # Wait a moment and verify it's running
    sleep 2
    if is_env_running "$env_name"; then
        log_success "$env_name successfully started"
        log_info "  URL: http://localhost:$env_port"
        log_info "  Logs: tail -f $log_file"
    else
        log_error "$env_name failed to start. Check logs: $log_file"
        return 1
    fi
}

# Main script logic
if [[ $# -eq 0 ]]; then
    log_error "Usage: $0 <environment_name>"
    log_info "Available environments: ${!ENVIRONMENTS[*]}"
    exit 1
fi

env_name=$1

# Validate environment name
if [[ -z "${ENVIRONMENTS[$env_name]}" ]]; then
    log_error "Unknown environment: $env_name"
    log_info "Available environments: ${!ENVIRONMENTS[*]}"
    exit 1
fi

start_environment "$env_name"