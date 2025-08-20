#!/bin/bash

# API Authentication Testing Script
# Based on Better Auth implementation analysis

set -e

# Configuration
BASE_URL="http://localhost:8787"
API_BASE="${BASE_URL}/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to test API connectivity
test_api_connectivity() {
    print_status "Testing API connectivity..."
    
    if timeout 5 curl -s "${API_BASE}/health" > /dev/null 2>&1; then
        print_success "API server is responding"
        return 0
    else
        print_error "API server is not responding at ${BASE_URL}"
        print_warning "Make sure the dev server is running: pnpm dev"
        return 1
    fi
}

# Function to login and test API access for a specific user
test_user_api() {
    local email=$1
    local password=$2
    local role=$3
    local cookie_file="cookies_${role,,}.txt"
    
    echo ""
    print_status "=== Testing API Access for $role ($email) ==="
    
    # Clean up old cookie file
    rm -f "$cookie_file"
    
    # Step 1: Sign in
    print_status "1. Attempting sign in..."
    
    local signin_response
    signin_response=$(timeout 10 curl -s -X POST "${API_BASE}/auth/sign-in" \
        -H "Content-Type: application/json" \
        -d "{
            \"email\": \"$email\",
            \"password\": \"$password\"
        }" \
        -c "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" 2>/dev/null || echo "CURL_FAILED")
    
    if [[ "$signin_response" == "CURL_FAILED" ]]; then
        print_error "Sign in request failed - connection timeout or server error"
        return 1
    fi
    
    local http_status=$(echo "$signin_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local response_body=$(echo "$signin_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$http_status" == "200" || "$http_status" == "201" ]]; then
        print_success "Sign in successful (HTTP $http_status)"
        echo "Response: $response_body" | jq '.' 2>/dev/null || echo "Response: $response_body"
    else
        print_error "Sign in failed (HTTP $http_status)"
        echo "Response: $response_body"
        return 1
    fi
    
    # Step 2: Verify session
    print_status "2. Verifying session..."
    
    local session_response
    session_response=$(timeout 10 curl -s -X GET "${API_BASE}/auth/session" \
        -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" 2>/dev/null || echo "CURL_FAILED")
    
    if [[ "$session_response" == "CURL_FAILED" ]]; then
        print_error "Session check failed - connection timeout"
        return 1
    fi
    
    local session_status=$(echo "$session_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local session_body=$(echo "$session_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$session_status" == "200" ]]; then
        print_success "Session verified (HTTP $session_status)"
        local user_email=$(echo "$session_body" | jq -r '.user.email' 2>/dev/null || echo "N/A")
        print_status "Logged in as: $user_email"
    else
        print_error "Session verification failed (HTTP $session_status)"
        echo "Response: $session_body"
        return 1
    fi
    
    # Step 3: Test protected API
    print_status "3. Testing protected API endpoints..."
    
    # Test organizations endpoint
    local orgs_response
    orgs_response=$(timeout 10 curl -s -X GET "${API_BASE}/organizations" \
        -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" 2>/dev/null || echo "CURL_FAILED")
    
    if [[ "$orgs_response" == "CURL_FAILED" ]]; then
        print_error "Organizations API test failed - connection timeout"
        return 1
    fi
    
    local orgs_status=$(echo "$orgs_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    local orgs_body=$(echo "$orgs_response" | sed 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$orgs_status" == "200" ]]; then
        print_success "Organizations API accessible (HTTP $orgs_status)"
        local org_count=$(echo "$orgs_body" | jq '. | length' 2>/dev/null || echo "N/A")
        print_status "Found $org_count organizations"
    else
        print_warning "Organizations API returned HTTP $orgs_status"
        echo "Response: $orgs_body"
    fi
    
    # Test admin endpoint (only for admin roles)
    if [[ "$role" == "CEO" || "$role" == "CTO" ]]; then
        print_status "4. Testing admin endpoints..."
        
        local admin_response
        admin_response=$(timeout 10 curl -s -X GET "${API_BASE}/auth/admin/users" \
            -b "$cookie_file" \
            -w "HTTPSTATUS:%{http_code}" 2>/dev/null || echo "CURL_FAILED")
        
        if [[ "$admin_response" == "CURL_FAILED" ]]; then
            print_error "Admin API test failed - connection timeout"
        else
            local admin_status=$(echo "$admin_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
            local admin_body=$(echo "$admin_response" | sed 's/HTTPSTATUS:[0-9]*$//')
            
            if [[ "$admin_status" == "200" ]]; then
                print_success "Admin API accessible (HTTP $admin_status)"
                local user_count=$(echo "$admin_body" | jq '.users | length' 2>/dev/null || echo "N/A")
                print_status "Found $user_count users in system"
            else
                print_warning "Admin API returned HTTP $admin_status"
                echo "Response: $admin_body"
            fi
        fi
    fi
    
    # Step 5: Organization context testing
    print_status "5. Testing organization context..."
    
    local active_org_response
    active_org_response=$(timeout 10 curl -s -X GET "${API_BASE}/org-session/active-organization" \
        -b "$cookie_file" \
        -w "HTTPSTATUS:%{http_code}" 2>/dev/null || echo "CURL_FAILED")
    
    if [[ "$active_org_response" != "CURL_FAILED" ]]; then
        local org_status=$(echo "$active_org_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
        local org_body=$(echo "$active_org_response" | sed 's/HTTPSTATUS:[0-9]*$//')
        
        if [[ "$org_status" == "200" ]]; then
            local org_name=$(echo "$org_body" | jq -r '.activeOrganization.name' 2>/dev/null || echo "N/A")
            local user_role=$(echo "$org_body" | jq -r '.activeOrganization.userRole' 2>/dev/null || echo "N/A")
            print_success "Active organization: $org_name (role: $user_role)"
        fi
    fi
    
    print_success "Authentication testing completed for $role"
    print_status "Cookie file saved as: $cookie_file"
    print_status "Use this file for subsequent API calls with: curl -b $cookie_file"
    
    return 0
}

# Function to demonstrate API usage with saved cookies
demo_api_usage() {
    local cookie_file=$1
    
    if [[ ! -f "$cookie_file" ]]; then
        print_error "Cookie file $cookie_file not found"
        return 1
    fi
    
    echo ""
    print_status "=== Demonstrating API Usage with $cookie_file ==="
    
    # Example API calls
    print_status "Example: Get current user info"
    echo "curl -X GET \"${API_BASE}/auth/session\" -b $cookie_file | jq '.user'"
    
    print_status "Example: Get user's organizations"  
    echo "curl -X GET \"${API_BASE}/org-session/user-organizations\" -b $cookie_file | jq '.'"
    
    print_status "Example: Set active organization"
    echo "curl -X POST \"${API_BASE}/org-session/set-active-organization\" \\"
    echo "  -H \"Content-Type: application/json\" \\"
    echo "  -d '{\"organizationId\": \"01920000-1000-7000-8000-000000000001\"}' \\"
    echo "  -b $cookie_file"
    
    print_status "Example: Call any protected endpoint"
    echo "curl -X GET \"${API_BASE}/organizations\" -b $cookie_file"
}

# Main execution
main() {
    echo "🔐 API Authentication Testing Script"
    echo "===================================="
    
    # Test API connectivity first
    if ! test_api_connectivity; then
        exit 1
    fi
    
    # Test credentials from CLAUDE.md
    echo ""
    print_status "Testing Wide Corp Solutions test users..."
    
    # Test different user roles
    test_user_api "ceo@widecorp.com" "WideCorp2024!CEO" "CEO" || true
    test_user_api "cto@widecorp.com" "WideCorp2024!CTO" "CTO" || true
    test_user_api "pm1@widecorp.com" "WideCorp2024!PM1" "Manager" || true
    test_user_api "dev1@widecorp.com" "WideCorp2024!DEV1" "Developer" || true
    
    # Demonstrate usage
    echo ""
    print_status "=== Usage Examples ==="
    
    # Show examples for each saved cookie file
    for cookie_file in cookies_*.txt; do
        if [[ -f "$cookie_file" ]]; then
            demo_api_usage "$cookie_file"
        fi
    done
    
    echo ""
    print_success "Authentication testing script completed!"
    print_status "Cookie files are saved and ready for API testing"
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi