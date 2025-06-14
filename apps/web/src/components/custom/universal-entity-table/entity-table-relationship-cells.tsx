import React from 'react'
import { CellContext } from '@tanstack/react-table'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { CheckIcon, ChevronDownIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
// Removed PreloadedRelationshipData import - no longer needed in Universal Reactive Data Pattern
import { ObjectLiteral } from 'typeorm'

// Extended context for create mode (same as in data-table-editing.tsx)
interface ExtendedCellContext<TData, TValue> extends CellContext<TData, TValue> {
  createMode?: boolean
  createValue?: TValue
  onCreateValueChange?: (value: TValue) => void
  required?: boolean
  onEnterSave?: (fieldName: string, currentValue: TValue) => void
  autoFocus?: boolean
}

// ✅ Universal Reactive Data Pattern: Minimal table meta - no relationship data prop drilling
interface ExtendedTableMeta<TData> {
  editableColumns?: string[]
  onUpdate?: (id: string, columnId: string, value: any) => Promise<void>
  tableReady?: boolean
}

export interface RelationshipConfig<TEntity extends ObjectLiteral> {
  // ✅ Direct cache key from actual service (no string mapping!)
  cacheKey: string[]
  
  // Entity handling
  getEntityId: (entity: TEntity) => string
  getDisplayValue: (entity: TEntity) => string
  emptyLabel?: string
  searchFields?: (keyof TEntity)[]
  filterEntities?: (entities: TEntity[]) => TEntity[]
}

/**
 * Pure data access function using Universal Reactive Data Pattern
 * Uses direct cache key from service - no hardcoding or string mapping!
 * ✅ PERFORMANCE FIX: Properly memoized cache access to prevent excessive re-renders
 */
function useRelationshipEntitiesFromCache<TEntity extends ObjectLiteral>(
  cacheKey: string[],
  queryClient: ReturnType<typeof useQueryClient>
): TEntity[] {
  // ✅ PERFORMANCE FIX: Single memoized cache lookup with stable dependencies
  // Prevents double rendering and excessive useEffect triggers
  return React.useMemo(() => {
    const cachedData = queryClient.getQueryData(cacheKey)
    
    if (!cachedData) {
      return []
    }
    
    return (cachedData || []) as TEntity[]
  }, [cacheKey.join(':')]) // ✅ Use stable string dependency instead of array
}

/**
 * Enhanced single-select relationship cell with text filtering
 * Pure presentational component - no data fetching, only displays preloaded data
 * ✅ PERFORMANCE OPTIMIZED: Conditional rendering - complex UI only when editing
 */
export const EditableFilterableRelationshipCell = React.memo(function EditableFilterableRelationshipCell<TData, TEntity extends ObjectLiteral>({
  getValue,
  row,
  column,
  table,
  relationshipConfig,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
}: ExtendedCellContext<TData, string> & {
  relationshipConfig: RelationshipConfig<TEntity>
}) {
  if (!relationshipConfig) {
    console.error(
      `EditableFilterableRelationshipCell for column "${column.id}" was rendered without a relationshipConfig prop.`
    )
    return <div className="text-destructive text-xs p-1">Cell Config Error</div>
  }

  const meta = table.options.meta as ExtendedTableMeta<TData>
  const queryClient = useQueryClient()
  const editable = createMode || meta?.editableColumns?.includes(column.id)
  const initialEntityId = createMode ? (createValue as string | null) : (getValue() as string | null)
  const [localEntityId, setLocalEntityId] = React.useState<string | undefined>(initialEntityId || undefined)
  const [currentEntity, setCurrentEntity] = React.useState<TEntity | null>(null)
  const [saveInProgress, setSaveInProgress] = React.useState(false)
  const [isEditing, setIsEditing] = React.useState(false)
  
  const getEntityId = relationshipConfig.getEntityId
  
  // ✅ Direct cache access via Universal Reactive Data Pattern - no hardcoding!
  const entities = useRelationshipEntitiesFromCache<TEntity>(
    relationshipConfig.cacheKey,
    queryClient
  )

  const filteredEntities = React.useMemo(() => {
    return relationshipConfig.filterEntities
      ? relationshipConfig.filterEntities(entities)
      : entities
  }, [entities, relationshipConfig.filterEntities])

  React.useEffect(() => {
    if (createMode) {
      setLocalEntityId((createValue as string) || undefined)
    } else if (initialEntityId !== localEntityId && !saveInProgress) {
      setLocalEntityId(initialEntityId || undefined)
    }
  }, [createMode, createValue, initialEntityId, localEntityId, saveInProgress])

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
    
    // If entity not found in preloaded data, show ID as fallback
    setCurrentEntity(null)
  }, [localEntityId, filteredEntities, getEntityId])

  const onSave = async (newEntityId: string) => {
    if (createMode) {
      const finalValue = newEntityId === 'none' ? null : newEntityId
      onCreateValueChange?.(finalValue as any)
      setLocalEntityId(finalValue || undefined)
      
      if (newEntityId !== 'none') {
        const newEntity = filteredEntities.find(e => getEntityId(e) === newEntityId) || null
        setCurrentEntity(newEntity)
      } else {
        setCurrentEntity(null)
      }
      setIsEditing(false)
      return
    }
    
    if (newEntityId === localEntityId) {
      setIsEditing(false)
      return
    }
    
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
      setIsEditing(false)
    } catch (error) {
      console.error(`Failed to update ${column.id}:`, error)
    } finally {
      setSaveInProgress(false)
    }
  }

  const displayName = currentEntity
    ? relationshipConfig.getDisplayValue(currentEntity)
    : (localEntityId ? `${relationshipConfig.emptyLabel || ''} (${localEntityId})` : (relationshipConfig.emptyLabel || '-'))

  if (saveInProgress) {
    return <div className="text-muted-foreground text-xs">Saving...</div>
  }
  
  if (!editable) {
    return <div className="truncate">{displayName}</div>
  }

  // ✅ PERFORMANCE BREAKTHROUGH: Conditional rendering
  // Show simple button 99% of time, complex Popover/Command only when editing
  if (!isEditing) {
    return (
      <Button
        variant="ghost"
        onClick={() => setIsEditing(true)}
        className={cn(
          "w-full justify-start truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30",
          createMode ? "h-7 text-xs" : "h-8",
          required && createMode && !localEntityId && "border border-orange-200"
        )}
        disabled={saveInProgress}
      >
        <span className="truncate">{displayName}</span>
      </Button>
    )
  }

  // Complex editing UI only rendered when actually editing
  return (
    <div className="relative">
      <Popover open={true} onOpenChange={(open) => !open && setIsEditing(false)}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={true}
            className={cn(
              "w-full justify-between truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30",
              createMode ? "h-7 text-xs pr-6" : "h-8",
              required && createMode && !localEntityId && "border border-orange-200"
            )}
            disabled={saveInProgress}
          >
            <span className="truncate">{displayName}</span>
            <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0" align="start">
          <Command>
            <CommandInput 
              placeholder={`Search ${column.id}...`} 
              className="h-9"
            />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {/* Clear selection option */}
                <CommandItem
                  value="none"
                  onSelect={() => onSave('none')}
                  className="text-muted-foreground"
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      !localEntityId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {relationshipConfig.emptyLabel || 'None'}
                </CommandItem>
                
                {/* Entity options */}
                {filteredEntities.map((entity: TEntity) => {
                  const entityId = getEntityId(entity)
                  const displayValue = relationshipConfig.getDisplayValue(entity)
                  return (
                    <CommandItem
                      key={entityId}
                      value={displayValue}
                      onSelect={() => onSave(entityId)}
                    >
                      <CheckIcon
                        className={cn(
                          "mr-2 h-4 w-4",
                          localEntityId === entityId ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {displayValue}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      {required && createMode && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
    </div>
  )
})

/**
 * Multi-select relationship cell for many-to-many relationships
 * Pure presentational component - no data fetching, only displays preloaded data
 * ✅ PERFORMANCE: Wrapped with React.memo to prevent unnecessary re-renders
 */
export const EditableMultiSelectRelationshipCell = React.memo(function EditableMultiSelectRelationshipCell<TData, TEntity extends ObjectLiteral>({
  getValue,
  row,
  column,
  table,
  relationshipConfig,
  createMode = false,
  createValue,
  onCreateValueChange,
  required = false,
}: ExtendedCellContext<TData, string[]> & {
  relationshipConfig: RelationshipConfig<TEntity>
}) {
  if (!relationshipConfig) {
    console.error(
      `EditableMultiSelectRelationshipCell for column "${column.id}" was rendered without a relationshipConfig prop.`
    )
    return <div className="text-destructive text-xs p-1">Cell Config Error</div>
  }

  const meta = table.options.meta as ExtendedTableMeta<TData>
  const queryClient = useQueryClient()
  const editable = createMode || meta?.editableColumns?.includes(column.id)
  const initialEntityIds = createMode ? (createValue as string[] | null) : (getValue() as string[] | null)
  const [localEntityIds, setLocalEntityIds] = React.useState<string[]>(initialEntityIds || [])
  const [currentEntities, setCurrentEntities] = React.useState<TEntity[]>([])
  const [saveInProgress, setSaveInProgress] = React.useState(false)
  const [dropdownOpen, setDropdownOpen] = React.useState(false)
  
  const getEntityId = relationshipConfig.getEntityId
  
  // ✅ Direct cache access via Universal Reactive Data Pattern - no hardcoding!
  const entities = useRelationshipEntitiesFromCache<TEntity>(
    relationshipConfig.cacheKey,
    queryClient
  )

  const filteredEntities = React.useMemo(() => {
    return relationshipConfig.filterEntities
      ? relationshipConfig.filterEntities(entities)
      : entities
  }, [entities, relationshipConfig.filterEntities])

  React.useEffect(() => {
    if (createMode) {
      setLocalEntityIds((createValue as string[]) || [])
    } else if (initialEntityIds !== localEntityIds && !saveInProgress) {
      setLocalEntityIds(initialEntityIds || [])
    }
  }, [createMode, createValue, initialEntityIds, localEntityIds, saveInProgress])

  // ✅ Memoize the cache key string for stable references 
  const stableMultiCacheKeyString = React.useMemo(() => relationshipConfig.cacheKey.join(':'), [relationshipConfig.cacheKey])

  React.useEffect(() => {
    const entitiesFromList = filteredEntities.filter((e: TEntity) => 
      localEntityIds.includes(getEntityId(e))
    )
    setCurrentEntities(entitiesFromList)
    
    // Warn about missing entities
    const missingIds = localEntityIds.filter(id => 
      !entitiesFromList.find((e: TEntity) => getEntityId(e) === id)
    )
    if (missingIds.length > 0) {
      console.warn(`[RelationshipCell:${stableMultiCacheKeyString}] Entities not found in cached data:`, missingIds)
    }
  }, [localEntityIds, filteredEntities, stableMultiCacheKeyString, getEntityId])

  const onToggleEntity = async (entityId: string) => {
    let newEntityIds: string[]
    
    if (localEntityIds.includes(entityId)) {
      newEntityIds = localEntityIds.filter(id => id !== entityId)
    } else {
      newEntityIds = [...localEntityIds, entityId]
    }
    
    if (createMode) {
      onCreateValueChange?.(newEntityIds as any)
      setLocalEntityIds(newEntityIds)
      return
    }
    
    if (!meta?.onUpdate) {
      console.error(`Missing onUpdate handler in table meta!`)
      return
    }
    
    try {
      setSaveInProgress(true)
      await meta.onUpdate(row.id, column.id, newEntityIds)
      setLocalEntityIds(newEntityIds)
    } catch (error) {
      console.error(`Failed to update ${column.id}:`, error)
    } finally {
      setSaveInProgress(false)
    }
  }

  const onRemoveEntity = async (entityId: string) => {
    const newEntityIds = localEntityIds.filter(id => id !== entityId)
    
    if (createMode) {
      onCreateValueChange?.(newEntityIds as any)
      setLocalEntityIds(newEntityIds)
      return
    }
    
    if (!meta?.onUpdate) {
      console.error(`Missing onUpdate handler in table meta!`)
      return
    }
    
    try {
      setSaveInProgress(true)
      await meta.onUpdate(row.id, column.id, newEntityIds)
      setLocalEntityIds(newEntityIds)
    } catch (error) {
      console.error(`Failed to update ${column.id}:`, error)
    } finally {
      setSaveInProgress(false)
    }
  }

  if (saveInProgress) {
    return <div className="text-muted-foreground text-xs">Saving...</div>
  }
  
  if (!editable) {
    return (
      <div className="flex flex-wrap gap-1">
        {currentEntities.map(entity => (
          <Badge key={getEntityId(entity)} variant="secondary" className="text-xs">
            {relationshipConfig.getDisplayValue(entity)}
          </Badge>
        ))}
        {currentEntities.length === 0 && (
          <span className="text-muted-foreground">{relationshipConfig.emptyLabel || '-'}</span>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[32px] items-center">
        {currentEntities.map(entity => (
          <Badge 
            key={getEntityId(entity)} 
            variant="secondary" 
            className="text-xs flex items-center gap-1"
          >
            {relationshipConfig.getDisplayValue(entity)}
            <XIcon 
              className="h-3 w-3 cursor-pointer hover:text-destructive" 
              onClick={() => onRemoveEntity(getEntityId(entity))}
            />
          </Badge>
        ))}
        
        <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
            >
              <ChevronDownIcon className="h-3 w-3" />
              Add
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder={`Search ${column.id}...`} 
                className="h-9"
              />
              <CommandList>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup>
                  {filteredEntities.map((entity: TEntity) => {
                    const entityId = getEntityId(entity)
                    const displayValue = relationshipConfig.getDisplayValue(entity)
                    const isSelected = localEntityIds.includes(entityId)
                    
                    return (
                      <CommandItem
                        key={entityId}
                        value={displayValue}
                        onSelect={() => onToggleEntity(entityId)}
                      >
                        <CheckIcon
                          className={cn(
                            "mr-2 h-4 w-4",
                            isSelected ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {displayValue}
                      </CommandItem>
                    )
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      
      {required && createMode && localEntityIds.length === 0 && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
    </div>
  )
}) 