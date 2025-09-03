import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { UniversalEntityPage } from '@/components/entities/UniversalEntityPage'
import { useAuth } from '@/lib/auth'
import { 
  getOrgContext$,
  getEntity$,
  loadOrgContext
} from '@/legend-state'
import { useEffect } from 'react'
import * as React from 'react'
import { z } from 'zod'

const orgEntityRouteSchema = z.object({
  orgId: z.string(),
  entityName: z.string()
})

export const Route = createFileRoute('/_authenticated/org/$orgId/entities/$entityName')({
  params: {
    parse: (params) => orgEntityRouteSchema.parse(params),
    stringify: ({ orgId, entityName }) => ({ orgId, entityName })
  },
  loader: async ({ params }) => {
    // Organization ID and entity name are available in params
    return { 
      organizationId: params.orgId,
      entityName: params.entityName 
    }
  },
  component: OrganizationEntityPage,
})

// Force new component instance for each entity by using a wrapper
function OrganizationEntityPage() {
  const { orgId, entityName } = Route.useParams()
  
  // Key prop forces remount when entity or org changes
  return <OrganizationEntityPageInner key={`${orgId}-${entityName}`} orgId={orgId} entityName={entityName} />
}

const OrganizationEntityPageInner = observer(function OrganizationEntityPageInner({ 
  orgId, 
  entityName 
}: { 
  orgId: string
  entityName: string 
}) {
  const { user } = useAuth()
  const userId = user?.id
  
  // ✅ ALWAYS call ALL hooks at the top - no conditionals before this point
  // Use organization-specific Legend State observables - these must be called unconditionally
  const orgContextObs = React.useMemo(() => getOrgContext$(orgId), [orgId])
  const loading = use$(orgContextObs.loading)
  const error = use$(orgContextObs.error)
  const schema = use$(orgContextObs.schema)
  
  // ✅ ALWAYS call getEntity$ and use$ to maintain consistent hook order
  // Call this unconditionally even if we don't have schema yet
  const expectedEntityKey = React.useMemo(() => `${orgId}_${entityName}`, [orgId, entityName])
  const entityStore = React.useMemo(() => getEntity$(expectedEntityKey), [expectedEntityKey])
  const entityData = use$(entityStore)
  
  // ✅ All derived state calculations moved to useMemo with stable dependencies
  const derivedState = React.useMemo(() => {
    const hasCorrectContext = !!schema && !!schema.entities
    const hasSchema = !!schema?.entities
    const schemaVersion = schema?.version || null
    const isEntityLoading = false // Simplified for now  
    const hasEntityLoaded = true // Simplified for now
    
    // Get actual entity name based on schema
    let actualEntityName = expectedEntityKey
    if (hasSchema && schema?.entities) {
      // First try UUID-prefixed exact match
      if (schema.entities[expectedEntityKey]) {
        actualEntityName = expectedEntityKey
      } else {
        // Then try case-insensitive UUID-prefixed match
        const entityKeys = Object.keys(schema.entities)
        const matchedKey = entityKeys.find(key => key.toLowerCase() === expectedEntityKey.toLowerCase())
        if (matchedKey) {
          actualEntityName = matchedKey
        } else {
          // Fallback: look for any entity ending with the entityName
          const fallbackKey = entityKeys.find(key => {
            const parts = key.split('_')
            if (parts.length === 0) return false
            const lastPart = parts[parts.length - 1]
            return lastPart && lastPart.toLowerCase() === entityName.toLowerCase()
          })
          if (fallbackKey) {
            actualEntityName = fallbackKey
          }
        }
      }
    }
    
    return {
      hasCorrectContext,
      hasSchema,
      schemaVersion,
      isEntityLoading,
      hasEntityLoaded,
      actualEntityName
    }
  }, [schema, expectedEntityKey, entityName])
  
  // ✅ Load organization context based on URL parameters - useEffect hook
  useEffect(() => {
    if (!userId) {
      console.log('User not authenticated, skipping org context load for entity page');
      return;
    }

    const currentSchemaOrgId = schema?.orgId;
    
    // Only reload context if route requires different context than currently loaded
    if (currentSchemaOrgId !== orgId) {
      console.log('Entity page loading org context:', { currentSchemaOrgId, orgId });
      
      loadOrgContext(orgId, userId).then(() => {
        console.log('Organization context loaded for entity page:', orgId);
      }).catch((error) => {
        console.error('Failed to load organization context for entity page:', error);
      });
    } else {
      console.log('Entity page context already matches requirements:', { currentSchemaOrgId, orgId });
    }
  }, [userId, orgId, derivedState.schemaVersion, schema?.orgId])
  
  // ✅ Listen for WebSocket table change notifications
  useEffect(() => {
    if (!orgId || !entityName) return
    
    const handleTableChange = (event: CustomEvent) => {
      const { table, organizationId } = event.detail
      
      // Check if this notification is for our organization and entity
      if (organizationId === orgId) {
        // Convert entity name to table name (e.g., "Project" -> "project")
        const tableName = entityName.toLowerCase()
        
        if (table === tableName) {
          console.log(`[${entityName}Page] Table change detected via WebSocket for org ${orgId}`)
          // Legend State will handle the update via its subscription
        }
      }
    }
    
    // Listen for table change notifications from WebSocket
    window.addEventListener('vibestack:table-change-notification', handleTableChange as EventListener)
    
    return () => {
      window.removeEventListener('vibestack:table-change-notification', handleTableChange as EventListener)
    }
  }, [orgId, entityName])
  
  // ✅ Compute derived values after all hooks
  const entityArray = (entityStore && entityData) ? Object.values(entityData) : []
  
  // Get entity schema with UUID-prefixed lookup for universe context
  const entitySchema = React.useMemo(() => {
    console.log('[EntityRoute] Debug schema lookup:', {
      entityName,
      orgId,
      expectedEntityKey,
      schemaExists: !!schema,
      entitiesExists: !!schema?.entities,
      availableEntities: schema?.entities ? Object.keys(schema.entities) : [],
      schemaOrgId: schema?.orgId
    })
    
    if (!schema?.entities) return null
    
    // In universe context, entities are prefixed with orgId
    // Try exact match with UUID prefix
    if (schema.entities[expectedEntityKey]) {
      console.log('[EntityRoute] Found UUID-prefixed match:', expectedEntityKey)
      return schema.entities[expectedEntityKey]
    }
    
    // Try case-insensitive match with UUID prefix
    const entityKeys = Object.keys(schema.entities)
    const matchedKey = entityKeys.find(key => key.toLowerCase() === expectedEntityKey.toLowerCase())
    if (matchedKey) {
      console.log('[EntityRoute] Found case-insensitive UUID-prefixed match:', { expectedEntityKey, matchedKey })
      return schema.entities[matchedKey]
    }
    
    // Fallback: look for any entity ending with the entityName (case-insensitive)
    const fallbackKey = entityKeys.find(key => {
      const parts = key.split('_')
      if (parts.length === 0) return false
      const lastPart = parts[parts.length - 1]
      return lastPart && lastPart.toLowerCase() === entityName.toLowerCase()
    })
    
    if (fallbackKey) {
      console.log('[EntityRoute] Found fallback match:', { entityName, fallbackKey })
      return schema.entities[fallbackKey]
    }
    
    console.log('[EntityRoute] No match found for:', { 
      entityName, 
      expectedEntityKey,
      availableKeys: entityKeys 
    })
    return null
  }, [schema, expectedEntityKey, entityName])
  
  if (!orgId) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">No Organization Selected</h2>
          <p className="text-muted-foreground">Please select an organization to view entities.</p>
        </div>
      </div>
    )
  }
  
  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading Organization Data...</h2>
          <p className="text-muted-foreground">
            Initializing {entityName} store for organization {orgId.slice(0, 8)}...
          </p>
        </div>
      </div>
    )
  }
  
  if (!derivedState.hasCorrectContext) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Switching Organization Context...</h2>
          <p className="text-muted-foreground">
            Loading {entityName} for organization {orgId.slice(0, 8)}...
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Current: {schema?.orgId || 'none'} → Target: {orgId}
          </p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Error Loading Organization</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }
  
  if (!entitySchema) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibrand">Entity Not Found</h2>
          <p className="text-muted-foreground">
            The entity "{entityName}" was not found in organization {orgId}.
          </p>
        </div>
      </div>
    )
  }
  
  // Show loading state if data hasn't been loaded yet
  if (!derivedState.hasEntityLoaded && derivedState.isEntityLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading {entityName}...</h2>
          <p className="text-muted-foreground">Fetching data from server...</p>
        </div>
      </div>
    )
  }
  
  // Render the universal entity page with Legend State data
  return (
    <UniversalEntityPage
      entityName={entityName}
      schema={entitySchema}
      data={entityArray}
      orgId={orgId}
    />
  )
})