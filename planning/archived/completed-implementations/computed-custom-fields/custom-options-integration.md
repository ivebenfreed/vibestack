# 🔗 Integration with Custom Options Setup

## 📍 **Current Server-Side Architecture**

### **Existing FieldDefinition Structure**
```typescript
// Current structure in apps/server/src/dataforge/rules/json-rules-engine.ts
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

export interface OrgEntityDefinition {
  name: string;
  extends: 'base_projects' | 'base_tasks' | 'base_events' | 'base_contacts' | 'base_records' | 
           'base_documents' | 'base_files' | 'base_activities' | 'base_discussions' | 'base_collections';
  tableName: string;        // Auto-generated: {orgId}_{entityName}s
  customFields: Record<string, FieldDefinition>;
  validationRules?: RuleSet;
  workflows?: Record<string, string[]>;
  defaultValues?: Record<string, any>;
}
```

### **Current Server Architecture**
- **OrgSchemaDO**: Durable Object managing organization-specific entity schemas
- **ArchetypeEntityManager**: Server-side entity operations with archetype patterns
- **Debounced Migration Service**: 30-second batched schema changes
- **Universal Archetype System**: 8 base patterns that entities extend

---

## 🎯 **Computed Fields Integration Strategy**

### **Extended FieldDefinition Interface**
```typescript
// Enhanced FieldDefinition to support computed fields
export interface FieldDefinition {
  type: 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'email' | 'url' | 'json' | 'text' | 
        'status_option' | 'priority_option' | 'category_option' | 'discussion_type_option' | 
        'user_reference' | 'entity_reference' | 'rich_text' | 'datetime' | 'decimal' | 'integer' | 
        'longtext' | 'computed';  // NEW: Add 'computed' type
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
  
  // NEW: Computed field properties (only present when type === 'computed')
  computed?: ComputedFieldConfig;
}

export interface ComputedFieldConfig {
  formula: string;                 // The formula expression
  dependencies: string[];          // Field names referenced in formula
  returnType: 'number' | 'decimal' | 'integer';
  evaluationMode: 'client' | 'server' | 'both';
  cacheResults: boolean;
  
  // Metadata
  description?: string;
  lastValidated?: string;
  validationVersion?: string;
}
```

### **Enhanced OrgEntityDefinition**
```typescript
export interface OrgEntityDefinition {
  name: string;
  extends: 'base_projects' | 'base_tasks' | 'base_events' | 'base_contacts' | 'base_records' | 
           'base_documents' | 'base_files' | 'base_activities' | 'base_discussions' | 'base_collections';
  tableName: string;        // Auto-generated: {orgId}_{entityName}s
  customFields: Record<string, FieldDefinition>;  // Now includes computed fields
  validationRules?: RuleSet;
  workflows?: Record<string, string[]>;
  defaultValues?: Record<string, any>;
  
  // NEW: Computed field metadata
  computedFieldMetadata?: {
    dependencyGraph: DependencyGraph;
    evaluationOrder: string[];
    lastSchemaUpdate: string;
  };
}
```

---

## 🏗️ **Schema Client Integration**

