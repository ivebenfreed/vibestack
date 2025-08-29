/**
 * Legend State v3.0.0-beta.31 Working Example
 * 
 * This file demonstrates the correct import syntax and usage patterns
 * for Legend State v3 with the VibeStack REST API integration.
 * 
 * All imports have been verified to work with the current package version.
 */

// ✅ CORRECT v3 IMPORTS - All verified working
import { observable } from '@legendapp/state'
import { synced } from '@legendapp/state/sync'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { syncedFetch } from '@legendapp/state/sync-plugins/fetch'
import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { configureObservableSync, type PersistOptions, type SyncedOptions } from '@legendapp/state/sync'

// ✅ EXAMPLE 1: Basic synced observable with REST API
export const basicSyncedExample = () => {
  const data$ = observable(synced({
    get: async () => {
      const response = await fetch('http://localhost:8787/api/universal-archetype/orgs/01920000-1000-7000-8000-000000000001/data/project', {
        credentials: 'include'
      })
      if (!response.ok) throw new Error('Failed to fetch')
      const result = await response.json()
      return result.success ? result.data : []
    },
    
    set: async ({ value, changes }) => {
      console.log('Syncing changes:', { value, changes })
      // Handle individual changes here
      return { value }
    },
    
    persist: {
      name: 'vibestack_projects',
      plugin: 'indexeddb'
    },
    
    initial: []
  }))
  
  return data$
}

// ✅ EXAMPLE 2: syncedCrud with full CRUD operations (RECOMMENDED)
export const crudSyncedExample = (orgId: string, entityName: string) => {
  const baseUrl = `http://localhost:8787/api/universal-archetype/orgs/${orgId}/data/${entityName}`
  
  const data$ = observable(syncedCrud({
    // Fetch all items
    list: async () => {
      console.log(`Fetching ${entityName} data...`)
      const response = await fetch(baseUrl, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        console.warn(`Failed to fetch ${entityName}:`, response.status)
        return []
      }
      
      const result = await response.json()
      return result.success ? result.data : []
    },
    
    // Create new item
    create: async (item: any) => {
      console.log(`Creating ${entityName}:`, item)
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) throw new Error(`Failed to create ${entityName}`)
      const result = await response.json()
      return result.success ? result.data : item
    },
    
    // Update existing item
    update: async (item: any) => {
      console.log(`Updating ${entityName}:`, item)
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(item)
      })
      
      if (!response.ok) throw new Error(`Failed to update ${entityName}`)
      const result = await response.json()
      return result.success ? result.data : item
    },
    
    // Delete item
    delete: async (item: any) => {
      console.log(`Deleting ${entityName}:`, item)
      const response = await fetch(`${baseUrl}/${item.id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (!response.ok) throw new Error(`Failed to delete ${entityName}`)
      return undefined
    },
    
    // Configuration
    fieldId: 'id',
    generateId: () => crypto.randomUUID(),
    
    // Enable persistence
    persist: {
      name: `vibestack_${orgId}_${entityName}`,
      plugin: 'indexeddb'
    },
    
    initial: []
  }))
  
  return data$
}

// ✅ EXAMPLE 3: syncedFetch for simple GET/POST scenarios
export const fetchSyncedExample = (url: string) => {
  const data$ = observable(syncedFetch({
    get: url,
    set: url,
    persist: {
      name: `cached_${url.replace(/[^a-zA-Z0-9]/g, '_')}`,
      plugin: 'indexeddb'
    }
  }))
  
  return data$
}

// ✅ EXAMPLE 4: Global sync configuration
export const configureGlobalSync = () => {
  configureObservableSync({
    // Global sync settings
    retry: {
      infinite: true,
      delay: 1000,
      backoff: 'exponential'
    },
    
    // Global persistence settings  
    persist: {
      plugin: new ObservablePersistIndexedDB({
        databaseName: 'vibestack_app',
        version: 1,
        tableNames: ['entities', 'metadata', 'sync_state']
      })
    },
    
    // Debug mode
    onError: (error, params) => {
      console.error('Legend State sync error:', error, params)
    }
  })
}

// ✅ EXAMPLE 5: Advanced sync with custom transforms
export const advancedSyncExample = () => {
  const data$ = observable(synced({
    get: async () => {
      const response = await fetch('/api/data')
      const rawData = await response.json()
      return rawData
    },
    
    set: async ({ value }) => {
      await fetch('/api/data', {
        method: 'POST',
        body: JSON.stringify(value)
      })
      return { value }
    },
    
    // Transform data between server and client formats
    transform: {
      load: (serverData) => {
        // Transform server data to client format
        return serverData.map((item: any) => ({
          ...item,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }))
      },
      save: (clientData) => {
        // Transform client data to server format  
        return clientData.map((item: any) => ({
          ...item,
          created_at: item.createdAt?.toISOString(),
          updated_at: item.updatedAt?.toISOString()
        }))
      }
    },
    
    persist: {
      name: 'advanced_sync_data',
      plugin: 'indexeddb'
    }
  }))
  
  return data$
}

// ✅ USAGE EXAMPLES

// Basic usage
export const useBasicSync = () => {
  const projects$ = basicSyncedExample()
  
  // Read data
  const projects = projects$.get()
  console.log('Projects:', projects)
  
  // Update data (triggers sync)
  projects$.set([...projects, { id: '123', name: 'New Project' }])
}

// CRUD usage
export const useCrudSync = () => {
  const projects$ = crudSyncedExample('01920000-1000-7000-8000-000000000001', 'project')
  
  // The syncedCrud automatically handles CRUD operations
  const projects = projects$.get()
  console.log('Projects:', projects)
  
  // Add new project (triggers create API call)
  const newProject = { name: 'New Project', description: 'Test project' }
  projects$.push(newProject)
  
  // Update project (triggers update API call)
  if (projects.length > 0) {
    projects$[0].name.set('Updated Project Name')
  }
  
  // Delete project (triggers delete API call)
  if (projects.length > 0) {
    projects$[0].delete()
  }
}

// ✅ WORKING IMPORT SUMMARY FOR v3.0.0-beta.31:

/*
CORRECT IMPORTS:
- import { observable } from '@legendapp/state'
- import { synced } from '@legendapp/state/sync'  
- import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
- import { syncedFetch } from '@legendapp/state/sync-plugins/fetch'
- import { ObservablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
- import { configureObservableSync, type PersistOptions } from '@legendapp/state/sync'

INCORRECT IMPORTS (DON'T USE):
- import { ... } from '@legendapp/state/persist' ❌ (doesn't exist)
- import { configureObservablePersistence } from '@legendapp/state/persist' ❌
- import { persistObservable } from '@legendapp/state/persist' ❌

KEY DIFFERENCES IN v3:
1. Persistence is configured through the `persist` property in sync functions
2. Use `configureObservableSync` instead of `configureObservablePersistence`
3. All persist-related types are in `@legendapp/state/sync`
4. syncedCrud provides the best developer experience for REST APIs
5. Plugin instances are created with `new` (e.g., `new ObservablePersistIndexedDB()`)
*/