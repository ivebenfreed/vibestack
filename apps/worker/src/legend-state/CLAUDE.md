# Legend State Patterns - VibeStack

*This file provides guidance for using Legend State observables in the VibeStack application.*

## Overview

VibeStack uses Legend State with `syncedCrud` for reactive state management and automatic server synchronization. The system includes enhanced schema loading with comprehensive field metadata for rich UI integration. This document outlines the correct patterns and common pitfalls.

## Enhanced Schema Loading Architecture (September 2025)

VibeStack now includes a sophisticated schema loading system that provides comprehensive field metadata for frontend consumption:

- **Schema Observable**: Reactive schema loading with Legend State patterns
- **Enhanced Field Metadata**: Comprehensive UI configuration (validation, display, editor, capabilities, accessibility)
- **Rollup Fields Frontend Calculation**: Real-time calculation metadata for rollup fields
- **Data Grid Integration**: Complete column configuration and interaction capabilities
- **Form Builder Support**: Rich metadata for dynamic form generation

## Architecture

```
UI Components → Legend State Observables → syncedCrud → Server API → Database
     ↑                    ↑                                             ↓
     │         Schema Observable (Enhanced)                              │
     │              ↑                                                    │
     └─────── Real-time Updates ←── WebSocket Notifications ←───────────┘
```

### Enhanced Schema Flow

```
1. Schema Loading:
   getSchemaObservable$(orgId) → /api/dataforge/orgs/:orgId/schema → EntitySchemaManager
   
2. Field Enhancement:
   Raw Schema → Enhanced Field Handlers → Comprehensive Metadata → Frontend Schema
   
3. UI Integration:
   Schema Observable → React Components → Data Grids/Forms → Rich UI Experiences
```

## Core Patterns

### 1. Schema Loading and Enhanced Metadata

**✅ CORRECT - Use schema observables for field metadata:**
```typescript
import { getSchemaObservable$, getSchemaData$, getFieldsByCapability } from '@/legend-state/schema-observable'

// Get schema observable for an organization
const schemaObs = getSchemaObservable$(orgId)

// Get current schema data (reactive)
const schema = getSchemaData$(orgId)

// Access entity definition with enhanced metadata
const clientEntity = schema?.entities?.['Client']
if (clientEntity) {
  // All fields have comprehensive metadata
  const nameField = clientEntity.syncableFields.name
  console.log('Field display config:', nameField.display)
  console.log('Field validation rules:', nameField.validation)
  console.log('Field capabilities:', nameField.capabilities)
}
```

**✅ CORRECT - Use enhanced field metadata for data grids:**
```typescript
import { getFieldDisplayConfiguration } from '@/legend-state/schema-observable'

// Get complete column configuration for data grid
const displayConfig = getFieldDisplayConfiguration(orgId, 'Client')

const columns = displayConfig.columns.map(col => ({
  field: col.field,
  headerName: col.header,
  width: col.width,
  sortable: col.sortable,
  filterable: col.filterable,
  type: col.type,
  align: col.align,
  // Enhanced metadata provides rich configuration
  cellRenderer: col.type.includes('rollup') ? 'CalculatedCellRenderer' : 'DefaultCellRenderer',
  editable: !col.type.includes('rollup') && !col.type.includes('computed')
}))
```

**✅ CORRECT - Handle rollup fields with frontend calculation:**
```typescript
import { getCalculatedFields } from '@/legend-state/schema-observable'

// Get rollup and computed fields with their calculation metadata
const { rollupFields, computedFields, calculationMetadata } = getCalculatedFields(orgId, 'Project')

// Rollup fields provide frontend calculation configuration
rollupFields.forEach(field => {
  if (field.rollup) {
    console.log(`Rollup field ${field.name}:`, {
      type: field.rollup.type,              // 'count', 'sum', 'average', 'concat'
      targetEntity: field.rollup.targetEntityType,
      targetField: field.rollup.targetField,
      relationshipType: field.rollup.relationshipType,
      realTimeUpdates: field.rollup.realTimeUpdates
    })
  }
})
```

