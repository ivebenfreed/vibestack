# LiveStore Schema System

## Overview

The LiveStore Schema System provides a comprehensive schema management solution for LiveStore, similar to the Dexie schema generator but specifically designed for multi-tenant real-time architectures. This system was created in response to the user's request for "a script like the dexit schrma gen" for LiveStore.

## Key Features

### ✅ Schema Generation
- **Automated schema generation** from entity definitions
- **Version management** with change detection and history tracking
- **TypeScript interface generation** for full type safety
- **Validation rules** built into the schema definition

### ✅ Multi-Tenant Architecture
- **Organization-scoped entities** with automatic isolation
- **Global entities** for cross-organizational data
- **Access control integration** with permission-based field filtering
- **Tenant-aware queries** and data validation

### ✅ Real-Time Integration
- **Schema-aware event distribution** with validation
- **Permission-driven field filtering** for sensitive data
- **Type-safe sync operations** with schema validation
- **Automatic organization scoping** for multi-tenant entities

## Generated Files

### Schema Definition
- `src/generated/sample-livestore-schema.ts` - Main schema class with utilities
- `src/generated/sample-livestore-entities.ts` - TypeScript interfaces

### Schema Structure
```typescript
export class LiveStoreSchema {
  static readonly VERSION = 1;
  static readonly ENTITIES = { /* entity definitions */ };
  static readonly ARCHETYPES = ['project', 'task', 'user', 'organization'];
  static readonly MULTI_TENANT_ENTITIES = ['project', 'task'];
  
  // Utility methods
  static getEntity(archetype: string): LiveStoreEntityDefinition | undefined;
  static validateEntity(archetype: string, data: any): ValidationResult;
  static getOrganizationQuery(archetype: string, orgId: string): any;
  static canAccessEntity(archetype: string, data: any, userOrgId: string): boolean;
  // ... more utilities
}
```

## Entity Definition Format

Each entity includes comprehensive metadata:

```typescript
interface LiveStoreEntityDefinition {
  archetype: string;           // Entity type identifier
  entityName: string;          // Class name
  tableName: string;           // Database table name
  primaryKey: string;          // Primary key field
  indexes: string[];           // Database indexes
  fields: LiveStoreFieldDefinition[];      // Field definitions
  relationships: LiveStoreRelationshipDefinition[]; // Relations
  permissions: string[];       // Required permissions
  isMultiTenant: boolean;      // Multi-tenant flag
  isSystem?: boolean;          // System entity flag
  category?: string;           // Entity category
}
```

## Field Types and Validation

### Supported Field Types
- `string`, `text` - Text data
- `number` - Numeric values
- `boolean` - True/false values
- `date` - Date/timestamp values
- `json` - JSON objects
- `uuid` - UUID identifiers
- `email` - Email addresses (with validation)
- `url` - URL strings
- `enum` - Enumerated values
- `reference` - Foreign key references
- `array` - Array data

### Validation Rules
```typescript
interface FieldValidation {
  min?: number;          // Minimum length/value
  max?: number;          // Maximum length/value
  pattern?: string;      // Regex pattern
  enum?: string[];       // Allowed enum values
  custom?: string;       // Custom validation function
}
```

## Multi-Tenant Features

### Automatic Organization Scoping
```typescript
// Multi-tenant entities automatically include organizationId
const orgQuery = LiveStoreSchema.getOrganizationQuery('project', 'org-123');
// Returns: { organizationId: 'org-123' }

// Access control validation
const canAccess = LiveStoreSchema.canAccessEntity('project', projectData, userOrgId);
```

### Tenant Isolation
- Multi-tenant entities are automatically filtered by organization
- Cross-tenant access is prevented by schema validation
- Organization membership is enforced at the schema level

## Real-Time Integration

### Schema-Aware Event Distribution
```typescript
class SchemaAwareEventDistributor {
  validateAndFilterEvent(event: AccessControlledEvent, recipient: EventRecipient) {
    // 1. Validate archetype exists
    // 2. Validate event data against schema
    // 3. Check multi-tenant access
    // 4. Filter sensitive fields based on permissions
    return filteredEvent;
  }
}
```

