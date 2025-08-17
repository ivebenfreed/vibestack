# TechFlow Solutions - Testing Scenarios & Use Cases

## Overview

This document outlines comprehensive testing scenarios for the TechFlow Solutions test organization, covering authentication, business workflows, entity relationships, and edge cases.

## Authentication & Authorization Testing

### Scenario 1: Multi-Role User Management
**Objective**: Test role-based access control across different permission levels

**Steps**:
1. Create all 7 user accounts with link-based email verification
2. Assign proper roles: 1 super_admin, 2 managers, 4 members  
3. Test access to different features based on role permissions
4. Verify data isolation and security boundaries

**Expected Results**:
- Super admin can manage all users and billing
- Managers can oversee projects and team members
- Members can access assigned projects and track time
- Proper error messages for unauthorized access attempts

### Scenario 2: Cross-Project Collaboration
**Objective**: Test users working across multiple projects simultaneously

**Steps**:
1. Assign Emily (Frontend) to 3 concurrent projects
2. Assign Michael (Senior Dev) to provide technical oversight on all projects
3. Test time tracking across multiple projects
4. Verify task assignments and availability management

**Expected Results**:
- Users can switch between projects seamlessly
- Time entries are properly categorized by project
- Resource allocation warnings for over-commitment
- Project-specific permissions maintained

## Business Workflow Testing

### Scenario 3: Complete Project Lifecycle
**Objective**: Test end-to-end project management from client onboarding to delivery

**Project**: EcoTracker Mobile App (GreenTech Innovations)

**Steps**:
1. **Client Onboarding**:
   - Create GreenTech client organization
   - Add client contacts (Lisa Chen, Mark Johnson)
   - Set up contract terms and budget

2. **Project Initialization**:
   - Create EcoTracker project with $80,000 budget
   - Assign team: Rachel (Lead), Maya (Design/QA), Michael (Backend support)
   - Create project phases: Discovery, Design, Development, Testing, Deployment

3. **Sprint Planning**:
   - Create 40 tasks across project phases
   - Assign tasks to team members based on skills
   - Set up task dependencies and priorities

4. **Development Execution**:
   - Track daily time entries for team members
   - Complete tasks and move through workflow stages
   - Conduct code reviews and QA testing

5. **Client Communication**:
   - Schedule regular client meetings
   - Generate progress reports
   - Handle change requests and scope adjustments

6. **Billing & Invoicing**:
   - Generate monthly invoices based on time entries
   - Track payment status and project profitability
   - Monitor budget vs. actual spend

**Expected Results**:
- Seamless project flow from planning to delivery
- Accurate time tracking and billing calculations
- Proper task dependency management
- Client visibility into project progress

### Scenario 4: Resource Conflict Resolution
**Objective**: Test handling of over-allocated team members and resource conflicts

**Setup**:
1. Assign Michael (Senior Dev) to 4 concurrent projects
2. Schedule overlapping deadlines for multiple critical tasks
3. Create resource allocation conflicts

**Steps**:
1. Monitor utilization reports showing over-allocation
2. Reassign tasks to balance workload
3. Adjust project timelines based on resource availability
4. Generate resource utilization dashboards

**Expected Results**:
- System alerts for resource over-allocation
- Flexible task reassignment capabilities
- Updated project timelines reflect resource changes
- Clear visibility into team capacity and availability

## Entity Relationship Testing

### Scenario 5: Complex Data Relationships
**Objective**: Test intricate relationships between clients, projects, tasks, and time entries

**Data Structure**:
```
HealthFirst Medical (Client)
├── Patient Portal Redesign (Project)
│   ├── Frontend Development (Phase)
│   │   ├── Component Library (Task) → Emily's Time Entries
│   │   └── Responsive Design (Task) → Maya's Design + Emily's Implementation
│   └── Backend Development (Phase)
│       ├── FHIR Integration (Task) → James's Time Entries
│       └── Security Implementation (Task) → Michael's Time Entries
└── Telehealth Platform (Project)
    ├── Video Integration (Phase)
    │   └── WebRTC Implementation (Task) → Michael + James Time Entries
    └── Scheduling System (Phase)
        └── Calendar Integration (Task) → Emily's Time Entries
```

**Test Cases**:
1. **Cross-Project Time Tracking**: Same team member logging time across multiple projects
2. **Cascading Updates**: Changing project status updates related tasks and time entries
3. **Dependency Management**: Tasks blocked by incomplete dependencies
4. **Financial Rollups**: Time entries rolling up to invoices and profitability calculations

