import React from 'react'
import { DataGrid, type DataGridHandle } from 'react-data-grid'
import type { VibeGridOptimusProps } from './types'
import { getRDGColumns, TaskRDGColumns } from '@repo/dataforge/rdg-column-configurations'
import { useBatchOperations } from './hooks/useBatchOperations'
import { useClipboardOps } from './hooks/useClipboardOps'
import { useGridMachine } from './hooks/useGridMachine'
import { CellRenderer } from './renderers/CellRenderer'
import { CellEditor } from './editors/CellEditor'
import { VibeGridHeader } from './VibeGridHeader'
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
  
  // State management for selection (needed for proper edit mode)
  const [selectedPosition, setSelectedPosition] = React.useState<{ row: number; idx: number } | null>(null)
  
  // Simple optimistic state to prevent flashing
  const [optimisticValues, setOptimisticValues] = React.useState<Record<string, any>>({})
  
  // Column visibility state with persistence
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(`vibeGrid-${entityName}-hiddenColumns`)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        console.log('[VibeGridOptimus] 📂 Loaded hidden columns:', parsed)
        return new Set(parsed)
      }
    } catch (error) {
      console.warn('[VibeGridOptimus] ⚠️ Failed to load hidden columns:', error)
    }
    return new Set<string>()
  })
  
  // Column widths state with persistence
  const [columnWidths, setColumnWidths] = React.useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem(`vibeGrid-${entityName}-columnWidths`)
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, number>
        console.log('[VibeGridOptimus] 📂 Loaded column widths:', parsed)
        return parsed
      }
    } catch (error) {
      console.warn('[VibeGridOptimus] ⚠️ Failed to load column widths:', error)
    }
    return {}
  })
  
  // Column order state with persistence
  const [columnOrder, setColumnOrder] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`vibeGrid-${entityName}-columnOrder`)
      if (saved) {
        const parsed = JSON.parse(saved) as string[]
        console.log('[VibeGridOptimus] 📂 Loaded column order:', parsed)
        return parsed
      }
    } catch (error) {
      console.warn('[VibeGridOptimus] ⚠️ Failed to load column order:', error)
    }
    return []
  })
  
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
  
  // Handle content click for single-click editing (triggered from CellRenderer components)
  const handleContentClick = React.useCallback((rowIdx: number, columnKey: string, event: React.MouseEvent) => {
    // Stop propagation to prevent normal cell selection
    event.stopPropagation()
    
    // Find the column configuration in the base RDG columns
    const rdgColumn = rdgColumns.find(col => col.key === columnKey)
    
    // If column is editable, enter edit mode using the correct react-data-grid API
    if (rdgColumn?.editable && gridRef.current) {
      console.log('[VibeGridOptimus] 🎯 Entering edit mode for content click:', {
        rowIdx,
        columnKey,
        columnIdx: rdgColumns.findIndex(col => col.key === columnKey)
      })
      
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

  // Helper function to determine if a column is required and cannot be hidden
  const isRequiredField = React.useCallback((column: any) => {
    // Primary business identifiers - entity-specific required fields
    const businessIdentifiers = ['name', 'title', 'email']
    if (businessIdentifiers.includes(column.key as string)) return true
    
    return false
  }, [])

  // Function to toggle column visibility with persistence
  const toggleColumnVisibility = React.useCallback((columnKey: string) => {
    const column = rdgColumns.find(col => col.key === columnKey)
    if (!column) return
    
    // Prevent hiding required fields
    if (isRequiredField(column)) {
      console.warn('[VibeGridOptimus] ⚠️ Cannot hide required field:', columnKey)
      return
    }
    
    setHiddenColumns(prev => {
      const newHiddenColumns = new Set(prev)
      const isHiding = !newHiddenColumns.has(columnKey)
      
      if (newHiddenColumns.has(columnKey)) {
        newHiddenColumns.delete(columnKey)
      } else {
        newHiddenColumns.add(columnKey)
        
        // Clear sort if hiding a column that's currently being sorted
        if (isHiding && sortColumns.some(sort => sort.columnKey === columnKey)) {
          console.log('[VibeGridOptimus] 🔄 Clearing sort for hidden column:', columnKey)
          setSortColumns(prev => prev.filter(sort => sort.columnKey !== columnKey))
          
          // Save updated sort preferences to localStorage
          const updatedSortColumns = sortColumns.filter(sort => sort.columnKey !== columnKey)
          try {
            localStorage.setItem(`vibeGrid-${entityName}-sort`, JSON.stringify(updatedSortColumns))
            console.log('[VibeGridOptimus] 💾 Updated sort preferences after hiding column')
          } catch (error) {
            console.warn('[VibeGridOptimus] ⚠️ Failed to save updated sort preferences:', error)
          }
        }
      }
      
      // Save to localStorage (filter out any required fields for safety)
      const saveableHiddenColumns = Array.from(newHiddenColumns).filter(key => {
        const col = rdgColumns.find(c => c.key === key)
        return col && !isRequiredField(col)
      })
      
      try {
        localStorage.setItem(`vibeGrid-${entityName}-hiddenColumns`, JSON.stringify(saveableHiddenColumns))
        console.log('[VibeGridOptimus] 💾 Saved hidden columns:', saveableHiddenColumns)
      } catch (error) {
        console.warn('[VibeGridOptimus] ⚠️ Failed to save hidden columns:', error)
      }
      
      return newHiddenColumns
    })
  }, [rdgColumns, isRequiredField, entityName, sortColumns, setSortColumns])

  // Handle column resizing with persistence
  const handleColumnResize = React.useCallback((columnKey: string, width: number) => {
    setColumnWidths(prev => {
      const newWidths = { ...prev, [columnKey]: width }
      
      // Save to localStorage with debouncing
      setTimeout(() => {
        try {
          localStorage.setItem(`vibeGrid-${entityName}-columnWidths`, JSON.stringify(newWidths))
          console.log('[VibeGridOptimus] 💾 Saved column widths:', newWidths)
        } catch (error) {
          console.warn('[VibeGridOptimus] ⚠️ Failed to save column widths:', error)
        }
      }, 300) // Debounce resize events
      
      return newWidths
    })
  }, [entityName])

  // Note: Click handling is now done through the proper handleContentClick passed to CellRenderer

  // Filter columns based on visibility settings, protecting required fields
  const visibleColumns = rdgColumns.filter(column => {
    // Always show required fields, even if in hiddenColumns
    if (isRequiredField(column)) return true
    
    // Hide optional columns that are in hiddenColumns
    return !hiddenColumns.has(column.key)
  })

  // Handle column reordering with persistence
  const handleColumnsReorder = React.useCallback((sourceKey: string, targetKey: string) => {
    const visibleColumnKeys = visibleColumns.map(col => col.key)
    const sourceIndex = visibleColumnKeys.indexOf(sourceKey)
    const targetIndex = visibleColumnKeys.indexOf(targetKey)
    
    if (sourceIndex === -1 || targetIndex === -1) return
    
    const newOrder = [...visibleColumnKeys]
    const [removed] = newOrder.splice(sourceIndex, 1)
    newOrder.splice(targetIndex, 0, removed)
    
    setColumnOrder(newOrder)
    
    // Save to localStorage
    try {
      localStorage.setItem(`vibeGrid-${entityName}-columnOrder`, JSON.stringify(newOrder))
      console.log('[VibeGridOptimus] 💾 Saved column order:', newOrder)
    } catch (error) {
      console.warn('[VibeGridOptimus] ⚠️ Failed to save column order:', error)
    }
  }, [visibleColumns, entityName])

  // Apply column ordering based on saved preferences
  const orderedColumns = React.useMemo(() => {
    if (columnOrder.length === 0) {
      // No saved order, use default order
      return visibleColumns
    }
    
    // Sort columns based on saved order, keeping any new columns at the end
    const columnMap = new Map(visibleColumns.map(col => [col.key, col]))
    const ordered: any[] = []
    
    // Add columns in saved order
    columnOrder.forEach(key => {
      const column = columnMap.get(key)
      if (column) {
        ordered.push(column)
        columnMap.delete(key)
      }
    })
    
    // Add any remaining columns (new columns not in saved order)
    ordered.push(...Array.from(columnMap.values()))
    
    return ordered
  }, [visibleColumns, columnOrder])

  // Add renderers to columns - simple structure like working version
  const optimusColumns = orderedColumns.map((column) => {
    // Map RDG column structure to what renderers expect
    const mappedColumn = {
      ...column,
      // Extract metadata from rdgConfig for compatibility with existing renderers
      cellType: column.rdgConfig?.cellType || 'text',
      config: column.rdgConfig?.config || {},
      systemField: column.rdgConfig?.businessLogic?.systemField || false,
      businessLogic: column.rdgConfig?.businessLogic || {},
    }

    return {
      ...column,
      // Apply custom width if available, otherwise use default
      width: columnWidths[column.key] || column.width,
      // React-data-grid requires this property for edit functionality
      editable: column.editable || false,
      renderCell: (cellProps: any) => {
        const cellKey = `${cellProps.row.id}:${column.key}`
        
        // Use optimistic value if available, otherwise use row value
        const value = optimisticValues[cellKey] ?? cellProps.row[column.key]
        
        return (
          <CellRenderer
            row={cellProps.row}
            column={mappedColumn}
            value={value}
            rowIndex={cellProps.rowIdx}
            onContentClick={handleContentClick}
          />
        )
      },
      // Rich editor for editable cells
      ...(column.editable && {
        renderEditCell: (editProps: any) => (
          <CellEditor
            row={editProps.row}
            column={mappedColumn}
            onRowChange={editProps.onRowChange}
            onClose={editProps.onClose}
            onUpdate={finalSaveHandler ? gridMachineOnUpdate : undefined}
          />
        ),
        editorOptions: {
          // Only keep background content visible for non-text editors (enums, relationships)
          // Text editors need clean input fields without background content
          displayCellContent: mappedColumn.cellType !== 'text' && mappedColumn.cellType !== 'number'
        }
      })
    }
  })
  
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
    <div 
      className={`${CSS_CLASSES.container} theme-${theme} ${className} flex flex-col`} 
      style={{ ...style, height }}
    >
      {/* Table Header */}
      <VibeGridHeader
        columns={rdgColumns}
        hiddenColumns={hiddenColumns}
        onToggleColumn={toggleColumnVisibility}
        isRequiredField={isRequiredField}
        pendingUpdates={pendingUpdates}
        gridMachinePendingSaves={gridMachine.pendingSavesCount}
        isEditing={gridMachine.isEditing}
        errors={gridMachine.errors}
      />
      
      {/* Table Content */}
      <div className="flex-1 border-l border-r border-b border-border rounded-b-lg overflow-hidden">
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
              selectedPosition={selectedPosition}
              onSelectedCellChange={setSelectedPosition}
              cellNavigationMode="CHANGE_ROW"
              enableVirtualization={true}
              onFill={handleFill}
              onCellCopy={handleCellCopy}
              onCellPaste={handleCellPaste}
              onRowsChange={handleRowsChange}
              // Column resizing support
              onColumnsReorder={handleColumnsReorder}
              onColumnResize={(columnIdx, width) => {
                const column = optimusColumns[columnIdx]
                if (column) {
                  handleColumnResize(column.key, width)
                }
              }}
              rowHeight={35}
              className={`fill-grid rdg-${effectiveTheme === 'dark' ? 'dark' : 'light'} rdg-spreadsheet`}
              style={{ height: '100%' }}
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