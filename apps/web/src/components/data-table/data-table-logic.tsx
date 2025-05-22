import * as React from 'react'
import { ColumnDef, CellContext } from '@tanstack/react-table'
import { EntityMetadata } from 'typeorm' // Used by generateColumnsFromTypeORM
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { format } from 'date-fns'
import { CalendarIcon } from '@radix-ui/react-icons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { usePGliteContext } from '@/db/pglite-provider' // Used by createEntityCell factories

// --- TypeORM Integration ---
export interface TypeORMColumnMetadata {
  propertyName: string
  propertyType: string // Consider using a more specific type if possible, e.g., keyof typeof PrimitiveTypeMap
  isNullable?: boolean
  isEnum?: boolean
  enumName?: string
  type?: string // This seems redundant with propertyType, clarify usage
  isArray?: boolean
  isPrimary?: boolean
  isGenerated?: boolean
  length?: number
  options?: any // Consider a more specific type
  relationMetadata?: any // Consider a more specific type, e.g., TypeORMRelationMetadata
}

export interface TypeORMEntityMetadata {
  name: string
  columns: TypeORMColumnMetadata[]
  relations: Array<{
    propertyName: string
    isManyToOne: boolean
    isOneToOne: boolean
    // Add other relation types if necessary, e.g., isOneToMany, isManyToMany
  }>
}

export interface TypeORMColumnOptions {
  excludeColumns?: string[]
  editableColumns?: string[]
  visibleColumns?: string[] | 'all'
  columnOverrides?: {
    [key: string]: Partial<ColumnDef<any, any>>
  }
  enumMappings?: {
    [key: string]: { label: string, value: any }[]
  }
  relationshipConfigs?: {
    [key: string]: {
      service: any // Consider a more specific type for the service
      displayField: string
      emptyLabel?: string
      filterEntities?: (entities: any[]) => any[]
    }
  }
  enableEntityPlugins?: boolean
  entityName?: string
}

// --- Internal Entity Caching System ---
export const ENTITY_CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds
export const RELATIONSHIP_CACHE_KEYPREFIX = 'relationship:';

export interface EntityCache {
  [key: string]: {
    entities: any[],
    timestamp: number,
    loading: boolean,
    promise: Promise<any[]> | null,
    error: Error | null
  }
}

const globalEntityCache: EntityCache = {}; // Module-level, not exported

export function useCachedEntities<T>(
  cacheKey: string,
  fetchFn: () => Promise<T[]>
): [T[], boolean, Error | null, () => void] {
  const [, forceUpdate] = React.useState({});

  if (!globalEntityCache[cacheKey]) {
    globalEntityCache[cacheKey] = {
      entities: [],
      timestamp: 0,
      loading: false,
      promise: null,
      error: null
    };
  }

  const cache = globalEntityCache[cacheKey];
  const isExpired = Date.now() - cache.timestamp > ENTITY_CACHE_EXPIRY;

  const refreshCache = React.useCallback(() => {
    if (cache.loading) return;
    cache.loading = true;
    cache.error = null;
    forceUpdate({});
    cache.promise = fetchFn()
      .then(data => {
        cache.entities = data;
        cache.timestamp = Date.now();
        cache.loading = false;
        cache.error = null;
        forceUpdate({});
        return data;
      })
      .catch(error => {
        cache.error = error;
        cache.loading = false;
        forceUpdate({});
        throw error;
      });
  }, [cache, fetchFn]);

  React.useEffect(() => {
    if (cache.entities.length === 0 || isExpired) {
      refreshCache();
    }
  }, [cache.entities.length, isExpired, refreshCache]);

  return [cache.entities, cache.loading, cache.error, refreshCache];
}

// --- Cell Rendering Components & Logic ---
export interface EditableCellProps<TData, TValue> extends CellContext<TData, TValue> {
  showEditIcons?: boolean
}

export interface RelationshipConfig<TEntity> {
  fetchOne: (id: string) => Promise<TEntity | null>;
  fetchAll?: () => Promise<TEntity[]>;
  getDisplayValue: (entity: TEntity) => string;
  getEntityId?: (entity: TEntity) => string;
  emptyLabel?: string;
  filterEntities?: (entities: TEntity[]) => TEntity[];
}

