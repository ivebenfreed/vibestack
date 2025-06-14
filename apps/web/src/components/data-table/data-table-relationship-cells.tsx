import React from 'react'
import { CellContext } from '@tanstack/react-table'
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
import { useCachedEntities, RelationshipConfig, RELATIONSHIP_CACHE_KEYPREFIX } from './data-table-logic'

// Extended context for create mode (same as in data-table-editing.tsx)
interface ExtendedCellContext<TData, TValue> extends CellContext<TData, TValue> {
  createMode?: boolean
  createValue?: TValue
  onCreateValueChange?: (value: TValue) => void
  required?: boolean
  onEnterSave?: (fieldName: string, currentValue: TValue) => void
  autoFocus?: boolean
}

/**
 * Enhanced single-select relationship cell with text filtering
 * Replaces the original EditableRelationshipCell with Command-based filtering
 */
export function EditableFilterableRelationshipCell<TData, TEntity>({
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
  relationshipConfig: RelationshipConfig<TEntity> & { fetchAll: () => Promise<TEntity[]> }
}) {
  if (!relationshipConfig) {
    console.error(
      `EditableFilterableRelationshipCell for column "${column.id}" (row ID: ${row.id}) was rendered without a relationshipConfig prop.`
    );
    return <div className="text-destructive text-xs p-1">Cell Config Error</div>;
  }

  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)
  const initialEntityId = createMode ? (createValue as string | null) : (getValue() as string | null)
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
    if (createMode) {
      setLocalEntityId((createValue as string) || undefined)
    } else if (initialEntityId !== localEntityId && !saveInProgress) {
      setLocalEntityId(initialEntityId || undefined)
    }
  }, [createMode, createValue, initialEntityId, localEntityId, saveInProgress]);

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
      setDropdownOpen(false)
      return
    }
    
    if (newEntityId === localEntityId) {
      setDropdownOpen(false)
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
      setDropdownOpen(false)
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
    <div className="relative">
      <Popover open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            role="combobox"
            aria-expanded={dropdownOpen}
            className={cn(
              "w-full justify-between truncate border-0 bg-transparent focus:ring-transparent py-0 hover:bg-muted/30 focus:bg-muted/30",
              createMode ? "h-7 text-xs pr-6" : "h-8",
              required && createMode && !localEntityId && "border-orange-200"
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
                <CommandItem
                  value="none"
                  onSelect={() => onSave('none')}
                >
                  <CheckIcon
                    className={cn(
                      "mr-2 h-4 w-4",
                      !localEntityId ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {relationshipConfig.emptyLabel || 'None'}
                </CommandItem>
                {filteredEntities.map((entity) => {
                  const entityId = getEntityId(entity)
                  const displayValue = relationshipConfig.getDisplayValue(entity)
                  const isSelected = localEntityId === entityId
                  return (
                    <CommandItem
                      key={entityId}
                      value={`${displayValue}-${entityId}`}
                      onSelect={() => onSave(entityId)}
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
      {required && createMode && (
        <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-orange-500 text-xs font-bold">
          *
        </span>
      )}
    </div>
  )
}

/**
 * Multi-select relationship cell for many-to-many relationships
 * Handles arrays of entity IDs and displays them as badges
 */
export function EditableMultiSelectRelationshipCell<TData, TEntity>({
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
  relationshipConfig: RelationshipConfig<TEntity> & { fetchAll: () => Promise<TEntity[]> }
}) {
  if (!relationshipConfig) {
    console.error(
      `EditableMultiSelectRelationshipCell for column "${column.id}" (row ID: ${row.id}) was rendered without a relationshipConfig prop.`
    );
    return <div className="text-destructive text-xs p-1">Cell Config Error</div>;
  }

  const meta = table.options.meta
  const editable = createMode || meta?.editableColumns?.includes(column.id)
  const initialEntityIds = createMode ? (createValue as string[] | null) : (getValue() as string[] | null)
  const [localEntityIds, setLocalEntityIds] = React.useState<string[]>(initialEntityIds || [])
  const [currentEntities, setCurrentEntities] = React.useState<TEntity[]>([])
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
    if (createMode) {
      setLocalEntityIds((createValue as string[]) || [])
    } else if (JSON.stringify(initialEntityIds) !== JSON.stringify(localEntityIds) && !saveInProgress) {
      setLocalEntityIds(initialEntityIds || [])
    }
  }, [createMode, createValue, initialEntityIds, localEntityIds, saveInProgress]);

  React.useEffect(() => {
    if (!localEntityIds || localEntityIds.length === 0) {
      setCurrentEntities([])
      return
    }
    
    const entitiesFromList = localEntityIds
      .map(id => filteredEntities.find(e => getEntityId(e) === id))
      .filter((entity): entity is TEntity => entity !== undefined)
    
    if (entitiesFromList.length === localEntityIds.length) {
      setCurrentEntities(entitiesFromList)
      return
    }
    
    // Load missing entities by ID
    const loadMissingEntities = async () => {
      try {
        const missingIds = localEntityIds.filter(id => 
          !filteredEntities.find(e => getEntityId(e) === id)
        )
        
                 const missingEntities = await Promise.all(
           missingIds.map(id => relationshipConfig.fetchOne(id))
         )
         
         const validMissingEntities = missingEntities.filter(entity => entity !== null) as TEntity[]
         
         const allEntities = [
           ...entitiesFromList,
           ...validMissingEntities
         ]
         
         setCurrentEntities(allEntities)
      } catch (error) {
        console.error('Failed to load entities by ID:', error)
        setCurrentEntities(entitiesFromList)
      }
    }
    
    loadMissingEntities()
  }, [localEntityIds, filteredEntities, relationshipConfig.fetchOne, getEntityId])

  React.useEffect(() => {
    if (dropdownOpen) {
      refreshCache();
    }
  }, [dropdownOpen, refreshCache]);

  const onToggleEntity = async (entityId: string) => {
    const newEntityIds = localEntityIds.includes(entityId)
      ? localEntityIds.filter(id => id !== entityId)
      : [...localEntityIds, entityId]
    
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
      alert(`Failed to update: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaveInProgress(false)
    }
  }

  const onRemoveEntity = async (entityId: string) => {
    await onToggleEntity(entityId)
  }

  if (isLoading && !tableIsReady && !dropdownOpen) {
    return <div className="text-muted-foreground text-xs">Loading...</div>
  }
  if (saveInProgress) {
    return <div className="text-muted-foreground text-xs">Saving...</div>
  }
  if (!editable) {
    return (
      <div className="flex flex-wrap gap-1">
        {currentEntities.length > 0 ? (
          currentEntities.map((entity) => (
            <Badge key={getEntityId(entity)} variant="secondary" className="text-xs">
              {relationshipConfig.getDisplayValue(entity)}
            </Badge>
          ))
        ) : (
          <span className="text-muted-foreground text-xs">
            {relationshipConfig.emptyLabel || 'None'}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-[32px] items-center">
        {currentEntities.map((entity) => (
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
              className={cn(
                "h-6 px-2 text-xs border-dashed border hover:bg-muted/30",
                createMode && required && localEntityIds.length === 0 && "border-orange-200"
              )}
              disabled={saveInProgress}
            >
              + Add
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
                  {filteredEntities.map((entity) => {
                    const entityId = getEntityId(entity)
                    const displayValue = relationshipConfig.getDisplayValue(entity)
                    const isSelected = localEntityIds.includes(entityId)
                    return (
                      <CommandItem
                        key={entityId}
                        value={`${displayValue}-${entityId}`}
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
} 