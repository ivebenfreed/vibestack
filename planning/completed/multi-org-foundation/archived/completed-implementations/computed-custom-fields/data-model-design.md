# Data Model Design - Computed Custom Fields

## 🏗️ **Actual Storage Architecture**

Based on the existing DataForge system, computed fields integrate with the current PostgreSQL + Durable Object architecture:

### **Formula Definitions Storage (PostgreSQL)**
```sql
-- EXISTING: Migration 20250813_dataforge_do_backup_tables.ts

-- 1. Entity-specific computed field definitions
CREATE TABLE dataforge_entity_configs (
  id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  entity_name TEXT NOT NULL,
  definition JSONB NOT NULL,  -- Contains FieldDefinition with computed formulas
  table_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, entity_name)
);

-- 2. Organization schema storage  
CREATE TABLE dataforge_org_schemas (
  id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL UNIQUE,
  schema_data JSONB NOT NULL,  -- Full OrgSchema with all entity definitions
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### **Extended FieldDefinition for Computed Fields**
```typescript
// Extended FieldDefinition interface (json-rules-engine.ts)
export interface FieldDefinition {
  type: 'string' | 'number' | 'decimal' | 'integer' | 'computed' | /* existing types */;
  required?: boolean;
  syncable?: boolean;
  serverOnly?: boolean;
  
  // NEW: Computed field configuration
  computed?: {
    formula: string;                 // "budget * 1.2 + overhead"
    dependencies: string[];          // ["budget", "overhead"]  
    returnType: 'number' | 'decimal' | 'integer';
    evaluationMode: 'client' | 'server' | 'both';
    cacheResults: boolean;
    description?: string;
    lastValidated?: string;
    validationVersion?: string;
  };
}
```

### **Computed Values Storage (PostgreSQL Entity Tables)**
```sql
-- RuntimeSchemaGenerator creates individual typed columns for computed fields
-- Example: acme_corp_software_projects table

CREATE TABLE acme_corp_software_projects (
  -- Base archetype columns (runtime-schema-generator.ts:221-230)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  custom_fields JSONB DEFAULT '{}',  -- Backup storage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Individual columns for custom fields (generateCustomColumns)
  budget DECIMAL(15,2) NOT NULL,
  
  -- Computed fields get individual typed columns!
  total_cost DECIMAL(15,2)  -- Computed: budget * 1.2
);
```

### **Integration Requirements**
1. **RuntimeSchemaGenerator.fieldTypeToSQLType()** needs to handle `'computed'` type
2. **OrgSchemaDO** needs computed field management methods
3. **JsonRulesEngine** needs computed field validation
4. **Debounced migration system** handles DDL for computed field columns

---

## 🗄️ **Database Schema Design**

### **Extended FieldDefinition Interface**

```typescript
// Extend existing FieldDefinition to support computed fields
export interface ComputedFieldDefinition extends FieldDefinition {
  type: 'computed';
  
  // Formula configuration
  formula: string;                    // The formula expression
  dependencies: string[];             // Cached list of referenced field names
  returnType: 'number' | 'decimal' | 'integer';  // Type of computed result
  
  // Evaluation settings
  evaluationMode: 'client' | 'server' | 'both';  // Where computation happens
  cacheResults: boolean;              // Whether to cache computed values
  
  // Metadata
  compiledFormula?: string;           // Serialized compiled formula (optional)
  lastValidated?: string;             // Timestamp of last validation
  validationVersion?: string;         // Schema version when last validated
  
  // Inherited from base FieldDefinition
  syncable: boolean;                  // Should computed values sync?
  serverOnly?: boolean;               // Server-side computation only?
  required?: boolean;                 // Is this field required?
  default?: number;                   // Default value if computation fails
}
```

### **Computed Field Metadata Table**

```sql
-- Store computed field definitions and metadata
CREATE TABLE computed_field_definitions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  entity_name TEXT NOT NULL,
  field_name TEXT NOT NULL,
  
  -- Formula details
  formula TEXT NOT NULL,
  dependencies TEXT NOT NULL,        -- JSON array of field names
  return_type TEXT NOT NULL,         -- 'number', 'decimal', 'integer'
  
  -- Configuration
  evaluation_mode TEXT DEFAULT 'client',  -- 'client', 'server', 'both'
  cache_results BOOLEAN DEFAULT true,
  
  -- Optimization
  compiled_formula TEXT,             -- Serialized compiled formula
  dependency_hash TEXT,              -- Hash of dependencies for cache invalidation
  
  -- Validation and versioning
  last_validated TEXT,
  validation_version TEXT,
  schema_version TEXT,
  
  -- Standard fields
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL,
  updated_by TEXT,
  
  -- Constraints
  UNIQUE(organization_id, entity_name, field_name),
  FOREIGN KEY (organization_id) REFERENCES organization(id)
);

