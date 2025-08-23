import { observable, computed } from '@legendapp/state'
import { orgSchemaClient } from '@/lib/schema-client'

// Simple global observable for the entire org data
export const orgData$ = observable({
  schema: null as any,
  entities: {} as Record<string, any[]>,
  entitiesLoading: {} as Record<string, boolean>,
  loading: false,
  error: null as string | null
})

// Get current organization ID from auth machine
function getCurrentOrgId(): string | null {
  const authActor = (window as any).authMachineActor;
  if (!authActor) return null;
  
  const state = authActor.getSnapshot();
  return state?.context?.currentOrganization?.id || null;
}

// Event emitter for table change notifications
export const tableChangeEmitter = new EventTarget()

// WebSocket notification handler
export function handleTableNotification(notification: any) {
  if (notification.table && orgData$.entities[notification.table]) {
    console.log(`[OrgDataStore] WebSocket notification for ${notification.table}:`, notification.operation)
    
    // Reload the affected entity data
    const currentOrgId = getCurrentOrgId()
    if (currentOrgId) {
      loadEntityData(currentOrgId, notification.table).catch(error => {
        console.error(`[OrgDataStore] Failed to reload ${notification.table} after notification:`, error)
      })
    }
  }
}

// Global sidebar observable - reactive navigation state
export const sidebar$ = observable({
  isCollapsed: false,
  navigation: [] as any[],
  activeItem: null as string | null,
})

// Computed observable that automatically derives entity groups from schema
export const entityGroups$ = computed(() => {
  const schema = orgData$.schema.get()
  if (!schema?.entities) return []
  
  return Object.keys(schema.entities).map(entityName => ({
    name: entityName,
    path: `/entities/${entityName}`,
    icon: 'Database'
  }))
})

export async function loadEntityData(orgId: string, entityName: string) {
  // Prevent duplicate loads
  if (orgData$.entitiesLoading[entityName].get()) {
    console.log(`[OrgDataStore] Already loading ${entityName}, skipping...`)
    return
  }
  
  try {
    console.log(`[OrgDataStore] Loading data for ${entityName}...`)
    orgData$.entitiesLoading[entityName].set(true)
    
    const response = await fetch(`/api/dataforge/orgs/${orgId}/data/${entityName}`, {
      credentials: 'include'
    })
    
    if (!response.ok) {
      console.warn(`[OrgDataStore] Failed to fetch ${entityName}:`, response.status)
      return
    }
    
    const result = await response.json()
    console.log(`[OrgDataStore] Loaded ${entityName} data:`, result)
    
    if (result.success && Array.isArray(result.data)) {
      console.log(`[OrgDataStore] Setting ${result.data.length} ${entityName} records`)
      // Directly set the entity data in the observable
      orgData$.entities[entityName].set(result.data)
    }
  } catch (error) {
    console.error(`[OrgDataStore] Error loading ${entityName}:`, error)
  } finally {
    orgData$.entitiesLoading[entityName].set(false)
  }
}

export async function switchToOrganization(orgId: string, options?: { preloadCounts?: boolean }) {
  // Get current organization from auth machine for comparison
  const currentOrgId = getCurrentOrgId()
  
  // If already loaded this org, just return unless forced refresh
  if (currentOrgId === orgId && orgData$.schema.get()) {
    return
  }
  
  console.log('[OrgDataStore] Switching to organization:', orgId)
  orgData$.loading.set(true)
  orgData$.error.set(null)
  
  try {
    const schemaResult = await orgSchemaClient.loadOrgSchema(orgId)
    if (!schemaResult.success || !schemaResult.schema) {
      throw new Error(`Failed to load schema for organization: ${orgId}`)
    }
    
    // Set the schema (organization ID comes from auth machine now)
    orgData$.schema.set(schemaResult.schema)
    
    // Initialize with empty arrays so the UI can show counts immediately
    // The arrays will be populated when data is loaded
    const entities: Record<string, any[]> = {}
    const entitiesLoading: Record<string, boolean> = {}
    Object.keys(schemaResult.schema.entities).forEach(entityName => {
      console.log('[OrgDataStore] Creating entity slot for:', entityName)
      entities[entityName] = []  // Start with empty array
      entitiesLoading[entityName] = false
    })
    orgData$.entities.set(entities)
    orgData$.entitiesLoading.set(entitiesLoading)
    
    console.log('[OrgDataStore] Store initialized with entities:', Object.keys(schemaResult.schema.entities))
    
    // Optionally preload entity counts for dashboard
    if (options?.preloadCounts) {
      console.log('[OrgDataStore] Preloading entity counts for dashboard...')
      // Load counts in parallel but don't await - let them complete in background
      Promise.all(
        Object.keys(schemaResult.schema.entities).map(entityName => 
          loadEntityData(orgId, entityName)
        )
      ).then(() => {
        console.log('[OrgDataStore] All entity counts loaded')
      }).catch(error => {
        console.error('[OrgDataStore] Error loading entity counts:', error)
      })
    }
  } catch (error) {
    console.error('[OrgDataStore] Error switching organization:', error)
    orgData$.error.set(error instanceof Error ? error.message : 'Failed to load organization')
  } finally {
    orgData$.loading.set(false)
  }
  
  // Debug: expose to window
  if (typeof window !== 'undefined') {
    (window as any).orgData$ = orgData$;
    (window as any).sidebar$ = sidebar$;
    (window as any).entityGroups$ = entityGroups$;
  }
}

export function getOrgDataStore() {
  return orgData$
}

export function clearOrgDataStore(): void {
  console.log('[OrgDataStore] Clearing current organization store')
  orgData$.set({
    schema: null,
    entities: {},
    entitiesLoading: {},
    loading: false,
    error: null
  })
}