import { useEffect } from 'react'
import { useAuth } from '@/lib/auth'
import { orgContext$, loadOrgContext } from '@/legend-state'
import { useObservable } from '@legendapp/state/react'
import { sidebarNavigationStore } from '@/stores/sidebarNavigationStore'
import { stateLog } from '@/logger';
const log = stateLog('hooks/use-sidebar-with-schema.ts');

export function useSidebarWithSchema() {
  const { user } = useAuth()
  const currentOrgId = user?.currentOrganizationId
  const context = useObservable(orgContext$)
  
  // Initialize context when organization changes
  useEffect(() => {
    if (currentOrgId && user?.id) {
      loadOrgContext(currentOrgId, user.id).catch(error => {
        log.error('[useSidebarWithSchema] Failed to load org context:', error)
      })
    }
  }, [currentOrgId, user?.id])
  
  useEffect(() => {
    if (!context.schema) return
    
    sidebarNavigationStore.trigger.updateNavigationWithSchema({
      projects: [], // Empty for now - will be populated by Legend State
      schema: context.schema
    })
  }, [context.schema])
  
  return {
    store: context,
    schema: context.schema,
    currentOrgId
  }
}