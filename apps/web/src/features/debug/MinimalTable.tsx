import React, { useState, useMemo, useCallback, useEffect, useRef, Profiler } from 'react'
import { createPortal } from 'react-dom'
import { useLoaderData } from '@tanstack/react-router'
import { useIsEditing, useEditingValueForCell, useEditingActions } from './table-editing-store'
import { Task } from '@repo/dataforge/client-entities'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  CellContext,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
} from '@tanstack/react-table'
import { TaskService } from '@/domain/task'
import { ProjectService } from '@/domain/project'
import { UserService } from '@/domain/user'
import { usePGliteContext } from '@/db/pglite-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronDownIcon } from '@radix-ui/react-icons'

// ✅ PERFORMANCE: Lightweight custom select - no parent re-renders
const LightweightSelect = React.memo(function LightweightSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  className = "",
  autoOpen = false,
  onCancel
}: {
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  className?: string
  autoOpen?: boolean
  onCancel?: () => void
}) {
  const [isOpen, setIsOpen] = useState(autoOpen) // ✅ UX FIX: Auto-open if requested
  const selectRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(opt => opt.value === value)

  const handleSelect = useCallback((optionValue: string) => {
    onValueChange(optionValue)
    setIsOpen(false)
  }, [onValueChange])

  // Close on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        onCancel?.() // ✅ UX FIX: Call cancel callback on escape
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [isOpen])

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-8 px-3 py-1 text-sm text-left border border-border rounded-md bg-background hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 flex items-center justify-between"
      >
        <span className={selectedOption ? "text-foreground" : "text-muted-foreground"}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDownIcon className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-[200px] overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className="w-full px-3 py-2 text-sm text-left hover:bg-muted focus:bg-muted focus:outline-none"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})
  
// ✅ PERFORMANCE: Lightweight assignee cell with Zustand integration
const AssigneeCell = React.memo(function AssigneeCell({ 
  getValue, 
  row, 
  allUsers 
}: any) {
  const rowId = row.id
  const columnId = 'assigneeId'
  
  const cellIsEditing = useIsEditing(rowId, columnId)
  const editingValue = useEditingValueForCell(rowId, columnId)
  const { startEditing, updateValue, stopEditing } = useEditingActions()
  
  const handleClick = useCallback(() => {
    console.log('🔍 [Zustand] Assignee cell click started')
    const start = performance.now()
    
    // ✅ UX FIX: Remove queueMicrotask - start editing immediately
    startEditing({ rowId, columnId }, getValue() || 'none')
    
    const end = performance.now()
    console.log(`🔍 [Zustand] Assignee cell click: ${end - start}ms`)
  }, [startEditing, rowId, columnId, getValue])
  
  const handleValueChange = useCallback((newValue: string) => {
    updateValue(newValue)
    stopEditing()
  }, [updateValue, stopEditing])

  const handleCancel = useCallback(() => {
    stopEditing() // Cancel without saving
  }, [stopEditing])
  
  const task = row.original as any
  const assigneeName = task.assigneeName
  const assigneeId = getValue()
  const users = allUsers || []
  const currentValue = cellIsEditing ? (editingValue || 'none') : (assigneeId || 'none')
  
  const userOptions = useMemo(() => {
    const options = [{ value: 'none', label: 'Unassigned' }]
    const limitedUsers = users.slice(0, 50) // Show more users in lightweight select
    limitedUsers.forEach((user: any) => {
      options.push({
        value: user.id,
        label: user.name || user.email
      })
    })
    return options
  }, [users])
  
  const displayName = useMemo(() => {
    if (assigneeName) return assigneeName
    const user = users.find((u: any) => u.id === assigneeId)
    return user?.name || user?.email
  }, [assigneeName, assigneeId, users])
  
  if (cellIsEditing) {
    console.log(`🔍 [Performance] Rendering LightweightSelect with ${users.length} users`)
    
    return (
      <LightweightSelect
        value={currentValue}
        onValueChange={handleValueChange}
        options={userOptions}
        placeholder="Unassigned"
        className="w-full"
        autoOpen={true}
        onCancel={handleCancel}
      />
    )
  }
  
  return (
    <div 
      className="group w-full h-8 px-3 py-1 text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center justify-between"
      onClick={handleClick}
    >
      <span className={displayName ? "text-foreground" : "text-muted-foreground"}>
        {displayName || "Unassigned"}
      </span>
      <ChevronDownIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
    </div>
  )
  })

