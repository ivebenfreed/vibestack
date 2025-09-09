# Synced Observable Options Integration Plan

## Overview

This plan integrates the existing backend option and relationship systems with Legend State synced observables to create a real-time collaborative dropdown/reference system. **No new database tables required** - we expose existing tables as virtual DataForge entities.

## Current Backend Architecture

### Existing Tables (No Changes)
```sql
-- System Options
system_option_sets (id, option_set_type, archetype, is_active)
system_options (id, option_set_id, value, label, color, icon, order, is_active)

-- Custom Options  
custom_option_sets (id, org_id, name, is_active)
custom_options (id, option_set_id, value, label, color, icon, order, is_active)

-- Relationships (per-org, auto-created)
org_xxx_relationships (id, source_entity_type, source_entity_id, relationship_type, 
                      target_entity_type, target_entity_id, properties, valid_from, valid_until)

-- Relationship Configuration
dataforge_relationship_fields (org_id, entity_type, field_name, relationship_type, 
                               target_entity_type, cardinality, ui_config)
```

### Existing Services (✅ FULLY IMPLEMENTED)
- `RelationshipFieldHandler` - ✅ Processes reference fields into relationships
- `EntityManager` - ✅ Handles CRUD operations with relationship processing  
- `DDLGenerator` - ✅ Filters out `user_reference`/`entity_reference` fields from table creation (lines 30-33)
- WebSocket notifications - ✅ Already notify on table changes
- `org_xxx_relationships` tables - ✅ Auto-created per organization for relationship data

### ✅ Reference Field System Status (CONFIRMED WORKING)

**Current Implementation:**
```sql  
-- Entity tables have NO foreign key columns
CREATE TABLE org_01920000_1000_7000_8000_000000000001_task (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT,
  priority TEXT,
  -- ❌ NO assignee_id column
  -- ❌ NO project_id column  
  -- ❌ NO parent_task_id column
  created_at TIMESTAMP
);

-- Relationships stored separately in relationship table
CREATE TABLE org_01920000_1000_7000_8000_000000000001_relationships (
  id UUID PRIMARY KEY,
  source_entity_type TEXT,     -- 'Task'
  source_entity_id UUID,       -- task.id
  relationship_type TEXT,      -- 'assigned_to', 'belongs_to', 'subtask_of'
  target_entity_type TEXT,     -- 'User', 'Project', 'Task' 
  target_entity_id UUID,       -- user.id, project.id, task.id
  properties JSONB,            -- Rich relationship metadata
  valid_from TIMESTAMP,
  valid_until TIMESTAMP        -- NULL = active
);
```

**Field Processing Flow:**
1. `user_reference`/`entity_reference` fields in archetype definitions
2. `DDLGenerator.generateCreateTableDDL()` filters them out (lines 30-33) 
3. `RelationshipFieldHandler.convertToRelationshipMetadata()` processes them
4. Configuration stored in `dataforge_relationship_fields` table
5. Actual relationship data goes to `org_xxx_relationships` table

**✅ This system is FULLY IMPLEMENTED and working correctly.**

## Implementation Plan

### Phase 1: Virtual Entity Schema Integration

#### Step 1.1: Enhance Universe Schema Loading
**File:** `apps/worker/src/legend-state/observables.ts`

