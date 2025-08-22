# VibeStack Custom Sync Adapter Plan

## Overview
Create a custom Legend State sync adapter specifically for VibeStack that leverages our existing infrastructure and implements advanced patterns from the Supabase adapter.

## Core Architecture Principle
**The client is dumb** - it just:
1. Listens for WebSocket table change notifications
2. Refetches data using diff sync when notified
3. Applies optimistic updates locally
4. Retries failed operations

**The server handles everything complex**:
- RLS and permissions
- Organization context
- Data filtering
- Conflict resolution

## Current Infrastructure (Already Available)
1. **Diff syncing database columns** - Already have `created_at`, `updated_at`, and `deleted` columns
2. **RLS on server** - Server handles all permission checks, client just receives allowed data
3. **WebSocket table change notifications** - Already implemented and working
4. **Archetype-based API** - `/api/archetype/orgs/{orgId}/data/{entityName}`

## Key Patterns to Implement

### 1. Diff Syncing with `changesSince: 'last-sync'`
```typescript
// Track last sync timestamp per entity
const lastSyncTimes = new Map<string, number>()

// On list, only fetch changes since last sync
list: async () => {
  const lastSync = lastSyncTimes.get(entityName) || 0
  const res = await fetch(`/api/archetype/orgs/${orgId}/data/${entityName}?since=${lastSync}`)
  const data = await res.json()
  
  // Update last sync time with max updated_at
  if (data.length > 0) {
    const maxUpdatedAt = Math.max(...data.map(r => new Date(r.updated_at).getTime()))
    lastSyncTimes.set(entityName, maxUpdatedAt)
  }
  
  return data
}
```

### 2. Soft Deletes Support
```typescript
// Configure soft deletes
fieldDeleted: 'deleted',

// Delete action updates the deleted field instead of actual delete
delete: async (item) => {
  await fetch(`/api/archetype/orgs/${orgId}/data/${entityName}/${item.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ deleted: true })
  })
}
```

### 3. Optimistic Updates with Retry
```typescript
// Enable optimistic updates
updateLocal: true,

// Retry configuration for offline support
retry: {
  infinite: true,
  delay: 1000,
  backoff: 'exponential',
  maxDelay: 30000
},

// Queue changes when offline
onError: (error) => {
  if (!navigator.onLine) {
    console.log('Offline - changes queued for retry')
  }
}
```

### 4. Simple WebSocket Refetch Pattern
```typescript
// Just listen and refetch with diff sync - no complex logic
subscribe: (update) => {
  const handler = (e: CustomEvent) => {
    if (e.detail?.table === entityName.toLowerCase()) {
      // Simple: notification received = refetch data
      // The diff sync ensures we only get changes
      update()
    }
  }
  
  window.addEventListener('vibestack:table-change-notification', handler)
  return () => window.removeEventListener('vibestack:table-change-notification', handler)
}
```

### 5. Field Transformation
```typescript
// Transform between API and local formats
transform: {
  load: (apiData) => {
    // Convert snake_case to camelCase
    return apiData.map(item => ({
      ...item,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    }))
  },
  save: (localData) => {
    // Convert camelCase to snake_case
    return {
      ...localData,
      created_at: localData.createdAt,
      updated_at: localData.updatedAt,
    }
  }
}
```

### 6. Batch Operations
```typescript
// Support batch creates/updates
createMany: async (items) => {
  const res = await fetch(`/api/archetype/orgs/${orgId}/data/${entityName}/batch`, {
    method: 'POST',
    body: JSON.stringify({ items })
  })
  return res.json()
},

updateMany: async (items) => {
  const res = await fetch(`/api/archetype/orgs/${orgId}/data/${entityName}/batch`, {
    method: 'PATCH',
    body: JSON.stringify({ items })
  })
  return res.json()
}
```

## Implementation Plan

### Phase 1: Create syncedVibeStack Plugin
```typescript
// stores/sync/synced-vibestack.ts
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { configureSynced } from '@legendapp/state/sync'

