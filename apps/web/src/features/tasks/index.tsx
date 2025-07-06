import React, { Suspense } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Grid3X3, Kanban, Calendar } from 'lucide-react'
import { useTheme } from '@/context/theme-context'
import { useNavigate, useSearch } from '@tanstack/react-router'
import TasksTableView from './TasksTableView'

// Separate component for table view to isolate hooks
const TaskTableView: React.FC<{ theme: string }> = ({ theme }) => {
  return (
    <TasksTableView />
  )
}

// Lazy load heavy components for performance - using V2 with proper drag feedback
const LazyKanbanView = React.lazy(() => 
  import('./TasksKanbanV2').then(module => ({ default: module.default }))
)

const LazyTimelineView = React.lazy(() => 
  import('./timeline/TasksTimeline').then(module => ({ default: module.TasksTimeline }))
)

// Loading component for tab content
function TaskViewLoader({ view }: { view: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Loading {view} view...</p>
      </div>
    </div>
  )
}

/**
 * Main Tasks Feature Component with Tabbed Interface
 * 
 * Features:
 * - Performant tab switching with lazy loading
 * - Automatic component unmounting for memory efficiency  
 * - Three views: Table (VibeGridOptimus), Kanban, Timeline
 * - Shared state management via XState atoms
 */
const Tasks: React.FC = () => {
  performance.mark('tasks-component-start')
  console.log('[Performance] Tasks component render started')
  // Get theme and resolve 'system' to actual theme - React Compiler will optimize this
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Search param support for unified navigation
  const navigate = useNavigate()
  const searchParams = useSearch({ from: '/_authenticated/tasks/' }) as { view?: string }
  const currentView = searchParams.view || 'table'

  const handleTabChange = (value: string) => {
    performance.mark('tab-change-start')
    console.log('[Performance] Tab change started')
    
    performance.mark('navigate-start')
    navigate({ 
      to: '/tasks',
      search: { view: value }
    })
    performance.mark('navigate-end')
    performance.measure('navigate-duration', 'navigate-start', 'navigate-end')
    
    // Measure total tab change after next tick
    setTimeout(() => {
      performance.mark('tab-change-end')
      performance.measure('tab-change-total', 'tab-change-start', 'tab-change-end')
      const measure = performance.getEntriesByName('tab-change-total')[0]
      console.log(`[Performance] Tab change took ${measure.duration.toFixed(2)}ms`)
    }, 0)
  }



  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight mb-2">Tasks</h1>
        <p className="text-muted-foreground">
          Manage and track all your tasks across different views.
        </p>
      </div>
      
      {/* Tabbed Interface with search param support */}
      <Tabs value={currentView} onValueChange={handleTabChange} className="flex flex-col flex-1">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="table" className="flex items-center gap-2">
            <Grid3X3 className="h-4 w-4" />
            Table View
          </TabsTrigger>
          <TabsTrigger value="kanban" className="flex items-center gap-2">
            <Kanban className="h-4 w-4" />
            Kanban Board
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Timeline
          </TabsTrigger>
        </TabsList>
        
        {/* Table View */}
        <TabsContent value="table" className="flex-1">
          <TaskTableView theme={effectiveTheme} />
        </TabsContent>
        
        {/* Kanban View */}
        <TabsContent value="kanban" className="flex-1">
          <Suspense fallback={<TaskViewLoader view="Kanban" />}>
            <LazyKanbanView />
          </Suspense>
        </TabsContent>
        
        {/* Timeline View */}
        <TabsContent value="timeline" className="flex-1">
          <Suspense fallback={<TaskViewLoader view="Timeline" />}>
            <LazyTimelineView />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Tasks;
