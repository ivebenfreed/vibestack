# VibeStack Legend State Sync Adapter

## Overview

Creating a custom Legend State sync adapter for VibeStack that leverages the existing REST API and WebSocket infrastructure. This adapter will provide automatic bidirectional sync with local-first capabilities.

## Legend State Sync Observable Benefits

Unlike our manual POC approach, Legend State sync observables provide:

1. **Automatic CRUD operations** - No manual API calls needed
2. **Local-first architecture** - Offline capability with auto-sync when online
3. **Optimistic updates** - Instant UI updates with server reconciliation
4. **Retry mechanisms** - Built-in error handling and exponential backoff
5. **Fine-grained reactivity** - Only re-render components that use changed data
6. **TypeScript integration** - Full type safety throughout the sync process

## Custom VibeStack Adapter Design

### Core Adapter Structure

```typescript
// apps/web/src/sync/vibestack-adapter.ts
import { synced } from '@legendapp/state/sync'
import { createWebSocketService } from './websocket-service'

interface VibeStackSyncConfig {
  orgId: string
  entityName: string
  apiBaseUrl?: string
  wsUrl?: string
}

export function syncedVibeStack(config: VibeStackSyncConfig) {
  const { orgId, entityName, apiBaseUrl = '/api', wsUrl = '/ws' } = config
  const endpoint = `${apiBaseUrl}/archetype/orgs/${orgId}/data/${entityName}`
  
  return synced({
    // Initial data fetch
    get: async () => {
      const response = await fetch(endpoint, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })
      if (!response.ok) throw new Error(`Failed to fetch ${entityName}`)
      const result = await response.json()
      return result.data || []
    },

    // Save changes (create, update, delete)
    set: async ({ value, method, id }) => {
      let response: Response
      
      switch (method) {
        case 'create':
          response = await fetch(endpoint, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          })
          break
          
        case 'update':
          response = await fetch(`${endpoint}/${id}`, {
            method: 'PUT', 
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(value)
          })
          break
          
        case 'delete':
          response = await fetch(`${endpoint}/${id}`, {
            method: 'DELETE',
            credentials: 'include'
          })
          return null
          
        default:
          throw new Error(`Unknown method: ${method}`)
      }
      
      if (!response.ok) {
        throw new Error(`Failed to ${method} ${entityName}: ${response.status}`)
      }
      
      return response.json()
    },

    // Real-time updates via WebSocket
    subscribe: ({ refresh, update }) => {
      const ws = createWebSocketService({
        url: wsUrl,
        orgId,
        onMessage: (message) => {
          if (message.type === 'srv_table_change_notification') {
            const affectedTables = message.tables || []
            if (affectedTables.includes(entityName)) {
              // Option 1: Full refresh (simple)
              refresh()
              
              // Option 2: Granular updates (advanced)
              // update(message.changes)
            }
          }
        }
      })
      
      // Return cleanup function
      return () => ws.disconnect()
    },

    // Local persistence configuration
    persist: {
      name: `vibestack-${orgId}-${entityName}`,
      retrySync: true
    },

    // Retry configuration
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000 // 30 seconds max
    },

    // Initial value while loading
    initial: []
  })
}
```

### WebSocket Service

```typescript
// apps/web/src/sync/websocket-service.ts
interface WebSocketServiceConfig {
  url: string
  orgId: string
  onMessage: (message: any) => void
  reconnectDelay?: number
}

export function createWebSocketService(config: WebSocketServiceConfig) {
  const { url, orgId, onMessage, reconnectDelay = 1000 } = config
  let ws: WebSocket | null = null
  let reconnectTimeout: NodeJS.Timeout | null = null
  let isIntentionallyClosed = false

  function connect() {
    try {
      ws = new WebSocket(`${url}?orgId=${orgId}`)
      
      ws.onopen = () => {
        console.log('✅ VibeStack WebSocket connected')
        // Reset reconnect delay on successful connection
      }
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          onMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
      
      ws.onclose = () => {
        if (!isIntentionallyClosed) {
          console.log('🔄 VibeStack WebSocket disconnected, reconnecting...')
          reconnectTimeout = setTimeout(connect, reconnectDelay)
        }
      }
      
      ws.onerror = (error) => {
        console.error('❌ VibeStack WebSocket error:', error)
      }
    } catch (error) {
      console.error('Failed to create WebSocket:', error)
      if (!isIntentionallyClosed) {
        reconnectTimeout = setTimeout(connect, reconnectDelay)
      }
    }
  }

  function disconnect() {
    isIntentionallyClosed = true
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
      reconnectTimeout = null
    }
    if (ws) {
      ws.close()
      ws = null
    }
  }

  // Start connection
  connect()

  return { disconnect }
}
```