### Scenario 6: Data Integrity & Consistency
**Objective**: Test data consistency across related entities and prevent orphaned records

**Steps**:
1. Create complex entity relationships with multiple levels of dependencies
2. Attempt to delete records with dependent data
3. Test cascading updates and soft deletes
4. Verify referential integrity constraints

**Test Cases**:
- Delete client with active projects (should prevent or cascade)
- Remove team member assigned to active tasks
- Archive completed projects while maintaining historical data
- Update hourly rates and verify billing calculations

## Real-Time Synchronization Testing

### Scenario 7: WebSocket Connection & Organization Isolation
**Objective**: Test WebSocket-based real-time sync with multi-tenant organization filtering

**Architecture Overview**:
- **WebSocket Endpoint**: `/api/sync` with organization-aware authentication
- **Durable Objects**: Each client gets unique SyncDO instance (`client:{clientId}`)
- **Organization Context**: User context stored in KV for isolation validation
- **CORS Handling**: Dynamic origin validation based on WEB_PORT environment

**Test Setup**:
1. **Multi-User WebSocket Connections**:
   ```bash
   # Sarah (TechFlow CEO) connects from localhost:5173
   wscat -c "ws://localhost:8787/api/sync?clientId=sarah-client-001&auth={session_token}"
   
   # Emily (Frontend Dev) connects from remote
   wscat -c "ws://localhost:8787/api/sync?clientId=emily-client-001&auth={session_token}"
   
   # External user (different org) attempts connection
   wscat -c "ws://localhost:8787/api/sync?clientId=external-client&auth={external_token}"
   ```

2. **Organization Context Validation**:
   ```typescript
   // Test user context storage in KV
   const userContext = {
     userId: "sarah-chen-uuid",
     userRole: "super_admin", 
     userEmail: "sarah.chen@techflow.solutions",
     organizationId: "techflow-org-uuid",
     timestamp: Date.now()
   };
   
   await env.CLIENT_REGISTRY.put(
     `auth:sarah-client-001`,
     JSON.stringify(userContext),
     { expirationTtl: 300 }
   );
   ```

**Expected Results**:
- ✅ TechFlow members can connect and receive organization-scoped updates
- ✅ External organization users cannot access TechFlow data
- ✅ Each client gets unique Durable Object instance
- ✅ User context properly stored and retrieved from KV
- ✅ CORS headers correctly applied based on origin

### Scenario 8: WAL Polling & Organization-Aware Change Detection
**Objective**: Test Write-Ahead Log polling with organization context extraction

**WAL Change Processing Pipeline**:
```typescript
// Organization context extraction from table names
function extractOrganizationContext(tableName: string): OrganizationContext {
  // Case 1: TechFlow organization-scoped tables
  const orgMatch = tableName.match(/^org_([0-9a-fA-F_]{36})_(.+)$/);
  if (orgMatch) {
    return {
      organizationId: orgMatch[1], // techflow-org-uuid
      isSystemTable: false,
      entityName: orgMatch[2] // 'project', 'task', 'time_entry'
    };
  }
  
  // Case 2: System tables (organizations, users)
  if (['organizations', 'organization_members', 'users'].includes(tableName)) {
    return {
      organizationId: null,
      isSystemTable: true,
      entityName: tableName
    };
  }
}
```

**Test Scenarios**:
1. **Project Entity Changes**:
   ```sql
   -- Insert into TechFlow project table
   INSERT INTO org_techflow_12345_project (id, name, status, budget)
   VALUES ('proj-001', 'EcoTracker Mobile App', 'in_progress', 80000);
   
   -- Expected WAL entry:
   -- organization_id: 'techflow-12345'
   -- table_name: 'org_techflow_12345_project'
   -- operation: 'insert'
   -- entity_name: 'project'
   ```

2. **Task Assignment Updates**:
   ```sql
   -- Update task assignment in TechFlow org
   UPDATE org_techflow_12345_task 
   SET assigned_to = 'rachel-green-uuid', status = 'in_progress'
   WHERE id = 'task-001';
   
   -- Expected broadcast only to TechFlow organization members
   ```

