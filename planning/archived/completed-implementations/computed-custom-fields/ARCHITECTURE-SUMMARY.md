# Computed Custom Fields - Architecture Summary

## 🏗️ **Hybrid SQLite + Static Sync Architecture**

After analysis of the existing DataForge and LiveStore systems, computed custom fields use a hybrid approach that leverages SQLite computed columns for frontend performance while maintaining static values for reliable sync.

## 📊 **Hybrid Storage Architecture**

### **Frontend: LiveStore SQLite Computed Columns**
```sql
-- LiveStore SQLite: Dynamic computed columns for instant updates
CREATE TABLE org_123_projects (
  -- Base fields
  budget DECIMAL(15,2),
  hours_worked DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  
  -- SQLite computed columns - recalculate automatically
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  budget_remaining DECIMAL(15,2) GENERATED ALWAYS AS (budget - total_cost) STORED,
  budget_utilization DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE WHEN budget > 0 THEN (total_cost / budget * 100) ELSE 0 END
  ) STORED
);
```

### **Sync System: Static Computed Values**
```typescript
// Sync captures STATIC computed values at moment of change
const syncData = {
  id: 'proj-1',
  budget: 50000,           // Base field change
  total_cost: 5000000,     // Static snapshot for sync
  budget_remaining: 45000000 // Static snapshot for sync
};
```

### **Formula Definitions (PostgreSQL)**
```sql
-- EXISTING: No new tables needed!
-- Formula definitions stored in existing DataForge tables

CREATE TABLE dataforge_entity_configs (
  definition JSONB NOT NULL  -- Contains FieldDefinition with computed formulas
);

-- Example formula storage:
{
  "customFields": {
    "totalCost": {
      "type": "computed",
      "computed": {
        "formula": "hours_worked * hourly_rate",
        "dependencies": ["hours_worked", "hourly_rate"],
        "returnType": "decimal"
      }
    }
  }
}
```

## 🔧 **Implementation Integration Points**

### **1. FieldDefinition Extension (json-rules-engine.ts)**
```typescript
export interface FieldDefinition {
  type: 'string' | 'number' | 'computed' | /* existing types */;
  
  // NEW: Computed field configuration
  computed?: {
    formula: string;                 // "budget * 1.2"
    dependencies: string[];          // ["budget"]
    returnType: 'number' | 'decimal' | 'integer';
    evaluationMode: 'client' | 'server' | 'both';
    cacheResults: boolean;
  };
}
```

### **2. RuntimeSchemaGenerator Updates (runtime-schema-generator.ts)**
```typescript
// Update fieldTypeToSQLType method
private fieldTypeToSQLType(fieldDef: FieldDefinition): string {
  switch (fieldDef.type) {
    case 'computed':
      // Use the returnType to determine SQL column type
      return this.fieldTypeToSQLType({ type: fieldDef.computed.returnType });
    // ... existing cases
  }
}
```

### **3. OrgSchemaDO Extensions (OrgSchemaDO.ts)**
```typescript
export class OrgSchemaDO extends Actor<any> {
  // NEW: Computed field management methods
  async addComputedField(entityName: string, fieldName: string, config: ComputedFieldConfig) {
    // Update entity customFields with computed field definition
    // Trigger debounced migration for DDL changes
  }
  
  async getComputedFields(entityName: string): Promise<Record<string, ComputedFieldConfig>> {
    // Extract computed fields from entity configuration
  }
}
```

### **4. JsonRulesEngine Validation (json-rules-engine.ts)**
```typescript
export class JsonRulesEngine {
  validateFieldTypes(data: any, config: EntityConfig): ValidationResult {
    // Add computed field validation case
    case 'computed':
      // Validate that computed field has proper configuration
      // Validate returnType and dependencies
      break;
  }
}
```

## 🔄 **Data Flow**

### **Formula Definition Flow**
1. User creates computed field via UI
2. `OrgSchemaDO.addComputedField()` stores definition in `customFields`
3. Debounced migration system detects schema change
4. `RuntimeSchemaGenerator` creates DDL with new computed field column
5. PostgreSQL backup tables store the complete schema

### **Hybrid Value Computation & Sync Flow**
1. **User updates** a source field (e.g., `budget`) in LiveStore frontend
2. **SQLite computed columns** recalculate automatically and instantly
3. **Change tracking** captures static computed values for sync
4. **WebSocket sync** propagates static computed values to other clients
5. **Other clients** apply static values, SQLite recomputes to same result

## 🎯 **Key Benefits of Hybrid SQLite + Static Sync Architecture**

### **✅ Frontend Performance**
- **Native SQLite Speed** - Computed columns update instantly  
- **Automatic Dependencies** - SQLite handles all field relationships
- **Query Power** - SQL joins, aggregations, and indexes on computed values
- **Memory Efficient** - Single data store with computed columns

### **✅ Sync Reliability**
- **Static Values** - Computed values captured as static snapshots for sync
- **Conflict Resolution** - Static values can be merged using existing logic
- **Historical Preservation** - Computed values preserved as they were at sync time
- **Server Simplicity** - No formula engines needed on server side

### **✅ Zero Additional Tables**
- Leverages existing `dataforge_entity_configs` and `dataforge_org_schemas`
- LiveStore SQLite handles computed columns natively
- No new migrations needed beyond updating existing interfaces

### **✅ Existing Infrastructure Reuse**
- **LiveStore Integration** - SQLite computed columns + existing change tracking
- **OrgSchemaDO** - Formula definition management
- **RuntimeSchemaGenerator** - Converts formulas to SQLite syntax
- **Sync System** - Existing WebSocket sync handles static computed values

### **✅ Conflict-Free Operation**
- **Auto-Recalculation** - SQLite recomputes values from merged base fields
- **Deterministic Results** - Same base data = same computed values
- **No Formula Conflicts** - Only base fields participate in conflict resolution

## 🚀 **Implementation Readiness**

All research and planning phases are complete. The hybrid architecture integrates perfectly with existing systems:

- **Formula Storage**: Extends existing DataForge JSONB schema storage
- **Frontend Computation**: Leverages LiveStore SQLite computed columns
- **Sync Integration**: Uses existing WebSocket sync with static values
- **Conflict Resolution**: Existing logic works with static computed values
- **UI**: Extends existing custom field management interface

Ready for implementation with superior performance and reliability! 🎉