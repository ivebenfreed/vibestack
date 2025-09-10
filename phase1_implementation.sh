#!/bin/bash

# Phase 1 Wide Corp Entity Implementation
# Run these commands to create the enhanced entities with full DataForge utilization

# Set Wide Corp organization ID
ORG_ID="01920000-1000-7000-8000-000000000001"
BASE_URL="http://localhost:4000"

echo "🚀 Phase 1: Core Business Entities Implementation"
echo "Organization: Wide Corp ($ORG_ID)"
echo ""

# 1. PORTFOLIO ENTITY - Strategic Management Hub
echo "1. Creating Portfolio entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Portfolio",
    "archetype": "collection",
    "customFields": [
      {"name": "portfolio_code", "type": "text", "required": true, "unique": true},
      {"name": "strategic_theme", "type": "single-select", "enum": ["digital_transformation", "market_expansion", "operational_excellence", "innovation", "sustainability"], "defaultValue": "operational_excellence"},
      {"name": "investment_budget", "type": "currency", "required": true},
      {"name": "target_roi", "type": "number", "min": 0, "max": 500, "defaultValue": 15},
      {"name": "expected_duration_months", "type": "number", "min": 1, "max": 60, "defaultValue": 12},
      
      {"name": "total_allocated_budget", "type": "rollup_sum", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Project", "targetField": "approved_budget"}},
      {"name": "active_project_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Project", "conditions": {"status": "active"}}},
      {"name": "portfolio_health_score", "type": "computed_expression", "expression": "active_project_count > 0 ? (active_project_count * 20) : 50", "dependencies": ["active_project_count"]}
    ]
  }'

echo -e "\n"

# 2. ENHANCED PROJECT ENTITY  
echo "2. Creating enhanced Project entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Project",
    "archetype": "project", 
    "customFields": [
      {"name": "project_code", "type": "text", "required": true, "unique": true},
      {"name": "complexity_score", "type": "number", "min": 1, "max": 10, "defaultValue": 5},
      {"name": "risk_level", "type": "single-select", "enum": ["low", "medium", "high", "critical"], "defaultValue": "medium"},
      {"name": "methodology", "type": "single-select", "enum": ["agile", "waterfall", "hybrid", "lean"], "defaultValue": "agile"},
      {"name": "client_facing", "type": "boolean", "defaultValue": false},
      
      {"name": "approved_budget", "type": "currency", "required": true},
      {"name": "spent_budget", "type": "rollup_sum", "rollupConfig": {"relationshipType": "charged_to", "targetEntityType": "Expense", "targetField": "amount"}},
      {"name": "budget_utilization", "type": "computed_expression", "expression": "(spent_budget / approved_budget) * 100", "dependencies": ["spent_budget", "approved_budget"]},
      
      {"name": "allocated_hours", "type": "number", "required": true},
      {"name": "actual_hours", "type": "rollup_sum", "rollupConfig": {"relationshipType": "worked_on", "targetEntityType": "Timesheet", "targetField": "hours_logged"}},
      {"name": "team_size", "type": "rollup_count", "rollupConfig": {"relationshipType": "assigned_to", "targetEntityType": "User"}},
      
      {"name": "total_task_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task"}},
      {"name": "completed_task_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task", "conditions": {"status": "done"}}},
      {"name": "task_completion_rate", "type": "computed_expression", "expression": "total_task_count > 0 ? (completed_task_count / total_task_count) * 100 : 0", "dependencies": ["completed_task_count", "total_task_count"]},
      
      {"name": "project_health_score", "type": "computed_expression", "expression": "(task_completion_rate * 0.6) + (progress_percentage * 0.4)", "dependencies": ["task_completion_rate", "progress_percentage"]}
    ]
  }'

echo -e "\n"

