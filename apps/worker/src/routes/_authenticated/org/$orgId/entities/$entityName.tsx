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
    console.log('🔍 [actualEntityKey] Input:', { entityName, orgId })
    
    // Use centralized entity name utilities
    const normalizedEntityName = EntityNameUtils.fromUrlFormat(entityName)
    const result = EntityNameUtils.ensureOrgPrefix(normalizedEntityName, orgId)
    
    console.log('🔍 [actualEntityKey] Normalized:', { 
      input: entityName, 
      normalized: normalizedEntityName, 
      result 
    })
    
    return result
  }, [entityName, orgId])
  
  // ✅ SIMPLIFIED: Let the VibeGrid atomic bridge handle all data loading
  // No need to manage entityStore or entityData here - that's the bridge's job
  
  // Get entity schema using the normalized entity name from display schema
  const entitySchema = React.useMemo(() => {
    if (!schema?.entities) return null
    
    // Use centralized entity name utilities for consistent normalization
    const normalizedEntityName = EntityNameUtils.fromUrlFormat(entityName)
    console.log('🔍 [EntitySchema] Schema lookup debug:', {
      entityName,
      normalizedEntityName,
      schemaExists: !!schema,
      schemaEntities: schema?.entities ? Object.keys(schema.entities) : null,
      foundSchema: !!schema.entities?.[normalizedEntityName],
      actualSchema: schema.entities?.[normalizedEntityName]
    })
    
    // More detailed debugging before final result
    const entityKeys = schema?.entities ? Object.keys(schema?.entities) : []
    console.log('🔍 [EntitySchema] Detailed lookup:', {
      schema: schema,
      schemaExists: !!schema,
      entities: schema?.entities,
      entitiesExists: !!schema?.entities,
      normalizedEntityName: normalizedEntityName,
      directLookup: schema?.entities?.[normalizedEntityName],
      allEntityKeys: entityKeys,
      keyExists: schema?.entities ? Object.prototype.hasOwnProperty.call(schema.entities, normalizedEntityName) : false,
      // Check if any keys contain our entity name
      keysContainingEntity: entityKeys.filter(key => key.toLowerCase().includes(normalizedEntityName.toLowerCase()) || key.includes(normalizedEntityName)),
      // Check for full entity keys (org-prefixed)
      fullEntityKeyPattern: `${orgId}_${normalizedEntityName}`,
      hasFullEntityKey: entityKeys.includes(`${orgId}_${normalizedEntityName}`)
    })
    
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
    
    console.log('🔍 [EntitySchema] Lookup strategies result:', {
      normalizedEntityName,
      fullEntityKey: `${orgId}_${normalizedEntityName}`,
      strategy1: !!schema?.entities?.[normalizedEntityName],
      strategy2: !!schema?.entities?.[`${orgId}_${normalizedEntityName}`],
      foundViaStrategy3: result ? 'found' : 'not found',
      finalResult: !!result
    })
    console.log('🔍 [EntitySchema] Return result:', {
      result,
      hasResult: !!result,
      resultType: typeof result
    })
    
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
  
  // Universe-based approach - no context switching needed, removed hasCorrectContext check
  
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
  
  // Debug entitySchema value
  console.log('🔍 [EntitySchema] Final entity schema check:', {
    entityName,
    entitySchema: entitySchema,
    hasEntitySchema: !!entitySchema,
    schemaType: typeof entitySchema
  })
  
  if (!entitySchema) {
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