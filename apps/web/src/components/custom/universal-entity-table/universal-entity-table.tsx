import React, { Suspense, useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { ObjectLiteral } from 'typeorm'
import {
  SortingState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  ColumnDef,
  VisibilityState,
  ColumnFiltersState,
  flexRender,
  PaginationState,
  ColumnOrderState,
  ColumnSizingState,
} from '@tanstack/react-table'
import { useContentWidth } from '@/stores/layoutStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
  PlusCircledIcon,
} from '@radix-ui/react-icons'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { useDataTableUiStore } from '@/stores/dataTableUiStore'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

// Import modular components
import { EntityTableToolbar } from './entity-table-toolbar'
import { EntityTableBulkActions, BulkActionConfig } from './entity-table-bulk-actions'
import { EntityTableBulkEditToolbar, BulkEditField, createBulkEditFields } from './entity-table-bulk-editing'
import { createSelectionColumn } from './entity-table-columns'
import { useEntityOperations } from './entity-table-operations'
import type { UniversalEntityTableProps } from './universal-entity-table-types'

/**
 * Universal Entity Table Error Display
 */
function UniversalEntityTableError({ 
  error, 
  onRetry, 
  title 
}: { 
  error: Error | string
  onRetry?: () => void
  title?: string 
}) {
  const errorMessage = error instanceof Error ? error.message : error
  return (
    <Card className="w-full border-destructive/50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <AlertCircle className="h-10 w-10 text-destructive mb-4" />
          <h3 className="text-lg font-medium text-destructive mb-2">
            {title || 'Error Loading Data'}
          </h3>
          <div className="mt-3 p-2 bg-muted/50 rounded-md text-xs max-h-[200px] overflow-auto">
            <pre className="whitespace-pre-wrap">{errorMessage}</pre>
          </div>
          {onRetry && (
            <Button className="mt-4" size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Universal Entity Table - Universal Reactive Data Pattern Implementation
 * ✅ Router Loader → Global Live Query Manager → TanStack Query Cache → Components
 * ✅ Relationship cells access cache directly via domain service cache keys
 * ✅ Zero prop drilling, zero hardcoded entity types, zero recursion
 */
function UniversalEntityTableInternal<T extends ObjectLiteral & { id: string; createdAt?: string | Date; updatedAt?: string | Date }>({
  data,
  entityType,
  columns: providedColumns,
  title,
  showToolbar = true,
  enableBulkActions = false,
  enableInlineEdit = false,
  enableOptimisticUpdates = true,
  enableSorting = true,
  enablePagination = true,
  pageSize = 10,
  useContentWidth: useContentWidthProp = false,
  service,
  onEntityCreated,
  onEntityUpdated,
  onEntityDeleted,
  className,
  showCard = true,
}: UniversalEntityTableProps<T>) {
  const contentWidth = useContentWidthProp ? useContentWidth() : null
  const tableId = `universal-${entityType}-table`
  
  // ✅ Universal Reactive Data Pattern: Use data from smart fallback (live || loader || cached || [])
  const tableData = data || []
  const isDataLoading = false // Parent handles loading via Global Live Query Manager
  const dataError = null // Parent handles errors via domain service hooks

  // console.log(`[UniversalEntityTable:${entityType}] Universal Reactive Data Pattern: ${tableData.length} items`)

  // State for inline record creation
  const [isAddingNewRecord, setIsAddingNewRecord] = useState(false)
  const [newRecordData, setNewRecordData] = useState<Partial<T>>({})
  const [rowSelection, setRowSelection] = useState({})

  // Auto-detect service based on entity type with fallback to prop
  const entityService = useMemo(() => {
    if (service) return service // Use provided service
    
    // This can stay for convenience, but parent should provide service
    return undefined
  }, [service])

  // UI Store for table state persistence
  const { getUiState, setUiState } = useDataTableUiStore()
  const tableState = getUiState(tableId) || {}

  // Extract state values with defaults
  const currentSorting = tableState.sorting || []
  const currentColumnVisibility = tableState.columnVisibility || {}
  const currentColumnFilters = tableState.columnFilters || []
  const currentPageSize = tableState.pagination?.pageSize || pageSize
  const pageIndex = tableState.pagination?.pageIndex || 0

  // State setters that update the store
  const setCurrentSorting = (sorting: SortingState | ((prev: SortingState) => SortingState)) => {
    const newSorting = typeof sorting === 'function' ? sorting(currentSorting) : sorting
    setUiState(tableId, { sorting: newSorting })
  }

  const setCurrentColumnVisibility = (visibility: VisibilityState | ((prev: VisibilityState) => VisibilityState)) => {
    const newVisibility = typeof visibility === 'function' ? visibility(currentColumnVisibility) : visibility
    setUiState(tableId, { columnVisibility: newVisibility })
  }

  const setCurrentColumnFilters = (filters: ColumnFiltersState | ((prev: ColumnFiltersState) => ColumnFiltersState)) => {
    const newFilters = typeof filters === 'function' ? filters(currentColumnFilters) : filters
    setUiState(tableId, { columnFilters: newFilters })
  }

  const setPagination = (pagination: PaginationState | ((prev: PaginationState) => PaginationState)) => {
    const newPagination = typeof pagination === 'function' ? pagination({ pageIndex, pageSize: currentPageSize }) : pagination
    setUiState(tableId, { 
      pagination: {
        pageIndex: newPagination.pageIndex,
        pageSize: newPagination.pageSize 
      }
    })
  }

  // Prepare columns with selection column if needed
  const columns = useMemo(() => {
    let finalColumns = [...providedColumns]
    
    // Add selection column at the beginning if bulk actions are enabled
    if (enableBulkActions) {
      const selectionColumn = createSelectionColumn<T>()
      finalColumns = [selectionColumn, ...finalColumns]
    }
    
    return finalColumns
  }, [providedColumns, enableBulkActions])

  // ✅ Memoize callbacks to prevent infinite re-renders
  const memoizedCallbacks = useMemo(() => ({
    onEntityCreated,
    onEntityUpdated,
    onEntityDeleted
  }), [onEntityCreated, onEntityUpdated, onEntityDeleted])

  // ✅ Use modular operations service - no more bloated component logic!
  const operations = useEntityOperations(entityService, entityType, memoizedCallbacks)

  // New record creation
  const handleAddRecord = () => {
    setIsAddingNewRecord(true)
    setNewRecordData({})
  }

  const handleCancelNewRecord = () => {
    setIsAddingNewRecord(false)
    setNewRecordData({})
  }

  const handleNewRecordFieldChange = (fieldName: keyof T, value: any) => {
    setNewRecordData(prev => ({ ...prev, [fieldName]: value }))
  }

  const handleSaveNewRecord = async () => {
    if (!entityService?.create) {
      toast.error('Cannot create record: Service unavailable')
      return
    }

    try {
      const createdEntity = await operations.handleCreate(newRecordData)
      toast.success(`${entityType} created successfully!`)
      setNewRecordData({})
      setIsAddingNewRecord(false)
    } catch (error: any) {
      toast.error(`Error creating ${entityType}: ${error.message}`)
    }
  }

  // ✅ Universal Reactive Data Pattern: Minimal table meta - no relationship data prop drilling
  const tableMeta = useMemo(() => ({
    editableColumns: enableInlineEdit ? columns.map(col => (col as any).accessorKey).filter(Boolean) : [],
    onUpdate: operations.handleUpdate,
    tableReady: true,
  }), [enableInlineEdit, columns, operations.handleUpdate])

  // React Table setup
  const table = useReactTable({
    data: tableData || [],
    columns,
    state: {
      sorting: currentSorting,
      columnVisibility: currentColumnVisibility,
      columnFilters: currentColumnFilters,
      rowSelection,
      ...(enablePagination && { pagination: { pageIndex, pageSize: currentPageSize } }),
    },
    enableRowSelection: true,
    enableSorting,
    columnResizeMode: 'onChange',
    onRowSelectionChange: setRowSelection,
    onSortingChange: setCurrentSorting,
    onColumnFiltersChange: setCurrentColumnFilters,
    onColumnVisibilityChange: setCurrentColumnVisibility,
    ...(enablePagination && { onPaginationChange: setPagination }),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    // ✅ PERFORMANCE FIX: Only enable faceted operations when actually needed
    // These are extremely expensive with 80+ rows and cause 150-200ms click handler violations
    // getFacetedRowModel: getFacetedRowModel(),
    // getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row: T) => row.id,
    meta: tableMeta,
  })

  // Content width calculations
  const calculateTableWidth = () => {
    if (!useContentWidthProp || !contentWidth) return '100%'
    
    const baseWidth = Math.max(contentWidth - 32, 400) // Account for padding, min 400px
    const constrainedWidth = Math.min(baseWidth, 1400) // Max 1400px
    return `${constrainedWidth}px`
  }

  // Render sortable header
  const renderSortableHeader = (header: any) => {
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

  // Error handling - now using dataError from domain services
  if (dataError && !tableData?.length) {
    return (
      <UniversalEntityTableError
        error={dataError}
        title={`Error Loading ${title || entityType}`}
      />
    )
  }

  // ✅ Memoize bulk edit fields to prevent re-renders
  const bulkEditFields = useMemo(() => createBulkEditFields(entityType), [entityType])

  // Calculate total table width
  const totalTableWidth = useMemo(() => {
    return columns.reduce((total, column) => {
      const size = (column as any).size || 150
      return total + size
    }, 0)
  }, [columns])

  // ✅ Memoize selected row data to prevent array recreation on every render
  const selectedRows = table.getSelectedRowModel().rows
  const selectedRowCount = selectedRows.length
  const selectedIds = useMemo(() => selectedRows.map(row => row.id), [selectedRows])
  const selectedEntities = useMemo(() => selectedRows.map(row => row.original), [selectedRows])

  // ✅ Memoize bulk actions callbacks to prevent re-renders
  const onBulkDeleteCallback = useMemo(
    () => operations.canBulkDelete 
      ? () => operations.handleBulkDelete(selectedIds).then(() => table.resetRowSelection())
      : undefined,
    [operations.canBulkDelete, operations.handleBulkDelete, selectedIds, table]
  )

  const onClearSelectionCallback = useCallback(() => table.resetRowSelection(), [table])

  const onBulkUpdateCallback = useCallback(
    (updates: Partial<T>) => operations.handleBulkUpdate(selectedIds, updates),
    [operations.handleBulkUpdate, selectedIds]
  )

  // Main table content
  const tableContent = (
    <div className="space-y-4">
      {/* Modular Toolbar */}
      {showToolbar && (
        <EntityTableToolbar
          table={table}
          entityType={entityType}
          searchPlaceholder={`Search ${entityType}...`}
          showViewOptions={true}
          autoSearch={true}
        />
      )}

      {/* Enhanced Bulk Actions with Quick Edit */}
      <EntityTableBulkActions
        entityType={entityType}
        selectedIds={selectedIds}
        selectedEntities={selectedEntities}
        onBulkDelete={onBulkDeleteCallback}
        onClearSelection={onClearSelectionCallback}
        customActions={[]} // TODO: Make configurable
        isLoading={false}
      />

      {/* Bulk Edit Toolbar - Quick edit for common fields */}
      {selectedRowCount > 0 && (
        <EntityTableBulkEditToolbar
          fields={bulkEditFields}
          selectedCount={selectedRowCount}
          onBulkUpdate={onBulkUpdateCallback}
          isLoading={false}
        />
      )}

      {/* Table */}
      <div className="w-full overflow-x-auto rounded-md border">
        <Table style={{ minWidth: `${totalTableWidth}px` }}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isClickable = enableSorting && header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(
                        isClickable ? 'cursor-pointer select-none' : '',
                        'relative whitespace-nowrap'
                      )}
                      onClick={isClickable ? header.column.getToggleSortingHandler() : undefined}
                      style={{ 
                        width: `${header.getSize()}px`,
                        minWidth: `${header.getSize()}px`
                      }}
                    >
                      {header.isPlaceholder ? null : renderSortableHeader(header)}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {/* Loading State */}
            {isDataLoading && (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  <DataTableSkeleton />
                </TableCell>
              </TableRow>
            )}

            {/* Existing Rows */}
            {!isDataLoading &&
              table.getPaginationRowModel().rows?.length > 0 &&
              table.getPaginationRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className="whitespace-nowrap"
                      style={{
                        width: `${cell.column.getSize()}px`,
                        minWidth: `${cell.column.getSize()}px`,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}

            {/* New Record Row */}
            {isAddingNewRecord && (
              <>
                <TableRow className="bg-muted/20">
                  {table.getVisibleLeafColumns().map((column) => {
                    if (column.id === 'select') {
                      return <TableCell key={column.id} className="p-1"></TableCell>
                    }
                    
                    const isAutoGenerated = column.id === 'id' || 
                      column.id === 'createdAt' || 
                      column.id === 'updatedAt'

                    if (isAutoGenerated) {
                      return (
                        <TableCell key={column.id} className="p-1 text-xs text-muted-foreground italic">
                          Auto
                        </TableCell>
                      )
                    }

                    return (
                      <TableCell key={column.id} className="p-1">
                        <Input
                          value={(newRecordData[column.id as keyof T] as string) || ''}
                          onChange={(e) => handleNewRecordFieldChange(column.id as keyof T, e.target.value)}
                          className="h-8"
                          placeholder={`Enter ${column.id}...`}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
                
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={table.getAllColumns().length} className="p-2 border-t">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="h-8"
                        onClick={handleSaveNewRecord}
                      >
                        Save
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={handleCancelNewRecord}
                      >
                        Cancel
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              </>
            )}

            {/* Empty State */}
            {!isDataLoading && !table.getRowModel().rows?.length && !isAddingNewRecord && (
              <TableRow>
                <TableCell colSpan={table.getAllColumns().length} className="h-24 text-center">
                  No {entityType} found.
                </TableCell>
              </TableRow>
            )}

            {/* Add Record Button */}
            {enableInlineEdit && !isAddingNewRecord && entityService?.create && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={table.getAllColumns().length} className="p-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddRecord}
                    className="h-8"
                  >
                    <PlusCircledIcon className="mr-2 h-4 w-4" />
                    Add {entityType}
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {enablePagination && (
        <div className="flex items-center justify-between py-4">
          <div className="flex-1 text-sm text-muted-foreground">
            {table.getFilteredSelectedRowModel().rows.length} of{' '}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">Rows per page</p>
              <Select
                value={`${table.getState().pagination?.pageSize || pageSize}`}
                onValueChange={(value) => table.setPageSize(Number(value))}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination?.pageIndex + 1 || 1} of{' '}
              {table.getPageCount() === 0 ? 1 : table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <DoubleArrowLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <ChevronLeftIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <ChevronRightIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <DoubleArrowRightIcon className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // Apply content width constraints if enabled
  if (useContentWidthProp && contentWidth) {
    const content = showCard ? (
      <Card className={cn("w-full", className)}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">
          {tableContent}
        </CardContent>
      </Card>
    ) : (
      <div className={cn("w-full", className)}>
        {title && <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>}
        {tableContent}
      </div>
    )

    return (
      <div className="w-full overflow-x-auto">
        <div 
          className="inline-block align-middle"
          style={{ width: calculateTableWidth() }}
        >
          <div className="border rounded-md">
            {content}
          </div>
        </div>
      </div>
    )
  }

  // Regular rendering
  if (showCard) {
    return (
      <Card className={cn("w-full", className)}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className="p-0">
          {tableContent}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={cn("w-full", className)}>
      {title && <h2 className="text-2xl font-bold tracking-tight mb-4">{title}</h2>}
      {tableContent}
    </div>
  )
}

/**
 * Universal Entity Table - Complete Universal Reactive Data Pattern Implementation
 * 
 * ✅ Router Loader → Global Live Query Manager → TanStack Query Cache → Components
 * ✅ Relationship cells access cache directly via domain service cache keys  
 * ✅ Zero prop drilling, zero hardcoded entity types, zero recursion
 * ✅ Reference counted live queries via Global Live Query Manager
 * ✅ Smart fallback: live data || loader data || cached data || []
 * 
 * @example
 * ```tsx
 * // ✅ UNIVERSAL REACTIVE DATA PATTERN IMPLEMENTATION
 * function MyDataTablePage() {
 *   const loaderData = useLoaderData() // Pre-loaded data from router
 *   
 *   // Domain service hooks use Global Live Query Manager (auto-deduplication)
 *   const { data: liveTasks } = TaskService.hooks.useAllTasks()
 *   const { data: liveProjects } = ProjectService.hooks.useAllProjects()  
 *   const { data: liveUsers } = UserService.hooks.useAllUsers()
 *   
 *   // Smart fallback following Universal Reactive Data Pattern
 *   const currentTasks = liveTasks || loaderData.tasks || []
 *   
 *   return (
 *     <UniversalEntityTable<Task>
 *       data={currentTasks}     // Smart fallback data
 *       entityType="tasks"      // For cache key resolution
 *       columns={taskColumns}   // Relationship cells get cache keys from services
 *     />
 *   )
 * }
 * 
 * // Relationship cells automatically resolve cache keys:
 * {
 *   accessorKey: 'projectId',
 *   cell: (props) => (
 *     <EditableFilterableRelationshipCell
 *       {...props}
 *       relationshipConfig={{
 *         cacheKey: ProjectService.queryOptions.all().queryKey, // ✅ Direct service cache key
 *         getEntityId: (project) => project.id,
 *         getDisplayValue: (project) => project.name,
 *       }}
 *     />
 *   )
 * }
 * ```
 * 
 * Pattern Benefits:
 * - ✅ Global Live Query Manager handles subscription deduplication
 * - ✅ Reference counting prevents memory leaks  
 * - ✅ Direct cache access eliminates prop drilling
 * - ✅ Domain services provide cache keys (no hardcoding)
 * - ✅ Router loaders populate TanStack Query cache
 * - ✅ Live queries update the same cache for real-time sync
 * - ✅ Components get best available data automatically
 */
export function UniversalEntityTable<T extends ObjectLiteral & { id: string; createdAt?: string | Date; updatedAt?: string | Date }>(
  props: UniversalEntityTableProps<T>
) {
  const { title, entityType, showCard = true } = props

  return (
    <Suspense
      fallback={
        showCard ? (
          <Card className="w-full">
            <CardHeader>
              <CardTitle>
                {title || `Loading ${entityType}...`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTableSkeleton />
            </CardContent>
          </Card>
        ) : (
          <DataTableSkeleton />
        )
      }
    >
      <UniversalEntityTableInternal {...props} />
    </Suspense>
  )
} 