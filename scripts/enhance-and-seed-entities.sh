#!/bin/bash

# Enhance and seed entities with realistic data
# This script enhances entities with custom fields and creates comprehensive seed data

ORG_ID="01920000-1000-7000-8000-000000000001"
API_URL="http://localhost:4000/api/dataforge"

echo "🔄 Enhancing entities with custom fields..."

# First, let's add custom fields to Client entity
echo "  Enhancing Client entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Client/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fields": [
      {"name": "company_size", "type": "select", "enum": ["1-10", "11-50", "51-200", "201-500", "500+"], "defaultValue": "11-50"},
      {"name": "annual_revenue", "type": "decimal"},
      {"name": "account_manager_id", "type": "user_reference"},
      {"name": "last_contact_date", "type": "date"},
      {"name": "satisfaction_score", "type": "integer", "defaultValue": 0}
    ]
  }'

echo -e "\n  Enhancing Project entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Project/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fields": [
      {"name": "client_id", "type": "entity_reference", "targetEntity": "Client"},
      {"name": "project_manager_id", "type": "user_reference"},
      {"name": "estimated_hours", "type": "decimal"},
      {"name": "actual_hours", "type": "decimal", "defaultValue": 0},
      {"name": "completion_percentage", "type": "integer", "defaultValue": 0}
    ]
  }'

echo -e "\n  Enhancing Task entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Task/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fields": [
      {"name": "story_points", "type": "integer", "defaultValue": 1},
      {"name": "blocked", "type": "boolean", "defaultValue": false},
      {"name": "blocked_reason", "type": "text"},
      {"name": "reviewer_id", "type": "user_reference"},
      {"name": "labels", "type": "json", "defaultValue": []}
    ]
  }'

echo -e "\n  Enhancing Invoice entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Invoice/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
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

echo -e "\n  Enhancing Expense entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Expense/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fields": [
      {"name": "expense_category", "type": "select", "enum": ["travel", "meals", "supplies", "equipment", "software", "other"], "defaultValue": "other"},
      {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
      {"name": "approved_by_id", "type": "user_reference"},
      {"name": "approval_date", "type": "date"},
      {"name": "receipt_uploaded", "type": "boolean", "defaultValue": false}
    ]
  }'

echo -e "\n  Enhancing Meeting entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Meeting/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
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

echo -e "\n  Enhancing Contract entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Contract/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
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

echo -e "\n  Enhancing Discussion entity..."
curl -X POST "$API_URL/orgs/$ORG_ID/entities/Discussion/fields" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "fields": [
      {"name": "project_id", "type": "entity_reference", "targetEntity": "Project"},
      {"name": "participants", "type": "json", "defaultValue": []},
      {"name": "is_pinned", "type": "boolean", "defaultValue": false},
      {"name": "tags", "type": "json", "defaultValue": []},
      {"name": "resolved", "type": "boolean", "defaultValue": false},
      {"name": "resolved_by_id", "type": "user_reference"}
    ]
  }'

echo -e "\n\n✅ All entities enhanced with custom fields!"
echo "Next step: Run comprehensive seeding script to populate with realistic data"