### **Enhanced OrgSchemaClient**
```typescript
export class OrgSchemaClient {
  // ... existing methods

  /**
   * Load computed field definitions for an entity
   */
  async loadComputedFields(orgId: string, entityName: string): Promise<ComputedFieldsResult> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/computed-fields`);
      
      if (!response.ok) {
        throw new Error(`Failed to load computed fields: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        computedFields: result.computedFields,
        metadata: result.metadata
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Save computed field definition
   */
  async saveComputedField(
    orgId: string, 
    entityName: string, 
    fieldName: string, 
    config: ComputedFieldConfig
  ): Promise<SaveResult> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/computed-fields/${fieldName}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });

      const result = await response.json();
      
      // Invalidate schema cache to force reload
      this.clearCache(orgId);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Delete computed field
   */
  async deleteComputedField(
    orgId: string, 
    entityName: string, 
    fieldName: string
  ): Promise<DeleteResult> {
    try {
      const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/entities/${entityName}/computed-fields/${fieldName}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      
      // Invalidate cache
      this.clearCache(orgId);
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
```

---

## ⚛️ **React Hook Integration**

### **Enhanced useEntitySchema Hook**
```typescript
export interface UseEntitySchemaResult {
  schema: OrgEntitySchema | null;
  entitySchema: EntityDefinition | null;
  syncableFields: Record<string, FieldDefinition> | null;
  
  // NEW: Computed fields support
  computedFields: Record<string, ComputedFieldConfig> | null;
  computedFieldsMetadata: ComputedFieldsMetadata | null;
  
  formFields: FormFieldConfig[];
  loading: boolean;
  error: string | null;
  cached: boolean;
  
  // Actions
  refetch: () => Promise<void>;
  validateData: (data: any) => Promise<ValidationResult>;
  clearCache: () => void;
  
  // NEW: Computed field actions
  saveComputedField: (fieldName: string, config: ComputedFieldConfig) => Promise<SaveResult>;
  deleteComputedField: (fieldName: string) => Promise<DeleteResult>;
  validateFormula: (formula: string) => Promise<ValidationResult>;
}

export function useEntitySchema(orgId: string | null, entityName: string | null): UseEntitySchemaResult {
  const [schema, setSchema] = useState<OrgEntitySchema | null>(null);
  const [entitySchema, setEntitySchema] = useState<EntityDefinition | null>(null);
  const [syncableFields, setSyncableFields] = useState<Record<string, FieldDefinition> | null>(null);
  
  // NEW: Computed fields state
  const [computedFields, setComputedFields] = useState<Record<string, ComputedFieldConfig> | null>(null);
  const [computedFieldsMetadata, setComputedFieldsMetadata] = useState<ComputedFieldsMetadata | null>(null);
  
  // ... existing loading logic

  const loadComputedFields = useCallback(async () => {
    if (!orgId || !entityName) return;
    
    const result = await orgSchemaClient.loadComputedFields(orgId, entityName);
    if (result.success) {
      setComputedFields(result.computedFields || {});
      setComputedFieldsMetadata(result.metadata || null);
    }
  }, [orgId, entityName]);

  const saveComputedField = useCallback(async (fieldName: string, config: ComputedFieldConfig) => {
    if (!orgId || !entityName) return { success: false, error: 'Missing organization or entity' };
    
    const result = await orgSchemaClient.saveComputedField(orgId, entityName, fieldName, config);
    if (result.success) {
      // Reload computed fields
      await loadComputedFields();
    }
    return result;
  }, [orgId, entityName, loadComputedFields]);

  const deleteComputedField = useCallback(async (fieldName: string) => {
    if (!orgId || !entityName) return { success: false, error: 'Missing organization or entity' };
    
    const result = await orgSchemaClient.deleteComputedField(orgId, entityName, fieldName);
    if (result.success) {
      // Reload computed fields
      await loadComputedFields();
    }
    return result;
  }, [orgId, entityName, loadComputedFields]);

  // Load computed fields when entity schema loads
  useEffect(() => {
    if (entitySchema) {
      loadComputedFields();
    }
  }, [entitySchema, loadComputedFields]);

  return {
    schema,
    entitySchema,
    syncableFields,
    computedFields,
    computedFieldsMetadata,
    formFields,
    loading,
    error,
    cached,
    refetch,
    validateData,
    clearCache,
    saveComputedField,
    deleteComputedField,
    validateFormula: (formula: string) => orgSchemaClient.validateFormula(orgId!, entityName!, formula)
  };
}
```

---

## 🎨 **UI Integration Points**

### **Field Management UI Integration**
```tsx
// Integration with existing field management UI
function FieldConfigurationPanel({ entityName, orgId }: FieldConfigurationProps) {
  const { 
    syncableFields, 
    computedFields, 
    saveComputedField, 
    deleteComputedField 
  } = useEntitySchema(orgId, entityName);

  return (
    <div className="field-configuration-panel">
      {/* Existing field configuration */}
      <FieldTypeSelector
        fields={syncableFields}
        onFieldUpdate={handleFieldUpdate}
      />
      
      {/* NEW: Computed fields section */}
      <ComputedFieldsSection
        computedFields={computedFields}
        availableFields={Object.keys(syncableFields || {})}
        onSave={saveComputedField}
        onDelete={deleteComputedField}
      />
    </div>
  );
}

function ComputedFieldsSection({
  computedFields,
  availableFields,
  onSave,
  onDelete
}: ComputedFieldsSectionProps) {
  const [showEditor, setShowEditor] = useState(false);
  
  return (
    <div className="computed-fields-section">
      <div className="section-header">
        <h3>Computed Fields</h3>
        <Button onClick={() => setShowEditor(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Computed Field
        </Button>
      </div>

      {/* List existing computed fields */}
      <div className="computed-fields-list">
        {Object.entries(computedFields || {}).map(([fieldName, config]) => (
          <ComputedFieldItem
            key={fieldName}
            fieldName={fieldName}
            config={config}
            onEdit={() => editComputedField(fieldName, config)}
            onDelete={() => onDelete(fieldName)}
          />
        ))}
      </div>

      {/* Formula editor modal */}
      {showEditor && (
        <ComputedFieldEditor
          availableFields={availableFields}
          onSave={(fieldName, config) => {
            onSave(fieldName, config);
            setShowEditor(false);
          }}
          onCancel={() => setShowEditor(false)}
        />
      )}
    </div>
  );
}
```

### **Formula Editor Integration**
```tsx
// Main computed field editor component
function ComputedFieldEditor({
  availableFields,
  initialConfig,
  onSave,
  onCancel
}: ComputedFieldEditorProps) {
  const [fieldName, setFieldName] = useState('');
  const [formula, setFormula] = useState('');
  const [returnType, setReturnType] = useState<'number' | 'decimal' | 'integer'>('number');
  const [description, setDescription] = useState('');

  return (
    <Dialog open onOpenChange={() => onCancel()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Computed Field</DialogTitle>
        </DialogHeader>

        <div className="computed-field-editor">
          {/* Field configuration */}
          <div className="field-config">
            <div className="config-row">
              <Label htmlFor="fieldName">Field Name</Label>
              <Input
                id="fieldName"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
                placeholder="total_cost"
              />
            </div>
            
            <div className="config-row">
              <Label htmlFor="returnType">Return Type</Label>
              <Select value={returnType} onValueChange={setReturnType}>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="decimal">Decimal</SelectItem>
                <SelectItem value="integer">Integer</SelectItem>
              </Select>
            </div>
            
            <div className="config-row">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of what this field calculates"
              />
            </div>
          </div>

          {/* Smart formula builder */}
          <SmartFormulaBuilder
            formula={formula}
            availableFields={availableFields.map(name => ({
              name,
              displayName: name,
              type: 'number' // TODO: Get actual types
            }))}
            onChange={setFormula}
          />

          {/* Action buttons */}
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button 
              onClick={() => onSave(fieldName, {
                formula,
                dependencies: extractDependencies(formula),
                returnType,
                evaluationMode: 'client',
                cacheResults: true,
                description
              })}
              disabled={!fieldName || !formula}
            >
              Save Computed Field
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🔄 **Server Integration with OrgSchemaDO**

### **Enhanced OrgSchemaDO for Computed Fields**
```typescript
// apps/server/src/dataforge/durable-objects/OrgSchemaDO.ts
export class OrgSchemaDO extends Actor<any> {
  // ... existing methods

  /**
   * Add computed field to entity definition
   */
  async addComputedField(
    entityName: string, 
    fieldName: string, 
    computedConfig: ComputedFieldConfig
  ): Promise<void> {
    await this.ensureInitialized();
    
    // Get current entity config
    const entityConfig = await this.getEntityConfig(entityName);
    if (!entityConfig) {
      throw new Error(`Entity ${entityName} not found`);
    }
    
    // Add computed field to customFields
    entityConfig.customFields[fieldName] = {
      type: 'computed',
      syncable: true,  // Computed values are synced
      computed: computedConfig
    };
    
    // Update entity config
    await this.updateEntityConfig(entityName, entityConfig);
    
    // Schedule schema migration through existing debounced system
    await this.scheduleSchemaUpdate(entityName, 'update');
  }

  /**
   * Remove computed field from entity definition
   */
  async removeComputedField(entityName: string, fieldName: string): Promise<void> {
    await this.ensureInitialized();
    
    const entityConfig = await this.getEntityConfig(entityName);
    if (!entityConfig) {
      throw new Error(`Entity ${entityName} not found`);
    }
    
    // Remove from customFields
    delete entityConfig.customFields[fieldName];
    
    // Update entity config
    await this.updateEntityConfig(entityName, entityConfig);
    
    // Schedule schema migration
    await this.scheduleSchemaUpdate(entityName, 'update');
  }

  /**
   * Get all computed fields for an entity
   */
  async getComputedFields(entityName: string): Promise<Record<string, ComputedFieldConfig>> {
    await this.ensureInitialized();
    
    const entityConfig = await this.getEntityConfig(entityName);
    if (!entityConfig) {
      return {};
    }
    
    const computedFields: Record<string, ComputedFieldConfig> = {};
    
    for (const [fieldName, fieldDef] of Object.entries(entityConfig.customFields)) {
      if (fieldDef.type === 'computed' && fieldDef.computed) {
        computedFields[fieldName] = fieldDef.computed;
      }
    }
    
    return computedFields;
  }

  /**
   * Validate computed field formula
   */
  async validateComputedField(
    entityName: string, 
    formula: string
  ): Promise<{ valid: boolean; errors: string[]; dependencies: string[] }> {
    await this.ensureInitialized();
    
    const entityConfig = await this.getEntityConfig(entityName);
    if (!entityConfig) {
      throw new Error(`Entity ${entityName} not found`);
    }
    
    // Get available numeric fields for validation
    const availableFields = Object.entries(entityConfig.customFields)
      .filter(([_, fieldDef]) => 
        fieldDef.type === 'number' || 
        fieldDef.type === 'decimal' || 
        fieldDef.type === 'integer' ||
        fieldDef.type === 'computed'
      )
      .map(([fieldName, _]) => fieldName);
    
    // Use formula validator (to be implemented)
    return await FormulaValidator.validate(formula, availableFields);
  }
}
```

### **Integration with ArchetypeEntityManager**
```typescript
// apps/server/src/dataforge/entity-operations/ArchetypeEntityManager.ts
export class ArchetypeEntityManager {
  // ... existing methods

  /**
   * Add computed field to entity
   */
  async addComputedField(
    organizationId: string,
    entityName: string,
    fieldName: string,
    computedConfig: ComputedFieldConfig
  ): Promise<void> {
    // Get org schema DO
    const schemaDO = this.getOrgSchemaDO(organizationId);
    
    // Add computed field to schema
    await schemaDO.addComputedField(entityName, fieldName, computedConfig);
    
    // The existing debounced migration system will handle the DDL changes
  }

  /**
   * Remove computed field from entity
   */
  async removeComputedField(
    organizationId: string,
    entityName: string,
    fieldName: string
  ): Promise<void> {
    const schemaDO = this.getOrgSchemaDO(organizationId);
    await schemaDO.removeComputedField(entityName, fieldName);
  }

  /**
   * Get computed fields for entity
   */
  async getComputedFields(
    organizationId: string,
    entityName: string
  ): Promise<Record<string, ComputedFieldConfig>> {
    const schemaDO = this.getOrgSchemaDO(organizationId);
    return await schemaDO.getComputedFields(entityName);
  }

  private getOrgSchemaDO(organizationId: string) {
    const id = this.env.ORG_SCHEMA_DO.idFromName(organizationId);
    return this.env.ORG_SCHEMA_DO.get(id);
  }
}
```

### **API Endpoints Integration**
```typescript
// apps/server/src/routes/dataforge-api.ts (extend existing routes)
import { ArchetypeEntityManager } from '../dataforge/entity-operations/ArchetypeEntityManager';

// Add computed field endpoint
dataforgeAPI.put('/orgs/:orgId/entities/:entityName/computed-fields/:fieldName', async (c) => {
  const { orgId, entityName, fieldName } = c.req.param();
  const computedConfig = await c.req.json();
  
  // Validate user permissions (using existing middleware)
  const hasPermission = await validateOrgPermission(c, orgId, 'admin');
  if (!hasPermission) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  
  const manager = new ArchetypeEntityManager(c.env, orgId);
  
  try {
    await manager.addComputedField(orgId, entityName, fieldName, computedConfig);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error.message 
    }, 400);
  }
});

