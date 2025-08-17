# LiveStore SQLite Computation Strategy for Computed Custom Fields

## 🎯 **Strategic Decision: Leverage LiveStore SQLite**

Since you're moving to LiveStore SQLite in the medium term, we should design computed fields to leverage SQLite's powerful computation capabilities instead of building separate computation stores.

## 🏗️ **Architecture: SQLite-Native Computation**

### **Core Strategy**
Instead of complex frontend computation engines, use SQLite's native features:

1. **SQLite Computed Columns** - For real-time calculations
2. **SQLite Triggers** - For dependency updates  
3. **SQL Views** - For complex computed aggregations
4. **JSON Functions** - For flexible formula storage

## 📊 **LiveStore Integration Architecture**

### **1. SQLite Schema with Computed Columns**
```sql
-- LiveStore generates tables with computed columns
CREATE TABLE org_123_projects (
  id UUID PRIMARY KEY,
  organization_id TEXT NOT NULL,
  
  -- Base fields
  name TEXT NOT NULL,
  budget DECIMAL(15,2),
  hours_worked DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  
  -- SQLite computed columns (generated automatically)
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  budget_remaining DECIMAL(15,2) GENERATED ALWAYS AS (budget - total_cost) STORED,
  budget_utilization DECIMAL(5,2) GENERATED ALWAYS AS (
    CASE 
      WHEN budget > 0 THEN (total_cost / budget * 100)
      ELSE 0 
    END
  ) STORED,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes automatically work with computed columns
CREATE INDEX idx_projects_budget_utilization ON org_123_projects(budget_utilization);
```

### **2. Enhanced RuntimeSchemaGenerator for Computed Columns**
```typescript
// Update RuntimeSchemaGenerator to generate computed columns
export class RuntimeSchemaGenerator {
  generateCreateTableSQL(definition: OrgEntityDefinition): string {
    const baseColumns = this.getBaseArchetypeColumns(definition.extends);
    const customColumns = this.generateCustomColumns(definition.customFields);
    const computedColumns = this.generateComputedColumns(definition.customFields);
    
    return `
CREATE TABLE ${definition.tableName} (
  ${baseColumns}${customColumns ? ',\n  ' + customColumns : ''}${computedColumns ? ',\n  ' + computedColumns : ''}
);`;
  }
  
  private generateComputedColumns(customFields: Record<string, FieldDefinition>): string {
    return Object.entries(customFields)
      .filter(([_, fieldDef]) => fieldDef.type === 'computed')
      .map(([fieldName, fieldDef]) => {
        const sqlType = this.fieldTypeToSQLType(fieldDef.computed!.returnType);
        const formula = this.translateFormulaToSQL(fieldDef.computed!.formula, fieldDef.computed!.dependencies);
        
        return `${this.camelToSnake(fieldName)} ${sqlType} GENERATED ALWAYS AS (${formula}) STORED`;
      })
      .join(',\n  ');
  }
  
  private translateFormulaToSQL(formula: string, dependencies: string[]): string {
    // Convert Math.js formula to SQLite SQL
    // "budget * 1.2" → "budget * 1.2"
    // "max(hours_worked, 40)" → "MAX(hours_worked, 40)"
    // "{budget} * {multiplier}" → "budget * multiplier"
    
    let sqlFormula = formula;
    
    // Replace field references {fieldName} with column names
    dependencies.forEach(dep => {
      const regex = new RegExp(`\\{${dep}\\}`, 'g');
      sqlFormula = sqlFormula.replace(regex, this.camelToSnake(dep));
    });
    
    // Convert Math.js functions to SQLite functions
    const functionMappings = {
      'max(': 'MAX(',
      'min(': 'MIN(',
      'abs(': 'ABS(',
      'round(': 'ROUND(',
      'floor(': 'FLOOR(',
      'ceil(': 'CEILING(',
      'sqrt(': 'SQRT(',
      'pow(': 'POWER('
    };
    
    Object.entries(functionMappings).forEach(([mathJs, sqlite]) => {
      sqlFormula = sqlFormula.replace(new RegExp(mathJs, 'g'), sqlite);
    });
    
    return sqlFormula;
  }
}
```

