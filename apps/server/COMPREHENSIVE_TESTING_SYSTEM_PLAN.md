# Comprehensive VibeStack Testing System Plan
*Full Server-Only Testing with Authentication, Multi-Tenant, Archetype Creation, and Real-Time Sync*

## Executive Summary

Based on comprehensive research of the VibeStack architecture, this plan outlines a complete testing system that demonstrates the entire workflow from user authentication through multi-tenant organization management to real-time archetype creation and synchronization.

## 🏗️ System Architecture Understanding

### Core Components Identified

1. **Authentication System** (Better Auth)
   - Email/password authentication with UUIDv7 generation
   - Organization plugin for multi-tenant support
   - Session management with cookies
   - User roles: owner, admin, manager, member, viewer

2. **Multi-Tenant Architecture**
   - Organization-level isolation: `org_{orgId}_{entity}` table naming
   - Row Level Security (RLS) policies
   - Organization-aware WAL polling for real-time sync
   - OrgSchemaDO for schema management per organization

3. **Universal Archetype System** (8 Patterns)
   - Project, Task, Record, Document, File, Activity, Discussion, Collection
   - Dynamic table creation through DataForge
   - Custom field support with validation
   - Cross-archetype relationships

4. **Real-Time Synchronization**
   - WebSocket connections via SyncDO
   - Organization-aware broadcasting
   - WAL polling with change history
   - Hibernation API for efficient resource management

5. **DataForge Code Generation**
   - ArchetypeEntityManager for dynamic entity creation
   - Debounced migrations (30-second batching)
   - Runtime schema generation
   - Type-safe operations

## 🎯 Comprehensive Testing Plan

### Phase 1: Authentication & User Management (Foundation)

#### 1.1 User Registration & Sign-In Flow
```bash
# Complete authentication workflow
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name": "TechFlow Admin", "email": "admin@techflow.com", "password": "SecurePass123!"}' \
  -c cookies-admin.txt

curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@techflow.com", "password": "SecurePass123!"}' \
  -c cookies-admin.txt

# Verify session
curl -X GET http://localhost:8787/api/auth/get-session \
  -b cookies-admin.txt
```

#### 1.2 Organization Creation & Multi-User Setup
```bash
# Create TechFlow Agency
curl -X POST http://localhost:8787/api/auth/organization/create \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{"name": "TechFlow Agency", "slug": "techflow-agency-2024"}'

# Create additional users and invite to organization
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name": "Marcus Johnson", "email": "marcus@techflow.com", "password": "SecurePass123!"}'

curl -X POST http://localhost:8787/api/auth/organization/invite-member \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{"email": "marcus@techflow.com", "role": "admin"}'

# Test role-based access
curl -X GET http://localhost:8787/api/auth/organization/list-members \
  -b cookies-admin.txt
```

### Phase 2: Archetype Entity Creation (Core Functionality)

#### 2.1 Project Archetype with Custom Fields
```bash
# Create project archetype entity with custom fields
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "entityName": "client_projects",
    "definition": {
      "archetype": "project",
      "fields": [
        {"name": "client_name", "type": "text", "required": true},
        {"name": "contract_value", "type": "decimal", "required": false},
        {"name": "tech_stack", "type": "json", "required": false},
        {"name": "repository_url", "type": "text", "required": false},
        {"name": "code_quality_score", "type": "integer", "required": false}
      ]
    }
  }'

# Add sample project data
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "name": "RetailCorp E-commerce Platform",
    "description": "Complete e-commerce platform with React frontend",
    "client_name": "RetailCorp Inc",
    "contract_value": 125000.00,
    "priority": "high",
    "status": "active",
    "start_date": "2025-02-01",
    "end_date": "2025-05-01",
    "tech_stack": ["React 18", "Node.js 18", "PostgreSQL 15"],
    "repository_url": "https://github.com/techflow/retailcorp-ecommerce",
    "code_quality_score": 94
  }'
```

