# Legend State Central Store Implementation Guide

## Overview

This guide provides concrete implementation details for migrating from the manual `orgData$` store to a proper Legend State architecture.

## Core Principles

### ✅ DO
- Use Legend State's built-in sync mechanisms
- Let observables handle reactivity automatically
- Use computed observables for derived state
- Leverage IndexedDB persistence
- Trust Legend State's conflict resolution

### ❌ DON'T
- Create manual data containers
- Write custom fetch logic
- Handle WebSocket updates manually
- Track loading states manually
- Implement custom caching

## Implementation Details

### 1. Central Store Structure

```typescript
// stores/vibestack-legend-store.ts

import { observable, computed, observe, batch } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { configureSynced, synced } from '@legendapp/state/sync'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { enableLegendStateReact } from '@legendapp/state/react'

// Global configuration
configureSynced({
  mode: 'merge', // Merge remote changes with local
  persist: {
    plugin: ObservablePersistIndexedDB,
    retrySync: true,
  },
  retry: {
    times: 3,
    delay: 1000,
    backoff: 'exponential'
  },
  debounce: {
    wait: 500,
    save: 1000,
  },
})

// Core organization context
export const orgContext$ = observable({
  orgId: null as string | null,
  userId: null as string | null,
  schema: null as OrgSchema | null,
})

// Entity store registry
const entityStores = new Map<string, Observable>()

// Get or create entity store
export function entity$(entityName: string) {
  if (!entityStores.has(entityName)) {
    const orgId = orgContext$.orgId.get()
    if (!orgId) throw new Error('No organization context')
    
    const store = observable(syncedCrud({
      // CRUD configuration
      list: async () => {
        const res = await fetch(`/api/orgs/${orgId}/data/${entityName}`, {
          credentials: 'include'
        })
        const data = await res.json()
        return data.items || []
      },
      
      create: async (item) => {
        const res = await fetch(`/api/orgs/${orgId}/data/${entityName}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item)
        })
        return res.json()
      },
      
      update: async (item) => {
        const res = await fetch(`/api/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(item)
        })
        return res.json()
      },
      
      delete: async (item) => {
        await fetch(`/api/orgs/${orgId}/data/${entityName}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      },
      
      // Persistence
      persist: {
        name: `vibestack_${orgId}_${entityName}`,
        plugin: ObservablePersistIndexedDB,
      },
      
      // Sync behavior
      mode: 'merge',
      updateLocal: true, // Optimistic updates
      
      // WebSocket sync
      subscribe: (update) => {
        const handler = (e: CustomEvent) => {
          if (e.detail.table === entityName) {
            update() // Trigger resync
          }
        }
        window.addEventListener('table-change', handler)
        return () => window.removeEventListener('table-change', handler)
      },
    }))
    
    entityStores.set(entityName, store)
  }
  
  return entityStores.get(entityName)!
}

// Computed observables for common patterns
export const sidebar$ = computed(() => {
  const schema = orgContext$.schema.get()
  if (!schema?.entities) return []
  
  return Object.keys(schema.entities).map(name => ({
    name,
    path: `/entities/${name}`,
    icon: 'Database',
    count: computed(() => entity$(name).length.get())
  }))
})

// Clear all stores (for org switching)
export function clearAllStores() {
  batch(() => {
    entityStores.forEach(store => store.clear())
    entityStores.clear()
    orgContext$.set({
      orgId: null,
      userId: null,
      schema: null,
    })
  })
}
```

### 2. WebSocket Integration

```typescript
// sync/legend-websocket-sync.ts

import { entity$ } from '@/stores/vibestack-legend-store'

class LegendWebSocketSync {
  private ws: WebSocket | null = null
  
