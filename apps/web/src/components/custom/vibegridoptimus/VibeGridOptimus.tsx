import React from 'react'
import { DataGrid, type DataGridHandle } from 'react-data-grid'
import type { VibeGridOptimusProps } from './types'
import { getRDGColumns, TaskRDGColumns } from '@repo/dataforge/rdg-column-configurations'
import { useBatchOperations } from './hooks/useBatchOperations'
import { useClipboardOps } from './hooks/useClipboardOps'
import { useGridMachine } from './hooks/useGridMachine'
import { CellRenderer } from './renderers/CellRenderer'
import { CellEditor } from './editors/CellEditor'
import { GRID_DEFAULTS, CSS_CLASSES } from './utils/constants'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import { projectsAtom } from '@/domain/project'
import { usersAtom } from '@/domain/user'
import { tasksAtom } from '@/domain/task'
import 'react-data-grid/lib/styles.css'
import './VibeGridOptimus.css'

// Deferred DataGrid component to avoid blocking route navigation
const DeferredDataGrid = React.memo(({ 
  gridRef, 
  optimusColumns, 
  sortedData, 
  gridMachine, 
  handleFill, 
  handleCellCopy, 
  handleCellPaste, 
  handleRowsChange, 
  theme, 
  height 
}: {
  gridRef: React.RefObject<DataGridHandle>
  optimusColumns: any[]
  sortedData: any[]
  gridMachine: any
  handleFill: any
  handleCellCopy: any
  handleCellPaste: any
  handleRowsChange: any
  theme: string
  height: string | number
}) => {
  const [showDataGrid, setShowDataGrid] = React.useState(false)
  
  React.useEffect(() => {
    // Defer the heavy DataGrid render to next tick
    const timer = setTimeout(() => {
      console.log('[DeferredDataGrid] 🚀 Starting deferred DataGrid render')
      setShowDataGrid(true)
    }, 0)
    
    return () => clearTimeout(timer)
  }, [])
  
  if (!showDataGrid) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }
  
  // Log render time when DataGrid actually renders
  React.useEffect(() => {
    console.log('[DeferredDataGrid] ✅ DataGrid is now visible')
  }, [showDataGrid])
  
  return (
    <DataGrid
      ref={gridRef}
      columns={optimusColumns}
      rows={sortedData}
      sortColumns={gridMachine.sortColumns.map(sc => ({ columnKey: sc.columnKey, direction: sc.direction }))}
      onSortColumnsChange={(columns) => {
        const sortColumns = columns.map(col => ({
          columnKey: col.columnKey,
          direction: col.direction as 'ASC' | 'DESC'
        }))
        gridMachine.setSortColumns(sortColumns)
      }}
      selectedPosition={null} // Grid machine handles selection
      onSelectedCellChange={(position) => {
        if (position) {
          const column = optimusColumns[position.idx]
          if (column) {
            const row = sortedData[position.rowIdx]
            if (row) {
              gridMachine.selectCell(`${row.id}:${column.key}`)
            }
          }
        }
      }}
      cellNavigationMode="CHANGE_ROW"
      enableVirtualization={true}
      onFill={handleFill}
      onCellCopy={handleCellCopy}
      onCellPaste={handleCellPaste}
      onRowsChange={handleRowsChange}
      className={`${theme === 'dark' ? 'rdg-dark' : 'rdg-light'} rdg-spreadsheet`}
      style={{ height }}
    />
  )
})

/**
 * VibeGridOptimus - Clean declarative data grid with comprehensive XState management
 * 
 * Key Features:
 * - Declarative entity-based API with XState grid machine
 * - Comprehensive state management (sorting, filtering, selection, persistence)
 * - Cell-level optimistic updates with conflict resolution
 * - Automatic column and relationship resolution from DataForge
 * - Full react-data-grid features with enhanced state coordination
 * - Type-safe with entity name system
 * - Local persistence and performance optimization
 */
