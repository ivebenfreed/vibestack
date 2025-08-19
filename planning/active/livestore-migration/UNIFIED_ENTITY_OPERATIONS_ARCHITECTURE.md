# Unified Entity Operations Architecture

## Overview

This document describes the finalized, unified entity operations architecture that eliminates competing systems and provides a single, coherent foundation for all entity operations.

## Problem Solved

**Before**: Multiple competing systems handling entity operations inconsistently:
- EntityManager (generic operations)
- ArchetypeEntityManager (archetype-specific operations)  
- DataForge Test API (temporary testing)
- Universal Archetype API (production-ready)
- Universal Entity Deleter (relationship-aware deletion)

**After**: Single unified system with clear responsibilities.

## Unified Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Production API                          │
│         Universal Archetype API                        │
│         /api/archetype/orgs/:orgId/entities             │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                Unified Operations                       │
│            ArchetypeEntityManager                       │
│         (ALL entity operations)                         │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                 Core Services                           │
│  • JsonRulesEngine (validation)                        │
│  • OrgSchemaManager (schema management)                │
│  • Universal Entity Deleter (relationship cleanup)     │
│  • FoundationEntityRegistry (8 archetypes)             │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                Database Layer                           │
│  • Kysely (type-safe queries)                          │
│  • RuntimeSchemaGenerator (DDL generation)             │
│  • Migration Services (schema changes)                 │
└─────────────────────────────────────────────────────────┘
```

## Key Decisions

### 1. Single Entity Manager
- **ArchetypeEntityManager** handles ALL entity operations
- **EntityManager** deprecated (redundant with archetype system)
- All entities MUST use one of the 8 universal archetypes

### 2. Universal Archetypes Only
All entities are created using these 8 archetypes:
- `project` - Projects, initiatives, campaigns
- `task` - Work items, todos, assignments  
- `record` - Data records, forms, entries
- `document` - Files, documents, content
- `file` - Binary files, attachments
- `activity` - Events, logs, activities
- `discussion` - Conversations, comments, threads
- `collection` - Groups, lists, categories

### 3. Clean API Structure
- **Production**: `/api/archetype/*` (Universal Archetype API)
- **Removed**: `/api/dataforge/*` (temporary testing API)
- **Deprecated**: Generic APIs in favor of archetype-specific operations

### 4. Unified Operations Contract
Every entity operation:
1. **Validates** using JsonRulesEngine
2. **Updates Schema** via OrgSchemaManager
3. **Executes Database Changes** via Kysely
4. **Handles Relationships** via Universal Entity Deleter (for deletes)
5. **Clears Caches** to maintain consistency

## API Endpoints

### Create Entity
```http
POST /api/archetype/orgs/:orgId/entities
Content-Type: application/json

{
  "entityName": "Campaign",
  "definition": {
    "archetype": "project",
    "fields": [
      {
        "name": "budget",
        "type": "number",
        "required": false,
        "syncable": true
      }
    ],
    "syncable": true
  }
}
```

### Delete Entity
```http
DELETE /api/archetype/orgs/:orgId/entities/:entityName
```

### Save Data
```http
POST /api/archetype/orgs/:orgId/data/:entityName
Content-Type: application/json

{
  "name": "Q4 Campaign",
  "budget": 50000,
  "status": "active"
}
```

### Query Data
```http
GET /api/archetype/orgs/:orgId/data/:entityName?limit=10&offset=0
```

### Get Organization Schema (Debug)
```http
GET /api/archetype/orgs/:orgId/schema
```

### Validate Data (Testing)
```http
POST /api/archetype/orgs/:orgId/validate/:entityName
Content-Type: application/json

{
  "name": "Test Campaign",
  "budget": "invalid_number"
}
```

### Migration Management

#### Get Pending Migrations
```http
GET /api/archetype/migrations/pending
```

#### Force Flush Migrations (Development)
```http
POST /api/archetype/migrations/flush
```

## Implementation Changes Made

### 1. Removed Temporary Systems
- ❌ Removed `/api/dataforge/*` routes from main API
- ❌ Deprecated DataForge Test API
- ✅ Unified all operations through Universal Archetype API

### 2. Enhanced Universal Archetype API
- ✅ Added DELETE endpoint for entity removal
- ✅ Integrated with ArchetypeEntityManager for all operations
- ✅ Proper access control and authentication
- ✅ Relationship-aware deletion via Universal Entity Deleter

### 3. Updated Dynamic Schema POC
- ✅ Uses `/api/archetype/*` endpoints instead of `/api/dataforge/*`
- ✅ Sends proper archetype-formatted requests
- ✅ Demonstrates the unified architecture

### 4. Proper Schema Management
- ✅ All operations go through OrgSchemaManager
- ✅ Cache invalidation after schema changes
- ✅ Consistent schema metadata management

## Benefits Achieved

### 1. **Consistency**
- Single codebase for all entity operations
- Consistent behavior across all APIs
- Unified error handling and validation

### 2. **Maintainability**
- No duplicate systems to maintain
- Clear separation of concerns
- Single source of truth for schema

### 3. **Reliability**
- Proper relationship handling
- Schema consistency guarantees
- Type-safe database operations

### 4. **Developer Experience**
- Clear, documented API
- Predictable behavior
- Archetype-based mental model

## Migration Path

### For Existing Code
1. Replace `/api/dataforge/*` calls with `/api/archetype/*`
2. Update request format to use archetype definitions
3. Use archetype-based field definitions

### For New Development
1. Always use `/api/archetype/*` endpoints
2. Choose appropriate archetype for entity type
3. Follow Universal Field Definition format

## Testing

The Dynamic Schema POC demonstrates this unified architecture by:
- Creating entities via Universal Archetype API
- Using proper archetype definitions
- Handling schema refresh after operations
- Showing real-time UI updates

## Future Considerations

### 1. Schema Evolution
- Archetype definitions can evolve
- Migration system handles schema changes
- Backward compatibility maintained

### 2. Performance
- Caching strategy for schema metadata
- Optimized queries via Kysely
- Background migration processing

### 3. Extensibility
- Custom field types via Universal Field Definitions
- Organization-specific archetype extensions
- Plugin system for custom validation rules

This unified architecture provides the solid foundation needed for scalable, maintainable entity operations across the entire application.