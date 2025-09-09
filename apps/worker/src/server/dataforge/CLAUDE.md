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
   - **NEW**: Automatically filters out relationship fields from table creation

5. **RelationshipFieldHandler** (`services/RelationshipFieldHandler.ts`)
   - **NEW**: Converts reference fields to relationship metadata
   - Manages per-org relationship table creation
   - Stores relationship field configurations
   - Handles relationship CRUD operations with rich properties

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

### Base Fields vs Custom Fields vs Relationship Fields

```typescript
// Base fields are system columns in every table
const baseFields = {
  id: 'TEXT PRIMARY KEY',
  organization_id: 'TEXT NOT NULL',
  created_at: 'TIMESTAMP NOT NULL',
  updated_at: 'TIMESTAMP NOT NULL',
  created_by: 'TEXT',
  // ... archetype-specific fields (non-relationship)
};

// Custom fields are NOW real database columns (no longer JSONB)
const customFields = {
  team_name: 'TEXT NOT NULL',           // Real column
  sprint_number: 'INTEGER DEFAULT 1',   // Real column
  customer_email: 'TEXT',               // Real column
  order_total: 'NUMERIC DEFAULT 0'      // Real column
};

// Relationship fields are NOT stored as columns at all
// Instead, they are stored in org_xxx_relationships table
const relationshipFields = {
  // These DON'T become columns:
  assignee_id: 'user_reference',      // → assigned_to relationship
  parent_task_id: 'entity_reference', // → subtask_of relationship
  project_id: 'entity_reference'      // → belongs_to relationship
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

Custom fields are now stored as real database columns (no longer JSONB):

```typescript
// When creating entity table:
const allFields = {
  // System fields
  id: 'TEXT PRIMARY KEY',
  organization_id: 'TEXT NOT NULL',
  // ... other system fields
  
  // Archetype fields (minus relationship fields)
  title: 'TEXT NOT NULL',
  status: 'TEXT DEFAULT \'draft\'',
  
  // Custom fields as real columns
  team_name: 'TEXT NOT NULL',
  sprint_number: 'INTEGER DEFAULT 1'
};

// DDL Generation creates all fields as columns
const ddl = DDLGenerator.generateCreateTableDDL(tableName, allFields);
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

**Solution**: Custom fields are now real columns, so they appear automatically in SELECT * queries. No special merging needed.

### Issue: Table names case sensitivity

**Solution**: DDLGenerator always returns lowercase table names:
```typescript
return `org_${orgId.replace(/-/g, '_')}_${tableName}`.toLowerCase();
```

## Testing

### Create Test Entity

