import React, { useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentContainer } from '@/components/layout/content-container'
import { Badge } from '@/components/ui/badge'
import { useUnifiedAuth } from '@/legend-state/hooks/use-unified-auth'
// ⚡ PERFORMANCE: Lazy load heavy components to reduce initial bundle size
const EntityCreationDialog = React.lazy(() => import('./EntityCreationDialog').then(m => ({ default: m.EntityCreationDialog })))
const KnowledgeTab = React.lazy(() => import('@/components/ui/knowledge-tab-simplified').then(m => ({ default: m.KnowledgeTab })))
const QuickEntityCreate = React.lazy(() => import('./QuickEntityCreate').then(m => ({ default: m.QuickEntityCreate })))
import { EntityCard } from './EntityCard'
import { PlusCircle, Globe, Building } from 'lucide-react'
import {
  universeLoading$,
  universeSchema$,
  universeError$,
  getEntity$,
  removeEntityFromSchema,
  loadUniverseContext
} from '@/legend-state'
import { universeContext$ } from '@/legend-state/observables'
import { use$ } from '@legendapp/state/react'
import { log } from '@/logger'
import { useParams } from '@tanstack/react-router'

// Create logger instance for this file
const fileLog = log('features/dashboard/DashboardLegend.tsx');


const DashboardLegend = observer(function DashboardLegend() {
  const [activeTab, setActiveTab] = React.useState('overview');
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const { currentOrganization, user, userOrganizations } = useUnifiedAuth();
  const currentOrgId = currentOrganization?.id;
  const userId = user?.id;

  // Check if we're in an organization-specific route
  const params = useParams({ strict: false }) as { orgId?: string };
  const routeOrgId = params?.orgId;
  
  // Determine context mode based on route
  const isUniverseMode = !routeOrgId;
  const contextOrgId = routeOrgId || 'universe';
  
  // Find the organization name based on the route
  const routeOrganization = routeOrgId ? userOrganizations.find(org => org.id === routeOrgId) : null;
  const displayOrganizationName = isUniverseMode ? 'Universe' : (routeOrganization?.name || 'Organization');
  
  // Use universe-based observables for dashboard (supports universe mode)
  const loading = use$(universeLoading$);
  const schema = use$(universeSchema$);
  const error = use$(universeError$);

  // Show dashboard immediately after initialization completes
  // Entity cards will load progressively as schema data becomes available
  const isDataReady = !loading;

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(!isDataReady ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  // Show loading until initialization complete
  if (!isDataReady) {
    return (
      <ContentContainer>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
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
                {loading ? 'Initializing...' : 'Loading data...'}
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
        </div>
        <div className='flex items-center space-x-2'>
          <React.Suspense fallback={<div className="text-center py-2">Loading...</div>}>
            <QuickEntityCreate />
          </React.Suspense>
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
            <TabsTrigger value='knowledge'>Knowledge</TabsTrigger>
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
        
        <TabsContent value='knowledge' className='space-y-4'>
          <React.Suspense fallback={<div className="text-center py-4">Loading knowledge...</div>}>
            <KnowledgeTab
              entityType={isUniverseMode ? 'universe' : 'world'}
              entityId={routeOrgId || currentOrgId || 'universe'}
              entityName={displayOrganizationName}
              organizationId={routeOrgId || currentOrgId || ''}
            />
          </React.Suspense>
        </TabsContent>
      </Tabs>

      <React.Suspense fallback={null}>
        <EntityCreationDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
        />
      </React.Suspense>
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
  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-500">Error loading data: {error}</p>
      </div>
    )
  }

  if (!schema?.entities) {
    // Schemas are loading reactively - show loading state
    return (
      <div className="text-center py-8">
        <div className="space-y-2">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Loading entities...</p>
        </div>
      </div>
    )
  }

  // Filter entities based on context mode
  const entityList = (() => {
    const allEntityKeys = Object.keys(schema.entities)

    if (isUniverseMode) {
      return allEntityKeys
    } else {
      const orgPrefix = `${routeOrgId}_`
      return allEntityKeys.filter(key => key.startsWith(orgPrefix))
    }
  })()

  const entityCount = entityList.length

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
  const { currentOrganization } = useUnifiedAuth()

  // Access the entity store which triggers loading
  const entityStore = getEntity$(entityName)

  // Get the data from the entity store
  let data = null
  let isLoading = true

  if (entityStore) {
    // Use use$ to make the component reactive to the observable
    data = use$(entityStore)

    // Check loading state based on whether data exists
    isLoading = data === undefined
  } else {
    isLoading = false
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