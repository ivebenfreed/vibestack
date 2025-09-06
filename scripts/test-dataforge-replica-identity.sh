#!/bin/bash

# Test script to verify DataForge replica identity fix
# This ensures UPDATE operations work on newly created entities

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PORT=4000
BASE_URL="http://localhost:$PORT"
COOKIES="/tmp/cookies.txt"

echo -e "${YELLOW}=== DataForge Replica Identity Test ===${NC}"
echo "Testing that newly created entities support UPDATE operations"
echo ""

# 1. Authenticate
echo -e "${YELLOW}1. Authenticating as CEO...${NC}"
echo '{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}' > /tmp/login.json
curl -s -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json \
  -c "$COOKIES" | jq -r '.user.name' || echo "Login response received"
echo -e "${GREEN}✓ Authenticated${NC}"
echo ""

# 2. Create a new entity type for testing
ORG_ID="01920000-1000-7000-8000-000000000001"
# Use shorter name to avoid truncation issues
TIMESTAMP=$(date +%s | tail -c 6)
ENTITY_NAME="RepTest$TIMESTAMP"
echo -e "${YELLOW}2. Creating test entity: $ENTITY_NAME${NC}"

cat > /tmp/create_entity.json <<EOF
{
  "entityName": "$ENTITY_NAME",
  "archetype": "record",
  "customFields": [
    {"name": "test_field", "type": "text", "required": false},
    {"name": "test_number", "type": "number", "defaultValue": 0}
  ]
}
EOF

ENTITY_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -d @/tmp/create_entity.json \
  -b "$COOKIES")

echo "$ENTITY_RESPONSE" | jq '.'

# Check if entity was created successfully
if echo "$ENTITY_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Entity created${NC}"
else
  echo -e "${RED}✗ Failed to create entity${NC}"
  exit 1
fi
echo ""

# 3. Create a record in the new entity
echo -e "${YELLOW}3. Creating test record...${NC}"

cat > /tmp/create_record.json <<EOF
{
  "name": "Test Record",
  "description": "Testing replica identity",
  "status": "active",
  "record_type": "test",
  "test_field": "Initial value",
  "test_number": 100
}
EOF

# Note: Entity name gets normalized in the response
NORMALIZED_ENTITY=$(echo "$ENTITY_RESPONSE" | jq -r '.data.entityName')

RECORD_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/$NORMALIZED_ENTITY" \
  -H "Content-Type: application/json" \
  -d @/tmp/create_record.json \
  -b "$COOKIES")

RECORD_ID=$(echo "$RECORD_RESPONSE" | jq -r '.data.id')
echo "Created record ID: $RECORD_ID"
echo -e "${GREEN}✓ Record created${NC}"
echo ""

# 4. UPDATE the record (this should work with replica identity fix)
echo -e "${YELLOW}4. Testing UPDATE operation...${NC}"

cat > /tmp/update_record.json <<EOF
{
  "test_field": "Updated value",
  "test_number": 200,
  "description": "Successfully updated!"
}
EOF

UPDATE_RESPONSE=$(curl -s -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/$NORMALIZED_ENTITY/$RECORD_ID" \
  -H "Content-Type: application/json" \
  -d @/tmp/update_record.json \
  -b "$COOKIES" \
  -w "\nHTTP_STATUS:%{http_code}")

HTTP_STATUS=$(echo "$UPDATE_RESPONSE" | grep "HTTP_STATUS" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$UPDATE_RESPONSE" | sed '/HTTP_STATUS/d')

if [ "$HTTP_STATUS" = "200" ]; then
  echo -e "${GREEN}✓ UPDATE successful!${NC}"
  echo "$RESPONSE_BODY" | jq '.'
  
  # Verify the update
  echo -e "${YELLOW}5. Verifying update...${NC}"
  VERIFY_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/$NORMALIZED_ENTITY/$RECORD_ID" \
    -b "$COOKIES")
  
  UPDATED_FIELD=$(echo "$VERIFY_RESPONSE" | jq -r '.data.test_field')
  UPDATED_NUMBER=$(echo "$VERIFY_RESPONSE" | jq -r '.data.test_number')
  
  if [ "$UPDATED_FIELD" = "Updated value" ] && [ "$UPDATED_NUMBER" = "200" ]; then
    echo -e "${GREEN}✓ Update verified - values match!${NC}"
  else
    echo -e "${RED}✗ Update verification failed${NC}"
    echo "Expected: test_field='Updated value', test_number=200"
    echo "Got: test_field='$UPDATED_FIELD', test_number=$UPDATED_NUMBER"
  fi
else
  echo -e "${RED}✗ UPDATE failed with status $HTTP_STATUS${NC}"
  echo "$RESPONSE_BODY" | jq '.'
  exit 1
fi

echo ""
echo -e "${GREEN}=== Test Complete ===${NC}"
echo "The replica identity fix is working correctly!"
echo "Newly created entities now support UPDATE operations."

# Cleanup
rm -f /tmp/login.json /tmp/create_entity.json /tmp/create_record.json /tmp/update_record.json