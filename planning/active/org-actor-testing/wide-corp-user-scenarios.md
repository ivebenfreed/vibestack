# Wide Corp Organization Actor Testing Scenarios

## Overview

This document demonstrates real-world usage of the Organization Actor SQLite cache with different Wide Corp users, showcasing role hierarchy, permission caching, and schema validation.

## Test Users (Wide Corp Solutions)

| Role | User | Email | Description |
|------|------|-------|-------------|
| **Owner** | Alice CEO | ceo@widecorp.com | Full organization access |
| **Admin** | Bob CTO | cto@widecorp.com | Technical administration |
| **Manager** | Carol PM | pm1@widecorp.com | Project management |
| **Member** | Eve Developer | dev1@widecorp.com | Developer access |

**Organization ID**: `01920000-1000-7000-8000-000000000001`

## Scenario 1: Schema Cache Management

### Alice CEO (Owner) - Schema Administration
- **Permission Level**: Highest (owner > admin > manager > member > viewer)
- **Cache Operations**: Can cache and retrieve all schemas
- **Use Case**: Initial schema setup and validation

### Bob CTO (Admin) - Schema Validation  
- **Permission Level**: Admin access
- **Cache Operations**: Can access cached schemas for technical validation
- **Use Case**: Technical architecture review and schema consistency checks

### Carol PM (Manager) - Schema Reading
- **Permission Level**: Manager access (should have viewer permissions via hierarchy)
- **Cache Operations**: Can read cached schemas for project planning
- **Use Case**: Understanding data structures for project requirements

### Eve Developer (Member) - Schema Consumption
- **Permission Level**: Member access (should have viewer permissions via hierarchy)  
- **Cache Operations**: Can read cached schemas for development
- **Use Case**: Building features with proper data structure understanding

## Scenario 2: Permission Cache Testing

### Resource Permission Matrix
```
Resource: Project #123
Actions: read, write, delete, admin

Expected Hierarchy:
- Owner: ALL permissions (read, write, delete, admin)
- Admin: read, write, delete, admin  
- Manager: read, write, invite
- Member: read, write
- Viewer: read only
```

### Test Cases

#### High-Level Operations (Owner/Admin)
- Alice CEO: Cache admin permissions for critical resources
- Bob CTO: Validate admin access to system configurations

#### Mid-Level Operations (Manager)  
- Carol PM: Cache project management permissions
- Test hierarchical access (manager should have member + viewer permissions)

#### Base-Level Operations (Member/Viewer)
- Eve Developer: Cache development resource permissions
- Test role hierarchy (should have viewer permissions automatically)

## Scenario 3: Role Cache Performance

### Cache Warming Strategy
1. **Bulk Cache**: Load all Wide Corp user roles during initialization
2. **Individual Cache**: Cache roles as users access resources  
3. **Cache Validation**: Verify cached roles match PostgreSQL source
4. **Cache Invalidation**: Test role updates and cache refresh

### Performance Metrics
- **Zero-latency lookups**: All cached operations should be instantaneous
- **Cache hit rates**: Monitor cache effectiveness
- **Fallback behavior**: Ensure PostgreSQL fallback works when cache misses

## Integration Points

### With Hybrid RLS Middleware
- PostgreSQL RLS: Organization-level filtering 
- Organization Actor: Role-based permission caching
- Combined: Zero-latency permission checks with database isolation

### With WebSocket Sync
- Real-time role updates via Organization Actor WebSocket connections
- Cache invalidation on role changes
- Live permission updates across connected clients

## Success Criteria

✅ **Role Hierarchy Working**: Owner can access viewer endpoints  
✅ **SQLite Cache Functional**: POST/GET operations work without errors
✅ **Zero-Latency Performance**: Cached operations complete instantly
✅ **Multi-User Support**: Different roles can access appropriate resources
✅ **Cache Consistency**: Cached data matches PostgreSQL source data