export interface EntityConfig<TEntity> {
  serviceName: string;
  getDisplayValue: (entity: TEntity) => string;
  emptyLabel: string;
  getEntityId?: (entity: TEntity) => string;
  filterEntities?: (entities: TEntity[]) => TEntity[];
}

// --- Internal Plugin System ---
export interface DataTableCellPlugin<TData, TValue> {
  id: string
  name: string
  description?: string
  canHandle: (context: CellContext<TData, TValue>) => boolean
  render: (context: CellContext<TData, TValue>) => React.ReactNode
  entityTypes?: string[]
}

export interface DataTableColumnPlugin {
  id: string
  name: string
  description?: string
  enhanceColumn: (
    columnId: string,
    columnDef: any,
    options?: any
  ) => any
  entityTypes?: string[]
}

class DataTablePluginRegistry {
  private cellPlugins: Map<string, DataTableCellPlugin<any, any>> = new Map()
  private columnPlugins: Map<string, DataTableColumnPlugin> = new Map()
  private entityPluginMap: Map<string, string[]> = new Map() // Maps entityType to plugin IDs

  registerCellPlugin<TData, TValue>(plugin: DataTableCellPlugin<TData, TValue>) {
    if (this.cellPlugins.has(plugin.id)) {
      console.warn(`Plugin with ID ${plugin.id} already exists and will be overwritten`)
    }
    this.cellPlugins.set(plugin.id, plugin)
    if (plugin.entityTypes && plugin.entityTypes.length > 0) {
      plugin.entityTypes.forEach(entityType => {
        const plugins = this.entityPluginMap.get(entityType) || []
        if (!plugins.includes(plugin.id)) {
          plugins.push(plugin.id)
          this.entityPluginMap.set(entityType, plugins)
        }
      })
    }
    return this
  }

  registerColumnPlugin(plugin: DataTableColumnPlugin) {
    if (this.columnPlugins.has(plugin.id)) {
      console.warn(`Plugin with ID ${plugin.id} already exists and will be overwritten`)
    }
    this.columnPlugins.set(plugin.id, plugin)
    if (plugin.entityTypes && plugin.entityTypes.length > 0) {
      plugin.entityTypes.forEach(entityType => {
        const plugins = this.entityPluginMap.get(entityType) || []
        if (!plugins.includes(plugin.id)) {
          plugins.push(plugin.id)
          this.entityPluginMap.set(entityType, plugins)
        }
      })
    }
    return this
  }

  getCellPlugin(id: string) {
    return this.cellPlugins.get(id) || null
  }

  getColumnPlugin(id: string) {
    return this.columnPlugins.get(id) || null
  }

  getAllCellPlugins() {
    return Array.from(this.cellPlugins.values())
  }

  getAllColumnPlugins() {
    return Array.from(this.columnPlugins.values())
  }
  
  getPluginsForEntity(entityType: string) {
    return {
      cellPlugins: this.getAllCellPlugins().filter(plugin => 
        !plugin.entityTypes || 
        plugin.entityTypes.includes(entityType)
      ),
      columnPlugins: this.getAllColumnPlugins().filter(plugin => 
        !plugin.entityTypes || 
        plugin.entityTypes.includes(entityType)
      )
    }
  }

  findCellPluginForContext<TData, TValue>(
    context: CellContext<TData, TValue>,
    entityType?: string
  ) {
    if (entityType) {
      for (const plugin of this.getAllCellPlugins()) {
        if (
          plugin.entityTypes?.includes(entityType) &&
          plugin.canHandle(context)
        ) {
          return plugin
        }
      }
    }
    for (const plugin of this.cellPlugins.values()) {
      if (plugin.canHandle(context)) {
        return plugin
      }
    }
    return null
  }
}

const pluginRegistry = new DataTablePluginRegistry() // Module-level, not exported

// --- Helper Functions ---
export function formatHeader(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim()
}

export function formatColumnName(name: string): string {
  if (name.includes('_')) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
}

