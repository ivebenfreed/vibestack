import { createFileRoute } from '@tanstack/react-router'
import { observer } from '@legendapp/state/react'
import { Memo } from '@legendapp/state/react'
import { UniversalEntityPage } from '@/components/entities/UniversalEntityPage'
import { useAuth } from '@/lib/auth'
import { orgData$, switchToOrganization, loadEntityData } from '@/stores/org-data-store'
import { useEffect } from 'react'

export const Route = createFileRoute('/_authenticated/entities/$entityName-old')({
  component: EntityPage,
})

// Force new component instance for each entity by using a wrapper
function EntityPage() {
  const { entityName } = Route.useParams()
  
  // Key prop on EntityPageInner forces remount when entity changes
  return <EntityPageInner key={entityName} entityName={entityName} />
}

const EntityPageInner = observer(function EntityPageInner({ entityName }: { entityName: string }) {
  const { currentOrganization } = useAuth()
  const currentOrgId = currentOrganization?.id
  
  // Initialize store when organization changes
  useEffect(() => {
    if (currentOrgId) {
      switchToOrganization(currentOrgId).catch(error => {
        console.error(`[${entityName}Page] Failed to switch organization:`, error)
      })
    }
  }, [currentOrgId, entityName])
  
  // Load entity data when component mounts
  useEffect(() => {
    if (currentOrgId && entityName) {
      console.log(`[${entityName}Page] Loading data for entity:`, entityName)
      // Check if data needs to be loaded for this entity
      const entities = orgData$.entities.get()
      const data = entities?.[entityName]
      if (data === undefined) {
        // Data not loaded yet for this entity
        loadEntityData(currentOrgId, entityName)
      }
    }
  }, [entityName, currentOrgId])
  
  // Listen for WebSocket table change notifications and reload data
  useEffect(() => {
    if (!currentOrgId || !entityName) return
    
    const handleTableChange = (event: CustomEvent) => {
      const { tables, organizationId } = event.detail
      
      // Check if this notification is for our organization and entity
      if (organizationId === currentOrgId) {
        // Convert entity name to table name (e.g., "Project" -> "project")
        const tableName = entityName.toLowerCase()
        
        if (tables && tables.includes(tableName)) {
          console.log(`[${entityName}Page] Table change detected, reloading data...`)
          loadEntityData(currentOrgId, entityName)
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
  
  return (
    <Memo>
      {() => {
        // Get everything reactively - will auto re-render when observables change
        const loading = orgData$.loading.get()
        const error = orgData$.error.get()
        const schema = orgData$.schema.get()
        const entities = orgData$.entities.get()
        const entitiesLoading = orgData$.entitiesLoading.get()
        
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
        
        // Find the actual entity key (case-insensitive)
        const actualEntityKey = (() => {
          if (!entities) return entityName
          if (entities[entityName] !== undefined) return entityName
          
          const entityKeys = Object.keys(entities)
          const matchedKey = entityKeys.find(key => key.toLowerCase() === entityName.toLowerCase())
          return matchedKey || entityName
        })()
        
        // Check if entity is loading
        const isEntityLoading = entitiesLoading?.[actualEntityKey] || false
        
        // Get entity data with case-insensitive lookup
        const entityData = (() => {
          if (!entities) return undefined
          
          const data = entities[actualEntityKey]
          
          // If undefined, data hasn't been loaded yet - trigger load
          if (data === undefined && currentOrgId && !isEntityLoading) {
            loadEntityData(currentOrgId, actualEntityKey)
            return undefined  // Still loading
          }
          
          // If array (even empty), data has been loaded
          return data
        })()
        
        console.log(`[${entityName}Page] Render:`, {
          entityName,
          actualEntityKey,
          currentOrgId,
          loading,
          isEntityLoading,
          error,
          hasSchema: !!schema,
          hasEntitySchema: !!entitySchema,
          entityDataState: entityData === undefined ? 'not-loaded' : `loaded(${entityData.length})`,
          allEntities: Object.keys(entities || {})
        })
        
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
                  The entity "{entityName}" was not found in the organization schema.
                </p>
                {schema && (
                  <p className="text-sm text-muted-foreground mt-2">
                    Available entities: {Object.keys(schema.entities || {}).join(', ')}
                  </p>
                )}
              </div>
            </div>
          )
        }
        
        // Show loading state while data hasn't been loaded yet
        if (entityData === undefined || isEntityLoading) {
          return (
            <div className="container mx-auto py-6">
              <div className="text-center">
                <h2 className="text-xl font-semibold">Loading {entityName}...</h2>
                <p className="text-muted-foreground">Fetching data from server...</p>
              </div>
            </div>
          )
        }
        
        // Data is loaded (could be empty array if no records)
        return (
          <UniversalEntityPage
            entityName={entityName}
            data={entityData}
            schema={entitySchema}
            orgId={currentOrgId}
          />
        )
      }}
    </Memo>
  )
})