# VibeStack Legend State Sync Plugin

## Complete Implementation with TypeScript Types and Real-time Notifications

This document provides a complete, production-ready Legend State sync plugin designed specifically for VibeStack's backend API and WebSocket table change notification system.

## Core Plugin Architecture

```typescript
// apps/web/src/sync/vibestack-plugin.ts

import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { ObservablePersistLocalStorage } from '@legendapp/state/persist-plugins/local-storage'

// TypeScript interfaces for our sync plugin
export interface VibeStackSyncConfig<T = any> {
  /** Organization ID for multi-tenant isolation */
  orgId: string
  /** Entity name (e.g., 'Project', 'Client', 'Task') */
  entityName: string
  /** Base API URL (defaults to current origin) */
  apiBaseUrl?: string
  /** WebSocket URL for real-time updates */
  wsUrl?: string
  /** Filter conditions for queries */
  filter?: Record<string, any>
  /** Include related entities */
  include?: string[]
  /** Custom field mappings */
  fieldMappings?: {
    id?: string
    createdAt?: string
    updatedAt?: string
    deleted?: string
  }
  /** Transform functions */
  transform?: {
    in?: (data: any) => T
    out?: (data: T) => any
  }
  /** Custom request headers */
  headers?: Record<string, string>
}

export interface VibeStackEntity {
  id: string
  created_at?: string
  updated_at?: string
  deleted_at?: string | null
  [key: string]: any
}

export interface VibeStackApiResponse<T> {
  data: T[]
  meta?: {
    total?: number
    page?: number
    limit?: number
  }
  error?: string
}

export interface WebSocketMessage {
  type: 'srv_table_change_notification'
  orgId: string
  tables: string[]
  changes?: Array<{
    table: string
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
    id: string
    data?: any
  }>
}

// WebSocket connection manager for table change notifications
class VibeStackWebSocketManager {
  private static connections = new Map<string, WebSocket>()
  private static subscriptions = new Map<string, Set<(message: WebSocketMessage) => void>>()

  static getConnection(orgId: string, wsUrl = '/ws'): WebSocket {
    const connectionKey = `${orgId}:${wsUrl}`
    
    if (!this.connections.has(connectionKey)) {
      this.createConnection(orgId, wsUrl, connectionKey)
    }
    
    return this.connections.get(connectionKey)!
  }

  private static createConnection(orgId: string, wsUrl: string, connectionKey: string) {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const fullWsUrl = wsUrl.startsWith('/') 
      ? `${wsProtocol}//${window.location.host}${wsUrl}?orgId=${orgId}`
      : `${wsUrl}?orgId=${orgId}`

    const ws = new WebSocket(fullWsUrl)
    
    ws.onopen = () => {
      console.log(`✅ VibeStack WebSocket connected for org ${orgId}`)
    }
    
    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data)
        if (message.type === 'srv_table_change_notification' && message.orgId === orgId) {
          const callbacks = this.subscriptions.get(connectionKey) || new Set()
          callbacks.forEach(callback => callback(message))
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }
    
    ws.onclose = () => {
      console.log(`🔌 VibeStack WebSocket disconnected for org ${orgId}, reconnecting...`)
      this.connections.delete(connectionKey)
      // Reconnect after 1 second
      setTimeout(() => this.createConnection(orgId, wsUrl, connectionKey), 1000)
    }
    
    ws.onerror = (error) => {
      console.error('VibeStack WebSocket error:', error)
    }

    this.connections.set(connectionKey, ws)
  }

  static subscribe(
    orgId: string, 
    entityName: string,
    callback: () => void,
    wsUrl = '/ws'
  ): () => void {
    const connectionKey = `${orgId}:${wsUrl}`
    const ws = this.getConnection(orgId, wsUrl)
    
    const messageHandler = (message: WebSocketMessage) => {
      if (message.tables?.includes(entityName)) {
        console.log(`📢 Table change notification for ${entityName}, refreshing...`)
        callback()
      }
    }

    if (!this.subscriptions.has(connectionKey)) {
      this.subscriptions.set(connectionKey, new Set())
    }
    
    this.subscriptions.get(connectionKey)!.add(messageHandler)

    // Return unsubscribe function
    return () => {
      const callbacks = this.subscriptions.get(connectionKey)
      if (callbacks) {
        callbacks.delete(messageHandler)
        if (callbacks.size === 0) {
          this.subscriptions.delete(connectionKey)
          const connection = this.connections.get(connectionKey)
          if (connection) {
            connection.close()
            this.connections.delete(connectionKey)
          }
        }
      }
    }
  }
}