  connect(orgId: string, userId: string) {
    const url = `ws://localhost:8787/api/org-actor/${orgId}/websocket`
    this.ws = new WebSocket(url)
    
    this.ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      
      if (message.type === 'table_change') {
        // Legend State handles the sync
        const store$ = entity$(message.table)
        
        switch (message.operation) {
          case 'INSERT':
          case 'UPDATE':
            // Trigger resync - Legend State handles everything
            store$.sync()
            break
            
          case 'DELETE':
            // Remove from store
            const items = store$.get()
            const filtered = items.filter(i => i.id !== message.id)
            store$.set(filtered)
            break
        }
      }
    }
  }
  
  disconnect() {
    this.ws?.close()
    this.ws = null
  }
}

export const wsSync = new LegendWebSocketSync()
```

### 3. React Component Patterns

```typescript
// components/DashboardWithLegend.tsx

import { observer } from '@legendapp/state/react'
import { entity$, sidebar$ } from '@/stores/vibestack-legend-store'

// Components are automatically reactive
export const Dashboard = observer(function Dashboard() {
  // Get reactive sidebar items with counts
  const sidebarItems = sidebar$.get()
  
  return (
    <div className="grid grid-cols-3 gap-4">
      {sidebarItems.map(item => (
        <EntityCard 
          key={item.name}
          name={item.name}
          count={item.count.get()} // Reactive count
        />
      ))}
    </div>
  )
})

// Entity page with automatic data
export const EntityPage = observer(function EntityPage({ entityName }) {
  const items$ = entity$(entityName)
  const items = items$.get() // Already loaded from cache/IndexedDB!
  
  // Optimistic create
  const handleCreate = (data) => {
    items$.push(data) // Instant UI update
    // Legend State syncs in background
  }
  
  // Optimistic update
  const handleUpdate = (index, updates) => {
    items$[index].assign(updates) // Instant update
    // Syncs automatically
  }
  
  // Optimistic delete
  const handleDelete = (index) => {
    items$.splice(index, 1) // Instant removal
    // Syncs automatically
  }
  
  return (
    <div>
      {items.map((item, i) => (
        <EntityRow 
          key={item.id}
          item={item}
          onUpdate={(updates) => handleUpdate(i, updates)}
          onDelete={() => handleDelete(i)}
        />
      ))}
    </div>
  )
})

// Fine-grained reactivity
export const EntityCount = observer(function EntityCount({ entityName }) {
  const count$ = entity$(entityName).length
  
  // Only re-renders when count changes
  return <span>{count$.get()}</span>
})
```

### 4. Organization Switching

```typescript
// features/org-switcher-legend.ts

import { batch } from '@legendapp/state'
import { orgContext$, clearAllStores, entity$ } from '@/stores/vibestack-legend-store'
import { wsSync } from '@/sync/legend-websocket-sync'

export async function switchOrganization(orgId: string, userId: string) {
  // Clear previous org data
  clearAllStores()
  wsSync.disconnect()
  
  // Load new org schema
  const schema = await loadOrgSchema(orgId)
  
  // Update context
  batch(() => {
    orgContext$.assign({
      orgId,
      userId,
      schema
    })
  })
  
  // Connect WebSocket for new org
  wsSync.connect(orgId, userId)
  
  // Preload common entities (happens in background)
  if (schema.entities) {
    Object.keys(schema.entities).forEach(entityName => {
      // Just accessing the store triggers load from IndexedDB or API
      entity$(entityName)
    })
  }
}
```

### 5. Offline Support

```typescript
// Configuration for offline-first behavior
configureSynced({
  persist: {
    plugin: ObservablePersistIndexedDB,
    retrySync: true, // Retry when back online
  },
  retry: {
    infinite: true, // Keep trying forever
    delay: 1000,
    backoff: 'exponential',
    maxDelay: 30000,
  },
  onError: (error) => {
    if (!navigator.onLine) {
      // Queue for later
      console.log('Offline - changes queued')
    } else {
      console.error('Sync error:', error)
    }
  }
})

// Monitor online status
window.addEventListener('online', () => {
  // Legend State automatically retries all queued changes
  console.log('Back online - syncing changes')
})
```

### 6. Testing Strategy

```typescript
// tests/legend-state-integration.test.ts

import { observable } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'