3. **Cross-Organization Isolation**:
   ```sql
   -- Simultaneous updates in different orgs should not cross-pollinate
   UPDATE org_acmecorp_6789_project SET status = 'completed' WHERE id = 'acme-proj-1';
   UPDATE org_techflow_12345_project SET status = 'testing' WHERE id = 'tf-proj-1';
   
   -- TechFlow users should only see TechFlow changes
   -- AcmeCorp users should only see AcmeCorp changes
   ```

**Expected Results**:
- ✅ Organization ID correctly extracted from UUIDv7-based table names
- ✅ Changes filtered by organization membership
- ✅ No cross-organization data leakage in real-time updates
- ✅ Change history table properly populated with organization context
- ✅ RLS policies enforce perfect tenant isolation

### Scenario 9: Real-Time Collaborative Task Management
**Objective**: Test concurrent task updates with conflict resolution across team members

**Collaboration Scenario**: Emily and James working on EcoTracker project simultaneously

**Test Flow**:
1. **Initial State**:
   ```json
   {
     "task_id": "eco-tracker-api-task",
     "title": "Implement Carbon Tracking API",
     "assigned_to": "james-wilson-uuid",
     "status": "todo",
     "estimated_hours": 8,
     "last_updated": "2024-08-15T10:00:00Z"
   }
   ```

2. **Concurrent Updates**:
   ```javascript
   // Emily updates task status (Frontend perspective)
   const emilyUpdate = {
     task_id: "eco-tracker-api-task",
     status: "in_progress",
     actual_hours: 2,
     last_updated: "2024-08-15T10:30:00Z"
   };
   
   // James updates task details (Backend perspective) 
   const jamesUpdate = {
     task_id: "eco-tracker-api-task", 
     estimated_hours: 12,
     description: "Added OAuth integration requirement",
     last_updated: "2024-08-15T10:32:00Z"
   };
   ```

3. **Conflict Resolution**:
   ```typescript
   // Client-side conflict detection
   const detectConflict = (localChanges, incomingChanges) => {
     const conflicts = [];
     
     Object.keys(localChanges).forEach(field => {
       if (incomingChanges[field] !== undefined && 
           incomingChanges[field] !== localChanges[field]) {
         conflicts.push({
           field,
           localValue: localChanges[field],
           serverValue: incomingChanges[field],
           strategy: getConflictStrategy(field)
         });
       }
     });
     
     return conflicts;
   };
   ```

**Expected Results**:
- ✅ Both team members receive real-time updates from the other's changes
- ✅ Conflicts are detected and resolved using predefined strategies
- ✅ Task history maintains audit trail of all changes
- ✅ WebSocket connections remain stable during concurrent updates
- ✅ Organization isolation maintained throughout collaborative session

### Scenario 10: Time Tracking Synchronization
**Objective**: Test real-time time entry sync with financial calculation updates

**Multi-User Time Tracking**:
1. **Rachel logs mobile development time**:
   ```json
   {
     "time_entry": {
       "user_id": "rachel-green-uuid",
       "project_id": "eco-tracker-project",
       "task_id": "mobile-ui-task", 
       "date": "2024-08-15",
       "duration_hours": 3.5,
       "description": "Implemented carbon footprint visualization charts",
       "is_billable": true,
       "hourly_rate": 120
     }
   }
   ```

2. **Maya logs QA testing time**:
   ```json
   {
     "time_entry": {
       "user_id": "maya-patel-uuid",
       "project_id": "eco-tracker-project",
       "task_id": "mobile-ui-task",
       "date": "2024-08-15", 
       "duration_hours": 2.0,
       "description": "User acceptance testing for chart interactions",
       "is_billable": true,
       "hourly_rate": 110
     }
   }
   ```

3. **Real-Time Financial Updates**:
   ```typescript
   // Automatic calculations triggered by time entry sync
   const projectFinancials = {
     total_logged_hours: 5.5, // 3.5 + 2.0
     total_billable_amount: 640, // (3.5 × 120) + (2.0 × 110)
     budget_utilization: 0.8, // $640 of $800 task budget
     estimated_completion: "2024-08-16"
   };
   ```

**Expected Results**:
- ✅ Time entries sync in real-time to all team members
- ✅ Project financial metrics update automatically
- ✅ Budget utilization warnings appear when thresholds exceeded
- ✅ Manager dashboards reflect current project profitability
- ✅ Client billing calculations remain accurate across sync events

## Performance & Scale Testing

### Scenario 11: High-Volume Data Operations
**Objective**: Test system performance with realistic data volumes

