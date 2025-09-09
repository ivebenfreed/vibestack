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
   - 5-stage validation pipeline integrated with modular field system:
     1. Type Validation
     2. Required Field Validation
     3. Constraint Validation (min/max, regex, etc.)
     4. Reference Validation
     5. Business Rule Validation
   - **NEW**: Uses modular field handlers for validation logic
   - **NEW**: Validates both archetype AND custom fields together

4. **Modular Field System** (`fields/`)
   - **NEW**: File-based field type system with automatic registration
   - Each field type has its own file with complete validation logic
   - Auto-discovered field types via registry (no manual maintenance)
   - Supports advanced field types: email, url, phone, file, currency, color
   - Field handlers provide: validate(), getSqlType(), getSqlDefault(), getDefaultValue()

5. **DDLGenerator** (`DDLGenerator.ts`)
   - Generates PostgreSQL DDL statements with field handler integration
   - **UPDATED**: Uses modular field system for SQL type generation
   - Handles complex default values (arrays, objects, booleans)
   - Ensures lowercase table names for PostgreSQL compatibility
   - **NEW**: Custom fields now generate real database columns (not JSONB)
   - **NEW**: Automatically filters out relationship fields from table creation

6. **RelationshipFieldHandler** (`services/RelationshipFieldHandler.ts`)
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

