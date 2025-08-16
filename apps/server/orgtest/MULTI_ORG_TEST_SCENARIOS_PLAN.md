# Multi-Organization Test Scenarios Plan

## 🎯 Objective
Create diverse test organizations to validate container permission system across different scales, structures, and usage patterns.

## Database Cleanup Strategy

### Phase 1: Clean Non-System Tables
```sql
-- Remove all organization-specific tables (keep auth/system tables)
DROP TABLE IF EXISTS org_108b0ac2_487f_4951_b295_b1924288daad_project CASCADE;
DROP TABLE IF EXISTS org_108b0ac2_487f_4951_b295_b1924288daad_task CASCADE; 
DROP TABLE IF EXISTS org_108b0ac2_487f_4951_b295_b1924288daad_time_entry CASCADE;

-- Clear container permissions (will recreate)
DELETE FROM container_permission WHERE permission_container_type IN ('organization', 'project');

-- Clear organization members except system admin
DELETE FROM organization_members WHERE organization_id = '108b0ac2-487f-4951-b295-b1924288daad';

-- Keep: user, account, session, verification, organization tables
-- Keep: System admin user for management
```

### Phase 2: Reset Organization State
- Keep TechFlow organization record but clear data
- Maintain admin user authentication
- Clear all test-generated business data

## Test Organization Scenarios

### 🏢 Scenario 1: "Wide Corp" - Many Tables, Few Records
**Profile**: Software consultancy with diverse service offerings
- **Tables**: 12+ entity types (projects, clients, contracts, invoices, timesheets, expenses, resources, skills, certifications, proposals, meetings, documents)
- **Records**: 2-5 records per table (~50 total records)
- **Users**: 8 users with varied permission combinations
- **Focus**: Test table discovery, permission complexity, schema diversity

**Container Structure**:
```
Wide Corp (Organization)
├── Client Projects (Container)
│   ├── Project Alpha (3 users)
│   └── Project Beta (2 users)
├── Internal Operations (Container)  
│   ├── HR Department (2 users)
│   └── Finance Department (2 users)
└── Resource Management (Container)
    └── Skill Development (4 users)
```

### 🏗️ Scenario 2: "Tall Industries" - Few Tables, Many Records  
**Profile**: Manufacturing company with high-volume operations
- **Tables**: 4 core entity types (products, orders, inventory, quality_checks)
- **Records**: 100+ records per table (~500 total records)
- **Users**: 12 users with department-based access
- **Focus**: Test record filtering performance, bulk operations, pagination

**Container Structure**:
```
Tall Industries (Organization)
├── Production Line A (Container) - 200 orders
├── Production Line B (Container) - 150 orders  
├── Quality Control (Container) - 300 quality checks
└── Inventory Management (Container) - 500+ products
```

### 🌐 Scenario 3: "Matrix Dynamics" - Complex Hierarchy
**Profile**: Global consulting firm with matrix organization
- **Tables**: 8 entity types with complex relationships
- **Records**: 20-30 records per table (~200 total records)
- **Users**: 15 users with overlapping permissions
- **Focus**: Test permission inheritance, role conflicts, nested containers

**Container Structure**:
```
Matrix Dynamics (Organization)
├── Geographic Regions
│   ├── North America (Container)
│   ├── Europe (Container)
│   └── Asia Pacific (Container)
├── Service Lines
│   ├── Strategy Consulting (Container)
│   ├── Technology Consulting (Container)
│   └── Operations Consulting (Container)  
└── Client Accounts
    ├── Enterprise Client A (Container)
    ├── Enterprise Client B (Container)
    └── Government Contracts (Container)
```

### 👥 Scenario 4: "People Scale" - Large User Base
**Profile**: Large organization with many employees
- **Tables**: 6 standard entity types
- **Records**: 30-50 records per table (~250 total records)
- **Users**: 25+ users with diverse permission patterns
- **Focus**: Test user management, permission queries at scale, role distribution