// --- Cell Renderer Components ---
export function EditableTextCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
}: CellContext<TData, TValue>) {
  const initialValue = getValue() as string
  const [value, setValue] = React.useState(initialValue)
  const [isEditing, setIsEditing] = React.useState(false)
  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const onSave = async () => {
    if (value === initialValue) {
      setIsEditing(false)
      return
    }
    try {
      await meta?.onUpdate?.(row.id, column.id, value)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update cell:', error)
      setValue(initialValue)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue(initialValue)
      setIsEditing(false)
    }
  }

  if (!editable) {
    return <div>{String(value ?? '')}</div>
  }

  if (isEditing) {
    return (
      <Input
        value={String(value ?? '')}
        onChange={(e) => setValue(e.target.value as any)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        className="m-0 h-8 w-full"
        autoFocus
      />
    )
  }

  return (
    <div
      className={cn(
        "truncate py-2",
        editable && "cursor-pointer hover:bg-muted/30 rounded px-2"
      )}
      onClick={() => setIsEditing(true)}
    >
      {String(value ?? '')}
    </div>
  )
}

export function EditableSelectCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
  options,
}: CellContext<TData, TValue> & { options: { label: string; value: string }[] }) {
  const initialValue = getValue() as string
  const [value, setValue] = React.useState(initialValue)
  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const onSave = async (newValue: string) => {
    if (newValue === initialValue) return
    try {
      await meta?.onUpdate?.(row.id, column.id, newValue)
      setValue(newValue as any) // Assuming TValue is compatible with string here
    } catch (error) {
      console.error('Failed to update cell:', error)
      setValue(initialValue as any) // Assuming TValue is compatible with string here
    }
  }

  const currentOption = options.find((option) => option.value === value)
  const displayLabel = currentOption?.label || String(value ?? '')

  if (!editable) {
    return <div>{displayLabel}</div>
  }

  return (
    <Select
      value={String(value ?? '')}
      onValueChange={onSave}
    >
      <SelectTrigger className="h-8 w-full truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30">
        <SelectValue>{displayLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function EditableCheckboxCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
}: CellContext<TData, TValue>) {
  const initialValue = getValue() as boolean
  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)

  const onToggle = async (checked: boolean) => {
    if (checked === initialValue) return
    try {
      await meta?.onUpdate?.(row.id, column.id, checked)
    } catch (error) {
      console.error('Failed to update cell:', error)
    }
  }

  if (!editable) {
    return (
      <div className="flex items-center justify-center">
        <Checkbox checked={initialValue} disabled />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center">
      <Checkbox
        checked={initialValue}
        onCheckedChange={onToggle}
      />
    </div>
  )
}

export function EditableDateCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
}: CellContext<TData, TValue>) {
  const initialValue = getValue() as Date | null
  const [date, setDate] = React.useState<Date | undefined>(initialValue || undefined)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    setDate(initialValue || undefined)
  }, [initialValue])

  const onSave = async (newDate?: Date) => {
    if (newDate?.getTime() === initialValue?.getTime()) {
      setIsPopoverOpen(false)
      return
    }
    try {
      await meta?.onUpdate?.(row.id, column.id, newDate || null)
      setDate(newDate)
      setIsPopoverOpen(false)
    } catch (error) {
      console.error('Failed to update cell:', error)
      setDate(initialValue || undefined)
      setIsPopoverOpen(false)
    }
  }

  const formattedDate = date ? format(date, 'PPP') : 'Not set'

  if (!editable) {
    return <div>{formattedDate}</div>
  }

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start text-left font-normal hover:bg-muted/30",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {formattedDate}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(newDate) => {
            onSave(newDate)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export function EditableNumberCell<TData, TValue>({
  getValue,
  row,
  column,
  table,
}: CellContext<TData, TValue>) {
  const initialValue = getValue() as number
  const [value, setValue] = React.useState(initialValue)
  const [isEditing, setIsEditing] = React.useState(false)
  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)

  React.useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  const onSave = async () => {
    if (value === initialValue) {
      setIsEditing(false)
      return
    }
    try {
      await meta?.onUpdate?.(row.id, column.id, value)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update cell:', error)
      setValue(initialValue)
      setIsEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setValue(initialValue)
      setIsEditing(false)
    }
  }

  if (!editable) {
    return <div>{String(value ?? '')}</div>
  }

  if (isEditing) {
    return (
      <Input
        type="number"
        value={String(value ?? '')}
        onChange={(e) => setValue(Number(e.target.value) as any)}
        onBlur={onSave}
        onKeyDown={handleKeyDown}
        className="m-0 h-8 w-full"
        autoFocus
      />
    )
  }

  return (
    <div
      className={cn(
        "truncate py-2",
        editable && "cursor-pointer hover:bg-muted/30 rounded px-2"
      )}
      onClick={() => setIsEditing(true)}
    >
      {String(value ?? '')}
    </div>
  )
}