// Custom fields are NOW real database columns with proper SQL types
const customFields = {
  team_name: 'TEXT NOT NULL',           // text field → TEXT
  sprint_number: 'INTEGER DEFAULT 1',   // number field → INTEGER  
  contact_email: 'TEXT NOT NULL',       // email field → TEXT with validation
  website_url: 'TEXT',                  // url field → TEXT with validation
  phone_number: 'TEXT',                 // phone field → TEXT with formatting
  profile_color: 'TEXT',                // color field → TEXT with format validation
  budget: 'JSONB',                      // currency field → JSONB {amount, currency}
  documents: 'JSONB'                    // file field → JSONB {url, size, type, metadata}
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

## Modular Field System

### NEW: File-Based Field Architecture

DataForge now uses a modular field system where each field type is defined in its own file with complete validation and SQL generation logic:

```
fields/
├── index.ts          # Auto-registration of field types
├── text.ts           # Basic text validation
├── rich-text.ts      # Rich text/HTML validation  
├── date.ts           # Date validation with business rules
├── email.ts          # RFC-compliant email validation
├── url.ts            # URL validation with auto-protocol
├── phone.ts          # International phone validation
├── file.ts           # File metadata with size/type limits
├── currency.ts       # Currency with amount/code validation
├── color.ts          # Color validation (hex, rgb, hsl, named)
├── single-select.ts  # Enum-based single selection
├── multi-select.ts   # Array-based multi selection  
├── number.ts         # Numeric validation with ranges
├── boolean.ts        # Boolean type conversion
├── custom_user_reference.ts      # Custom user relationships
├── custom_entity_reference.ts    # Custom entity relationships
├── rollup_count.ts   # Count aggregation rollup field
├── rollup_sum.ts     # Sum aggregation rollup field
├── rollup_average.ts # Average calculation rollup field
└── rollup_concat.ts  # Text concatenation rollup field
```

### Field Handler Interface

Each field type exports four standard functions:

```typescript
// Example: fields/email.ts
export function validate(value: any, definition: FieldDefinition, context: any): {
  valid: boolean;
  errors: any[];
  transformedValue?: any;
}

export function getDefaultValue(definition: FieldDefinition): any

export function getSqlType(definition: FieldDefinition): string

export function getSqlDefault(definition: FieldDefinition): string | null
```

### Available Field Types

| Type | SQL Storage | Validation Features |
|------|-------------|-------------------|
| `text` | TEXT | Length, regex, required |
| `email` | TEXT | RFC format, auto-lowercase |
| `url` | TEXT | Auto-https, protocol validation |
| `phone` | TEXT | International format, cleanup |
| `file` | JSONB | Size limits, type restrictions |
| `currency` | JSONB | Amount + currency, precision |
| `color` | TEXT | Hex, RGB, HSL, named colors |
| `date` | TIMESTAMP | Business rules (start vs due) |
| `number` | NUMERIC | Min/max ranges, precision |
| `boolean` | BOOLEAN | Type coercion |
| `custom_user_reference` | Relationship table | User relationships with config |
| `custom_entity_reference` | Relationship table | Entity relationships with target type |
| `rollup_count` | INTEGER | Count aggregation from relationships |
| `rollup_sum` | DECIMAL | Sum aggregation with precision |
| `rollup_average` | DECIMAL | Average calculation with precision |
| `rollup_concat` | TEXT | Text concatenation with separators |
| `computed_expression` | Computed | Simple mathematical expressions |
| `computed_formula` | Computed | Complex expressions with full configuration |

### Automatic Registration

Field types are automatically registered - no manual maintenance required:

```typescript
// Adding a new field type is as simple as creating the file
// fields/coordinate.ts
export function validate(value, definition, context) { /* GPS validation */ }
export function getSqlType() { return 'POINT'; }
// ... etc

// Automatically available in:
const handler = getFieldHandler('coordinate'); // ✅ Works immediately
```

### Advanced Validation Features

**Reality-Based Date Validation:**
```typescript
// Date fields understand business context
{
  "start_date": "2025-12-25",  // ❌ After due_date
  "due_date": "2025-01-15"     // ❌ Before start_date  
}
// Result: Both fields report validation errors
```

**Auto-Transformation:**
```typescript
// URL field auto-prepends protocol
"website_url": "example.com" → "https://example.com"

// Email field auto-normalizes
"contact_email": "USER@DOMAIN.COM" → "user@domain.com"
```

## Unified Custom Relationship Field System

### NEW: Custom Relationship Fields with Same UX

DataForge now provides custom relationship fields that follow the exact same UX pattern as other custom fields, while providing powerful relationship and aggregation capabilities.

#### Custom Relationship Field Types

**`custom_user_reference`** - Dynamic user relationships:
```typescript
{
  "name": "lead_designer_id",
  "type": "custom_user_reference", 
  "required": true,
  "relationshipType": "managed_by",
  "targetEntityType": "User"
}
```

**`custom_entity_reference`** - Configurable entity relationships:
```typescript
{
  "name": "parent_portfolio_id",
  "type": "custom_entity_reference",
  "required": false,
  "relationshipType": "belongs_to", 
  "targetEntityType": "Portfolio",
  "cardinality": "many-to-one"
}
```

#### Rollup Field Types with Automatic Calculation

**`rollup_count`** - Count related records:
```typescript
{
  "name": "active_task_count",
  "type": "rollup_count",
  "defaultValue": 0,
  "rollupConfig": {
    "relationshipType": "belongs_to",
    "targetEntityType": "Task",
    "conditions": {"status": "active"}
  }
}
```

**`rollup_sum`** - Sum numeric values:
```typescript
{
  "name": "total_budget_amount", 
  "type": "rollup_sum",
  "defaultValue": 0,
  "rollupConfig": {
    "relationshipType": "belongs_to",
    "targetEntityType": "Task",
    "targetField": "budget_amount"
  }
}
```

**`rollup_average`** - Calculate averages:
```typescript
{
  "name": "average_completion_time",
  "type": "rollup_average",
  "rollupConfig": {
    "relationshipType": "belongs_to", 
    "targetEntityType": "Task",
    "targetField": "completion_hours"
  }
}
```

**`rollup_concat`** - Concatenate text values:
```typescript
{
  "name": "team_members_list",
  "type": "rollup_concat", 
  "rollupConfig": {
    "relationshipType": "assigned_to",
    "targetEntityType": "User",
    "targetField": "name",
    "separator": ", "
  }
}
```

### Architecture Integration

1. **Same UX**: Custom relationship and rollup fields use identical definition patterns as other custom fields
2. **Validation Integration**: Full validation pipeline supports relationship field validation
3. **Automatic Processing**: Relationships stored in per-org relationship tables automatically
4. **Rollup Calculations**: Automatic rollup field updates when relationships change
5. **SQL Type Safety**: Proper SQL type mapping for rollup fields while excluding relationship fields from table creation

### RollupEngine Service

The `RollupEngine` provides automatic calculation and updates:

```typescript
// Automatically triggered when relationships change
await rollupEngine.refreshEntityRollups(kysely, orgId, entityName, entityId);

// Handles all rollup types: count, sum, average, concat
// Updates are triggered by:
// - Relationship creation/deletion
// - Target field value changes
// - Entity updates that affect rollup conditions
```

### Storage Architecture

**Custom Relationship Fields**: Stored in per-org relationship tables with rich metadata
- No database columns created
- Full relationship history and temporal support
- Rich properties and configuration per relationship

**Rollup Fields**: Stored as real database columns with automatic updates
- Proper SQL types (INTEGER, DECIMAL, TEXT)  
- Real-time calculation when dependencies change
- Efficient querying and indexing support

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
# With advanced field types and validation
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "entityName": "ContactForm", 
    "archetype": "record",
    "customFields": [
      {"name": "contact_email", "type": "email", "required": true},
      {"name": "website_url", "type": "url", "required": false},
      {"name": "phone_number", "type": "phone", "required": false},
      {"name": "brand_color", "type": "color", "required": false},
      {"name": "budget", "type": "currency", "required": false}
    ]
  }'

