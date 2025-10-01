#!/bin/bash

# Seed Demo Processes for Process Studio
# Creates comprehensive BPMN examples with all node types

set -e

COOKIE='Cookie: better-auth.session_token=XycbZlkz63exewC9OvctsrCGkYrU05m4.baeYA%2FfSA2ffAbpr50HpEwqhbKzb9sjLY48Or6vdpWM%3D'
ORG='01920000-1000-7000-8000-000000000001'
BASE_URL='http://localhost:4000/api/process'

echo "🚀 Creating demo processes for Wide Corp..."

# Process 1: Customer Onboarding (already created: f8f7110a-d7b4-4a89-9868-efb0307408ef)
ONBOARDING_ID='f8f7110a-d7b4-4a89-9868-efb0307408ef'

echo "Building Customer Onboarding nodes..."

# Create all nodes and capture IDs
START1=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"start_inquiry","node_type":"start_event","label":"New Client Inquiry","position_x":100,"position_y":200}' | jq -r '.data.id')

CREATE_CLIENT=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"create_client","node_type":"user_task","label":"Create Client Record","description":"Sales rep enters client info","position_x":250,"position_y":200,"linked_entity_type":"Client"}' | jq -r '.data.id')

ASSIGN_MGR=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"assign_manager","node_type":"user_task","label":"Assign Account Manager","position_x":450,"position_y":200,"linked_entity_type":"User"}' | jq -r '.data.id')

CHECK_VALUE=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"check_contract","node_type":"exclusive_gateway","label":"Contract > $100k?","position_x":650,"position_y":200}' | jq -r '.data.id')

KICKOFF=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"schedule_kickoff","node_type":"user_task","label":"Schedule Kickoff","description":"For high-value clients","position_x":800,"position_y":100,"linked_entity_type":"ClientMeeting"}' | jq -r '.data.id')

CREATE_PROJ=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"create_project","node_type":"service_task","label":"Create Project","position_x":950,"position_y":100,"linked_entity_type":"ProjectPortfolio"}' | jq -r '.data.id')

SEND_WELCOME=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"send_welcome","node_type":"send_task","label":"Send Welcome Email","position_x":800,"position_y":300}' | jq -r '.data.id')

END_HIGH=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"end_high","node_type":"end_event","label":"VIP Complete","position_x":1100,"position_y":100}' | jq -r '.data.id')

END_STD=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/nodes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"node_key":"end_standard","node_type":"end_event","label":"Standard Complete","position_x":950,"position_y":300}' | jq -r '.data.id')

echo "Creating connections..."

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_1\",\"source_node_id\":\"$START1\",\"target_node_id\":\"$CREATE_CLIENT\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_2\",\"source_node_id\":\"$CREATE_CLIENT\",\"target_node_id\":\"$ASSIGN_MGR\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_3\",\"source_node_id\":\"$ASSIGN_MGR\",\"target_node_id\":\"$CHECK_VALUE\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_high\",\"source_node_id\":\"$CHECK_VALUE\",\"target_node_id\":\"$KICKOFF\",\"label\":\"Yes\",\"condition_expression\":\"contract_value > 100000\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_standard\",\"source_node_id\":\"$CHECK_VALUE\",\"target_node_id\":\"$SEND_WELCOME\",\"label\":\"No\",\"is_default\":true}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_4\",\"source_node_id\":\"$KICKOFF\",\"target_node_id\":\"$CREATE_PROJ\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_5\",\"source_node_id\":\"$CREATE_PROJ\",\"target_node_id\":\"$END_HIGH\"}" > /dev/null

curl -s -X POST "$BASE_URL/orgs/$ORG/processes/$ONBOARDING_ID/connections" -H "$COOKIE" -H 'Content-Type: application/json' -d "{\"connection_key\":\"flow_6\",\"source_node_id\":\"$SEND_WELCOME\",\"target_node_id\":\"$END_STD\"}" > /dev/null

echo "✅ Customer Onboarding process complete (9 nodes, 8 connections)"

# Process 2: Invoice Processing
echo ""
echo "Creating Invoice Processing workflow..."

INV_ID=$(curl -s -X POST "$BASE_URL/orgs/$ORG/processes" -H "$COOKIE" -H 'Content-Type: application/json' -d '{"name":"Invoice Processing","description":"Automated invoice validation and approval","category":"operational"}' | jq -r '.data.id')

echo "✅ Invoice Processing created: $INV_ID"
echo ""
echo "🎉 Demo processes ready! View at:"
echo "http://localhost:4000/org/$ORG/process-studio"
