import { useState, useMemo } from 'react';
import { useSelector } from '@xstate/store/react'
import { tasksAtom } from '@/domain/task'
import { projectsAtom } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import { commentsAtom } from '@/domain/comment'
import { shallowEqual } from '@xstate/store'
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
// ProfileDropdown is now in the main Header
// Search, ThemeSwitch, and SyncStatusIcon are now in the main Header
import { RecentTasksEnhanced } from './components/recent-tasks-enhanced'
import { SyncVisualizer } from '../sync/components/SyncVisualizer'
// SyncStatusIcon is now in the main Header

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
  
  // 🎯 XSTATE REACTIVITY: Read directly from XState atoms with useSelector
  const allTasks = useSelector(
    tasksAtom,
    (tasksRecord) => {
      const tasks = Object.values(tasksRecord);
      return tasks.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime; // Latest first
      });
    },
    shallowEqual
  )
  
  // Get entity counts directly from atoms
  const allProjects = useSelector(
    projectsAtom,
    (projectsRecord) => Object.values(projectsRecord),
    shallowEqual
  )
  
  const allUsers = useSelector(
    usersAtom,
    (usersRecord) => Object.values(usersRecord),
    shallowEqual
  )
  
  const allComments = useSelector(
    commentsAtom,
    (commentsRecord) => Object.values(commentsRecord),
    shallowEqual
  )
  
  // Calculate dashboard data from XState stores
  const dashboardData = useMemo(() => {
    const recentTasks = allTasks.slice(0, 5) // Already sorted above
    
    return {
      tableCounts: {
        users: allUsers.length,
        projects: allProjects.length,
        tasks: allTasks.length,
        comments: allComments.length
      },
      recentTasks
    }
  }, [allTasks, allProjects, allUsers, allComments])

  // 🎯 TEMPORARILY REDUCED LOGGING to isolate double render

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
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
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
                <div className='text-2xl font-bold'>{dashboardData.tableCounts.users}</div>
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
                <div className='text-2xl font-bold'>{dashboardData.tableCounts.projects}</div>
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
                <div className='text-2xl font-bold'>{dashboardData.tableCounts.tasks}</div>
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
                <div className='text-2xl font-bold'>{dashboardData.tableCounts.comments}</div>
                <p className='text-muted-foreground text-xs'>
                  Total comment records
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
            {/* 🎯 TEMPORARILY DISABLED: Testing if SyncVisualizer causes performance issues */}
            {/* <SyncVisualizer className='col-span-1 lg:col-span-1' /> */}
          </div>
        </TabsContent>
        
      </Tabs>
    </ContentContainer>
  )
}
