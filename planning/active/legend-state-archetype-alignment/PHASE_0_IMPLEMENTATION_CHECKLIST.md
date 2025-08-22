# Phase 0 Implementation Checklist - Backend Consolidation

## Day -3: Naming Consolidation

### File Renaming
- [ ] Rename universal-archetype-api.ts to dataforge-api.ts
- [ ] Update universal-archetype-api imports in api/index.ts
- [ ] Update universal-archetype-api imports in test files
- [ ] Rename universalArchetypeRouter to dataforgeRouter
- [ ] Update router variable references
- [ ] Search and replace "Universal Archetype" comments
- [ ] Search and replace "Universal Entity" comments
- [ ] Update JSDoc comments with DataForge naming
- [ ] Rename any universal-entity related types
- [ ] Update error messages to use DataForge

### Import Updates
- [ ] Update import in api/index.ts
- [ ] Update imports in test files
- [ ] Update imports in middleware files
- [ ] Update imports in service files
- [ ] Update imports in migration files
- [ ] Fix any broken import paths
- [ ] Verify no orphaned imports remain
- [ ] Run TypeScript compiler to check imports
- [ ] Fix any circular dependencies
- [ ] Update path aliases if needed

### Endpoint Path Updates
- [ ] Change /api/archetype to /api/dataforge
- [ ] Update route mounting in api/index.ts
- [ ] Update all client API calls
- [ ] Update Postman collection
- [ ] Update API documentation
- [ ] Update environment variables
- [ ] Update CORS configurations
- [ ] Update rate limiting rules
- [ ] Update monitoring dashboards
- [ ] Update error tracking

### Testing Day -3
- [ ] Run unit tests after renaming
- [ ] Run integration tests
- [ ] Test each renamed endpoint
- [ ] Verify backward compatibility
- [ ] Check error handling
- [ ] Test authentication flow
- [ ] Test authorization flow
- [ ] Verify logging works
- [ ] Check metrics collection
- [ ] Smoke test in staging

## Day -2: Clean Endpoint Structure

### Remove Old Endpoints
- [ ] Archive current endpoint structure
- [ ] Remove /orgs/:orgId/entities POST endpoint
- [ ] Remove /orgs/:orgId/data/:entityName endpoints
- [ ] Remove /orgs/:orgId/sync/:entityName endpoint
- [ ] Remove duplicate schema endpoints
- [ ] Clean up unused route handlers
- [ ] Remove deprecated middleware
- [ ] Update route documentation
- [ ] Remove unused imports
- [ ] Clean up route tests

### Implement Archetype Endpoints
- [ ] Create GET /api/dataforge/orgs/:orgId/archetypes
- [ ] Create GET /api/dataforge/orgs/:orgId/archetypes/:archetype
- [ ] Implement archetype listing logic
- [ ] Implement archetype detail logic
- [ ] Add archetype validation
- [ ] Create archetype response types
- [ ] Add archetype documentation
- [ ] Write archetype endpoint tests
- [ ] Test archetype permissions
- [ ] Verify archetype caching

### Implement Entity Endpoints
- [ ] Create GET /api/dataforge/orgs/:orgId/entities
- [ ] Create POST /api/dataforge/orgs/:orgId/entities
- [ ] Create GET /api/dataforge/orgs/:orgId/entities/:entityName
- [ ] Create DELETE /api/dataforge/orgs/:orgId/entities/:entityName
- [ ] Create PATCH /api/dataforge/orgs/:orgId/entities/:entityName/schema
- [ ] Implement entity listing logic
- [ ] Implement entity creation with archetype
- [ ] Implement entity deletion logic
- [ ] Implement schema update logic
- [ ] Add entity validation

