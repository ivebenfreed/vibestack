import React, { useCallback, useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { createAtom } from '@xstate/store'
import { LightweightSelect, type LightweightSelectOption } from '../../performance/LightweightSelect'
import type { BaseEntity } from '../../core/table-types'

// ============================================================================
// Atomic Column Component for Editable Select Fields
// ============================================================================

interface EditableSelectColumnProps<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  rowId: string
  entityAtom: any // XState atom: createAtom<Record<string, T>>({})
  options: LightweightSelectOption[]
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  placeholder?: string
  searchable?: boolean
  noOptionsMessage?: string
  className?: string
  displayRenderer?: (value: any, options: LightweightSelectOption[]) => React.ReactNode
}

// ============================================================================
// Cell-Specific Editing Atom Factory
// ============================================================================

interface CellEditingState {
  isEditing: boolean
  value: any
  error: string | null
  isLoading: boolean
}

const createCellEditingAtom = () => createAtom<CellEditingState>({
  isEditing: false,
  value: '',
  error: null,
  isLoading: false,
})

// ============================================================================
// Atomic Select Column Component
// ============================================================================

export function EditableSelectColumn<T extends BaseEntity>({ 
  accessorKey, 
  header, 
  rowId, 
  entityAtom, 
  options,
  updateAction,
  validate,
  placeholder = "Select option...",
  searchable = true,
  noOptionsMessage = "No options available",
  className,
  displayRenderer
}: EditableSelectColumnProps<T>) {
  
  // ✅ ATOMIC STATE: Each cell gets its own editing atom - zero cross-cell interference
  const editingAtom = useMemo(() => createCellEditingAtom(), [])
  
  // ✅ REACTIVE DATA: Get current value directly from domain atom
  const currentValue = useSelector(entityAtom, (entities: unknown) => {
    const entitiesRecord = entities as Record<string, T>
    const entity = entitiesRecord[rowId]
    return entity?.[accessorKey] || ''
  })
  
  // ✅ ATOMIC EDITING STATE: Only this cell's editing state
  const { isEditing, value, error, isLoading } = useSelector(editingAtom, (state) => state)
  
  // ============================================================================
  // Event Handlers (Atomic Actions)
  // ============================================================================
  
  const startEdit = useCallback(() => {
    editingAtom.set({ 
      isEditing: true, 
      value: currentValue, 
      error: null, 
      isLoading: false 
    })
  }, [currentValue, editingAtom])
  
  const saveEdit = useCallback(async (selectedValue?: any) => {
    const valueToSave = selectedValue !== undefined ? selectedValue : value
    
    try {
      // Validate if validation function provided
      const validationError = validate?.(valueToSave)
      if (validationError) {
        editingAtom.set(prev => ({ ...prev, error: validationError }))
        return
      }

      editingAtom.set(prev => ({ ...prev, isLoading: true, error: null }))

      // ✅ DIRECT ATOM UPDATE: Use domain action pattern
      console.log('[EditableSelectColumn] Starting atomic save:', {
        rowId,
        accessorKey,
        value: valueToSave,
        valueType: typeof valueToSave
      })
      
      await updateAction(rowId, { [accessorKey]: valueToSave } as Partial<T>)
      
      // ✅ SUCCESS: Exit editing mode
      editingAtom.set({ 
        isEditing: false, 
        value: '', 
        error: null, 
        isLoading: false 
      })
      
    } catch (error) {
      console.error('[EditableSelectColumn] Save failed:', error)
      editingAtom.set(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Save failed',
        isLoading: false
      }))
    }
  }, [rowId, accessorKey, value, updateAction, validate, editingAtom])

  const cancelEdit = useCallback(() => {
    editingAtom.set({ 
      isEditing: false, 
      value: '', 
      error: null, 
      isLoading: false 
    })
  }, [editingAtom])

  const updateValue = useCallback((newValue: any) => {
    editingAtom.set(prev => ({ 
      ...prev, 
      value: newValue, 
      error: null // Clear error when user types
    }))
  }, [editingAtom])

  // ============================================================================
  // Render Logic
  // ============================================================================
  
  // ✅ CONDITIONAL RENDERING: Only re-render this cell when its state changes
  if (isEditing) {
    return (
      <div 
        data-cell-id={`${rowId}:${String(accessorKey)}`}
        onBlur={(e) => {
          // Only cancel if blur goes outside this cell
          if (!e.currentTarget.contains(e.relatedTarget)) {
            cancelEdit()
          }
        }}
        className="w-full"
      >
        <LightweightSelect
          value={value}
          onValueChange={updateValue}
          onSubmit={saveEdit}
          onCancel={cancelEdit}
          options={options}
          placeholder={placeholder}
          searchable={searchable}
          noOptionsMessage={noOptionsMessage}
          autoOpen
          disabled={isLoading}
        />
        {error && (
          <div className="text-xs text-destructive mt-1">
            {error}
          </div>
        )}
      </div>
    )
  }

  // ✅ DISPLAY MODE: Optimized display with optional custom renderer
  const displayValue = useMemo(() => {
    if (displayRenderer) {
      return displayRenderer(currentValue, options)
    }
    
    if (!currentValue || currentValue === '') {
      return <span className="text-muted-foreground">Click to select</span>
    }
    
    // Find the option to display its label
    const selectedOption = options.find(opt => opt.value === currentValue)
    const displayText = selectedOption ? selectedOption.label : String(currentValue)
    
    return (
      <span className="text-foreground truncate">
        {displayText}
      </span>
    )
  }, [currentValue, options, displayRenderer])

  return (
    <div 
              className={`group w-full min-h-[2rem] text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center ${className || ''}`}
      onClick={startEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startEdit()
        }
      }}
    >
      {displayValue}
    </div>
  )
}