**✅ CORRECT - Use field capabilities for UI behavior:**
```typescript
import { getFieldsByCapability } from '@/legend-state/schema-observable'

// Get fields that support specific capabilities
const sortableFields = getFieldsByCapability(orgId, 'Client', 'supportsSorting')
const filterableFields = getFieldsByCapability(orgId, 'Client', 'supportsFiltering') 
const aggregatableFields = getFieldsByCapability(orgId, 'Client', 'supportsAggregation')

// Configure UI based on field capabilities
const sortOptions = sortableFields.map(field => ({
  value: field.name,
  label: field.display?.label || field.name,
  type: field.type
}))
```

**❌ WRONG - Don't bypass schema loading:**
```typescript
// Don't hardcode field configurations
const columns = [
  { field: 'name', width: 200, sortable: true },  // Missing enhanced metadata
  { field: 'total_tasks', width: 100 }              // May be rollup field!
]

// Don't ignore field capabilities
if (field.type === 'rollup_count') {  // Use capabilities instead
  // Handle manually
}
```

### 2. Getting Entity Observables

**✅ CORRECT - Use `getEntity$()`:**
```typescript
import { getEntity$ } from '@/legend-state'

// Get the entity observable - this is a syncedCrud observable wrapped with observable()
const clientsObs = getEntity$('Client')
if (!clientsObs) {
  console.error('Client entity not available')
  return
}

// Verify the observable has proper methods
console.log('Observable has .get():', typeof clientsObs.get === 'function')
console.log('Observable has .set():', typeof clientsObs.set === 'function')
```

**❌ WRONG - Direct access to entities$:**
```typescript
// Don't do this - timing issues with computed observables
const entities = entities$.get()
const clientsObs = entities['Client'] // This may fail
```

**🔍 IMPORTANT - Observable Structure:**
Entity observables are `syncedCrud` observables wrapped with `observable()`:
```typescript
// This is how observables are created internally
const entityObservable = observable(syncedCrud(crudConfig))
// NOT just: syncedCrud(crudConfig) - that returns a function
```

### 2. Reading Data from Observables

**✅ CORRECT - Access individual records:**
```typescript
const clientsObs = getEntity$('Client')

// Get all records as an object
const allClients = clientsObs.get() // Returns Record<string, ClientRecord>

// Get specific record by ID
const client = clientsObs['client-123']
const clientData = client?.peek() // Use peek() to avoid tracking

// Get record data reactively in components
const clientName = client?.name?.get() // Will trigger re-render when changed
```

**✅ CORRECT - Use in React components:**
```typescript
import { observer } from '@legendapp/state/react'
import { getEntity$ } from '@/legend-state'

const ClientList = observer(() => {
  const clientsObs = getEntity$('Client')
  if (!clientsObs) return <div>Loading...</div>
  
  // This will reactively update when clients change
  const clients = Object.values(clientsObs.get())
  
  return (
    <div>
      {clients.map(client => (
        <div key={client.id}>{client.name}</div>
      ))}
    </div>
  )
})
```

### 3. Creating Records

**✅ CORRECT - Direct assignment pattern:**
```typescript
const clientsObs = getEntity$('Client')
const newId = crypto.randomUUID()

// Create record by direct assignment - syncedCrud will handle server sync
clientsObs[newId] = {
  id: newId,
  name: 'New Client',
  company_name: 'Acme Corp',
  contact_person: 'John Doe',
  email: 'john@acme.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
}
```

**❌ WRONG - Manual API calls:**
```typescript
// Don't manually call the API - let syncedCrud handle it
fetch('/api/clients', { 
  method: 'POST', 
  body: JSON.stringify(clientData) 
})
```

### 4. Updating Records

**✅ CORRECT - Update entire observable data:**
```typescript
const clientsObs = getEntity$('Client')
const clientId = 'client-123'

// Get current data from the observable
const allRecords = clientsObs.get()
const currentRecord = allRecords[clientId]

if (!currentRecord) {
  throw new Error(`Record ${clientId} not found`)
}

// Create updated record by merging changes
const updatedRecord = {
  ...currentRecord,
  name: 'Updated Name',
  email: 'new@email.com',
  updated_at: new Date().toISOString()
}

// Update the entire observable data - this triggers syncedCrud sync
const newRecords = { ...allRecords, [clientId]: updatedRecord }
clientsObs.set(newRecords)
```