### **3. SQLite Triggers for Cross-Table Dependencies**
```sql
-- For computed fields that depend on related tables
-- Example: Project completion percentage based on tasks

-- Trigger to update project completion when tasks change
CREATE TRIGGER update_project_completion
AFTER UPDATE OF status ON org_123_tasks
FOR EACH ROW 
WHEN NEW.project_id IS NOT NULL
BEGIN
  UPDATE org_123_projects 
  SET completion_percentage = (
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COUNT(CASE WHEN status = 'completed' THEN 1 END) * 100.0 / COUNT(*))
      END
    FROM org_123_tasks 
    WHERE project_id = NEW.project_id
  )
  WHERE id = NEW.project_id;
END;
```

### **4. LiveStore Operations with Computed Field Support**
```typescript
// Enhanced LiveStore operations that understand computed fields
export class ComputedFieldLiveStoreOperations extends LiveStoreOperationsManager {
  
  /**
   * Insert with computed field validation
   */
  async insert(options: LiveStoreInsertOptions): Promise<LiveStoreOperationResult> {
    const { data } = options;
    
    // Remove any computed field values from input data
    // SQLite will generate them automatically
    const cleanedData = this.removeComputedFields(data, options.tableName);
    
    const result = await super.insert({
      ...options,
      data: cleanedData
    });
    
    // Fetch the record with computed values
    if (result.success) {
      const fullRecord = await this.getById(options.tableName, cleanedData.id);
      result.data = fullRecord;
    }
    
    return result;
  }
  
  /**
   * Update with computed field handling
   */
  async update(options: LiveStoreUpdateOptions): Promise<LiveStoreOperationResult> {
    // Clean computed fields from update data
    const cleanedData = this.removeComputedFields(options.data, options.tableName);
    
    const result = await super.update({
      ...options,
      data: cleanedData
    });
    
    // Return record with computed values
    if (result.success) {
      const fullRecord = await this.getById(options.tableName, options.id);
      result.data = fullRecord;
    }
    
    return result;
  }
  
  /**
   * Get computed field definitions for a table
   */
  private async getComputedFields(tableName: string): Promise<string[]> {
    // Query SQLite schema to get computed columns
    const schemaInfo = await this.instance.execute(
      "SELECT name FROM pragma_table_info(?) WHERE type LIKE '%GENERATED%'",
      [tableName]
    );
    
    return schemaInfo.rows.map(row => row.name);
  }
  
  /**
   * Remove computed fields from data object
   */
  private removeComputedFields(data: Record<string, any>, tableName: string): Record<string, any> {
    // Get computed fields from schema definition or cache
    const computedFields = this.getComputedFieldsFromCache(tableName);
    
    const cleaned = { ...data };
    computedFields.forEach(field => {
      delete cleaned[field];
    });
    
    return cleaned;
  }
  
  /**
   * Bulk operations with computed field efficiency
   */
  async bulkInsert(
    tableName: string, 
    records: Record<string, any>[]
  ): Promise<LiveStoreOperationResult> {
    try {
      // Clean all records
      const cleanedRecords = records.map(record => 
        this.removeComputedFields(record, tableName)
      );
      
      // Use SQLite's efficient bulk insert
      await this.instance.transaction(async () => {
        for (const record of cleanedRecords) {
          await this.instance.execute(
            this.generateInsertSQL(tableName, record),
            Object.values(record)
          );
        }
      });
      
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}
```

### **5. SQL Views for Complex Aggregations**
```sql
-- Create views for complex computed fields that span multiple tables
CREATE VIEW org_123_project_analytics AS
SELECT 
  p.id,
  p.name,
  p.budget,
  
  -- Computed from tasks
  COUNT(t.id) as total_tasks,
  COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_tasks,
  
  -- Computed percentages
  CASE 
    WHEN COUNT(t.id) = 0 THEN 0
    ELSE ROUND((COUNT(CASE WHEN t.status = 'completed' THEN 1 END) * 100.0 / COUNT(t.id)), 2)
  END as completion_percentage,
  
  -- Computed costs
  SUM(COALESCE(t.hours_worked, 0) * COALESCE(t.hourly_rate, 0)) as actual_cost,
  
  -- Budget analysis
  CASE 
    WHEN p.budget > 0 THEN ROUND(((SUM(COALESCE(t.hours_worked, 0) * COALESCE(t.hourly_rate, 0))) / p.budget * 100), 2)
    ELSE 0
  END as budget_utilization
  
FROM org_123_projects p
LEFT JOIN org_123_tasks t ON t.project_id = p.id
GROUP BY p.id, p.name, p.budget;
```

