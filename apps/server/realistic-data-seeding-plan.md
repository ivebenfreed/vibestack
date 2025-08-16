# Realistic Data Seeding Plan for Multi-Tenant Testing

## Overview
Create realistic test data for 2 organizations to validate organization-aware WAL polling, change history tracking, and multi-tenant isolation in the VibeStack system.

## Organization Profiles

### Organization 1: "TechFlow Agency"
- **Slug**: `techflow-agency`
- **Profile**: Digital agency with 8 team members working on client projects
- **Use Case**: Project management, time tracking, client collaboration
- **Data Volume**: Medium (realistic agency workload)

### Organization 2: "StartupBoost Inc"
- **Slug**: `startupboost-inc`  
- **Profile**: Fast-growing SaaS startup with 15 team members
- **Use Case**: Product development, sprint planning, feature tracking
- **Data Volume**: High (startup velocity)

## Data Architecture

### User Distribution
```
TechFlow Agency (8 users):
- 1 Owner (CEO)
- 2 Admins (Project Managers) 
- 3 Members (Developers)
- 2 Viewers (Clients)

StartupBoost Inc (15 users):
- 1 Owner (Founder)
- 3 Admins (Department Heads)
- 8 Members (Engineers, Designers, Marketing)
- 3 Viewers (Advisors, Stakeholders)
```

### Organization-Scoped Tables Structure
Based on the existing `org_{orgId}_{entity}` pattern:

```sql
-- For each organization, we'll create:
org_{orgId}_project      -- Business projects/initiatives
org_{orgId}_task         -- Work items and todos  
org_{orgId}_task_comment -- Discussions and updates
org_{orgId}_time_entry   -- Time tracking records
org_{orgId}_milestone    -- Project milestones
org_{orgId}_file         -- Document/asset management
```

## Realistic Data Scenarios

### TechFlow Agency Scenarios
1. **Client Website Project**
   - 3-month web development project
   - 25 tasks across design, development, testing phases
   - 150+ time entries with realistic hourly distribution
   - 40+ comments with client feedback and team discussions

2. **Mobile App Project** 
   - 6-month iOS/Android app development
   - 45 tasks covering UX, backend, mobile development
   - 200+ time entries across different team members
   - 60+ comments with progress updates and issue resolution

3. **Maintenance & Support**
   - Ongoing client support tasks
   - Bug fixes and feature requests
   - Regular time tracking for billing

### StartupBoost Inc Scenarios  
1. **Product Feature Development**
   - Sprint-based development cycles
   - 60+ feature tasks across multiple sprints
   - 300+ time entries showing development velocity
   - 100+ comments with product discussions

2. **Marketing Campaign**
   - Launch campaign planning and execution
   - 20+ marketing tasks with deadlines
   - Cross-team collaboration comments
   - Timeline tracking for campaign milestones

3. **Infrastructure & DevOps**
   - Technical debt and infrastructure improvements
   - Security and performance tasks
   - Deployment and monitoring activities

## Data Timing Strategy

### Historical Data (3 months back)
- Completed projects and closed tasks
- Archived time entries and comments
- Realistic date distribution showing business patterns

### Recent Activity (last 30 days)
- Active projects with ongoing tasks
- Recent comments and time entries
- Fresh data to test real-time WAL polling

### Future Planning (next 60 days)
- Planned milestones and upcoming tasks
- Scheduled project timelines
- Data to test forward-looking features

## Multi-Tenant Isolation Testing

### Cross-Organization Validation
1. **Data Segregation**: Ensure TechFlow users cannot see StartupBoost data
2. **WAL Change Isolation**: Verify changes only broadcast to correct organization
3. **Search Isolation**: Test that searches don't leak cross-organization results
4. **Performance Testing**: Validate query performance with realistic data volumes

### Security Scenarios
1. **User Migration**: Test moving users between organizations
2. **Organization Deletion**: Validate cascade deletion and cleanup
3. **Permission Changes**: Test role changes and access revocation
4. **API Boundary Testing**: Ensure organization context is enforced

## Technical Implementation

### 1. Database Schema Validation
```sql
-- Verify organization-scoped table structure
SELECT tablename FROM pg_tables 
WHERE tablename LIKE 'org_%' 
ORDER BY tablename;

-- Check RLS policies are active
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename LIKE 'org_%';
```

### 2. Data Generation Scripts
- **Users & Organizations**: Create realistic user profiles with proper roles
- **Projects**: Generate project data with realistic timelines and complexity
- **Tasks**: Create task hierarchies with dependencies and status progression
- **Time Tracking**: Generate time entries following realistic work patterns
- **Comments**: Create discussion threads with realistic collaboration patterns

### 3. WAL Testing Scenarios
- **Bulk Operations**: Insert multiple records to test WAL processing efficiency
- **Update Cascades**: Modify parent records to test child record updates
- **Delete Operations**: Test soft deletes and cascade deletion handling
- **Cross-Table Changes**: Update records across multiple organization tables

## Performance Considerations

### Data Volume Targets
```
TechFlow Agency:
- 50 projects (mix of active/completed)
- 300 tasks with realistic status distribution
- 800 time entries across 3 months
- 500 comments with threaded discussions

StartupBoost Inc:
- 100 projects (higher velocity)
- 600 tasks across multiple sprints  
- 1500 time entries (larger team)
- 900 comments (more collaborative)
```

### Query Performance Testing
- Organization-scoped queries with realistic JOINs
- Full-text search within organization boundaries
- Aggregation queries (reporting, analytics)
- Real-time sync performance under load

## Validation Checklist

### ✅ Data Integrity
- [ ] All organization data properly isolated
- [ ] Foreign key relationships maintained
- [ ] Date ranges realistic and consistent
- [ ] User permissions correctly assigned

### ✅ WAL Integration  
- [ ] Changes tracked in organization-aware change_history
- [ ] LSN progression working correctly
- [ ] Organization context extracted properly
- [ ] Broadcasting isolated to correct organization

### ✅ Multi-Tenant Security
- [ ] Cross-organization queries return empty results
- [ ] RLS policies enforced for all tables
- [ ] User authentication tied to correct organization
- [ ] API endpoints respect organization boundaries

### ✅ Performance
- [ ] Query response times under 100ms for typical operations
- [ ] WAL processing keeps up with change volume
- [ ] Sync operations scale with organization size
- [ ] Memory usage stable under realistic load

## Implementation Scripts

### Phase 1: Organizations & Users (30 min)
Create the foundational organizations and user accounts with proper role distribution.

### Phase 2: Core Data Seeding (45 min)  
Generate projects, tasks, and basic relational data with realistic business context.

### Phase 3: Historical Activity (30 min)
Backfill time entries, comments, and status changes to create realistic usage history.

### Phase 4: Validation Testing (60 min)
Run comprehensive tests to validate multi-tenant isolation and WAL polling accuracy.

## Success Metrics

1. **Isolation Validation**: 0 cross-organization data leaks in any test scenario
2. **WAL Accuracy**: 100% of changes correctly captured and attributed to organizations  
3. **Performance**: Sub-100ms response times for 95% of organization-scoped queries
4. **Real-world Simulation**: Data patterns match actual business usage scenarios

This plan provides a comprehensive foundation for testing the organization-aware WAL polling system with realistic, production-like data scenarios.