-- Indexes for performance
CREATE INDEX idx_computed_fields_org_entity ON computed_field_definitions(organization_id, entity_name);
CREATE INDEX idx_computed_fields_dependencies ON computed_field_definitions(dependencies);
CREATE INDEX idx_computed_fields_updated ON computed_field_definitions(updated_at);
```

### **Computed Field Dependencies Table**

```sql
-- Track field dependencies for efficient updates
CREATE TABLE computed_field_dependencies (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  
  -- Source field (the computed field)
  computed_field_entity TEXT NOT NULL,
  computed_field_name TEXT NOT NULL,
  
  -- Dependency field (field that the computed field references)
  dependency_entity TEXT NOT NULL,    -- May be same as computed_field_entity
  dependency_field TEXT NOT NULL,
  
  -- Metadata
  dependency_order INTEGER,           -- Order of evaluation (for optimization)
  created_at TEXT NOT NULL,
  
  -- Constraints
  UNIQUE(organization_id, computed_field_entity, computed_field_name, dependency_entity, dependency_field),
  FOREIGN KEY (organization_id) REFERENCES organization(id)
);

-- Indexes for dependency lookups
CREATE INDEX idx_dependencies_by_source ON computed_field_dependencies(
  organization_id, computed_field_entity, computed_field_name
);
CREATE INDEX idx_dependencies_by_target ON computed_field_dependencies(
  organization_id, dependency_entity, dependency_field
);
```

### **Computed Values Cache Table**

```sql
-- Optional: Cache computed values for performance
CREATE TABLE computed_field_values (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  
  -- Record identification
  entity_name TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field_name TEXT NOT NULL,
  
  -- Computed value
  computed_value REAL,
  computation_status TEXT DEFAULT 'valid',  -- 'valid', 'error', 'pending'
  error_message TEXT,
  
  -- Cache metadata
  computed_at TEXT NOT NULL,
  dependency_hash TEXT NOT NULL,      -- Hash of dependency values
  formula_version TEXT NOT NULL,      -- Version of formula used
  
  -- Performance metrics
  computation_time_ms INTEGER,
  
  -- Standard fields
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  -- Constraints
  UNIQUE(organization_id, entity_name, entity_id, field_name),
  FOREIGN KEY (organization_id) REFERENCES organization(id)
);

-- Indexes for cache lookups
CREATE INDEX idx_computed_values_record ON computed_field_values(
  organization_id, entity_name, entity_id
);
CREATE INDEX idx_computed_values_status ON computed_field_values(computation_status);
CREATE INDEX idx_computed_values_computed_at ON computed_field_values(computed_at);
```

## 📊 **Entity Schema Integration**

### **Extended Entity Definition**

```typescript
export interface EntityDefinition {
  extends: string;                    // Base archetype
  tableName: string;                  // Generated table name
  syncableFields: Record<string, FieldDefinition>;  // Regular fields
  computedFields: Record<string, ComputedFieldDefinition>;  // NEW: Computed fields
  
  // Computed field metadata
  dependencyGraph?: DependencyGraph;   // Cached dependency relationships
  evaluationOrder?: string[];          // Optimal field evaluation order
  lastSchemaUpdate?: string;           // For cache invalidation
}

export interface DependencyGraph {
  nodes: string[];                     // All field names
  edges: DependencyEdge[];            // Field dependencies
  cycles: string[][];                 // Any detected cycles (should be empty)
  levels: string[][];                 // Fields grouped by evaluation level
}

export interface DependencyEdge {
  from: string;                       // Dependent field
  to: string;                         // Dependency field
  weight?: number;                    // Computation cost (optional)
}
```

### **Schema Storage Format**

```typescript
// How computed fields are stored in organization schema
export interface StoredOrgSchema {
  orgId: string;
  entities: Record<string, {
    extends: string;
    tableName: string;
    syncableFields: Record<string, FieldDefinition>;
    computedFields: Record<string, {
      formula: string;
      returnType: 'number' | 'decimal' | 'integer';
      dependencies: string[];
      evaluationMode: 'client' | 'server' | 'both';
      cacheResults: boolean;
      syncable: boolean;
      created_at: string;
      updated_at: string;
    }>;
  }>;
  computedFieldMetadata: {
    dependencyGraph: DependencyGraph;
    evaluationOrder: Record<string, string[]>;  // Per entity
    lastValidated: string;
    schemaVersion: string;
  };
  version: string;
}
```

## 🔄 **LiveStore Schema Integration**

### **Enhanced Schema Generation**

```typescript
// Extend LiveStore schema generator to handle computed fields
export class LiveStoreDynamicSchemaGenerator {
  
