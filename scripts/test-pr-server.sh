#!/bin/bash

# Test script to verify PR server configuration
echo "🧪 Testing PR Server Configuration"
echo "=================================="

# Check if server is running on expected port
PR_NUMBER=${1:-1}
SERVER_PORT=$((8787 + PR_NUMBER))
WEB_PORT=$((5173 + PR_NUMBER))

echo "Testing PR #$PR_NUMBER"
echo "Expected Server Port: $SERVER_PORT"
echo "Expected Web Port: $WEB_PORT"

# Test API endpoint
echo ""
echo "Testing API endpoint..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$WEB_PORT/api/auth/get-session)
echo "API Response Code: $API_RESPONSE"

if [ "$API_RESPONSE" = "200" ] || [ "$API_RESPONSE" = "401" ]; then
  echo "✅ API proxy is working correctly"
else
  echo "❌ API proxy failed with status: $API_RESPONSE"
fi

# Test CORS headers
echo ""
echo "Testing CORS configuration..."
CORS_RESPONSE=$(curl -s -I -X OPTIONS \
  -H "Origin: http://localhost:$WEB_PORT" \
  -H "Access-Control-Request-Method: GET" \
  http://localhost:$SERVER_PORT/api/auth/get-session 2>/dev/null | grep -i "access-control-allow-origin" || echo "No CORS header")

echo "CORS Response: $CORS_RESPONSE"

# Check if wrangler process is running
echo ""
echo "Checking server process..."
if pgrep -f "wrangler.*$SERVER_PORT" > /dev/null; then
  echo "✅ Wrangler server is running on port $SERVER_PORT"
else
  echo "❌ Wrangler server not found on port $SERVER_PORT"
fi

# Summary
echo ""
echo "📊 Configuration Summary:"
echo "- PR Number: $PR_NUMBER"
echo "- Server Port: $SERVER_PORT"
echo "- Web Port: $WEB_PORT"
echo "- API Proxy: http://localhost:$WEB_PORT/api/* → http://localhost:$SERVER_PORT/api/*"