```bash
# With custom fields and relationship fields
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "TeamTask", 
    "archetype": "task",
    "customFields": [
      {"name": "team_name", "type": "text", "required": true},
      {"name": "sprint_number", "type": "number", "defaultValue": 1}
    ]
  }'

# Note: Task archetype automatically includes relationship fields:
# - assignee_id (user_reference) → assigned_to relationship
# - parent_task_id (entity_reference) → subtask_of relationship  
# - project_id (entity_reference) → belongs_to relationship
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

## Recent Major Updates (September 2025)

### 1. System Options Architecture Overhaul
**Complete redesign of the options system for better semantic separation and organizational flexibility.**

#### Key Changes:
- **Thoughtful System Protection**: Only semantic values that app logic depends on are system-protected
- **Removed Organizational Defaults**: Categories removed from all archetypes since they vary by organization
- **Clean Semantic States**: Status options use clear semantic workflow states
- **Unified Endpoint Structure**: All live UI data comes from custom options (auto-copied from system templates)

#### System Options by Archetype:
- **Task**: Priority (`low`/`medium`/`high`/`critical`) + Status (`not_started`/`active`/`done`/`blocked`)
- **Project**: Priority + Status (`not_started`/`active`/`paused`/`done`/`cancelled`)
- **Record**: Status only (`draft`/`active`/`inactive`/`archived`) - no priority needed for data entities
- **Document**: Status (`draft`/`review`/`published`/`archived`)
- **File**: Status (`uploading`/`available`/`processing`/`archived`)
- **Activity**: Status (`scheduled`/`active`/`completed`/`cancelled`)
- **Discussion**: Status (`open`/`active`/`resolved`/`closed`)
- **Collection**: Status (`draft`/`active`/`complete`/`archived`)

#### Implementation:
- **Auto-Copy System**: System option templates auto-copied to custom options during entity creation
- **API Simplification**: Single `/api/dataforge/orgs/:orgId/options/:optionType` endpoint
- **System Protection**: Prevents deletion of system option values, allows editing display properties
- **Migration Path**: Clean backend system with updated archetypes and migration files

### 2. Universal Relationship System Enhancements
**Enhanced relationship system with universal audit trails and workflow support.**

#### Universal `created_by` Field:
- **Added to All Archetypes**: Every entity now has `created_by` user_reference field
- **Semantic Consistency**: Uses `created_by` → `created_by` relationship semantic  
- **Audit Trail**: Complete user tracking across all entity operations

#### Relationship Field Mapping:
```typescript
// Current relationship semantics across archetypes:
Task: assignee_id → assigned_to, parent_task_id → subtask_of, project_id → belongs_to
Project: owner_id → owned_by
Record: owner_id → owned_by, parent_record_id → child_of  
Document: author_id → authored_by, parent_document_id → child_of
Discussion: author_id → authored_by, parent_discussion_id → reply_to
Collection: owner_id → owned_by
Activity: actor_id → performed_by, entity_id → relates_to
File: uploaded_by → uploaded_by
```

### 3. Dependency System for Gantt Charts
**Complete project management dependency system with 4 classic dependency types.**

#### Features:
- **4 Dependency Types**: `finish_to_start`, `start_to_start`, `finish_to_finish`, `start_to_finish`
- **Entity Restriction**: Only Project, Task, and Activity entities (temporal entities)
- **Lead/Lag Support**: Optional offset days for dependencies
- **Constraint Types**: Hard vs soft constraints
- **Circular Prevention**: Basic validation to prevent dependency cycles

#### Implementation:
- **DependencyManager Service** (`services/DependencyManager.ts`)
- **Relationship Integration**: Uses `depends_on` relationship semantic with rich metadata
- **API Endpoints**: Full CRUD operations for dependency management
- **Validation**: Comprehensive entity type and relationship validation

#### API Endpoints:
```bash
POST   /orgs/:orgId/dependencies              # Create dependency
GET    /orgs/:orgId/dependencies/:entityId    # Get all dependencies
GET    /orgs/:orgId/dependencies/:entityId/predecessors  # Get predecessors
GET    /orgs/:orgId/dependencies/:entityId/successors    # Get successors  
PUT    /orgs/:orgId/dependencies/:dependencyId          # Update dependency
DELETE /orgs/:orgId/dependencies/:dependencyId          # Remove dependency
GET    /orgs/:orgId/projects/:projectId/critical-path   # Critical path (placeholder)
GET    /dependency-types                                 # Get dependency type info
```

### 4. Simple Approval Workflow System
**Basic approval system designed for simplicity now, extensibility later.**

#### Core Features:
- **Request Approval**: Any entity can request approval from any user
- **Respond to Approvals**: Approve/reject with optional reasons
- **Approval Status Tracking**: Check if entity is fully approved
- **Cancel Requests**: Requesters can cancel pending approvals
- **User Dashboard**: Users can see all pending approvals

#### Implementation:
- **ApprovalManager Service** (`services/ApprovalManager.ts`)
- **Relationship-Based**: Uses `requires_approval_from` relationship semantic
- **Simple State Machine**: `pending` → `approved`/`rejected`/`expired`
- **Rich Metadata**: Stores reasons, due dates, timestamps in relationship properties

#### API Endpoints:
```bash
POST   /orgs/:orgId/approvals                           # Request approval
POST   /orgs/:orgId/approvals/:approvalId/respond       # Approve/reject
GET    /orgs/:orgId/approvals/pending                   # Get pending approvals
GET    /orgs/:orgId/approvals/:entityType/:entityId     # Get entity approval status
DELETE /orgs/:orgId/approvals/:approvalId               # Cancel approval request
```

#### Extension Points (Future):
- Multi-step workflows, approval types (sequential/parallel/majority)
- Conditional logic, escalation, delegation, templates

### 5. Relationship System Implementation (September 2025)
   - **NEW**: Complete relationship system using per-organization relationship tables
   - **NEW**: RelationshipFieldHandler service for processing archetype reference fields
   - **BREAKING**: Reference fields (`user_reference`, `entity_reference`) no longer create table columns
   - **NEW**: Per-org relationship tables with temporal support and rich metadata
   - **INTEGRATION**: Full integration with custom options system for relationship configuration

### 6. Previous Updates
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

## Relationship System Architecture

### Per-Organization Relationship Tables

Each organization gets its own relationship table for complete data isolation:

```sql
-- Example: org_01920000_1000_7000_8000_000000000001_relationships
CREATE TABLE org_xxx_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_type TEXT NOT NULL,        -- e.g., 'Task'
  source_entity_id UUID NOT NULL,          -- ID of the source record
  target_entity_type TEXT NOT NULL,        -- e.g., 'User', 'Project'
  target_entity_id UUID NOT NULL,          -- ID of the target record
  relationship_type TEXT NOT NULL,         -- e.g., 'assigned_to', 'belongs_to'
  field_name TEXT NOT NULL,                -- Original field name from archetype
  properties JSONB DEFAULT '{}',           -- Rich relationship metadata
  valid_from TIMESTAMP DEFAULT now(),      -- For temporal relationships
  valid_until TIMESTAMP,                   -- NULL = currently active
  created_at TIMESTAMP DEFAULT now(),
  created_by UUID
);
```

### Relationship Processing Flow

1. **Archetype Definition** → Entity contains `user_reference` or `entity_reference` fields
2. **DDL Generation** → Reference fields are **filtered out** (no table columns created)
3. **RelationshipFieldHandler** → Converts reference fields to relationship metadata
4. **Relationship Storage** → Configuration stored in `dataforge_relationship_fields` table
5. **Data Operations** → Relationships stored in per-org relationship tables

### Archetype Reference Fields

The Task archetype (and others) now include relationship fields:

```typescript
// Task archetype fields processed as relationships
{
  assignee_id: 'user_reference',      // → assigned_to relationship
  parent_task_id: 'entity_reference', // → subtask_of relationship  
  project_id: 'entity_reference'      // → belongs_to relationship
}
```

These fields are automatically:
- **Excluded** from table creation (no columns)
- **Converted** to relationship metadata
- **Stored** in `dataforge_relationship_fields` configuration table
- **Available** for UI dropdowns via custom options integration

## Best Practices

1. **Always use EntityNameUtils** for name transformations
2. **Validate fields through FieldManager** before table creation
3. **Custom fields are now real columns** with proper SQL types and constraints
4. **Use soft deletes** for entities (mark as deleted, preserve data)
5. **Cache entity configurations** to reduce database lookups
6. **Test with various field types** including arrays and objects
7. **Preserve PascalCase** in entity names for consistency
8. **NEW: Understand the three field types**:
   - **Base fields**: System columns (id, organization_id, created_at, etc.)
   - **Custom fields**: Real database columns with proper SQL types
   - **Relationship fields**: Stored in per-org relationship tables, not as columns
9. **NEW: Use RelationshipFieldHandler** for all relationship operations
10. **NEW: Reference fields in archetypes** (`user_reference`, `entity_reference`) are automatically processed

## Future Considerations

- [ ] Add field migration support when archetype changes
- [ ] Implement field-level permissions
- [ ] Add computed fields support
- [ ] Support for field relationships and foreign keys
- [ ] Field versioning and change history
- [ ] Advanced validation rules (cross-field validation)
- [ ] Field templates and reusable field sets