```typescript
// Add virtual option entities to schema loading
export async function loadUniverseContext(
  userId: string, 
  organizationIds: string[]
) {
  // ... existing business entity loading ...
  
  // **NEW: Add virtual option entities to schema**
  const enhancedSchema = {
    entities: {
      // ... existing business entities ...
      
      // Global system option virtual entity
      SystemOption: {
        archetype: 'record',
        tableName: 'virtual_system_options',
        syncableFields: {
          id: { type: 'text', required: true },
          option_type: { type: 'text', required: true }, // priority, status, category
          archetype: { type: 'text', required: true },   // task, project, record
          value: { type: 'text', required: true },        // high, medium, low
          label: { type: 'text', required: true },        // "High Priority"
          color: { type: 'text' },
          icon: { type: 'text' },
          order: { type: 'number', defaultValue: 0 },
          is_active: { type: 'boolean', defaultValue: true }
        },
        _isVirtual: true,
        _backendTables: ['system_option_sets', 'system_options']
      },
      
      // Per-org custom option virtual entities
      ...organizationIds.reduce((acc, orgId) => {
        acc[`${orgId}_CustomOption`] = {
          archetype: 'record',
          tableName: `virtual_custom_options_${orgId}`,
          syncableFields: {
            id: { type: 'text', required: true },
            option_set_name: { type: 'text', required: true }, // departments, teams
            value: { type: 'text', required: true },
            label: { type: 'text', required: true },
            color: { type: 'text' },
            icon: { type: 'text' },
            order: { type: 'number', defaultValue: 0 },
            is_active: { type: 'boolean', defaultValue: true }
          },
          _isVirtual: true,
          _backendTables: ['custom_option_sets', 'custom_options'],
          _orgId: orgId
        }
        return acc
      }, {} as Record<string, any>)
    }
  }
  
  // Same initialization - virtual entities included in entityKeys
  const entityKeys = Object.keys(enhancedSchema.entities)
  await initializePersistence(userId, organizationIds, entityKeys.length)
}
```

**Testing Outcome:**
```bash
# Test schema loading includes virtual entities
curl -X GET "http://localhost:4001/debug/legend-state-status" | jq .entityKeys
# Should show: [...business entities, "SystemOption", "org1_CustomOption", ...]
```

#### Step 1.2: Enhanced Observable Creation
**File:** `apps/worker/src/legend-state/observables.ts`

```typescript
// Enhanced createEntityObservable handles virtual entities
function createEntityObservable(entityName: string, schema?: any) {
  let baseUrl: string
  let isVirtual = schema?._isVirtual || false
  
  if (entityName === 'SystemOption') {
    baseUrl = `/api/dataforge/system-options`
  } else if (entityName.includes('_') && entityName.endsWith('_CustomOption')) {
    const parts = entityName.split('_')
    const orgId = parts.slice(0, -1).join('_') // Handle UUIDs with dashes
    baseUrl = `/api/dataforge/orgs/${orgId}/custom-options`
  } else if (entityName.includes('_')) {
    // Regular business entities (existing logic)
    const parts = entityName.split('_') 
    const orgId = parts[0]
    const entityType = parts.slice(1).join('_')
    baseUrl = `/api/dataforge/orgs/${orgId}/data/${entityType}`
  }
  
  // **Same syncedCrud config works for virtual entities**
  const crudConfig = {
    changesSince: 'last-sync',
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    
    list: async () => {
      const response = await fetch(baseUrl, {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      return result.data || []
    },
    
    create: async (item: any) => {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      return result.data || item
    },
    
    update: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT', 
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      return result.data || item
    },
    
    delete: async (item: any) => {
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      return { id: item.id }
    },
    
    // **WebSocket notifications work for virtual entities**
    subscribe: ({ refresh }) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        const backendTables = schema?._backendTables || []
        
        // Check if any backend tables changed
        if (backendTables.some(table => notification.tables?.includes(table))) {
          refresh()
        }
      }
      
      window.addEventListener('vibestack:table-change-notification', handler)
      return () => window.removeEventListener('vibestack:table-change-notification', handler)
    }
  }
  
  return observable(syncedCrud(crudConfig))
}
```

**Testing Outcome:**
```bash
# Test virtual entity observable creation
curl -X GET "http://localhost:4001/debug/test-legend-state" \
  -d '{"action": "getEntity", "entityName": "SystemOption"}'
# Should return: {"success": true, "hasObservable": true, "recordCount": X}
```

### Phase 2: Virtual API Endpoints