### **6. Dynamic Formula Updates via Schema Migrations**
```typescript
// Handle formula changes through schema migrations
export class ComputedFieldMigrationService {
  
  async updateComputedFieldFormula(
    orgId: string,
    tableName: string, 
    fieldName: string,
    newFormula: string,
    dependencies: string[]
  ) {
    // 1. Drop existing computed column
    await this.instance.execute(
      `ALTER TABLE ${tableName} DROP COLUMN ${fieldName}`
    );
    
    // 2. Add new computed column with updated formula
    const sqlFormula = this.translateFormulaToSQL(newFormula, dependencies);
    const sqlType = this.getFieldSQLType(fieldName, tableName);
    
    await this.instance.execute(
      `ALTER TABLE ${tableName} ADD COLUMN ${fieldName} ${sqlType} GENERATED ALWAYS AS (${sqlFormula}) STORED`
    );
    
    // 3. Update schema definition in OrgSchemaDO
    await this.updateSchemaDefinition(orgId, tableName, fieldName, newFormula, dependencies);
    
    console.log(`[ComputedFields] Updated formula for ${tableName}.${fieldName}`);
  }
}
```

## ⚡ **Performance Benefits of SQLite Approach**

### **1. Native SQLite Performance**
- ✅ **Computed columns update automatically** - No manual recalculation needed
- ✅ **Indexed computed values** - Fast queries on computed results
- ✅ **Transaction-safe** - Computed values always consistent
- ✅ **Memory efficient** - No separate computation stores

### **2. SQL Query Power**
```sql
-- Complex queries with computed fields work naturally
SELECT 
  name,
  budget_utilization,
  total_cost
FROM org_123_projects 
WHERE budget_utilization > 80  -- Query computed field directly
ORDER BY total_cost DESC
LIMIT 10;

-- Aggregations with computed fields
SELECT 
  AVG(budget_utilization) as avg_utilization,
  SUM(total_cost) as total_project_cost
FROM org_123_projects
WHERE completion_percentage > 50;
```

### **3. Triggers for Complex Dependencies**
```sql
-- Automatically update project metrics when tasks change
CREATE TRIGGER update_project_metrics
AFTER UPDATE OF hours_worked, hourly_rate ON org_123_tasks
FOR EACH ROW
BEGIN
  -- Project totals will update automatically via computed columns
  -- when we update the parent project's updated_at timestamp
  UPDATE org_123_projects 
  SET updated_at = CURRENT_TIMESTAMP 
  WHERE id = NEW.project_id;
END;
```

## 🔄 **Hybrid Strategy: SQL Formulas + Static Sync Values**

### **Frontend: Dynamic SQLite Computed Columns**
```sql
-- LiveStore SQLite: Dynamic computed columns for instant updates
CREATE TABLE org_123_projects (
  budget DECIMAL(15,2),
  hours_worked DECIMAL(10,2),
  hourly_rate DECIMAL(10,2),
  
  -- LIVE computed columns - recalculate automatically
  total_cost DECIMAL(15,2) GENERATED ALWAYS AS (hours_worked * hourly_rate) STORED,
  budget_remaining DECIMAL(15,2) GENERATED ALWAYS AS (budget - total_cost) STORED
);
```

### **Sync System: Static Computed Values**
```typescript
// When syncing, we capture STATIC computed values at moment of change
const syncData = {
  id: 'proj-1',
  budget: 50000,
  hours_worked: 100,
  total_cost: 5000000,      // Static snapshot for sync
  budget_remaining: 45000000 // Static snapshot for sync
};

// Change tracking captures static computed values
await operations.update({
  tableName: 'org_123_projects',
  id: 'proj-1',
  data: { hours_worked: 120 }  // SQLite auto-recalculates, sync gets static values
});
```