**❌ WRONG - Direct record field access:**
```typescript
// Don't do this - causes "observable should not be used as primitive" errors
clientsObs[clientId].name.set('Updated Name') // ERROR!
clientsObs[clientId] = updatedRecord           // ERROR!

// Don't call non-existent methods
await clientsObs.update(updatedRecord)         // ERROR! .update() doesn't exist
```

**✅ CORRECT - Using the entityOperations helper:**
```typescript
import { entityOperations } from '@/legend-state'

// This provides enhanced error handling and validation
await entityOperations.updateEntity('Client', clientId, {
  name: 'Updated Name',
  email: 'new@email.com'
})
```

### 5. Deleting Records

**✅ CORRECT - Remove from observable data:**
```typescript
const clientsObs = getEntity$('Client')
const clientId = 'client-123'

// Get current data from the observable
const allRecords = clientsObs.get()

if (!allRecords[clientId]) {
  throw new Error(`Record ${clientId} not found`)
}

// Create new data without the deleted record
const { [clientId]: deletedRecord, ...remainingRecords } = allRecords
clientsObs.set(remainingRecords)
```

**❌ WRONG - Direct delete operations:**
```typescript
// Don't do this - causes primitive errors
delete clientsObs['client-123']        // ERROR!
clientsObs['client-123'] = undefined   // ERROR!
```

**✅ CORRECT - Using entityOperations helper:**
```typescript
import { entityOperations } from '@/legend-state'

await entityOperations.deleteEntity('Client', 'client-123')
```

## Enhanced Schema Patterns

### Schema Validation and Optimization

```typescript
import { validateSchemaIntegrity } from '@/legend-state/schema-observable'

// Validate schema integrity and get optimization suggestions
const schema = getSchemaData$(orgId)
if (schema) {
  const validation = validateSchemaIntegrity(schema)
  
  if (!validation.valid) {
    console.error('Schema validation errors:', validation.errors)
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Schema warnings:', validation.warnings)
  }
  
  if (validation.optimizations.length > 0) {
    console.info('Schema optimization suggestions:', validation.optimizations)
  }
}
```

### Dynamic Form Generation from Schema

```typescript
const FormGenerator = observer(({ entityName, record }) => {
  const schema = getSchemaData$(orgId)
  const entity = schema?.entities?.[entityName]
  
  if (!entity) return <div>Loading schema...</div>
  
  // Generate form fields from enhanced metadata
  const formFields = Object.values(entity.allFields || {}).map(field => {
    const fieldProps = {
      name: field.name,
      label: field.display?.label,
      required: field.required,
      placeholder: field.display?.placeholder,
      width: field.display?.width,
      disabled: field.capabilities?.isCalculatedField,
      // Enhanced accessibility
      'aria-label': field.accessibility?.ariaLabel,
      'aria-description': field.accessibility?.ariaDescription
    }
    
    // Determine input component based on enhanced metadata
    switch (field.editor?.type) {
      case 'text':
        return <TextInput key={field.name} {...fieldProps} />
      case 'textarea':
        return <TextArea key={field.name} {...fieldProps} rows={field.editor.rows} />
      case 'select':
        return <Select key={field.name} {...fieldProps} options={field.enumOptions} />
      case 'currency':
        return <CurrencyInput key={field.name} {...fieldProps} step={field.editor.step} />
      case 'calculated-display':
        return <CalculatedDisplay key={field.name} {...fieldProps} indicator={field.editor.calculationIndicator} />
      case 'entity-selector':
        return <EntitySelector key={field.name} {...fieldProps} targetEntity={field.editor.targetEntityType} />
      default:
        return <TextInput key={field.name} {...fieldProps} />
    }
  })
  
  return <form>{formFields}</form>
})
```

### Data Grid with Enhanced Schema Integration

