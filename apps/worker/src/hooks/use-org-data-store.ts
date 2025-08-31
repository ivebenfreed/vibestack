import { useEffect, useMemo } from 'react'
import { useObservable } from '@legendapp/state/react'
import { orgContext$, loadOrgContext, getEntity$, clearContext } from '@/legend-state'
import { useAuth } from '@/state-machines'
import { stateLog } from '@/logger';
const log = stateLog('hooks/use-org-data-store.ts');

export function useOrgDataStore() {
  const { currentOrganization, user } = useAuth()
  const context = useObservable(orgContext$)
  
  useEffect(() => {
    if (currentOrganization?.id && user?.id) {
      loadOrgContext(currentOrganization.id, user.id).catch(error => {
        log.error('[useOrgDataStore] Failed to load org context:', error)
      })
    } else {
      clearContext()
    }
  }, [currentOrganization?.id, user?.id])
  
  return context
}

export function useEntityData(entityName: string) {
  const context = useOrgDataStore()
  
  // Use the new getEntity$ approach - it returns a reactive observable for the entity
  const entityObservable = useMemo(() => {
    if (!context.orgId) return null
    return getEntity$(entityName)
  }, [entityName, context.orgId])
  
  // Observe the entity data
  const entityData = useObservable(entityObservable || [])
  
  return entityData || []
}

export function useOrgSchema() {
  const context = useOrgDataStore()
  
  return context.schema
}