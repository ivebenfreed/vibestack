# Legend State Patterns - VibeStack

*This file provides guidance for using Legend State observables in the VibeStack application.*

## Overview

VibeStack uses Legend State with `syncedCrud` for reactive state management and automatic server synchronization. This document outlines the correct patterns and common pitfalls.

## Architecture

```
UI Components → Legend State Observables → syncedCrud → Server API → Database
     ↑                                                                    ↓
     └─────────────← Real-time Updates ←── WebSocket Notifications ←─────┘
```

## Core Patterns

### 1. Getting Entity Observables

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