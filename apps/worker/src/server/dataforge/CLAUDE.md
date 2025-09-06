# DataForge System Documentation

*This file provides guidance to Claude Code when working with the DataForge entity management system.*

## Overview

DataForge is a dynamic entity management system that allows organizations to create custom entities with archetype-based patterns and custom fields. It provides a flexible schema system with proper field validation, conflict resolution, and type safety.

## Architecture

### Core Components

1. **EntityManager** (`entity-operations/EntityManager.ts`)
   - Central service for all entity operations
   - Handles CRUD operations on entities and their records
   - Manages entity schema and table creation

2. **FieldManager** (`services/FieldManager.ts`)
   - Centralized field validation and conflict resolution
   - Merges base archetype fields with custom fields
   - Handles field conflict strategies (reject, prefix, override, merge)

3. **FieldValidationPipeline** (`validation/FieldValidationPipeline.ts`)
   - 5-stage validation pipeline:
     1. Type Validation
     2. Required Field Validation
     3. Constraint Validation (min/max, regex, etc.)
     4. Reference Validation
     5. Business Rule Validation

4. **DDLGenerator** (`DDLGenerator.ts`)
   - Generates PostgreSQL DDL statements
   - Handles complex default values (arrays, objects, booleans)
   - Ensures lowercase table names for PostgreSQL compatibility

## Entity Naming Convention

### CRITICAL: Use EntityNameUtils for ALL name operations

```typescript
import { EntityNameUtils } from '@/lib/entity-name-utils';

// Always use these methods:
EntityNameUtils.toPascalCase(name)     // For entity names: "CustomerOrder"
EntityNameUtils.toStorageFormat(name)  // For table names: "customer_order"
EntityNameUtils.toUrlSafeFormat(name)  // For URLs: "customer-order"
EntityNameUtils.toDisplayFormat(name)  // For UI: "Customer Order"
```

### Naming Rules

1. **Entity Names**: Always stored in PascalCase (e.g., "CustomerOrder", "InventoryItem")
2. **Table Names**: Always snake_case with org prefix (e.g., "org_01920000_1000_7000_8000_000000000001_customer_order")
3. **PascalCase Preservation**: The system now preserves existing PascalCase formatting
4. **Normalization**: Only normalizes when input is in other formats (kebab-case, snake_case, etc.)

## Field Storage Architecture

### Base Fields vs Custom Fields

```typescript
// Base fields are actual columns in the table
const baseFields = {
  id: 'TEXT PRIMARY KEY',
  organization_id: 'TEXT NOT NULL',
  created_at: 'TIMESTAMP NOT NULL',
  updated_at: 'TIMESTAMP NOT NULL',
  created_by: 'TEXT',
  // ... archetype-specific fields
};

// Custom fields are stored in JSONB column
const customFields = {
  custom_fields: 'JSONB DEFAULT {}'
};
```

### Field Definition Structure

```typescript
interface FieldDefinition {
  name: string;
  type: string;  // text, number, boolean, date, json, etc.
  required?: boolean;
  defaultValue?: any;
  unique?: boolean;
  indexed?: boolean;
  min?: number;
  max?: number;
  enum?: string[];
  regex?: string;
}
```

## Archetype System

### Available Archetypes

- **record**: Basic data record with name, description, status
- **project**: Project management with timeline and progress
- **task**: Task management with priority, assignee, due dates
- **document**: Document with content and versioning
- **file**: File management with URL and metadata
- **activity**: Activity tracking with timestamps
- **discussion**: Discussion threads with participants
- **collection**: Collection of items with flexible structure

### System Fields (Added to ALL tables)

```typescript
{
  id: 'TEXT PRIMARY KEY',
  organization_id: 'TEXT NOT NULL',
  created_at: 'TIMESTAMP NOT NULL',
  updated_at: 'TIMESTAMP NOT NULL', 
  created_by: 'TEXT'
}
```

## API Endpoints

### Entity Management

```bash
# Create entity
POST /api/dataforge/orgs/:orgId/entities
{
  "entityName": "CustomerOrder",
  "archetype": "task",
  "customFields": [
    {"name": "customer_name", "type": "text", "required": true},
    {"name": "order_total", "type": "decimal", "defaultValue": 0}
  ]
}

# Get entity schema
GET /api/dataforge/orgs/:orgId/entities/:entityName

# Delete entity (soft delete)
DELETE /api/dataforge/orgs/:orgId/entities/:entityName
```

### Data Operations

```bash
# Create record
POST /api/dataforge/orgs/:orgId/data/:entityName
{
  "title": "Order #123",
  "customer_name": "Acme Corp",  # Custom field
  "order_total": 1500.00         # Custom field
}

# Get record
GET /api/dataforge/orgs/:orgId/data/:entityName/:id

# Update record
PUT /api/dataforge/orgs/:orgId/data/:entityName/:id

# Delete record
DELETE /api/dataforge/orgs/:orgId/data/:entityName/:id

# Query records
GET /api/dataforge/orgs/:orgId/data/:entityName?limit=10&offset=0
```

