#!/bin/bash

# Test all OpenAPI-converted endpoints
# Usage: ./scripts/test-openapi-endpoints.sh

PORT="${DEV_PORT:-4000}"
BASE_URL="http://localhost:$PORT"
COOKIES_FILE="cookies.txt"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Testing OpenAPI Endpoints on port $PORT"
echo "=================================="

# Function to test endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4
    
    echo -n "Testing $description: "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X GET "$BASE_URL$endpoint" -b "$COOKIES_FILE")
    elif [ "$method" = "POST" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -b "$COOKIES_FILE")
    elif [ "$method" = "PUT" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data" \
            -b "$COOKIES_FILE")
    elif [ "$method" = "DELETE" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE_URL$endpoint" -b "$COOKIES_FILE")
    fi
    
    if [[ "$response" =~ ^(200|201|204)$ ]]; then
        echo -e "${GREEN}✓${NC} ($response)"
    elif [[ "$response" =~ ^(401|403)$ ]]; then
        echo -e "${YELLOW}⚠${NC} Auth required ($response)"
    else
        echo -e "${RED}✗${NC} ($response)"
    fi
}

# Login first
echo "🔐 Authenticating..."
echo '{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}' > /tmp/login_payload.json
login_response=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/sign-in/email" \
    -H "Content-Type: application/json" \
    -d @/tmp/login_payload.json \
    -c "$COOKIES_FILE")

if [ "$login_response" = "200" ]; then
    echo -e "${GREEN}✓${NC} Authentication successful"
else
    echo -e "${RED}✗${NC} Authentication failed ($login_response)"
    exit 1
fi

echo ""
echo "📚 Documentation Endpoints"
echo "--------------------------"
test_endpoint "GET" "/api/doc" "" "OpenAPI JSON Schema"
test_endpoint "GET" "/api/ui" "" "Swagger UI Interface"

echo ""
echo "🏢 Teams API (OpenAPI)"
echo "-----------------------"
test_endpoint "GET" "/api/teams/org/01920000-1000-7000-8000-000000000001" "" "GET /api/teams/org/{orgId}"
test_endpoint "POST" "/api/teams/org/01920000-1000-7000-8000-000000000001" '{"name":"Test Team","description":"Test","team_type":"functional"}' "POST /api/teams/org/{orgId}"
test_endpoint "PUT" "/api/teams/01920000-3000-7000-8000-000000000001" '{"name":"Updated Team"}' "PUT /api/teams/{teamId}"
# test_endpoint "DELETE" "/api/teams/test-id" "" "DELETE /api/teams/{teamId}" # Skip delete to avoid data loss
test_endpoint "POST" "/api/teams/01920000-3000-7000-8000-000000000001/members" '{"user_id":"01920000-2000-7000-8000-000000000002","role":"member"}' "POST /api/teams/{teamId}/members"
test_endpoint "GET" "/api/teams/user/01920000-2000-7000-8000-000000000001/memberships" "" "GET /api/teams/user/{userId}/memberships"

echo ""
echo "🌍 Worlds API (OpenAPI)"
echo "-----------------------"
test_endpoint "GET" "/api/worlds" "" "GET /api/worlds"
test_endpoint "POST" "/api/worlds" '{"name":"Test World","description":"Test","organization_id":"01920000-1000-7000-8000-000000000001"}' "POST /api/worlds"
test_endpoint "GET" "/api/worlds/by-team/01920000-3000-7000-8000-000000000001" "" "GET /api/worlds/by-team/{teamId}"
test_endpoint "PUT" "/api/worlds/test-id" '{"name":"Updated World"}' "PUT /api/worlds/{id}"
# test_endpoint "DELETE" "/api/worlds/test-id" "" "DELETE /api/worlds/{id}" # Skip delete to avoid data loss

echo ""
echo "🌌 Universe API (OpenAPI)"
echo "-------------------------"
test_endpoint "GET" "/api/universe/complete" "" "GET /api/universe/complete"
test_endpoint "GET" "/api/universe/activity?days=7&limit=10" "" "GET /api/universe/activity"
test_endpoint "GET" "/api/universe/health" "" "GET /api/universe/health"

echo ""
echo "🔧 DataForge API (OpenAPI)"
echo "---------------------------"
test_endpoint "GET" "/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/archetypes" "" "GET /api/dataforge/orgs/{orgId}/archetypes"
test_endpoint "GET" "/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities/projects" "" "GET /api/dataforge/orgs/{orgId}/entities/projects"
test_endpoint "GET" "/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities/tasks" "" "GET /api/dataforge/orgs/{orgId}/entities/tasks"
test_endpoint "POST" "/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities/projects" '{"name":"Test Project","status":"active"}' "POST /api/dataforge/orgs/{orgId}/entities/projects"
test_endpoint "GET" "/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities/projects/bulk" "" "GET /api/dataforge/orgs/{orgId}/entities/projects/bulk"

echo ""
echo "📊 Summary"
echo "=========="
echo "All converted endpoints have been tested."
echo "Check above for any failures (red ✗) or auth issues (yellow ⚠)"
echo ""
echo "View interactive documentation at: $BASE_URL/api/ui"