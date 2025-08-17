#!/bin/bash
# update-secret.sh - Update individual encrypted secrets
# Usage: ./update-secret.sh <key> [value]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Colors for output  
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Function to get master password
get_master_password() {
    # Try to get from environment
    if [[ -n "$VIBESTACK_MASTER_PASSWORD" ]]; then
        echo "$VIBESTACK_MASTER_PASSWORD"
        return 0
    fi
    
    # Try to get from .env.local
    if [[ -f "${PROJECT_ROOT}/.env.local" ]]; then
        local env_password=$(grep "^VIBESTACK_MASTER_PASSWORD=" "${PROJECT_ROOT}/.env.local" | cut -d'=' -f2- || true)
        if [[ -n "$env_password" ]]; then
            echo "$env_password"
            return 0
        fi
    fi
    
    # Prompt for password
    prompt_password "Enter master password: "
}

# Function to list all secret keys
list_secrets() {
    local master_password="$1"
    local temp_sql=$(mktemp)
    
    cat > "$temp_sql" << EOF
SELECT list_secure_config_keys();
EOF
    
    print_status "Available secret keys:"
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -f "$temp_sql" 2>/dev/null; then
        rm -f "$temp_sql"
        return 0
    else
        rm -f "$temp_sql"
        print_error "Failed to list secrets"
        return 1
    fi
}

# Function to update a secret
update_secret() {
    local key="$1"
    local value="$2"
    local master_password="$3"
    local description="${4:-Updated secret value}"
    
    local temp_sql=$(mktemp)
    
    cat > "$temp_sql" << EOF
SELECT set_secure_config('$key', '$value', '$master_password', '$description');
EOF
    
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -f "$temp_sql" 2>/dev/null; then
        rm -f "$temp_sql"
        print_success "Secret '$key' updated successfully"
        return 0
    else
        rm -f "$temp_sql"
        print_error "Failed to update secret '$key'"
        return 1
    fi
}

# Function to get a secret (for verification)
get_secret() {
    local key="$1"
    local master_password="$2"
    local temp_sql=$(mktemp)
    
    cat > "$temp_sql" << EOF
SELECT get_secure_config('$key', '$master_password');
EOF
    
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -t -f "$temp_sql" 2>/dev/null; then
        rm -f "$temp_sql"
        return 0
    else
        rm -f "$temp_sql"
        return 1
    fi
}

# Main function
main() {
    local key="$1"
    local value="$2"
    
    if [[ -z "$key" ]]; then
        echo "Usage: $0 <key> [value]"
        echo "       $0 --list              # List all secret keys"
        echo "       $0 --get <key>         # Get decrypted value (for verification)"
        echo ""
        echo "Examples:"
        echo "  $0 NEON_API_KEY"
        echo "  $0 GITHUB_TOKEN ghp_xxxxxxxxxxxx"
        echo "  $0 --list"
        echo "  $0 --get NEON_API_KEY"
        exit 1
    fi
    
    # Get master password
    local master_password
    master_password=$(get_master_password)
    
    if [[ -z "$master_password" ]]; then
        print_error "No master password provided"
        exit 1
    fi
    
    # Handle special commands
    if [[ "$key" == "--list" ]]; then
        list_secrets "$master_password"
        exit $?
    fi
    
    if [[ "$key" == "--get" ]]; then
        if [[ -z "$value" ]]; then
            print_error "Please specify a key to retrieve"
            exit 1
        fi
        local secret_value
        secret_value=$(get_secret "$value" "$master_password")
        if [[ $? -eq 0 ]]; then
            print_success "Secret '$value':"
            echo "$secret_value"
        else
            print_error "Failed to retrieve secret '$value'"
            exit 1
        fi
        exit 0
    fi
    
    # Update secret
    if [[ -z "$value" ]]; then
        # Prompt for value
        if [[ "$key" == *"PASSWORD"* ]] || [[ "$key" == *"SECRET"* ]] || [[ "$key" == *"KEY"* ]]; then
            value=$(prompt_password "Enter value for $key: ")
        else
            echo -n "Enter value for $key: "
            read value
        fi
    fi
    
    if [[ -z "$value" ]]; then
        print_error "No value provided"
        exit 1
    fi
    
    update_secret "$key" "$value" "$master_password"
}

main "$@"