import React, { useMemo } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Task, TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'
import { useTaskAtoms } from '@/domain/task'
import { format } from 'date-fns'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
} from '@tanstack/react-table'
import { useContentWidth } from '@/stores/layoutStore'

export function TasksEnhanced() {
  // Use reliable content width calculation from layout store
  const contentWidth = useContentWidth()

  // 🎯 PHASE 4: Use atomic store instead of React Query hooks - ATOMIC REACTIVITY
  const tasks = useTaskAtoms.allTasks()

  // Table state
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])

  // Define columns with explicit widths
  const columns = useMemo<ColumnDef<Task, any>[]>(() => [
    {
      accessorKey: 'id',
      header: 'ID',
      size: 80,
      minSize: 60,
      maxSize: 120,
      enableHiding: true,
      cell: ({ getValue }) => (
        <div className="max-w-[80px] truncate text-xs font-mono">
          {(getValue() as string).slice(0, 8)}...
        </div>
      ),
    },
    {
      accessorKey: 'title',
      header: 'Title',
      size: 200,
      minSize: 150,
      maxSize: 400,
      enableHiding: false,
      cell: ({ getValue }) => (
        <div className="max-w-[200px] sm:max-w-[300px] truncate font-medium">
          {getValue() as string}
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      size: 250,
      minSize: 150,
      maxSize: 400,
      enableHiding: true,
      cell: ({ getValue }) => {
        const description = getValue() as string
        return (
          <div className="max-w-[250px] lg:max-w-[400px] truncate text-muted-foreground">
            {description || '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      minSize: 100,
      maxSize: 150,
      enableHiding: false,
      cell: ({ getValue }) => {
        const status = getValue() as TaskStatus
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            status === TaskStatus.COMPLETED 
              ? 'bg-green-100 text-green-800' 
              : status === TaskStatus.IN_PROGRESS
              ? 'bg-blue-100 text-blue-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            <span className="hidden sm:inline">{status}</span>
            <span className="sm:hidden">
              {status === TaskStatus.COMPLETED ? '✓' : 
               status === TaskStatus.IN_PROGRESS ? '⏳' : '○'}
            </span>
          </span>
        )
      },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      size: 100,
      minSize: 80,
      maxSize: 150,
      enableHiding: true,
      cell: ({ getValue }) => {
        const priority = getValue() as TaskPriority
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            priority === TaskPriority.HIGH 
              ? 'bg-red-100 text-red-800' 
              : priority === TaskPriority.MEDIUM
              ? 'bg-yellow-100 text-yellow-800'
              : 'bg-gray-100 text-gray-800'
          }`}>
            {priority}
          </span>
        )
      },
    },
    {
      accessorKey: 'dueDate',
      header: 'Due Date',
      size: 120,
      minSize: 100,
      maxSize: 180,
      enableHiding: true,
      cell: ({ getValue }) => {
        const date = getValue() as Date | null
        return (
          <div className="whitespace-nowrap text-sm">
            {date ? format(new Date(date), 'MMM dd') : '-'}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      size: 120,
      minSize: 100,
      maxSize: 180,
      enableHiding: true,
      cell: ({ getValue }) => {
        const date = getValue() as Date
        return (
          <div className="whitespace-nowrap text-muted-foreground text-sm">
            {date ? format(new Date(date), 'MMM dd') : '-'}
          </div>
        )
      },
    },
  ], [])

  // Calculate minimum table width based on columns - use actual size, not minSize
  const minTableWidth = useMemo(() => 
    columns.reduce((total, col) => total + (col.size || 150), 0),
    [columns]
  )

  // Create table instance
  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
    },
    enableSorting: true,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
    getRowId: (row: Task) => row.id,
  })

  // Calculate effective table width for the inner sizing div using contentWidth
  const effectiveTableWidth = contentWidth > 0 
    ? (contentWidth < minTableWidth ? minTableWidth : contentWidth) 
    : minTableWidth

  // Only log debug info in development mode and reduce frequency
  React.useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[TasksEnhanced] Width calculations:', {
        contentWidth,
        minTableWidth,
        effectiveTableWidth,
        shouldScroll: contentWidth < minTableWidth
      })
    }
  }, [contentWidth, minTableWidth]) // Reduced dependencies

  // Simplified DOM measurements - only in dev mode and less frequent
  React.useEffect(() => {
    if (!import.meta.env.DEV) return
    
    const measureElements = () => {
      const scrollContainer = document.querySelector('[data-debug="scroll-container"]')
      
      if (scrollContainer) {
        console.log('[TasksEnhanced] DOM measurements:', {
          scrollContainer: {
            clientWidth: (scrollContainer as HTMLElement).clientWidth,
            scrollWidth: (scrollContainer as HTMLElement).scrollWidth,
            canScroll: (scrollContainer as HTMLElement).scrollWidth > (scrollContainer as HTMLElement).clientWidth
          }
        })
      }
    }
    
    // Debounced measurement - only measure once after contentWidth stabilizes
    const timer = setTimeout(measureElements, 200)
    return () => clearTimeout(timer)
  }, [contentWidth]) // Only measure when contentWidth changes

  return (
    <Card 
      data-debug="tasks-card"
    >
      <CardHeader>
        <CardTitle>All Tasks</CardTitle>
        {/* Debug info display */}
        {import.meta.env.DEV && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Content Width: {contentWidth}px</div>
            <div>Min Table Width: {minTableWidth}px</div>
            <div>Effective Width: {effectiveTableWidth}px</div>
            <div>Should Scroll: {contentWidth < minTableWidth ? 'YES' : 'NO'}</div>
          </div>
        )}
      </CardHeader>
      <CardContent className="p-0" data-debug="card-content">
        {/* Outer container: provides the scrollbar when its content (the inner sizing div) is wider */}
        <div 
          className="w-full overflow-x-auto"
          data-debug="scroll-container"
        >
          {/* Inner Sizing Div: This div's width determines if the outer container scrolls */}
          <div 
            className="inline-block align-middle"
            style={{ 
              width: `${effectiveTableWidth}px`, 
              minWidth: `${minTableWidth}px`
            }}
            data-debug="sizing-div"
          >
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead 
                          key={header.id}
                          style={{ 
                            width: `${header.getSize()}px`,
                            minWidth: `${header.column.columnDef.minSize}px`,
                          }}
                          className="whitespace-nowrap px-4"
                        >
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
                          <TableCell 
                            key={cell.id}
                            style={{ 
                              width: `${cell.column.getSize()}px`,
                              minWidth: `${cell.column.columnDef.minSize}px`,
                            }}
                            className="whitespace-nowrap px-4"
                          >
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
        </div>

        {/* Pagination - use px-6 to match CardHeader */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4">
          <div className="flex-1 text-sm text-muted-foreground text-center sm:text-left">
            {table.getFilteredSelectedRowModel().rows.length} of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex items-center space-x-6 lg:space-x-8">
            <div className="flex w-[100px] items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
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
      </CardContent>
    </Card>
  )
} 