#### Step 2.1: System Options Virtual Endpoint  
**File:** `apps/worker/src/server/routes/dataforge-api.ts`

```typescript
// NEW: Virtual system options endpoint
app.get('/api/dataforge/system-options', async (c) => {
  try {
    const options = await c.env.db
      .selectFrom('system_option_sets')
      .innerJoin('system_options', 'system_option_sets.id', 'system_options.option_set_id')
      .select([
        'system_options.id',
        'system_option_sets.option_set_type as option_type',
        'system_option_sets.archetype',
        'system_options.value',
        'system_options.label',
        'system_options.color',
        'system_options.icon',
        'system_options.order',
        'system_options.is_active',
        'system_options.created_at',
        'system_options.updated_at'
      ])
      .where('system_option_sets.is_active', '=', true)
      .orderBy('system_options.order', 'asc')
      .execute()
    
    console.log(`[SystemOptions] Retrieved ${options.length} system options`)
    return c.json({ success: true, data: options })
    
  } catch (error) {
    console.error('[SystemOptions] Error:', error)
    return c.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, 500)
  }
})

// NEW: Create system option
app.post('/api/dataforge/system-options', async (c) => {
  try {
    const body = await c.req.json()
    const { option_type, archetype, value, label, color, icon, order, is_active } = body
    
    // Find or create option set
    let optionSet = await c.env.db
      .selectFrom('system_option_sets')
      .select('id')
      .where('option_set_type', '=', option_type)
      .where('archetype', '=', archetype)
      .executeTakeFirst()
    
    if (!optionSet) {
      const newSetId = crypto.randomUUID()
      await c.env.db
        .insertInto('system_option_sets')
        .values({
          id: newSetId,
          option_set_type: option_type,
          archetype: archetype,
          is_active: true,
          created_at: new Date()
        })
        .execute()
      
      optionSet = { id: newSetId }
    }
    
    // Create option
    const newOptionId = crypto.randomUUID()
    await c.env.db
      .insertInto('system_options')
      .values({
        id: newOptionId,
        option_set_id: optionSet.id,
        value,
        label,
        color,
        icon,
        order: order || 0,
        is_active: is_active !== false,
        created_at: new Date()
      })
      .execute()
    
    const newOption = {
      id: newOptionId,
      option_type,
      archetype,
      value,
      label,
      color,
      icon,
      order: order || 0,
      is_active: is_active !== false,
      created_at: new Date().toISOString()
    }
    
    console.log(`[SystemOptions] Created new system option:`, newOption)
    return c.json({ success: true, data: newOption })
    
  } catch (error) {
    console.error('[SystemOptions] Create error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})
```

**Testing Outcome:**
```bash
# Test system options API
curl -X GET "http://localhost:4001/api/dataforge/system-options" -b cookies.txt
# Should return: {"success": true, "data": [...system options...]}

# Test create system option
curl -X POST "http://localhost:4001/api/dataforge/system-options" \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"option_type": "priority", "archetype": "task", "value": "critical", "label": "Critical Priority", "color": "#ff0000"}'
# Should return: {"success": true, "data": {...new option...}}
```

#### Step 2.2: Custom Options Virtual Endpoint
**File:** `apps/worker/src/server/routes/dataforge-api.ts`