#### 2.2 All 8 Archetype Patterns
```bash
# Task Archetype
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "development_tasks", "definition": {"archetype": "task", "fields": [{"name": "complexity_fibonacci", "type": "integer"}]}}'

# Record Archetype (Meeting Notes)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "meeting_notes", "definition": {"archetype": "record", "fields": [{"name": "attendees", "type": "json"}]}}'

# Document Archetype (Contracts)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "contracts", "definition": {"archetype": "document", "fields": [{"name": "value_amount", "type": "decimal"}]}}'

# File Archetype (Source Code)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "source_files", "definition": {"archetype": "file", "fields": [{"name": "lines_of_code", "type": "integer"}]}}'

# Activity Archetype (Deployments)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "deployments", "definition": {"archetype": "activity", "fields": [{"name": "environment", "type": "text"}]}}'

# Discussion Archetype (Team Announcements)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "announcements", "definition": {"archetype": "discussion", "fields": [{"name": "target_audience", "type": "text"}]}}'

# Collection Archetype (Dashboards)
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -d '{"entityName": "dashboards", "definition": {"archetype": "collection", "fields": [{"name": "widget_count", "type": "integer"}]}}'
```

### Phase 3: Multi-Tenant Isolation Testing

#### 3.1 Second Organization Setup
```bash
# Create StartupBoost Inc as second organization
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -d '{"name": "Sarah Chen", "email": "sarah@startupboost.com", "password": "SecurePass123!"}' \
  -c cookies-startupboost.txt

curl -X POST http://localhost:8787/api/auth/sign-in/email \
  -d '{"email": "sarah@startupboost.com", "password": "SecurePass123!"}' \
  -c cookies-startupboost.txt

curl -X POST http://localhost:8787/api/auth/organization/create \
  -d '{"name": "StartupBoost Inc", "slug": "startupboost-2024"}' \
  -b cookies-startupboost.txt
```

#### 3.2 Isolation Validation
```bash
# Verify TechFlow user cannot access StartupBoost data
curl -X GET http://localhost:8787/api/archetype/orgs/STARTUPBOOST_ORG_ID/entities \
  -b cookies-admin.txt
# Expected: 403 Forbidden

# Verify StartupBoost user cannot access TechFlow data
curl -X GET http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities \
  -b cookies-startupboost.txt
# Expected: 403 Forbidden

# Verify each organization can access their own data
curl -X GET http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data \
  -b cookies-admin.txt
# Expected: Success with TechFlow projects

curl -X GET http://localhost:8787/api/archetype/orgs/STARTUPBOOST_ORG_ID/entities \
  -b cookies-startupboost.txt
# Expected: Success with StartupBoost entities (initially empty)
```

### Phase 4: Schema Evolution & Custom Fields

#### 4.1 Dynamic Field Addition
```bash
# Add new fields to existing project archetype
curl -X PATCH http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "fields": [
      {"name": "client_name", "type": "text", "required": true},
      {"name": "contract_value", "type": "decimal", "required": false},
      {"name": "tech_stack", "type": "json", "required": false},
      {"name": "repository_url", "type": "text", "required": false},
      {"name": "code_quality_score", "type": "integer", "required": false},
      {"name": "test_coverage_percentage", "type": "integer", "required": false},
      {"name": "deployment_environments", "type": "json", "required": false}
    ]
  }'

# Verify schema evolution worked
curl -X GET http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/schema \
  -b cookies-admin.txt
```

#### 4.2 Business Logic & Validation
```bash
# Add data that uses new fields
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "name": "FinancePlus Mobile Banking App",
    "description": "iOS and Android mobile banking application",
    "client_name": "FinancePlus Bank",
    "contract_value": 280000.00,
    "priority": "urgent",
    "status": "active",
    "tech_stack": ["React Native", "Node.js 18", "PostgreSQL 15"],
    "test_coverage_percentage": 92,
    "deployment_environments": {
      "development": "https://dev.financeplus.techflow.dev",
      "staging": "https://staging.financeplus.techflow.dev",
      "production": "https://app.financeplus.com"
    }
  }'
```