# Creates real database columns with proper validation:
# - contact_email: TEXT NOT NULL (email validation)
# - website_url: TEXT (URL validation + auto-https)
# - phone_number: TEXT (international format validation)  
# - brand_color: TEXT (hex/rgb/hsl validation)
# - budget: JSONB (currency amount + code validation)
```

### Test Field Validation

```bash
# Test invalid data (will be rejected)
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/data/ContactForm" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Invalid Test",
    "status": "active",
    "contact_email": "invalid-email-format",
    "website_url": "example.com"
  }'
# Result: {"error": "Failed to create record", "errors": [
#   "contact_email: Field 'contact_email' must be a valid email address",
#   "website_url: Field 'website_url' must be a valid URL"
# ]}

# Test valid data (will be accepted with auto-transformation)
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/data/ContactForm" \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "Valid Test",
    "status": "active", 
    "contact_email": "TEST@EXAMPLE.COM",
    "website_url": "https://example.com"
  }'
# Result: {"success": true, "data": {
#   "contact_email": "test@example.com",  // Auto-lowercase
#   "website_url": "https://example.com"  // Accepted as-is
# }}
```

## Computed Fields System (September 2025)

**Complete computed fields implementation with expression-based calculations and dependency tracking.**

### Overview

DataForge now supports computed fields that automatically calculate values based on mathematical expressions and field dependencies. The system provides both simple expressions and complex formulas with full configuration options.

### Computed Field Types

**`computed_expression`** - Simple mathematical expressions:
```typescript
{
  "name": "total_price", 
  "type": "computed_expression",
  "expression": "base_price * quantity", 
  "dependencies": ["base_price", "quantity"]
}
```

**`computed_formula`** - Complex expressions with full configuration:
```typescript
{
  "name": "discounted_total",
  "type": "computed_formula", 
  "expression": "(base_price * quantity) * (1 - discount_rate)",
  "dependencies": ["base_price", "quantity", "discount_rate"],
  "resultType": "number",
  "computeLocation": "backend",
  "refreshTriggers": ["field_changed"],
  "cacheResults": true
}
```

### Architecture Components

1. **ComputedFieldEngine** (`services/ComputedFieldEngine.ts`)
   - Expression evaluation and dependency tracking
   - Database storage of computed field configurations
   - Context building with entity data and system variables
   - Calculation history logging for debugging

2. **ExpressionEvaluator** (`services/ExpressionEvaluator.ts`) 
   - Safe mathematical expression parsing and evaluation
   - Security-first design with function/operator allowlists
   - Token-based parsing with dependency extraction
   - Sandboxed execution environment

3. **Database Schema** (`migrations/013_computed_fields.sql`)
   - `dataforge_computed_fields` - Field configurations
   - `dataforge_computed_field_dependencies` - Dependency tracking
   - `dataforge_computed_field_calculations` - Calculation history

### Expression Features

**Supported Operations:**
- Arithmetic: `+`, `-`, `*`, `/`, `%`, `**` (power)
- Comparison: `>`, `<`, `>=`, `<=`, `==`, `!=`, `===`, `!==`
- Logical: `&&`, `||`, `!`
- Ternary: `condition ? value1 : value2`
- Parentheses for precedence: `(a + b) * c`

**Built-in Functions:**
- Math: `abs()`, `ceil()`, `floor()`, `round()`, `max()`, `min()`
- Advanced: `sqrt()`, `pow()`, `sin()`, `cos()`, `tan()`
- Aggregation: `sum()`, `avg()`, `count()` (for arrays)

**System Variables:**
- `$entityId` - Current entity ID
- `$orgId` - Organization ID  
- `$now` - Current timestamp
- `$today` - Current date string

### Integration with Existing Systems

**Relationship Fields:** Computed fields work seamlessly with relationship data:
```typescript
// Access related entity fields
"total_task_hours" // References related Task entities
```

**Rollup Integration:** RollupEngine extended to support computed expressions:
```typescript
{
  "type": "rollup_computed_expression",
  "expression": "sum(estimated_hours) * avg(completion_rate)",
  "relationshipType": "belongs_to",
  "targetEntityType": "Task"
}
```

### Automatic Dependency Management

**Registration:** Computed fields are automatically registered during entity creation
**Recalculation:** Values update when dependent fields change
**Dependency Detection:** Expression parser automatically extracts field dependencies

### Usage Examples

**Simple Price Calculation:**
```json
{
  "entityName": "OrderItem",
  "archetype": "record",
  "customFields": [
    {"name": "unit_price", "type": "number", "required": true},
    {"name": "quantity", "type": "number", "defaultValue": 1},
    {"name": "line_total", "type": "computed_expression", 
     "expression": "unit_price * quantity", 
     "dependencies": ["unit_price", "quantity"]}
  ]
}
```

**Complex Business Logic:**
```json
{
  "name": "shipping_cost",
  "type": "computed_formula",
  "expression": "weight > 50 ? (weight * 0.5) + 10 : weight * 0.8",
  "dependencies": ["weight"], 
  "resultType": "number",
  "computeLocation": "backend"
}
```

### Testing Computed Fields

```bash
# Create entity with computed fields
curl -X POST "http://localhost:4000/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/entities" \
  -H "Content-Type: application/json" \
  -d '{"entityName": "Invoice", "archetype": "record", "customFields": [
    {"name": "amount", "type": "number", "required": true},
    {"name": "tax_rate", "type": "number", "defaultValue": 0.1},
    {"name": "total_with_tax", "type": "computed_expression", 
     "expression": "amount * (1 + tax_rate)", 
     "dependencies": ["amount", "tax_rate"]}
  ]}' \
  -b cookies.txt