## Usage Examples

### Basic Entity Sync

```typescript
// apps/web/src/stores/projects-store.ts
import { observable } from '@legendapp/state'
import { syncedVibeStack } from '../sync/vibestack-adapter'

export const projects$ = observable(
  syncedVibeStack({
    orgId: '01920000-1000-7000-8000-000000000001',
    entityName: 'Project'
  })
)

// That's it! The observable automatically:
// - Fetches projects on first access
// - Saves changes to server
// - Updates from WebSocket notifications
// - Handles errors with retry
// - Persists locally for offline use
```

### Component Usage

```typescript
// apps/web/src/components/ProjectList.tsx
import { projects$ } from '../stores/projects-store'
import { useObservable } from '@legendapp/state/react'

export function ProjectList() {
  const projects = useObservable(projects$)
  
  const handleCreateProject = () => {
    // Optimistic update - UI updates immediately
    projects$.push({
      name: 'New Project',
      status: 'planning',
      // ... other fields
    })
    // Legend State automatically sends to server
  }
  
  const handleUpdateProject = (id: string, updates: any) => {
    // Find and update - automatic server sync
    const project = projects$.find(p => p.id.get() === id)
    project.assign(updates)
  }
  
  const handleDeleteProject = (id: string) => {
    // Remove from array - automatic server deletion
    const index = projects$.findIndex(p => p.id.get() === id)
    projects$.splice(index, 1)
  }
  
  return (
    <div>
      {projects.map(project => (
        <ProjectCard 
          key={project.id}
          project={project}
          onUpdate={handleUpdateProject}
          onDelete={handleDeleteProject}
        />
      ))}
      <button onClick={handleCreateProject}>
        Add Project
      </button>
    </div>
  )
}
```

### Multi-Entity Store

```typescript
// apps/web/src/stores/vibestack-data.ts
export const vibestackData = {
  projects: observable(syncedVibeStack({ 
    orgId: ORG_ID, 
    entityName: 'Project' 
  })),
  
  clients: observable(syncedVibeStack({ 
    orgId: ORG_ID, 
    entityName: 'Client' 
  })),
  
  tasks: observable(syncedVibeStack({ 
    orgId: ORG_ID, 
    entityName: 'Task' 
  })),
  
  // ... other entities
}

// Usage in components:
// const projects = useObservable(vibestackData.projects)
// const clients = useObservable(vibestackData.clients)
```

## Advanced Features

### Filtered Sync

```typescript
// Only sync active projects
const activeProjects$ = observable(
  syncedVibeStack({
    orgId: ORG_ID,
    entityName: 'Project',
    filter: { status: 'active' } // Add to API call
  })
)
```

### Relationship Handling

```typescript
// Project with related tasks
const projectWithTasks$ = observable(
  syncedVibeStack({
    orgId: ORG_ID,
    entityName: 'Project',
    include: ['tasks'] // Server-side join
  })
)
```

### Sync State Monitoring

```typescript
import { syncState } from '@legendapp/state/sync'

function ProjectLoader() {
  const state = useObservable(syncState(projects$))
  
  if (state.isLoading) return <LoadingSpinner />
  if (state.error) return <ErrorMessage error={state.error} />
  
  return <ProjectList />
}
```

## Migration Benefits

### From Current Complex Sync
- **~15,000 lines removed** - No more manual sync logic
- **Automatic optimistic updates** - No more manual UI state management
- **Built-in retry/error handling** - No more custom retry logic
- **Local-first by default** - Offline capability out of the box
- **Type-safe throughout** - Full TypeScript integration

### Developer Experience
- **Single source of truth** - Observable is both local and remote state
- **Declarative updates** - Just modify the observable, sync happens automatically
- **Fine-grained reactivity** - Only affected components re-render
- **Standard patterns** - Legend State is battle-tested in production apps

## Implementation Plan

### Phase 1: Create Adapter Infrastructure
1. Implement `syncedVibeStack()` adapter function
2. Create `WebSocketService` for real-time notifications
3. Add TypeScript types for all entities

### Phase 2: Replace Simple Components
1. Convert dashboard components to use sync observables
2. Replace manual API calls with observable operations
3. Remove manual state management code

### Phase 3: Advanced Integration  
1. Handle complex relationships and filtering
2. Add optimizations for large datasets
3. Integrate with existing auth and routing

### Phase 4: Remove Legacy Sync
1. Remove all manual sync infrastructure
2. Clean up unused WebSocket message types
3. Simplify server-side sync endpoints

This approach provides the simplicity we want with the power of professional-grade sync infrastructure.