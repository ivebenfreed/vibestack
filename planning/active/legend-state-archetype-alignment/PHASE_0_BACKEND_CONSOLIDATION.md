# Phase 0: Backend Consolidation & Cleanup

## Current State Analysis

### Routing Confusion
1. **Multiple naming conventions**:
   - "Universal Archetype" API in `/routes/universal-archetype-api.ts`
   - "Universal Entity" references mixed with DataForge
   - DataForge is the actual system, but naming is inconsistent

2. **Current endpoint structure** (via `/api/archetype/`):
   - `POST /orgs/:orgId/entities` - Create entity type
   - `POST /orgs/:orgId/data/:entityName` - Create record
   - `PUT /orgs/:orgId/data/:entityName/:id` - Update record
   - `GET /orgs/:orgId/data/:entityName` - List records
   - `DELETE /orgs/:orgId/entities/:entityName` - Delete entity type
   - `GET /orgs/:orgId/schema` - Get schema

3. **DataForge components scattered**:
   - `/dataforge/entities/` - Entity definitions
   - `/dataforge/durable-objects/` - DO implementations
   - `/dataforge/entity-operations/` - Entity manager
   - `/dataforge/migrations/` - Migration service

### Hardcoded Company References
Files with hardcoded company/domain references:
- `RecordArchetype.ts` - Contains "Company" references
- `org-entity-schema.ts` - Sample schemas with company data
- `comprehensive-foundation.test.ts` - Test data with WideCorp
- `multi-tenant.ts` - Tenant examples
- Test files with ACME/WideCorp references

## Phase 0 Implementation Plan

### 0.1: Consolidate Naming (Day -3)
**Goal**: Unify all entity operations under DataForge with Archetype pattern

#### Tasks
- [ ] Rename `universal-archetype-api.ts` to `dataforge-api.ts`
- [ ] Update all imports from universal-archetype to dataforge
- [ ] Change router name from `universalArchetypeRouter` to `dataforgeRouter`
- [ ] Update endpoint paths from `/api/archetype/` to `/api/dataforge/`
- [ ] Remove all "Universal Entity" references
- [ ] Update TypeScript interfaces to use DataForge naming
- [ ] Update client API calls to new endpoints
- [ ] Test all renamed endpoints
- [ ] Update API documentation

### 0.2: Clean Endpoint Structure (Day -2)
**Goal**: Simplify and clarify endpoint purposes

#### New endpoint structure:
```typescript
// DataForge API - All entity operations
/api/dataforge/
  /orgs/:orgId/
    /archetypes                    GET    - List available archetypes
    /archetypes/:archetype         GET    - Get archetype definition
    
    /entities                      GET    - List all entities
    /entities                      POST   - Create new entity type
    /entities/:entityName          GET    - Get entity schema
    /entities/:entityName          DELETE - Delete entity type
    /entities/:entityName/schema   PATCH  - Update entity schema
    
    /data/:entityName              GET    - List records
    /data/:entityName              POST   - Create record
    /data/:entityName/:id          GET    - Get record
    /data/:entityName/:id          PUT    - Update record
    /data/:entityName/:id          DELETE - Delete record
    /data/:entityName/bulk         POST   - Bulk operations
    
    /schema                        GET    - Get full org schema
    /schema/validate               POST   - Validate schema changes
    /schema/migrate                POST   - Run migrations
```

#### Tasks
- [ ] Create new route structure in dataforge-api.ts
- [ ] Implement /archetypes endpoints
- [ ] Consolidate entity CRUD under /entities
- [ ] Consolidate data CRUD under /data
- [ ] Move schema operations to /schema
- [ ] Add bulk operations endpoint
- [ ] Remove duplicate/confusing endpoints
- [ ] Update middleware for new structure
- [ ] Test all new endpoints
- [ ] Update Postman/Insomnia collection

### 0.3: Remove Hardcoded References (Day -2)
**Goal**: Eliminate all hardcoded company/domain data

#### Tasks
- [ ] Replace "Company" in RecordArchetype with generic "Organization"
- [ ] Move sample data to test fixtures directory
- [ ] Create `test-data.ts` with all test companies
- [ ] Update tests to use centralized test data
- [ ] Remove WideCorp from production code
- [ ] Remove ACME references from examples
- [ ] Create environment-based test data
- [ ] Update seed scripts to use test data
- [ ] Verify no hardcoded domains remain
- [ ] Update documentation examples

### 0.4: Centralize DataForge System (Day -1)
**Goal**: Make DataForge the single source of truth for entity operations