```typescript
const EnhancedDataGrid = observer(({ entityName }) => {
  const displayConfig = getFieldDisplayConfiguration(orgId, entityName)
  const entityObs = getEntity$(entityName)
  
  if (!entityObs || !displayConfig) return <div>Loading...</div>
  
  // Enhanced column configuration from schema
  const columns = displayConfig.columns.map(col => ({
    field: col.field,
    headerName: col.header,
    width: col.width,
    sortable: col.sortable,
    filterable: col.filterable,
    align: col.align,
    
    // Enhanced rendering based on field type
    cellRenderer: (params) => {
      if (col.type.includes('rollup')) {
        return <RollupCell value={params.value} format={col.format} indicator={true} />
      }
      if (col.type === 'currency') {
        return <CurrencyCell value={params.value} format={col.format} />
      }
      if (col.type.includes('reference')) {
        return <RelationshipCell value={params.value} entityType={col.targetEntityType} />
      }
      return <DefaultCell value={params.value} format={col.format} />
    },
    
    // Enhanced editing based on capabilities
    editable: !col.type.includes('rollup') && !col.type.includes('computed'),
    cellEditor: col.type === 'select' ? 'SelectEditor' : 'TextEditor'
  }))
  
  const records = Object.values(entityObs.get())
  
  return (
    <DataGrid 
      columns={columns}
      rows={records}
      defaultSort={displayConfig.defaultSort}
      primaryField={displayConfig.primaryField}
    />
  )
})
```

### Rollup Field Calculation Integration

```typescript
const RollupCalculator = {
  // Calculate rollup values based on enhanced metadata
  calculateRollupValue(rollupConfig: any, sourceRecords: any[]) {
    const { type, targetField, conditions, separator, precision } = rollupConfig
    
    // Filter records based on conditions
    let filteredRecords = sourceRecords
    if (conditions && Object.keys(conditions).length > 0) {
      filteredRecords = sourceRecords.filter(record => 
        Object.entries(conditions).every(([key, value]) => record[key] === value)
      )
    }
    
    switch (type) {
      case 'count':
        return filteredRecords.length
        
      case 'sum':
        return filteredRecords.reduce((sum, record) => 
          sum + (parseFloat(record[targetField]) || 0), 0
        ).toFixed(precision || 2)
        
      case 'average':
        if (filteredRecords.length === 0) return 0
        const total = filteredRecords.reduce((sum, record) => 
          sum + (parseFloat(record[targetField]) || 0), 0
        )
        return (total / filteredRecords.length).toFixed(precision || 2)
        
      case 'concat':
        return filteredRecords
          .map(record => record[targetField])
          .filter(Boolean)
          .join(separator || ', ')
          
      default:
        return null
    }
  }
}

// Use in components to calculate rollup values
const ProjectSummary = observer(({ projectId }) => {
  const tasksObs = getEntity$('Task')
  const { rollupFields } = getCalculatedFields(orgId, 'Project')
  
  if (!tasksObs) return <div>Loading...</div>
  
  // Calculate rollup values in real-time
  const allTasks = Object.values(tasksObs.get())
  const projectTasks = allTasks.filter(task => task.project_id === projectId)
  
  const rollupValues = rollupFields.reduce((acc, field) => {
    if (field.rollup) {
      acc[field.name] = RollupCalculator.calculateRollupValue(field.rollup, projectTasks)
    }
    return acc
  }, {})
  
  return (
    <div>
      {rollupFields.map(field => (
        <div key={field.name}>
          <label>{field.display?.label}:</label>
          <span 
            aria-label={field.accessibility?.ariaLabel}
            aria-live="polite"
          >
            {rollupValues[field.name]}
          </span>
        </div>
      ))}
    </div>
  )
})
```

## Advanced Patterns

### Batch Operations

```typescript
import { batchOperations } from '@/legend-state'

// Batch create multiple records
const newClients = [
  { name: 'Client 1', email: 'client1@example.com' },
  { name: 'Client 2', email: 'client2@example.com' }
]

const result = await batchOperations.batchCreate('Client', newClients)
console.log(`Created ${result.successful} clients`)

// Batch update
const updates = [
  { id: 'client-1', data: { status: 'active' } },
  { id: 'client-2', data: { status: 'inactive' } }
]

await batchOperations.batchUpdate('Client', updates)
```

