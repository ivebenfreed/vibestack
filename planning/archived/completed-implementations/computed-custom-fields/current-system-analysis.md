# Current Custom Fields System Analysis

## 📋 **System Architecture Overview**

### **Field Definition Structure**
The current system has several FieldDefinition interfaces across different modules, with the most comprehensive being in `apps/server/src/dataforge/rules/json-rules-engine.ts`:

```typescript
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'email' | 'url' | 'json' | 'text' | 
        'status_option' | 'priority_option' | 'category_option' | 'discussion_type_option' | 
        'user_reference' | 'entity_reference' | 'rich_text' | 'datetime' | 'decimal' | 'integer' | 'longtext';
  required?: boolean;
  syncable?: boolean;        // Controls client sync
  serverOnly?: boolean;      // Server-only fields
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  enum?: string[];
  default?: any;
  defaultValue?: any;        // Universal archetype compatibility
}
```

### **Numeric Field Types Available**
Current numeric field types that can be referenced in computed fields:
- **`number`** - General numeric type
- **`decimal`** - Decimal numbers with precision
- **`integer`** - Whole numbers only

### **Entity Schema Structure**
```typescript
export interface EntityDefinition {
  extends: string;           // Base archetype (base_projects, base_tasks, etc.)
  tableName: string;         // Generated table name
  syncableFields: Record<string, FieldDefinition>;  // Custom fields
}

export interface OrgEntitySchema {
  orgId: string;
  entities: Record<string, EntityDefinition>;
  version: string;
}
```

## 🏗️ **Current Field Processing Flow**

### **1. Schema Generation (LiveStore Integration)**
In `livestore-dynamic-schema.ts`, custom fields are processed via:

```typescript
private mapCustomFieldsToColumns(customFields: Record<string, FieldDefinition>): Record<string, LiveStoreColumn> {
  const columns: Record<string, LiveStoreColumn> = {};

  for (const [fieldName, fieldDef] of Object.entries(customFields)) {
    // Skip non-syncable fields
    if (fieldDef.syncable === false) continue;

    // Map field types to SQLite columns
    switch (fieldDef.type) {
      case 'number':
      case 'decimal':
      case 'integer':
        columns[fieldName] = { type: 'real', notNull: fieldDef.required };
        break;
      case 'string':
      case 'text':
      case 'email':
      case 'url':
        columns[fieldName] = { type: 'text', notNull: fieldDef.required };
        break;
      // ... other type mappings
    }
  }
  return columns;
}
```

### **2. Base Archetype Fields**
Each entity inherits base fields from archetypes:

**Projects (`base_projects`):**
- `name`, `description`, `status`, `priority`
- `start_date`, `end_date`, `owner_id`
- `container_id`, `container_type`

**Tasks (`base_tasks`):**
- `title`, `description`, `status`, `priority`
- `assignee_id`, `project_id`, `due_date`, `completed_at`

**Events, Contacts, Records, Documents, Files, Activities, Discussions, Collections** - Each with specific base fields

### **3. Organization Isolation**
- Every entity has `organization_id` for multi-tenant separation
- Table names are org-scoped: `{orgId}_{entityName}`
- Automatic indexes on `organization_id` combinations

## 📊 **Field Type System Analysis**

### **Current Numeric Types**
| Type | SQLite Mapping | Use Cases | Example Values |
|------|----------------|-----------|----------------|
| **number** | `real` | General calculations | `42.5`, `100`, `-15.75` |
| **decimal** | `real` | Precise decimals | `19.99`, `0.075`, `1000.00` |
| **integer** | `real` | Whole numbers | `1`, `42`, `100` |

### **Potential Reference Fields**
All numeric fields across base archetypes and custom fields are candidates for computed field references:

**Base Archetype Numerics:**
- Project budget/cost fields (custom)
- Task effort estimates (custom)
- Event duration calculations (custom)
- File sizes (`file_size` in base_files)

**Custom Field Examples:**
- `unitPrice`, `quantity`, `discount` (commerce)
- `hours`, `rate`, `overtimeRate` (time tracking)
- `score`, `weight`, `percentage` (scoring systems)

## 🔍 **Integration Points for Computed Fields**

