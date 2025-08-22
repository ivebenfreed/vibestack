import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { getOrgDataStore, switchToOrganization } from '@/stores/org-data-store'
import { sidebarNavigationStore } from '@/stores/sidebarNavigationStore'

export function useSidebarWithSchema() {
  const { user } = useAuth()
  const currentOrgId = user?.currentOrganizationId
  
  // Initialize store when organization changes
  useEffect(() => {
    if (currentOrgId) {
      switchToOrganization(currentOrgId).catch(error => {
        console.error('[useSidebarWithSchema] Failed to switch organization:', error)
      })
    }
  }, [currentOrgId])
  
  // Get store and schema directly (this will be reactive in observer components)
  const store = getOrgDataStore()
  const schema = store?.schema.get()
  
  useEffect(() => {
    if (!store || !schema) return
    
    sidebarNavigationStore.trigger.updateNavigationWithSchema({
      projects: [], // Empty for now - will be populated by Legend State
      schema
    })
  }, [store, schema])
  
  return {
    store,
    schema,
    currentOrgId
  }
}