## Important Implementation Details

### 1. Custom Fields Storage

Custom fields are stored in a JSONB column and merged seamlessly:

```typescript
// When creating/updating:
const { baseData, customData } = fieldManager.extractCustomFieldData(data, customFields);
// baseData → goes to table columns
// customData → goes to custom_fields JSONB column

// When retrieving:
const result = await kysely.selectFrom(tableName).selectAll().execute();
// Merge custom_fields back into response
if (result.custom_fields) {
  Object.assign(responseData, result.custom_fields);
  delete responseData.custom_fields;
}
```

### 2. Default Value Handling in DDL

```typescript
// Arrays
if (Array.isArray(defaultValue)) {
  if (field.type === 'json' || field.type === 'jsonb') {
    defaultVal = `'${JSON.stringify(defaultValue)}'::jsonb`;
  } else {
    defaultVal = `'{}'::text[]`;
  }
}

// Objects
if (typeof defaultValue === 'object' && defaultValue !== null) {
  defaultVal = `'${JSON.stringify(defaultValue)}'::jsonb`;
}

// Booleans (must be lowercase for PostgreSQL)
if (typeof defaultValue === 'boolean') {
  defaultVal = defaultValue ? 'true' : 'false';
}
```

### 3. Entity Configuration Caching

The EntityManager maintains a configuration cache to avoid repeated database lookups:

```typescript
private configCache = new Map<string, EntityConfig>();

async getEntityConfig(orgId: string, entityName: string) {
  const cacheKey = `${orgId}:${entityName}`;
  if (this.configCache.has(cacheKey)) {
    return this.configCache.get(cacheKey);
  }
  // ... fetch and cache
}
```

## Common Issues and Solutions

### Issue: Entity names losing PascalCase

**Solution**: Always use `EntityNameUtils.toPascalCase()` which now preserves existing PascalCase formatting.

### Issue: SQL syntax errors with default values

**Solution**: DDLGenerator properly handles complex types:
- Arrays → `'[]'::jsonb` or `'{}'::text[]`
- Objects → `'{}'::jsonb`
- Booleans → lowercase `true`/`false`

### Issue: Custom fields not appearing in responses

**Solution**: Ensure custom_fields JSONB is merged back into response:
```typescript
if (result.custom_fields && typeof result.custom_fields === 'object') {
  Object.assign(responseData, result.custom_fields);
  delete responseData.custom_fields;
}
```

### Issue: Table names case sensitivity

**Solution**: DDLGenerator always returns lowercase table names:
```typescript
return `org_${orgId.replace(/-/g, '_')}_${tableName}`.toLowerCase();
```

## Testing

### Create Test Entity

```bash
# With custom fields
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "ProductCatalog",
    "archetype": "collection",
    "customFields": [
      {"name": "sku", "type": "text", "required": true},
      {"name": "price", "type": "decimal", "defaultValue": 0}
    ]
  }'
```

### Create Record with Custom Fields

```bash
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/data/ProductCatalog" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Widget Pro",
    "collection_type": "products",
    "sku": "WGT-PRO-001",
    "price": 99.99
  }'
```

## Recent Updates (September 2025)

1. **Field Management Overhaul**
   - Added FieldManager service for centralized validation
   - Implemented 5-stage validation pipeline
   - Proper separation of base and custom fields

2. **Entity Naming Fix**
   - Fixed PascalCase preservation in EntityNameUtils
   - Consistent normalization across all operations
   - Proper handling of already-PascalCase inputs

3. **DDL Generation Improvements**
   - Fixed SQL syntax errors with complex default values
   - Proper JSONB formatting for arrays and objects
   - Boolean values correctly lowercase for PostgreSQL

4. **Storage Improvements**
   - Created entity-storage helper functions
   - Entity definitions stored in business_metadata JSONB
   - Clean separation between base columns and custom JSONB

## Best Practices

1. **Always use EntityNameUtils** for name transformations
2. **Validate fields through FieldManager** before table creation
3. **Store custom fields in JSONB** to maintain schema flexibility
4. **Use soft deletes** for entities (mark as deleted, preserve data)
5. **Cache entity configurations** to reduce database lookups
6. **Test with various field types** including arrays and objects
7. **Preserve PascalCase** in entity names for consistency

## Future Considerations

- [ ] Add field migration support when archetype changes
- [ ] Implement field-level permissions
- [ ] Add computed fields support
- [ ] Support for field relationships and foreign keys
- [ ] Field versioning and change history
- [ ] Advanced validation rules (cross-field validation)
- [ ] Field templates and reusable field sets