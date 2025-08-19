# Entity Operations Architecture Audit

## Current State: Multiple Competing Systems

### 1. **DataForge Test API** (`/routes/dataforge-test.ts`)
- **Purpose**: Testing and POC operations
- **Operations**: Basic CRUD (create, query, validate, DDL generation)
- **Issues**: 
  - Simple table dropping without proper cleanup
  - No relationship handling
  - Inconsistent schema management

### 2. **EntityManager** (`/dataforge/entity-operations/entity-manager.ts`)
- **Purpose**: Core DataForge entity management
- **Features**:
  - Organization-specific entity creation
  - JSON Rules Engine integration
  - Kysely type-safe operations
  - Schema validation
  - Migration service integration
- **Strengths**: Well-architected, comprehensive

### 3. **ArchetypeEntityManager** (`/dataforge/entity-operations/ArchetypeEntityManager.ts`)
- **Purpose**: Extends EntityManager with Universal Archetype support
- **Features**:
  - 8 universal archetypes (project, task, record, document, file, activity, discussion, collection)
  - Custom field definitions
  - Archetype migration service
- **Strengths**: Domain-specific, follows archetype patterns

### 4. **Universal Archetype API** (`/routes/universal-archetype-api.ts`)
- **Purpose**: Production-ready API for universal archetypes
- **Features**:
  - Clean, simple API
  - 8 universal archetypes
  - Better Auth integration
  - Universal field definitions
- **Strengths**: Production-ready, well-designed API

### 5. **Universal Entity Deleter** (`/lib/universal-entity-deleter.ts`)
- **Purpose**: Sophisticated relationship-aware deletion
- **Features**:
  - Handles foreign key relationships
  - Junction table cleanup
  - Multiple deletion strategies (CASCADE, SET_NULL, TRANSFER_OWNERSHIP, RESTRICT)
  - Dependency hierarchy awareness
- **Strengths**: Comprehensive, safe deletion

### 6. **Generic Kysely API** (`/api/generic/kysely-entity-config.ts`)
- **Purpose**: Generic database operations
- **Features**: Generic CRUD operations via Kysely

## Problems Identified

### 1. **Schema Inconsistency**
- Tables exist but schema doesn't reflect them
- Different systems manage schema metadata independently
- Cache invalidation issues

### 2. **Operational Inconsistency**
- Create via EntityManager
- Delete via Universal Entity Deleter
- Query via Generic API
- Test via DataForge Test API

### 3. **No Single Source of Truth**
- Multiple systems can modify the same entities
- No coordination between systems
- Conflicting business logic

### 4. **Documentation Gap**
- Unclear which system to use when
- No unified developer experience
- Competing mental models

## Recommended Unified Architecture

### **Core Principle: Single Entity Manager for All Operations**

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer                            │
│  - Universal Archetype API (production)                │
│  - DataForge Test API (development/testing only)       │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                 Unified Service Layer                   │
│  - ArchetypeEntityManager (ALL operations)             │
│  - Universal Entity Deleter (deletion strategies)      │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                  Core Layer                             │
│  - JsonRulesEngine (validation)                        │
│  - OrgSchemaManager (schema management)                │
│  - FoundationEntityRegistry (8 archetypes)             │
└─────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────┐
│                 Database Layer                          │
│  - Kysely (type-safe queries)                          │
│  - RuntimeSchemaGenerator (DDL generation)             │
│  - Migration Services (schema changes)                 │
└─────────────────────────────────────────────────────────┘
```

**Key Change: Remove redundant EntityManager, use only ArchetypeEntityManager**

### **Unified Operations Contract**

Every entity operation should:
1. **Validate** using JsonRulesEngine
2. **Update Schema** via OrgSchemaManager  
3. **Execute Database Changes** via Kysely
4. **Handle Relationships** via Universal Entity Deleter (for deletes)
5. **Notify Changes** via event system
6. **Clear Caches** to maintain consistency

### **Primary System Designation**

- **CREATE**: ArchetypeEntityManager (all archetypes)
- **READ**: ArchetypeEntityManager (with caching)
- **UPDATE**: ArchetypeEntityManager (archetype-aware)
- **DELETE**: ArchetypeEntityManager → Universal Entity Deleter (relationship-aware)
- **SCHEMA**: OrgSchemaManager (single source of truth)

### **API Standardization**

- **Production**: Universal Archetype API only
- **Development**: DataForge Test API (refactored to use unified system)
- **Generic**: Deprecated in favor of Universal Archetype API

## Implementation Plan

1. **Refactor DataForge Test API** to use ArchetypeEntityManager
2. **Implement proper schema management** in all operations
3. **Add unified delete operations** via Universal Entity Deleter
4. **Create comprehensive tests** for the unified system
5. **Document the final architecture** with clear usage guidelines
6. **Deprecate conflicting systems** with migration paths

## Benefits

- **Consistency**: All operations use the same business logic
- **Reliability**: Proper relationship handling and schema management
- **Maintainability**: Single codebase to maintain and debug
- **Developer Experience**: Clear, documented API with predictable behavior
- **Data Integrity**: Coordinated operations prevent inconsistent state