### Implement Data Endpoints
- [ ] Create GET /api/dataforge/orgs/:orgId/data/:entityName
- [ ] Create POST /api/dataforge/orgs/:orgId/data/:entityName
- [ ] Create GET /api/dataforge/orgs/:orgId/data/:entityName/:id
- [ ] Create PUT /api/dataforge/orgs/:orgId/data/:entityName/:id
- [ ] Create DELETE /api/dataforge/orgs/:orgId/data/:entityName/:id
- [ ] Create POST /api/dataforge/orgs/:orgId/data/:entityName/bulk
- [ ] Implement record CRUD logic
- [ ] Implement bulk operations
- [ ] Add data validation
- [ ] Add pagination support

### Implement Schema Endpoints
- [ ] Create GET /api/dataforge/orgs/:orgId/schema
- [ ] Create POST /api/dataforge/orgs/:orgId/schema/validate
- [ ] Create POST /api/dataforge/orgs/:orgId/schema/migrate
- [ ] Implement schema retrieval
- [ ] Implement schema validation
- [ ] Implement migration execution
- [ ] Add migration rollback
- [ ] Add schema versioning
- [ ] Test schema operations
- [ ] Document schema format

### Remove Hardcoded References
- [ ] Find all "Company" references in RecordArchetype.ts
- [ ] Replace "Company" with "Organization"
- [ ] Find all WideCorp references
- [ ] Find all ACME references
- [ ] Create test-fixtures directory
- [ ] Move test data to fixtures
- [ ] Create test-data.ts file
- [ ] Update tests to use fixtures
- [ ] Remove hardcoded emails
- [ ] Remove hardcoded domains

### Testing Day -2
- [ ] Test new endpoint structure
- [ ] Test archetype endpoints
- [ ] Test entity CRUD endpoints
- [ ] Test data CRUD endpoints
- [ ] Test bulk operations
- [ ] Test schema endpoints
- [ ] Verify no hardcoded data
- [ ] Run security scan
- [ ] Performance test endpoints
- [ ] Load test with concurrent requests

## Day -1: Centralize DataForge System

### Create DataForge Core
- [ ] Create /dataforge/index.ts
- [ ] Define DataForge exports
- [ ] Create DataForgeConfig interface
- [ ] Create DataForgeService class
- [ ] Implement service initialization
- [ ] Add dependency injection
- [ ] Create service factory
- [ ] Add service lifecycle hooks
- [ ] Implement service shutdown
- [ ] Add health check endpoint

### Create ArchetypeRegistry
- [ ] Create ArchetypeRegistry.ts
- [ ] Define BaseArchetype interface
- [ ] Implement archetype validation
- [ ] Create getArchetype method
- [ ] Create validateArchetype method
- [ ] Create createEntity method
- [ ] Add archetype metadata
- [ ] Implement archetype listing
- [ ] Add archetype caching
- [ ] Write registry tests

### Implement Archetype Classes
- [ ] Create ProjectArchetype class
- [ ] Create TaskArchetype class
- [ ] Create RecordArchetype class
- [ ] Create DocumentArchetype class
- [ ] Create FileArchetype class
- [ ] Create ActivityArchetype class
- [ ] Create DiscussionArchetype class
- [ ] Create CollectionArchetype class
- [ ] Add base fields to each archetype
- [ ] Add archetype-specific validation

### Enforce Archetype-Only Creation
- [ ] Update entity creation to require archetype
- [ ] Add archetype validation middleware
- [ ] Remove non-archetype creation paths
- [ ] Update entity manager
- [ ] Add archetype field to schema
- [ ] Update migration logic
- [ ] Validate custom fields
- [ ] Add archetype constraints
- [ ] Update error messages
- [ ] Test archetype enforcement

### Update Entity Operations
- [ ] Update ArchetypeEntityManager
- [ ] Integrate with ArchetypeRegistry
- [ ] Update entity validation
- [ ] Update field definitions
- [ ] Update schema generation
- [ ] Update migration service
- [ ] Update query builders
- [ ] Update response formatters
- [ ] Add archetype filters
- [ ] Update entity tests

