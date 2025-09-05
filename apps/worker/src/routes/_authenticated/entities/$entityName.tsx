import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { UniversalEntityPage } from '@/components/entities/UniversalEntityPage'
import { useAuth } from '@/lib/auth'
import { 
  universeLoading$,
  universeError$,
  universeSchema$,
  getEntity$
} from '@/legend-state'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/entities/$entityName')({
  component: EntityPage,
  loader: async ({ params }) => {
    const { entityName } = params
    
    // Preload entity schema and data
    try {
      // Wait for universe context to be ready
      const universeSchema = universeSchema$.get()
      if (!universeSchema) {
        // Schema not ready yet, let component handle loading
        return { entityName, preloadedData: null }
      }
      
      // Get entity store and preload data
      const entityStore = getEntity$(entityName)
      if (entityStore) {
        const entityData = entityStore.get()
        return {
          entityName,
          preloadedData: {
            entities: entityData ? Object.values(entityData) : [],
            schema: universeSchema?.entities?.[entityName] || null
          }
        }
      }
      
      return { entityName, preloadedData: null }
    } catch (error) {
      console.warn('Route loader failed, component will handle loading:', error)
      return { entityName, preloadedData: null }
    }
  }
})

// Allow React to handle state changes naturally without forced remount
function EntityPage() {
  const { entityName } = Route.useParams()
  const loaderData = Route.useLoaderData()
  
  // Remove key prop to prevent unnecessary DOM destruction during navigation
  return <EntityPageInner entityName={entityName} preloadedData={loaderData?.preloadedData} />
}

const EntityPageInner = observer(function EntityPageInner({ 
  entityName, 
  preloadedData 
}: { 
  entityName: string
  preloadedData?: { entities: any[], schema: any } | null
}) {
  const { currentOrganization, user } = useAuth()
  const currentOrgId = currentOrganization?.id
  const userId = user?.id
  
  // NEW: Use universe-based observables, but prefer preloaded data
  const loading = use$(universeLoading$)
  const error = use$(universeError$)
  const schema = preloadedData?.schema ? { entities: { [entityName]: preloadedData.schema } } : use$(universeSchema$)
  
  // Components should only consume observables, not trigger loads
  // Loading is handled by auth state machines
  
  // Get entity store and loading state - use proper case from schema
  const actualEntityName = (() => {
    if (!schema?.entities) return entityName
    
    // First try exact match
    if (schema.entities[entityName]) {
      return entityName
    }
    
    // Then try case-insensitive match
    const entityKeys = Object.keys(schema.entities)
    const matchedKey = entityKeys.find(key => key.toLowerCase() === entityName.toLowerCase())
    return matchedKey || entityName
  })()
  
  const entityStore = currentOrgId && schema ? getEntity$(actualEntityName) : null
  
  // Always call use$() hook, but pass null if entityStore doesn't exist
  // This ensures consistent hook call order per React rules
  const entityData = use$(entityStore)
  const isEntityLoading = false // Simplified for now
  const hasEntityLoaded = true // Simplified for now
  
  // Convert object to array for display - prefer preloaded data
  const entityArray = preloadedData?.entities?.length ? preloadedData.entities : (entityData ? Object.values(entityData) : [])
  
  // Get entity schema with case-insensitive lookup
  const entitySchema = (() => {
    if (!schema?.entities) return null
    
    // First try exact match
    if (schema.entities[entityName]) {
      return schema.entities[entityName]
    }
    
    // Then try case-insensitive match
    const entityKeys = Object.keys(schema.entities)
    const matchedKey = entityKeys.find(key => key.toLowerCase() === entityName.toLowerCase())
    return matchedKey ? schema.entities[matchedKey] : null
  })()
  
  // Listen for WebSocket table change notifications
  useEffect(() => {
    if (!currentOrgId || !entityName) return
    
    const handleTableChange = (event: CustomEvent) => {
      const { table, organizationId } = event.detail
      
      // Check if this notification is for our organization and entity
      if (organizationId === currentOrgId) {
        // Convert entity name to table name (e.g., "Project" -> "project")
        const tableName = entityName.toLowerCase()
        
        if (table === tableName) {
          console.log(`[${entityName}Page] Table change detected via WebSocket`)
          // Legend State will handle the update via its subscription
        }
      }
    }
    
    // Listen for table change notifications from WebSocket
    window.addEventListener('vibestack:table-change-notification', handleTableChange as EventListener)
    
    return () => {
      window.removeEventListener('vibestack:table-change-notification', handleTableChange as EventListener)
    }
  }, [currentOrgId, entityName])
  
  if (!currentOrgId) {
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
          <p className="text-muted-foreground">Initializing {entityName} store...</p>
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
          <h2 className="text-xl font-semibold">Entity Not Found</h2>
          <p className="text-muted-foreground">
            The entity "{entityName}" was not found in your organization's schema.
          </p>
        </div>
      </div>
    )
  }
  
  // Show loading state if data hasn't been loaded yet
  // This prevents the "0 records" flash
  if (!hasEntityLoaded && isEntityLoading) {
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
      orgId={currentOrgId}
    />
  )
})