**Role Distribution**:
- 1 Owner, 2 Admins, 5 Managers, 12 Members, 8 Contributors, 5 Viewers
- Cross-cutting project assignments
- Temporal permission changes (expired, pending)

### 🔄 Scenario 5: "Permission Edge Cases" - Complex Access Patterns
**Profile**: Research organization with specialized access needs
- **Tables**: 6 entity types with sensitive data
- **Records**: 40 records per table (~240 total records)  
- **Users**: 10 users with edge case permissions
- **Focus**: Test permission edge cases, security boundaries, error handling

**Edge Cases to Test**:
- Expired permissions
- Conflicting role assignments
- Nested container permissions
- Permission inheritance chains
- Circular permission references
- Restricted field access
- Time-based access windows

## Implementation Plan

### Phase 1: Database Cleanup (Immediate)
1. Create cleanup script to remove test tables
2. Clear container permissions 
3. Reset organization membership
4. Validate auth tables remain intact

### Phase 2: Scenario Infrastructure (Week 1)
1. **Organization Creation Scripts**
   - `create-wide-corp.cjs` - Many tables scenario
   - `create-tall-industries.cjs` - High volume scenario  
   - `create-matrix-dynamics.cjs` - Complex hierarchy
   - `create-people-scale.cjs` - Large user base
   - `create-edge-cases.cjs` - Permission edge cases

2. **User Management Scripts**
   - Bulk user creation with realistic profiles
   - Password generation and management
   - Role assignment automation
   - Permission matrix generation

### Phase 3: Data Generation (Week 1-2)
1. **Realistic Data Generators**
   - Business-appropriate entity relationships
   - Varied data volumes per scenario
   - Cross-references between entities
   - Temporal data patterns

2. **Permission Assignment**
   - Role-based permission templates
   - Container-specific access patterns
   - Cross-cutting permissions
   - Edge case permission scenarios

### Phase 4: Test Automation (Week 2)
1. **Sync Testing Scripts**
   - Per-scenario user sync validation
   - Performance measurement scripts  
   - Permission verification tests
   - Data isolation validation

2. **Monitoring & Metrics**
   - Sync performance tracking
   - Permission query performance
   - Record filtering efficiency
   - User experience metrics

## Expected Outcomes

### Performance Benchmarks
- **Wide Corp**: Validate table discovery and permission complexity
- **Tall Industries**: Establish record filtering performance baselines
- **Matrix Dynamics**: Test complex permission resolution
- **People Scale**: Validate user management at scale
- **Edge Cases**: Ensure security and error handling robustness

### Validation Criteria
1. ✅ **Sync Performance**: <2s initial sync for largest scenario
2. ✅ **Permission Accuracy**: 100% correct record filtering
3. ✅ **Security**: Zero unauthorized data access
4. ✅ **Scalability**: Linear performance degradation with scale
5. ✅ **Reliability**: Consistent results across repeated tests

## Testing Infrastructure

### Automated Test Suite
```bash
# Run all scenario tests
./scripts/test-all-scenarios.sh

# Individual scenario testing
./scripts/test-scenario.sh wide-corp
./scripts/test-scenario.sh tall-industries  
./scripts/test-scenario.sh matrix-dynamics
./scripts/test-scenario.sh people-scale
./scripts/test-scenario.sh edge-cases
```

### Performance Monitoring
- Sync duration tracking
- Record filtering metrics
- Database query performance
- Memory usage patterns
- Container permission cache effectiveness

## Risk Mitigation

### Data Safety
- Automated database backups before major changes
- Rollback scripts for each scenario
- Isolated test environments
- Auth table protection measures

### Performance Safeguards  
- Query timeout limits
- Record count limits during testing
- Permission cache invalidation
- Monitoring for infinite loops or excessive queries

## Success Metrics

### Functional Validation
- All users see only authorized data
- Performance remains acceptable across scenarios  
- No security vulnerabilities discovered
- Edge cases handled gracefully

### Operational Readiness
- Clean setup/teardown procedures
- Comprehensive test coverage
- Performance baselines established
- Production deployment confidence