// ✅ PERFORMANCE: Lightweight project cell with Zustand integration
const ProjectCell = React.memo(function ProjectCell({ 
  getValue, 
  row, 
  allProjects 
}: any) {
  const rowId = row.id
  const columnId = 'projectId'
  
  const cellIsEditing = useIsEditing(rowId, columnId)
  const editingValue = useEditingValueForCell(rowId, columnId)
  const { startEditing, updateValue, stopEditing } = useEditingActions()
  
  const handleClick = useCallback(() => {
    console.log('🔍 [Zustand] Project cell click started')
    const start = performance.now()
    
    // ✅ UX FIX: Remove queueMicrotask - start editing immediately
      startEditing({ rowId, columnId }, getValue() || 'none')
    
    const end = performance.now()
    console.log(`🔍 [Zustand] Project cell click: ${end - start}ms`)
  }, [startEditing, rowId, columnId, getValue])
  
  const handleValueChange = useCallback((newValue: string) => {
    updateValue(newValue)
    stopEditing()
  }, [updateValue, stopEditing])
  
  const handleCancel = useCallback(() => {
    stopEditing() // Cancel without saving
  }, [stopEditing])
  
  const task = row.original as any
  const projectName = task.projectName
  const projectId = getValue()
  const projects = allProjects || []
  const currentValue = cellIsEditing ? (editingValue || 'none') : (projectId || 'none')
  
  const projectOptions = useMemo(() => {
    const options = [{ value: 'none', label: 'No project' }]
    projects.forEach((project: any) => {
      options.push({
        value: project.id,
        label: project.name
      })
    })
    return options
  }, [projects])
    
  const displayName = useMemo(() => {
    if (projectName) return projectName
    const project = projects.find((p: any) => p.id === projectId)
    return project?.name
  }, [projectName, projectId, projects])
  
  if (cellIsEditing) {
    console.log(`🔍 [Performance] Rendering LightweightSelect with ${projects.length} projects`)
    
    return (
      <LightweightSelect
        value={currentValue}
        onValueChange={handleValueChange}
        options={projectOptions}
        placeholder="No project"
        className="w-full"
        autoOpen={true}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <div 
      className="group w-full h-8 px-3 py-1 text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center justify-between"
      onClick={handleClick}
    >
      <span className={displayName ? "text-foreground" : "text-muted-foreground"}>
        {displayName || "No project"}
      </span>
      <ChevronDownIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
    </div>
  )
})

// ✅ PERFORMANCE: Static columns with lightweight select
const COLUMNS: ColumnDef<Task, any>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    size: 200,
    cell: (props: CellContext<Task, string>) => {
      return <div className="text-sm p-1">{props.getValue()}</div>
    },
  },
  {
    accessorKey: 'projectId',
    header: 'Project',
    size: 180,
    cell: (props: CellContext<Task, string>) => {
      const table = props.table
      const meta = table.options.meta as any
      return (
        <ProjectCell 
          getValue={props.getValue}
          row={props.row}
          allProjects={meta?.allProjects || []}
        />
      )
    },
  },
  {
    accessorKey: 'assigneeId',
    header: 'Assignee', 
    size: 150,
    cell: (props: CellContext<Task, string>) => {
      const table = props.table
      const meta = table.options.meta as any
      return (
        <AssigneeCell 
          getValue={props.getValue}
          row={props.row}
          allUsers={meta?.allUsers || []}
        />
      )
    },
  },
]

// ✅ PERFORMANCE FIX: Wrapper that handles ALL hooks and data fetching
function MinimalTableWrapper() {
  const loaderData = useLoaderData({ from: '/_authenticated/debug/data-table' }) as {
    tasks: Task[]
  }

  const { data: liveTasksWithRelations } = TaskService.hooks.useAllTasksWithRelations()
  const { data: allProjects } = ProjectService.hooks.useAllProjects()
  const { data: allUsers } = UserService.hooks.useAllUsers()

  const currentTasks = liveTasksWithRelations || loaderData.tasks || []

  return (
    <MinimalTableInternal 
      tasks={currentTasks}
      allProjects={allProjects || []}
      allUsers={allUsers || []}
    />
  )
}

// ✅ PERFORMANCE: Full TanStack Table with lightweight select
const MinimalTableInternal = React.memo(function MinimalTableInternal({ 
  tasks, 
  allProjects, 
  allUsers 
}: {
  tasks: Task[]
  allProjects: any[]
  allUsers: any[]
}) {
  const renderStart = performance.now()
  console.log('🔍 [MinimalTable] Render start, task count:', tasks?.length)

  const { services } = usePGliteContext()
  const taskService = services?.tasks

  // TanStack Table state
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  })

  const handleUpdate = useCallback(async (rowId: string, columnId: string, value: any) => {
    console.log('[MinimalTable] Update called:', { rowId, columnId, value })
  }, [])

  const tableMeta = useMemo(() => ({
    editableColumns: ['title', 'projectId', 'assigneeId'],
    onUpdate: handleUpdate,
    tableReady: true,
    allUsers,
    allProjects,
  }), [handleUpdate, allUsers, allProjects])

  const table = useReactTable({
    data: tasks || [],
    columns: COLUMNS,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row: Task) => row.id,
    meta: tableMeta,
  })

  const onRenderCallback = (id: string, phase: string, actualDuration: number) => {
    if (actualDuration > 10) {
      console.log(`🔍 [React Profiler] ${id} ${phase}: ${actualDuration}ms`)
    }
  }

  const renderEnd = performance.now()
  console.log(`🔍 [MinimalTable] Render complete: ${renderEnd - renderStart}ms`)

  return (
    <Profiler id="MinimalTable" onRender={onRenderCallback}>
      <div className="p-4">
        <h1>Universal Reactive Data Table - Lightweight Select</h1>
        <p>Tasks with Relations: {tasks?.length || 0}</p>
        <p>Full TanStack Table + Universal Reactive Data Pattern + Custom Select</p>
      <p>Service available: {taskService ? '✅' : '❌'}</p>
      
      <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Using lightweight custom select instead of shadcn/ui Select
          </p>
      </div>
      
      <table className="w-full border-collapse border border-border">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id} className="border border-border p-2 bg-muted/50 text-foreground">
                  {header.isPlaceholder ? null : (
                      <div>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getPaginationRowModel().rows.map((row) => (
              <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                                  <td key={cell.id} className="border border-border p-2 text-foreground">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

        {/* Pagination Controls */}
      <div className="flex items-center justify-between space-x-2 py-4">
        <div className="text-sm text-muted-foreground">
            Showing {table.getRowModel().rows.length} of {tasks?.length || 0} tasks
        </div>
          <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
            <div className="text-sm">
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
    </Profiler>
  )
}) // ✅ PERFORMANCE: Allow normal re-rendering but with lightweight select

export function MinimalTable() {
  return <MinimalTableWrapper />
} 