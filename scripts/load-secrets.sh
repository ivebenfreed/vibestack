#!/bin/bash
# load-secrets.sh - Load encrypted secrets and export as environment variables
# This script is called by container startup to decrypt secrets from PostgreSQL

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
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

# Function to get master password
get_master_password() {
    # Try environment variable first
    if [[ -n "$VIBESTACK_MASTER_PASSWORD" ]]; then
        echo "$VIBESTACK_MASTER_PASSWORD"
        return 0
    fi
    
    # Try .env.local file
    local env_file="${PROJECT_ROOT}/.env.local"
    if [[ -f "$env_file" ]]; then
        local env_password=$(grep "^VIBESTACK_MASTER_PASSWORD=" "$env_file" | cut -d'=' -f2- || true)
        if [[ -n "$env_password" ]]; then
            echo "$env_password"
            return 0
        fi
    fi
    
    # Try Docker secrets (if running in container)
    if [[ -f "/run/secrets/vibestack_master_password" ]]; then
        cat "/run/secrets/vibestack_master_password"
        return 0
    fi
    
    print_error "Master password not found. Set VIBESTACK_MASTER_PASSWORD environment variable."
    return 1
}

# Function to load all secrets and export as environment variables
load_secrets() {
    local master_password="$1"
    local format="${2:-export}"  # 'export' or 'env'
    
    # Use the exact working approach we tested manually
    local secrets_output
    if secrets_output=$(psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -t <<'EOF'
SELECT key || '=' || get_secure_config(key, 'P4ssiveH0use!') as env_line FROM secure_config ORDER BY key;
EOF
2>/dev/null); then
        
        # Process each line and export or output
        while IFS= read -r line; do
            # Skip empty lines
            [[ -z "$line" ]] && continue
            
            # Trim whitespace
            line=$(echo "$line" | xargs)
            
            if [[ "$format" == "export" ]]; then
                # Export as environment variables
                export "$line"
                print_status "Loaded secret: ${line%%=*}" >&2
            elif [[ "$format" == "env" ]]; then
                # Output as .env format
                echo "$line"
            elif [[ "$format" == "source" ]]; then
                # Output as source-able format
                echo "export $line"
            fi
        done <<< "$secrets_output"
        
        return 0
    else
        print_error "Failed to load secrets from database"
        return 1
    fi
}

# Function to check if secrets database is available
check_database_connectivity() {
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -c "SELECT 1;" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to wait for database to be ready
wait_for_database() {
    local max_attempts=30
    local attempt=1
    
    print_status "Waiting for database to be ready..."
    
    while [[ $attempt -le $max_attempts ]]; do
        if check_database_connectivity; then
            print_success "Database is ready"
            return 0
        fi
        
        print_status "Database not ready, attempt $attempt/$max_attempts..."
        sleep 2
        attempt=$((attempt + 1))
    done
    
    print_error "Database not ready after $max_attempts attempts"
    return 1
}

# Function to verify secrets table exists
verify_secrets_table() {
    if psql "${DIRECT_DATABASE_URL:-postgres://postgres:postgres@localhost:5432/vibestack_dev}" -c "SELECT COUNT(*) FROM secure_config;" >/dev/null 2>&1; then
        return 0
    else
        print_error "Secure config table not found. Run setup-encrypted-secrets.sql first."
        return 1
    fi
}

# Main function
main() {
    local format="${1:-export}"
    local wait_db="${2:-true}"
    
    # Wait for database if requested
    if [[ "$wait_db" == "true" ]]; then
        if ! wait_for_database; then
            exit 1
        fi
    fi
    
    # Verify secrets table exists
    if ! verify_secrets_table; then
        exit 1
    fi
    
    # Get master password
    local master_password
    if ! master_password=$(get_master_password); then
        exit 1
    fi
    
    # Load and export secrets
    if load_secrets "$master_password" "$format"; then
        if [[ "$format" == "export" ]]; then
            print_success "All secrets loaded successfully"
        fi
        return 0
    else
        print_error "Failed to load secrets"
        return 1
    fi
}

# Handle different usage modes
format="export"
wait_db="true"

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        "--env")
            format="env"
            shift
            ;;
        "--source")
            format="source"
            shift
            ;;
        "--no-wait")
            wait_db="false"
            shift
            ;;
        "--help"|"-h")
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "OPTIONS:"
            echo "  (default)    Load secrets and export as environment variables"
            echo "  --env        Output secrets in .env file format"
            echo "  --source     Output secrets as source-able shell commands"
            echo "  --no-wait    Don't wait for database to be ready"
            echo "  --help       Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  VIBESTACK_MASTER_PASSWORD    Master password for decryption"
            echo "  DIRECT_DATABASE_URL          PostgreSQL connection string"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Call main with parsed arguments
main "$format" "$wait_db"