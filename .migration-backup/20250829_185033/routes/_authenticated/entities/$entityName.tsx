import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { use$ } from '@legendapp/state/react'
import { UniversalEntityPage } from '@/components/entities/UniversalEntityPage'
import { useAuth } from '@/lib/auth'
import { 
  orgContext$,
  getEntity$
} from '@/legend-state'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/entities/$entityName')({
  component: EntityPage,
})

// Force new component instance for each entity by using a wrapper
function EntityPage() {
  const { entityName } = Route.useParams()
  
  // Key prop on EntityPageInner forces remount when entity changes
  return <EntityPageInner key={entityName} entityName={entityName} />
}

const EntityPageInner = observer(function EntityPageInner({ entityName }: { entityName: string }) {
  const { currentOrganization, user } = useAuth()
  const currentOrgId = currentOrganization?.id
  const userId = user?.id
  
  // Use Legend State observables
  const loading = use$(orgContext$.loading)
  const error = use$(orgContext$.error)
  const schema = use$(orgContext$.schema)
  
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
  
  // Convert object to array for display
  const entityArray = entityData ? Object.values(entityData) : []
  
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