  generateSchema(orgSchema: OrgEntitySchema): LiveStoreSchema {
    const liveStoreSchema: LiveStoreSchema = {};

    // Add system tables
    liveStoreSchema.local_changes = this.createLocalChangesTable();
    liveStoreSchema.sync_metadata = this.createSyncMetadataTable();
    
    // NEW: Add computed field metadata tables
    liveStoreSchema.computed_field_definitions = this.createComputedFieldDefinitionsTable();
    liveStoreSchema.computed_field_dependencies = this.createComputedFieldDependenciesTable();
    liveStoreSchema.computed_field_values = this.createComputedFieldValuesTable();

    // Generate entity tables with computed fields
    for (const [entityName, entityDef] of Object.entries(orgSchema.entities)) {
      const tableName = entityDef.tableName;
      liveStoreSchema[tableName] = this.createEntityTableWithComputedFields(
        entityName, entityDef, orgSchema.orgId
      );
    }

    return liveStoreSchema;
  }

  private createEntityTableWithComputedFields(
    entityName: string,
    entityDef: EntityDefinition,
    orgId: string
  ): LiveStoreTable {
    const columns: Record<string, LiveStoreColumn> = {
      // Base entity fields
      ...this.getBaseEntityFields(orgId),
      
      // Base archetype fields
      ...this.getBaseArchetypeFields(entityDef.extends),
      
      // Regular custom fields
      ...this.mapCustomFieldsToColumns(entityDef.syncableFields),
      
      // NEW: Computed field columns
      ...this.mapComputedFieldsToColumns(entityDef.computedFields)
    };

    const indexes = [
      ['organization_id'],
      ['organization_id', 'created_at'],
      ['organization_id', 'updated_at'],
      ...this.getArchetypeIndexes(entityDef.extends, entityDef.syncableFields),
      // NEW: Indexes for computed field dependencies
      ...this.getComputedFieldIndexes(entityDef.computedFields)
    ];

    return { columns, indexes };
  }

  private mapComputedFieldsToColumns(
    computedFields: Record<string, ComputedFieldDefinition>
  ): Record<string, LiveStoreColumn> {
    const columns: Record<string, LiveStoreColumn> = {};

    for (const [fieldName, fieldDef] of Object.entries(computedFields)) {
      // Store computed values as the appropriate numeric type
      columns[fieldName] = {
        type: 'real',  // All numeric types map to real in SQLite
        notNull: false,  // Computed values can be null during calculation
        default: fieldDef.default
      };

      // Add metadata columns for computed fields
      columns[`${fieldName}_computed_at`] = {
        type: 'text',
        notNull: false
      };

      columns[`${fieldName}_computation_status`] = {
        type: 'text',
        notNull: false,
        default: 'pending'
      };
    }

    return columns;
  }
}
```

## 🧮 **Runtime Data Structures**

### **Formula Evaluation Context**

```typescript
export interface FormulaEvaluationContext {
  organizationId: string;
  entityName: string;
  entityId: string;
  
  // Field values for computation
  fieldValues: Record<string, number>;
  
  // Computation metadata
  computationStartTime: number;
  evaluationMode: 'client' | 'server';
  cacheEnabled: boolean;
  
  // Dependency tracking
  dependencyChain: string[];          // For circular dependency detection
  evaluatedFields: Set<string>;       // Already computed in this session
  
  // Error handling
  errors: ComputationError[];
  warnings: string[];
}

export interface ComputationError {
  fieldName: string;
  error: string;
  type: 'syntax' | 'dependency' | 'evaluation' | 'timeout';
  timestamp: number;
}

export interface ComputationResult {
  success: boolean;
  value?: number;
  error?: string;
  computationTime: number;
  dependenciesUsed: string[];
  cacheHit: boolean;
}
```

### **Dependency Resolution Engine**

```typescript
export class DependencyResolutionEngine {
  private dependencyGraph: Map<string, Set<string>> = new Map();
  private evaluationOrder: string[] = [];

  buildDependencyGraph(computedFields: Record<string, ComputedFieldDefinition>): void {
    // Build graph of field dependencies
    for (const [fieldName, fieldDef] of Object.entries(computedFields)) {
      this.dependencyGraph.set(fieldName, new Set(fieldDef.dependencies));
    }

    // Calculate optimal evaluation order
    this.evaluationOrder = this.topologicalSort();
  }