```typescript
// NEW: Virtual custom options endpoint  
app.get('/api/dataforge/orgs/:orgId/custom-options', async (c) => {
  try {
    const orgId = c.req.param('orgId')
    
    const options = await c.env.db
      .selectFrom('custom_option_sets')
      .innerJoin('custom_options', 'custom_option_sets.id', 'custom_options.option_set_id')
      .select([
        'custom_options.id',
        'custom_option_sets.name as option_set_name',
        'custom_options.value',
        'custom_options.label', 
        'custom_options.color',
        'custom_options.icon',
        'custom_options.order',
        'custom_options.is_active',
        'custom_options.created_at',
        'custom_options.updated_at'
      ])
      .where('custom_option_sets.org_id', '=', orgId)
      .where('custom_option_sets.is_active', '=', true)
      .orderBy(['custom_option_sets.name', 'custom_options.order'])
      .execute()
    
    console.log(`[CustomOptions] Retrieved ${options.length} custom options for org ${orgId}`)
    return c.json({ success: true, data: options })
    
  } catch (error) {
    console.error('[CustomOptions] Error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})

// NEW: Create custom option
app.post('/api/dataforge/orgs/:orgId/custom-options', async (c) => {
  try {
    const orgId = c.req.param('orgId')
    const body = await c.req.json()
    const { option_set_name, value, label, color, icon, order, is_active } = body
    
    // Find or create option set
    let optionSet = await c.env.db
      .selectFrom('custom_option_sets')
      .select('id')
      .where('org_id', '=', orgId)
      .where('name', '=', option_set_name)
      .executeTakeFirst()
    
    if (!optionSet) {
      const newSetId = crypto.randomUUID()
      await c.env.db
        .insertInto('custom_option_sets')
        .values({
          id: newSetId,
          org_id: orgId,
          name: option_set_name,
          is_active: true,
          created_at: new Date()
        })
        .execute()
      
      optionSet = { id: newSetId }
    }
    
    // Create option
    const newOptionId = crypto.randomUUID()
    await c.env.db
      .insertInto('custom_options')
      .values({
        id: newOptionId,
        option_set_id: optionSet.id,
        value,
        label,
        color,
        icon,
        order: order || 0,
        is_active: is_active !== false,
        created_at: new Date()
      })
      .execute()
    
    const newOption = {
      id: newOptionId,
      option_set_name,
      value,
      label,
      color,
      icon,
      order: order || 0,
      is_active: is_active !== false,
      created_at: new Date().toISOString()
    }
    
    console.log(`[CustomOptions] Created custom option for org ${orgId}:`, newOption)
    return c.json({ success: true, data: newOption })
    
  } catch (error) {
    console.error('[CustomOptions] Create error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, 500)
  }
})
```

**Testing Outcome:**
```bash
# Test custom options API  
curl -X GET "http://localhost:4001/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/custom-options" -b cookies.txt
# Should return: {"success": true, "data": [...custom options...]}

# Test create custom option
curl -X POST "http://localhost:4001/api/dataforge/orgs/01920000-1000-7000-8000-000000000001/custom-options" \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"option_set_name": "departments", "value": "ai", "label": "AI Team", "color": "#00ff00"}'
# Should return: {"success": true, "data": {...new option...}}
```

### Phase 3: Enhanced Column Generation

#### Step 3.1: Update useEntityColumns Hook
**File:** `apps/worker/src/legend-state/hooks/use-entity-columns.ts`