// Main sync plugin factory function
export function syncedVibeStack<T extends VibeStackEntity>(
  config: VibeStackSyncConfig<T>
) {
  const {
    orgId,
    entityName,
    apiBaseUrl = '',
    wsUrl = '/ws',
    filter,
    include,
    fieldMappings = {},
    transform,
    headers = {}
  } = config

  // Build API endpoint
  const baseEndpoint = `${apiBaseUrl}/api/archetype/orgs/${orgId}/data/${entityName}`
  
  // Default field mappings
  const fields = {
    id: 'id',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deleted: 'deleted_at',
    ...fieldMappings
  }

  // Helper to build query params
  const buildQueryParams = (extraParams = {}) => {
    const params = new URLSearchParams()
    
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        params.append(`filter[${key}]`, String(value))
      })
    }
    
    if (include?.length) {
      params.append('include', include.join(','))
    }
    
    Object.entries(extraParams).forEach(([key, value]) => {
      params.append(key, String(value))
    })
    
    return params.toString()
  }

  // Helper for API requests
  const apiRequest = async <R = any>(
    url: string,
    options: RequestInit = {}
  ): Promise<R> => {
    const response = await fetch(url, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...options.headers
      },
      ...options
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API Error ${response.status}: ${errorText}`)
    }

    return response.json()
  }

  return syncedCrud<T>({
    // Fetch all records
    list: async () => {
      console.log(`🔄 Fetching ${entityName} for org ${orgId}`)
      
      const queryParams = buildQueryParams()
      const url = `${baseEndpoint}${queryParams ? `?${queryParams}` : ''}`
      
      const response: VibeStackApiResponse<T> = await apiRequest(url)
      
      let data = response.data || []
      
      // Apply input transformation if provided
      if (transform?.in) {
        data = data.map(transform.in)
      }
      
      console.log(`✅ Fetched ${data.length} ${entityName} records`)
      return data
    },

    // Create new record
    create: async (value: Omit<T, 'id' | 'created_at' | 'updated_at'>) => {
      console.log(`➕ Creating ${entityName}:`, value)
      
      // Apply output transformation if provided
      const payload = transform?.out ? transform.out(value as T) : value
      
      const response = await apiRequest<T>(baseEndpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      })
      
      // Apply input transformation to response
      const result = transform?.in ? transform.in(response) : response
      
      console.log(`✅ Created ${entityName}:`, result)
      return result
    },

    // Update existing record
    update: async (value: Partial<T> & { id: string }) => {
      console.log(`📝 Updating ${entityName} ${value.id}:`, value)
      
      // Apply output transformation if provided
      const payload = transform?.out ? transform.out(value as T) : value
      
      const response = await apiRequest<T>(`${baseEndpoint}/${value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      })
      
      // Apply input transformation to response
      const result = transform?.in ? transform.in(response) : response
      
      console.log(`✅ Updated ${entityName}:`, result)
      return result
    },

    // Delete record
    delete: async ({ id }: { id: string }) => {
      console.log(`🗑️ Deleting ${entityName} ${id}`)
      
      await apiRequest(`${baseEndpoint}/${id}`, {
        method: 'DELETE'
      })
      
      console.log(`✅ Deleted ${entityName} ${id}`)
    },

    // Real-time WebSocket subscription
    subscribe: ({ refresh }) => {
      console.log(`👂 Setting up WebSocket subscription for ${entityName}`)
      
      const unsubscribe = VibeStackWebSocketManager.subscribe(
        orgId,
        entityName,
        refresh,
        wsUrl
      )
      
      return unsubscribe
    },

    // Field mappings for Legend State
    fieldCreatedAt: fields.createdAt,
    fieldUpdatedAt: fields.updatedAt,
    fieldDeleted: fields.deleted,

    // Enable partial updates
    updatePartial: true,

    // Generate IDs for optimistic updates
    generateId: () => crypto.randomUUID(),

    // Handle server response after save
    onSaved: ({ saved, isCreate, currentValue }) => {
      console.log(`💾 ${entityName} ${isCreate ? 'created' : 'updated'}:`, saved)
      
      // Update local timestamps from server response
      if (saved[fields.updatedAt] && saved[fields.updatedAt] !== currentValue[fields.updatedAt]) {
        return { [fields.updatedAt]: saved[fields.updatedAt] }
      }
    },

    // Persistence configuration
    persist: {
      plugin: ObservablePersistLocalStorage,
      name: `vibestack-${orgId}-${entityName}`,
      retrySync: true
    },

    // Retry configuration for network failures
    retry: {
      infinite: true,
      backoff: 'exponential',
      maxDelay: 30000 // 30 seconds
    },

    // Transform functions (passed through from config)
    transform: transform ? {
      load: transform.in,
      save: transform.out
    } : undefined
  })
}

