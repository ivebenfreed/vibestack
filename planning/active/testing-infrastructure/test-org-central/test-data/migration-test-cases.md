# Migration Test Cases

## 🎯 Critical Migration Validation Scenarios

This document outlines the essential test cases for validating the VibeStack migration project using the TechFlow Solutions test organization.

## 🏗️ System Integration Tests

### 1. Multi-Org Data Isolation
**Objective:** Verify complete data isolation between organizations

#### Test Cases
- **TC-001:** Login as TechFlow user, verify only TechFlow data visible
- **TC-002:** Attempt cross-org API access, should be blocked
- **TC-003:** WebSocket sync should only receive TechFlow updates
- **TC-004:** Database queries should respect RLS policies

#### Validation Steps
```bash
# 1. Login as admin@techflow.solutions
# 2. Navigate to projects list
# 3. Verify only TechFlow projects visible
# 4. Check network requests for org isolation
# 5. Test API endpoints with different org IDs (should fail)
```

#### Expected Results
- ✅ Only TechFlow data accessible
- ✅ Cross-org requests return 403/404
- ✅ WebSocket messages filtered by org
- ✅ Database RLS policies enforced

### 2. LiveStore Dynamic Schema Integration
**Objective:** Validate LiveStore working with real organization data

#### Test Cases
- **TC-010:** Generate LiveStore schema from TechFlow entity definitions
- **TC-011:** Create new custom entity via admin interface
- **TC-012:** Real-time schema updates without page reload
- **TC-013:** Query performance comparison vs Dexie

#### Validation Steps
```bash
# 1. Access /debug/livestore-test with admin credentials
# 2. Run "Test Schema Generation" 
# 3. Verify generated schema includes TechFlow entities
# 4. Create new custom field via DataForge API
# 5. Verify LiveStore schema updates automatically
```

#### Expected Results
- ✅ Schema generation succeeds with TechFlow data
- ✅ Custom entities properly converted
- ✅ Real-time updates work without reload
- ✅ Performance meets or exceeds Dexie

### 3. Better Auth + Organization Integration
**Objective:** Verify authentication and organization management works

#### Test Cases
- **TC-020:** Admin login and organization access
- **TC-021:** User role permissions enforced
- **TC-022:** Multi-user concurrent sessions
- **TC-023:** Organization membership management

#### Validation Steps
```bash
# 1. Login with admin@techflow.solutions credentials
# 2. Verify access to all admin features
# 3. Login with manager user in different browser
# 4. Verify manager has limited permissions
# 5. Test user invitation and role assignment
```

#### Expected Results
- ✅ Admin has full organization access
- ✅ Role-based permissions enforced
- ✅ Concurrent sessions work independently
- ✅ User management functions properly

## 🔄 Real-Time Sync Validation

### 4. WebSocket Sync with Organization Isolation
**Objective:** Verify real-time sync respects org boundaries

