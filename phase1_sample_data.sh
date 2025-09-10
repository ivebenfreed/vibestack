#!/bin/bash

# Phase 1 Sample Data Creation
# Run AFTER creating entities and relationships

ORG_ID="01920000-1000-7000-8000-000000000001"
BASE_URL="http://localhost:4000"

echo "📊 Phase 1: Creating Sample Data"
echo ""

# 1. Create Portfolio
echo "1. Creating Digital Transformation Portfolio..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Portfolio" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Digital Transformation Initiative",
    "description": "Strategic portfolio for digital transformation across the organization",
    "status": "active",
    "portfolio_code": "DX-2025",
    "strategic_theme": "digital_transformation",
    "investment_budget": {"amount": 2500000, "currency": "USD"},
    "target_roi": 25,
    "expected_duration_months": 18
  }'

# 2. Create Client
echo -e "\n2. Creating TechCorp client..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Client" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "TechCorp Solutions",
    "status": "active",
    "client_code": "TECH2025",
    "legal_name": "TechCorp Solutions Inc.",
    "website": "https://techcorp.com",
    "annual_revenue": {"amount": 50000000, "currency": "USD"},
    "employee_count": 250,
    "industry_sector": "technology",
    "company_size": "medium",
    "client_type": "active",
    "customer_since": "2024-01-15",
    "client_tier": "gold",
    "satisfaction_score": 8
  }'

# 3. Create Contact
echo -e "\n3. Creating primary contact..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Contact" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Sarah Johnson",
    "status": "active",
    "first_name": "Sarah",
    "last_name": "Johnson", 
    "job_title": "VP of Technology",
    "department": "IT",
    "work_email": "sarah.johnson@techcorp.com",
    "work_phone": "+1-555-123-4567",
    "seniority_level": "vp",
    "decision_maker": true,
    "budget_authority": true,
    "technical_authority": true,
    "response_rate": 95,
    "preferred_contact_method": "email"
  }'

# 4. Create Project
echo -e "\n4. Creating CRM Modernization project..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Project" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "CRM Modernization",
    "description": "Complete overhaul of customer relationship management system",
    "status": "active",
    "priority": "high",
    "start_date": "2025-01-01",
    "end_date": "2025-06-30",
    "progress_percentage": 35,
    "project_code": "CRM-2025",
    "complexity_score": 7,
    "risk_level": "medium",
    "methodology": "agile",
    "client_facing": true,
    "approved_budget": {"amount": 750000, "currency": "USD"},
    "allocated_hours": 4000
  }'

# 5. Create Epic
echo -e "\n5. Creating User Management epic..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Epic" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "User Management System",
    "description": "Complete user authentication and authorization system",
    "status": "active",
    "epic_code": "CRM-EPIC-1",
    "epic_theme": "User Experience",
    "business_value": 85,
    "user_impact": "high",
    "technical_risk": "medium",
    "target_release": "v2.0",
    "estimated_duration_weeks": 8
  }'

# 6. Create Tasks
echo -e "\n6. Creating sample tasks..."
curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Task" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Implement OAuth 2.0 Authentication",
    "description": "Set up OAuth 2.0 authentication with Google and Microsoft providers",
    "status": "active", 
    "priority": "high",
    "due_date": "2025-02-15",
    "progress_percentage": 60,
    "task_code": "CRM-101",
    "story_points": 8,
    "task_type": "feature",
    "complexity": "major",
    "business_value": 90,
    "estimated_hours": 32,
    "remaining_hours": 12,
    "is_blocked": false,
    "testing_required": true,
    "code_review_required": true,
    "acceptance_criteria_count": 5,
    "acceptance_criteria_met": 3
  }'

curl -X POST "$BASE_URL/api/dataforge/orgs/$ORG_ID/data/Task" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "title": "Design User Dashboard UI",
    "description": "Create responsive user dashboard with role-based content",
    "status": "active",
    "priority": "medium", 
    "due_date": "2025-02-20",
    "progress_percentage": 25,
    "task_code": "CRM-102",
    "story_points": 5,
    "task_type": "feature",
    "complexity": "minor",
    "business_value": 70,
    "estimated_hours": 24,
    "remaining_hours": 18,
    "is_blocked": false,
    "testing_required": true,
    "code_review_required": true,
    "acceptance_criteria_count": 4,
    "acceptance_criteria_met": 1
  }'

echo -e "\n✅ Sample data created successfully!"
echo ""
echo "Created entities:"
echo "- 1 Portfolio: Digital Transformation Initiative"  
echo "- 1 Client: TechCorp Solutions"
echo "- 1 Contact: Sarah Johnson (VP Technology)"
echo "- 1 Project: CRM Modernization"
echo "- 1 Epic: User Management System" 
echo "- 2 Tasks: OAuth Implementation & Dashboard UI"
echo ""
echo "Next: Run relationship connections and test computed fields!"