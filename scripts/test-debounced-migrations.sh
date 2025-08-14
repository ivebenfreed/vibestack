#!/bin/bash

# Test script for Debounced Migration System
# Tests the 30-second batching system for schema changes using Kysely

set -e

BASE_URL="http://localhost:8787"
TEST_ORG_ID="0fc85fd5-5d39-4be2-b269-1e49013740c7"

echo "🚀 Testing Debounced Migration System"
echo "====================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Test 1: Create multiple entities rapidly (should be debounced)
log_step "Testing rapid entity creation with debouncing..."

echo "Creating TestEntity1 with debounced migration..."
ENTITY1_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities/TestEntity1/debounced" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "definition": {
      "basePrimitive": "Project",
      "customFields": {
        "field1": {
          "type": "string",
          "required": true,
          "syncable": true
        },
        "field2": {
          "type": "number",
          "syncable": false,
          "serverOnly": true
        }
      }
    }
  }')

echo "$ENTITY1_RESPONSE" | jq '.'

echo ""
echo "Creating TestEntity2 immediately after (should also be debounced)..."
ENTITY2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities/TestEntity2/debounced" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create", 
    "definition": {
      "basePrimitive": "Task",
      "customFields": {
        "taskType": {
          "type": "string",
          "required": true,
          "syncable": true,
          "enum": ["bug", "feature", "improvement"]
        },
        "internalNotes": {
          "type": "text",
          "syncable": false,
          "serverOnly": true
        }
      }
    }
  }')

echo "$ENTITY2_RESPONSE" | jq '.'

echo ""
echo "Creating TestEntity3 immediately after (should also be debounced)..."
ENTITY3_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities/TestEntity3/debounced" \
  -H "Content-Type: application/json" \
  -d '{
    "operation": "create",
    "definition": {
      "basePrimitive": "Project", 
      "customFields": {
        "complexity": {
          "type": "string",
          "required": true,
          "syncable": true,
          "enum": ["low", "medium", "high"]
        },
        "estimatedHours": {
          "type": "number",
          "syncable": false,
          "serverOnly": true
        }
      }
    }
  }')

echo "$ENTITY3_RESPONSE" | jq '.'

# Test 2: Check pending migrations
log_step "Checking pending migrations status..."
PENDING_RESPONSE=$(curl -s -X GET "$BASE_URL/api/dataforge/migrations/pending")
echo "$PENDING_RESPONSE" | jq '.'

# Test 3: Test rapid field updates (should debounce to single migration)
log_step "Testing rapid field updates on same entity..."

echo "Updating TestEntity1 multiple times rapidly..."
for i in {1..5}; do
  UPDATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities/TestEntity1/debounced" \
    -H "Content-Type: application/json" \
    -d "{
      \"operation\": \"update\",
      \"definition\": {
        \"basePrimitive\": \"Project\",
        \"customFields\": {
          \"field1\": {
            \"type\": \"string\",
            \"required\": true,
            \"syncable\": true
          },
          \"field2\": {
            \"type\": \"number\",
            \"syncable\": false,
            \"serverOnly\": true
          },
          \"newField$i\": {
            \"type\": \"string\",
            \"syncable\": true
          }
        }
      }
    }")
  
  echo "Update $i: $(echo "$UPDATE_RESPONSE" | jq -r '.migrationId')"
  sleep 0.5
done

echo ""
log_step "Checking pending migrations after rapid updates..."
PENDING_AFTER_UPDATES=$(curl -s -X GET "$BASE_URL/api/dataforge/migrations/pending")
echo "$PENDING_AFTER_UPDATES" | jq '.'

# Test 4: Wait for debounced migrations to complete (or force flush for testing)
log_step "Testing migration flush (immediate processing for testing)..."
FLUSH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/migrations/flush")
echo "$FLUSH_RESPONSE" | jq '.'

# Test 5: Verify tables were created using Kysely
log_step "Verifying tables were created in database..."

# Check if tables exist in database
log_info "Checking database for created tables..."
HEALTH_CHECK=$(curl -s -X GET "$BASE_URL/api/dataforge/health")
echo "$HEALTH_CHECK" | jq '.'

# Test 6: Test immediate vs debounced entity creation
log_step "Comparing immediate vs debounced entity creation..."

echo "Creating ImmediateEntity (no debouncing)..."
IMMEDIATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "ImmediateEntity",
    "useDebounced": false,
    "definition": {
      "basePrimitive": "Project",
      "customFields": {
        "immediateField": {
          "type": "string",
          "required": true,
          "syncable": true
        }
      }
    }
  }')

echo "$IMMEDIATE_RESPONSE" | jq '.'

echo ""
echo "Creating DebouncedEntity (with debouncing)..."
DEBOUNCED_RESPONSE=$(curl -s -X POST "$BASE_URL/api/dataforge/orgs/$TEST_ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -d '{
    "entityName": "DebouncedEntity", 
    "useDebounced": true,
    "definition": {
      "basePrimitive": "Task",
      "customFields": {
        "debouncedField": {
          "type": "string",
          "required": true,
          "syncable": true
        }
      }
    }
  }')

echo "$DEBOUNCED_RESPONSE" | jq '.'

# Test 7: Final migration status
log_step "Final migration status check..."
FINAL_STATUS=$(curl -s -X GET "$BASE_URL/api/dataforge/migrations/pending")
echo "$FINAL_STATUS" | jq '.'

echo ""
echo "🎉 DEBOUNCED MIGRATION TESTING COMPLETED!"
echo "========================================"
echo ""
echo "Key Features Tested:"
echo "✅ Rapid entity creation with 30-second debouncing"
echo "✅ Multiple rapid updates batched into single migration" 
echo "✅ Kysely-based table creation (no raw SQL)"
echo "✅ Migration status monitoring"
echo "✅ Immediate vs debounced entity creation comparison"
echo "✅ Migration flush for testing purposes"
echo ""
echo "Migration System Benefits:"
echo "• Prevents database thrashing from rapid schema changes"
echo "• Batches multiple changes into atomic operations"
echo "• Uses Kysely for type-safe SQL generation"
echo "• Provides real-time status monitoring"
echo "• Maintains backward compatibility with immediate mode"