# 3. ADVANCED TASK ENTITY
echo "3. Creating advanced Task entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Task",
    "archetype": "task",
    "customFields": [
      {"name": "task_code", "type": "text", "unique": true},
      {"name": "story_points", "type": "number", "min": 0.5, "max": 21},
      {"name": "task_type", "type": "single-select", "enum": ["feature", "bug", "research", "documentation", "testing"], "defaultValue": "feature"},
      {"name": "complexity", "type": "single-select", "enum": ["trivial", "minor", "major", "critical"], "defaultValue": "minor"},
      {"name": "business_value", "type": "number", "min": 1, "max": 100, "defaultValue": 50},
      
      {"name": "estimated_hours", "type": "number", "min": 0.25, "max": 160},
      {"name": "actual_hours", "type": "rollup_sum", "rollupConfig": {"relationshipType": "logged_for", "targetEntityType": "Timesheet", "targetField": "hours_logged"}},
      {"name": "remaining_hours", "type": "number", "min": 0},
      {"name": "time_variance", "type": "computed_expression", "expression": "estimated_hours > 0 ? ((actual_hours - estimated_hours) / estimated_hours) * 100 : 0", "dependencies": ["actual_hours", "estimated_hours"]},
      
      {"name": "is_blocked", "type": "boolean", "defaultValue": false},
      {"name": "blocked_reason", "type": "rich-text"},
      {"name": "testing_required", "type": "boolean", "defaultValue": true},
      {"name": "code_review_required", "type": "boolean", "defaultValue": true},
      {"name": "acceptance_criteria_count", "type": "number", "defaultValue": 0},
      {"name": "acceptance_criteria_met", "type": "number", "defaultValue": 0},
      {"name": "acceptance_rate", "type": "computed_expression", "expression": "acceptance_criteria_count > 0 ? (acceptance_criteria_met / acceptance_criteria_count) * 100 : 100", "dependencies": ["acceptance_criteria_met", "acceptance_criteria_count"]},
      
      {"name": "task_health_score", "type": "computed_expression", "expression": "(progress_percentage * 0.4) + (acceptance_rate * 0.4) + (is_blocked ? 0 : 20)", "dependencies": ["progress_percentage", "acceptance_rate", "is_blocked"]}
    ]
  }'

echo -e "\n"

# 4. EPIC ENTITY - Feature Organization
echo "4. Creating Epic entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Epic",
    "archetype": "collection",
    "customFields": [
      {"name": "epic_code", "type": "text", "required": true, "unique": true},
      {"name": "epic_theme", "type": "text", "required": true},
      {"name": "business_value", "type": "number", "min": 1, "max": 100},
      {"name": "user_impact", "type": "single-select", "enum": ["low", "medium", "high", "critical"], "defaultValue": "medium"},
      {"name": "technical_risk", "type": "single-select", "enum": ["low", "medium", "high", "very_high"], "defaultValue": "medium"},
      {"name": "target_release", "type": "text"},
      {"name": "estimated_duration_weeks", "type": "number", "min": 1, "max": 52},
      
      {"name": "total_story_points", "type": "rollup_sum", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task", "targetField": "story_points"}},
      {"name": "completed_story_points", "type": "rollup_sum", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task", "targetField": "story_points", "conditions": {"status": "done"}}},
      {"name": "total_task_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task"}},
      {"name": "completed_task_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task", "conditions": {"status": "done"}}},
      {"name": "blocked_task_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "belongs_to", "targetEntityType": "Task", "conditions": {"is_blocked": true}}},
      
      {"name": "epic_progress", "type": "computed_expression", "expression": "total_story_points > 0 ? (completed_story_points / total_story_points) * 100 : 0", "dependencies": ["completed_story_points", "total_story_points"]},
      {"name": "epic_health_score", "type": "computed_expression", "expression": "(epic_progress * 0.5) + ((total_task_count - blocked_task_count) / total_task_count * 50)", "dependencies": ["epic_progress", "total_task_count", "blocked_task_count"]}
    ]
  }'

echo -e "\n"