### Reactive Queries

```typescript
const clientsObs = getEntity$('Client')

// Create computed observables for filtered data
const activeClients$ = observable(() => {
  const clients = clientsObs.get()
  return Object.values(clients).filter(client => client.status === 'active')
})

// Use in components
const ActiveClientsList = observer(() => {
  const activeClients = activeClients$.get()
  return (
    <div>
      {activeClients.map(client => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  )
})
```

### Handling Loading States

```typescript
import { use$ } from '@legendapp/state/react'
import { isLoading$ } from '@/legend-state'

const ClientManager = observer(() => {
  const loading = use$(isLoading$)
  const clientsObs = getEntity$('Client')
  
  if (loading || !clientsObs) {
    return <div>Loading clients...</div>
  }
  
  const clients = Object.values(clientsObs.get())
  
  return (
    <div>
      {clients.map(client => (
        <ClientCard key={client.id} client={client} />
      ))}
    </div>
  )
})
```

## Server Synchronization

### Automatic Sync

Legend State with `syncedCrud` automatically handles:
- ✅ **CREATE**: When you assign `clientsObs[id] = newRecord`
- ✅ **UPDATE**: When you modify `clientsObs[id].field.set(value)`
- ✅ **DELETE**: When you `delete clientsObs[id]`
- ✅ **OPTIMISTIC UPDATES**: UI updates immediately, server sync happens in background
- ✅ **CONFLICT RESOLUTION**: Server response overwrites optimistic updates
- ✅ **RETRY LOGIC**: Automatic retry on network failures

### Differential Sync

The system uses differential sync for efficiency:

```typescript
// Legend State tracks last sync timestamp
// Only fetches records modified since last sync
const syncConfig = {
  changesSince: 'last-sync',
  fieldUpdatedAt: 'updated_at'
}
```

### WebSocket Notifications

Real-time updates via WebSocket notifications:

```typescript
// When other clients make changes, WebSocket notifications trigger refreshes
window.addEventListener('vibestack:table-change-notification', (event) => {
  const { tables } = event.detail
  if (tables.includes('clients')) {
    // Legend State will automatically fetch latest data
  }
})
```

## Common Pitfalls

### ❌ Don't Access Observables Before Schema Loads

```typescript
// Wrong - may fail if called before org context loads
const clientsObs = getEntity$('Client')

// Right - check for null and handle loading state
const clientsObs = getEntity$('Client')
if (!clientsObs) {
  console.log('Client entity not ready yet')
  return
}
```

### ❌ Don't Access Individual Record Observables Directly

```typescript
// Wrong - causes "observable should not be used as primitive" errors
const clientsObs = getEntity$('Client')
clientsObs[id].name.set('Updated Name')     // ERROR!
clientsObs[id] = updatedRecord              // ERROR!
const record = clientsObs[id]               // ERROR! Returns observable, not data

// Right - use .get() to access data, then .set() to update
const allRecords = clientsObs.get()
const currentRecord = allRecords[id]        // This gets actual data
const updatedData = { ...allRecords, [id]: updatedRecord }
clientsObs.set(updatedData)                // This updates the observable
```

### ❌ Don't Call Non-Existent Methods

```typescript
// Wrong - syncedCrud observables don't have these methods
await clientsObs.update(record)             // ERROR! .update() doesn't exist
await clientsObs.create(record)             // ERROR! .create() doesn't exist  
await clientsObs.delete(id)                 // ERROR! .delete() doesn't exist

// Right - use entityOperations helper or direct .set() pattern
await entityOperations.updateEntity('Client', id, data)
// OR
const newData = { ...clientsObs.get(), [id]: updatedRecord }
clientsObs.set(newData)
```

### ❌ Don't Mix Direct API Calls with Legend State

