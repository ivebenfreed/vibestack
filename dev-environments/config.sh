#!/bin/bash
# Configuration for multi-environment development setup

# Base configuration
export BASE_DIR="/home/benfreed/dev"
export PROJECT_NAME="vibestack"
export MAIN_DIR="${BASE_DIR}/${PROJECT_NAME}"

# Environment definitions
declare -A ENVIRONMENTS
ENVIRONMENTS["main"]="5174:${MAIN_DIR}"
ENVIRONMENTS["dev-1"]="5175:${BASE_DIR}/${PROJECT_NAME}-dev-1"  
ENVIRONMENTS["dev-2"]="5176:${BASE_DIR}/${PROJECT_NAME}-dev-2"

# Database configuration (shared across all environments)
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/vibestack_dev"

# Git configuration
export MAIN_BRANCH="staging"
export REMOTE_NAME="origin"

# Process management
export PID_DIR="${MAIN_DIR}/dev-environments/.pids"
export LOG_DIR="${MAIN_DIR}/dev-environments/.logs"

# Colors for output
export RED='\033[0;31m'
export GREEN='\033[0;32m'
export YELLOW='\033[1;33m'
export BLUE='\033[0;34m'
export NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"  
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

get_env_port() {
    local env_name=$1
    echo "${ENVIRONMENTS[$env_name]}" | cut -d: -f1
}

get_env_dir() {
    local env_name=$1  
    echo "${ENVIRONMENTS[$env_name]}" | cut -d: -f2
}

is_port_in_use() {
    local port=$1
    lsof -ti:$port > /dev/null 2>&1
}

get_pid_for_env() {
    local env_name=$1
    local pid_file="${PID_DIR}/${env_name}.pid"
    if [[ -f "$pid_file" ]]; then
        cat "$pid_file"
    fi
}

is_env_running() {
    local env_name=$1
    local pid=$(get_pid_for_env "$env_name")
    if [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

ensure_dirs() {
    mkdir -p "$PID_DIR"
    mkdir -p "$LOG_DIR"
}

# Ensure directories exist
ensure_dirs