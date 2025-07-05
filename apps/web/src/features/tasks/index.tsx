import React, { Suspense } from 'react'
import { VibeGridOptimus } from '@/components/custom/vibegridoptimus/VibeGridOptimus'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { Task } from '@repo/dataforge/client-entities'
import { tasksAtom } from '@/domain/task'
import { createVibeGrid } from '@/components/custom/vibegridoptimus/hooks/useValidatedVibeGrid'
import { Grid3X3, Kanban, Calendar } from 'lucide-react'
import { useTheme } from '@/context/theme-context'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'

// Separate component for table view to isolate hooks
const TaskTableView: React.FC<{ theme: string }> = ({ theme }) => {
  const tableViewStart = performance.now()
  console.log('[TaskTableView] 🚀 Starting TaskTableView render')
  
  // ✅ TYPE-SAFE VIBEGRID: Hooks only called when component is rendered
  const taskGridProps = createVibeGrid({
    entityName: "Task",
    atom: tasksAtom
  })

  // Debug: Compare direct atom vs component data
  const directAtomData = useSelector(tasksAtom, (record) => Object.values(record), shallowEqual)
  const testTaskDirect = directAtomData.find(t => t.id === '2f0b48f6-2e54-49e2-a1f0-986eb1ed8c1b')
  const testTaskComponent = taskGridProps.data.find(t => t.id === '2f0b48f6-2e54-49e2-a1f0-986eb1ed8c1b')
  
  console.log('TaskTableView - DIRECT ATOM priority:', testTaskDirect?.priority)
  console.log('TaskTableView - COMPONENT priority:', testTaskComponent?.priority)
  
  React.useEffect(() => {
    const renderTime = performance.now() - tableViewStart
    console.log(`[TaskTableView] ✅ Render completed in ${renderTime.toFixed(2)}ms`)
  })

  return (
    <VibeGridOptimus
      {...taskGridProps}
      height={600}
      theme={theme}
      className="border border-border rounded-lg"
    />
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
  const tasksComponentStart = performance.now()
  console.log('[Tasks] 🚀 Starting Tasks component render')
  
  // Check if we're measuring route click time
  if ((window as any).__routeClickStart) {
    const clickToRenderTime = performance.now() - (window as any).__routeClickStart
    console.log(`[ROUTE CLICK] ⏱️ Click to render: ${clickToRenderTime.toFixed(2)}ms`)
    if (clickToRenderTime > 150) {
      console.warn(`[ROUTE CLICK] 🚨 VIOLATION: ${clickToRenderTime.toFixed(2)}ms exceeds 150ms threshold`)
    }
    delete (window as any).__routeClickStart
  }
  
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
    const changeStart = performance.now()
    console.log(`[Tasks] 📍 Tab change to ${value} initiated`)
    
    // Wrap in performance measurement
    const measurePerformance = () => {
      const elapsed = performance.now() - changeStart
      console.log(`[Tasks] ⏱️ Tab change took ${elapsed.toFixed(2)}ms so far`)
      
      if (elapsed > 100) {
        console.warn(`[Tasks] 🚨 SLOW TAB CHANGE: ${elapsed.toFixed(2)}ms - this might be the violation source`)
      }
    }
    
    // Measure at different points
    measurePerformance()
    
    navigate({ 
      to: '/tasks',
      search: { view: value }
    })
    
    measurePerformance()
    
    // Check after next tick
    setTimeout(measurePerformance, 0)
    
    // Check after animation frame
    requestAnimationFrame(measurePerformance)
  }
  
  React.useEffect(() => {
    const renderTime = performance.now() - tasksComponentStart
    console.log(`[Tasks] ✅ Render completed in ${renderTime.toFixed(2)}ms`)
    
    // Track what happens AFTER React finishes
    setTimeout(() => {
      const postRenderTime = performance.now() - tasksComponentStart
      console.log(`[Tasks] 📊 Post-render (next tick) at ${postRenderTime.toFixed(2)}ms`)
    }, 0)
    
    // Track layout completion
    requestAnimationFrame(() => {
      const rafTime = performance.now() - tasksComponentStart
      console.log(`[Tasks] 🎨 RAF (layout/paint) at ${rafTime.toFixed(2)}ms`)
      
      // Check one more frame for any async work
      requestAnimationFrame(() => {
        const raf2Time = performance.now() - tasksComponentStart
        console.log(`[Tasks] 🎯 RAF2 (post-paint) at ${raf2Time.toFixed(2)}ms`)
      })
    })
    
    // Add temporary click timing listener
    const clickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (target.closest('[href*="/tasks"]') || target.closest('[role="tab"]')) {
        window.__routeClickStart = performance.now()
        console.log('[ROUTE CLICK] 🖱️ Navigation click detected')
      }
    }
    
    document.addEventListener('click', clickHandler, true)
    return () => document.removeEventListener('click', clickHandler, true)
  })



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
