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
  const componentStart = performance.now()
  console.log(`[VibeGridOptimus] 🚀 ROUTE LOAD: Starting component for ${props.entityName} with ${props.data.length} items`)
  
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
  
  // Get relationship data from domain atoms for editing dropdowns
  const projects = useSelector(projectsAtom, (projectsRecord) => Object.values(projectsRecord), shallowEqual)
  const users = useSelector(usersAtom, (usersRecord) => Object.values(usersRecord), shallowEqual)
  const tasks = useSelector(tasksAtom, (tasksRecord) => Object.values(tasksRecord), shallowEqual)
  
  // Build relationship data for dropdowns
  const relationshipData = React.useMemo(() => ({
    project: projects.map(p => ({ 
      value: p.id, 
      label: p.name || `Project ${p.id.slice(0, 8)}` 
    })),
    user: users.map(u => ({ 
      value: u.id, 
      label: u.name || u.email || `User ${u.id.slice(0, 8)}` 
    })),
    task: tasks.map(t => ({ 
      value: t.id, 
      label: t.title || `Task ${t.id.slice(0, 8)}` 
    })),
    comment: [] // Empty until comment domain is implemented
  }), [projects, users, tasks])
  
  // No more configError - pre-generated columns eliminate config issues
  
  // Initialize enhanced batch operations (keeping for bulk operations)
  const { processBatch, pendingUpdates, clearBatch } = useBatchOperations(finalSaveHandler)
  
  // Initialize clipboard operations
  const { copiedCell, handleCellCopy, handleCellPaste } = useClipboardOps()
  
  // Grid machine-aware save handler - React Compiler handles memoization
  const gridMachineOnUpdate = async (id: string, column: string, value: any) => {
    console.log('[VibeGridOptimus] 🚀 Grid machine save handler called:', { id, column, value })
    if (finalSaveHandler) {
      await finalSaveHandler(id, column, value)
    }
  }
  
  // Let individual CellRenderers handle their own registration
  // This avoids duplicate registration and infinite loops
  
  // Sort data based on grid machine sort columns - React Compiler handles memoization
  const sortedData = (() => {
    const sortStart = performance.now()
    const { sortColumns } = gridMachine
    if (sortColumns.length === 0) {
      console.log(`[Sort] No sorting needed for ${data.length} items`)
      return data
    }
    
    const result = [...data].sort((a, b) => {
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
    console.log(`[Sort] Sorted ${data.length} items in ${sortTime.toFixed(2)}ms`)
    if (sortTime > 10) {
      console.warn(`[Sort] 🐌 SLOW SORT: ${sortTime.toFixed(2)}ms for ${data.length} items`)
    }
    return result
  })()
  
  
  // Handle content click for single-click editing - React Compiler handles memoization
  const handleContentClick = (rowIdx: number, columnKey: string, event: React.MouseEvent) => {
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
  }

  // Create stable renderer functions to avoid recreating on every render
  const cellRendererProps = React.useMemo(() => ({
    onContentClick: handleContentClick,
    onUpdate: gridMachineOnUpdate,
    gridMachine: gridMachine
  }), [handleContentClick, gridMachineOnUpdate, gridMachine])
  
  const cellEditorProps = React.useMemo(() => ({
    onUpdate: gridMachineOnUpdate,
    gridMachine: gridMachine
  }), [gridMachineOnUpdate, gridMachine])

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

  // Enhanced columns with grid machine integration - uses pre-generated config
  const optimusColumns = React.useMemo(() => {
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

        if (targetEntity && relationshipData[targetEntity]) {
          mappedColumn = {
            ...mappedColumn,
            config: {
              ...mappedColumn.config,
              options: relationshipData[targetEntity]
            }
          }
          console.log(`[VibeGridOptimus] Enhanced ${key} with ${relationshipData[targetEntity].length} ${targetEntity} options`)
        } else {
          console.warn(`[VibeGridOptimus] No relationship data found for ${key}, targetEntity: ${targetEntity}`)
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
          const value = props.row[mappedColumn.key]
          
          // Use DataForge configuration for precise rendering
          switch (mappedColumn.cellType) {
            case 'relationship-single': {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              
              // Use the configured displayField from DataForge
              const displayField = mappedColumn.config?.displayField || 'name'
              let displayValue
              
              if (typeof value === 'object' && value !== null) {
                displayValue = value[displayField] || value.name || value.title || value.id || '[No Display]'
              } else {
                displayValue = String(value)
              }
              
              return React.createElement('span', { 
                className: 'badge badge-primary cursor-pointer hover:opacity-80' 
              }, displayValue)
            }
            
            case 'relationship-multi':
            case 'relationship-collection': {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              
              // Use the configured displayField from DataForge
              const displayField = mappedColumn.config?.displayField || 'name'
              let displayValue
              
              if (typeof value === 'object' && value !== null) {
                displayValue = value[displayField] || value.name || value.title || value.id || '[No Display]'
              } else {
                displayValue = String(value)
              }
              
              return React.createElement('span', { 
                className: 'badge badge-muted cursor-pointer hover:opacity-80' 
              }, displayValue)
            }
            
            case 'enum': {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              const badgeClass = getBadgeClass(value, column.key)
              return React.createElement('span', { className: badgeClass }, value)
            }
            
            case 'date': {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
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
              
              return React.createElement('span', { 
                className: 'text-sm text-muted-foreground' 
              }, displayValue)
            }
            
            case 'boolean': {
              return React.createElement('span', { 
                className: value ? 'text-green-600 font-bold' : 'text-muted-foreground' 
              }, value ? '✓' : '✗')
            }
            
            case 'uuid': {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              const truncated = String(value).slice(0, 8) + '...'
              return React.createElement('span', { 
                className: 'text-xs font-mono text-muted-foreground text-overflow-ellipsis',
                title: String(value)
              }, truncated)
            }
            
            case 'number': {
              if (value == null) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              return React.createElement('span', { 
                className: 'text-sm text-foreground font-mono text-right' 
              }, String(value))
            }
            
            case 'text':
            default: {
              if (!value) {
                return React.createElement('span', { className: 'empty-state' }, '—')
              }
              return React.createElement('span', { 
                className: 'text-sm text-foreground' 
              }, String(value))
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
    const enhancementTime = performance.now() - enhancementStart
    console.log(`[VibeGridOptimus] 🔧 Column enhancement in ${enhancementTime.toFixed(2)}ms for ${rdgColumns.length} columns`)
    if (enhancementTime > 10) {
      console.warn(`[VibeGridOptimus] 🐌 SLOW ENHANCEMENT: ${enhancementTime.toFixed(2)}ms`)
    }
    return result
  }, [rdgColumns, relationshipData, handleContentClick, gridMachineOnUpdate, gridMachine])
  
  
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
  
  // Handle fill operations
  const handleFill = React.useCallback((event: import('react-data-grid').FillEvent<any>): any => {
    const { columnKey, sourceRow, targetRow } = event
    const column = optimusColumns.find(col => col.key === columnKey)
    
    // Don't allow filling system fields or non-editable fields
    if (column?.systemField || !column?.config?.editable) {
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

  // Handle rows change for enhanced batch operations
  const handleRowsChange = React.useCallback((rows: any[], { indexes }: { indexes: number[] }) => {
    if (!onSave || indexes.length === 0) return
    
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
  }, [sortedData, onSave, processBatch])

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
        <DataGrid
          ref={gridRef}
          columns={optimusColumns}
          rows={sortedData}
          rowHeight={35}
          className={`fill-grid rdg-${effectiveTheme === 'dark' ? 'dark' : 'light'}`}
          style={{ height: typeof height === 'number' ? height : 600 }}
        />
      </div>
    </div>
  )
  
  // Log component render time using useLayoutEffect to measure synchronous work
  React.useLayoutEffect(() => {
    const totalTime = performance.now() - componentStart
    console.log(`[VibeGridOptimus] ✅ Layout effects completed in ${totalTime.toFixed(2)}ms`)
    if (totalTime > 50) {
      console.warn(`[VibeGridOptimus] 🐌 SLOW LAYOUT: ${totalTime.toFixed(2)}ms`)
    }
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