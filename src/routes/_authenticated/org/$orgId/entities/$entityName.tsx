import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { UniversalEntityPage } from '@/components/entities/UniversalEntityPage'
import { useAuth } from '@/lib/auth'
import { 
  getEntity$,
  universeLoading$,
  universeError$,
  universeSchema$
} from '@/legend-state'
import { useEffect } from 'react'
import * as React from 'react'
import { z } from 'zod'
import { EntityNameUtils } from '@/lib/entity-name-utils'

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
  // Use universe-based observables - schema-driven org parameters
  const loading = use$(universeLoading$)
  const error = use$(universeError$)
  const schema = use$(universeSchema$)
  
  // ✅ ALWAYS call getEntity$ and use$ to maintain consistent hook order
  // Call this unconditionally even if we don't have schema yet
  // Normalize entity name and check if entityName is already prefixed with orgId to avoid double-prefixing
  const actualEntityKey = React.useMemo(() => {
    
    // Use centralized entity name utilities
    const normalizedEntityName = EntityNameUtils.fromUrlFormat(entityName)
    const result = EntityNameUtils.ensureOrgPrefix(normalizedEntityName, orgId)
    
    
    return result
  }, [entityName, orgId])
  
  // ✅ SIMPLIFIED: Let the VibeGrid atomic bridge handle all data loading
  // No need to manage entityStore or entityData here - that's the bridge's job
  
  // Get entity schema using the normalized entity name from display schema
  const entitySchema = React.useMemo(() => {
    if (!schema?.entities) return null

    // Use centralized entity name utilities for consistent normalization
    const normalizedEntityName = EntityNameUtils.fromUrlFormat(entityName)

    // More detailed debugging before final result
    const entityKeys = schema?.entities ? Object.keys(schema?.entities) : []

    // Try multiple lookup strategies
    let result = null

    if (schema?.entities) {
      // Strategy 1: Direct normalized name lookup (e.g., "Client")
      result = schema.entities[normalizedEntityName]

      // Strategy 2: Full entity key lookup (e.g., "01920000-1000-7000-8000-000000000001_Client")
      if (!result) {
        const fullEntityKey = `${orgId}_${normalizedEntityName}`
        result = schema.entities[fullEntityKey]
      }

      // Strategy 3: Look for any key containing the normalized name
      if (!result) {
        const matchingKey = Object.keys(schema.entities).find(key =>
          key.includes(`_${normalizedEntityName}`) ||
          key.toLowerCase().includes(normalizedEntityName.toLowerCase())
        )
        if (matchingKey) {
          result = schema.entities[matchingKey]
        }
      }
    }

    return result
  }, [schema, entityName])
  
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

  // Only show "Entity Not Found" for legitimate missing entities after schema is fully loaded
  if (!loading && schema && !entitySchema) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Entity Not Found</h2>
          <p className="text-muted-foreground">
            The entity "{entityName}" was not found in organization {orgId}.
          </p>
        </div>
      </div>
    )
  }
  
  // ✅ SIMPLIFIED: Just pass the essentials, let UniversalEntityPage and VibeGrid handle the rest
  // Pass the properly formatted entity name with org prefix - UniversalEntityPage will handle display formatting
  
  return (
    <UniversalEntityPage
      entityName={actualEntityKey}
      schema={entitySchema}
      orgId={orgId}
    />
  )
})