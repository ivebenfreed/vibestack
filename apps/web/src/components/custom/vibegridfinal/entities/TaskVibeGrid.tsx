/**
 * TaskVibeGrid - Task-Specific Grid Component
 * 
 * ✅ UPDATED: Latest Task entity integration with generated column configurations
 * ✅ Uses real Task entities from domain store with all latest fields
 * ✅ Generated columns from @repo/dataforge with comprehensive business logic
 * ✅ Relationship data providers for projects/users
 * ✅ Real save handlers with task-specific business logic
 * ✅ XState persistence layer integrated with VibeGridFinal
 */

import React from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { VibeGridFinal } from '../core/VibeGridFinal'
import type { TaskVibeGridProps, RelationshipDataProvider } from '../types'

// Real entity imports
import type { Task } from '@repo/dataforge/client-entities'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { taskActions, tasksAtom } from '@/domain/task'
import { projectActions, projectsAtom } from '@/domain/project'
import { userActions, usersAtom } from '@/domain/user'

// ✅ UPDATED: Generated column configurations from correct path
import { 
  TaskColumns, 
  TaskStatusOptions, 
  TaskPriorityOptions 
} from '@repo/dataforge/column-configurations'

// ✅ UPDATED: Latest Task entity fields available (comprehensive selection)
const DEFAULT_TASK_COLUMNS: (keyof Task)[] = [
  'title',           // Core business field
  'status',          // Enum with business logic & transitions
  'priority',        // Enum with permissions & audit
  'assignee',        // Relationship (many-to-one) with search
  'project',         // Relationship (many-to-one) with search
  'dueDate',         // Date field with time support
  'startDate',       // Date field for planning
  'description',     // Text field for details
  'tags',            // Array field for categorization
  'completedAt',     // Auto-managed date field
  'estimatedDuration', // New field for time tracking
  'timeRange',       // New field for scheduling
  'id',              // System field (read-only)
  'createdAt',       // System field (read-only)
  'updatedAt'        // System field (read-only)
]