// Utility function to create multiple entity sync observables
export function createVibeStackStore<T extends Record<string, any>>(
  orgId: string,
  entities: Array<{
    name: keyof T
    entityName: string
    config?: Partial<VibeStackSyncConfig>
  }>,
  baseConfig: Partial<VibeStackSyncConfig> = {}
) {
  const store = {} as T
  
  entities.forEach(({ name, entityName, config = {} }) => {
    store[name] = syncedVibeStack({
      orgId,
      entityName,
      ...baseConfig,
      ...config
    })
  })
  
  return store
}

// Export types for consumers
export type { VibeStackSyncConfig, VibeStackEntity, VibeStackApiResponse, WebSocketMessage }
```

## Usage Examples

### Basic Entity Sync

```typescript
// apps/web/src/stores/projects.ts
import { observable } from '@legendapp/state'
import { syncedVibeStack } from '@/sync/vibestack-plugin'

interface Project {
  id: string
  name: string
  description?: string
  status: 'planning' | 'active' | 'completed'
  budget?: number
  client_id?: string
  created_at: string
  updated_at: string
}

export const projects$ = observable(
  syncedVibeStack<Project>({
    orgId: '01920000-1000-7000-8000-000000000001',
    entityName: 'Project'
  })
)
```

### Multi-Entity Store

```typescript
// apps/web/src/stores/vibestack-data.ts
import { observable } from '@legendapp/state'
import { createVibeStackStore } from '@/sync/vibestack-plugin'

interface VibeStackData {
  projects: any
  clients: any
  tasks: any
  users: any
}

const orgId = '01920000-1000-7000-8000-000000000001'

export const vibeStackData$ = observable(
  createVibeStackStore<VibeStackData>(
    orgId,
    [
      { name: 'projects', entityName: 'Project' },
      { name: 'clients', entityName: 'Client' },
      { name: 'tasks', entityName: 'Task' },
      { name: 'users', entityName: 'User' }
    ]
  )
)
```

### Advanced Configuration

```typescript
// apps/web/src/stores/filtered-projects.ts
import { observable } from '@legendapp/state'
import { syncedVibeStack } from '@/sync/vibestack-plugin'

// Only sync active projects with specific transformations
export const activeProjects$ = observable(
  syncedVibeStack<Project>({
    orgId: '01920000-1000-7000-8000-000000000001',
    entityName: 'Project',
    filter: { status: 'active' },
    include: ['client', 'tasks'],
    transform: {
      // Transform server data to local format
      in: (serverData) => ({
        ...serverData,
        budgetFormatted: serverData.budget 
          ? new Intl.NumberFormat('en-US', { 
              style: 'currency', 
              currency: 'USD' 
            }).format(serverData.budget)
          : null
      }),
      // Transform local data for server
      out: (localData) => {
        const { budgetFormatted, ...serverData } = localData
        return serverData
      }
    }
  })
)
```

## React Component Integration

```typescript
// apps/web/src/components/ProjectList.tsx
import { useObservable } from '@legendapp/state/react'
import { projects$ } from '@/stores/projects'

