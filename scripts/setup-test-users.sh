#!/bin/bash

# setup-test-users.sh - Set up test users for development
# This script creates test users using the bootstrap endpoint

set -euo pipefail

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
SERVER_URL="${SERVER_URL:-http://localhost:8787}"
BOOTSTRAP_SECRET="${BOOTSTRAP_SECRET:-c1a7b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1b3e2d8f0c9a1}"

echo "🚀 Setting up test users for development"
echo "=================================="
echo "Server: $SERVER_URL"
echo ""

# Function to create a user
create_user() {
    local email="$1"
    local password="$2"
    local name="$3"
    local role="${4:-user}"
    
    echo -n "Creating user: $email ($name)... "
    
    response=$(curl -s -w "\n%{http_code}" -X POST "$SERVER_URL/api/bootstrap/create-super-admin" \
        -H "Content-Type: application/json" \
        -H "X-Bootstrap-Key: $BOOTSTRAP_SECRET" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"$password\",
            \"name\": \"$name\",
            \"role\": \"$role\"
        }" 2>/dev/null | tail -1)
    
    if [ "$response" = "201" ]; then
        echo -e "${GREEN}✓${NC}"
        return 0
    elif [ "$response" = "409" ]; then
        echo -e "${YELLOW}Already exists${NC}"
        return 0
    else
        echo -e "${RED}Failed (HTTP $response)${NC}"
        return 1
    fi
}

# Check if server is running
echo "Checking server status..."
if ! curl -s "$SERVER_URL/api/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running at $SERVER_URL${NC}"
    echo "Please start the server with: ./scripts/dev-start.sh"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"
echo ""

# Create test users
echo "Creating test users..."
echo "----------------------"

# Use environment variable for passwords or a placeholder
TEST_PASSWORD="${TEST_USER_PASSWORD:-ChangeMe123!}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-ChangeMe123!}"

# Super admin user
create_user "admin@vibestack.com" "$ADMIN_PASSWORD" "Admin User" "super_admin"

# Regular test users
create_user "alice@example.com" "$TEST_PASSWORD" "Alice Johnson" "user"
create_user "bob@example.com" "$TEST_PASSWORD" "Bob Smith" "user"
create_user "charlie@example.com" "$TEST_PASSWORD" "Charlie Brown" "user"

# Demo user for testing
create_user "demo@vibestack.com" "$TEST_PASSWORD" "Demo User" "user"

# Playwright test user
create_user "playwright@test.com" "$TEST_PASSWORD" "Playwright Test" "user"

echo ""
echo "=================================="
echo -e "${GREEN}✨ Test users setup complete!${NC}"
echo ""
echo "You can now log in with:"
echo "  Admin:     admin@vibestack.com / $ADMIN_PASSWORD"
echo "  Demo:      demo@vibestack.com / $TEST_PASSWORD"
echo "  Test:      alice@example.com / $TEST_PASSWORD"
echo "  Playwright: playwright@test.com / $TEST_PASSWORD"
echo ""
echo "Note: The bootstrap endpoint only works for creating the first super admin."
echo "      Additional users should be created through the normal signup flow."