import React, { useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentContainer } from '@/components/layout/content-container'
import { TopNav } from '@/components/layout/top-nav'
import { useAuth } from '@/lib/auth'
import { EntityCreationDialog } from './EntityCreationDialog'
import { EntityCard } from './EntityCard'
import { QuickEntityCreate } from './QuickEntityCreate'
import { PlusCircle } from 'lucide-react'
import { 
  orgContext$,
  getEntity$,
  removeEntityFromSchema
} from '@/legend-state'
import { orgSchemaClient } from '@/lib/schema-client'
import { use$ } from '@legendapp/state/react'

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
  const [dataReady, setDataReady] = React.useState(false);
  const { currentOrganization, user } = useAuth();
  const currentOrgId = currentOrganization?.id;
  const userId = user?.id;

  // Use Legend State observables
  const loading = use$(orgContext$.loading);
  const schema = use$(orgContext$.schema);

  // Components should only consume observables, not trigger loads
  // Loading is handled by auth state machines

  // Track when schema is ready - don't wait for data loading
  useEffect(() => {
    if (!schema?.entities || loading) {
      setDataReady(false);
      return;
    }

    const entityNames = Object.keys(schema.entities);
    
    // Entity observables are created lazily by getEntity$ when components access them
    // No need to pre-trigger them here as syncedCrud will handle loading automatically
    setDataReady(true);
  }, [schema, loading]);

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(loading || !dataReady ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  // Show loading until schema AND entity data is loaded
  if (loading || !dataReady) {
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
          <DashboardContent />
        </TabsContent>
      </Tabs>

      <EntityCreationDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
    </ContentContainer>
  )
})

const DashboardContent = observer(function DashboardContent() {
  // Use the schema from the observable
  const schema = use$(orgContext$.schema)

  console.log('[Dashboard] Using schema:', schema)

  if (!schema?.entities) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No schema loaded for this organization</p>
      </div>
    )
  }

  const entityList = Object.keys(schema.entities)
  console.log('[Dashboard] Entity list from schema:', entityList)

  if (entityList.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No entities found for this organization</p>
      </div>
    )
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {entityList.map(entityName => (
        <EntityCardWithData 
          key={entityName}
          entityName={entityName}
          entityDef={schema.entities[entityName]}
        />
      ))}
    </div>
  )
})

// Separate component to handle entity data loading
const EntityCardWithData = observer(function EntityCardWithData({
  entityName,
  entityDef
}: {
  entityName: string
  entityDef: any
}) {
  const { currentOrganization } = useAuth()
  
  // Access the entity store which triggers loading
  const entityStore = getEntity$(entityName)
  
  // Get the data - this triggers the syncedCrud fetch
  const data = use$(entityStore)
  // Note: Loading state is handled internally by syncedCrud
  const isLoading = false // Simplified for now
  const hasLoaded = true // Simplified for now
  
  // syncedCrud returns an object with IDs as keys, not an array
  let count = 0
  if (data && typeof data === 'object') {
    // Count the number of keys (each key is a record ID)
    count = Object.keys(data).length
  }
  
  // Show loading state only if we haven't loaded data yet
  // This prevents the "0 records" flash on reload
  const displayCount = !hasLoaded && isLoading ? '...' : count.toString()
  
  // Handle entity deletion using new schema client API
  const handleDelete = async (entityName: string) => {
    console.log(`[Dashboard] Deleting entity type: ${entityName}`)
    
    try {
      const orgId = currentOrganization?.id
      if (!orgId) {
        throw new Error('No organization ID available')
      }
      
      // First remove from local observable for immediate UI update
      removeEntityFromSchema(entityName)
      
      // Then make API call (optimistic update pattern)
      const result = await orgSchemaClient.deleteEntitySchema(orgId, entityName)
      
      if (!result.success) {
        // If API fails, we'd need to rollback the optimistic update
        // For now, just throw the error
        throw new Error(result.error || 'Failed to delete entity schema')
      }
      
      console.log(`[Dashboard] Successfully deleted entity type: ${entityName}`)
      
    } catch (error) {
      console.error(`[Dashboard] Failed to delete entity ${entityName}:`, error)
      throw error
    }
  }
  
  return (
    <EntityCard 
      entityName={entityName}
      entityDef={entityDef}
      count={displayCount}
      onDelete={handleDelete}
    />
  )
})

export default DashboardLegend