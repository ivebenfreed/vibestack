import * as React from 'react'
import { ColumnDef, CellContext } from '@tanstack/react-table'
import { EntityMetadata } from 'typeorm' // Used by generateColumnsFromTypeORM
import { cn } from '@/lib/utils'
import { usePGliteContext } from '@/db/pglite-provider' // Used by createEntityCell factories
import { Checkbox } from '@/components/ui/checkbox'

// Import editable components from the new editing file
import {
  EditableTextCell,
  EditableSelectCell,
  EditableCheckboxCell,
  EditableDateCell,
  EditableNumberCell,
  EditableRelationshipCell,
} from './data-table-editing'

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
  hasDefault?: boolean
  defaultValue?: any
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
  showIdColumn?: boolean // New option to control ID field visibility, defaults to false
  enableRowSelection?: boolean // Enable row selection column
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
    return this.cellPlugins.get(id)
  }

  getColumnPlugin(id: string) {
    return this.columnPlugins.get(id)
  }

  getAllCellPlugins() {
    return Array.from(this.cellPlugins.values())
  }

  getAllColumnPlugins() {
    return Array.from(this.columnPlugins.values())
  }

  getPluginsForEntity(entityType: string) {
    return this.entityPluginMap.get(entityType) || []
  }

  clearPlugins() {
    this.cellPlugins.clear()
    this.columnPlugins.clear()
    this.entityPluginMap.clear()
  }

  findCellPluginForContext<TData, TValue>(
    context: CellContext<TData, TValue>,
    entityType?: string
  ) {
    if (entityType) {
      const pluginIds = this.getPluginsForEntity(entityType)
      for (const pluginId of pluginIds) {
        const plugin = this.getCellPlugin(pluginId)
        if (plugin && plugin.canHandle(context)) {
          return plugin
        }
      }
    }
    for (const plugin of this.getAllCellPlugins()) {
      if (plugin.canHandle(context)) {
        return plugin
      }
    }
    return null
  }
}

const pluginRegistry = new DataTablePluginRegistry()

