import React, { useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentContainer } from '@/components/layout/content-container'
import { TopNav } from '@/components/layout/top-nav'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth'
import { EntityCreationDialog } from './EntityCreationDialog'
import { EntityCard } from './EntityCard'
import { QuickEntityCreate } from './QuickEntityCreate'
import { PlusCircle, Globe, Building } from 'lucide-react'
import { 
  universeLoading$,
  universeSchema$,
  universeError$,
  getEntity$,
  removeEntityFromSchema,
  loadUniverseContext
} from '@/legend-state'
import { use$ } from '@legendapp/state/react'
import { log } from '@/logger'
import { useParams } from '@tanstack/react-router'

// Create logger instance for this file
const fileLog = log('features/dashboard/DashboardLegend.tsx');

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Analytics',
    href: 'dashboard/analytics',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Reports',
    href: 'dashboard/reports',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Settings',
    href: 'dashboard/settings',
    isActive: false,
    disabled: true,
  },
]

const DashboardLegend = observer(function DashboardLegend() {
  const [activeTab, setActiveTab] = React.useState('overview');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const { currentOrganization, user } = useAuth();
  const currentOrgId = currentOrganization?.id;
  const userId = user?.id;

  // Check if we're in an organization-specific route
  const params = useParams({ strict: false }) as { orgId?: string };
  const routeOrgId = params?.orgId;
  
  // Determine context mode based on route
  const isUniverseMode = !routeOrgId;
  const contextOrgId = routeOrgId || 'universe';
  
  fileLog.info('DashboardLegend route analysis:', { 
    routeOrgId, 
    isUniverseMode, 
    contextOrgId,
    currentOrgId 
  });

  // NEW: Use universe-based observables for dashboard (supports universe mode)
  const loading = use$(universeLoading$);
  const schema = use$(universeSchema$);
  const error = use$(universeError$);
  
  fileLog.info('DashboardLegend observables state:', {
    loading,
    hasSchema: !!schema,
    hasEntities: !!schema?.entities,
    entityCount: schema?.entities ? Object.keys(schema.entities).length : 0,
    error
  });

  // REACTIVE: Determine if data is ready based purely on observables
  const isDataReady = !loading && !!schema?.entities && Object.keys(schema.entities).length > 0;

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(!isDataReady ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  // Show loading until schema data is loaded
  if (!isDataReady) {
    // Use UnifiedLoadingScreen for consistency
    return (
      <ContentContainer>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <TopNav links={topNav} className="mt-2" />
          </div>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Loading your workspace</p>
              <p className="text-sm text-muted-foreground">
                {loading ? 'Fetching organization schema...' : 'Loading entity data...'}
              </p>
            </div>
          </div>
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer>
      <div className='mb-2 flex items-center justify-between space-y-2' data-testid="dashboard-content">
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <TopNav links={topNav} className="mt-2" />
        </div>
        <div className='flex items-center space-x-2'>
          <QuickEntityCreate />
          <Button onClick={() => setCreateDialogOpen(true)} variant="outline">
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Entity Type
          </Button>
        </div>
      </div>
      
      <Tabs
        orientation='vertical'
        value={activeTab} 
        onValueChange={setActiveTab}
        className='space-y-4'
      >
        <div className='w-full overflow-x-auto pb-2'>
          <TabsList>
            <TabsTrigger value='overview'>Overview</TabsTrigger>
            <TabsTrigger value='analytics' disabled>
              Analytics
            </TabsTrigger>
            <TabsTrigger value='reports' disabled>
              Reports
            </TabsTrigger>
            <TabsTrigger value='notifications' disabled>
              Notifications
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value='overview' className='space-y-4'>
          <DashboardContent 
            isUniverseMode={isUniverseMode}
            schema={schema}
            error={error}
            routeOrgId={routeOrgId}
          />
        </TabsContent>
      </Tabs>

      <EntityCreationDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </ContentContainer>
  )
})

const DashboardContent = observer(function DashboardContent({
  isUniverseMode,
  schema,
  error,
  routeOrgId
}: {
  isUniverseMode: boolean
  schema: any
  error: string | null
  routeOrgId?: string
}) {
  fileLog.info('DashboardContent render:', { isUniverseMode, schema: !!schema, error, routeOrgId })

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading data: {error}</p>
      </div>
    )
  }

  if (!schema?.entities) {
    const contextLabel = isUniverseMode ? 'universe' : 'organization'
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No schema loaded for {contextLabel}</p>
      </div>
    )
  }

  // Filter entities based on context mode
  const entityList = (() => {
    const allEntityKeys = Object.keys(schema.entities)
    
    if (isUniverseMode) {
      // Universe mode: show all entities
      return allEntityKeys
    } else {
      // Organization mode: only show entities belonging to this organization
      const orgPrefix = `${routeOrgId}_`
      const filteredKeys = allEntityKeys.filter(key => key.startsWith(orgPrefix))
      fileLog.info('Filtered entity list for org:', { routeOrgId, orgPrefix, filteredKeys, allKeys: allEntityKeys })
      return filteredKeys
    }
  })()
  
  const entityCount = entityList.length
  fileLog.info('Entity list from schema:', { entityList, entityCount, isUniverseMode, routeOrgId })

  if (entityList.length === 0) {
    const contextLabel = isUniverseMode ? 'universe' : 'organization'
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No entities found for {contextLabel}</p>
      </div>
    )
  }

  return (
    <div className='space-y-6'>
      <div className="flex items-center gap-2">
        {isUniverseMode ? (
          <><Globe className="h-5 w-5 text-primary" /><span className="font-medium">Universe View</span></>
        ) : (
          <><Building className="h-5 w-5 text-primary" /><span className="font-medium">Organization View</span></>
        )}
        <Badge variant="outline">{entityCount} entities</Badge>
      </div>
      
      <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
        {entityList.map(entityName => (
          <EntityCardWithData 
            key={entityName}
            entityName={entityName}
            entityDef={schema.entities[entityName]}
            isUniverseMode={isUniverseMode}
            orgId={isUniverseMode ? undefined : routeOrgId}
          />
        ))}
      </div>
    </div>
  )
})