```typescript
// Wrong - this creates inconsistent state
fetch('/api/clients/123', { method: 'PUT', body: JSON.stringify(data) })
// Now local state is out of sync

// Right - let Legend State handle all API interactions
const allRecords = clientsObs.get()
const updatedData = { ...allRecords, ['123']: { ...allRecords['123'], ...data } }
clientsObs.set(updatedData)
```

### ❌ Don't Forget to Use Observer Components

```typescript
// Wrong - component won't re-render when data changes
const ClientList = () => {
  const clientsObs = getEntity$('Client')
  const clients = Object.values(clientsObs?.get() || {})
  
  return <div>{clients.length} clients</div> // Stale count
}

// Right - use observer to make component reactive
const ClientList = observer(() => {
  const clientsObs = getEntity$('Client')
  const clients = Object.values(clientsObs?.get() || {})
  
  return <div>{clients.length} clients</div> // Always up-to-date
})
```

## Debugging

### Debug Observable State

```typescript
// Log current state of an entity
const clientsObs = getEntity$('Client')
console.log('All clients:', clientsObs?.peek())
console.log('Client count:', Object.keys(clientsObs?.peek() || {}).length)
console.log('Specific client:', clientsObs?.['client-123']?.peek())
```

### Debug Sync Operations

```typescript
// Enable detailed logging
if (import.meta.env.DEV) {
  window.vibestackOrgContext = orgContext$
  window.vibestackEntityOps = entityOperations
  
  // Debug sync operations
  console.log('Current org context:', orgContext$.peek())
  console.log('Available entities:', Object.keys(entities$.peek() || {}))
}
```

### Using the Debug Route

Navigate to `/debug/entity-operations` to:
- Test observable access
- Create, read, update, delete records
- Test bulk operations
- Verify server synchronization
- Debug validation rules

## Best Practices

### Core Observable Patterns
1. **Always use `getEntity$()`** for accessing entity observables
2. **Use `observer()` components** for reactive UI updates  
3. **Use `peek()`** when you don't need reactivity (e.g., in event handlers)
4. **Always use `.get()` and `.set()` pattern** for data access and updates
5. **Never access individual record observables directly** - use data from `.get()`
6. **Let Legend State handle all API calls** - don't mix direct fetch calls
7. **Handle loading states** - check if observables exist before using
8. **Use batch operations** for multiple record operations
9. **Follow the single source of truth** - Legend State observables are authoritative
10. **Test with the debug tools** - use `/debug/entity-operations` for validation

### Enhanced Schema Patterns  
11. **Always use schema observables** for field metadata and configuration
12. **Leverage enhanced field metadata** for dynamic UI generation
13. **Use field capabilities** to determine UI behavior (sorting, filtering, editing)
14. **Handle calculated fields appropriately** - rollup fields are read-only with real-time updates
15. **Implement rollup calculations on frontend** using the provided metadata
16. **Validate schema integrity** in development to catch configuration issues
17. **Use accessibility metadata** for screen reader compliance and ARIA attributes
18. **Optimize UI based on field capabilities** - don't show sort options for non-sortable fields
19. **Cache schema data appropriately** - schema observables handle caching automatically
20. **Monitor schema changes** via WebSocket notifications for real-time updates

## Updated Core Pattern Summary

**✅ The Golden Rule: Always use `.get()` and `.set()`**
```typescript
// ✅ ALWAYS DO THIS:
const clientsObs = getEntity$('Client')
const allData = clientsObs.get()              // Get current data
const newData = { ...allData, [id]: updatedRecord }
clientsObs.set(newData)                       // Update observable

// ❌ NEVER DO THIS:
clientsObs[id] = updatedRecord                // ERROR!
clientsObs[id].field.set(value)              // ERROR!
await clientsObs.update(record)               // ERROR!
```

## Error Handling

```typescript
try {
  const clientsObs = getEntity$('Client')
  if (!clientsObs) {
    throw new Error('Client entity not available')
  }
  
  clientsObs[id].assign(updateData)
} catch (error) {
  console.error('Failed to update client:', error)
  // Handle error appropriately
}
```

Legend State will automatically handle network failures, retries, and sync conflicts. Your job is to handle application-level errors and provide good UX during loading states.