import { useState, useEffect } from 'react';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ContentContainer } from '@/components/layout/content-container'
import { TopNav } from '@/components/layout/top-nav'
import { domainServices } from '@/domain'

const topNav = [
  {
    title: 'Overview',
    href: 'dashboard/overview',
    isActive: true,
    disabled: false,
  },
  {
    title: 'Customers',
    href: 'dashboard/customers',
    isActive: false,
    disabled: true,
  },
  {
    title: 'Products',
    href: 'dashboard/products',
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

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [entityCounts, setEntityCounts] = useState({
    projects: 0,
    tasks: 0,
    clients: 0,
    timesheets: 0
  });
  const [loading, setLoading] = useState(true);

  // Signal that the Dashboard is ready for Playwright tests
  usePlaywrightReady(loading ? undefined : '[PLAYWRIGHT_READY] Dashboard loaded');

  // Load entity counts using LiveStore domain services
  useEffect(() => {
    async function loadEntityCounts() {
      try {
        const orgId = domainServices.getCurrentOrgId();
        if (!orgId) {
          console.log('[Dashboard] No organization selected');
          setLoading(false);
          return;
        }

        console.log('[Dashboard] Loading entity counts for organization:', orgId);
        
        // Get counts from LiveStore domain services
        const [projects, tasks, clients, timesheets] = await Promise.allSettled([
          domainServices.project.findAll(),
          domainServices.task.findAll(), 
          domainServices.client.findAll(),
          domainServices.timesheet.findAll()
        ]);

        setEntityCounts({
          projects: projects.status === 'fulfilled' && projects.value.success ? projects.value.data?.length || 0 : 0,
          tasks: tasks.status === 'fulfilled' && tasks.value.success ? tasks.value.data?.length || 0 : 0,
          clients: clients.status === 'fulfilled' && clients.value.success ? clients.value.data?.length || 0 : 0,
          timesheets: timesheets.status === 'fulfilled' && timesheets.value.success ? timesheets.value.data?.length || 0 : 0
        });

        console.log('[Dashboard] Entity counts loaded:', {
          projects: projects.status === 'fulfilled' && projects.value.success ? projects.value.data?.length || 0 : 0,
          tasks: tasks.status === 'fulfilled' && tasks.value.success ? tasks.value.data?.length || 0 : 0,
          clients: clients.status === 'fulfilled' && clients.value.success ? clients.value.data?.length || 0 : 0,
          timesheets: timesheets.status === 'fulfilled' && timesheets.value.success ? timesheets.value.data?.length || 0 : 0
        });

      } catch (error) {
        console.error('[Dashboard] Error loading entity counts:', error);
      } finally {
        setLoading(false);
      }
    }

    loadEntityCounts();
  }, []);

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
      <div className='mb-2 flex items-center justify-between space-y-2'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
          <TopNav links={topNav} className="mt-2" />
        </div>
        <div className='flex items-center space-x-2'>
          <Button>Download</Button>
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
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Clients
                </CardTitle>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  className='text-muted-foreground h-4 w-4'
                >
                  <path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' />
                  <circle cx='9' cy='7' r='4' />
                  <path d='M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{entityCounts.clients}</div>
                <p className='text-muted-foreground text-xs'>
                  Business clients
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Projects Table
                </CardTitle>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  className='text-muted-foreground h-4 w-4'
                >
                  <rect width='20' height='14' x='2' y='5' rx='2' />
                  <path d='M2 10h20' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{entityCounts.projects}</div>
                <p className='text-muted-foreground text-xs'>
                  Total project records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>Tasks Table</CardTitle>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  className='text-muted-foreground h-4 w-4'
                >
                  <path d='M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'></path><polyline points='14 2 14 8 20 8'></polyline><line x1='16' y1='13' x2='8' y2='13'></line><line x1='16' y1='17' x2='8' y2='17'></line><polyline points='10 9 9 9 8 9'></polyline>
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{entityCounts.tasks}</div>
                <p className='text-muted-foreground text-xs'>
                  Total task records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Timesheets
                </CardTitle>
                <svg
                  xmlns='http://www.w3.org/2000/svg'
                  viewBox='0 0 24 24'
                  fill='none'
                  stroke='currentColor'
                  strokeLinecap='round'
                  strokeLinejoin='round'
                  strokeWidth='2'
                  className='text-muted-foreground h-4 w-4'
                >
                  <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'></path>
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{entityCounts.timesheets}</div>
                <p className='text-muted-foreground text-xs'>
                  Time entries
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
}