### Schema-Validated Sync Operations
```typescript
class SchemaAwareSyncManager {
  async createSyncOperation(type, archetype, entityId, orgId, userId, data) {
    // 1. Validate archetype
    // 2. Validate data against schema
    // 3. Apply organization scoping for multi-tenant entities
    // 4. Create type-safe sync operation
    return syncOperation;
  }
}
```

## Permission Integration

### Schema-Driven Permissions
- Each entity defines required permissions
- Field-level permission filtering
- Sensitive field protection
- Role-based access control integration

```typescript
// Get required permissions for an entity
const permissions = LiveStoreSchema.getPermissions('project');
// Returns: ['project.read', 'project.write', 'project.delete', 'project.admin']

// Get sensitive fields that need special permission handling
const sensitiveFields = LiveStoreSchema.getSensitiveFields('user');
// Returns: ['email'] (marked as sensitive in schema)
```

## Scripts and Tools

### Generation Scripts
- `scripts/generate-livestore-schema.ts` - Full schema generator (MikroORM integration)
- `scripts/create-sample-schema.ts` - Sample schema generator (standalone)

### Testing and Demo Scripts
- `scripts/test-livestore-schema.ts` - Schema functionality tests
- `scripts/demo-phase4-integration.ts` - Phase 4 integration demonstration

### Usage
```bash
# Generate sample schema
npx tsx scripts/create-sample-schema.ts

# Test schema functionality
npx tsx scripts/test-livestore-schema.ts

# Demonstrate Phase 4 integration
npx tsx scripts/demo-phase4-integration.ts
```

## Comparison to Dexie Schema Generator

| Feature | Dexie Schema | LiveStore Schema |
|---------|--------------|------------------|
| **Source** | MikroORM entities | MikroORM entities + LiveStore extensions |
| **Target** | IndexedDB (Dexie) | Multi-tenant real-time system |
| **Versioning** | Version history | Version history + change detection |
| **Multi-tenancy** | Not supported | Built-in with organization scoping |
| **Permissions** | Not included | Comprehensive permission integration |
| **Validation** | Basic structure | Full data validation with rules |
| **Real-time** | Not applicable | Event filtering and sync validation |
| **Type Safety** | TypeScript interfaces | Full type safety + runtime validation |

## Benefits Over Dexie Approach

### 🏢 Multi-Tenant Architecture
- **Organization isolation** built into the schema
- **Automatic tenant scoping** for queries and operations
- **Cross-tenant access prevention** at the schema level

### 🔐 Security Integration
- **Permission-based field filtering** for sensitive data
- **Schema-driven access control** with role validation
- **Real-time permission enforcement** during sync

### ⚡ Real-Time Optimization
- **Event validation** before distribution
- **Type-safe sync operations** with schema validation
- **Performance optimization** through schema-aware caching

### 🔧 Developer Experience
- **Comprehensive type safety** from schema to client
- **Runtime validation** with detailed error messages
- **Schema introspection** for dynamic UI generation

## Future Enhancements

### Planned Features
- **Migration system** for schema version upgrades
- **DataForge integration** for automatic schema extraction
- **Schema diff tools** for change management
- **Performance profiling** for schema operations

### Integration Opportunities
- **MikroORM entity extraction** (when DataForge issues are resolved)
- **Drizzle schema generation** for database compatibility
- **GraphQL schema generation** for API consistency
- **JSON Schema export** for external validation

## Conclusion

The LiveStore Schema System successfully provides "a script like the dexit schrma gen" but specifically designed for LiveStore's multi-tenant real-time architecture. It offers:

1. **Schema generation** similar to Dexie but enhanced for multi-tenancy
2. **Type safety** throughout the entire system
3. **Real-time integration** with validation and filtering
4. **Permission-based security** built into the schema
5. **Organization isolation** automatic and secure

This system forms the foundation for Phase 4's client integration and real-time synchronization features, ensuring data integrity, security, and performance in a multi-tenant environment.