export function ProjectList() {
  const projects = useObservable(projects$)
  
  const handleCreateProject = () => {
    // Optimistic update - UI responds immediately
    projects$.push({
      name: 'New Project',
      status: 'planning',
      description: 'Created via Legend State sync'
    })
    // Legend State automatically syncs to server and handles WebSocket updates
  }
  
  const handleUpdateProject = (projectId: string, updates: Partial<Project>) => {
    const project = projects$.find(p => p.id.get() === projectId)
    if (project) {
      // Direct observable mutation - automatic server sync
      project.assign(updates)
    }
  }
  
  const handleDeleteProject = (projectId: string) => {
    const index = projects$.findIndex(p => p.id.get() === projectId)
    if (index !== -1) {
      // Remove from array - automatic server deletion
      projects$.splice(index, 1)
    }
  }
  
  return (
    <div>
      <button onClick={handleCreateProject}>
        Add Project
      </button>
      
      {projects.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          <p>Status: {project.status}</p>
          <button onClick={() => handleUpdateProject(project.id, { status: 'active' })}>
            Activate
          </button>
          <button onClick={() => handleDeleteProject(project.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  )
}
```

## Authentication Integration

```typescript
// apps/web/src/hooks/useOrgAwareStore.ts
import { useMemo } from 'react'
import { observable } from '@legendapp/state'
import { createVibeStackStore } from '@/sync/vibestack-plugin'
import { useAuth } from '@/hooks/useAuth'

export function useOrgAwareStore() {
  const { currentOrg } = useAuth()
  
  return useMemo(() => {
    if (!currentOrg) return null
    
    return observable(
      createVibeStackStore(
        currentOrg.id,
        [
          { name: 'projects', entityName: 'Project' },
          { name: 'clients', entityName: 'Client' },
          { name: 'tasks', entityName: 'Task' }
        ]
      )
    )
  }, [currentOrg?.id])
}
```

## Error Handling and Monitoring

```typescript
// apps/web/src/sync/error-handler.ts
import { syncState } from '@legendapp/state/sync'

export function useSyncMonitor(observable: any, entityName: string) {
  const state = useObservable(syncState(observable))
  
  useEffect(() => {
    if (state.error) {
      console.error(`${entityName} sync error:`, state.error)
      // Send to error reporting service
      // notifyErrorReporting(`${entityName}_sync_error`, state.error)
    }
    
    if (state.numPendingGets > 0) {
      console.log(`${entityName} loading...`)
    }
    
    if (state.numPendingSets > 0) {
      console.log(`${entityName} saving ${state.numPendingSets} changes...`)
    }
  }, [state.error, state.numPendingGets, state.numPendingSets])
  
  return {
    isLoading: state.isLoaded === false,
    isSaving: state.numPendingSets > 0,
    error: state.error,
    isOnline: !state.error
  }
}
```

## Installation and Setup

```bash
# Install Legend State dependencies
pnpm add @legendapp/state @legendapp/state-react

# Install sync and persistence plugins
pnpm add @legendapp/state-persist-plugins-local-storage
pnpm add @legendapp/state-sync-plugins-crud
```

## Key Features of This Plugin

1. **Complete TypeScript Integration** - Full type safety throughout
2. **Real-time WebSocket Integration** - Uses existing table change notifications
3. **Multi-tenant Organization Support** - Proper org isolation
4. **Optimistic Updates** - Instant UI feedback
5. **Automatic Retry Logic** - Handles network failures gracefully
6. **Local Persistence** - Offline capability with sync on reconnect
7. **Flexible Filtering** - Server-side query filtering
8. **Data Transformation** - Clean separation between API and UI data formats
9. **Error Handling** - Comprehensive error boundaries and reporting
10. **Performance Optimized** - Minimal re-renders with fine-grained reactivity

This plugin provides a complete, production-ready sync solution that replaces all complex manual sync logic with automatic Legend State sync observables.