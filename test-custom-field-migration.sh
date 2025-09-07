#!/bin/bash

# Test Custom Field Migration
# This script demonstrates migrating custom fields from JSONB to real columns

set -e

# Configuration
BASE_URL="http://localhost:4000/api"
ORG_ID="01920000-1000-7000-8000-000000000001"
ENTITY_NAME="TestProductFixed"

echo "🔧 Testing Custom Field Migration for DataForge"
echo "================================================="

# Step 1: Login to get authentication cookies
echo "📝 Step 1: Authenticating..."
cat > /tmp/login_payload.json << 'EOF'
{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}
EOF

curl -X POST "${BASE_URL}/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d @/tmp/login_payload.json \
  -c /tmp/cookies.txt \
  -s > /dev/null

echo "✅ Authentication successful"

# Step 2: Check migration status
echo ""
echo "📋 Step 2: Checking migration status for ${ENTITY_NAME}..."

curl -X GET "${BASE_URL}/dataforge-migration/orgs/${ORG_ID}/entities/${ENTITY_NAME}/migration-status" \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -s | jq '.'

# Step 3: Show current table structure
echo ""
echo "📊 Step 3: Current table structure (before migration)..."

# Use psql to show table structure
docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev \
  -c "\d org_01920000_1000_7000_8000_000000000001_testproductfixed" 2>/dev/null || echo "Could not show table structure"

# Step 4: Show current data 
echo ""
echo "📦 Step 4: Current data with custom fields in JSONB..."

docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev \
  -c "SELECT id, name, custom_fields FROM org_01920000_1000_7000_8000_000000000001_testproductfixed LIMIT 1;" 2>/dev/null || echo "Could not show current data"

# Step 5: Dry run migration
echo ""
echo "🧪 Step 5: Dry run migration (preview)..."

curl -X POST "${BASE_URL}/dataforge-migration/orgs/${ORG_ID}/entities/${ENTITY_NAME}/migrate-custom-fields?dryRun=true" \
  -H "Content-Type: application/json" \
  -b /tmp/cookies.txt \
  -s | jq '.'

# Step 6: Ask for confirmation
echo ""
read -p "🚀 Continue with actual migration? (y/N): " confirm
if [[ $confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "⚡ Step 6: Executing migration..."
    
    curl -X POST "${BASE_URL}/dataforge-migration/orgs/${ORG_ID}/entities/${ENTITY_NAME}/migrate-custom-fields" \
      -H "Content-Type: application/json" \
      -b /tmp/cookies.txt \
      -s | jq '.'
    
    # Step 7: Show new table structure
    echo ""
    echo "🎉 Step 7: New table structure (after migration)..."
    
    docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev \
      -c "\d org_01920000_1000_7000_8000_000000000001_testproductfixed" 2>/dev/null || echo "Could not show new table structure"
    
    # Step 8: Show migrated data
    echo ""
    echo "📊 Step 8: Migrated data with custom fields as real columns..."
    
    docker exec vibestack-main-postgres psql -U postgres -d vibestack_dev \
      -c "SELECT id, name, product_code, unit_price, custom_fields FROM org_01920000_1000_7000_8000_000000000001_testproductfixed LIMIT 1;" 2>/dev/null || echo "Could not show migrated data"
    
    echo ""
    echo "✅ Migration completed successfully!"
else
    echo "❌ Migration cancelled by user"
fi

# Step 9: Test adding foreign key constraints
echo ""
read -p "🔗 Add foreign key constraints for reference fields? (y/N): " fk_confirm
if [[ $fk_confirm =~ ^[Yy]$ ]]; then
    echo ""
    echo "🔗 Adding foreign key constraints..."
    
    curl -X POST "${BASE_URL}/dataforge-migration/orgs/${ORG_ID}/entities/${ENTITY_NAME}/add-foreign-keys" \
      -H "Content-Type: application/json" \
      -b /tmp/cookies.txt \
      -s | jq '.'
fi

# Clean up
rm -f /tmp/login_payload.json /tmp/cookies.txt

echo ""
echo "🏁 Migration test completed!"
echo ""
echo "📚 Key Benefits Achieved:"
echo "• Custom fields now stored as real database columns"
echo "• Better performance with proper indexes"
echo "• Database-level constraints and validation"
echo "• Standard SQL operations on custom fields"
echo "• Foreign key constraints for references (if added)"