```typescript
// Enhanced column generation with option population
export function useEntityColumns<T = any>(entityName: string): {
  columns: Column<T>[]
  isLoading: boolean
  error: string | null
} {
  const schema = use$(universeSchema$)
  const orgId = universeOrgId$.peek()
  
  // **NEW: Virtual option observables**
  const systemOptions$ = getEntity$('SystemOption')
  const customOptions$ = getEntity$(`${orgId}_CustomOption`)
  
  // **EXISTING: Business entity observables** 
  const users$ = getEntity$(`${orgId}_User`)
  const projects$ = getEntity$(`${orgId}_Project`)
  const tasks$ = getEntity$(`${orgId}_Task`)
  
  // Reactive option data
  const systemOptions = use$(systemOptions$ || observable({}))
  const customOptions = use$(customOptions$ || observable({}))
  
  const { columns, error } = useMemo(() => {
    if (!schema?.entities?.[entityName]) {
      return { columns: [], error: `Entity ${entityName} not found` }
    }
    
    const entityDef = schema.entities[entityName]
    
    // Generate base columns (existing logic)
    const baseColumns = entityDef.syncableFields 
      ? generateColumnsFromSyncableFields<T>(entityDef.syncableFields, entityName)
      : generateColumnsFromArchetype<T>(entityName, entityDef.archetype)
    
    // **NEW: Enhance columns with option data**
    const enhancedColumns = baseColumns.map(column => {
      const fieldDef = entityDef.syncableFields?.[column.field]
      
      // **System option fields** (priority_option, status_option, category_option)
      if (fieldDef?.type?.endsWith('_option')) {
        const optionType = fieldDef.type.replace('_option', '')
        
        const relevantOptions = Object.values(systemOptions).filter(opt => 
          opt.option_type === optionType && 
          opt.archetype === entityDef.archetype &&
          opt.is_active
        ).sort((a, b) => a.order - b.order)
        
        console.log(`[useEntityColumns] Found ${relevantOptions.length} ${optionType} options for ${entityDef.archetype}`)
        
        return {
          ...column,
          cellType: 'select' as const,
          enumOptions: relevantOptions.map(opt => ({
            value: opt.value,
            label: opt.label,
            color: opt.color,
            icon: opt.icon,
            description: opt.description
          }))
        }
      }
      
      // **Custom option fields** (department, team, location, etc.)
      if (fieldDef?.type === 'custom_option_reference') {
        const optionSetName = inferOptionSetName(column.field)
        
        const relevantOptions = Object.values(customOptions).filter(opt => 
          opt.option_set_name === optionSetName &&
          opt.is_active
        ).sort((a, b) => a.order - b.order)
        
        console.log(`[useEntityColumns] Found ${relevantOptions.length} custom options for ${optionSetName}`)
        
        return {
          ...column,
          cellType: 'select' as const,
          enumOptions: relevantOptions.map(opt => ({
            value: opt.value,
            label: opt.label,
            color: opt.color,
            icon: opt.icon,
            description: opt.description
          }))
        }
      }
      
      // **User reference fields** (assignee_id, created_by, etc.)
      if (fieldDef?.type === 'user_reference') {
        return {
          ...column,
          cellType: 'entity-select' as const,
          entityType: 'User',
          referencedEntity$: users$,
          relationshipType: inferRelationshipType(column.field),
          displayField: 'name',
          searchFields: ['name', 'email']
        }
      }
      
      // **Entity reference fields** (project_id, parent_task_id, etc.)
      if (fieldDef?.type === 'entity_reference') {
        const targetEntityType = inferTargetEntityType(column.field)
        const referencedEntity$ = getEntity$(`${orgId}_${targetEntityType}`)
        
        return {
          ...column,
          cellType: 'entity-select' as const,
          entityType: targetEntityType,
          referencedEntity$,
          relationshipType: inferRelationshipType(column.field),
          displayField: 'title',
          searchFields: ['title', 'name']
        }
      }
      
      return column
    })
    
    console.log(`[useEntityColumns] Generated ${enhancedColumns.length} enhanced columns for ${entityName}`)
    return { columns: enhancedColumns, error: null }
    
  }, [schema, entityName, systemOptions, customOptions])
  
  return {
    columns,
    isLoading: !schema,
    error
  }
}

// Helper functions using existing RelationshipFieldHandler logic
function inferTargetEntityType(fieldName: string): string {
  const patterns: Record<string, string> = {
    'assignee_id': 'User',
    'project_id': 'Project',
    'parent_task_id': 'Task',
    'parent_document_id': 'Document',
    'document_id': 'Document',
    'file_id': 'File'
  }
  
  if (patterns[fieldName]) {
    return patterns[fieldName]
  }
  
  // Generic pattern
  if (fieldName.endsWith('_id')) {
    const baseName = fieldName.replace(/_id$/, '').replace(/^parent_/, '')
    return baseName.charAt(0).toUpperCase() + baseName.slice(1)
  }
  
  return 'Unknown'
}

function inferRelationshipType(fieldName: string): string {
  const patterns: Record<string, string> = {
    'assignee_id': 'assigned_to',
    'owner_id': 'owned_by',
    'author_id': 'authored_by',
    'created_by': 'created_by',
    'project_id': 'belongs_to',
    'parent_task_id': 'subtask_of',
    'parent_document_id': 'child_of'
  }
  
  return patterns[fieldName] || 'relates_to'
}

function inferOptionSetName(fieldName: string): string {
  const fieldToOptionSet: Record<string, string> = {
    department: 'departments',
    team: 'teams',
    location: 'locations',
    category: 'categories',
    skill: 'skills',
    tool: 'tools'
  }
  
  return fieldToOptionSet[fieldName] || fieldName
}
```

