#!/bin/bash

# Test API Login Template
# Quick authentication testing for VibeStack API endpoints

set -e

# Configuration
API_BASE=${API_BASE:-"http://localhost:4000"}
TEMP_DIR=${TEMP_DIR:-"/tmp"}
COOKIE_FILE="$TEMP_DIR/vibestack_cookies.txt"

# Test user credentials from Wide Corp Solutions (org: 01920000-1000-7000-8000-000000000001)
declare -A TEST_USERS=(
    ["CEO"]="ceo@widecorp.com:WideCorp2024!CEO"
    ["CTO"]="cto@widecorp.com:WideCorp2024!CTO" 
    ["PM1"]="pm1@widecorp.com:WideCorp2024!PM1"
    ["DEV1"]="dev1@widecorp.com:WideCorp2024!DEV1"
)

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Usage function
usage() {
    echo "Usage: $0 [USER_ROLE] [COMMAND]"
    echo ""
    echo "USER_ROLES:"
    for role in "${!TEST_USERS[@]}"; do
        echo "  $role - ${TEST_USERS[$role]%%:*}"
    done
    echo ""
    echo "COMMANDS:"
    echo "  login    - Login and save cookies (default)"
    echo "  test     - Login and test protected endpoints"
    echo "  orgs     - Get user organizations"
    echo "  health   - Check API health"
    echo ""
    echo "Examples:"
    echo "  $0 CEO login"
    echo "  $0 CTO test"
    echo "  $0 DEV1 orgs"
}

# Login function using JSON file approach
login_user() {
    local email="$1"
    local password="$2"
    local login_payload="$TEMP_DIR/login_payload_$$.json"
    
    # Create JSON payload file to avoid bash escaping issues
    cat > "$login_payload" << EOF
{"email": "$email", "password": "$password"}
EOF
    
    echo -e "${BLUE}Logging in as $email...${NC}"
    
    # Perform login
    local response
    local http_code
    response=$(curl -s -X POST "$API_BASE/api/auth/sign-in/email" \
        -H "Content-Type: application/json" \
        -d @"$login_payload" \
        -c "$COOKIE_FILE" \
        -w "%{http_code}")
    
    # Extract HTTP code (last 3 characters)
    http_code="${response: -3}"
    local body="${response%???}"
    
    # Cleanup temp file
    rm -f "$login_payload"
    
    if [[ "$http_code" == "200" ]]; then
        echo -e "${GREEN}✅ Login successful${NC}"
        echo "Response: $body"
        return 0
    else
        echo -e "${RED}❌ Login failed (HTTP $http_code)${NC}"
        echo "Response: $body"
        return 1
    fi
}

# Test protected endpoints
test_endpoints() {
    echo -e "${BLUE}Testing protected endpoints...${NC}"
    
    # Test organizations endpoint
    echo "Testing /api/organizations..."
    local orgs_response
    orgs_response=$(curl -s -X GET "$API_BASE/api/organizations" -b "$COOKIE_FILE")
    
    if echo "$orgs_response" | jq . >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Organizations endpoint working${NC}"
        echo "$orgs_response" | jq '.organizations[] | {name, slug}'
    else
        echo -e "${RED}❌ Organizations endpoint failed${NC}"
        echo "$orgs_response"
    fi
}

# Get organizations only
get_orgs() {
    echo -e "${BLUE}Getting user organizations...${NC}"
    curl -s -X GET "$API_BASE/api/organizations" -b "$COOKIE_FILE" | jq '.'
}

# Health check
health_check() {
    echo -e "${BLUE}Checking API health...${NC}"
    curl -s -X GET "$API_BASE/health"
    echo ""
}

# Main script logic
USER_ROLE="${1:-CEO}"
COMMAND="${2:-login}"

# Validate user role
if [[ -z "${TEST_USERS[$USER_ROLE]}" ]]; then
    echo -e "${RED}❌ Invalid user role: $USER_ROLE${NC}"
    usage
    exit 1
fi

# Extract email and password
IFS=':' read -r EMAIL PASSWORD <<< "${TEST_USERS[$USER_ROLE]}"

case "$COMMAND" in
    "login")
        login_user "$EMAIL" "$PASSWORD"
        ;;
    "test")
        if login_user "$EMAIL" "$PASSWORD"; then
            test_endpoints
        fi
        ;;
    "orgs")
        if login_user "$EMAIL" "$PASSWORD"; then
            get_orgs
        fi
        ;;
    "health")
        health_check
        ;;
    *)
        echo -e "${RED}❌ Invalid command: $COMMAND${NC}"
        usage
        exit 1
        ;;
esac