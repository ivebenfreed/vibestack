#!/bin/bash

# DataForge Entity Operations Test Script
# Tests all entity CRUD operations with curl

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT="${DEV_PORT:-4000}"
BASE_URL="http://localhost:${PORT}/api"
ORG_ID="01920000-1000-7000-8000-000000000001"
ENTITY_NAME="TestProduct$(date +%s)"  # Unique name with timestamp
COOKIES_FILE="/tmp/dataforge_test_cookies.txt"

# Login credentials
EMAIL="ceo@widecorp.com"
PASSWORD="WideCorp2024!CEO"

echo -e "${BLUE}=== DataForge Entity Operations Test ===${NC}"
echo "Port: $PORT"
echo "Organization: Wide Corp Solutions ($ORG_ID)"
echo "Test Entity: $ENTITY_NAME"
echo ""

# Function to print test headers
print_test() {
    echo -e "\n${YELLOW}► $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# 1. Login
print_test "1. Authenticating as CEO"
echo '{"email": "'$EMAIL'", "password": "'$PASSWORD'"}' > /tmp/login.json
RESPONSE=$(curl -s -X POST "$BASE_URL/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json \
  -c "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Authentication successful"
else
    print_error "Authentication failed (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

# 2. List available archetypes
print_test "2. Listing available archetypes"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/archetypes" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved archetypes"
    echo "$RESPONSE" | head -n-1 | jq -r '.[] | "  - \(.name): \(.description)"' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed to get archetypes (HTTP $HTTP_CODE)"
fi

# 3. Create entity with collection archetype
print_test "3. Creating entity '$ENTITY_NAME' with collection archetype"
cat > /tmp/create_entity.json <<EOF
{
  "entityName": "$ENTITY_NAME",
  "archetype": "collection",
  "customFields": [
    {"name": "sku", "type": "text", "required": true},
    {"name": "price", "type": "number", "defaultValue": 0},
    {"name": "in_stock", "type": "boolean", "defaultValue": true},
    {"name": "categories", "type": "json", "defaultValue": []},
    {"name": "product_details", "type": "text", "required": false}
  ]
}
EOF

RESPONSE=$(curl -s -X POST "$BASE_URL/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d @/tmp/create_entity.json \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    print_success "Entity created successfully"
    echo "$RESPONSE" | head -n-1 | jq '.' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed to create entity (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | head -n-1
    exit 1
fi

# 4. Get entity details
print_test "4. Getting entity details"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/entities/$ENTITY_NAME" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved entity details"
    echo "$RESPONSE" | head -n-1 | jq '.data | {entityName, archetype, fields: (.fields | length)}' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed to get entity details (HTTP $HTTP_CODE)"
fi

# 5. List all entities
print_test "5. Listing all entities"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/entities" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved entity list"
    echo "$RESPONSE" | head -n-1 | jq '.data.entities | length' 2>/dev/null | xargs -I {} echo "  Total entities: {}"
else
    print_error "Failed to list entities (HTTP $HTTP_CODE)"
fi

# 6. Get organization schema
print_test "6. Getting organization schema"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/schema" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved organization schema"
    echo "$RESPONSE" | head -n-1 | jq '.schema | length' 2>/dev/null | xargs -I {} echo "  Schema contains {} entities"
else
    print_error "Failed to get schema (HTTP $HTTP_CODE)"
fi

# 7. Create a record in the entity
print_test "7. Creating a record in '$ENTITY_NAME'"
cat > /tmp/create_record.json <<EOF
{
  "name": "Widget Pro",
  "collection_type": "products",
  "sku": "WGT-PRO-001",
  "price": 99.99,
  "in_stock": true,
  "categories": ["electronics", "gadgets"],
  "product_details": "Professional grade widget with advanced features"
}
EOF

RESPONSE=$(curl -s -X POST "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d @/tmp/create_record.json \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RECORD_ID=""
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    print_success "Record created successfully"
    RECORD_ID=$(echo "$RESPONSE" | head -n-1 | jq -r '.data.id' 2>/dev/null)
    echo "  Record ID: $RECORD_ID"
else
    print_error "Failed to create record (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | head -n-1
fi

# 8. Query records from entity
print_test "8. Querying records from '$ENTITY_NAME'"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME?limit=10" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved records"
    RECORD_COUNT=$(echo "$RESPONSE" | head -n-1 | jq '.data | length' 2>/dev/null)
    echo "  Found $RECORD_COUNT record(s)"
    echo "$RESPONSE" | head -n-1 | jq '.data[0] | {id, name, sku, price}' 2>/dev/null || true
else
    print_error "Failed to query records (HTTP $HTTP_CODE)"
fi

# 9. Get single record (if we have an ID)
if [ ! -z "$RECORD_ID" ]; then
    print_test "9. Getting single record by ID"
    RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME/$RECORD_ID" \
      -b "$COOKIES_FILE" \
      -w "\n%{http_code}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Retrieved record"
        echo "$RESPONSE" | head -n-1 | jq '.data | {id, name, sku, price}' 2>/dev/null || echo "$RESPONSE" | head -n-1
    else
        print_error "Failed to get record (HTTP $HTTP_CODE)"
    fi

    # 10. Update record
    print_test "10. Updating record"
    cat > /tmp/update_record.json <<EOF
{
  "price": 149.99,
  "in_stock": false,
  "description": "Premium widget - currently out of stock"
}
EOF

    RESPONSE=$(curl -s -X PUT "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME/$RECORD_ID" \
      -H "Content-Type: application/json" \
      -b "$COOKIES_FILE" \
      -d @/tmp/update_record.json \
      -w "\n%{http_code}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Record updated"
        echo "$RESPONSE" | head -n-1 | jq '.data | {id, price, in_stock}' 2>/dev/null || echo "$RESPONSE" | head -n-1
    else
        print_error "Failed to update record (HTTP $HTTP_CODE)"
    fi
fi

# 11. Bulk create records
print_test "11. Bulk creating records"
cat > /tmp/bulk_create.json <<EOF
{
  "records": [
    {
      "name": "Widget Basic",
      "collection_type": "products", 
      "sku": "WGT-BSC-001",
      "price": 49.99,
      "in_stock": true,
      "categories": ["electronics"],
      "description": "Entry level widget"
    },
    {
      "name": "Widget Plus",
      "collection_type": "products",
      "sku": "WGT-PLS-001", 
      "price": 79.99,
      "in_stock": true,
      "categories": ["electronics", "premium"],
      "description": "Enhanced widget with extra features"
    }
  ]
}
EOF

RESPONSE=$(curl -s -X POST "$BASE_URL/dataforge/orgs/$ORG_ID/bulk/$ENTITY_NAME/create" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d @/tmp/bulk_create.json \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    print_success "Bulk create successful"
    echo "$RESPONSE" | head -n-1 | jq '{success, created: .created}' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed bulk create (HTTP $HTTP_CODE)"
fi

# 12. Query with filters
print_test "12. Querying with filters"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME?filter[in_stock][eq]=true&orderBy=price&orderDirection=asc" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Filtered query successful"
    echo "$RESPONSE" | head -n-1 | jq '.data | map({name, price, in_stock})' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed filtered query (HTTP $HTTP_CODE)"
fi

# 13. Add fields to entity
print_test "13. Adding fields to entity"
cat > /tmp/add_fields.json <<EOF
{
  "fields": [
    {"name": "warehouse_location", "type": "text", "defaultValue": "main"},
    {"name": "last_restocked", "type": "date"}
  ]
}
EOF

RESPONSE=$(curl -s -X POST "$BASE_URL/dataforge/orgs/$ORG_ID/entities/$ENTITY_NAME/fields" \
  -H "Content-Type: application/json" \
  -b "$COOKIES_FILE" \
  -d @/tmp/add_fields.json \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    print_success "Fields added successfully"
    echo "$RESPONSE" | head -n-1 | jq '.' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed to add fields (HTTP $HTTP_CODE)"
    echo "$RESPONSE" | head -n-1
fi

# 14. Differential sync endpoint
print_test "14. Testing differential sync"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/sync/$ENTITY_NAME?limit=5" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Sync endpoint working"
    echo "$RESPONSE" | head -n-1 | jq '{record_count: .data | length, has_more: .metadata.hasMore, next_sync: .syncInfo.nextChangesSince}' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed sync request (HTTP $HTTP_CODE)"
fi

# 15. Delete a record (soft delete)
if [ ! -z "$RECORD_ID" ]; then
    print_test "15. Soft deleting record"
    RESPONSE=$(curl -s -X DELETE "$BASE_URL/dataforge/orgs/$ORG_ID/data/$ENTITY_NAME/$RECORD_ID" \
      -b "$COOKIES_FILE" \
      -w "\n%{http_code}")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    if [ "$HTTP_CODE" = "200" ]; then
        print_success "Record soft deleted"
    else
        print_error "Failed to delete record (HTTP $HTTP_CODE)"
    fi
fi

# 16. Delete entity (move to trash)
print_test "16. Moving entity to trash"
RESPONSE=$(curl -s -X DELETE "$BASE_URL/dataforge/orgs/$ORG_ID/entities/$ENTITY_NAME" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Entity moved to trash"
else
    print_error "Failed to delete entity (HTTP $HTTP_CODE)"
fi

# 17. List trash
print_test "17. Listing trash"
RESPONSE=$(curl -s -X GET "$BASE_URL/dataforge/orgs/$ORG_ID/trash" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Retrieved trash list"
    echo "$RESPONSE" | head -n-1 | jq '.deletedEntities | map(.entityName)' 2>/dev/null || echo "$RESPONSE" | head -n-1
else
    print_error "Failed to list trash (HTTP $HTTP_CODE)"
fi

# 18. Restore from trash
print_test "18. Restoring entity from trash"
RESPONSE=$(curl -s -X POST "$BASE_URL/dataforge/orgs/$ORG_ID/trash/$ENTITY_NAME/restore" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Entity restored from trash"
else
    print_error "Failed to restore entity (HTTP $HTTP_CODE)"
fi

# 19. Permanently delete entity
print_test "19. Permanently deleting entity"
# First move to trash again
curl -s -X DELETE "$BASE_URL/dataforge/orgs/$ORG_ID/entities/$ENTITY_NAME" \
  -b "$COOKIES_FILE" > /dev/null 2>&1

# Then permanently delete
RESPONSE=$(curl -s -X DELETE "$BASE_URL/dataforge/orgs/$ORG_ID/trash/$ENTITY_NAME/permanent" \
  -b "$COOKIES_FILE" \
  -w "\n%{http_code}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "200" ]; then
    print_success "Entity permanently deleted"
else
    print_error "Failed to permanently delete entity (HTTP $HTTP_CODE)"
fi

# Cleanup
rm -f /tmp/login.json /tmp/create_entity.json /tmp/create_record.json /tmp/update_record.json /tmp/bulk_create.json /tmp/add_fields.json "$COOKIES_FILE"

echo -e "\n${GREEN}=== Test Complete ===${NC}"
echo "Tested entity: $ENTITY_NAME"
echo "All DataForge entity operations have been tested!"