// Remove computed field endpoint
dataforgeAPI.delete('/orgs/:orgId/entities/:entityName/computed-fields/:fieldName', async (c) => {
  const { orgId, entityName, fieldName } = c.req.param();
  
  const hasPermission = await validateOrgPermission(c, orgId, 'admin');
  if (!hasPermission) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  
  const manager = new ArchetypeEntityManager(c.env, orgId);
  
  try {
    await manager.removeComputedField(orgId, entityName, fieldName);
    return c.json({ success: true });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error.message 
    }, 400);
  }
});

// Get computed fields endpoint
dataforgeAPI.get('/orgs/:orgId/entities/:entityName/computed-fields', async (c) => {
  const { orgId, entityName } = c.req.param();
  
  const hasPermission = await validateOrgPermission(c, orgId, 'viewer');
  if (!hasPermission) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }
  
  const manager = new ArchetypeEntityManager(c.env, orgId);
  
  try {
    const computedFields = await manager.getComputedFields(orgId, entityName);
    return c.json({ 
      success: true, 
      computedFields 
    });
  } catch (error) {
    return c.json({ 
      success: false, 
      error: error.message 
    }, 400);
  }
});
```

---

## 📊 **Database Schema Integration**

### **Formula Storage in PostgreSQL**
Computed field formulas are stored in PostgreSQL backup tables that mirror the Durable Object data:

```sql
-- Migration: 20250813_dataforge_do_backup_tables.ts
-- Table: dataforge_entity_configs (line 10-18)
CREATE TABLE dataforge_entity_configs (
  id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL,
  entity_name TEXT NOT NULL,
  definition JSONB NOT NULL,  -- Contains FieldDefinition with computed config
  table_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, entity_name)
);