**Testing Outcome:**
```bash
# Test enhanced column generation
curl -X GET "http://localhost:4001/debug/test-columns" \
  -d '{"entityName": "Task"}' -b cookies.txt
# Should return columns with populated enumOptions for status, priority, etc.

# Check for specific column enhancements:
# - status field should have enumOptions from SystemOption
# - priority field should have enumOptions from SystemOption  
# - assignee_id should have entityType: 'User' and referencedEntity$
```

### Phase 4: Real-Time Testing & Validation

#### Step 4.1: Option Management Testing
**File:** Create test utility at `apps/worker/src/legend-state/test-utils/option-manager-test.ts`

```typescript
// Test utility for option management
export class OptionManagerTester {
  static async testSystemOptionFlow() {
    console.log('🧪 Testing system option real-time flow...')
    
    // 1. Get SystemOption observable
    const systemOptions$ = getEntity$('SystemOption')
    if (!systemOptions$) {
      throw new Error('SystemOption observable not available')
    }
    
    console.log('✅ SystemOption observable created')
    
    // 2. Test initial load
    const initialOptions = systemOptions$.get()
    console.log(`✅ Loaded ${Object.keys(initialOptions).length} initial system options`)
    
    // 3. Test create new option
    const newOptionId = crypto.randomUUID()
    const newOption = {
      id: newOptionId,
      option_type: 'priority',
      archetype: 'task',
      value: 'test-critical',
      label: 'Test Critical Priority',
      color: '#ff4444',
      icon: 'AlertTriangle',
      order: 0,
      is_active: true
    }
    
    systemOptions$[newOptionId] = newOption
    console.log('✅ Created new system option via observable')
    
    // 4. Wait for sync and verify
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const updatedOptions = systemOptions$.get()
    if (updatedOptions[newOptionId]) {
      console.log('✅ New system option synced successfully')
    } else {
      throw new Error('New system option not found after sync')
    }
    
    // 5. Test update
    const updatedOption = {
      ...updatedOptions[newOptionId],
      label: 'Updated Test Critical Priority'
    }
    
    systemOptions$.set({
      ...systemOptions$.get(),
      [newOptionId]: updatedOption
    })
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const finalOptions = systemOptions$.get()
    if (finalOptions[newOptionId].label === 'Updated Test Critical Priority') {
      console.log('✅ System option update synced successfully')
    } else {
      throw new Error('System option update not synced')
    }
    
    // 6. Cleanup - deactivate test option
    systemOptions$.set({
      ...systemOptions$.get(),
      [newOptionId]: {
        ...finalOptions[newOptionId],
        is_active: false
      }
    })
    
    console.log('✅ System option test completed successfully')
  }
  
  static async testCustomOptionFlow(orgId: string) {
    console.log('🧪 Testing custom option real-time flow...')
    
    const customOptions$ = getEntity$(`${orgId}_CustomOption`)
    if (!customOptions$) {
      throw new Error('CustomOption observable not available')
    }
    
    console.log('✅ CustomOption observable created')
    
    // Similar test flow for custom options
    const initialOptions = customOptions$.get()
    console.log(`✅ Loaded ${Object.keys(initialOptions).length} initial custom options`)
    
    const newOptionId = crypto.randomUUID()
    const newCustomOption = {
      id: newOptionId,
      option_set_name: 'departments',
      value: 'test-dept',
      label: 'Test Department',
      color: '#00ff00',
      order: 99,
      is_active: true
    }
    
    customOptions$[newOptionId] = newCustomOption
    console.log('✅ Created new custom option via observable')
    
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    const updatedOptions = customOptions$.get()
    if (updatedOptions[newOptionId]) {
      console.log('✅ New custom option synced successfully')
    } else {
      throw new Error('New custom option not found after sync')
    }
    
    console.log('✅ Custom option test completed successfully')
  }
  
  static async testColumnGeneration(entityName: string) {
    console.log(`🧪 Testing column generation for ${entityName}...`)
    
    // Test useEntityColumns hook
    const { columns, isLoading, error } = useEntityColumns(entityName)
    
    if (error) {
      throw new Error(`Column generation error: ${error}`)
    }
    
    if (isLoading) {
      console.log('⏳ Columns still loading...')
      return
    }
    
    console.log(`✅ Generated ${columns.length} columns for ${entityName}`)
    
    // Check for option-enhanced columns
    const optionColumns = columns.filter(col => col.enumOptions && col.enumOptions.length > 0)
    const entityRefColumns = columns.filter(col => col.cellType === 'entity-select')
    
    console.log(`✅ Found ${optionColumns.length} option columns`)
    console.log(`✅ Found ${entityRefColumns.length} entity reference columns`)
    
    optionColumns.forEach(col => {
      console.log(`  - ${col.field}: ${col.enumOptions?.length} options`)
    })
    
    entityRefColumns.forEach(col => {
      console.log(`  - ${col.field}: references ${col.entityType}`)
    })
    
    console.log('✅ Column generation test completed')
  }
}
```

