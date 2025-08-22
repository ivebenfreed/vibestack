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
import { PlusCircle } from 'lucide-react'
import { 
  orgContext$, 
  entity$,
  entityLoading$,
  entityGroups$, 
  loadOrgContext 
} from '@/stores/vibestack-legend-central'
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
  const { currentOrganization, user } = useAuth();
  const currentOrgId = currentOrganization?.id;
  const userId = user?.id;

  // Use Legend State observables
  const loading = use$(orgContext$.loading);
  const schema = use$(orgContext$.schema);

  // Initialize Legend State store when organization changes
  useEffect(() => {
    if (currentOrgId && userId) {
      loadOrgContext(currentOrgId, userId).catch(error => {
        console.error('[Dashboard] Failed to load org context:', error)
      })
    }
  }, [currentOrgId, userId])

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(loading ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  if (loading) {
    return (
      <ContentContainer>
        <div className='mb-2 flex items-center justify-between space-y-2'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
            <TopNav links={topNav} className="mt-2" />
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="text-center space-y-4">
            <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Loading your workspace</p>
              <p className="text-sm text-muted-foreground">Fetching organization data...</p>
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
          <Button onClick={() => setCreateDialogOpen(true)}>
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
  // Use Legend State observables directly
  const schema = use$(orgContext$.schema)
  const entityGroups = use$(entityGroups$)

  if (!schema?.entities) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No schema loaded for this organization</p>
      </div>
    )
  }

  const entityList = Object.keys(schema.entities)

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
  // Access the entity store which triggers loading
  const entityStore = entity$(entityName)
  const loadingState = entityLoading$(entityName)
  
  // Get the data - this triggers the syncedCrud fetch
  const data = use$(entityStore)
  const isLoading = use$(loadingState.isLoading)
  const hasLoaded = use$(loadingState.hasLoaded)
  
  // syncedCrud returns an object with IDs as keys, not an array
  let count = 0
  if (data && typeof data === 'object') {
    // Count the number of keys (each key is a record ID)
    count = Object.keys(data).length
  }
  
  // Show loading state only if we haven't loaded data yet
  // This prevents the "0 records" flash on reload
  const displayCount = !hasLoaded && isLoading ? '...' : count.toString()
  
  return (
    <EntityCard 
      entityName={entityName}
      entityDef={entityDef}
      count={displayCount}
    />
  )
})

export default DashboardLegend