### Phase 5: Cross-Archetype Relationships

#### 5.1 Entity Relationships
```bash
# Create task related to project
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/development_tasks/data \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "title": "Frontend Component Development",
    "description": "Build React components for product catalog",
    "project_reference": "RetailCorp E-commerce Platform",
    "priority": "high",
    "status": "in_progress",
    "assigned_to": "alex.kim@techflow.com",
    "complexity_fibonacci": 13,
    "estimated_hours": 60
  }'

# Create deployment activity for the project
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/deployments/data \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "title": "RetailCorp Production Deployment v2.1.0",
    "description": "Blue-green deployment with performance improvements",
    "project_reference": "RetailCorp E-commerce Platform",
    "environment": "production",
    "activity_type": "deployment",
    "status": "successful",
    "started_at": "2025-04-30T02:00:00Z",
    "completed_at": "2025-04-30T02:17:00Z"
  }'
```

#### 5.2 Query Cross-Archetype Data
```bash
# Get all entities for a project across archetypes
curl -X GET "http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/search?project_reference=RetailCorp%20E-commerce%20Platform" \
  -b cookies-admin.txt

# Get project with related tasks and activities
curl -X GET "http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data?include_related=true" \
  -b cookies-admin.txt
```

### Phase 6: Real-Time Sync Testing

#### 6.1 WebSocket Connection Setup
```javascript
// WebSocket connection test (would be run in a separate script)
const ws = new WebSocket('ws://localhost:8787/api/sync', {
  headers: {
    'Cookie': 'better-auth.session_token=SESSION_TOKEN_FROM_COOKIES'
  }
});

ws.on('open', () => {
  console.log('✅ WebSocket connected to SyncDO');
  
  // Send initial sync request
  ws.send(JSON.stringify({
    type: 'INIT_SYNC',
    organizationId: 'TECHFLOW_ORG_ID',
    clientId: 'test-client-' + Date.now()
  }));
});

ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('📨 Sync message received:', message.type);
  
  if (message.type === 'INITIAL_SYNC_COMPLETE') {
    console.log('✅ Initial sync completed');
  } else if (message.type === 'CHANGE_NOTIFICATION') {
    console.log('🔄 Change notification:', message.changes);
  }
});
```

#### 6.2 Live Change Broadcasting
```bash
# In terminal 1: Start WebSocket listener
node websocket-sync-test.js

# In terminal 2: Make changes to trigger sync
curl -X POST http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{
    "name": "HealthTech MVP",
    "description": "HIPAA-compliant health tracking application",
    "client_name": "WellnessTech Inc",
    "contract_value": 125000.00,
    "priority": "medium",
    "status": "planning"
  }'

# Expected: WebSocket should receive change notification
```

### Phase 7: Role-Based Access Control

#### 7.1 Different User Role Testing
```bash
# Create member-level user
curl -X POST http://localhost:8787/api/auth/sign-up/email \
  -d '{"name": "Alex Kim", "email": "alex@techflow.com", "password": "SecurePass123!"}' \
  -c cookies-member.txt

curl -X POST http://localhost:8787/api/auth/organization/invite-member \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{"email": "alex@techflow.com", "role": "member"}'

# Test member access (should have limited permissions)
curl -X DELETE http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects \
  -b cookies-member.txt
# Expected: 403 Forbidden (members can't delete entities)

curl -X GET http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities/client_projects/data \
  -b cookies-member.txt
# Expected: Success (members can read data)
```

#### 7.2 Organization-Level Permissions
```bash
# Test organization admin operations
curl -X GET http://localhost:8787/api/auth/organization/list-members \
  -b cookies-admin.txt
# Expected: Success (admin can see members)

curl -X POST http://localhost:8787/api/auth/organization/update-member-role \
  -H "Content-Type: application/json" \
  -b cookies-admin.txt \
  -d '{"memberId": "alex@techflow.com", "role": "admin"}'
# Expected: Success (admin can promote members)
```

## 🔧 Implementation Strategy

### Test Automation Framework