#### Test Cases
- **TC-030:** Create task in browser A, appears in browser B (same org)
- **TC-031:** Edit project, updates sync to team members
- **TC-032:** Cross-org sync isolation (data doesn't leak)
- **TC-033:** Conflict resolution during simultaneous edits

#### Validation Steps
```bash
# 1. Open TechFlow in two browser windows
# 2. Login as different TechFlow users
# 3. Create/edit entities in one browser
# 4. Verify real-time updates in other browser
# 5. Test with different organization (should not sync)
```

#### Expected Results
- ✅ Same-org updates sync in real-time
- ✅ Cross-org data remains isolated
- ✅ Conflicts resolved appropriately
- ✅ Sync performance acceptable

### 5. Field-Level Sync Control
**Objective:** Verify syncable vs server-only field separation

#### Test Cases
- **TC-040:** Create entity with syncable and server-only fields
- **TC-041:** Verify client receives only syncable fields
- **TC-042:** Server-only fields stay on server
- **TC-043:** Field sync control updates work

#### Validation Steps
```bash
# 1. Create custom entity with mixed field types
# 2. Add server-only field (e.g., internalNotes)
# 3. Add syncable field (e.g., projectStatus)
# 4. Verify client schema excludes server-only fields
# 5. Test field sync control changes
```

#### Expected Results
- ✅ Client receives only syncable fields
- ✅ Server-only fields never sync to client
- ✅ Field controls can be updated dynamically
- ✅ Security maintained throughout

## 🚀 Performance & Scalability Tests

### 6. LiveStore Performance Benchmarking
**Objective:** Compare LiveStore performance vs current Dexie implementation

#### Test Cases
- **TC-050:** Query performance with realistic data volumes
- **TC-051:** Complex joins and filtering operations
- **TC-052:** Large dataset handling (500+ records)
- **TC-053:** Concurrent user load testing

#### Metrics to Measure
- **Query Speed:** SELECT operations time
- **Insert/Update Speed:** CRUD operations time  
- **Memory Usage:** Browser memory consumption
- **Network Traffic:** Sync payload sizes
- **Startup Time:** Initial app load performance

#### Expected Results
- ✅ LiveStore queries 5-10x faster than Dexie
- ✅ Complex joins work efficiently
- ✅ Memory usage comparable or better
- ✅ Network traffic reduced

### 7. Migration System Testing
**Objective:** Verify auto-migration and schema updates work

#### Test Cases
- **TC-060:** Create new custom entity, verify table creation
- **TC-061:** Add custom field, verify column addition
- **TC-062:** Migration batching with rapid changes
- **TC-063:** Migration rollback on failure

#### Validation Steps
```bash
# 1. Monitor database for new table creation
# 2. Use DataForge API to create custom entity
# 3. Verify table appears in database
# 4. Add multiple fields rapidly
# 5. Verify migration batching occurs
```

#### Expected Results
- ✅ Tables created automatically
- ✅ Migrations batched properly
- ✅ No database errors during migration
- ✅ Rollback works on failures

## 🛡️ Security & Access Control Tests

### 8. Container-Based Permission System
**Objective:** Verify container access control works properly

#### Test Cases
- **TC-070:** Project-level access control
- **TC-071:** Task access based on project membership
- **TC-072:** Cross-container access prevention
- **TC-073:** Permission inheritance testing

#### Validation Steps
```bash
# 1. Create project with specific team members
# 2. Create tasks within that project
# 3. Verify non-members cannot access
# 4. Test permission inheritance patterns
# 5. Verify container isolation
```

#### Expected Results
- ✅ Access restricted to container members
- ✅ Permission inheritance works correctly
- ✅ Cross-container access blocked
- ✅ Admin override permissions work

### 9. Data Privacy & Compliance
**Objective:** Ensure data protection and compliance features work

#### Test Cases
- **TC-080:** PII data handling and protection
- **TC-081:** Audit logging for sensitive operations
- **TC-082:** Data export and GDPR compliance
- **TC-083:** User data deletion capabilities

#### Expected Results
- ✅ Sensitive data properly protected
- ✅ All actions logged appropriately
- ✅ Data export functions work
- ✅ User deletion removes all data

## 📊 Reporting & Analytics Tests

### 10. Business Intelligence & Reporting
**Objective:** Verify reporting systems work with new architecture

#### Test Cases
- **TC-090:** Project progress reporting
- **TC-091:** Time tracking and billing reports
- **TC-092:** Resource utilization analytics
- **TC-093:** Cross-project data aggregation

#### Expected Results
- ✅ Reports generate correctly
- ✅ Data aggregation performs well
- ✅ Real-time reporting works
- ✅ Export functionality operational

## 🔧 Migration-Specific Tests

### 11. Data Migration Integrity
**Objective:** Verify data integrity during migration phases

#### Test Cases
- **TC-100:** Pre-migration data backup and verification
- **TC-101:** Migration process data consistency
- **TC-102:** Post-migration data validation
- **TC-103:** Rollback capability testing

### 12. System Compatibility
**Objective:** Ensure compatibility across migration phases

#### Test Cases
- **TC-110:** Backwards compatibility during migration
- **TC-111:** Feature parity between old and new systems
- **TC-112:** API compatibility validation
- **TC-113:** Client application compatibility

## 📋 Test Execution Protocol

### Pre-Test Setup
1. **Environment Verification:** Ensure dev servers running
2. **Data State:** Verify TechFlow organization in known good state
3. **User Access:** Confirm all test accounts functional
4. **Baseline Metrics:** Record current performance baselines

### Test Execution
1. **Systematic Testing:** Execute test cases in order
2. **Documentation:** Record all results and findings
3. **Issue Tracking:** Log any failures or unexpected behavior
4. **Performance Recording:** Capture timing and resource metrics

### Post-Test Analysis
1. **Results Analysis:** Evaluate success/failure rates
2. **Performance Comparison:** Compare against baselines
3. **Issue Resolution:** Address any critical failures
4. **Documentation Update:** Update test documentation

---

**These test cases provide comprehensive validation of the migration project using realistic business scenarios in the TechFlow Solutions test organization.**