### **Benefits of Hybrid Approach**
- ✅ **Frontend Performance** - SQLite native speed with instant updates
- ✅ **Sync Reliability** - Static values avoid formula evaluation during sync
- ✅ **Historical Preservation** - Computed values preserved as they were at sync time
- ✅ **Conflict Resolution** - Static values can be properly merged
- ✅ **Server Simplicity** - Server doesn't need formula engines
- ✅ **Audit Capability** - Track how computed values evolved over time

### **Hybrid Sync Flow Example**
```typescript
// Complete flow showing hybrid SQLite + static sync approach

// 1. User updates budget in LiveStore frontend
await liveStoreOps.update({
  tableName: 'org_123_projects',
  id: 'proj-1', 
  data: { budget: 60000 }
});

// 2. SQLite automatically recalculates ALL computed columns instantly
// total_cost = hours_worked * hourly_rate (instantly updated)
// budget_remaining = budget - total_cost (instantly updated)

// 3. Change tracking captures STATIC computed values for sync
const changeForSync = {
  table: 'org_123_projects',
  id: 'proj-1',
  data: {
    budget: 60000,           // User's change
    total_cost: 6000000,     // Static snapshot from SQLite
    budget_remaining: 54000000 // Static snapshot from SQLite
  }
};

// 4. Other clients receive static values via sync
// 5. Their SQLite computed columns recalculate to same values
// 6. Result: Instant local updates + reliable sync propagation
```

### **Conflict Resolution with Hybrid Approach**
```typescript
export class HybridComputedFieldConflictResolver {
  
  resolveConflict(localChange: any, serverChange: any): any {
    // 1. Merge base field changes using existing conflict resolution
    const mergedBaseFields = this.mergeBaseFields(localChange, serverChange);
    
    // 2. For computed fields: ignore conflicts, they'll recalculate correctly
    // Remove computed field values from conflict resolution
    const cleanedData = this.removeComputedFields(mergedBaseFields);
    
    // 3. SQLite will recalculate computed fields from merged base fields
    // 4. Both clients end up with identical computed values
    return cleanedData;
  }
  
  private removeComputedFields(data: Record<string, any>): Record<string, any> {
    // Remove static computed values - SQLite will regenerate them
    const computedFieldNames = this.getComputedFieldNames(data.tableName);
    const cleaned = { ...data };
    
    computedFieldNames.forEach(fieldName => {
      delete cleaned[fieldName];
    });
    
    return cleaned;
  }
}
```

## 🎯 **Benefits vs. Separate Computation Stores**

| Aspect | SQLite Computed Columns | Separate Computation Store |
|--------|------------------------|---------------------------|
| **Performance** | ✅ Native SQLite speed | ❌ JS computation overhead |
| **Consistency** | ✅ Always up-to-date | ❌ Potential sync lag |
| **Queries** | ✅ SQL joins/aggregations | ❌ Manual data combining |
| **Maintenance** | ✅ Automatic triggers | ❌ Manual dependency tracking |
| **Memory** | ✅ Single data store | ❌ Duplicate data storage |
| **Conflicts** | ✅ Auto-recalculation | ❌ Complex conflict resolution |
| **Indexes** | ✅ Native SQLite indexes | ❌ Manual index management |

## 🚀 **Implementation Strategy**

### **Phase 1: SQLite Foundation** (Week 1-2)
1. Extend `RuntimeSchemaGenerator` to generate computed columns
2. Add computed field formula → SQL translation
3. Update `LiveStoreOperationsManager` to handle computed fields

### **Phase 2: Advanced Features** (Week 3-4)  
1. Add trigger-based cross-table dependencies
2. Implement SQL views for complex aggregations
3. Create formula migration service

### **Phase 3: UI Integration** (Week 5-6)
1. Build formula editor with SQL preview
2. Add computed field management UI
3. Integrate with existing field configuration

## 🎉 **Conclusion**

**Leverage LiveStore SQLite for computed fields instead of building separate stores!**

This approach provides:
- ✅ **Superior performance** with native SQLite computed columns
- ✅ **Automatic consistency** with SQLite triggers
- ✅ **Powerful querying** with SQL aggregations and joins
- ✅ **Seamless integration** with existing LiveStore sync system
- ✅ **Minimal complexity** - SQLite handles the hard parts

The SQLite approach is more efficient, maintainable, and powerful than separate computation stores. It leverages your investment in LiveStore while providing enterprise-grade computed field capabilities! 🚀