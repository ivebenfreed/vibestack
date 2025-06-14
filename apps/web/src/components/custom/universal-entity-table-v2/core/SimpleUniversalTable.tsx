import React, { useMemo, useRef, useEffect } from 'react'
import { useSelector } from '@xstate/store/react'
import { shallowEqual } from '@xstate/store'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { useTableStore } from './table-state-xstate'
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
} from '@radix-ui/react-icons'
import { cn } from '@/lib/utils'
import type { BaseEntity } from './table-types'

// Import advanced feature components
import { createSelectionColumn } from '../features/selection-column'
import { EntityTableToolbar } from '../features/table-toolbar'
import { EntityTableBulkActions, type BulkActionConfig } from '../features/bulk-actions'
import { EntityTableBulkEditToolbar, type BulkEditField } from '../features/bulk-edit-toolbar'

/**
 * ✅ SORTABLE HEADER COMPONENT
 * 
 * Displays sortable headers with proper click handlers and sort indicators
 */
function SortableHeader({ 
  header, 
  enableSorting 
}: { 
  header: any
  enableSorting: boolean 
}) {
  const canSort = header.column.getCanSort()
  const isSorted = header.column.getIsSorted()
  
  return (
    <div className="flex items-center">
      {flexRender(header.column.columnDef.header, header.getContext())}
      {canSort && enableSorting && (
        <div className="ml-2">
          {isSorted === 'desc' ? (
            <ArrowDownIcon className="h-4 w-4" />
          ) : isSorted === 'asc' ? (
            <ArrowUpIcon className="h-4 w-4" />
          ) : (
            <CaretSortIcon className="h-4 w-4 opacity-50" />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * ✅ RESPONSIVE UNIVERSAL TABLE
 * 
 * Enhanced table component with proper width constraints and responsive scrolling
 * based on TanStack Table v8 best practices.
 */

interface SimpleUniversalTableProps<T extends BaseEntity> {
  /** XState atom containing entities as Record<string, T> */
  entityAtom: any
  /** Column definitions */
  columns: ColumnDef<T>[]
  /** Table ID for XState store instance */
  tableId?: string
  /** Optional table title */
  title?: string
  
  // Core Features
  /** Enable sorting */
  enableSorting?: boolean
  /** Enable pagination */
  enablePagination?: boolean
  /** Enable row selection */
  enableSelection?: boolean
  /** Default page size */
  pageSize?: number
  
  // Advanced Features
  /** Enable search and filtering toolbar */
  enableToolbar?: boolean
  /** Enable bulk actions when rows are selected */
  enableBulkActions?: boolean
  /** Enable bulk editing functionality */
  enableBulkEdit?: boolean
  /** Search placeholder text */
  searchPlaceholder?: string
  /** Entity type name for display (e.g., "tasks", "projects") */
  entityType?: string
  /** Search debounce delay in milliseconds (default: 300ms) */
  searchDebounceMs?: number
  
  // Responsive Settings
  /** Minimum table width (prevents compression below this) */
  minTableWidth?: number
  /** Maximum table width (prevents expansion beyond this) */
  maxTableWidth?: number
  /** Use container width for responsive behavior */
  useContainerWidth?: boolean
  
  // Action Handlers (Domain Actions)
  /** Bulk delete handler */
  onBulkDelete?: (selectedIds: string[]) => Promise<void>
  /** Bulk update handler */
  onBulkUpdate?: (selectedIds: string[], updates: Partial<T>) => Promise<void>
  /** Custom bulk actions */
  customBulkActions?: BulkActionConfig<T>[]
  /** Bulk edit field definitions */
  bulkEditFields?: BulkEditField[]
  
  /** Additional CSS classes */
  className?: string
}

export function SimpleUniversalTable<T extends BaseEntity>({
  entityAtom,
  columns,
  tableId = 'simple-table',
  title,
  
  // Core Features
  enableSorting = true,
  enablePagination = true,
  enableSelection = false,
  pageSize = 25,
  
  // Advanced Features
  enableToolbar = false,
  enableBulkActions = false,
  enableBulkEdit = false,
  searchPlaceholder = 'Search...',
  entityType = 'items',
  searchDebounceMs = 300,
  
  // Responsive Settings
  minTableWidth = 600,
  maxTableWidth,
  useContainerWidth = true,
  
  // Action Handlers
  onBulkDelete,
  onBulkUpdate,
  customBulkActions = [],
  bulkEditFields = [],
  
  className
}: SimpleUniversalTableProps<T>) {
  
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  
  // 🎯 DIRECT ATOM SUBSCRIPTION: Get entities from XState atom
  const entitiesData = useSelector(
    entityAtom,
    (state) => {
      if (!state || typeof state !== 'object') return []
      // Convert Record<string, T> to T[]
      return Object.values(state) as T[]
    },
    shallowEqual
  )

  // 🎯 XSTATE STORE INTEGRATION: Use existing store for all table state
  const tableStore = useTableStore(tableId, { 
    pagination: { pageIndex: 0, pageSize } 
  })

  // ✅ ENHANCED COLUMNS: Add selection column when enabled and set default sizes
  const enhancedColumns = useMemo(() => {
    const cols = [...columns]
    
    // Add selection column if enabled and not already present
    if (enableSelection && !cols.some(col => (col as any).id === 'select')) {
      cols.unshift(createSelectionColumn<T>())
    }
    
    // Ensure all columns have reasonable default sizes for responsive behavior
    return cols.map(col => ({
      ...col,
      size: (col as any).size || undefined, // Let TanStack Table calculate if not specified
      minSize: (col as any).minSize || 50,
      maxSize: (col as any).maxSize || 500,
    }))
  }, [columns, enableSelection])

  // ✅ REQUIRED COLUMNS FILTERING: Filter out columns that cannot be hidden
  const hideableColumns = useMemo(() => {
    return enhancedColumns.filter(col => {
      // Skip selection column
      if ((col as any).id === 'select') return false
      // Only include columns that can be hidden (enableHiding !== false)
      return (col as any).enableHiding !== false
    })
  }, [enhancedColumns])

  // ✅ COLUMN VISIBILITY CONSTRAINTS: Ensure required columns stay visible
  const constrainedColumnVisibility = useMemo(() => {
    const visibility = { ...tableStore.columnVisibility }
    
    // Force required columns to be visible
    enhancedColumns.forEach(col => {
      const columnId = (col as any).id || (col as any).accessorKey
      if ((col as any).enableHiding === false && columnId) {
        visibility[columnId] = true
      }
    })
    
    return visibility
  }, [tableStore.columnVisibility, enhancedColumns])

  // ✅ CONTAINER WIDTH TRACKING: For responsive behavior
  useEffect(() => {
    if (!useContainerWidth || !containerRef.current) return

    const resizeObserver = new ResizeObserver(entries => {
      const entry = entries[0]
      if (entry) {
        setContainerWidth(entry.contentRect.width)
      }
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [useContainerWidth])

  // 🎯 REACT TABLE SETUP: Integrated with XState store
  const table = useReactTable({
    data: entitiesData,
    columns: enhancedColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: enableSelection,
    
    // ✅ ROW ID: Use entity ID as row identifier for stable references
    getRowId: (row) => row.id,
    
    // ✅ STATE: All managed by XState store
    state: {
      sorting: tableStore.sorting,
      columnFilters: tableStore.columnFilters,
      columnVisibility: constrainedColumnVisibility,
      pagination: tableStore.pagination,
      ...(enableSelection && { rowSelection: tableStore.rowSelection }),
    },
    
    // ✅ EVENT HANDLERS: Wire to XState store using convenience actions
    onSortingChange: (updaterOrValue) => {
      const newValue = typeof updaterOrValue === 'function' 
        ? updaterOrValue(tableStore.sorting)
        : updaterOrValue
      tableStore.actions.setSorting(newValue)
    },
    
    onColumnFiltersChange: (updaterOrValue) => {
      const newValue = typeof updaterOrValue === 'function' 
        ? updaterOrValue(tableStore.columnFilters)
        : updaterOrValue
      tableStore.actions.setColumnFilters(newValue)
    },
    
    onColumnVisibilityChange: (updaterOrValue) => {
      const newValue = typeof updaterOrValue === 'function' 
        ? updaterOrValue(tableStore.columnVisibility)
        : updaterOrValue
      tableStore.actions.setColumnVisibility(newValue)
    },
    
    onPaginationChange: (updaterOrValue) => {
      const newValue = typeof updaterOrValue === 'function' 
        ? updaterOrValue(tableStore.pagination)
        : updaterOrValue
      tableStore.actions.setPagination(newValue)
    },
    
    ...(enableSelection && {
      onRowSelectionChange: (updaterOrValue) => {
        const newValue = typeof updaterOrValue === 'function' 
          ? updaterOrValue(tableStore.rowSelection)
          : updaterOrValue
        tableStore.actions.setRowSelection(newValue)
      },
    }),
  })

  // ✅ BULK OPERATIONS: Prepare data for bulk components
  const selectedRowIds = Object.keys(tableStore.rowSelection)
  const selectedEntities = useMemo(() => {
    return entitiesData.filter(entity => selectedRowIds.includes(entity.id))
  }, [entitiesData, selectedRowIds])

  const handleClearSelection = () => {
    tableStore.actions.setRowSelection({})
  }

  // ✅ RESPONSIVE WIDTH CALCULATIONS
  const tableWidth = useMemo(() => {
    // Step 1: Calculate the table's natural content width
    // This is the sum of all column widths, or the minimum width needed to show all content
    const totalSize = table.getCenterTotalSize()
    
    // Step 2: Ensure we respect the minimum width constraint
    // The table shouldn't be smaller than either its content width or the minTableWidth prop
    const calculatedMinWidth = Math.max(totalSize, minTableWidth)
    
    if (useContainerWidth && containerWidth > 0) {
      // Step 3: Calculate the actual available width for the table
      // Account for container padding to prevent the table from touching the edges
      const containerPadding = 32 // 16px on each side
      const availableWidth = Math.min(
        containerWidth - containerPadding,
        maxTableWidth || Infinity
      )
      
      // Step 4: Determine if we need horizontal scrolling
      // If the table's minimum width is larger than our available space, we need to scroll
      const shouldScroll = calculatedMinWidth > availableWidth
      
      // Step 5: Set the final table width
      // When scrolling:
      //   - Use the SMALLER of the natural width or available width
      //   - This allows the table to keep shrinking with its container
      //   - While maintaining the scrollable area for the full content
      // When not scrolling:
      //   - Use the full available width
      //   - This allows the table to expand naturally with its container
      return {
        tableWidth: shouldScroll ? Math.min(calculatedMinWidth, availableWidth) : availableWidth,
        shouldScroll,
        containerWidth: availableWidth,
        naturalWidth: calculatedMinWidth
      }
    }
    
    // If we're not using container width, just use the minimum required width
    return {
      tableWidth: calculatedMinWidth,
      shouldScroll: false,
      containerWidth: calculatedMinWidth,
      naturalWidth: calculatedMinWidth
    }
  }, [table, minTableWidth, maxTableWidth, containerWidth, useContainerWidth])

  return (
    <div ref={containerRef} className={cn("w-full space-y-4 overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <div className="text-sm text-muted-foreground">
            {entitiesData.length} {entityType}
          </div>
        </div>
      )}

      {/* ✅ SEARCH & FILTERING TOOLBAR */}
      {enableToolbar && (
        <EntityTableToolbar
          table={table}
          entityType={entityType}
          searchPlaceholder={searchPlaceholder}
          showViewOptions={true}
          autoSearch={true}
          searchDebounceMs={searchDebounceMs}
        />
      )}

      {/* ✅ BULK ACTIONS TOOLBAR */}
      {enableBulkActions && selectedRowIds.length > 0 && (
        <EntityTableBulkActions
          entityType={entityType}
          selectedIds={selectedRowIds}
          selectedEntities={selectedEntities}
          onBulkDelete={onBulkDelete ? () => onBulkDelete(selectedRowIds) : undefined}
          onClearSelection={handleClearSelection}
          customActions={customBulkActions}
          isLoading={tableStore.isLoading}
        />
      )}

      {/* ✅ BULK EDIT TOOLBAR */}
      {enableBulkEdit && selectedRowIds.length > 0 && bulkEditFields.length > 0 && onBulkUpdate && (
        <EntityTableBulkEditToolbar
          fields={bulkEditFields}
          selectedCount={selectedRowIds.length}
          onBulkUpdate={(updates) => onBulkUpdate(selectedRowIds, updates)}
          isLoading={tableStore.isLoading}
          entityType={entityType}
        />
      )}

      {/* ✅ IMPROVED TABLE CONTAINER WITH PROPER OVERFLOW HANDLING */}
      <div className="relative w-full border rounded-lg">
        <div className="overflow-auto">
          <div style={{ width: tableWidth.tableWidth }}>
            <table className="w-full border-collapse">
              <thead>
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isClickable = enableSorting && header.column.getCanSort()
                      return (
                        <th
                          key={header.id}
                          className={cn(
                            isClickable ? 'cursor-pointer select-none' : '',
                            'relative whitespace-nowrap px-2 py-2 text-left border-b'
                          )}
                          onClick={isClickable ? header.column.getToggleSortingHandler() : undefined}
                          style={{ 
                            width: header.getSize(),
                            minWidth: header.getSize(),
                            maxWidth: header.getSize(),
                            boxSizing: 'border-box'
                          }}
                        >
                          {header.isPlaceholder ? null : (
                            <SortableHeader header={header} enableSorting={enableSorting} />
                          )}
                        </th>
                      )
                    })}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b",
                        row.getIsSelected() ? "bg-muted" : ""
                      )}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td 
                          key={cell.id}
                          className="px-2 py-2 whitespace-nowrap"
                          style={{ 
                            width: cell.column.getSize(),
                            minWidth: cell.column.getSize(),
                            maxWidth: cell.column.getSize(),
                            boxSizing: 'border-box'
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={enhancedColumns.length}
                      className="h-24 text-center px-4 py-2"
                    >
                      No results.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {enablePagination && (
        <div className="flex flex-wrap items-center justify-between gap-4 px-2">
          <div className="text-sm text-muted-foreground">
            {enableSelection ? (
              <>
                {selectedRowIds.length} of{" "}
                {table.getFilteredRowModel().rows.length} {entityType} selected.
              </>
            ) : (
              `${table.getFilteredRowModel().rows.length} total ${entityType}`
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-6">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium whitespace-nowrap">Per page</p>
              <select
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  const newPageSize = Number(e.target.value)
                  // Update the XState store's pagination state to keep it in sync
                  tableStore.actions.setPagination({
                    ...tableStore.pagination,
                    pageSize: newPageSize,
                    pageIndex: 0 // Reset to first page when changing page size
                  })
                }}
                className="h-8 w-16 rounded border border-input bg-background text-sm"
              >
                {[10, 20, 25, 30, 40, 50].map((pageSizeOption) => (
                  <option key={pageSizeOption} value={pageSizeOption}>
                    {pageSizeOption}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="hidden sm:inline">Page</span>{" "}
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <DoubleArrowLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 sm:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <DoubleArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 