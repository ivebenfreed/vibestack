#!/bin/bash

# Phase 1 Relationship Fields Implementation
# Run AFTER creating the basic entities to add relationship connections

ORG_ID="01920000-1000-7000-8000-000000000001"
BASE_URL="http://localhost:4000"

echo "🔗 Phase 1: Adding Relationship Fields"
echo ""

# Add relationship fields to Portfolio
echo "1. Adding relationships to Portfolio..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Portfolio" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "portfolio_manager_id", "type": "custom_user_reference", "relationshipType": "managed_by", "required": true},
      {"name": "executive_sponsor_id", "type": "custom_user_reference", "relationshipType": "sponsored_by", "required": true}
    ]
  }'

# Add relationship fields to Project  
echo -e "\n2. Adding relationships to Project..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Project" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "portfolio_id", "type": "custom_entity_reference", "relationshipType": "belongs_to", "targetEntityType": "Portfolio"},
      {"name": "project_manager_id", "type": "custom_user_reference", "relationshipType": "managed_by", "required": true},
      {"name": "client_id", "type": "custom_entity_reference", "relationshipType": "delivered_to", "targetEntityType": "Client"},
      {"name": "sponsor_id", "type": "custom_user_reference", "relationshipType": "sponsored_by", "required": true}
    ]
  }'

# Add relationship fields to Task
echo -e "\n3. Adding relationships to Task..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Task" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "assignee_id", "type": "custom_user_reference", "relationshipType": "assigned_to"},
      {"name": "reviewer_id", "type": "custom_user_reference", "relationshipType": "reviewed_by"},
      {"name": "project_id", "type": "custom_entity_reference", "relationshipType": "belongs_to", "targetEntityType": "Project", "required": true},
      {"name": "epic_id", "type": "custom_entity_reference", "relationshipType": "belongs_to", "targetEntityType": "Epic"},
      {"name": "parent_task_id", "type": "custom_entity_reference", "relationshipType": "subtask_of", "targetEntityType": "Task"}
    ]
  }'

# Add relationship fields to Epic
echo -e "\n4. Adding relationships to Epic..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Epic" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "product_owner_id", "type": "custom_user_reference", "relationshipType": "owned_by", "required": true},
      {"name": "epic_lead_id", "type": "custom_user_reference", "relationshipType": "managed_by"},
      {"name": "project_id", "type": "custom_entity_reference", "relationshipType": "belongs_to", "targetEntityType": "Project", "required": true}
    ]
  }'

# Add relationship fields to Client
echo -e "\n5. Adding relationships to Client..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Client" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "account_manager_id", "type": "custom_user_reference", "relationshipType": "managed_by", "required": true},
      {"name": "sales_rep_id", "type": "custom_user_reference", "relationshipType": "sold_by"},
      {"name": "primary_contact_id", "type": "custom_entity_reference", "relationshipType": "primary_contact", "targetEntityType": "Contact"}
    ]
  }'

# Add relationship fields to Contact
echo -e "\n6. Adding relationships to Contact..."
curl -X PUT "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities/Contact" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "customFields": [
      {"name": "client_id", "type": "custom_entity_reference", "relationshipType": "works_for", "targetEntityType": "Client", "required": true},
      {"name": "reports_to_id", "type": "custom_entity_reference", "relationshipType": "reports_to", "targetEntityType": "Contact"}
    ]
  }'

echo -e "\n✅ All relationship fields added successfully!"
echo ""
echo "Relationship hierarchy established:"
echo "Portfolio → Projects → Epics → Tasks"
echo "Client → Contacts"
echo "Projects ← Clients (delivery relationships)"