// Separate component to handle entity data loading
const EntityCardWithData = observer(function EntityCardWithData({
  entityName,
  entityDef,
  isUniverseMode,
  orgId
}: {
  entityName: string
  entityDef: any
  isUniverseMode: boolean
  orgId?: string
}) {
  const { currentOrganization } = useAuth()
  
  // Access the entity store which triggers loading
  const entityStore = getEntity$(entityName)
  
  // Debug logging
  fileLog.info(`EntityCardWithData for ${entityName}:`, {
    entityStoreExists: !!entityStore,
    entityStoreType: typeof entityStore,
    hasGet: typeof entityStore?.get === 'function',
    hasPeek: typeof entityStore?.peek === 'function'
  })
  
  // Get the data - entityStore is already an observable wrapped by syncedCrud
  // The issue is that syncedCrud might not trigger the initial fetch automatically
  // We need to access it in a way that triggers the fetch
  let data = null
  let isLoading = true
  let hasLoaded = false
  
  if (entityStore) {
    // CRITICAL FIX: In Legend State v3, we need to force the initial load
    // by accessing the sync state and manually triggering if needed
    React.useEffect(() => {
      if (entityStore) {
        try {
          // Force initial load by accessing the observable
          const currentData = entityStore.get()
          fileLog.info(`Manual trigger for ${entityName}:`, {
            hasCurrentData: !!currentData,
            dataKeys: currentData ? Object.keys(currentData).length : 0
          })
        } catch (error) {
          fileLog.warn(`Error during manual trigger for ${entityName}:`, error)
        }
      }
    }, [entityStore, entityName])

    // Use use$ to make the component reactive to the observable
    data = use$(entityStore)
    
    // CRITICAL DEBUG: Log exactly what data we're getting
    fileLog.info(`Data received for ${entityName}:`, {
      data,
      dataType: typeof data,
      dataLength: data ? (Array.isArray(data) ? data.length : Object.keys(data).length) : 'no data',
      isUndefined: data === undefined,
      isNull: data === null,
      isEmpty: data && typeof data === 'object' ? Object.keys(data).length === 0 : 'not object'
    })
    
    // Check loading state based on whether data exists
    isLoading = data === undefined
    hasLoaded = data !== undefined
  } else {
    isLoading = false
    hasLoaded = false
  }
  
  // syncedCrud returns an object with IDs as keys, not an array
  let count = 0
  if (data && typeof data === 'object') {
    // Count the number of keys (each key is a record ID)
    count = Object.keys(data).length
  }
  
  // Show loading state only if we haven't loaded data yet
  // If data is undefined (still loading), show ...
  // If data is null (no entity store) or empty object, show 0
  const displayCount = isLoading ? '...' : count.toString()
  
  // Handle entity deletion using new schema client API
  const handleDelete = async (entityName: string) => {
    fileLog.info(`Deleting entity type: ${entityName}`)
    
    try {
      const orgId = currentOrganization?.id
      if (!orgId) {
        throw new Error('No organization ID available')
      }
      
      // First remove from local observable for immediate UI update
      removeEntityFromSchema(entityName)
      
      // Then make API call (optimistic update pattern)
      const response = await fetch(`/api/dataforge/orgs/${orgId}/entities/${entityName}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Accept': 'application/json'
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Delete failed: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        // If API fails, we'd need to rollback the optimistic update
        // For now, just throw the error
        throw new Error(result.error || 'Failed to delete entity schema')
      }
      
      fileLog.info(`Successfully deleted entity type: ${entityName}`)
      
    } catch (error) {
      console.error(`[Dashboard] Failed to delete entity ${entityName}:`, error)
      throw error
    }
  }
  
  // Get organization name from entity definition or current organization
  const orgName = entityDef?._orgName || currentOrganization?.name
  
  return (
    <EntityCard 
      entityName={entityName}
      entityDef={entityDef}
      count={displayCount}
      orgId={orgId}
      orgName={isUniverseMode ? orgName : undefined} // Only show org name in universe mode
      isUniverseMode={isUniverseMode}
      onDelete={handleDelete}
    />
  )
})


export default DashboardLegend