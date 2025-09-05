import { useEffect, useMemo } from 'react'
import { useObservable } from '@legendapp/state/react'
import { universeSchema$, universeLoading$, universeError$, universeUserId$, universeOrgId$, getEntity$, clearContext } from '@/legend-state'
import { useAuth } from '@/state-machines'
import { stateLog } from '@/logger';
const log = stateLog('hooks/use-org-data-store.ts');

export function useOrgDataStore() {
  const { currentOrganization, user } = useAuth()
  const schema = useObservable(universeSchema$)
  const loading = useObservable(universeLoading$)
  const error = useObservable(universeError$)
  const userId = useObservable(universeUserId$)
  const orgId = useObservable(universeOrgId$)
  
  useEffect(() => {
    if (currentOrganization?.id && user?.id) {
      // Universe context is now automatically loaded by the auth system
      // No need to manually load org context here
    } else {
      clearContext()
    }
  }, [currentOrganization?.id, user?.id])
  
  // Return context object using universe-based observables
  return {
    schema,
    loading,
    error,
    userId,
    orgId
  }
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