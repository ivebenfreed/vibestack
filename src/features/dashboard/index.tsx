console.log('[WARM-START-PERF] ⏱️ @/features/dashboard/index.tsx module loading at:', performance.now().toFixed(2) + 'ms');

// Temporarily use the Legend Central implementation
export { default } from './DashboardLegend'

/*
// Original implementation below - commented out for Legend State migration

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

const Dashboard = observer(function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { currentOrganization } = useAuth();
  const currentOrgId = currentOrganization?.id;

  // Initialize store when organization changes
  useEffect(() => {
    if (currentOrgId) {
      // Pass preloadCounts option to load entity data for dashboard
      switchToOrganization(currentOrgId, { preloadCounts: true }).catch(error => {
        console.error('[Dashboard] Failed to switch organization:', error)
      })
    }
  }, [currentOrgId])

  // Signal that the Dashboard is ready for Playwright tests
  const loading = orgData$.loading.get()
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
        <div className="text-center py-8">
          <p className="text-muted-foreground">Loading dashboard data...</p>
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
  const schema = orgData$.schema.get()
  const entities = orgData$.entities.get()
  
  // Build counts directly from the reactive observable store
  const entityCounts: Record<string, number> = {}
  if (entities && schema?.entities) {
    Object.keys(schema.entities).forEach(entityName => {
      const entityData = entities[entityName]
      entityCounts[entityName] = Array.isArray(entityData) ? entityData.length : 0
    })
  }

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
        <EntityCard 
          key={entityName}
          entityName={entityName}
          entityDef={schema.entities[entityName]}
          count={entityCounts[entityName] || 0}
        />
      ))}
    </div>
  )
})

// export default Dashboard
*/