#### 1. Test Runner Script
```bash
#!/bin/bash
# comprehensive-system-test.sh

echo "🚀 Starting VibeStack Comprehensive System Test"

# Phase 1: Authentication Setup
echo "Phase 1: Authentication & User Setup"
./test-auth-setup.sh

# Phase 2: Multi-Tenant Organization Setup  
echo "Phase 2: Multi-Tenant Setup"
./test-multi-tenant-setup.sh

# Phase 3: Archetype Creation
echo "Phase 3: Archetype System Testing"
./test-archetype-creation.sh

# Phase 4: Schema Evolution
echo "Phase 4: Schema Evolution Testing"
./test-schema-evolution.sh

# Phase 5: Real-Time Sync
echo "Phase 5: Real-Time Sync Testing"
./test-sync-system.sh

# Phase 6: Access Control
echo "Phase 6: Access Control Testing"
./test-access-control.sh

echo "✅ Comprehensive System Test Complete"
```

#### 2. Modular Test Scripts
Each phase would have its own script with proper error handling, cleanup, and validation.

#### 3. Database Verification
```bash
# Verify multi-tenant table isolation
psql $DATABASE_URL -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name LIKE 'org_%' 
  ORDER BY table_name;
"

# Verify RLS policies
psql $DATABASE_URL -c "
  SELECT schemaname, tablename, policyname, cmd, qual 
  FROM pg_policies 
  WHERE tablename LIKE 'org_%';
"
```

## 🎯 Success Criteria

### Functional Requirements ✅
- [ ] Users can sign up, sign in, and manage sessions
- [ ] Organizations can be created with proper isolation
- [ ] All 8 archetype patterns can be created dynamically
- [ ] Custom fields can be added with validation
- [ ] Cross-archetype relationships work correctly
- [ ] Real-time sync broadcasts changes organization-aware
- [ ] Role-based access control enforces permissions
- [ ] Schema evolution works without data loss

### Technical Requirements ✅
- [ ] Multi-tenant database isolation verified
- [ ] UUIDv7 generation working correctly
- [ ] WAL polling system functioning
- [ ] WebSocket connections maintain organization context
- [ ] Debounced migrations prevent race conditions
- [ ] Type-safe operations with Kysely
- [ ] Comprehensive error handling and logging

### Performance Requirements ✅
- [ ] API response times < 200ms for CRUD operations
- [ ] WebSocket connection latency < 100ms
- [ ] Database queries optimized with proper indexes
- [ ] Memory usage stable under load
- [ ] Concurrent user handling validated

## 📊 Monitoring & Observability

### Metrics to Track
```bash
# API Performance
curl -w "@curl-format.txt" -s -o /dev/null http://localhost:8787/api/archetype/orgs/TECHFLOW_ORG_ID/entities

# Database Connection Pool
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE application_name LIKE '%vibestack%';"

# WebSocket Connection Count
curl http://localhost:8787/api/debug/sync-connections

# Organization Table Count
psql $DATABASE_URL -c "SELECT COUNT(*) as org_tables FROM information_schema.tables WHERE table_name LIKE 'org_%';"
```

### Health Checks
```bash
# System Health
curl http://localhost:8787/api/health

# Archetype System Health
curl http://localhost:8787/api/archetype/health

# Database Connectivity
curl http://localhost:8787/api/db/health

# Real-Time Sync Health
curl http://localhost:8787/api/sync/health
```

## 🚀 Next Steps

1. **Implement Authentication Test Suite** - Start with the foundation
2. **Build Multi-Tenant Test Framework** - Ensure isolation works perfectly
3. **Create Archetype System Tests** - Validate all 8 patterns
4. **Add Real-Time Sync Validation** - Test WebSocket functionality
5. **Implement Load Testing** - Validate performance under concurrent load
6. **Add Integration Test CI/CD** - Automate the complete test suite

This comprehensive testing plan validates the entire VibeStack system from authentication through real-time sync, ensuring all components work together as designed in a realistic multi-tenant SaaS environment.