# Verify computed field configuration stored
SELECT field_name, expression, dependencies 
FROM dataforge_computed_fields 
WHERE org_id = '01920000-1000-7000-8000-000000000001' 
  AND entity_type = 'Invoice';
```

### Current Status & Implementation

**✅ COMPLETED (September 2025):**
- **Field Type Handlers**: `computed_expression` and `computed_formula` with full validation support
- **ComputedFieldEngine**: Complete service with database storage, dependency tracking, and calculation management  
- **ExpressionEvaluator**: Security-first mathematical expression parser with sandboxed execution
- **Database Schema**: Migration 013 with computed field configurations, dependencies, and calculation history
- **RollupEngine Integration**: Computed expression support for rollup calculations
- **EntityManager Integration**: Automatic computed field registration during entity creation
- **Field Validation**: Support for both direct properties and nested `computedConfig` approaches
- **End-to-End Testing**: Verified computed field registration and database storage functionality

**✅ Key Features Working:**
- **Expression Types**: Simple expressions (`unit_price * quantity`) and complex formulas with configuration
- **Security**: Sandboxed execution with function/operator allowlists, prevents code injection
- **Dependencies**: Automatic extraction and tracking of field dependencies from expressions
- **System Variables**: `$entityId`, `$orgId`, `$now`, `$today` available in expressions
- **Built-in Functions**: Math functions (`abs`, `ceil`, `floor`, `round`, `max`, `min`, `sqrt`, `pow`, etc.)
- **Calculation History**: Debug and performance monitoring with context snapshots
- **Real-time Updates**: Recalculation triggered when dependent fields change

**🔮 Future Enhancements:**
- Frontend integration with UltraTable formula engine
- Real-time computed field updates via WebSocket sync
- Cross-entity relationship expressions (`related.project.budget`)
- Computed field templates and reusable formulas
- Performance optimization for complex dependency graphs
- Visual expression builder UI

## Recent Major Updates (September 2025)

### 1. Modular Field Validation System (September 2025)
**Complete overhaul of field validation with modular, file-based architecture.**

#### Key Changes:
- **File-Based Field Types**: Each field type (email, url, phone, etc.) in separate file with complete logic
- **Automatic Registration**: No manual field type lists - auto-discovered via registry  
- **Real Database Columns**: Custom fields now generate real columns instead of JSONB storage
- **Advanced Validation**: Business logic validation (e.g., start_date vs due_date reality checks)
- **Auto-Transformation**: Email lowercase, URL protocol prepending, phone formatting
- **End-to-End Integration**: Complete validation pipeline from API to database

#### Available Field Types:
- **Basic**: `text`, `rich-text`, `number`, `boolean`, `date`
- **Communication**: `email`, `url`, `phone`  
- **Rich Data**: `file`, `currency`, `color`
- **Selection**: `single-select`, `multi-select`

#### Implementation:
- **Field Handlers**: Standard interface (validate, getSqlType, getSqlDefault, getDefaultValue)
- **SQL Generation**: DDLGenerator uses field handlers for proper SQL types
- **Validation Pipeline**: FieldValidationPipeline integrated with field system
- **Entity Creation**: EntityManager validates both archetype AND custom fields together

### 2. System Options Architecture Overhaul
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

### 6. Computed Fields System Implementation (September 2025)
**Complete backend infrastructure for expression-based computed fields with security-first design.**

#### Key Features:
- **Two Field Types**: `computed_expression` (simple) and `computed_formula` (advanced configuration)
- **Safe Expression Evaluation**: Sandboxed execution with function/operator allowlists preventing code injection
- **Automatic Dependency Tracking**: Expression parser extracts field dependencies automatically
- **Database Storage**: Complete configuration storage with calculation history and performance monitoring
- **RollupEngine Integration**: Support for computed expressions in rollup calculations
- **EntityManager Integration**: Automatic registration during entity creation with proper validation

#### Implementation:
- **ComputedFieldEngine** (`services/ComputedFieldEngine.ts`): Core service for calculation and dependency management
- **ExpressionEvaluator** (`services/ExpressionEvaluator.ts`): Security-first mathematical expression parser and evaluator
- **Database Schema** (`migrations/013_computed_fields.sql`): Three tables for configurations, dependencies, and calculation history
- **Field Handlers** (`fields/computed_*.ts`): Standard field type interface with validation and SQL generation
- **Validation Support**: Both direct properties (`expression`, `dependencies`) and nested `computedConfig` approaches

#### Expression Features:
- **Operations**: Full arithmetic (`+`, `-`, `*`, `/`, `%`, `**`), comparison (`>`, `<`, `>=`, `<=`, `==`, `!=`), logical (`&&`, `||`, `!`)
- **Functions**: Built-in mathematical functions (`abs`, `ceil`, `floor`, `round`, `max`, `min`, `sqrt`, `pow`, `sin`, `cos`, `tan`, etc.)
- **System Variables**: `$entityId`, `$orgId`, `$now`, `$today` available in all expressions
- **Conditionals**: Ternary expressions (`condition ? value1 : value2`) for complex logic
- **Security**: Sandboxed execution environment with allowlists preventing dangerous operations
- **Examples**: Simple (`unit_price * quantity`), complex (`(base_price * quantity) * (1 - discount_rate)`), conditional (`weight > 50 ? (weight * 0.5) + 10 : weight * 0.8`)

#### Status: **✅ FULLY IMPLEMENTED**
All components working end-to-end with successful computed field registration, database storage, and calculation functionality verified.

### 7. Previous Updates
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