-- Table: dataforge_org_schemas (line 21-29)  
CREATE TABLE dataforge_org_schemas (
  id UUID PRIMARY KEY DEFAULT generate_uuidv7(),
  organization_id UUID REFERENCES organization(id) ON DELETE CASCADE NOT NULL UNIQUE,
  schema_data JSONB NOT NULL,  -- Full OrgSchema with all entity definitions
  version TEXT DEFAULT '1.0.0',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Example formula storage in `dataforge_entity_configs.definition` JSONB:**
```json
{
  "name": "SoftwareProject",
  "extends": "base_projects",
  "tableName": "acme_corp_software_projects",
  "customFields": {
    "budget": {
      "type": "decimal",
      "required": true,
      "syncable": true
    },
    "totalCost": {
      "type": "computed",
      "syncable": true,
      "computed": {
        "formula": "budget * 1.2",
        "dependencies": ["budget"],
        "returnType": "decimal",
        "evaluationMode": "client",
        "cacheResults": true,
        "description": "Budget plus 20% overhead"
      }
    }
  }
}
```

### **Neon Database Entity Tables**
The RuntimeSchemaGenerator creates BOTH individual columns AND a JSONB column for custom fields:

```sql
-- Example: acme_corp_software_projects table
-- Generated by RuntimeSchemaGenerator.generateCreateTableSQL()
CREATE TABLE acme_corp_software_projects (
  -- Base archetype columns (runtime-schema-generator.ts:221-230)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_by_id UUID,
  client_id UUID,
  custom_fields JSONB DEFAULT '{}',  -- JSONB column for all custom fields
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Base Project fields
  description TEXT,
  priority VARCHAR(50) DEFAULT 'medium',
  start_date DATE,
  end_date DATE,
  owner_id UUID,
  
  -- Individual typed columns for each custom field (generateCustomColumns)
  budget DECIMAL(15,2) NOT NULL,
  tech_stack JSONB,
  repository_url VARCHAR(255),
  
  -- Computed fields need individual columns too!
  total_cost DECIMAL(15,2)  -- Computed: budget * 1.2
);

-- Indexes for performance
CREATE INDEX idx_acme_corp_software_projects_org_status ON acme_corp_software_projects(organization_id, status);
CREATE INDEX idx_acme_corp_software_projects_created_at ON acme_corp_software_projects(created_at);
```

### **Schema Migration Integration**
Computed fields require actual DDL changes since they become individual columns:

```typescript
// IMPORTANT: Computed fields DO require DDL changes!
// The RuntimeSchemaGenerator creates individual columns for each custom field
// Including computed fields

// When computed fields are added/removed:
// 1. Update the FieldDefinition in OrgSchemaDO (adds 'computed' type)
// 2. The existing debounced migration system detects schema changes
// 3. RuntimeSchemaGenerator.generateCreateTableSQL() includes computed fields
// 4. ALTER TABLE statements are executed to add/remove computed field columns

// Example DDL for adding a computed field:
// ALTER TABLE acme_corp_software_projects 
// ADD COLUMN total_cost DECIMAL(15,2);

// The fieldTypeToSQLType method needs updating to handle 'computed' type:
switch (fieldDef.type) {
  case 'computed':
    // Computed fields need a return type for the column
    return this.fieldTypeToSQLType(fieldDef.computed.returnType);
  // ... existing cases
}

// The schema migration system (debounced) handles the DDL execution
```

---

## 🎯 **Integration Benefits**

### **Seamless User Experience**
- ✅ **Unified Interface**: Computed fields appear alongside regular fields
- ✅ **Consistent API**: Same patterns as existing field management
- ✅ **Real-time Updates**: Integration with existing sync system
- ✅ **Familiar Workflows**: Extends current field configuration UI

### **Developer Experience**
- ✅ **Type Safety**: Full TypeScript integration
- ✅ **Hook-based**: Consistent React patterns
- ✅ **Cache Integration**: Leverages existing schema caching
- ✅ **Error Handling**: Unified error handling patterns

### **Technical Benefits**
- ✅ **Backward Compatible**: Existing schemas continue to work
- ✅ **Incremental Adoption**: Organizations can adopt computed fields gradually
- ✅ **Performance**: Builds on existing optimization patterns
- ✅ **Security**: Leverages existing permission and validation systems

---

## 🚀 **Implementation Steps**

### **Phase 1: Core Type Extensions**
1. **Extend `FieldDefinition` interface** in `apps/server/src/dataforge/rules/json-rules-engine.ts`
   - Add `'computed'` to the type union
   - Add optional `computed?: ComputedFieldConfig` property
   - Update type validation in `JsonRulesEngine.validateFieldTypes()` to handle computed fields

2. **Add computed field configuration interface** 
   - Define `ComputedFieldConfig` interface with formula, dependencies, returnType
   - Add validation logic for computed field configurations
   - Computed fields store VALUES in the existing `custom_fields` JSONB column
   - Computed field DEFINITIONS are stored in the OrgSchemaDO schema metadata

### **Phase 2: Server Integration** 
3. **Enhance OrgSchemaDO computed field methods**
   - Add `addComputedField()`, `removeComputedField()`, `getComputedFields()` methods
   - Integrate with existing schema storage and debounced migrations
   - Add formula validation using Math.js security configuration

4. **Extend ArchetypeEntityManager**
   - Add computed field management methods that delegate to OrgSchemaDO
   - Ensure computed fields work with Universal Archetype System

5. **Add API endpoints** in `apps/server/src/routes/dataforge-api.ts`
   - `PUT /orgs/:orgId/entities/:entityName/computed-fields/:fieldName`
   - `DELETE /orgs/:orgId/entities/:entityName/computed-fields/:fieldName`
   - `GET /orgs/:orgId/entities/:entityName/computed-fields`

### **Phase 3: Client Integration**
6. **Enhance `OrgSchemaClient`** in client-side schema management
   - Add `loadComputedFields()`, `saveComputedField()`, `deleteComputedField()` methods
   - Integrate with existing caching and error handling patterns

7. **Update `useEntitySchema` hook** 
   - Add computed fields state management and actions
   - Ensure computed fields load with entity schema data
   - Add real-time computed field calculation logic

### **Phase 4: UI Components**
8. **Create smart formula builder components**
   - `SmartFormulaBuilder` with dropdown field selection and auto-complete
   - `ComputedFieldEditor` modal with field configuration
   - `ComputedFieldsSection` for field management UI

9. **Integrate with existing field management**
   - Add computed fields section to current field configuration panels
   - Ensure consistent UI patterns with existing custom fields

### **Phase 5: Real-time Updates**
10. **Implement computation engine**
    - Client-side Math.js evaluation with security restrictions
    - Dependency change detection and cascade updates
    - Integration with existing WebSocket sync system

11. **Performance optimizations**
    - Smart caching of computed values
    - Batch computation for multiple field changes
    - Minimal re-computation strategies

### **Phase 6: Testing & Polish**
12. **Comprehensive testing**
    - Unit tests for formula validation and computation
    - Integration tests with existing sync system
    - UI testing for formula builder components

13. **Documentation and migration**
    - Update existing organizations with computed field support
    - User documentation for formula syntax
    - Developer guide for computed field patterns

This implementation plan leverages the existing server-side architecture and ensures computed fields integrate seamlessly with the current custom options system!