export function formatHeader(key: string): string {
  if (key.includes('_')) {
    return key
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
}

export function formatColumnName(name: string): string {
  if (name.includes('_')) {
    return name
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
  }
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
}

// --- Selection Column Utilities ---
export function createSelectionColumn<T>(): ColumnDef<T, any> {
  return {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all rows"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
    minSize: 40,
    maxSize: 40,
  }
}

// --- Bulk Action Utilities ---
export interface BulkActionConfig<T> {
  label: string
  icon?: React.ComponentType<{ className?: string }>
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onClick: (selectedRows: T[], selectedIds: string[]) => void | Promise<void>
}

export interface BulkEditField {
  key: string
  label: string
  type: 'enum' | 'relationship'
  options?: Array<{ label: string; value: any }>
  relationshipConfig?: {
    service: any
    displayField: string
    fetchAll: () => Promise<any[]>
  }
}

export interface BulkActionHandlers<T> {
  onBulkDelete?: (selectedIds: string[]) => Promise<void>
  onEntityDeleted?: (id: string) => void
  customActions?: BulkActionConfig<T>[]
  entityType: string
}

export function createBulkEditHandlers<T extends { id: string }>(
  service: {
    update: (id: string, data: Partial<T>) => Promise<T>
  },
  entityType: string,
  toast: {
    success: (message: string) => void
    error: (message: string) => void
  }
) {
  const handleBulkUpdate = async (selectedIds: string[], updates: Partial<T>) => {
    if (selectedIds.length === 0 || !Object.keys(updates).length) return
    
    try {
      // Apply updates to all selected entities
      await Promise.all(selectedIds.map(id => service.update(id, updates)))
      
      // Show success message
      const updateFields = Object.keys(updates).join(', ')
      toast.success(`Successfully updated ${updateFields} for ${selectedIds.length} ${entityType}${selectedIds.length > 1 ? 's' : ''}`)
      
    } catch (error: any) {
      console.error('Bulk update error:', error)
      toast.error(`Error updating ${entityType}s: ${error.message}`)
      throw error // Re-throw for component to handle loading state
    }
  }

  return {
    handleBulkUpdate
  }
}

export function createBulkActionHandlers<T extends { id: string }>(
  service: {
    delete?: (id: string) => Promise<void>
  },
  handlers: BulkActionHandlers<T>,
  toast: {
    success: (message: string) => void
    error: (message: string) => void
  }
) {
  const handleBulkDelete = async (selectedIds: string[]) => {
    if (selectedIds.length === 0) return
    
    try {
      if (handlers.onBulkDelete) {
        // Use custom bulk delete handler
        await handlers.onBulkDelete(selectedIds)
      } else if (service.delete) {
        // Use individual delete calls
        await Promise.all(selectedIds.map(id => service.delete!(id)))
      } else {
        throw new Error('No delete function available')
      }
      
      // Notify parent for each deleted entity
      selectedIds.forEach(id => handlers.onEntityDeleted?.(id))
      
      // Show success message
      toast.success(`Successfully deleted ${selectedIds.length} ${handlers.entityType}${selectedIds.length > 1 ? 's' : ''}`)
      
    } catch (error: any) {
      console.error('Bulk delete error:', error)
      toast.error(`Error deleting ${handlers.entityType}s: ${error.message}`)
      throw error // Re-throw for component to handle loading state
    }
  }

  const handleCustomBulkAction = async (
    action: BulkActionConfig<T>, 
    selectedData: T[], 
    selectedIds: string[]
  ) => {
    if (selectedIds.length === 0) return
    
    try {
      await action.onClick(selectedData, selectedIds)
    } catch (error: any) {
      console.error(`Bulk action "${action.label}" error:`, error)
      toast.error(`Error performing ${action.label}: ${error.message}`)
      throw error // Re-throw for component to handle loading state
    }
  }

  return {
    handleBulkDelete,
    handleCustomBulkAction
  }
}

// Re-export editable components for backwards compatibility
export {
  EditableTextCell,
  EditableSelectCell,
  EditableCheckboxCell,
  EditableDateCell,
  EditableNumberCell,
  EditableRelationshipCell,
}

// Re-export enhanced relationship components
// Note: EditableFilterableRelationshipCell is re-exported from data-table-editing.tsx as EditableRelationshipCell
export {
  EditableMultiSelectRelationshipCell,
} from './data-table-relationship-cells'

// --- Simple RelationshipCell for non-editable display ---
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

export function generateColumnsFromTypeORM<T>(
  entityMetadata: TypeORMEntityMetadata | EntityMetadata, // Allow original TypeORM EntityMetadata as well
  options: TypeORMColumnOptions = {}
): ColumnDef<T, any>[] {
  const {
    excludeColumns = [],
    editableColumns = [],
    visibleColumns = 'all',
    showIdColumn = false, // Default to false - ID columns hidden by default
    enableRowSelection = false, // Default to false - selection column disabled by default
    columnOverrides = {},
    enumMappings = {},
    relationshipConfigs = {},
    enableEntityPlugins = false,
    entityName: currentEntityName
  } = options

  const columns = (entityMetadata.columns as TypeORMColumnMetadata[]) // Cast to local interface
    .filter(column => !excludeColumns.includes(column.propertyName))
    .map(column => {
      const isIdColumn = column.propertyName === 'id' || column.isPrimary === true
      
      const columnDef: ColumnDef<T, any> = {
        accessorKey: column.propertyName,
        header: formatHeader(column.propertyName),
        enableHiding: isIdColumn ? showIdColumn : true, // ID columns can only be hidden if showIdColumn is true
        enableSorting: true,
      }

      // Handle ID column visibility - hidden by default unless showIdColumn is true
      // Initial visibility will be handled in the component based on column name

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
                  getDisplayValue: (entity) => entity[relationConfig.displayField],
                  emptyLabel: relationConfig.emptyLabel || `No ${formatHeader(relation.propertyName)}`
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

  // Add selection column at the beginning if enabled
  if (enableRowSelection) {
    const selectionColumn = createSelectionColumn<T>()
    return [selectionColumn, ...columns]
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

// --- Entity Metadata Utilities ---

// Utility function to create entity metadata for common entities
export function createEntityMetadata(entityName: string, columnDefinitions: Partial<TypeORMColumnMetadata>[]): TypeORMEntityMetadata {
  const baseColumns: TypeORMColumnMetadata[] = [
    { propertyName: 'id', type: 'uuid', propertyType: 'string', isNullable: false, isGenerated: true },
    { propertyName: 'createdAt', type: 'timestamptz', propertyType: 'Date', isNullable: false, isGenerated: true },
    { propertyName: 'updatedAt', type: 'timestamptz', propertyType: 'Date', isNullable: false, isGenerated: true },
    { propertyName: 'client_id', type: 'uuid', propertyType: 'string', isNullable: true, isGenerated: false },
  ];

  const customColumns = columnDefinitions.map(def => ({
    propertyName: def.propertyName || '',
    propertyType: def.propertyType || def.type || 'string',
    isNullable: def.isNullable ?? true,
    isGenerated: def.isGenerated ?? false,
    hasDefault: def.hasDefault ?? (def.defaultValue !== undefined),
    defaultValue: def.defaultValue,
    type: def.type,
    isEnum: def.isEnum,
    enumName: def.enumName,
    isArray: def.isArray,
    isPrimary: def.isPrimary,
    length: def.length,
    options: def.options,
    relationMetadata: def.relationMetadata,
    ...def
  }));

  return {
    name: entityName,
    columns: [...customColumns, ...baseColumns],
    relations: []
  };
}

// Pre-built metadata for common entities
export const TaskEntityMetadata = createEntityMetadata('Task', [
  { propertyName: 'title', type: 'varchar', propertyType: 'string', isNullable: false, isGenerated: false, length: 100 },
  { propertyName: 'description', type: 'text', propertyType: 'string', isNullable: true, isGenerated: false },
  { propertyName: 'status', type: 'enum', propertyType: 'string', isNullable: false, isGenerated: false, hasDefault: true },
  { propertyName: 'priority', type: 'enum', propertyType: 'string', isNullable: false, isGenerated: false, defaultValue: 'medium' },
  { propertyName: 'dueDate', type: 'timestamptz', propertyType: 'Date', isNullable: true, isGenerated: false },
  { propertyName: 'startDate', type: 'timestamptz', propertyType: 'Date', isNullable: true, isGenerated: false },
  { propertyName: 'completedAt', type: 'timestamptz', propertyType: 'Date', isNullable: true, isGenerated: false },
  { propertyName: 'timeRange', type: 'tsrange', propertyType: 'string', isNullable: true, isGenerated: false },
  { propertyName: 'estimatedDuration', type: 'interval', propertyType: 'string', isNullable: true, isGenerated: false },
  { propertyName: 'tags', type: 'text[]', propertyType: 'string[]', isNullable: true, isGenerated: false, defaultValue: [] },
  { propertyName: 'projectId', type: 'uuid', propertyType: 'string', isNullable: true, isGenerated: false },
  { propertyName: 'assigneeId', type: 'uuid', propertyType: 'string', isNullable: true, isGenerated: false },
]);

export const ProjectEntityMetadata = createEntityMetadata('Project', [
  { propertyName: 'name', type: 'varchar', propertyType: 'string', isNullable: false, isGenerated: false, length: 100 },
  { propertyName: 'description', type: 'text', propertyType: 'string', isNullable: true, isGenerated: false },
  { propertyName: 'status', type: 'enum', propertyType: 'string', isNullable: false, isGenerated: false, defaultValue: 'active' },
  { propertyName: 'ownerId', type: 'uuid', propertyType: 'string', isNullable: true, isGenerated: false },
]);

export const UserEntityMetadata = createEntityMetadata('User', [
  { propertyName: 'name', type: 'varchar', propertyType: 'string', isNullable: false, isGenerated: false, length: 100 },
  { propertyName: 'email', type: 'varchar', propertyType: 'string', isNullable: false, isGenerated: false, length: 255 },
  { propertyName: 'emailVerified', type: 'boolean', propertyType: 'boolean', isNullable: false, isGenerated: false, defaultValue: false },
  { propertyName: 'image', type: 'varchar', propertyType: 'string', isNullable: true, isGenerated: false, length: 255 },
  { propertyName: 'role', type: 'enum', propertyType: 'string', isNullable: false, isGenerated: false, defaultValue: 'member' },
]);