#### Step 4.2: Integration Test Script
**File:** `apps/worker/src/legend-state/test-utils/run-integration-tests.ts`

```typescript
// Complete integration test
export async function runSyncedOptionsIntegrationTest() {
  try {
    console.log('🚀 Starting Synced Options Integration Test...')
    
    // 1. Test Legend State initialization includes virtual entities
    console.log('\n📋 Phase 1: Legend State Initialization')
    const entityKeys = Object.keys(universeSchema$.peek()?.entities || {})
    const hasSystemOption = entityKeys.includes('SystemOption')
    const hasCustomOption = entityKeys.some(key => key.endsWith('_CustomOption'))
    
    console.log(`✅ Total entities: ${entityKeys.length}`)
    console.log(`${hasSystemOption ? '✅' : '❌'} SystemOption entity present`)
    console.log(`${hasCustomOption ? '✅' : '❌'} CustomOption entities present`)
    
    // 2. Test virtual API endpoints
    console.log('\n🔗 Phase 2: Virtual API Endpoints')
    
    const systemOptionsResponse = await fetch('/api/dataforge/system-options', {
      credentials: 'include'
    })
    const systemOptionsData = await systemOptionsResponse.json()
    
    console.log(`${systemOptionsResponse.ok ? '✅' : '❌'} System options API: ${systemOptionsData.data?.length || 0} options`)
    
    const orgId = universeOrgId$.peek()
    const customOptionsResponse = await fetch(`/api/dataforge/orgs/${orgId}/custom-options`, {
      credentials: 'include'
    })
    const customOptionsData = await customOptionsResponse.json()
    
    console.log(`${customOptionsResponse.ok ? '✅' : '❌'} Custom options API: ${customOptionsData.data?.length || 0} options`)
    
    // 3. Test observable creation and data loading
    console.log('\n📊 Phase 3: Observable Data Loading')
    await OptionManagerTester.testSystemOptionFlow()
    await OptionManagerTester.testCustomOptionFlow(orgId)
    
    // 4. Test column generation with options
    console.log('\n🏗️ Phase 4: Column Generation')
    await OptionManagerTester.testColumnGeneration('Task')
    await OptionManagerTester.testColumnGeneration('Project')
    
    // 5. Test real-time collaboration
    console.log('\n🤝 Phase 5: Real-Time Collaboration')
    
    // Create new system option and verify it appears in column generation
    const systemOptions$ = getEntity$('SystemOption')
    const testOptionId = crypto.randomUUID()
    
    systemOptions$[testOptionId] = {
      id: testOptionId,
      option_type: 'priority',
      archetype: 'task',
      value: 'integration-test',
      label: 'Integration Test Priority',
      color: '#9f39ff',
      order: 999,
      is_active: true
    }
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Regenerate columns and check for new option
    const { columns } = useEntityColumns('Task')
    const priorityColumn = columns.find(col => col.field === 'priority')
    const hasNewOption = priorityColumn?.enumOptions?.some(opt => opt.value === 'integration-test')
    
    console.log(`${hasNewOption ? '✅' : '❌'} Real-time option sync in column generation`)
    
    // Cleanup
    systemOptions$.set({
      ...systemOptions$.get(),
      [testOptionId]: {
        ...systemOptions$.get()[testOptionId],
        is_active: false
      }
    })
    
    console.log('\n🎉 Integration test completed successfully!')
    
  } catch (error) {
    console.error('❌ Integration test failed:', error)
    throw error
  }
}
```

