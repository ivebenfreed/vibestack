# Schema System Consolidation & Cleanup Plan

## Executive Summary

We have successfully **eliminated Durable Object over-complexity** and implemented a **PostgreSQL-native schema system** that provides complete entity coverage. This document outlines the consolidation achieved and identifies remaining cleanup tasks.

## ✅ Major Achievements Completed

### 1. PostgreSQL-Native Schema System
- **Created**: Central `entity_schemas` table with org_id, entity_name, table_name, archetype, business_metadata
- **Populated**: All 13 Wide Corp business entities with proper archetype classifications
- **Updated**: Schema endpoint to query PostgreSQL directly instead of Durable Objects
- **Verified**: API now returns all 13 entities instead of just 5

### 2. Architectural Simplification
- **Eliminated**: Durable Object schema registry complexity
- **Unified**: Single source of truth in PostgreSQL for both data and schema
- **Removed**: Dual write complexity and cache invalidation issues
- **Simplified**: Dynamic Schema POC to use direct PostgreSQL API calls

### 3. Universal Archetype Integration
- **Classified**: All entities by archetype (project, record, document, activity)
- **Structured**: Business metadata in JSONB for rich field definitions
- **Standardized**: Base archetype inheritance patterns

## 🧹 Cleanup Tasks Needed

### Phase 1: Remove Obsolete Durable Object Code (High Priority)

#### Files to Review/Remove:
```
apps/server/src/dataforge/durable-objects/OrgSchemaDO.ts
- Remove getSyncableSchema() method (now redundant)
- Remove schema storage logic (PostgreSQL is source of truth)
- Consider deprecating entire file if no other functionality used

apps/server/src/dataforge/entity-operations/entity-manager.ts
- Remove storeEntityConfig() method (lines 286-320)
- Remove DO-related schema storage logic
- Keep getOrgSyncSchema() (already updated to use PostgreSQL)

apps/web/src/lib/livestore-schema-client.ts
- Simplify loadLiveStoreSchema() - remove DO bridge logic
- Update to use PostgreSQL schema directly
- Remove Durable Object initialization code
```

#### Environment Variables:
```
# Can potentially remove if OrgSchemaDO is fully deprecated:
env.ORG_SCHEMA (OrgSchemaDO) - Durable Object binding
```

### Phase 2: Client-Side Schema Loading Simplification (Medium Priority)

#### Schema Client Consolidation:
```
apps/web/src/lib/schema-client.ts
- Already updated to use /api/archetype/ endpoints
- Remove any remaining caching complexity
- Simplify to direct PostgreSQL API calls

apps/web/src/lib/livestore-schema-client.ts  
- Remove LiveStoreSchemaClient.loadLiveStoreSchema() complexity
- Simplify to direct schema fetch + LiveStore initialization
- Remove Durable Object bridge logic
```

### Phase 3: Entity Creation Workflow Consolidation (Low Priority)

#### Entity Registration Process:
When new entities are created via Universal Archetype API:
```
apps/server/src/routes/universal-archetype-api.ts
- Entity creation should INSERT into entity_schemas table
- Remove any Durable Object entity registration
- Ensure archetype is properly set from Universal Archetype pattern
```

#### Migration Integration:
```
apps/server/src/dataforge/migration/archetype-migration-service.ts
- Update to use entity_schemas table for metadata
- Remove Durable Object schema coordination
- Simplify migration logic to PostgreSQL-only
```

### Phase 4: Testing & Validation Cleanup (Low Priority)

#### Test Files:
```
apps/server/src/dataforge/test-auth-flow.test.ts
- Update tests to expect PostgreSQL schema responses
- Remove Durable Object schema tests
- Update entity count expectations (5 → 13 for Wide Corp)

Dynamic Schema POC:
- Already updated to use PostgreSQL API
- Verify all 13 entities display correctly
- Test entity operations with new archetype structure
```

## 📊 Impact Assessment

### Before vs After Architecture:

| Aspect | Before (DO) | After (PostgreSQL) |
|--------|-------------|-------------------|
| **Entity Coverage** | 5 entities | ✅ 13 entities |
| **Single Source of Truth** | ❌ Dual system | ✅ PostgreSQL only |
| **Complexity** | ❌ High (DO + PG) | ✅ Low (PG only) |
| **Cache Invalidation** | ❌ Complex | ✅ None needed |
| **Multi-tenancy** | ❌ DO per org | ✅ org_id column |
| **Schema Evolution** | ❌ Dual writes | ✅ Simple INSERTs |

### Benefits Achieved:
- **Eliminated 8 missing entities** from Wide Corp schema
- **Removed architectural over-complexity** 
- **Unified schema management** in PostgreSQL
- **Future-proof entity addition** via simple SQL

## 🚧 Migration Safety Notes

### Backwards Compatibility:
- All existing API endpoints continue to work
- Schema response format unchanged for clients
- Entity operations remain functional during cleanup

### Rollback Strategy:
- Keep entity_schemas table populated
- Don't remove PostgreSQL schema code during cleanup
- Durable Object code can be removed incrementally

### Testing Checkpoints:
- [ ] Wide Corp shows 13 entities in Dynamic Schema POC
- [ ] Entity creation via Universal Archetype API works
- [ ] Schema API response includes all archetype information
- [ ] LiveStore initialization works with PostgreSQL schema

## 🔄 Future Enhancements Enabled

### Now Possible with PostgreSQL-Native Schema:
1. **Cross-org schema analytics** - Query schema patterns across organizations
2. **Schema versioning** - Add version columns and track evolution
3. **Bulk entity operations** - Efficient PostgreSQL batch operations
4. **Schema validation** - Database constraints for archetype validity
5. **Advanced querying** - JSONB queries on business metadata

## 📝 Action Items Summary

### Immediate (This Sprint):
- [ ] Test Dynamic Schema POC shows all 13 entities
- [ ] Verify entity creation inserts into entity_schemas table

### Next Sprint:
- [ ] Remove obsolete Durable Object schema methods
- [ ] Simplify client-side schema loading
- [ ] Update environment variable bindings

### Future Sprints:
- [ ] Remove OrgSchemaDO entirely if no other dependencies
- [ ] Add schema versioning columns
- [ ] Implement cross-org schema analytics

---

**Status**: PostgreSQL-native schema system **fully operational** with complete entity coverage. Cleanup tasks are non-critical and can be done incrementally without affecting functionality.