describe('Legend State Integration', () => {
  it('should handle optimistic updates', async () => {
    const store$ = observable(syncedCrud({
      list: async () => mockData,
      update: async (item) => {
        // Simulate network delay
        await sleep(100)
        return item
      },
      updateLocal: true, // Optimistic
    }))
    
    // Update happens immediately
    store$[0].name.set('New Name')
    expect(store$[0].name.get()).toBe('New Name')
    
    // Sync happens in background
    await waitFor(() => {
      expect(mockApi.update).toHaveBeenCalled()
    })
  })
  
  it('should persist to IndexedDB', async () => {
    const store$ = observable(syncedCrud({
      persist: {
        name: 'test-store',
        plugin: ObservablePersistIndexedDB
      }
    }))
    
    store$.push({ id: 1, name: 'Test' })
    
    // Data persisted immediately
    const db = await openDB('test-store')
    expect(db.get(1)).toEqual({ id: 1, name: 'Test' })
  })
})
```

## Migration Checklist

### Phase 1: Setup (Day 1-2)
- [ ] Install Legend State v3 dependencies
- [ ] Create central store file
- [ ] Configure sync defaults
- [ ] Set up IndexedDB persistence
- [ ] Create entity store factory

### Phase 2: Core Features (Day 3-5)
- [ ] Implement WebSocket sync
- [ ] Create computed observables for sidebar
- [ ] Add organization switching logic
- [ ] Set up offline queue
- [ ] Implement optimistic updates

### Phase 3: Component Migration (Day 6-10)
- [ ] Convert Dashboard to observer
- [ ] Migrate entity pages
- [ ] Update sidebar component
- [ ] Convert entity creation dialog
- [ ] Remove orgData$ usage

### Phase 4: Testing & Cleanup (Day 11-14)
- [ ] Write integration tests
- [ ] Test offline behavior
- [ ] Test optimistic updates
- [ ] Remove old store files
- [ ] Update documentation

## Common Patterns

### Loading States
```typescript
// Legend State handles loading automatically
const items$ = entity$('Project')

// Built-in loading state
if (items$.isLoading.get()) {
  return <Spinner />
}

// Data is already available (from cache or API)
return <ProjectList items={items$.get()} />
```

### Error Handling
```typescript
// Global error handler
configureSynced({
  onError: (error, retry) => {
    if (error.code === 401) {
      // Re-authenticate
      auth.refresh()
    } else if (error.code >= 500) {
      // Server error - retry
      retry()
    } else {
      // Show error to user
      toast.error(error.message)
    }
  }
})
```

### Batch Operations
```typescript
// Batch multiple updates
batch(() => {
  projects$.forEach(p => {
    if (p.status.get() === 'old') {
      p.status.set('archived')
    }
  })
})
// Single sync for all changes
```

## Performance Optimizations

### 1. Lazy Loading
```typescript
// Only load when accessed
const projects$ = computed(() => 
  activeTab$.get() === 'projects' 
    ? entity$('Project') 
    : []
)
```

### 2. Selective Sync
```typescript
// Only sync specific fields
syncedCrud({
  list: {
    fields: ['id', 'name', 'status'], // Don't fetch heavy fields
  }
})
```

### 3. Virtual Scrolling
```typescript
// Use with virtualized lists
const visibleItems$ = computed(() => {
  const all = entity$('LargeTable').get()
  const { start, end } = viewport$.get()
  return all.slice(start, end)
})
```

## Troubleshooting

### Issue: Changes not syncing
**Solution**: Check WebSocket connection and retry configuration

### Issue: Stale data after refresh
**Solution**: Verify IndexedDB persistence is configured

### Issue: Optimistic updates reverting
**Solution**: Ensure `updateLocal: true` is set

### Issue: Memory leaks
**Solution**: Clear stores on unmount/logout

## Conclusion

This implementation guide provides a complete roadmap for migrating to a proper Legend State architecture. The key is to **trust the framework** and let Legend State handle the complexity internally rather than recreating its features manually.