# 5. ENHANCED CLIENT ENTITY  
echo "5. Creating enhanced Client entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Client",
    "archetype": "record",
    "customFields": [
      {"name": "client_code", "type": "text", "required": true, "unique": true},
      {"name": "legal_name", "type": "text", "required": true},
      {"name": "website", "type": "url"},
      {"name": "annual_revenue", "type": "currency"},
      {"name": "employee_count", "type": "number", "min": 1},
      {"name": "industry_sector", "type": "single-select", "enum": ["technology", "finance", "healthcare", "manufacturing", "retail", "energy", "government", "education"], "required": true},
      {"name": "company_size", "type": "single-select", "enum": ["startup", "small", "medium", "large", "enterprise"], "defaultValue": "medium"},
      {"name": "client_type", "type": "single-select", "enum": ["prospect", "active", "inactive", "partner", "strategic"], "defaultValue": "prospect"},
      {"name": "customer_since", "type": "date"},
      {"name": "client_tier", "type": "single-select", "enum": ["platinum", "gold", "silver", "bronze", "standard"], "defaultValue": "standard"},
      
      {"name": "total_contract_value", "type": "rollup_sum", "rollupConfig": {"relationshipType": "signed_by", "targetEntityType": "Contract", "targetField": "contract_value"}},
      {"name": "active_contract_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "signed_by", "targetEntityType": "Contract", "conditions": {"status": "active"}}},
      {"name": "total_invoiced", "type": "rollup_sum", "rollupConfig": {"relationshipType": "billed_to", "targetEntityType": "Invoice", "targetField": "amount"}},
      {"name": "active_project_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "delivered_to", "targetEntityType": "Project", "conditions": {"status": "active"}}},
      {"name": "completed_project_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "delivered_to", "targetEntityType": "Project", "conditions": {"status": "completed"}}},
      
      {"name": "satisfaction_score", "type": "number", "min": 1, "max": 10},
      {"name": "payment_reliability", "type": "computed_expression", "expression": "total_invoiced > 0 ? 85 : 100", "dependencies": ["total_invoiced"]},
      {"name": "project_success_rate", "type": "computed_expression", "expression": "(active_project_count + completed_project_count) > 0 ? (completed_project_count / (active_project_count + completed_project_count)) * 100 : 100", "dependencies": ["active_project_count", "completed_project_count"]},
      {"name": "client_health_score", "type": "computed_expression", "expression": "((satisfaction_score || 7) * 10 * 0.4) + (payment_reliability * 0.3) + (project_success_rate * 0.3)", "dependencies": ["satisfaction_score", "payment_reliability", "project_success_rate"]}
    ]
  }'

echo -e "\n"

# 6. CONTACT ENTITY - Individual Relationship Management
echo "6. Creating Contact entity..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "Contact",
    "archetype": "record",
    "customFields": [
      {"name": "first_name", "type": "text", "required": true},
      {"name": "last_name", "type": "text", "required": true},
      {"name": "full_name", "type": "computed_expression", "expression": "first_name + \" \" + last_name", "dependencies": ["first_name", "last_name"]},
      {"name": "job_title", "type": "text"},
      {"name": "department", "type": "text"},
      {"name": "work_email", "type": "email", "required": true},
      {"name": "work_phone", "type": "phone"},
      {"name": "mobile_phone", "type": "phone"},
      {"name": "linkedin_url", "type": "url"},
      
      {"name": "seniority_level", "type": "single-select", "enum": ["junior", "mid", "senior", "director", "vp", "c_level"]},
      {"name": "decision_maker", "type": "boolean", "defaultValue": false},
      {"name": "budget_authority", "type": "boolean", "defaultValue": false},
      {"name": "technical_authority", "type": "boolean", "defaultValue": false},
      
      {"name": "last_contacted", "type": "date"},
      {"name": "interaction_count", "type": "rollup_count", "rollupConfig": {"relationshipType": "involved_in", "targetEntityType": "Meeting"}},
      {"name": "response_rate", "type": "number", "min": 0, "max": 100, "defaultValue": 80},
      {"name": "preferred_contact_method", "type": "single-select", "enum": ["email", "phone", "teams", "slack"], "defaultValue": "email"},
      
      {"name": "contact_score", "type": "computed_expression", "expression": "(decision_maker ? 30 : 0) + (budget_authority ? 25 : 0) + (technical_authority ? 20 : 0) + (response_rate * 0.25)", "dependencies": ["decision_maker", "budget_authority", "technical_authority", "response_rate"]}
    ]
  }'

echo -e "\n"
echo "✅ Phase 1 entities created successfully!"
echo ""
echo "Next steps:"
echo "1. Add relationship fields to connect entities"  
echo "2. Test computed field calculations"
echo "3. Set up approval workflows"
echo "4. Create sample data for testing"