### **1. Schema Definition Layer**
```typescript
// Extend FieldDefinition to support computed fields
export interface ComputedFieldDefinition extends FieldDefinition {
  type: 'computed';
  formula: string;                    // Formula expression
  dependencies: string[];             // Referenced field names
  returnType: 'number' | 'decimal' | 'integer';
  syncable: boolean;                  // Should computed values sync?
  serverOnly?: boolean;               // Server-side computation only?
}
```

### **2. Schema Generation Extension**
```typescript
// In mapCustomFieldsToColumns - add computed field handling
case 'computed':
  // Store the computed value as the specified return type
  columns[fieldName] = { 
    type: 'real', 
    notNull: false  // Computed values can be null during calculation
  };
  // Store formula and dependencies in metadata table
  break;
```

### **3. Dependency Tracking Requirements**
- Track which fields depend on which other fields
- Detect circular dependencies at schema validation time
- Plan update cascades when base fields change

### **4. Real-time Update Integration**
Current sync system handles field updates via WebSocket messages. Computed fields need:
- Dependency graph evaluation
- Cascade computation when referenced fields change
- Efficient update batching to avoid redundant calculations

## 🛡️ **Security & Validation Considerations**

### **Current Validation System**
The system already has field validation in place:
```typescript
// From json-rules-engine.ts
min?: number;
max?: number;
minLength?: number;
maxLength?: number;
pattern?: string;
enum?: string[];
```

### **Security Model**
- **Syncable fields** (`syncable: true`) are available to clients
- **Server-only fields** (`serverOnly: true`) never sync to clients
- **Organization isolation** prevents cross-org data access

### **For Computed Fields**
- Formula evaluation must be sandboxed
- Field references must be validated against available fields
- Circular dependency detection required
- Rate limiting for complex computations

## 📈 **Performance Considerations**

### **Current Performance Optimizations**
- Automatic indexes on organization_id and timestamps
- Archetype-specific indexes based on field usage patterns
- Efficient SQL generation for LiveStore integration

### **Computed Field Performance Needs**
- **Calculation Strategy**: On-demand vs pre-computed storage
- **Dependency Updates**: Efficient cascade update system
- **Caching**: Cache computed values vs recalculate
- **Batch Updates**: Group dependent field updates

## 🔄 **Sync System Integration**

### **Current Sync Architecture**
- WebSocket-based real-time sync
- `local_changes` table tracks modifications
- Conflict resolution and change propagation
- LiveStore integration maintains existing sync flow

### **Computed Field Sync Challenges**
1. **Computed Value Sync**: Should computed values sync as data or be recalculated on each client?
2. **Formula Distribution**: How do formula definitions sync across clients?
3. **Dependency Updates**: How to efficiently propagate changes through dependency chains?
4. **Conflict Resolution**: What happens when formula definitions conflict?

## 💡 **Key Insights for Implementation**

### **✅ Strengths of Current System**
- **Flexible field types** - Good foundation for computed fields
- **Organization isolation** - Security model already robust
- **LiveStore integration** - High-performance SQLite backend ready
- **Real-time sync** - Infrastructure for live updates exists
- **Validation framework** - Field validation patterns established

### **🔧 Required Extensions**
- **Formula parser** - Safe expression evaluation engine
- **Dependency tracker** - Field reference resolution and cycle detection
- **Computation engine** - Efficient formula evaluation with caching
- **UI components** - Formula creation and editing interface
- **Migration system** - Safely add computed fields to existing schemas

### **⚠️ Potential Challenges**
- **Circular dependencies** - Need robust detection and prevention
- **Performance scaling** - Complex dependency chains could impact performance
- **Formula migration** - Changing formulas while preserving data integrity
- **Cross-entity references** - Current system is single-entity focused

## 🎯 **Recommendations for Computed Fields**

### **Phase 1: Foundation**
1. Extend `FieldDefinition` with computed field type
2. Implement basic formula parser with field reference validation
3. Add dependency tracking to schema validation
4. Create proof-of-concept for simple arithmetic operations

### **Phase 2: Integration**
1. Integrate with LiveStore schema generation
2. Implement real-time dependency updates
3. Add formula evaluation to CRUD operations
4. Create UI for formula creation and editing

### **Phase 3: Advanced Features**
1. Optimize performance for complex dependency chains
2. Add conditional logic support (if/then expressions)
3. Implement formula versioning and migration
4. Add cross-entity reference capabilities (if needed)

---

*This analysis provides the foundation for implementing computed custom fields that integrate seamlessly with the existing robust field system and LiveStore architecture.*