export function VibeGridOptimus(props: VibeGridOptimusProps) {
  performance.mark('vibegrid-render-start')
  const componentStart = performance.now()
  console.log(`[VibeGridOptimus] 🚀 COMPONENT RENDER: Starting component for ${props.entityName} with ${props.data.length} items`)
  
  // Debug what's causing re-renders
  const prevPropsRef = React.useRef<VibeGridOptimusProps>()
  React.useEffect(() => {
    if (prevPropsRef.current) {
      const changes = []
      if (prevPropsRef.current.data !== props.data) changes.push('data')
      if (prevPropsRef.current.onSave !== props.onSave) changes.push('onSave')
      if (prevPropsRef.current.theme !== props.theme) changes.push('theme')
      if (prevPropsRef.current.entityName !== props.entityName) changes.push('entityName')
      
      if (changes.length > 0) {
        console.log(`[VibeGridOptimus] 🔄 Props changed, causing re-render:`, changes)
      }
    }
    prevPropsRef.current = props
  })
  
  const {
    entityName,
    data,
    onSave,
    height = GRID_DEFAULTS.height,
    theme = GRID_DEFAULTS.theme,
    className = '',
    style = {},
    isLoading = false,
    error = null
  } = props
  
  // Calculate effective theme for CSS classes
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme
  
  // Grid ref for advanced operations
  const gridRef = React.useRef<DataGridHandle>(null)
  
  // Initialize comprehensive grid machine
  const gridMachineStart = performance.now()
  const gridMachine = useGridMachine({
    entityName,
    persistenceKey: `vibeGrid-${entityName}`,
    initialPageSize: 50
  })
  const gridMachineTime = performance.now() - gridMachineStart
  console.log(`[VibeGridOptimus] ⚡ Grid machine initialized in ${gridMachineTime.toFixed(2)}ms`)
  if (gridMachineTime > 20) {
    console.warn(`[VibeGridOptimus] 🐌 SLOW GRID MACHINE: ${gridMachineTime.toFixed(2)}ms`)
  }
  
  // Get pre-generated columns directly from DataForge - React Compiler handles memoization
  const columnsStart = performance.now()
  const rdgColumns = (() => {
    try {
      return getRDGColumns(entityName)
    } catch (error) {
      console.warn('getRDGColumns not available, falling back to direct import for Tasks:', error)
      // Fallback for development - use direct import for Task entity
      if (entityName === 'Task') {
        return TaskRDGColumns
      }
      return []
    }
  })()
  const columnsTime = performance.now() - columnsStart
  console.log(`[VibeGridOptimus] 📋 Column generation in ${columnsTime.toFixed(2)}ms`)
  if (columnsTime > 5) {
    console.warn(`[VibeGridOptimus] 🐌 SLOW COLUMNS: ${columnsTime.toFixed(2)}ms`)
  }
  
  // Use provided onSave handler directly
  const finalSaveHandler = onSave
  console.log('[VibeGridOptimus] 🔧 Final save handler:', { 
    hasOnSave: !!onSave, 
    hasFinalSaveHandler: !!finalSaveHandler 
  })
  
  // PERFORMANCE: Only get relationship records (not arrays) and resolve on-demand
  const projectsRecord = useSelector(projectsAtom, (record) => record, shallowEqual)
  const usersRecord = useSelector(usersAtom, (record) => record, shallowEqual)
  const tasksRecord = useSelector(tasksAtom, (record) => record, shallowEqual)
  
  // Lightweight relationship resolver - React Compiler handles memoization
  const relationshipResolver = {
    getProject: (id: string) => {
      const project = projectsRecord[id]
      return project ? { 
        value: project.id, 
        label: project.name || `Project ${project.id.slice(0, 8)}` 
      } : null
    },
    getUser: (id: string) => {
      const user = usersRecord[id]
      return user ? { 
        value: user.id, 
        label: user.name || user.email || `User ${user.id.slice(0, 8)}` 
      } : null
    },
    getTask: (id: string) => {
      const task = tasksRecord[id]
      return task ? { 
        value: task.id, 
        label: task.title || `Task ${task.id.slice(0, 8)}` 
      } : null
    },
    // Lazy dropdown options - only build when actually needed for editing
    getProjectOptions: () => Object.values(projectsRecord).map(p => ({ 
      value: p.id, 
      label: p.name || `Project ${p.id.slice(0, 8)}` 
    })),
    getUserOptions: () => Object.values(usersRecord).map(u => ({ 
      value: u.id, 
      label: u.name || u.email || `User ${u.id.slice(0, 8)}` 
    })),
    getTaskOptions: () => Object.values(tasksRecord).map(t => ({ 
      value: t.id, 
      label: t.title || `Task ${t.id.slice(0, 8)}` 
    }))
  }
  
  // PERFORMANCE: Empty relationship data for display, resolve lazily for editing
  const relationshipData = {
    project: [], // Don't build dropdown options until editing
    user: [],
    task: [],
    comment: []
  }
  
  // No more configError - pre-generated columns eliminate config issues
  
  // Initialize enhanced batch operations (keeping for bulk operations)
  const { processBatch, pendingUpdates, clearBatch } = useBatchOperations(finalSaveHandler)
  
  // Initialize clipboard operations
  const { copiedCell, handleCellCopy, handleCellPaste } = useClipboardOps()
  
  // Simple React state for sort persistence - survives re-renders
  const [sortColumns, setSortColumns] = React.useState<readonly import('react-data-grid').SortColumn[]>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(`vibeGrid-${entityName}-sort`)
      if (saved) {
        const parsed = JSON.parse(saved)
        console.log('[VibeGridOptimus] 📂 Loaded sort preferences:', parsed)
        return parsed
      }
    } catch (error) {
      console.warn('[VibeGridOptimus] ⚠️ Failed to load sort preferences:', error)
    }
    return []
  })
  
  // Use ref instead of state to avoid re-renders on selection
  const selectedPositionRef = React.useRef<{ row: number; idx: number } | null>(null)
  
  // Simple optimistic state to prevent flashing
  const [optimisticValues, setOptimisticValues] = React.useState<Record<string, any>>({})
  
  // Simple optimistic save to prevent flashing
  const gridMachineOnUpdate = async (id: string, column: string, value: any) => {
    console.log('[VibeGridOptimus] 🚀 Save with simple optimistic:', { id, column, value })
    
    const cellKey = `${id}:${column}`
    
    // Set optimistic value immediately
    setOptimisticValues(prev => ({ ...prev, [cellKey]: value }))
    
    if (finalSaveHandler) {
      try {
        console.log('[VibeGridOptimus] 📞 Calling finalSaveHandler')
        await finalSaveHandler(id, column, value)
        
        // Clear optimistic value after successful save - atom will take over
        setOptimisticValues(prev => {
          const updated = { ...prev }
          delete updated[cellKey]
          return updated
        })
        console.log('[VibeGridOptimus] ✅ Save completed, optimistic cleared')
        
      } catch (error) {
        // Keep optimistic value on error
        console.error('[VibeGridOptimus] ❌ Save failed, keeping optimistic:', error)
        throw error
      }
    } else {
      console.log('[VibeGridOptimus] ❌ No save handler available')
    }
  }
  
  // Handle content click for single-click editing
  const handleContentClick = React.useCallback((rowIdx: number, columnKey: string, event: React.MouseEvent) => {
    // Stop propagation to prevent normal cell selection
    event.stopPropagation()
    
    // Find the column configuration
    const rdgColumn = rdgColumns.find(col => col.key === columnKey)
    
    // If column is editable, enter edit mode using the correct react-data-grid API
    if (rdgColumn?.editable && gridRef.current) {
      
      // Use selectCell with enableEditor option to enter edit mode
      const columnIdx = rdgColumns.findIndex(col => col.key === columnKey)
      gridRef.current.selectCell({ rowIdx, idx: columnIdx }, { enableEditor: true })
    }
  }, [rdgColumns])
  
  // Let individual CellRenderers handle their own registration
  // This avoids duplicate registration and infinite loops
  
  // Get fresh data from atom records for sorting consistency with cell rendering
  const freshData = (() => {
    if (entityName === 'Task') {
      return Object.values(tasksRecord)
    } else if (entityName === 'Project') {
      return Object.values(projectsRecord)
    } else if (entityName === 'User') {
      return Object.values(usersRecord)
    }
    return data // Fallback to prop data
  })()

  // Sort data based on React state - React Compiler handles memoization
  const sortedData = (() => {
    const sortStart = performance.now()
    if (sortColumns.length === 0) {
      console.log(`[Sort] No sorting needed for ${freshData.length} items`)
      return freshData
    }
    
    const result = [...freshData].sort((a, b) => {
      for (const sort of sortColumns) {
        const column = rdgColumns.find(col => String(col.key) === sort.columnKey)
        if (!column) continue
        
        const aVal = a[column.key]
        const bVal = b[column.key]
        
        // Handle null/undefined values based on sort direction
        if (aVal == null && bVal == null) return 0
        if (aVal == null) return sort.direction === 'ASC' ? 1 : -1
        if (bVal == null) return sort.direction === 'ASC' ? -1 : 1
        
        // Type-specific comparisons based on RDG metadata
        let result = 0
        const cellType = column.rdgConfig?.cellType || 'text'
        switch (cellType) {
          case 'number':
            result = Number(aVal) - Number(bVal)
            break
          case 'date':
            result = new Date(aVal as any).getTime() - new Date(bVal as any).getTime()
            break
          case 'boolean':
            result = (aVal ? 1 : 0) - (bVal ? 1 : 0)
            break
          default:
            result = String(aVal).localeCompare(String(bVal))
        }
        
        if (result !== 0) {
          return sort.direction === 'ASC' ? result : -result
        }
      }
      return 0
    })
    
    const sortTime = performance.now() - sortStart
    console.log(`[Sort] Sorted ${freshData.length} items in ${sortTime.toFixed(2)}ms`)
    if (sortTime > 10) {
      console.warn(`[Sort] 🐌 SLOW SORT: ${sortTime.toFixed(2)}ms for ${freshData.length} items`)
    }
    return result
  })()
  
  

  // Handle rows change for enhanced batch operations
  const handleRowsChange = React.useCallback((rows: any[], { indexes }: { indexes: number[] }) => {
    if (!finalSaveHandler || indexes.length === 0) return
    
    console.log('[VibeGridOptimus] Processing', indexes.length, 'row changes with enhanced batching')
    
    // Process each row change through intelligent batching
    indexes.forEach(index => {
      const changedRow = rows[index]
      const originalRow = sortedData[index]
      
      if (!changedRow || !originalRow || changedRow === originalRow) {
        return
      }
      
      // Find what changed and batch each column update
      Object.keys(changedRow).forEach(column => {
        if (changedRow[column] !== originalRow[column]) {
          processBatch(changedRow.id, column, changedRow[column]).catch(error => {
            console.error('[VibeGridOptimus] Batch column update failed:', error)
          })
        }
      })
    })
  }, [sortedData, finalSaveHandler, processBatch])

  // Create stable renderer functions - React Compiler handles optimization
  const cellRendererProps = {
    onContentClick: handleContentClick,
    onUpdate: gridMachineOnUpdate,
    gridMachine: gridMachine
  }
  
  const cellEditorProps = {
    onUpdate: gridMachineOnUpdate,
    gridMachine: gridMachine
  }

  // Helper function to get badge CSS classes for enum values
  const getBadgeClass = React.useCallback((value: string, columnKey: string): string => {
    // Use CSS classes from the stylesheet for consistent styling
    const baseClasses = "badge"
    
    // Status-specific styling
    if (columnKey === 'status') {
      switch (value?.toLowerCase()) {
        case 'completed':
        case 'done':
          return `${baseClasses} bg-green-100 text-green-800`
        case 'in_progress':
        case 'in progress':
        case 'active':
          return `${baseClasses} bg-blue-100 text-blue-800`
        case 'todo':
        case 'pending':
          return `${baseClasses} bg-yellow-100 text-yellow-800`
        case 'cancelled':
        case 'failed':
          return `${baseClasses} bg-red-100 text-red-800`
        default:
          return `${baseClasses} badge-muted`
      }
    }
    
    // Priority-specific styling  
    if (columnKey === 'priority') {
      switch (value?.toLowerCase()) {
        case 'high':
        case 'urgent':
          return `${baseClasses} bg-red-100 text-red-800`
        case 'medium':
        case 'normal':
          return `${baseClasses} bg-yellow-100 text-yellow-800`
        case 'low':
          return `${baseClasses} bg-green-100 text-green-800`
        default:
          return `${baseClasses} badge-muted`
      }
    }
    
    // Default enum styling
    return `${baseClasses} badge-primary`
  }, [])

  // Pre-create click handlers outside render loop for performance
  const columnClickHandlers = (() => {
    const handlers: Record<string, (event: React.MouseEvent, rowIdx: number) => void> = {}
    
    rdgColumns.forEach(column => {
      if (column.editable) {
        handlers[column.key as string] = (event: React.MouseEvent, rowIdx: number) => {
          event.stopPropagation()
          handleContentClick(rowIdx, String(column.key), event)
        }
      }
    })
    
    return handlers
  })()

  // Pre-compute CSS classes to avoid template literal concatenation in render
  const precomputedClasses = {
    booleanTrue: `${CSS_CLASSES.cellDisplay} ${CSS_CLASSES.cellHover} text-green-600 font-bold`,
    booleanFalse: `${CSS_CLASSES.cellDisplay} ${CSS_CLASSES.cellHover} text-muted-foreground`,
    uuid: `${CSS_CLASSES.cellDisplay} ${CSS_CLASSES.cellHover} text-xs font-mono text-muted-foreground ${CSS_CLASSES.textOverflow}`,
    number: `${CSS_CLASSES.cellDisplayRight} ${CSS_CLASSES.cellHover} text-foreground font-mono`,
    textWithOverflow: `cursor-pointer px-2 hover:bg-muted rounded text-sm text-foreground transition-colors ${CSS_CLASSES.textOverflow}`,
    emptyState: "cursor-pointer px-2 hover:bg-muted rounded text-sm text-muted-foreground transition-colors",
    badgePrimary: `badge badge-primary ${CSS_CLASSES.cellHoverOpacity}`,
    relationshipContainer: "px-2 flex items-center"
  }

  // Pre-extract click handlers to avoid object lookups in render
  const getClickHandler = React.useCallback((columnKey: string, rowIdx: number) => {
    const handler = columnClickHandlers[columnKey]
    return handler ? { onClick: (event: React.MouseEvent) => handler(event, rowIdx) } : {}
  }, [columnClickHandlers])

  // Enhanced columns with grid machine integration - React Compiler handles optimization
  const optimusColumns = (() => {
    performance.mark('column-enhancement-start')
    const enhancementStart = performance.now()
    const result = rdgColumns.map((column) => {
      // Pre-generated columns already have enhanced metadata
      let mappedColumn = {
        ...column,
        // Extract metadata from rdgConfig (already optimized in DataForge)
        cellType: column.rdgConfig?.cellType || 'text',
        config: column.rdgConfig?.config || {},
        systemField: column.rdgConfig?.businessLogic?.systemField || false,
        businessLogic: column.rdgConfig?.businessLogic || {},
      }

      // Enhance relationship columns with options from relationshipData
      if (mappedColumn.cellType?.startsWith('relationship')) {
        const key = column.key as string
        let targetEntity: string | undefined
        
        // First try to get from the DataForge config
        if (mappedColumn.config?.targetEntity) {
          targetEntity = mappedColumn.config.targetEntity.toLowerCase()
        } else {
          // Fallback to key-based mapping
          if (key === 'owner' || key === 'assignee' || key === 'author' || key === 'members') {
            targetEntity = 'user'
          } else if (key === 'project' || key === 'projectId') {
            targetEntity = 'project'
          } else if (key === 'task' || key === 'taskId') {
            targetEntity = 'task'
          } else if (key === 'parent') {
            targetEntity = 'comment'
          }
        }

        if (targetEntity) {
          // Build options only for editing (not for display rendering)
          let options: Array<{ value: string; label: string }> = []
          if (targetEntity === 'project') {
            options = relationshipResolver.getProjectOptions()
          } else if (targetEntity === 'user') {
            options = relationshipResolver.getUserOptions()
          } else if (targetEntity === 'task') {
            options = relationshipResolver.getTaskOptions()
          }
          
          mappedColumn = {
            ...mappedColumn,
            config: {
              ...mappedColumn.config,
              targetEntity: targetEntity,
              options: options
            }
          }
        }
      }

      // Determine cell classes based on column properties
      const cellClasses = [
        'vibegridoptimus-cell',
        mappedColumn.systemField 
          ? 'vibegridoptimus-cell-system' 
          : (column.editable ? 'vibegridoptimus-cell-editable' : '')
      ].filter(Boolean).join(' ')

      const result = {
        ...column,
        // React-data-grid requires this property for edit functionality
        editable: column.editable || false,
        // Apply CSS classes to the column for proper cell styling
        cellClass: cellClasses,
        // PERFORMANCE: Lightweight React elements using perfect DataForge configuration
        renderCell: (props: any) => {
          const cellKey = `${props.row.id}:${mappedColumn.key}`
          
          // PERFORMANCE: Always get fresh atom value to avoid stale data
          // Use optimistic value if available, otherwise get latest from atom records
          const value = optimisticValues[cellKey] ?? (() => {
            // Get the latest value directly from atom records instead of stale props.row
            if (entityName === 'Task') {
              const task = tasksRecord[props.row.id]
              return task?.[mappedColumn.key] ?? props.row[mappedColumn.key]
            } else if (entityName === 'Project') {
              const project = projectsRecord[props.row.id]
              return project?.[mappedColumn.key] ?? props.row[mappedColumn.key]
            } else if (entityName === 'User') {
              const user = usersRecord[props.row.id]
              return user?.[mappedColumn.key] ?? props.row[mappedColumn.key]
            }
            return props.row[mappedColumn.key]
          })()
          
          // Debug optimistic state
          if (optimisticValues[cellKey] !== undefined) {
            console.log('[RenderCell] 🎨 Using optimistic value:', { 
              cellKey, 
              optimistic: optimisticValues[cellKey], 
              atom: props.row[mappedColumn.key] 
            })
          }
          
          // PERFORMANCE: Use pre-extracted click handlers to avoid lookups and function creation
          const clickHandler = getClickHandler(column.key as string, props.rowIdx)
          
          // Use DataForge configuration for precise rendering
          switch (mappedColumn.cellType) {
            case 'relationship-single': {
              if (!value) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span className="text-xs">Select item</span>
                  </div>
                )
              }
              
              // PERFORMANCE: Use relationship resolver for efficient lookup
              let displayValue
              
              if (typeof value === 'object' && value !== null) {
                // Object relationship - extract display field
                const displayField = mappedColumn.config?.displayField || 'name'
                displayValue = value[displayField] || value.name || value.title || value.id || '[No Display]'
              } else if (value && typeof value === 'string') {
                // ID reference - resolve via relationship resolver
                const targetEntity = mappedColumn.config?.targetEntity?.toLowerCase()
                if (targetEntity === 'project') {
                  const resolved = relationshipResolver.getProject(value)
                  displayValue = resolved?.label || `Project ${value.slice(0, 8)}`
                } else if (targetEntity === 'user') {
                  const resolved = relationshipResolver.getUser(value)
                  displayValue = resolved?.label || `User ${value.slice(0, 8)}`
                } else if (targetEntity === 'task') {
                  const resolved = relationshipResolver.getTask(value)
                  displayValue = resolved?.label || `Task ${value.slice(0, 8)}`
                } else {
                  displayValue = String(value)
                }
              } else {
                displayValue = String(value)
              }
              
              return (
                <div className={precomputedClasses.relationshipContainer} {...clickHandler}>
                  <span className={precomputedClasses.badgePrimary}>
                    {displayValue}
                  </span>
                </div>
              )
            }
            
            case 'relationship-multi':
            case 'relationship-collection': {
              if (!value) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                      <circle cx="9" cy="7" r="4"></circle>
                      <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                    </svg>
                    <span className="text-xs">Select members</span>
                  </div>
                )
              }
              
              // PERFORMANCE: Use relationship resolver for efficient lookup
              let displayValue
              
              if (typeof value === 'object' && value !== null) {
                // Object relationship - extract display field
                const displayField = mappedColumn.config?.displayField || 'name'
                displayValue = value[displayField] || value.name || value.title || value.id || '[No Display]'
              } else if (value && typeof value === 'string') {
                // ID reference - resolve via relationship resolver  
                const targetEntity = mappedColumn.config?.targetEntity?.toLowerCase()
                if (targetEntity === 'project') {
                  const resolved = relationshipResolver.getProject(value)
                  displayValue = resolved?.label || `Project ${value.slice(0, 8)}`
                } else if (targetEntity === 'user') {
                  const resolved = relationshipResolver.getUser(value)
                  displayValue = resolved?.label || `User ${value.slice(0, 8)}`
                } else if (targetEntity === 'task') {
                  const resolved = relationshipResolver.getTask(value)
                  displayValue = resolved?.label || `Task ${value.slice(0, 8)}`
                } else {
                  displayValue = String(value)
                }
              } else {
                displayValue = String(value)
              }
              
              return (
                <span 
                  className="badge badge-muted cursor-pointer hover:opacity-80"
                  {...clickHandler}
                >
                  {displayValue}
                </span>
              )
            }
            
            case 'enum': {
              if (!value) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <path d="M9 12l2 2 4-4"></path>
                      <circle cx="12" cy="12" r="9"></circle>
                    </svg>
                    <span className="text-xs">Select option</span>
                  </div>
                )
              }
              const badgeClass = getBadgeClass(value, column.key) + ' ' + CSS_CLASSES.cellHoverOpacity
              return (
                <div className={precomputedClasses.relationshipContainer} {...clickHandler}>
                  <span className={badgeClass}>{value}</span>
                </div>
              )
            }
            
            case 'date': {
              if (!value) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <span className="text-xs">Set date</span>
                  </div>
                )
              }
              
              const date = new Date(value)
              const format = mappedColumn.config?.format || 'MMM dd, yyyy'
              const showTime = mappedColumn.config?.showTime || false
              
              const displayValue = showTime 
                ? date.toLocaleString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric',
                    hour: 'numeric', minute: '2-digit'
                  })
                : date.toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', year: 'numeric'
                  })
              
              return (
                <div 
                  className="cursor-pointer px-2 hover:bg-muted rounded text-sm text-muted-foreground transition-colors"
                  {...clickHandler}
                >
                  {displayValue}
                </div>
              )
            }
            
            case 'boolean': {
              return (
                <div 
                  className={value ? precomputedClasses.booleanTrue : precomputedClasses.booleanFalse}
                  {...clickHandler}
                >
                  {value ? '✓' : '✗'}
                </div>
              )
            }
            
            case 'uuid': {
              if (!value) {
                return <span className="empty-state">—</span>
              }
              const truncated = String(value).slice(0, 8) + '...'
              return (
                <div 
                  className={precomputedClasses.uuid}
                  title={String(value)}
                  {...clickHandler}
                >
                  {truncated}
                </div>
              )
            }
            
            case 'number': {
              if (value == null) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <line x1="4" y1="9" x2="20" y2="9"></line>
                      <line x1="4" y1="15" x2="20" y2="15"></line>
                      <line x1="10" y1="3" x2="8" y2="21"></line>
                      <line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                    <span className="text-xs">Enter number</span>
                  </div>
                )
              }
              return (
                <div 
                  className={precomputedClasses.number}
                  {...clickHandler}
                >
                  {String(value)}
                </div>
              )
            }
            
            case 'text':
            default: {
              if (!value) {
                return (
                  <div className={precomputedClasses.emptyState} {...clickHandler}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline mr-1">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14,2 14,8 20,8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                      <line x1="16" y1="17" x2="8" y2="17"></line>
                      <polyline points="10,9 9,9 8,9"></polyline>
                    </svg>
                    <span className="text-xs">Add text</span>
                  </div>
                )
              }
              
              const displayValue = String(value)
              return (
                <div 
                  className={precomputedClasses.textWithOverflow}
                  title={displayValue}
                  {...clickHandler}
                >
                  {displayValue}
                </div>
              )
            }
          }
        }
      }

      // Add editor for editable cells
      if (column.editable) {
        result.renderEditCell = (editProps: any) => (
          <CellEditor
            row={editProps.row}
            column={mappedColumn}
            onRowChange={editProps.onRowChange}
            onClose={editProps.onClose}
            onUpdate={gridMachineOnUpdate}
            gridMachine={gridMachine}
            relationshipData={relationshipData}
          />
        )
        result.editorOptions = {
          // Only keep background content visible for non-text editors (enums, relationships)
          // Text editors need clean input fields without background content
          displayCellContent: mappedColumn.cellType !== 'text' && mappedColumn.cellType !== 'number'
        }
      }

      return result
    })
    performance.mark('column-enhancement-end')
    performance.measure('column-enhancement-duration', 'column-enhancement-start', 'column-enhancement-end')
    const enhancementTime = performance.now() - enhancementStart
    console.log(`[VibeGridOptimus] 🔧 Column enhancement in ${enhancementTime.toFixed(2)}ms for ${rdgColumns.length} columns`)
    if (enhancementTime > 10) {
      console.warn(`[VibeGridOptimus] 🐌 SLOW ENHANCEMENT: ${enhancementTime.toFixed(2)}ms`)
    }
    return result
  })()
  
  // Handle fill operations for drag-to-fill functionality (using optimusColumns)
  const handleFill = React.useCallback((event: import('react-data-grid').FillEvent<any>): any => {
    const { columnKey, sourceRow, targetRow } = event
    const column = optimusColumns.find(col => col.key === columnKey)
    
    // Don't allow filling system fields or non-editable fields
    if (column?.systemField || !column?.editable) {
      return targetRow
    }
    
    // For relationship fields, copy the ID value correctly
    if (column?.cellType?.startsWith('relationship') && column.accessorKey) {
      const sourceValue = sourceRow[column.accessorKey]
      return { ...targetRow, [column.accessorKey]: sourceValue }
    }
    
    // Copy the source value to target
    const sourceValue = sourceRow[columnKey]
    return { ...targetRow, [columnKey]: sourceValue }
  }, [optimusColumns])
  
  // No configuration errors with pre-generated columns
  
  // Early return if no pre-generated columns found
  if (!Array.isArray(rdgColumns) || rdgColumns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">No columns available</div>
          <div className="text-sm">No pre-generated columns found for entity: {entityName}</div>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-destructive bg-destructive/10 rounded-lg border border-destructive/20">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Error loading data</div>
          <div className="text-sm">{error}</div>
        </div>
      </div>
    )
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 bg-muted rounded-lg border border-border">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }
  
  // Empty state
  if (sortedData.length === 0) {
    return (
      <div className="flex flex-col h-64">
        <div className="flex-1 flex items-center justify-center bg-muted rounded-lg border border-border">
          <div className="text-center text-muted-foreground">
            <div className="text-lg font-medium mb-2">No data available</div>
            <div className="text-sm">There are no items to display</div>
          </div>
        </div>
      </div>
    )
  }
  

  return (
    <div className={`${CSS_CLASSES.container} theme-${theme} ${className} relative`} style={style}>
      {/* Enhanced state feedback */}
      {(pendingUpdates > 0 || gridMachine.pendingSavesCount > 0) && (
        <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
          {pendingUpdates + gridMachine.pendingSavesCount} pending update{(pendingUpdates + gridMachine.pendingSavesCount) > 1 ? 's' : ''}
        </div>
      )}
      
      {/* Grid machine status indicators */}
      {gridMachine.isEditing && (
        <div className="absolute top-2 left-2 z-10 bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
          ✏️ Editing
        </div>
      )}
      
      {gridMachine.errors.length > 0 && (
        <div className="absolute top-12 right-2 z-10 bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
          ❌ {gridMachine.errors.length} error{gridMachine.errors.length > 1 ? 's' : ''}
        </div>
      )}
      
      <div className="flex-1 border border-border rounded-lg overflow-hidden" style={{ height }}>
        {(() => {
          performance.mark('datagrid-render-start')
          const result = (
            <DataGrid
              ref={gridRef}
              columns={optimusColumns}
              rows={sortedData}
              sortColumns={sortColumns}
              onSortColumnsChange={(columns) => {
                performance.mark('sort-change-start')
                console.log('[VibeGridOptimus] 📊 Sort change:', columns)
                setSortColumns(columns)
                
                // Save to localStorage with debouncing
                setTimeout(() => {
                  try {
                    localStorage.setItem(`vibeGrid-${entityName}-sort`, JSON.stringify(columns))
                    console.log('[VibeGridOptimus] 💾 Sort preferences saved:', columns)
                  } catch (error) {
                    console.warn('[VibeGridOptimus] ⚠️ Failed to save sort preferences:', error)
                  }
                  performance.mark('sort-change-end')
                  performance.measure('sort-change-duration', 'sort-change-start', 'sort-change-end')
                }, 100)
              }}
              selectedPosition={selectedPositionRef.current}
              onSelectedCellChange={(position) => {
                console.log('[VibeGridOptimus] 🎯 Cell selection changed (no re-render):', position)
                selectedPositionRef.current = position
              }}
              cellNavigationMode="CHANGE_ROW"
              enableVirtualization={true}
              onFill={handleFill}
              onCellCopy={handleCellCopy}
              onCellPaste={handleCellPaste}
              onRowsChange={handleRowsChange}
              rowHeight={35}
              className={`fill-grid rdg-${effectiveTheme === 'dark' ? 'dark' : 'light'} rdg-spreadsheet`}
              style={{ height: typeof height === 'number' ? height : 600 }}
            />
          )
          performance.mark('datagrid-render-end')
          performance.measure('datagrid-render-duration', 'datagrid-render-start', 'datagrid-render-end')
          return result
        })()}
      </div>
    </div>
  )
  
  // Log component render time using useLayoutEffect to measure synchronous work
  React.useLayoutEffect(() => {
    performance.mark('vibegrid-render-end')
    performance.measure('vibegrid-total-render', 'vibegrid-render-start', 'vibegrid-render-end')
    
    const totalTime = performance.now() - componentStart
    const measure = performance.getEntriesByName('vibegrid-total-render')[0]
    
    console.log(`[VibeGridOptimus] ✅ Render completed in ${totalTime.toFixed(2)}ms (measured: ${measure.duration.toFixed(2)}ms)`)
    if (totalTime > 50) {
      console.warn(`[VibeGridOptimus] 🐌 SLOW RENDER: ${totalTime.toFixed(2)}ms`)
    }
    
    // Log all performance measures
    const measures = performance.getEntriesByType('measure').filter(m => 
      m.name.includes('vibegrid') || m.name.includes('column-enhancement')
    )
    console.table(measures.map(m => ({ 
      name: m.name, 
      duration: `${m.duration.toFixed(2)}ms` 
    })))
  })
  
  // Check what happens after render
  React.useEffect(() => {
    const effectTime = performance.now() - componentStart
    console.log(`[VibeGridOptimus] 🎯 All effects completed in ${effectTime.toFixed(2)}ms`)
    
    // Check if there are pending microtasks or timers
    Promise.resolve().then(() => {
      const microtaskTime = performance.now() - componentStart
      console.log(`[VibeGridOptimus] 🔄 Microtasks completed in ${microtaskTime.toFixed(2)}ms`)
    })
  })
}