#!/bin/bash
# setup-master-password.sh - Master password management for secure worktree setup
# This script handles master password input and validation for encrypted secrets

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to securely prompt for password
prompt_password() {
    local prompt="$1"
    local password
    
    echo -n "$prompt"
    read -s password
    echo
    echo "$password"
}

# Function to validate master password by attempting to decrypt a test value
validate_master_password() {
    local password="$1"
    local temp_sql=$(mktemp)
    
    cat > "$temp_sql" << EOF
-- Test master password by attempting to decrypt
DO \$\$
DECLARE
    test_result TEXT;
BEGIN
    -- Try to decrypt any existing secure config value
    SELECT get_secure_config(
        (SELECT key FROM secure_config LIMIT 1), 
        '$password'
    ) INTO test_result;
    
    -- If we get here without error, password is correct
    RAISE NOTICE 'Password validation successful';
EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid master password or no encrypted data exists';
END;
\$\$;
EOF
    
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -f "$temp_sql" 2>/dev/null; then
        rm -f "$temp_sql"
        return 0
    else
        rm -f "$temp_sql"
        return 1
    fi
}

# Function to check if encrypted secrets exist
check_encrypted_secrets_exist() {
    local count=$(psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -t -c "SELECT COUNT(*) FROM secure_config;" 2>/dev/null | xargs)
    
    if [[ "$count" -gt 0 ]]; then
        return 0  # Secrets exist
    else
        return 1  # No secrets
    fi
}

# Function to initialize secure secrets storage
initialize_secure_storage() {
    print_status "Initializing secure secrets storage..."
    
    # Run the setup SQL script
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -f "${SCRIPT_DIR}/setup-encrypted-secrets.sql"; then
        print_success "Secure storage initialized"
        return 0
    else
        print_error "Failed to initialize secure storage"
        return 1
    fi
}

# Function to create initial encrypted secrets
create_initial_secrets() {
    local master_password="$1"
    local temp_sql=$(mktemp)
    
    print_status "Creating initial encrypted secrets..."
    
    cat > "$temp_sql" << 'EOF'
-- Create initial encrypted secrets with placeholder values
-- Users should update these with real values after setup

SELECT set_secure_config('NEON_API_KEY', 'your-neon-api-key-here', $1, 'Neon database API key');
SELECT set_secure_config('GITHUB_TOKEN', 'your-github-token-here', $1, 'GitHub personal access token');
SELECT set_secure_config('OPENAI_API_KEY', 'your-openai-api-key-here', $1, 'OpenAI API key');
SELECT set_secure_config('STRIPE_SECRET_KEY', 'your-stripe-secret-key-here', $1, 'Stripe secret key');
SELECT set_secure_config('JWT_SECRET', $2, $1, 'JWT signing secret');
EOF
    
    # Generate a random JWT secret
    local jwt_secret=$(openssl rand -base64 32)
    
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -f "$temp_sql" -v ON_ERROR_STOP=1 -v master_password="$master_password" -v jwt_secret="$jwt_secret"; then
        rm -f "$temp_sql"
        print_success "Initial secrets created with placeholder values"
        print_warning "Please update the placeholder values with your real API keys:"
        print_warning "  - NEON_API_KEY"
        print_warning "  - GITHUB_TOKEN" 
        print_warning "  - OPENAI_API_KEY"
        print_warning "  - STRIPE_SECRET_KEY"
        print_warning "Use the update-secret.sh script to set real values"
        return 0
    else
        rm -f "$temp_sql"
        print_error "Failed to create initial secrets"
        return 1
    fi
}

# Function to save master password to local env (for development convenience)
save_master_password_locally() {
    local password="$1"
    local env_file="${PROJECT_ROOT}/.env.local"
    
    # Create or update .env.local with master password
    if [[ -f "$env_file" ]]; then
        # Remove existing VIBESTACK_MASTER_PASSWORD line
        sed -i '/^VIBESTACK_MASTER_PASSWORD=/d' "$env_file"
    fi
    
    echo "VIBESTACK_MASTER_PASSWORD=${password}" >> "$env_file"
    print_success "Master password saved to .env.local"
    print_warning "Keep this file secure and never commit it to git"
}

# Main function
main() {
    print_status "VibeStack Secure Secrets Setup"
    echo
    
    # Initialize secure storage if needed
    if ! check_encrypted_secrets_exist; then
        print_status "No encrypted secrets found. Initializing secure storage..."
        if ! initialize_secure_storage; then
            print_error "Failed to initialize secure storage"
            exit 1
        fi
        
        # Create new master password
        print_status "Creating new master password for encrypted secrets..."
        
        while true; do
            master_password=$(prompt_password "Enter new master password: ")
            confirm_password=$(prompt_password "Confirm master password: ")
            
            if [[ "$master_password" == "$confirm_password" ]]; then
                if [[ ${#master_password} -lt 8 ]]; then
                    print_error "Password must be at least 8 characters long"
                    continue
                fi
                break
            else
                print_error "Passwords do not match. Please try again."
            fi
        done
        
        # Create initial secrets
        if create_initial_secrets "$master_password"; then
            save_master_password_locally "$master_password"
            print_success "Secure secrets setup completed!"
        else
            print_error "Failed to create initial secrets"
            exit 1
        fi
        
    else
        # Validate existing master password
        print_status "Encrypted secrets exist. Validating master password..."
        
        # Try to get password from .env.local first
        local env_password=""
        if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
            env_password=$(grep "^VIBESTACK_MASTER_PASSWORD=" "${PROJECT_ROOT}/.env.local" | cut -d'=' -f2- || true)
        fi
        
        if [[ -n "$env_password" ]]; then
            print_status "Found master password in .env.local, validating..."
            if validate_master_password "$env_password"; then
                print_success "Master password validation successful"
                export VIBESTACK_MASTER_PASSWORD="$env_password"
                return 0
            else
                print_warning "Stored master password is invalid"
            fi
        fi
        
        # Prompt for password
        local attempts=0
        while [[ $attempts -lt 3 ]]; do
            master_password=$(prompt_password "Enter master password: ")
            
            if validate_master_password "$master_password"; then
                print_success "Master password validation successful"
                save_master_password_locally "$master_password"
                export VIBESTACK_MASTER_PASSWORD="$master_password"
                return 0
            else
                attempts=$((attempts + 1))
                print_error "Invalid master password. Attempt $attempts/3"
            fi
        done
        
        print_error "Failed to validate master password after 3 attempts"
        exit 1
    fi
}

# Check if script is being sourced or executed
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi