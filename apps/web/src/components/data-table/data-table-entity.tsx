import React, { useState, useEffect, useMemo } from 'react'
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
  RowData,
  PaginationState,
  ColumnOrderState,
  ColumnSizingState,
  Table as TanstackTable, // Renamed to avoid conflict with local Table component
  Column, // For Faceted Filter
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input' // For Text Filter in Toolbar
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover' // For Faceted Filter
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator as CommandSeparatorUI, // Renamed to avoid conflict
} from '@/components/ui/command' // For Faceted Filter
import { Badge } from '@/components/ui/badge' // For Faceted Filter
import { Separator } from '@/components/ui/separator' // For Faceted Filter
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DoubleArrowLeftIcon,
  DoubleArrowRightIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CaretSortIcon,
  Cross2Icon, // For Toolbar Reset
  MixerHorizontalIcon, // For View Options
  CheckIcon,
  PlusCircledIcon, // For Faceted Filter
} from '@radix-ui/react-icons'
import { AlertCircle, RefreshCw } from 'lucide-react' // For Error Component
import { cn } from '@/lib/utils'
import { useLiveEntity } from '../../db/hooks/useLiveEntity' // Assuming this path is correct relative to the new location
import { useDataTableUiStore } from '../../stores/dataTableUiStore' // Assuming this path is correct

// Imports from the new data-table-logic.tsx
import {
  generateColumnsFromTypeORM,
  TypeORMColumnOptions,
  // SmartCellRenderer, // SmartCellRenderer is used internally by generateColumnsFromTypeORM
  // pluginRegistry // Not directly used here, but generateColumnsFromTypeORM uses its internal instance
} from './data-table-logic'

// --- DataTableError and DataTableErrorBoundary (from data-table-error.tsx) ---
const DEFAULT_ERROR_MESSAGE_INTERNAL = "An error occurred."

export function DataTableErrorDisplay({ // Renamed to avoid conflict if original is still used elsewhere
  error,
  onRetry,
  title,
  description,
}: {
  error: Error | string
  onRetry?: () => void
  title?: string
  description?: string
}) {
  const errorMessageText = error instanceof Error ? error.message : error
  return (
    <Card className="w-full my-4 border-destructive/50">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center sm:flex-row sm:text-left">
          <AlertCircle className="h-10 w-10 text-destructive mb-4 sm:mb-0 sm:mr-6" />
          <div>
            <h3 className="text-lg font-medium text-destructive">
              {title || DEFAULT_ERROR_MESSAGE_INTERNAL}
            </h3>
            {description && (
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            )}
            <div className="mt-3 p-2 bg-muted/50 rounded-md text-xs overflow-auto text-left max-h-[200px]">
              <pre className="whitespace-pre-wrap">{errorMessageText}</pre>
            </div>
            {onRetry && (
              <Button
                className="mt-4"
                size="sm"
                variant="outline"
                onClick={onRetry}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export class DataTableErrorBoundaryComponent extends React.Component< // Renamed
  {
    children: React.ReactNode
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void
    fallback?: React.ReactNode | ((error: Error, resetError: () => void) => React.ReactNode)
  },
  {
    hasError: boolean
    error: Error | null
    retryCount: number // Kept retryCount for potential future use, though resetError is primary
  }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError?.(error, errorInfo)
    console.error('DataTable error:', error, errorInfo)
  }

  resetError = () => {
    this.setState(prev => ({
      hasError: false,
      error: null,
      retryCount: prev.retryCount + 1
    }))
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === 'function' && this.state.error) {
          return (this.props.fallback as Function)(this.state.error, this.resetError)
        }
        return this.props.fallback
      }
      return (
        <DataTableErrorDisplay
          error={this.state.error || 'Unknown error'}
          onRetry={this.resetError}
          title="Error in Data Table"
          description="There was an error while rendering the data table component."
        />
      )
    }
    return this.props.children
  }
}

// --- Toolbar Components (from data-table/toolbar/*) ---