#### Tasks
- [ ] Create `/dataforge/index.ts` as main export
- [ ] Consolidate all archetype definitions
- [ ] Create ArchetypeRegistry singleton
- [ ] Move all entity operations to DataForge
- [ ] Remove duplicate entity logic
- [ ] Centralize field type definitions
- [ ] Create DataForgeConfig interface
- [ ] Implement DataForgeService class
- [ ] Add service to dependency injection
- [ ] Update all imports to use centralized exports
- [ ] Write integration tests
- [ ] Document DataForge architecture

### 0.5: Archetype-Only Entity System (Day -1)
**Goal**: Enforce that all entities must be created through archetypes

#### Implementation
```typescript
// dataforge/ArchetypeRegistry.ts
export class ArchetypeRegistry {
  private static archetypes = {
    'project': ProjectArchetype,
    'task': TaskArchetype,
    'record': RecordArchetype,
    'document': DocumentArchetype,
    'file': FileArchetype,
    'activity': ActivityArchetype,
    'discussion': DiscussionArchetype,
    'collection': CollectionArchetype
  };
  
  static validateArchetype(archetype: string): boolean {
    return archetype in this.archetypes;
  }
  
  static getArchetype(name: string): BaseArchetype {
    if (!this.validateArchetype(name)) {
      throw new Error(`Invalid archetype: ${name}`);
    }
    return this.archetypes[name];
  }
  
  static createEntity(
    orgId: string,
    archetype: string,
    entityName: string,
    customFields: FieldDefinition[]
  ): EntityDefinition {
    const ArchetypeClass = this.getArchetype(archetype);
    return new ArchetypeClass(orgId, entityName, customFields);
  }
}
```

#### Tasks
- [ ] Create ArchetypeRegistry class
- [ ] Define BaseArchetype interface
- [ ] Implement all 8 archetype classes
- [ ] Add archetype validation to entity creation
- [ ] Remove non-archetype entity creation
- [ ] Update entity manager to use registry
- [ ] Add archetype metadata to entities
- [ ] Create archetype migration path
- [ ] Test archetype enforcement
- [ ] Document archetype patterns

### 0.6: Testing & Migration (Day 0)
**Goal**: Ensure smooth transition and backward compatibility

#### Tasks
- [ ] Create migration script for existing entities
- [ ] Add backward compatibility layer
- [ ] Write comprehensive test suite
- [ ] Test with production data copy
- [ ] Create rollback procedures
- [ ] Update CI/CD pipeline
- [ ] Load test new endpoints
- [ ] Security audit new structure
- [ ] Create migration documentation
- [ ] Prepare deployment plan

## Success Criteria

### Technical Metrics
- [ ] All endpoints follow consistent naming
- [ ] Zero hardcoded company references
- [ ] All entities created through archetypes
- [ ] 100% test coverage for DataForge
- [ ] No performance regression

### Code Quality
- [ ] Single source of truth for entity operations
- [ ] Clear separation of concerns
- [ ] Consistent error handling
- [ ] Comprehensive TypeScript types
- [ ] Clean dependency graph

### Documentation
- [ ] Updated API documentation
- [ ] DataForge architecture guide
- [ ] Archetype pattern documentation
- [ ] Migration guide for existing code
- [ ] Example implementations

## Risk Mitigation

### Backward Compatibility
- Maintain old endpoints with deprecation warnings
- Provide migration period (2 weeks)
- Auto-redirect old URLs to new ones
- Version API with /v2/ prefix if needed

### Data Integrity
- Full backup before migration
- Test migrations on staging first
- Implement gradual rollout
- Monitor error rates closely
- Have rollback plan ready

### Client Impact
- Update client SDK first
- Use feature flags for transition
- Communicate changes early
- Provide migration tools
- Support both APIs temporarily

## Timeline

### Day -3: Naming Consolidation
- Morning: Rename files and update imports
- Afternoon: Test and fix broken references

### Day -2: Endpoint Structure & Cleanup
- Morning: Implement new route structure
- Afternoon: Remove hardcoded references

### Day -1: Centralization & Archetype System
- Morning: Create centralized DataForge system
- Afternoon: Implement archetype-only enforcement

### Day 0: Testing & Preparation
- Morning: Run full test suite and migrations
- Afternoon: Final review and documentation

## Next Steps After Phase 0

Once Phase 0 is complete, we can proceed with the original phases:
1. **Phase 1**: Schema Standardization (with clean DataForge base)
2. **Phase 2**: Custom Field Rendering (using archetype metadata)
3. **Phase 3**: Granular Live Updates (with clear endpoints)
4. **Phase 4**: Schema Evolution UI (on solid foundation)

## Dependencies

### Required Before Starting
- [ ] Full database backup
- [ ] Staging environment ready
- [ ] All team members informed
- [ ] Client SDK update prepared
- [ ] Monitoring alerts configured

### Tools Needed
- TypeScript compiler watch mode
- Database migration tools
- API testing suite (Postman/Insomnia)
- Load testing tools
- Monitoring dashboard