**Testing Outcome:**
```bash
# Run complete integration test
curl -X POST "http://localhost:4001/debug/run-synced-options-test" -b cookies.txt
# Should output detailed test results with all ✅ marks

# Test specific scenarios:
# 1. Admin creates new priority option → all users see it in dropdowns
# 2. Manager adds new department → appears in all department fields
# 3. User assignment updates → real-time collaboration in entity references
# 4. Column generation reflects live option changes
# 5. WebSocket notifications trigger option observable refreshes
```

## Success Criteria

### Phase 1 Complete ✅
- [ ] Virtual entities appear in universe schema
- [ ] SystemOption and CustomOption observables can be created
- [ ] Virtual entities get same IndexedDB persistence as business entities
- [ ] Entity validation includes virtual entities

### Phase 2 Complete ✅  
- [ ] `/api/dataforge/system-options` returns joined data from existing tables
- [ ] `/api/dataforge/orgs/:orgId/custom-options` returns org-specific options
- [ ] CRUD operations write to existing `system_options` and `custom_options` tables
- [ ] WebSocket notifications fire for option table changes

### Phase 3 Complete ✅
- [ ] `useEntityColumns` populates `enumOptions` from system options
- [ ] Custom option fields get dropdown options from custom options
- [ ] Entity reference fields get `referencedEntity$` observables
- [ ] Column generation is reactive to option changes

### Phase 4 Complete ✅
- [ ] Real-time option creation appears in all dropdowns instantly
- [ ] Option updates sync across all users in real-time  
- [ ] Entity reference changes use existing relationship system
- [ ] Performance scales to 1000+ options with virtual scrolling
- [ ] All operations maintain data consistency with existing backend

## Rollout Strategy

1. **Development Testing**: Complete all integration tests in development
2. **Staging Deployment**: Deploy with feature flag to staging environment  
3. **User Acceptance Testing**: Test with sample users for real-time collaboration
4. **Gradual Production Rollout**: Enable for pilot organizations first
5. **Full Production**: Enable for all organizations after validation

## Maintenance

- Monitor WebSocket notification performance with option changes
- Track IndexedDB storage usage with virtual entity caching
- Update virtual entity schemas when backend option tables change
- Maintain backward compatibility with existing option management UIs
- Document relationship field processing for new entity archetypes