export function syncedVibeStack(config: {
  orgId: string
  entityName: string
  changesSince?: 'last-sync' | false
  softDelete?: boolean
}) {
  const baseUrl = `/api/archetype/orgs/${config.orgId}/data/${config.entityName}`
  const lastSyncKey = `lastSync_${config.orgId}_${config.entityName}`
  
  return syncedCrud({
    list: async () => {
      let url = baseUrl
      
      // Simple diff sync - just add since parameter if we have a last sync time
      if (config.changesSince === 'last-sync') {
        const lastSync = localStorage.getItem(lastSyncKey)
        if (lastSync) {
          url += `?since=${lastSync}`
        }
      }
      
      const res = await fetch(url, { credentials: 'include' })
      const result = await res.json()
      const data = result.data || []
      
      // Update last sync time with max updated_at
      if (config.changesSince === 'last-sync' && data.length > 0) {
        const maxUpdatedAt = Math.max(...data.map(r => new Date(r.updated_at).getTime()))
        localStorage.setItem(lastSyncKey, maxUpdatedAt.toString())
      }
      
      return data
    },
    
    create: async (item) => {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      return res.json()
    },
    
    update: async (item) => {
      const res = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      return res.json()
    },
    
    delete: async (item) => {
      if (config.softDelete) {
        // Soft delete - just update the deleted field
        const res = await fetch(`${baseUrl}/${item.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ deleted: true })
        })
        return res.json()
      } else {
        // Hard delete
        await fetch(`${baseUrl}/${item.id}`, {
          method: 'DELETE',
          credentials: 'include'
        })
      }
    },
    
    // Simple WebSocket subscription - just refetch on notification
    subscribe: (update) => {
      const handler = (e: CustomEvent) => {
        if (e.detail?.table === entityName.toLowerCase()) {
          // Notification received = refetch (diff sync handles efficiency)
          update()
        }
      }
      window.addEventListener('vibestack:table-change-notification', handler)
      return () => window.removeEventListener('vibestack:table-change-notification', handler)
    },
    
    // Field configuration for soft deletes and timestamps
    fieldId: 'id',
    fieldCreatedAt: 'created_at',
    fieldUpdatedAt: 'updated_at',
    fieldDeleted: config.softDelete ? 'deleted' : undefined,
    
    // Persistence with IndexedDB
    persist: {
      name: 'entities',
      plugin: 'indexeddb',
      indexedDB: {
        itemID: `${config.orgId}_${config.entityName}`
      }
    },
    
    // Optimistic updates for instant UI feedback
    updateLocal: true,
    
    // Retry configuration for offline support
    retry: {
      infinite: true,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 30000
    }
  })
}
```

### Phase 2: Replace Current syncedCrud Usage
```typescript
// In entity$ function - much simpler!
const store = observable(
  syncedVibeStack({
    orgId,
    entityName,
    changesSince: 'last-sync',  // Enable diff syncing
    softDelete: true             // Enable soft deletes
  })
)
```

### Phase 3: Add Advanced Features
1. **Conflict Resolution** - Handle concurrent edits
2. **Partial Sync** - Sync only specific fields
3. **Pagination Support** - For large datasets
4. **Compression** - For bandwidth optimization
5. **Encryption** - For sensitive data

## Benefits Over Current Implementation

1. **Reduced Bandwidth** - Diff sync only fetches changes since last update
2. **Better Offline Support** - Infinite retry with exponential backoff
3. **Soft Deletes** - Better for audit trails and recovery
4. **Simpler Architecture** - Client just listens and refetches, server handles complexity
5. **Standardized Configuration** - Consistent across all entities
6. **No Client-Side RLS Logic** - Server handles all permissions

## Migration Path

1. Create the new `syncedVibeStack` adapter
2. Test with one entity (e.g., Projects)
3. Add diff syncing support to API endpoints
4. Gradually migrate all entities
5. Remove old `syncedCrud` implementation

## API Changes Needed

### 1. Support `since` parameter for diff syncing
```typescript
// GET /api/archetype/orgs/{orgId}/data/{entityName}?since=1234567890
// Returns only records where updated_at > since
```

### 2. Support batch operations
```typescript
// POST /api/archetype/orgs/{orgId}/data/{entityName}/batch
// Body: { items: [...] }
```

### 3. Support soft delete
```typescript
// PATCH /api/archetype/orgs/{orgId}/data/{entityName}/{id}
// Body: { deleted: true }
```

## Testing Strategy

1. **Unit Tests** - Test each sync operation
2. **Integration Tests** - Test with real API
3. **Offline Tests** - Test retry behavior
4. **Conflict Tests** - Test concurrent edits
5. **Performance Tests** - Measure bandwidth reduction

## Success Metrics

- [ ] 50%+ reduction in bandwidth usage
- [ ] Zero data loss during offline periods
- [ ] < 100ms optimistic update latency
- [ ] Automatic conflict resolution
- [ ] Full audit trail with soft deletes