export function RelationshipCell<TData, TEntity>({
  getValue,
  row, // Keep row for potential future use or consistency
  column, // Keep column for potential future use or consistency
  table,
  relationshipConfig,
}: CellContext<TData, string> & {
  relationshipConfig: RelationshipConfig<TEntity>
}) {
  const meta = table.options.meta
  const tableIsReady = meta?.tableReady === true;

  const entityId = getValue() as string | undefined
  const [localEntityId, setLocalEntityId] = React.useState<string | undefined>(entityId)
  const [entity, setEntity] = React.useState<TEntity | null>(null)
  const [isLoadingEntity, setIsLoadingEntity] = React.useState(false)
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (entityId !== localEntityId) {
      setLocalEntityId(entityId);
      setEntity(null); 
    }
  }, [entityId, localEntityId]);

  React.useEffect(() => {
    if (!localEntityId) {
      setEntity(null);
      setIsLoadingEntity(false);
      setError(null);
      return;
    }

    const loadEntity = async () => {
      setIsLoadingEntity(true)
      setError(null)
      try {
        const result = await relationshipConfig.fetchOne(localEntityId)
        setEntity(result)
      } catch (err) {
        console.error('Error fetching entity:', err)
        setError(err instanceof Error ? err : new Error(String(err)))
      } finally {
        setIsLoadingEntity(false)
      }
    }
    loadEntity()
  }, [localEntityId, relationshipConfig.fetchOne])

  const displayValue = React.useMemo(() => {
    if (entity) {
      return relationshipConfig.getDisplayValue(entity)
    }
    if (localEntityId) {
      return `${relationshipConfig.emptyLabel || ''} (${localEntityId})`
    }
    return relationshipConfig.emptyLabel || '-'
  }, [entity, localEntityId, relationshipConfig])

  if (isLoadingEntity && !tableIsReady) {
    return <div className="text-muted-foreground text-xs">Loading...</div>
  }
  if (error) {
    return <div className="text-destructive text-xs">Error</div>
  }
  return <div>{displayValue}</div>
}

