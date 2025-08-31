#!/bin/bash
set -e

# Load configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/config.sh"

log_info "Setting up git worktrees for multi-environment development"

# Ensure we're in the main repository
cd "$MAIN_DIR"

# Verify we're in a git repository
if [[ ! -d ".git" ]]; then
    log_error "Not in a git repository. Please run from $MAIN_DIR"
    exit 1
fi

# Create worktrees for dev environments
for env_name in "${!ENVIRONMENTS[@]}"; do
    if [[ "$env_name" == "main" ]]; then
        log_info "Skipping main environment (using existing directory)"
        continue
    fi
    
    env_dir=$(get_env_dir "$env_name")
    
    if [[ -d "$env_dir" ]]; then
        log_warning "Directory $env_dir already exists"
        
        # Check if it's already a worktree
        if git worktree list | grep -q "$env_dir"; then
            log_success "$env_name worktree already configured"
            continue
        else
            log_warning "Directory exists but is not a git worktree. Please remove manually: $env_dir"
            continue
        fi
    fi
    
    log_info "Creating git worktree for $env_name at $env_dir"
    
    # Create worktree on staging branch initially
    git worktree add "$env_dir" "$MAIN_BRANCH"
    
    # Set up environment-specific configuration
    cd "$env_dir"
    
    # Copy package files
    if [[ -f "$MAIN_DIR/package.json" ]]; then
        log_info "Installing dependencies for $env_name"
        pnpm install
    fi
    
    # Create environment-specific .env.local
    env_port=$(get_env_port "$env_name")
    log_info "Creating .env.local for $env_name (port $env_port)"
    
    cat > apps/worker/.env.local << EOF
# Environment-specific configuration for $env_name
BETTER_AUTH_URL=http://localhost:$env_port
VITE_API_BASE_URL=http://localhost:$env_port/api

# Shared database (all environments use same database)
DATABASE_URL=$DATABASE_URL

# Environment identifier  
ENVIRONMENT_NAME=$env_name
ENVIRONMENT_PORT=$env_port
EOF

    # Update vite.config.ts to use environment-specific port
    log_info "Updating vite.config.ts for $env_name (port $env_port)"
    
    if [[ -f "apps/worker/vite.config.ts" ]]; then
        # Update the port in vite.config.ts
        sed -i "s/port: 5174/port: $env_port/" apps/worker/vite.config.ts
        # Also ensure strictPort is false for fallback
        sed -i "s/strictPort: false/strictPort: true/" apps/worker/vite.config.ts
    fi
    
    log_success "Created $env_name worktree at $env_dir"
done

cd "$MAIN_DIR"

log_success "Git worktrees setup complete!"
log_info ""
log_info "Worktree locations:"
for env_name in "${!ENVIRONMENTS[@]}"; do
    env_dir=$(get_env_dir "$env_name")
    env_port=$(get_env_port "$env_name")
    log_info "  $env_name: $env_dir (port $env_port)"
done

log_info ""
log_info "Next steps:"
log_info "  1. Run: ./dev-environments/start-all.sh"
log_info "  2. Use: ./dev-environments/switch-to.sh dev-1"
log_info "  3. Create feature branches in each environment as needed"