// DataTableViewOptions (from data-table-view-options.tsx)
interface DataTableViewOptionsProps<TData> {
  table: TanstackTable<TData>
}
function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='ml-auto hidden h-8 lg:flex'
        >
          <MixerHorizontalIcon className='mr-2 h-4 w-4' />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='w-[150px]'>
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {table
          .getAllColumns()
          .filter(
            (column) =>
              typeof column.accessorFn !== 'undefined' && column.getCanHide()
          )
          .map((column) => {
            return (
              <DropdownMenuCheckboxItem
                key={column.id}
                className='capitalize'
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            )
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// DataTableFacetedFilter (from data-table-faceted-filter.tsx)
interface DataTableFacetedFilterProps<TData, TValue> {
  column?: Column<TData, TValue>
  title?: string
  options: {
    label: string
    value: string
    icon?: React.ComponentType<{ className?: string }>
  }[]
}
function DataTableFacetedFilter<TData, TValue>({
  column,
  title,
  options,
}: DataTableFacetedFilterProps<TData, TValue>) {
  const facets = column?.getFacetedUniqueValues()
  const selectedValues = new Set(column?.getFilterValue() as string[])

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant='outline' size='sm' className='h-8 border-dashed'>
          <PlusCircledIcon className='mr-2 h-4 w-4' />
          {title}
          {selectedValues?.size > 0 && (
            <>
              <Separator orientation='vertical' className='mx-2 h-4' />
              <Badge
                variant='secondary'
                className='rounded-sm px-1 font-normal lg:hidden'
              >
                {selectedValues.size}
              </Badge>
              <div className='hidden space-x-1 lg:flex'>
                {selectedValues.size > 2 ? (
                  <Badge
                    variant='secondary'
                    className='rounded-sm px-1 font-normal'
                  >
                    {selectedValues.size} selected
                  </Badge>
                ) : (
                  options
                    .filter((option) => selectedValues.has(option.value))
                    .map((option) => (
                      <Badge
                        variant='secondary'
                        key={option.value}
                        className='rounded-sm px-1 font-normal'
                      >
                        {option.label}
                      </Badge>
                    ))
                )}
              </div>
            </>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-[200px] p-0' align='start'>
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value)
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (isSelected) {
                        selectedValues.delete(option.value)
                      } else {
                        selectedValues.add(option.value)
                      }
                      const filterValues = Array.from(selectedValues)
                      column?.setFilterValue(
                        filterValues.length ? filterValues : undefined
                      )
                    }}
                  >
                    <div
                      className={cn(
                        'border-primary mr-2 flex h-4 w-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className={cn('h-4 w-4')} />
                    </div>
                    {option.icon && (
                      <option.icon className='text-muted-foreground mr-2 h-4 w-4' />
                    )}
                    <span>{option.label}</span>
                    {facets?.get(option.value) && (
                      <span className='ml-auto flex h-4 w-4 items-center justify-center font-mono text-xs'>
                        {facets.get(option.value)}
                      </span>
                    )}
                  </CommandItem>
                )
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparatorUI />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => column?.setFilterValue(undefined)}
                    className='justify-center text-center'
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// DataTableMainToolbar (from data-table-main-toolbar.tsx)
interface DataTableMainToolbarProps<TData> {
  table: TanstackTable<TData>
  textFilterConfig?: { columnId: string; placeholder: string }
  facetedFilterConfigs?: Array<{
    columnId: string
    title: string
    options: Array<{
      label: string
      value: string
      icon?: React.ComponentType<{ className?: string }>
    }>
  }>
}
function DataTableMainToolbar<TData>({
  table,
  textFilterConfig,
  facetedFilterConfigs,
}: DataTableMainToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0

  return (
    <div className='flex items-center justify-between'>
      <div className='flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2'>
        {textFilterConfig && table.getColumn(textFilterConfig.columnId) && (
          <Input
            placeholder={textFilterConfig.placeholder}
            value={
              (table
                .getColumn(textFilterConfig.columnId)
                ?.getFilterValue() as string) ?? ''
            }
            onChange={(event) =>
              table
                .getColumn(textFilterConfig.columnId)
                ?.setFilterValue(event.target.value)
            }
            className='h-8 w-[150px] lg:w-[250px]'
          />
        )}
        <div className='flex gap-x-2'>
          {facetedFilterConfigs &&
            facetedFilterConfigs.map((filterConfig) => {
              const column = table.getColumn(filterConfig.columnId)
              if (!column) {
                return null
              }
              return (
                <DataTableFacetedFilter
                  key={filterConfig.columnId}
                  column={column}
                  title={filterConfig.title}
                  options={filterConfig.options}
                />
              )
            })}
        </div>
        {isFiltered && (
          <Button
            variant='ghost'
            onClick={() => table.resetColumnFilters()}
            className='h-8 px-2 lg:px-3'
          >
            Reset
            <Cross2Icon className='ml-2 h-4 w-4' />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  )
}


// --- EntityDataTable Component ---
export interface EntityDataTableProps<T extends ObjectLiteral & { id: string; createdAt?: string | Date; updatedAt?: string | Date }> {
  tableId: string
  entityType: string
  entityMetadata?: any // This should ideally be TypeORMEntityMetadata from data-table-logic
  service: {
    getRepo: () => any // Consider a more specific type for Repository
    getById?: (id: string) => Promise<T | null>
    update: (id: string, data: Partial<T>) => Promise<T>
    delete?: (id: string) => Promise<void>
    create?: (data: Partial<T>) => Promise<T>
  }
  relatedServices?: Record<string, any> // For relationship cell configs
  typeormOptions?: TypeORMColumnOptions // From data-table-logic
  title?: string
  showCard?: boolean
  customColumns?: ColumnDef<T, any>[] // Allow passing fully custom columns
  customEditableColumns?: string[];
  tableConfig?: {
    pageSize?: number
    enableSorting?: boolean
    enablePagination?: boolean
    pageSizeOptions?: number[]
  }
  additionalTableProps?: Record<string, any> // For Card props or outer div props
  onEntityUpdated?: (entity: T) => void
  onEntityDeleted?: (id: string) => void
  onEntityCreated?: (entity: T) => void
  liveQueryBuilder: SelectQueryBuilder<T>;
  textFilterConfig?: { columnId: string; placeholder: string; }
  facetedFilterConfigs?: Array<{
    columnId: string;
    title: string;
    options: Array<{ label: string; value: string; icon?: React.ComponentType<{ className?: string }> }>
  }>
  emptyState?: React.ReactNode

  // Internalized configuration props
  retryOnError?: boolean // Not directly used by UI, error boundary handles retry
  maxRetryAttempts?: number // Not directly used by UI
  loadingMessage?: string
  emptyMessage?: string
  errorMessage?: string
  // cacheExpiryTime?: number // Not used by UI

  defaultEditableFields?: string[]
  defaultSorting?: SortingState
  // fieldFormatters?: { [fieldName: string]: (value: any) => string } // For future use
  // fieldLabels?: { [fieldName: string]: string } // For future use
}

const internalDefaultConfig = {
  loadingMessage: "Loading data...",
  emptyMessage: "No results found.",
  errorMessage: "An error occurred while loading data.",
  defaultSorting: [] as SortingState,
  defaultEditableFields: [] as string[],
  defaultTableConfig: {
    pageSize: 10,
    enableSorting: true,
    enablePagination: true,
    pageSizeOptions: [10, 20, 30, 40, 50],
  },
};

export function EntityDataTable<T extends ObjectLiteral & { id: string; createdAt?: string | Date; updatedAt?: string | Date }>({
  tableId,
  entityType,
  entityMetadata,
  service,
  relatedServices = {},
  typeormOptions = {},
  title = '',
  showCard = true,
  customColumns,
  customEditableColumns,
  tableConfig = {},
  additionalTableProps = {},
  onEntityUpdated,
  // onEntityDeleted, // Not used directly in this component's rendering logic
  // onEntityCreated, // Not used directly
  liveQueryBuilder: propsLiveQueryBuilder,
  textFilterConfig,
  facetedFilterConfigs,
  emptyState,
  loadingMessage: propsLoadingMessage,
  emptyMessage: propsEmptyMessage,
  errorMessage: propsErrorMessage,
  defaultEditableFields: propsDefaultEditableFields,
  defaultSorting: propsDefaultSorting,
}: EntityDataTableProps<T>) {
  if (!tableId) {
    throw new Error('EntityDataTable: tableId prop is required.');
  }

  const { getUiState, setUiState } = useDataTableUiStore();
  const persistedState = getUiState(tableId);

  const initialSorting = persistedState?.sorting ?? propsDefaultSorting ?? internalDefaultConfig.defaultSorting;
  const [currentSorting, setCurrentSorting] = useState<SortingState>(initialSorting)

  const initialColumnVisibility = persistedState?.columnVisibility ?? {};
  const [currentColumnVisibility, setCurrentColumnVisibility] = useState<VisibilityState>(initialColumnVisibility)

  const initialColumnFilters = persistedState?.columnFilters ?? [];
  const [currentColumnFilters, setCurrentColumnFilters] = useState<ColumnFiltersState>(initialColumnFilters)

  const initialColumnOrder = persistedState?.columnOrder ?? [];
  const [currentColumnOrder, setCurrentColumnOrder] = useState<ColumnOrderState>(initialColumnOrder);

  const initialColumnSizing = persistedState?.columnSizing ?? {};
  const [currentColumnSizing, setCurrentColumnSizing] = useState<ColumnSizingState>(initialColumnSizing);
  
  const [rowSelection, setRowSelection] = useState({})

  const initialPageSizeProp = tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize;

  const initialPaginationState = persistedState?.pagination ?? {
    pageIndex: 0,
    pageSize: initialPageSizeProp,
  };
  const [{ pageIndex, pageSize: currentPageSize }, setPagination] = useState<PaginationState>(initialPaginationState);

  const paginationHookState = useMemo(
    () => ({
      pageIndex,
      pageSize: currentPageSize,
    }),
    [pageIndex, currentPageSize]
  );
  
  const effectiveTypeormOptions = useMemo(() => {
    const options: TypeORMColumnOptions = { // Ensure TypeORMColumnOptions is used
      ...typeormOptions,
      entityName: entityType, // Pass entityType to be used as entityName in generateColumnsFromTypeORM
      enableEntityPlugins: true, // As per original logic
    };
    // Combine relationshipConfigs from props and relatedServices
    const combinedRelationshipConfigs = { ...(typeormOptions.relationshipConfigs || {}) };
    Object.entries(relatedServices).forEach(([key, svc]) => {
      if (!combinedRelationshipConfigs[key]) {
        combinedRelationshipConfigs[key] = {
          service: svc,
          displayField: 'name', // Default display field, can be overridden in typeormOptions
        };
      }
    });
    return {
      ...options,
      relationshipConfigs: combinedRelationshipConfigs,
    };
  }, [entityType, relatedServices, typeormOptions]);

  const { data: liveData, loading: liveLoading, error: liveError } = useLiveEntity<T>(
    propsLiveQueryBuilder,
    { enabled: !!propsLiveQueryBuilder, transform: true } // Assuming transform is desired
  );
  
  const generatedColumns = useMemo(() => {
    if (customColumns) return customColumns;
    if (entityMetadata) {
      // Pass the fully resolved effectiveTypeormOptions
      return generateColumnsFromTypeORM<T>(entityMetadata, effectiveTypeormOptions);
    }
    console.warn(`No entity metadata or custom columns provided for ${entityType}`);
    return [] as ColumnDef<T, any>[];
  }, [customColumns, entityMetadata, effectiveTypeormOptions, entityType]);
  
  // These are now directly from tableConfig
  const enablePagination = tableConfig.enablePagination ?? internalDefaultConfig.defaultTableConfig.enablePagination;
  const enableSorting = tableConfig.enableSorting ?? internalDefaultConfig.defaultTableConfig.enableSorting;
  const resolvedEditableColumns = customEditableColumns ?? propsDefaultEditableFields ?? internalDefaultConfig.defaultEditableFields;

  const resolvedLoadingMessage = propsLoadingMessage ?? internalDefaultConfig.loadingMessage;
  const resolvedEmptyMessage = propsEmptyMessage ?? internalDefaultConfig.emptyMessage;
  const resolvedErrorMessage = propsErrorMessage ?? internalDefaultConfig.errorMessage;

  const table = useReactTable({
    data: liveData || [],
    columns: generatedColumns,
    state: {
      sorting: currentSorting,
      columnVisibility: currentColumnVisibility,
      columnFilters: currentColumnFilters,
      columnOrder: currentColumnOrder,
      columnSizing: currentColumnSizing,
      rowSelection,
      ...(enablePagination && { pagination: paginationHookState }),
    },
    meta: {
      onUpdate: (rowId: string, columnId: string, value: any) => handleUpdate(rowId, columnId, value),
      editableColumns: resolvedEditableColumns,
      tableReady: !liveLoading && !!(liveData || []).length,
    },
    enableRowSelection: true,
    enableSorting,
    enableColumnResizing: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setCurrentSorting,
    onColumnFiltersChange: setCurrentColumnFilters,
    onColumnVisibilityChange: setCurrentColumnVisibility,
    onColumnOrderChange: setCurrentColumnOrder,
    onColumnSizingChange: setCurrentColumnSizing,
    ...(enablePagination && { onPaginationChange: setPagination }),
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(enablePagination && { getPaginationRowModel: getPaginationRowModel() }),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    getRowId: (row: T) => row.id,
  });
  
  useEffect(() => {
    const newSortingState = table.getState().sorting;
    if (newSortingState !== undefined && JSON.stringify(newSortingState) !== JSON.stringify(persistedState?.sorting ?? [])) {
      setUiState(tableId, { sorting: newSortingState });
    }
  }, [table.getState().sorting, tableId, setUiState, persistedState?.sorting]);

  useEffect(() => {
    const newColumnVisibilityState = table.getState().columnVisibility;
    if (newColumnVisibilityState !== undefined && JSON.stringify(newColumnVisibilityState) !== JSON.stringify(persistedState?.columnVisibility ?? {})) {
      setUiState(tableId, { columnVisibility: newColumnVisibilityState });
    }
  }, [table.getState().columnVisibility, tableId, setUiState, persistedState?.columnVisibility]);

  useEffect(() => {
    const newColumnOrderState = table.getState().columnOrder;
    if (newColumnOrderState !== undefined && JSON.stringify(newColumnOrderState) !== JSON.stringify(persistedState?.columnOrder ?? [])) {
      setUiState(tableId, { columnOrder: newColumnOrderState });
    }
  }, [table.getState().columnOrder, tableId, setUiState, persistedState?.columnOrder]);

  useEffect(() => {
    const newColumnSizingState = table.getState().columnSizing;
    if (newColumnSizingState !== undefined) {
        if (Object.keys(newColumnSizingState).length > 0 && JSON.stringify(newColumnSizingState) !== JSON.stringify(persistedState?.columnSizing ?? {})) {
            setUiState(tableId, { columnSizing: newColumnSizingState });
        } else if (Object.keys(newColumnSizingState).length === 0 && persistedState?.columnSizing && Object.keys(persistedState.columnSizing).length > 0) {
            setUiState(tableId, { columnSizing: {} });
        }
    }
  }, [table.getState().columnSizing, tableId, setUiState, persistedState?.columnSizing]);
  
  useEffect(() => {
    const newColumnFiltersState = table.getState().columnFilters;
    if (newColumnFiltersState !== undefined && JSON.stringify(newColumnFiltersState) !== JSON.stringify(persistedState?.columnFilters ?? [])) {
      setUiState(tableId, { columnFilters: newColumnFiltersState });
    }
  }, [table.getState().columnFilters, tableId, setUiState, persistedState?.columnFilters]);

  // This useEffect now correctly depends on tableConfig.pageSize for its logic if needed,
  // and initialPageSize is correctly derived from tableConfig.pageSize.
  useEffect(() => {
    const newPaginationState = table.getState().pagination;
    if (newPaginationState !== undefined) {
      const validNewPaginationState = {
        pageIndex: newPaginationState.pageIndex ?? 0,
        pageSize: newPaginationState.pageSize ?? tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize,
      };
      const persistedPagination = persistedState?.pagination ?? { pageIndex: 0, pageSize: tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize };
      if (JSON.stringify(validNewPaginationState) !== JSON.stringify(persistedPagination)) {
        setUiState(tableId, { pagination: validNewPaginationState });
      }
    }
  }, [table.getState().pagination, tableId, setUiState, persistedState?.pagination, tableConfig.pageSize]); // Depend on tableConfig.pageSize

  // Effect to reset pagination when data changes if pagination is NOT enabled
  useEffect(() => {
    if (!tableConfig.enablePagination && liveData) {
      table.resetPageIndex(false);
    }
  }, [liveData, tableConfig.enablePagination, table]);

  // Effect to set table page size when tableConfig.pageSize changes
  useEffect(() => {
    table.setPageSize(Number(tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize));
  }, [table, tableConfig.pageSize]);

  const handleUpdate = async (rowId: string, columnId: string, value: any): Promise<void> => {
    try {
      const updateData = { [columnId]: value } as unknown as Partial<T>
      const updatedEntity = await service.update(rowId, updateData)
      onEntityUpdated?.(updatedEntity)
      // Data will be updated by useLiveEntity
    } catch (error) {
      console.error(`Error updating ${entityType}:`, error)
      throw error; // Re-throw to allow cell to handle error state
    }
  }
  
  if (liveError) {
    return (
      <DataTableErrorDisplay
        error={liveError}
        title={`Error Loading ${title || entityType}`}
        description={resolvedErrorMessage}
      />
    )
  }

  const constructedToolbar = (
    <div className="flex items-center space-x-2">
      <DataTableMainToolbar
        table={table}
        textFilterConfig={textFilterConfig}
        facetedFilterConfigs={facetedFilterConfigs}
      />
    </div>
  );

  const renderSortableHeader = (header: any) => {
    const canSort = header.column.getCanSort()
    const isSorted = header.column.getIsSorted()
    return (
      <div className="flex items-center">
        {flexRender(
          header.column.columnDef.header,
          header.getContext()
        )}
        {canSort && tableConfig.enableSorting && ( // Use tableConfig.enableSorting
          <div className="ml-2">
            {isSorted === "desc" ? (
              <ArrowDownIcon className="h-4 w-4" />
            ) : isSorted === "asc" ? (
              <ArrowUpIcon className="h-4 w-4" />
            ) : (
              <CaretSortIcon className="h-4 w-4 opacity-50" />
            )}
          </div>
        )}
      </div>
    )
  }

  const pageSizeOptions = tableConfig.pageSizeOptions ?? internalDefaultConfig.defaultTableConfig.pageSizeOptions;

  const paginationComponent = tableConfig.enablePagination && ( // Use tableConfig.enablePagination
    <div className="flex items-center justify-between p-4 border-t">
      <div className="flex-1 text-sm text-muted-foreground">
        {table.getFilteredSelectedRowModel().rows.length} of{" "}
        {table.getFilteredRowModel().rows.length} row(s) selected.
      </div>
      <div className="flex items-center space-x-6 lg:space-x-8">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium">Rows per page</p>
          <Select
            value={`${table.getState().pagination?.pageSize ?? tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize}`}
            onValueChange={(value) => {
              table.setPageSize(Number(value))
            }}
          >
            <SelectTrigger className="h-8 w-[70px]">
              <SelectValue placeholder={`${table.getState().pagination?.pageSize ?? tableConfig.pageSize ?? internalDefaultConfig.defaultTableConfig.pageSize}`} />
            </SelectTrigger>
            <SelectContent side="top">
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex w-[100px] items-center justify-center text-sm font-medium">
          Page {table.getState().pagination?.pageIndex !== undefined
            ? table.getState().pagination.pageIndex + 1
            : 1} of{" "}
          {table.getPageCount() === 0 ? 1 : table.getPageCount()}
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            className="hidden h-8 w-8 p-0 lg:flex"
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
            className="hidden h-8 w-8 p-0 lg:flex"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <span className="sr-only">Go to last page</span>
            <DoubleArrowRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )

  const tableRenderContent = (
    <div className='space-y-4'>
      <div className='rounded-md border'>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isClickable = enableSorting && header.column.getCanSort()
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={isClickable ? 'cursor-pointer select-none' : ''}
                      onClick={isClickable ? header.column.getToggleSortingHandler() : undefined}
                      style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    >
                      {header.isPlaceholder
                        ? null
                        : renderSortableHeader(header)
                      }
                      {header.column.getCanResize() && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          className={`resizer absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none ${
                            header.column.getIsResizing() ? 'bg-blue-500 opacity-50' : ''
                          }`}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {liveLoading ? (
              <TableRow>
                <TableCell
                  colSpan={table.getAllColumns().length}
                  className='h-24 text-center'
                >
                  {resolvedLoadingMessage}
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} style={{ width: cell.column.getSize() !== 150 ? cell.column.getSize() : undefined }}>
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
                  colSpan={table.getAllColumns().length}
                  className='h-24 text-center'
                >
                  {emptyState || resolvedEmptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {paginationComponent}
    </div>
  )

  const tableComponent = (
    <DataTableErrorBoundaryComponent> {/* Use renamed component */}
      {tableRenderContent}
    </DataTableErrorBoundaryComponent>
  )

  if (showCard) {
    return (
      <Card {...additionalTableProps}>
        {(title || textFilterConfig || facetedFilterConfigs) && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
            {title && <CardTitle>{title}</CardTitle>}
            {constructedToolbar}
          </CardHeader>
        )}
        <CardContent className="p-0">
          {tableComponent}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col space-y-2">
      {(title || textFilterConfig || facetedFilterConfigs) && (
        <div className="flex items-center justify-between">
          {title && <h2 className="text-2xl font-bold tracking-tight">{title}</h2>}
          {constructedToolbar}
        </div>
      )}
      {tableComponent}
    </div>
  )
}

// Extend TableMeta for type safety with custom meta properties
declare module '@tanstack/react-table' {
  interface TableMeta<TData extends RowData> {
    onUpdate: (rowId: string, columnId: string, value: any) => Promise<void>;
    editableColumns: string[];
    tableReady?: boolean;
  }
}