export function EditableRelationshipCell<TData, TEntity>({
  getValue,
  row,
  column,
  table,
  relationshipConfig,
}: CellContext<TData, string> & {
  relationshipConfig: RelationshipConfig<TEntity> & { fetchAll: () => Promise<TEntity[]> }
}) {
  if (!relationshipConfig) {
    console.error(
      `EditableRelationshipCell for column "${column.id}" (row ID: ${row.id}) was rendered without a relationshipConfig prop. This is a configuration issue.`,
      { rowData: row.original, columnDef: column.columnDef }
    );
    return <div className="text-destructive text-xs p-1">Cell Config Error</div>;
  }

  const meta = table.options.meta
  const editable = meta?.editableColumns?.includes(column.id)
  const initialEntityId = getValue() as string | null
  const [localEntityId, setLocalEntityId] = React.useState<string | undefined>(initialEntityId || undefined)
  const [currentEntity, setCurrentEntity] = React.useState<TEntity | null>(null)
  const [saveInProgress, setSaveInProgress] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  const cacheKey = `${RELATIONSHIP_CACHE_KEYPREFIX}${column.id}`;
  const getEntityId = relationshipConfig.getEntityId || ((entity: any) => entity.id)
  const [entities, isLoading, cacheError, refreshCache] = useCachedEntities<TEntity>(
    cacheKey,
    relationshipConfig.fetchAll
  )

  const filteredEntities = React.useMemo(() => {
    return relationshipConfig.filterEntities
      ? relationshipConfig.filterEntities(entities)
      : entities
  }, [entities, relationshipConfig.filterEntities])

  const tableIsReady = meta?.tableReady === true;

  React.useEffect(() => {
    if (initialEntityId !== localEntityId && !saveInProgress) {
      setLocalEntityId(initialEntityId || undefined)
    }
  }, [initialEntityId, localEntityId, saveInProgress]);

  React.useEffect(() => {
    if (!localEntityId) {
      setCurrentEntity(null)
      return
    }
    const entityFromList = filteredEntities.find(e =>
      getEntityId(e) === localEntityId
    )
    if (entityFromList) {
      setCurrentEntity(entityFromList)
      return
    }
    const loadEntityById = async () => {
      try {
        const entity = await relationshipConfig.fetchOne(localEntityId)
        if (entity) {
          setCurrentEntity(entity)
        }
      } catch (error) {
        console.error('Failed to load entity by ID:', error)
      }
    }
    loadEntityById()
  }, [localEntityId, filteredEntities, relationshipConfig.fetchOne, getEntityId])

  React.useEffect(() => {
    if (dropdownOpen) {
      refreshCache();
    }
  }, [dropdownOpen, refreshCache]);

  const onSave = async (newEntityId: string) => {
    if (newEntityId === localEntityId) return
    if (!meta?.onUpdate) {
      console.error(`Missing onUpdate handler in table meta!`)
      return
    }
    try {
      setSaveInProgress(true)
      const finalValue = newEntityId === 'none' ? null : newEntityId
      await meta.onUpdate(row.id, column.id, finalValue)
      setLocalEntityId(finalValue || undefined)
      if (newEntityId !== 'none') {
        const newEntity = filteredEntities.find(e => getEntityId(e) === newEntityId) || null
        setCurrentEntity(newEntity)
      } else {
        setCurrentEntity(null)
      }
    } catch (error) {
      console.error(`Failed to update ${column.id}:`, error)
      alert(`Failed to update: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaveInProgress(false)
    }
  }

  const displayName = currentEntity
    ? relationshipConfig.getDisplayValue(currentEntity)
    : (localEntityId ? `${relationshipConfig.emptyLabel || ''} (${localEntityId})` : (relationshipConfig.emptyLabel || '-'))

  if (localEntityId && isLoading && !tableIsReady && !dropdownOpen) {
    return <div className="text-muted-foreground text-xs">Loading...</div>
  }
  if (saveInProgress) {
    return <div className="text-muted-foreground text-xs">Saving...</div>
  }
  if (!editable) {
    return <div>{displayName}</div>
  }

  return (
    <Select
      value={localEntityId || 'none'}
      onValueChange={onSave}
      disabled={saveInProgress}
      onOpenChange={setDropdownOpen}
    >
      <SelectTrigger className="h-8 w-full truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30">
        <SelectValue>{displayName}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {isLoading && (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading options...
          </div>
        )}
        {!isLoading && (
          <>
            <SelectItem value="none">{relationshipConfig.emptyLabel || 'None'}</SelectItem>
            {filteredEntities.map((entity) => (
              <SelectItem key={getEntityId(entity)} value={getEntityId(entity)}>
                {relationshipConfig.getDisplayValue(entity)}
              </SelectItem>
            ))}
            {filteredEntities.length === 0 && !cacheError && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                No options available
              </div>
            )}
            {cacheError && (
              <div className="px-2 py-4 text-center text-sm text-destructive">
                Error loading options
              </div>
            )}
          </>
        )}
      </SelectContent>
    </Select>
  )
}

// --- SmartCellRenderer (uses module-scoped pluginRegistry) ---
export function SmartCellRenderer<TData, TValue>({
  context,
  fallback,
  entityType,
}: {
  context: CellContext<TData, TValue>
  fallback?: React.ReactNode
  entityType?: string
}) {
  const plugin = pluginRegistry.findCellPluginForContext(context, entityType)
  if (plugin) {
    return <>{plugin.render(context)}</>
  }
  const value = context.getValue()
  return <>{fallback || (value != null ? String(value) : '')}</>
}

// --- generateColumnsFromTypeORM (uses module-scoped pluginRegistry and cell renderers) ---
export function generateColumnsFromTypeORM<T>(
  entityMetadata: TypeORMEntityMetadata | EntityMetadata, // Allow original TypeORM EntityMetadata as well
  options: TypeORMColumnOptions = {}
): ColumnDef<T, any>[] {
  const {
    excludeColumns = [],
    editableColumns = [],
    visibleColumns = 'all',
    columnOverrides = {},
    enumMappings = {},
    relationshipConfigs = {},
    enableEntityPlugins = true, // Default to true as per original
    entityName // This will be the entityMetadata.name if not overridden
  } = options

  const currentEntityName = entityName || entityMetadata.name;

  const columns = (entityMetadata.columns as TypeORMColumnMetadata[]) // Cast to local interface
    .filter(column => !excludeColumns.includes(column.propertyName))
    .map(column => {
      const columnDef: ColumnDef<T, any> = {
        accessorKey: column.propertyName,
        header: formatHeader(column.propertyName),
        enableHiding: true,
        enableSorting: true,
      }

      if (visibleColumns !== 'all' && !visibleColumns.includes(column.propertyName)) {
        columnDef.enableHiding = false // This seems to be the opposite of what it should be. If not in visibleColumns, it should be hidden by default.
                                      // Original logic: columnDef.enableHiding = false. Let's keep it for now.
                                      // TanStack Table v8: `enableHiding: false` means the column *cannot* be hidden by the user.
                                      // If `visibleColumns` is a whitelist, then columns NOT in it should probably have `initialIsVisible: false` or similar.
                                      // For now, sticking to original `enableHiding` logic.
      }
      
      const isEditable = editableColumns.includes(column.propertyName)

      if (isEditable) {
        if (column.relationMetadata && relationshipConfigs[column.propertyName]) {
          const relationConfig = relationshipConfigs[column.propertyName]
          columnDef.cell = (props) => (
            <EditableRelationshipCell<T, any>
              {...props}
              relationshipConfig={{
                fetchOne: (id) => relationConfig.service.findOne(id) as Promise<any>,
                fetchAll: () => relationConfig.service.find() as Promise<any[]>,
                getDisplayValue: (entity) => entity[relationConfig.displayField],
                emptyLabel: relationConfig.emptyLabel || `No ${formatHeader(column.propertyName)}`,
                filterEntities: relationConfig.filterEntities
              }}
            />
          )
        } else if (column.type === 'boolean' || column.propertyType === 'boolean') {
          columnDef.cell = (props) => <EditableCheckboxCell {...props} />
        } else if (column.type === 'date' || column.propertyType === 'date' || column.type === 'datetime' || column.propertyType === 'datetime' ) {
          columnDef.cell = (props) => <EditableDateCell {...props} />
        } else if (column.type === 'number' || column.propertyType === 'number' || column.type === 'int' || column.propertyType === 'int' || column.type === 'float' || column.propertyType === 'float') {
          columnDef.cell = (props) => <EditableNumberCell {...props} />
        } else if (enumMappings[column.propertyName]) {
          columnDef.cell = (props) => (
            <EditableSelectCell {...props} options={enumMappings[column.propertyName]} />
          )
        } else {
          columnDef.cell = (props) => <EditableTextCell {...props} />
        }
      } else {
        // Non-editable columns
        if (column.relationMetadata && relationshipConfigs[column.propertyName]) {
           const relationConfig = relationshipConfigs[column.propertyName]
          columnDef.cell = (props) => (
            <RelationshipCell<T, any>
              {...props}
              relationshipConfig={{
                fetchOne: (id) => relationConfig.service.findOne(id) as Promise<any>,
                getDisplayValue: (entity) => entity[relationConfig.displayField],
                emptyLabel: relationConfig.emptyLabel || `No ${formatHeader(column.propertyName)}`
              }}
            />
          )
        } else {
           // Default non-editable cell (can use SmartCellRenderer or just display value)
           columnDef.cell = (props) => <SmartCellRenderer context={props} entityType={currentEntityName} fallback={String(props.getValue() ?? '')} />
        }
      }

      if (columnOverrides[column.propertyName]) {
        Object.assign(columnDef, columnOverrides[column.propertyName])
      }
      return columnDef
    })

  // Add relation columns that aren't directly in the columns array (from original TypeORM file)
  if (entityMetadata.relations) {
    (entityMetadata.relations as Array<{ propertyName: string; isManyToOne?: boolean; isOneToOne?: boolean }>)
      .filter(relation =>
        !columns.some(col => col.accessorKey === relation.propertyName) &&
        !excludeColumns.includes(relation.propertyName)
      )
      .forEach(relation => {
        if ((relation.isManyToOne || relation.isOneToOne) && relationshipConfigs[relation.propertyName]) {
          const columnDef: ColumnDef<T, any> = {
            accessorKey: relation.propertyName,
            header: formatHeader(relation.propertyName),
            enableHiding: true,
            enableSorting: true,
          };
          const isEditable = editableColumns.includes(relation.propertyName);
          const relationConfig = relationshipConfigs[relation.propertyName];

          if (isEditable) {
            columnDef.cell = (props) => (
              <EditableRelationshipCell<T, any>
                {...props}
                relationshipConfig={{
                  fetchOne: (id) => relationConfig.service.findOne(id) as Promise<any>,
                  fetchAll: () => relationConfig.service.find() as Promise<any[]>,
                  getDisplayValue: (entity) => entity[relationConfig.displayField],
                  emptyLabel: relationConfig.emptyLabel || `No ${formatHeader(relation.propertyName)}`,
                  filterEntities: relationConfig.filterEntities
                }}
              />
            );
          } else {
            columnDef.cell = (props) => (
              <RelationshipCell<T, any>
                {...props}
                relationshipConfig={{
                  fetchOne: (id) => relationConfig.service.findOne(id) as Promise<any>,
                  // fetchAll is not needed for non-editable RelationshipCell
                  getDisplayValue: (entity) => entity[relationConfig.displayField],
                  emptyLabel: relationConfig.emptyLabel || `No ${formatHeader(relation.propertyName)}`,
                  // filterEntities is not typically used for non-editable display
                }}
              />
            );
          }
           if (columnOverrides[relation.propertyName]) {
            Object.assign(columnDef, columnOverrides[relation.propertyName]);
          }
          columns.push(columnDef);
        }
      });
  }


  if (enableEntityPlugins && currentEntityName) {
    const plugins = pluginRegistry.getAllColumnPlugins()
      .filter(plugin => {
        const metadata = (plugin as any).entityTypes
        if (!metadata) return false // Or true if plugins without entityTypes should apply globally
        return metadata.includes(currentEntityName)
      })

    plugins.forEach(plugin => {
      columns.forEach((col, index) => {
        // Ensure col.accessorKey is a string before passing to enhanceColumn
        if (typeof col.accessorKey === 'string') {
          columns[index] = plugin.enhanceColumn(
            col.accessorKey,
            col,
            { entityMetadata, options } // Pass full entityMetadata and options
          )
        }
      })
    })
  }
  return columns
}

// --- Cell Factory Functions ---
export function createEntityCell<TEntity>(entityConfig: EntityConfig<TEntity>) {
  return function EntityCell<TData>({ ...props }: CellContext<TData, string>) {
    const { services } = usePGliteContext()
    const service = services?.[entityConfig.serviceName]
    if (!service || typeof service.get !== 'function') { // Added check for service.get
      return <div>{entityConfig.serviceName} service or get method not available</div>
    }
    return (
      <RelationshipCell<TData, TEntity>
        {...props}
        relationshipConfig={{
          fetchOne: (id) => service.get(id),
          getDisplayValue: entityConfig.getDisplayValue,
          emptyLabel: entityConfig.emptyLabel,
          getEntityId: entityConfig.getEntityId,
          filterEntities: entityConfig.filterEntities
        }}
      />
    )
  }
}

export function createEditableEntityCell<TEntity>(entityConfig: EntityConfig<TEntity>) {
  return function EditableEntityCell<TData>({ ...props }: CellContext<TData, string>) {
    const { services } = usePGliteContext()
    const service = services?.[entityConfig.serviceName]
    if (!service || typeof service.get !== 'function' || typeof service.getAll !== 'function') { // Added checks
      return <div>{entityConfig.serviceName} service or methods not available</div>
    }
    const fetchAll = React.useCallback(() => {
      return service.getAll();
    }, [service]);
    return (
      <EditableRelationshipCell<TData, TEntity>
        {...props}
        relationshipConfig={{
          fetchOne: (id) => service.get(id),
          fetchAll: fetchAll,
          getDisplayValue: entityConfig.getDisplayValue,
          emptyLabel: entityConfig.emptyLabel,
          getEntityId: entityConfig.getEntityId,
          filterEntities: entityConfig.filterEntities
        }}
      />
    )
  }
}