**Data Scale**:
- 7 users with 500+ time entries each (3,500+ total entries)
- 8 projects with 50+ tasks each (400+ total tasks)
- 150+ meetings with multiple attendees
- 50+ documents and files per project

**Performance Tests**:
1. **Query Performance**: Load dashboards with complex aggregations
2. **Real-time Updates**: Multiple users updating tasks simultaneously
3. **Search Operations**: Full-text search across tasks and documents
4. **Report Generation**: Generate comprehensive project reports

**Expected Benchmarks**:
- Dashboard load times under 2 seconds
- Task updates reflected in real-time (<500ms)
- Search results returned within 1 second
- Report generation completes within 10 seconds

### Scenario 8: Concurrent User Operations
**Objective**: Test system behavior with multiple users performing simultaneous operations

**Concurrent Operations**:
1. Multiple users logging time entries simultaneously
2. Project managers updating task assignments in parallel
3. Real-time task status updates across team members
4. Simultaneous document uploads and edits

**Expected Results**:
- No data conflicts or race conditions
- Proper optimistic locking and conflict resolution
- Real-time sync across all connected users
- Consistent data state across all sessions

## Integration Testing

### Scenario 9: Third-Party Service Integration
**Objective**: Test integration with external services (Polar billing, email, file storage)

**Integration Points**:
1. **Polar Billing**: Test subscription management and payment processing
2. **Email Service**: Verify email verification and notification delivery
3. **File Storage**: Test document upload, download, and version management
4. **Calendar Integration**: Sync meetings with external calendar systems

**Test Scenarios**:
- Trial subscription expiration and upgrade prompts
- Email delivery failures and retry mechanisms
- File upload limits and error handling
- Calendar sync conflicts and resolution

### Scenario 10: API Endpoint Validation
**Objective**: Test all custom organization API endpoints with realistic data

**API Test Coverage**:
1. **Entity CRUD Operations**: Create, read, update, delete for all archetypes
2. **Relationship Management**: Link and unlink related entities
3. **Bulk Operations**: Import/export large datasets
4. **Search & Filtering**: Complex queries across multiple entity types
5. **Aggregation Queries**: Financial reports, time tracking summaries, resource utilization

## Edge Case Testing

### Scenario 11: Data Validation & Error Handling
**Objective**: Test system robustness with invalid data and error conditions

**Test Cases**:
1. **Invalid Email Formats**: Test email validation across all user inputs
2. **Negative Values**: Attempt negative hours, budgets, and rates
3. **Date Logic**: Test impossible date ranges and scheduling conflicts
4. **Required Field Validation**: Submit forms with missing required data
5. **Data Type Mismatches**: Send wrong data types to API endpoints

### Scenario 12: Trial Subscription Limits
**Objective**: Test 14-day trial enforcement and upgrade workflows

**Test Scenarios**:
1. Access application on trial day 1, 7, 13, 14, and 15
2. Test feature restrictions during trial period
3. Verify upgrade prompts and payment processing
4. Test data retention after trial expiration
5. Validate subscription tier upgrades (Trial → Starter → Pro)

## Success Metrics & Validation

### Functional Requirements
- ✅ All 7 user accounts authenticate successfully
- ✅ Role-based permissions enforced correctly
- ✅ All 8 projects created with realistic task structures
- ✅ Time tracking accurate across team members and projects
- ✅ Financial calculations (budgets, invoices, profitability) computed correctly
- ✅ Client relationships and communication workflows functional

### Performance Requirements
- ✅ Dashboard load times < 2 seconds
- ✅ Real-time updates < 500ms latency
- ✅ Search operations < 1 second response time
- ✅ Report generation < 10 seconds
- ✅ System stable under concurrent user load

### Data Integrity Requirements
- ✅ No orphaned records or broken relationships
- ✅ Consistent data state across all operations
- ✅ Proper validation prevents invalid data entry
- ✅ Soft deletes preserve historical relationships
- ✅ Audit trails maintain data change history

### Business Process Requirements
- ✅ Complete project lifecycle from planning to billing
- ✅ Resource allocation and conflict management
- ✅ Client communication and document management
- ✅ Financial tracking and profitability analysis
- ✅ Team collaboration and task management workflows

This comprehensive testing framework validates the VibeStack platform's ability to handle realistic business operations with a 7-person software development agency, ensuring robust functionality, performance, and data integrity.