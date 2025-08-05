import { useState, useEffect } from 'react';
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
import { RecentTasksEnhanced } from './components/recent-tasks-enhanced-dexie'
import { db } from '@repo/dataforge/dexie-schema'

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
  const [tableCounts, setTableCounts] = useState({
    users: 0,
    projects: 0,
    tasks: 0,
    comments: 0,
    statusDefinitions: 0,
    statusSets: 0,
    tags: 0,
    tagSets: 0
  });

  // Load counts from Dexie
  useEffect(() => {
    async function loadCounts() {
      try {
        const [
          userCount,
          projectCount,
          taskCount,
          commentCount,
          statusDefinitionCount,
          statusSetCount,
          tagCount,
          tagSetCount
        ] = await Promise.all([
          db.users.count(),
          db.projects.count(),
          db.tasks.count(),
          db.comments.count(),
          db.statusDefinitions.count(),
          db.statusSets.count(),
          db.tags.count(),
          db.tagSets.count()
        ]);

        setTableCounts({
          users: userCount,
          projects: projectCount,
          tasks: taskCount,
          comments: commentCount,
          statusDefinitions: statusDefinitionCount,
          statusSets: statusSetCount,
          tags: tagCount,
          tagSets: tagSetCount
        });

        console.log('[Dashboard] Loaded counts from Dexie:', {
          users: userCount,
          projects: projectCount,
          tasks: taskCount,
          comments: commentCount,
          statusDefinitions: statusDefinitionCount,
          statusSets: statusSetCount,
          tags: tagCount,
          tagSets: tagSetCount
        });
      } catch (error) {
        console.error('[Dashboard] Error loading counts from Dexie:', error);
      }
    }

    loadCounts();
  }, []);

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
                  Users Table
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
                <div className='text-2xl font-bold'>{tableCounts.users}</div>
                <p className='text-muted-foreground text-xs'>
                  Total user records
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
                <div className='text-2xl font-bold'>{tableCounts.projects}</div>
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
                <div className='text-2xl font-bold'>{tableCounts.tasks}</div>
                <p className='text-muted-foreground text-xs'>
                  Total task records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Comments Table
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
                <div className='text-2xl font-bold'>{tableCounts.comments}</div>
                <p className='text-muted-foreground text-xs'>
                  Total comment records
                </p>
              </CardContent>
            </Card>
          </div>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4'>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Status Definitions
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
                  <circle cx='12' cy='12' r='3' />
                  <path d='M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{tableCounts.statusDefinitions}</div>
                <p className='text-muted-foreground text-xs'>
                  Status definition records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Status Sets
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
                  <rect x='3' y='4' width='18' height='18' rx='2' ry='2' />
                  <line x1='16' y1='2' x2='16' y2='6' />
                  <line x1='8' y1='2' x2='8' y2='6' />
                  <line x1='3' y1='10' x2='21' y2='10' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{tableCounts.statusSets}</div>
                <p className='text-muted-foreground text-xs'>
                  Status set records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Tags
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
                  <path d='M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{tableCounts.tags}</div>
                <p className='text-muted-foreground text-xs'>
                  Tag records
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  Tag Sets
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
                  <path d='M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z' />
                  <line x1='7' y1='7' x2='7.01' y2='7' />
                </svg>
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{tableCounts.tagSets}</div>
                <p className='text-muted-foreground text-xs'>
                  Tag set records
                </p>
              </CardContent>
            </Card>
          </div>
          <div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
            <Card className='col-span-1 lg:col-span-1'>
              <CardHeader>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>
                  Latest updated tasks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RecentTasksEnhanced />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </ContentContainer>
  )
}