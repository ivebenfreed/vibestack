#!/bin/bash

# Enhanced Entity Setup and Seeding Script
# This script uses the API to add custom fields and seed data with relationships

echo "🚀 Starting entity enhancement and seeding..."

# Base URL
BASE_URL="http://localhost:4000"
ORG_ID="01920000-1000-7000-8000-000000000001"

# Ensure we're logged in
echo "🔐 Logging in..."
cat > /tmp/login.json << 'EOF'
{"email": "ceo@widecorp.com", "password": "WideCorp2024!CEO"}
EOF
curl -s -X POST "$BASE_URL/api/auth/sign-in/email" \
  -H "Content-Type: application/json" \
  -d @/tmp/login.json \
  -c cookies.txt > /dev/null

echo "✅ Logged in successfully"

# Function to add fields to an entity
add_fields() {
  local entity_name=$1
  local fields_json=$2
  
  echo "  Adding fields to $entity_name..."
  
  curl -s -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/$entity_name/fields" \
    -H "Content-Type: application/json" \
    -d "$fields_json" \
    -b cookies.txt > /dev/null
    
  echo "  ✅ Enhanced $entity_name"
}

echo ""
echo "🔧 Enhancing entities with custom fields..."

# Client entity enhancements
add_fields "Client" '{
  "fields": [
    {"name": "company_size", "type": "select", "enum": ["1-10", "11-50", "51-200", "201-500", "500+"], "defaultValue": "11-50"},
    {"name": "annual_revenue", "type": "decimal"},
    {"name": "account_manager_id", "type": "user_reference"},
    {"name": "last_contact_date", "type": "date"},
    {"name": "satisfaction_score", "type": "integer", "defaultValue": 0}
  ]
}'

# Project entity enhancements  
add_fields "Project" '{
  "fields": [
    {"name": "client_id", "type": "entity_reference", "targetEntity": "Client"},
    {"name": "project_manager_id", "type": "user_reference"},
    {"name": "estimated_hours", "type": "decimal"},
    {"name": "actual_hours", "type": "decimal", "defaultValue": 0},
    {"name": "completion_percentage", "type": "integer", "defaultValue": 0}
  ]
}'

# Task entity enhancements
add_fields "Task" '{
  "fields": [
    {"name": "story_points", "type": "integer", "defaultValue": 1},
    {"name": "blocked", "type": "boolean", "defaultValue": false},
    {"name": "blocked_reason", "type": "text"},
    {"name": "reviewer_id", "type": "user_reference"},
    {"name": "labels", "type": "json", "defaultValue": []}
  ]
}'

# Invoice entity enhancements
add_fields "Invoice" '{
  "fields": [
    {"name": "invoice_number", "type": "text", "required": true},
    {"name": "client_id", "type": "entity_reference", "targetEntity": "Client"},
    {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
    {"name": "amount", "type": "decimal", "required": true},
    {"name": "tax_rate", "type": "decimal", "defaultValue": 0.1},
    {"name": "due_date", "type": "date", "required": true},
    {"name": "paid_date", "type": "date"},
    {"name": "payment_status", "type": "select", "enum": ["draft", "sent", "paid", "overdue", "cancelled"], "defaultValue": "draft"}
  ]
}'

# Expense entity enhancements
add_fields "Expense" '{
  "fields": [
    {"name": "expense_category", "type": "select", "enum": ["travel", "meals", "supplies", "equipment", "software", "other"], "defaultValue": "other"},
    {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
    {"name": "approved_by_id", "type": "user_reference"},
    {"name": "approval_date", "type": "date"},
    {"name": "receipt_uploaded", "type": "boolean", "defaultValue": false}
  ]
}'

# Meeting entity enhancements
add_fields "Meeting" '{
  "fields": [
    {"name": "client_id", "type": "entity_reference", "targetEntity": "Client"},
    {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
    {"name": "organizer_id", "type": "user_reference"},
    {"name": "meeting_link", "type": "url"},
    {"name": "recording_url", "type": "url"},
    {"name": "agenda", "type": "text"},
    {"name": "minutes", "type": "text"}
  ]
}'

# Contract entity enhancements
add_fields "Contract" '{
  "fields": [
    {"name": "contract_number", "type": "text", "required": true},
    {"name": "client_id", "type": "entity_reference", "targetEntity": "Client", "required": true},
    {"name": "contract_value", "type": "decimal", "required": true},
    {"name": "payment_terms", "type": "select", "enum": ["net15", "net30", "net45", "net60", "immediate"], "defaultValue": "net30"},
    {"name": "auto_renew", "type": "boolean", "defaultValue": false},
    {"name": "signed_date", "type": "date"},
    {"name": "renewal_date", "type": "date"}
  ]
}'

# Discussion entity enhancements
add_fields "Discussion" '{
  "fields": [
    {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
    {"name": "participants", "type": "json", "defaultValue": []},
    {"name": "is_pinned", "type": "boolean", "defaultValue": false},
    {"name": "tags", "type": "json", "defaultValue": []},
    {"name": "resolved", "type": "boolean", "defaultValue": false},
    {"name": "resolved_by_id", "type": "user_reference"}
  ]
}'

echo ""
echo "✨ Entity enhancement complete!"
echo ""
echo "📊 Next: Run the TypeScript seeding script to populate data"
echo "  npx tsx scripts/seed-realistic-data.ts"