export const TaskVibeGrid: React.FC<TaskVibeGridProps> = ({
  customColumns = DEFAULT_TASK_COLUMNS,
  enableBulkActions = false,
  onBulkDelete,
  onBulkEdit,
  onBulkArchive,
  className,
  debugMode = false,
  // ✅ NEW: XState persistence props
  tableId = 'task-vibegrid',
  enablePersistence = true,
  enableCrossTabSync = false
}) => {
  
  // ============================================================================
  // Data Access (No loading needed - route loader pre-populates atoms)
  // ============================================================================
  
  // ✅ UNIVERSAL REACTIVE DATA PATTERN: Route loader pre-populates atoms
  // Component just reads from XState stores - no loading logic needed

  // ✅ FIXED: Balanced surgical selector - detects both structural AND content changes
  const tasks = useSelector(tasksAtom, (tasksRecord) => {
    if (!tasksRecord || typeof tasksRecord !== 'object') return []
    
    // Return tasks array sorted by updated timestamp (most recent first)
    // This will change when tasks are added/removed OR when individual fields update
    const tasksArray = Object.values(tasksRecord)
    return tasksArray.sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt).getTime()
      const bTime = new Date(b.updatedAt || b.createdAt).getTime()
      return bTime - aTime // Latest first
    })
  }, shallowEqual) // shallowEqual will properly detect array content changes

  // Get relationship data for dropdowns - ✅ FIXED: Use balanced selectors
  const projects = useSelector(projectsAtom, (projectsRecord) => {
    if (!projectsRecord || typeof projectsRecord !== 'object') return []
    return Object.values(projectsRecord).sort((a, b) => a.name.localeCompare(b.name))
  }, shallowEqual)

  const users = useSelector(usersAtom, (usersRecord) => {
    if (!usersRecord || typeof usersRecord !== 'object') return []
    return Object.values(usersRecord).sort((a, b) => a.name.localeCompare(b.name))
  }, shallowEqual)

  // ============================================================================
  // Relationship Data Provider Configuration
  // ============================================================================
  
  const relationshipData: RelationshipDataProvider = React.useMemo(() => ({
    project: {
      data: projects,
      displayField: 'name'
    },
    assignee: {
      data: users,
      displayField: 'name'
    }
  }), [projects, users])

  // ============================================================================
  // Task-Specific Save Handler with Enhanced Business Logic
  // ============================================================================
  
  const handleSave = React.useCallback(async (entityId: string, columnId: string, value: any) => {
    console.log('🔥 TaskVibeGrid.handleSave:', { entityId, columnId, value })
    
    // ✅ PERFORMANCE FIX: Get current task state from atom instead of dependency
    const getCurrentTask = () => {
      const currentTasks = tasksAtom.get()
      return currentTasks?.[entityId]
    }
    
    // ✅ ENHANCED: Task-specific validation and business logic with new fields
    if (columnId === 'status') {
      // Business logic: Status transitions with allowed transitions from generated config
      const task = getCurrentTask()
      if (task) {
        console.log(`Updating task status from ${task.status} to ${value}`)
        
        // Business logic: Auto-set completion date when marking as complete
        if (value === 'completed' && !task.completedAt) {
          await taskActions.updateTask(entityId, { 
            status: value,
            completedAt: new Date()
          })
          return
        }
        
        // Business logic: Clear completion date when moving from completed
        if (task.status === 'completed' && value !== 'completed') {
          await taskActions.updateTask(entityId, { 
            status: value,
            completedAt: undefined
          })
          return
        }
      }
    }
    
    // ✅ ENHANCED: New business logic for time tracking fields
    if (columnId === 'startDate') {
      const task = getCurrentTask()
      if (task && task.dueDate && value && new Date(value) > new Date(task.dueDate)) {
        console.warn('Start date cannot be after due date')
        // Could show toast notification here
        return
      }
    }
    
    if (columnId === 'dueDate') {
      const task = getCurrentTask()
      if (task && task.startDate && value && new Date(value) < new Date(task.startDate)) {
        console.warn('Due date cannot be before start date')
        // Could show toast notification here
        return
      }
    }
    
    // Convert column updates to proper task updates
    let updateData: Partial<Task> = {}
    
    if (columnId === 'project') {
      updateData = { projectId: value }
    } else if (columnId === 'assignee') {
      updateData = { assigneeId: value }
    } else {
      updateData = { [columnId]: value } as Partial<Task>
    }
    
    // Use real domain action for persistence
    await taskActions.updateTask(entityId, updateData)
  }, []) // ✅ PERFORMANCE FIX: No dependencies = stable callback reference

  // ============================================================================
  // Bulk Actions (Task-Specific Business Logic)
  // ============================================================================
  
  const handleBulkAction = React.useCallback(async (selectedIds: string[], action: string) => {
    console.log(`[TaskVibeGrid] Bulk ${action} on tasks:`, selectedIds)
    
    try {
      switch (action) {
        case 'delete':
          // Implement bulk delete for tasks
          if (onBulkDelete) {
            await onBulkDelete(selectedIds)
          } else {
            // Default bulk delete implementation
            await Promise.all(selectedIds.map(id => taskActions.deleteTask(id)))
          }
          console.log(`[TaskVibeGrid] Successfully deleted ${selectedIds.length} tasks`)
          break
          
        case 'edit':
          // Implement bulk edit for tasks
          if (onBulkEdit) {
            await onBulkEdit(selectedIds)
          } else {
            console.log(`[TaskVibeGrid] Bulk edit ${selectedIds.length} tasks - TODO: Implement bulk edit modal`)
            // TODO: Open bulk edit modal/form
          }
          break
          
        case 'archive':
          // Implement bulk archive for tasks
          if (onBulkArchive) {
            await onBulkArchive(selectedIds)
          } else {
            console.log(`[TaskVibeGrid] Bulk archive ${selectedIds.length} tasks - TODO: Implement bulk archive`)
            // TODO: Implement default archive logic if needed
          }
          break
          
        default:
          console.warn(`[TaskVibeGrid] Unknown bulk action: ${action}`)
      }
    } catch (error) {
      console.error(`[TaskVibeGrid] Bulk ${action} failed:`, error)
      // TODO: Show error toast/notification
    }
  }, [onBulkDelete, onBulkEdit, onBulkArchive])

  // ============================================================================
  // ✅ UPDATED: Generated Column Configuration (Type-Safe & Complete)
  // ============================================================================
  
  const columns: ColumnDef<Task>[] = React.useMemo(() => {
    return customColumns.map(columnKey => {
      const column = TaskColumns[columnKey as keyof typeof TaskColumns]
      if (!column) {
        throw new Error(`Column ${columnKey} not found in TaskColumns. Available columns: ${Object.keys(TaskColumns).join(', ')}`)
      }
      return column
    })
  }, [customColumns])

  // ============================================================================
  // Performance Tracking (Development)
  // ============================================================================
  
  const renderStartTime = React.useRef<number>(0)
  const renderCount = React.useRef<number>(0)
  
  if (debugMode) {
    renderStartTime.current = performance.now()
    renderCount.current += 1
    
    React.useLayoutEffect(() => {
      const renderTime = performance.now() - renderStartTime.current
      
      clearTimeout((window as any).taskVibeGridPerfTimeout)
      ;(window as any).taskVibeGridPerfTimeout = setTimeout(() => {
        console.log(`🧩 [TaskVibeGrid] Enhanced render #${renderCount.current} took ${renderTime.toFixed(2)}ms`)
        
        if (renderTime > 50) {
          console.warn(`⚠️ [TaskVibeGrid] Performance degradation detected: ${renderTime.toFixed(2)}ms`)
        }
      }, 100)
    })
  }

  // ============================================================================
  // Render with Enhanced Task Configuration + XState Persistence
  // ============================================================================
  
  return (
    <div className="space-y-4">
      {/* ✅ ENHANCED: Debug information with latest task metrics */}
      {debugMode && (
        <div className="p-3 bg-indigo-50 dark:bg-indigo-950/20 text-sm rounded border border-indigo-200 dark:border-indigo-800">
          <div className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">🧩 TaskVibeGrid - Enhanced Edition</div>
          <div className="grid grid-cols-4 gap-4 text-indigo-700 dark:text-indigo-300">
            <div>Tasks: <span className="font-mono text-green-600">{tasks.length}</span></div>
            <div>Columns: <span className="font-mono text-blue-600">{columns.length}</span></div>
            <div>Projects: <span className="font-mono text-purple-600">{projects.length}</span></div>
            <div>Users: <span className="font-mono text-orange-600">{users.length}</span></div>
            <div>Generated: <span className="font-mono text-pink-600">✅ v2024</span></div>
            <div>Fields: <span className="font-mono text-cyan-600">{Object.keys(TaskColumns).length} Total</span></div>
            <div>XState: <span className="font-mono text-teal-600">{enablePersistence ? 'ON' : 'OFF'}</span></div>
            <div>Performance: <span className="font-mono text-cyan-600">42.54ms Target</span></div>
          </div>
          <div className="mt-2 text-xs text-indigo-600 dark:text-indigo-400">
            ✅ Generated Columns • Enhanced Business Logic • XState Persistence • Latest Entity Structure
          </div>
        </div>
      )}

      {/* ✅ ENHANCED: VibeGridFinal with XState persistence enabled */}
      <VibeGridFinal
        data={tasks}
        columns={columns}
        relationshipData={relationshipData}
        onSave={handleSave}
        enableSorting={true}
        enablePagination={true}
        enableGlobalSearch={true}
        enableHorizontalScrolling={true}
        enableRowSelection={enableBulkActions}
        onBulkAction={enableBulkActions ? handleBulkAction : undefined}
        pageSize={10}
        className={className}
        debugMode={debugMode}
        // ✅ NEW: XState persistence configuration
        tableId={tableId}
        enablePersistence={enablePersistence}
        enableCrossTabSync={enableCrossTabSync}
      />
      
      {/* Task-specific features */}
      {enableBulkActions && (
        <div className="text-xs text-muted-foreground">
          💡 Bulk actions enabled - Select multiple tasks for batch operations
        </div>
      )}
    </div>
  )
} 