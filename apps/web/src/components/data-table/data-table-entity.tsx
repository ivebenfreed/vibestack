import React, { useState, useEffect, useMemo, useRef } from 'react'
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
  Cell, // For explicit cell type
} from '@tanstack/react-table'
import { SelectQueryBuilder, ObjectLiteral } from 'typeorm'
import { getMetadataStorage, validateSync } from 'class-validator'; // For validation
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
import { Checkbox } from "@/components/ui/checkbox" // For boolean inputs
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
import { AlertCircle, RefreshCw, Loader2, Trash2 } from 'lucide-react' // For Error Component and loading states
import { cn } from '@/lib/utils'
import { useLiveEntity } from '../../db/hooks/useLiveEntity' // Assuming this path is correct relative to the new location
import { useDataTableUiStore } from '../../stores/dataTableUiStore' // Assuming this path is correct
import { DataTableSkeleton } from '@/components/ui/table-skeleton' // Added import
import { useContentWidth } from '@/hooks/use-content-width' // Add this import

import { toast } from 'sonner' // For notifications

// Imports from the new data-table-logic.tsx
import {
  generateColumnsFromTypeORM,
  TypeORMColumnOptions,
  BulkActionConfig,
  createBulkActionHandlers,
  createBulkEditHandlers,
  createSelectionColumn,
  BulkEditField,
  // SmartCellRenderer, // SmartCellRenderer is used internally by generateColumnsFromTypeORM
  // pluginRegistry // Not directly used here, but generateColumnsFromTypeORM uses its internal instance
} from './data-table-logic'
import { BulkEditDropdown } from './bulk-edit-dropdown'

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
          className='ml-auto h-8'
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
  entityMetadata: any // Required for validation and proper column generation - should ideally be TypeORMEntityMetadata from data-table-logic
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
    enableColumnResizing?: boolean
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

  // Props for inline record creation
  enableInlineCreate?: boolean
  initialNewRecordData?: Partial<T>

  // Props for bulk actions
  enableBulkActions?: boolean
  onBulkDelete?: (selectedIds: string[]) => Promise<void>
  customBulkActions?: BulkActionConfig<T>[]
  bulkEditFields?: BulkEditField[] // Quick edit fields shown in toolbar

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
  onEntityDeleted,
  liveQueryBuilder: propsLiveQueryBuilder,
  textFilterConfig,
  facetedFilterConfigs,
  emptyState,
  loadingMessage: propsLoadingMessage,
  emptyMessage: propsEmptyMessage,
  errorMessage: propsErrorMessage,
  defaultEditableFields: propsDefaultEditableFields,
  defaultSorting: propsDefaultSorting,
  initialNewRecordData: propInitialNewRecordData, // Renamed to avoid conflict with state variable
  enableInlineCreate,
  onEntityCreated,
  enableBulkActions = false,
  onBulkDelete,
  customBulkActions = [],
  bulkEditFields = [],
}: EntityDataTableProps<T>) {
  if (!tableId) {
    throw new Error('EntityDataTable: tableId prop is required.');
  }

  // Add content width hook for responsive table sizing
  const { contentWidth: availableContentWidth } = useContentWidth({ includePadding: true });

  const { getUiState, setUiState } = useDataTableUiStore();
  const persistedState = getUiState(tableId);

  const initialSorting = persistedState?.sorting ?? propsDefaultSorting ?? internalDefaultConfig.defaultSorting;
  const [currentSorting, setCurrentSorting] = useState<SortingState>(initialSorting)

  const initialColumnVisibility = persistedState?.columnVisibility ?? {};
  
  // Hide ID columns by default unless showIdColumn is enabled
  const defaultHiddenColumns = useMemo(() => {
    const hidden: VisibilityState = {};
    const showId = typeormOptions.showIdColumn ?? false;
    
    if (!showId && entityMetadata?.columns) {
      entityMetadata.columns.forEach((column: any) => {
        if (column.propertyName === 'id' || column.isPrimary === true) {
          hidden[column.propertyName] = false;
        }
      });
    }
    
    return hidden;
  }, [typeormOptions.showIdColumn, entityMetadata]);
  
  const [currentColumnVisibility, setCurrentColumnVisibility] = useState<VisibilityState>({
    ...defaultHiddenColumns,
    ...initialColumnVisibility
  })

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

  // State for inline new record creation
  const [isAddingNewRecord, setIsAddingNewRecord] = useState(false);
  const [newRecordData, setNewRecordData] = useState<Partial<T>>(propInitialNewRecordData || {});
  const [newRecordValidationErrors, setNewRecordValidationErrors] = useState<Record<string, string>>({});
  const [newRecordSubmissionStatus, setNewRecordSubmissionStatus] = useState<'idle' | 'validating' | 'submitting' | 'success' | 'error'>('idle');

  // Refs for focus management
  const addRecordButtonRef = useRef<HTMLButtonElement>(null);

  // State for bulk actions
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(null);

  const validateNewRecord = (data: Partial<T>): Record<string, string> => {
    console.log('[DataTable Debug] validateNewRecord called with data:', data);
    const errors: Record<string, string> = {};
    
    if (!entityMetadata || !entityMetadata.columns || !Array.isArray(entityMetadata.columns)) {
      console.log('[DataTable Debug] No valid entityMetadata, returning empty errors');
      return errors;
    }

    // Filter out auto-generated columns early for performance
    const requiredColumns = entityMetadata.columns.filter((column: any) => 
      !column.isNullable && 
      !column.isGenerated && 
      !column.hasDefault &&
      column.defaultValue === undefined &&
      column.propertyName !== 'id' && 
      column.propertyName !== 'createdAt' && 
      column.propertyName !== 'updatedAt' && 
      column.propertyName !== 'client_id'
    );

    console.log('[DataTable Debug] Checking', requiredColumns.length, 'required columns');

    // Validate only required columns efficiently
    for (const column of requiredColumns) {
      const value = data[column.propertyName as keyof T];
      if (value === undefined || value === null || value === '') {
        console.log(`[DataTable Debug] Required field missing: ${column.propertyName}`);
        errors[column.propertyName] = `${column.propertyName} is required.`;
      }
    }

    console.log('[DataTable Debug] Validation completed with', Object.keys(errors).length, 'errors');
    return errors;
  };

  // --- Inline Create Handlers ---
  const handleAddRecord = () => {
    setIsAddingNewRecord(true);
    setNewRecordData(propInitialNewRecordData || {});
    setNewRecordValidationErrors({});
    setNewRecordSubmissionStatus('idle');
    // Auto-focus will be handled by the autoFocus prop on the first editable field
  };

  const handleCancelNewRecord = () => {
    setIsAddingNewRecord(false);
    setNewRecordData({}); // Clear data
    setNewRecordValidationErrors({});
    setNewRecordSubmissionStatus('idle');
    addRecordButtonRef.current?.focus();
  };

  const handleNewRecordFieldChange = (fieldName: keyof T, value: any) => {
    console.log('[DataTable Debug] handleNewRecordFieldChange called:', { fieldName, value });
    console.log('[DataTable Debug] Previous newRecordData:', newRecordData);
    
    setNewRecordData(prev => {
      const updated = { ...prev, [fieldName]: value };
      console.log('[DataTable Debug] Updated newRecordData:', updated);
      return updated;
    });
    
    if (newRecordValidationErrors[fieldName as string]) {
      setNewRecordValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldName as string];
        console.log('[DataTable Debug] Cleared validation error for:', fieldName);
        return newErrors;
      });
    }
  };

  const handleSaveNewRecord = async (triggerFieldName?: string, triggerFieldValue?: any) => {
    console.log('[DataTable Debug] handleSaveNewRecord called');
    if (triggerFieldName) {
      console.log('[DataTable Debug] triggerField:', { triggerFieldName, triggerFieldValue });
    }

    if (!service.create) {
      console.error("Create service function not provided.");
      setNewRecordValidationErrors({ _form: "Cannot create record: Service unavailable." });
      setNewRecordSubmissionStatus('error');
      return;
    }

    // Get the latest data, including the trigger field value if provided
    const currentData = { ...newRecordData };
    if (triggerFieldName && triggerFieldValue !== undefined) {
      currentData[triggerFieldName as keyof T] = triggerFieldValue;
    }

    // Validate the current data (including the trigger field)
    const errors = validateNewRecord(currentData);
    
    if (Object.keys(errors).length > 0) {
      console.log('[DataTable Debug] Validation failed:', errors);
      setNewRecordValidationErrors(errors);
      setNewRecordSubmissionStatus('error');
      return;
    }

    // Clear any previous errors and start submission
    setNewRecordValidationErrors({});
    setNewRecordSubmissionStatus('submitting');

    try {
      // Prepare data for submission using the current data
      const dataToSave: Partial<T> = {};
      entityMetadata.columns.forEach((col: any) => {
        if (currentData[col.propertyName as keyof T] !== undefined) {
          (dataToSave as any)[col.propertyName] = currentData[col.propertyName as keyof T];
        }
      });

      console.log('[DataTable Debug] Submitting to PGlite:', dataToSave);

      // Submit to PGlite - this will be fast since it's local
      const createdEntity = await service.create(dataToSave);

      // Notify parent component
      onEntityCreated?.(createdEntity);

      // Show success feedback
      toast.success(`${entityType} created successfully!`);

      // Reset form for next entry - live query will update the table automatically
      setNewRecordData(propInitialNewRecordData || {});
      setNewRecordSubmissionStatus('idle');

      console.log('[DataTable Debug] Record created successfully');

    } catch (error: any) {
      console.error(`[DataTable Debug] PGlite error:`, error);
      const errorMessage = error.message || "An unexpected error occurred.";
      setNewRecordValidationErrors({ _form: errorMessage });
      setNewRecordSubmissionStatus('error');
      toast.error(`Error creating ${entityType}: ${errorMessage}`);
    }
  };

  const getColumnInputType = (column: any): string => {
    const columnMeta = entityMetadata?.columns.find((c: any) => c.propertyName === column.id);
    if (columnMeta) {
      switch (columnMeta.type) {
        case 'number':
        case 'int':
        case 'integer':
        case 'float':
        case 'double':
        case 'decimal':
          return 'number';
        case 'date':
          return 'date';
        case 'datetime':
        case 'timestamp':
          return 'datetime-local'; // Or 'date' if time part is not needed
        case 'boolean':
          return 'boolean'; // Specific type for Checkbox
        default:
          // Check for enum type
          if (columnMeta.enum) {
            return 'enum';
          }
          return 'text';
      }
    }
    return 'text';
  };

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
      enableRowSelection: enableBulkActions, // Enable row selection when bulk actions are enabled
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
  }, [entityType, relatedServices, typeormOptions, enableBulkActions]);

  const { data: liveData, loading: liveLoading, error: liveError } = useLiveEntity<T>(
    propsLiveQueryBuilder,
    { enabled: !!propsLiveQueryBuilder, transform: true } // Assuming transform is desired
  );
  
  // Check if related services are available - only wait for the ones we have in relatedServices
  const areRelatedServicesLoading = useMemo(() => {
    // If no related services are needed, return false (not loading)
    if (!relatedServices || Object.keys(relatedServices).length === 0) {
      return false;
    }
    
    // Check if any of the required related services are missing or undefined
    return Object.values(relatedServices).some(service => !service);
  }, [relatedServices]);
  
  // Overall loading state - wait for live data and related services
  const isFullyLoading = liveLoading || areRelatedServicesLoading;
  
  const generatedColumns = useMemo(() => {
    let columns: ColumnDef<T, any>[];
    
    if (customColumns) {
      columns = customColumns;
    } else if (entityMetadata) {
      // Pass the fully resolved effectiveTypeormOptions - selection column will be added automatically if enabled
      columns = generateColumnsFromTypeORM<T>(entityMetadata, effectiveTypeormOptions);
    } else {
      console.warn(`No entity metadata or custom columns provided for ${entityType}`);
      columns = [] as ColumnDef<T, any>[];
    }
    
    // Add selection column at the beginning if bulk actions are enabled (for both custom and generated columns)
    if (enableBulkActions) {
      const selectionColumn = createSelectionColumn<T>();
      columns = [selectionColumn, ...columns];
    }
    
    // Enforce ID column hiding rules regardless of column source
    const showId = typeormOptions.showIdColumn ?? false;
    if (!showId) {
      columns = columns.map(column => {
        // Check if this is an ID column by looking at accessorKey or id
        const columnKey = (column as any).accessorKey || column.id;
        const isIdColumn = columnKey === 'id' || 
          (typeof columnKey === 'string' && 
           entityMetadata?.columns?.find((c: any) => c.propertyName === columnKey && c.isPrimary === true));
        
        if (isIdColumn) {
          return {
            ...column,
            enableHiding: false // Disable hiding for ID columns when showIdColumn is false
          };
        }
        return column;
      });
    }
    
    return columns;
  }, [customColumns, entityMetadata, effectiveTypeormOptions, entityType, typeormOptions.showIdColumn, enableBulkActions]);
  
  // These are now directly from tableConfig
  const enablePagination = tableConfig.enablePagination ?? internalDefaultConfig.defaultTableConfig.enablePagination;
  const enableSorting = tableConfig.enableSorting ?? internalDefaultConfig.defaultTableConfig.enableSorting;
  const enableColumnResizing = tableConfig.enableColumnResizing ?? true; // Default to true for better UX
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
      tableReady: !isFullyLoading && !!(liveData || []).length,
    },
    enableRowSelection: true,
    enableSorting,
    enableColumnResizing,
    columnResizeMode: 'onChange',
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
  
  // Memoize editable columns calculation to avoid expensive computation on every render
  const editableColumnsForNewRecord = useMemo(() => {
    if (!isAddingNewRecord) return [];
    
    return table.getVisibleLeafColumns().filter(col => 
      col.id !== 'select' &&
      col.id !== 'id' && 
      col.id !== 'createdAt' && 
      col.id !== 'updatedAt' && 
      col.id !== 'client_id' && 
      !entityMetadata?.columns.find((c:any) => c.propertyName === col.id)?.isGenerated
    );
  }, [isAddingNewRecord, table, entityMetadata]);

  const firstEditableColumnId = useMemo(() => {
    return editableColumnsForNewRecord.length > 0 ? editableColumnsForNewRecord[0].id : null;
  }, [editableColumnsForNewRecord]);
  
  // Memoize column metadata mapping to avoid repeated .find() calls
  const columnMetadataMap = useMemo(() => {
    if (!entityMetadata?.columns) return new Map();
    
    const map = new Map();
    entityMetadata.columns.forEach((col: any) => {
      map.set(col.propertyName, col);
    });
    return map;
  }, [entityMetadata]);

  // Memoize column configurations for new record row to avoid expensive computation during render
  const newRecordColumnConfigs = useMemo(() => {
    if (!isAddingNewRecord) return [];
    
    return table.getVisibleLeafColumns().map((column) => {
      const columnMeta = columnMetadataMap.get(column.id);
      
      const isAutoGenerated = column.id === 'id' || 
        column.id === 'createdAt' || 
        column.id === 'updatedAt' || 
        column.id === 'client_id' || 
        columnMeta?.isGenerated;

      const isRequired = columnMeta && 
        !columnMeta.isNullable && 
        !columnMeta.isGenerated && 
        !columnMeta.hasDefault &&
        columnMeta.defaultValue === undefined &&
        !isAutoGenerated;

      return {
        column,
        columnMeta,
        isAutoGenerated,
        isRequired,
        isFirstEditable: false // Will be set below
      };
    });
  }, [isAddingNewRecord, table, columnMetadataMap]);

  // Set the first editable column flag
  useMemo(() => {
    const firstEditableIndex = newRecordColumnConfigs.findIndex(config => !config.isAutoGenerated);
    if (firstEditableIndex >= 0) {
      newRecordColumnConfigs[firstEditableIndex].isFirstEditable = true;
    }
  }, [newRecordColumnConfigs]);
  
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

  // Keyboard navigation for new record row
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isAddingNewRecord && event.key === 'Escape') {
        handleCancelNewRecord();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAddingNewRecord, handleCancelNewRecord]);


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
    // This is now just a simple pass-through to the service
    // Individual editing components handle their own optimistic updates
    const updateData = { [columnId]: value } as unknown as Partial<T>
    const updatedEntity = await service.update(rowId, updateData)
    
    // Notify parent component
    onEntityUpdated?.(updatedEntity)
    
    // Live query will automatically update the table data
    return
  }

  // Bulk action handlers using the logic utilities
  const bulkHandlers = useMemo(() => 
    createBulkActionHandlers(
      service,
      {
        onBulkDelete,
        onEntityDeleted,
        customActions: customBulkActions,
        entityType
      },
      toast
    ), 
    [service, onBulkDelete, onEntityDeleted, customBulkActions, entityType]
  );

  // Bulk edit handlers
  const bulkEditHandlers = useMemo(() => 
    createBulkEditHandlers(
      service,
      entityType,
      toast
    ), 
    [service, entityType]
  );

  const handleBulkDelete = async () => {
    const selectedIds = table.getSelectedRowModel().rows.map(row => row.id);
    if (selectedIds.length === 0) return;
    
    setBulkActionLoading('delete');
    try {
      await bulkHandlers.handleBulkDelete(selectedIds);
      table.resetRowSelection();
    } catch (error) {
      // Error already handled by the utility
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleCustomBulkAction = async (action: BulkActionConfig<T>) => {
    const selectedRows = table.getSelectedRowModel().rows;
    const selectedData = selectedRows.map(row => row.original);
    const selectedIds = selectedRows.map(row => row.id);
    
    if (selectedIds.length === 0) return;
    
    setBulkActionLoading(action.label);
    try {
      await bulkHandlers.handleCustomBulkAction(action, selectedData, selectedIds);
      table.resetRowSelection();
    } catch (error) {
      // Error already handled by the utility
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleBulkUpdate = async (updates: Partial<T>) => {
    const selectedIds = table.getSelectedRowModel().rows.map(row => row.id);
    if (selectedIds.length === 0) return;
    
    try {
      await bulkEditHandlers.handleBulkUpdate(selectedIds, updates);
      // Don't reset selection after bulk edit - user might want to make more changes
    } catch (error) {
      // Error already handled by the utility
      throw error; // Re-throw for dropdown component to handle loading state
    }
  };
  
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

  // Bulk actions toolbar with smooth transitions
  const selectedRowCount = table.getSelectedRowModel().rows.length;
  const showBulkActions = enableBulkActions && selectedRowCount > 0;

  const bulkActionsToolbar = enableBulkActions && (
    <div 
      className={cn(
        "transition-all duration-200 ease-in-out overflow-hidden",
        showBulkActions 
          ? "max-h-20 opacity-100 mb-4" 
          : "max-h-0 opacity-0 mb-0"
      )}
    >
      <div className="flex items-center px-4 py-3 bg-muted/50 border rounded-lg">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">
            {selectedRowCount} {entityType}{selectedRowCount > 1 ? 's' : ''} selected
          </span>
          
          {/* Bulk Edit Dropdowns */}
          {bulkEditFields.map((field) => (
            <BulkEditDropdown
              key={field.key}
              field={field}
              selectedCount={selectedRowCount}
              onBulkUpdate={handleBulkUpdate}
              isLoading={bulkActionLoading !== null}
            />
          ))}

          {/* Default delete action */}
          {(service.delete || onBulkDelete) && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkActionLoading === 'delete'}
              className="h-8"
            >
              {bulkActionLoading === 'delete' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {bulkActionLoading === 'delete' ? 'Deleting...' : 'Delete'}
            </Button>
          )}
          
          {/* Custom bulk actions */}
          {customBulkActions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              size="sm"
              onClick={() => handleCustomBulkAction(action)}
              disabled={bulkActionLoading === action.label}
              className="h-8"
            >
              {bulkActionLoading === action.label ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                action.icon && <action.icon className="mr-2 h-4 w-4" />
              )}
              {bulkActionLoading === action.label ? 'Processing...' : action.label}
            </Button>
          ))}
          
          {/* Clear selection button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.resetRowSelection()}
            className="h-8"
          >
            Clear Selection
          </Button>
        </div>
      </div>
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
    <div className="flex items-center justify-between py-4 border-t px-4"> {/* Changed p-4 to py-4 + px-4 to match */}
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

  // Calculate total table width from column definitions
  const totalTableWidth = useMemo(() => {
    const width = generatedColumns.reduce((total, column) => {
      const size = (column as any).size || 150; // Default to 150px if no size specified
      return total + size;
    }, 0);
    console.log('Calculated table width:', { 
      totalTableWidth: width, 
      tanstackSize: table.getCenterTotalSize(),
      finalWidth: Math.max(width, table.getCenterTotalSize()),
      columnCount: generatedColumns.length,
      availableContentWidth: availableContentWidth // Add content width to debug info
    });
    return width;
  }, [generatedColumns, table, availableContentWidth]);

  const tableRenderContent = (
    <div className='space-y-4'>
      {/* Bulk Actions Toolbar */}
      <div className="px-4">
        {bulkActionsToolbar}
      </div>
      
      <div className='w-full px-4'>
        <div 
          className='overflow-x-auto rounded-md border' 
          style={{ 
            width: '100%', 
            maxWidth: `${Math.max(availableContentWidth, 300)}px`, // Use content width directly, with minimum
          }}
        >
          <Table 
            className="w-full"
            style={{ 
              minWidth: `${Math.max(totalTableWidth, table.getCenterTotalSize())}px`
            }}
          >
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isClickable = enableSorting && header.column.getCanSort()
                    return (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
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
                        {header.isPlaceholder
                          ? null
                          : renderSortableHeader(header)
                        }
                        {header.column.getCanResize() && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            className={cn(
                              'absolute top-0 right-0 h-full w-1 cursor-col-resize select-none touch-none bg-border hover:bg-border/80',
                              header.column.getIsResizing() && 'bg-primary'
                            )}
                          />
                        )}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {/* Loading State */}
              {isFullyLoading && (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center"
                  >
                    <DataTableSkeleton />
                  </TableCell>
                </TableRow>
              )}

              {/* Existing Rows */}
              {!isFullyLoading &&
                table.getRowModel().rows?.length > 0 &&
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && "selected"}
                  >
                    {row.getVisibleCells().map((cell: Cell<T, unknown>) => (
                      <TableCell
                        key={cell.id}
                        className="whitespace-nowrap"
                        style={{
                          width: `${cell.column.getSize()}px`,
                          minWidth: `${cell.column.getSize()}px`,
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}

              {/* Inline New Record Row - Input Fields */}
              {!isFullyLoading && isAddingNewRecord && (
                <>
                  {/* Input Row */}
                  <TableRow className="bg-muted/20 hover:bg-muted/30 border-t">
                    {newRecordColumnConfigs.map((config) => {
                      const { column, columnMeta, isAutoGenerated, isRequired, isFirstEditable } = config;
                      const errorId = `new-record-${column.id}-error`;

                      // Skip hidden columns completely (this should not happen with getVisibleLeafColumns but extra safety)
                      if (!column.getIsVisible()) {
                        return null;
                      }

                      // Special handling for select column - show empty cell
                      if (column.id === 'select') {
                        return <TableCell key={`${column.id}-new-empty`} className="p-1"></TableCell>;
                      }

                      // Auto-generated fields (show as "Auto" but only if they're visible)
                      if (isAutoGenerated) {
                        return <TableCell key={`${column.id}-new-empty`} className="p-1 text-xs text-muted-foreground italic">Auto</TableCell>;
                      }

                      return (
                        <TableCell key={`${column.id}-new-input`} className="p-1 relative">
                          <label htmlFor={`new-record-${column.id}`} className="sr-only">
                            {column.id}{isRequired ? " (required)" : ""}
                          </label>
                          {flexRender(
                            column.columnDef.cell,
                            {
                              getValue: () => newRecordData[column.id as keyof T] ?? null,
                              row: {
                                id: 'new-record',
                                original: newRecordData as T,
                                index: -1,
                                getIsSelected: () => false,
                                getCanSelect: () => false,
                              },
                              column,
                              table,
                              createMode: true,
                              createValue: newRecordData[column.id as keyof T] ?? null,
                              onCreateValueChange: (value: any) => handleNewRecordFieldChange(column.id as keyof T, value),
                              required: isRequired,
                              onEnterSave: (fieldName: string, fieldValue: any) => handleSaveNewRecord(fieldName, fieldValue),
                              autoFocus: isFirstEditable,
                            } as any
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                  
                  {/* Button Row */}
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={table.getAllColumns().length} className="p-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Button
                            variant="default"
                            size="sm"
                            className="h-8 px-3 text-sm"
                            onClick={() => handleSaveNewRecord()}
                            disabled={newRecordSubmissionStatus === "submitting" || Object.keys(newRecordValidationErrors).length > 0}
                            aria-label="Save new record"
                          >
                            {newRecordSubmissionStatus === "submitting" && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            {newRecordSubmissionStatus === "submitting" ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-sm"
                            onClick={handleCancelNewRecord}
                            disabled={newRecordSubmissionStatus === "submitting"}
                            aria-label="Cancel new record creation"
                          >
                            Cancel
                          </Button>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Press Enter to save, Esc to cancel
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                </>
              )}

              {/* Empty State (if not loading, no existing rows, and not adding a new record) */}
              {!isFullyLoading && !table.getRowModel().rows?.length && !isAddingNewRecord && (
                <TableRow>
                  <TableCell
                    colSpan={table.getAllColumns().length}
                    className="h-24 text-center"
                  >
                    {emptyState || resolvedEmptyMessage}
                  </TableCell>
                </TableRow>
              )}

              {/* "Add Record" Button Row (inside TableBody) */}
              {enableInlineCreate && !isAddingNewRecord && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={table.getAllColumns().length} className="p-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddRecord}
                      className="h-8"
                      ref={addRecordButtonRef}
                      aria-label="Add new record"
                    >
                      <PlusCircledIcon className="mr-2 h-4 w-4" />
                      Add Record
                    </Button>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
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
      <Card {...additionalTableProps} className={cn("w-full max-w-full", additionalTableProps?.className)}>
        {(title || textFilterConfig || facetedFilterConfigs) && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-4 py-3">
            {title && <CardTitle>{title}</CardTitle>}
            {constructedToolbar}
          </CardHeader>
        )}
        <CardContent className="p-0"> {/* Back to p-0 */}
          {tableComponent}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex flex-col space-y-2 w-full max-w-full">
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