  getEvaluationOrder(changedField: string): string[] {
    // Return fields that need recomputation when changedField changes
    const affected: string[] = [];
    const visited = new Set<string>();

    this.findDependentFields(changedField, affected, visited);
    
    // Sort by evaluation order
    return affected.sort((a, b) => 
      this.evaluationOrder.indexOf(a) - this.evaluationOrder.indexOf(b)
    );
  }

  private findDependentFields(field: string, affected: string[], visited: Set<string>): void {
    if (visited.has(field)) return;
    visited.add(field);

    for (const [computedField, dependencies] of this.dependencyGraph) {
      if (dependencies.has(field)) {
        affected.push(computedField);
        this.findDependentFields(computedField, affected, visited);
      }
    }
  }

  private topologicalSort(): string[] {
    // Implement topological sort for dependency-ordered evaluation
    const visited = new Set<string>();
    const stack: string[] = [];

    for (const field of this.dependencyGraph.keys()) {
      if (!visited.has(field)) {
        this.topologicalSortUtil(field, visited, stack);
      }
    }

    return stack.reverse();
  }
}
```

### **Computed Field Manager**

```typescript
export class ComputedFieldManager {
  private formulaProcessor: FormulaProcessor;
  private dependencyEngine: DependencyResolutionEngine;
  private cache: ComputedValueCache;

  async computeField(
    fieldName: string,
    context: FormulaEvaluationContext
  ): Promise<ComputationResult> {
    
    // Check cache first
    if (context.cacheEnabled) {
      const cached = await this.cache.get(fieldName, context);
      if (cached && cached.isValid) {
        return {
          success: true,
          value: cached.value,
          computationTime: 0,
          dependenciesUsed: cached.dependencies,
          cacheHit: true
        };
      }
    }

    // Get field definition
    const fieldDef = await this.getComputedFieldDefinition(fieldName, context.organizationId);
    if (!fieldDef) {
      throw new Error(`Computed field '${fieldName}' not found`);
    }

    // Resolve dependencies
    const dependencyValues = await this.resolveDependencies(fieldDef.dependencies, context);
    
    // Evaluate formula
    const startTime = Date.now();
    const result = await this.formulaProcessor.evaluateFormula(
      fieldDef.compiledFormula || fieldDef.formula,
      dependencyValues
    );
    const computationTime = Date.now() - startTime;

    // Cache result
    if (context.cacheEnabled && result.success) {
      await this.cache.set(fieldName, result.value, context, dependencyValues);
    }

    return {
      success: result.success,
      value: result.value,
      error: result.error,
      computationTime,
      dependenciesUsed: Object.keys(dependencyValues),
      cacheHit: false
    };
  }

  async computeAllFields(
    entityId: string,
    context: FormulaEvaluationContext
  ): Promise<Record<string, ComputationResult>> {
    
    const results: Record<string, ComputationResult> = {};
    const evaluationOrder = this.dependencyEngine.getEvaluationOrder();

    for (const fieldName of evaluationOrder) {
      try {
        results[fieldName] = await this.computeField(fieldName, context);
      } catch (error) {
        results[fieldName] = {
          success: false,
          error: error.message,
          computationTime: 0,
          dependenciesUsed: [],
          cacheHit: false
        };
      }
    }

    return results;
  }
}
```

## 💾 **Data Migration Strategy**

### **Adding Computed Fields to Existing Schemas**

```typescript
export interface SchemaMigration {
  version: string;
  description: string;
  up: (schema: OrgEntitySchema) => Promise<OrgEntitySchema>;
  down: (schema: OrgEntitySchema) => Promise<OrgEntitySchema>;
}

export const addComputedFieldsSupport: SchemaMigration = {
  version: '2.1.0',
  description: 'Add computed fields support to organization schemas',
  
  async up(schema: OrgEntitySchema): Promise<OrgEntitySchema> {
    // Add computed fields structure to each entity
    for (const entityDef of Object.values(schema.entities)) {
      if (!entityDef.computedFields) {
        entityDef.computedFields = {};
      }
    }

    // Add dependency graph metadata
    if (!schema.computedFieldMetadata) {
      schema.computedFieldMetadata = {
        dependencyGraph: { nodes: [], edges: [], cycles: [], levels: [] },
        evaluationOrder: {},
        lastValidated: new Date().toISOString(),
        schemaVersion: '2.1.0'
      };
    }

    return schema;
  },

  async down(schema: OrgEntitySchema): Promise<OrgEntitySchema> {
    // Remove computed fields (data preservation handled separately)
    for (const entityDef of Object.values(schema.entities)) {
      delete entityDef.computedFields;
    }

    delete schema.computedFieldMetadata;
    return schema;
  }
};
```

---

*This data model provides a robust foundation for storing, managing, and efficiently computing custom field formulas while maintaining consistency with the existing schema system and LiveStore integration.*