// ============================================================================
// Column Definition Helper (For TanStack Table Integration)
// ============================================================================

interface SelectColumnConfig<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  entityAtom: any
  options: LightweightSelectOption[]
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  placeholder?: string
  searchable?: boolean
  noOptionsMessage?: string
  className?: string
  displayRenderer?: (value: any, options: LightweightSelectOption[]) => React.ReactNode
  size?: number
  enableSorting?: boolean
  enableFiltering?: boolean
}

export const createEditableSelectColumn = <T extends BaseEntity>(
  config: SelectColumnConfig<T>
) => ({
  accessorKey: config.accessorKey,
  header: config.header,
  size: config.size,
  enableSorting: config.enableSorting ?? true,
  enableFiltering: config.enableFiltering ?? true,
  cell: ({ row }: { row: { id: string } }) => (
    <EditableSelectColumn
      accessorKey={config.accessorKey}
      header={config.header}
      rowId={row.id}
      entityAtom={config.entityAtom}
      options={config.options}
      updateAction={config.updateAction}
      validate={config.validate}
      placeholder={config.placeholder}
      searchable={config.searchable}
      noOptionsMessage={config.noOptionsMessage}
      className={config.className}
      displayRenderer={config.displayRenderer}
    />
  )
})

// ============================================================================
// Relationship Column Variant (For Foreign Keys)
// ============================================================================

interface RelationshipColumnProps<T extends BaseEntity, R extends BaseEntity> {
  accessorKey: keyof T
  header: string
  rowId: string
  entityAtom: any // Source entity atom (e.g., tasksAtom)
  relationshipAtom: any // Related entity atom (e.g., usersAtom, projectsAtom)
  onUpdate?: (rowId: string, columnId: string, value: any) => Promise<void>
  getDisplayValue: (entity: R) => string
  getValueId: (entity: R) => string
  placeholder?: string
  searchable?: boolean
  className?: string
  allowNull?: boolean
  nullLabel?: string
}

export function EditableRelationshipColumn<T extends BaseEntity, R extends BaseEntity>({ 
  accessorKey, 
  header, 
  rowId, 
  entityAtom,
  relationshipAtom,
  onUpdate,
  getDisplayValue,
  getValueId,
  placeholder = "Select...",
  searchable = true,
  className,
  allowNull = true,
  nullLabel = "None"
}: RelationshipColumnProps<T, R>) {
  
  // ✅ ATOMIC STATE: Each cell gets its own editing atom
  const editingAtom = useMemo(() => createCellEditingAtom(), [])
  
  // ✅ REACTIVE DATA: Get current value from source entity atom
  const currentValue = useSelector(entityAtom, (entities: unknown) => {
    const entitiesRecord = entities as Record<string, T>
    const entity = entitiesRecord[rowId]
    return entity?.[accessorKey] || ''
  })
  
  // ✅ REACTIVE OPTIONS: Get relationship options from related entity atom
  const options = useSelector(relationshipAtom, (entities: unknown) => {
    const entitiesRecord = entities as Record<string, R>
    const entityArray = Object.values(entitiesRecord)
    
    const opts: LightweightSelectOption[] = entityArray.map(entity => ({
      value: getValueId(entity),
      label: getDisplayValue(entity)
    }))
    
    if (allowNull) {
      opts.unshift({ value: '', label: nullLabel })
    }
    
    return opts
  })
  
  return (
    <EditableSelectColumn
      accessorKey={accessorKey}
      header={header}
      rowId={rowId}
      entityAtom={entityAtom}
      options={options}
      onUpdate={onUpdate}
      placeholder={placeholder}
      searchable={searchable}
      className={className}
      displayRenderer={(value, opts) => {
        if (!value || value === '') {
          return <span className="text-muted-foreground">{nullLabel}</span>
        }
        const option = opts.find(opt => opt.value === value)
        return (
          <span className="text-foreground truncate">
            {option ? option.label : value}
          </span>
        )
      }}
    />
  )
}

export const createEditableRelationshipColumn = <T extends BaseEntity, R extends BaseEntity>(
  config: Omit<RelationshipColumnProps<T, R>, 'rowId'> & {
    size?: number
    enableSorting?: boolean
    enableFiltering?: boolean
  }
) => ({
  accessorKey: config.accessorKey,
  header: config.header,
  size: config.size,
  enableSorting: config.enableSorting ?? true,
  enableFiltering: config.enableFiltering ?? true,
  cell: ({ row }: { row: { id: string } }) => (
    <EditableRelationshipColumn
      {...config}
      rowId={row.id}
    />
  )
}) 