### Testing Day -1
- [ ] Test ArchetypeRegistry
- [ ] Test each archetype class
- [ ] Test archetype enforcement
- [ ] Test entity creation with archetypes
- [ ] Test custom field validation
- [ ] Test schema generation
- [ ] Test migration with archetypes
- [ ] Integration test DataForge
- [ ] Test service lifecycle
- [ ] Verify no bypass possible

## Day 0: Testing & Migration

### Create Migration Scripts
- [ ] Analyze existing entities
- [ ] Map entities to archetypes
- [ ] Create migration script
- [ ] Add dry-run mode
- [ ] Add rollback capability
- [ ] Create backup procedures
- [ ] Test on staging data
- [ ] Document migration steps
- [ ] Create progress tracking
- [ ] Add error recovery

### Backward Compatibility
- [ ] Create compatibility layer
- [ ] Add deprecation warnings
- [ ] Implement URL redirects
- [ ] Add legacy endpoint support
- [ ] Set deprecation timeline
- [ ] Create migration guide
- [ ] Update client SDKs
- [ ] Test backward compatibility
- [ ] Monitor usage metrics
- [ ] Plan sunset date

### Comprehensive Testing
- [ ] Run full unit test suite
- [ ] Run integration tests
- [ ] Run E2E tests
- [ ] Test with production data copy
- [ ] Load test new system
- [ ] Security audit
- [ ] Performance benchmarks
- [ ] Test error scenarios
- [ ] Test edge cases
- [ ] Verify data integrity

### Documentation Updates
- [ ] Update API documentation
- [ ] Create DataForge guide
- [ ] Document archetype patterns
- [ ] Update endpoint examples
- [ ] Create migration guide
- [ ] Update troubleshooting guide
- [ ] Add code examples
- [ ] Update README files
- [ ] Generate API specs
- [ ] Create video tutorials

### Deployment Preparation
- [ ] Create deployment plan
- [ ] Update CI/CD pipeline
- [ ] Configure feature flags
- [ ] Set up monitoring
- [ ] Configure alerts
- [ ] Prepare rollback plan
- [ ] Update environment configs
- [ ] Test deployment process
- [ ] Schedule maintenance window
- [ ] Notify stakeholders

### Performance Validation
- [ ] Benchmark endpoint response times
- [ ] Measure memory usage
- [ ] Test concurrent operations
- [ ] Verify caching works
- [ ] Test database queries
- [ ] Profile hot paths
- [ ] Optimize slow queries
- [ ] Test with large datasets
- [ ] Verify indexes are used
- [ ] Check connection pooling

### Security Validation
- [ ] Run security scanner
- [ ] Test authentication
- [ ] Test authorization
- [ ] Verify RLS policies
- [ ] Test input validation
- [ ] Check SQL injection protection
- [ ] Test XSS protection
- [ ] Verify CSRF protection
- [ ] Test rate limiting
- [ ] Audit access logs

## Final Validation

### System Health Checks
- [ ] All endpoints responding
- [ ] Database connections stable
- [ ] Cache hit rates normal
- [ ] No memory leaks
- [ ] CPU usage acceptable
- [ ] Response times within SLA
- [ ] Error rates below threshold
- [ ] Logging functioning
- [ ] Metrics collecting
- [ ] Alerts configured

### Sign-off Checklist
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Migration tested
- [ ] Rollback plan ready
- [ ] Team trained
- [ ] Monitoring active
- [ ] Stakeholders informed
- [ ] Go/No-go decision made
- [ ] Deployment scheduled
- [ ] Support team ready

### Post-Deployment Monitoring
- [ ] Monitor error rates
- [ ] Check performance metrics
- [ ] Verify data integrity
- [ ] Monitor user feedback
- [ ] Track API usage
- [ ] Check deprecation warnings
- [ ] Monitor migration progress
- [ ] Verify backups working
- [ ] Check alert thresholds
- [ ] Review incident reports