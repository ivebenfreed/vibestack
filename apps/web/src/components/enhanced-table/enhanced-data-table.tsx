import React, { Suspense, useMemo } from 'react'
import {
  ColumnDef,
  SortingState,
  VisibilityState,
  ColumnFiltersState,
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
} from '@tanstack/react-table'
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTableSkeleton } from '@/components/ui/table-skeleton'
import { useSuspenseEntity } from '@/db/hooks/useSuspenseEntity'
import { cn } from '@/lib/utils'

/**
 * Enhanced Data Table Props
 * Implements Universal Reactive Data Pattern with Suspense
 */
export interface EnhancedDataTableProps<T extends ObjectLiteral & { id: string }> {
  // Core props
  tableId: string
  title?: string
  columns: ColumnDef<T, any>[]
  
  // Universal Reactive Data Pattern
  loaderData?: T[] | null // Pre-loaded data from router loaders
  liveQueryBuilder?: SelectQueryBuilder<T> | null // Live query for real-time updates
  
  // Table configuration
  enableSorting?: boolean
  enablePagination?: boolean
  pageSize?: number
  
  // Styling
  showCard?: boolean
  className?: string
}

/**
 * Internal Data Table Component (wrapped by Suspense)
 */
function EnhancedDataTableInternal<T extends ObjectLiteral & { id: string }>({
  tableId,
  title,
  columns,
  loaderData,
  liveQueryBuilder,
  enableSorting = true,
  enablePagination = true,
  pageSize = 10,
  showCard = true,
  className,
}: EnhancedDataTableProps<T>) {
  
  // Universal Reactive Data Pattern with Suspense
  const data = useSuspenseEntity<T>(
    loaderData,
    liveQueryBuilder || null,
    { transform: true }
  )

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Create table instance
  const table = useReactTable({
    data: data || [],
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    enableSorting,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination && { 
      getPaginationRowModel: getPaginationRowModel(),
      initialState: { pagination: { pageSize } }
    }),
    getRowId: (row: T) => row.id,
  })

  // Debug logging
  console.log(`[EnhancedDataTable:${tableId}] Rendered with ${data.length} items`)

  const tableContent = (
    <div className="space-y-4">
      {/* Force horizontal scroll with explicit width */}
      <div className="w-full overflow-x-auto">
        <div className="border rounded-md">
          <Table style={{ minWidth: '800px' }} className="w-full">
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id} className="whitespace-nowrap px-4">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="whitespace-nowrap px-4">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={columns.length}
                    className="h-24 text-center"
                  >
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Responsive pagination */}
      {enablePagination && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6">
          <div className="flex-1 text-sm text-muted-foreground text-center sm:text-left">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination?.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="flex items-center space-x-2">
              <button
                className="border rounded p-1 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </button>
              <button
                className="border rounded p-1 px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-muted"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )

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

  return <div className={className}>{tableContent}</div>
}

/**
 * Enhanced Data Table with Suspense
 * Implements Universal Reactive Data Pattern:
 * - Router loaders provide instant data
 * - Live queries provide real-time updates
 * - Suspense handles loading states
 */
export function EnhancedDataTable<T extends ObjectLiteral & { id: string }>(
  props: EnhancedDataTableProps<T>
) {
  const { title, showCard = true } = props

  return (
    <Suspense
      fallback={
        showCard ? (
          <Card>
            {title && (
              <CardHeader>
                <CardTitle>{title}</CardTitle>
              </CardHeader>
            )}
            <CardContent>
              <DataTableSkeleton />
            </CardContent>
          </Card>
        ) : (
          <DataTableSkeleton />
        )
      }
    >
      <EnhancedDataTableInternal {...props} />
    </Suspense>
  )
} 