import React, { useCallback, useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { createAtom } from '@xstate/store'
import { LightweightTextInput } from '../../performance/LightweightTextInput'
import type { BaseEntity } from '../../core/table-types'

// ============================================================================
// Atomic Column Component for Editable Text Fields
// ============================================================================

interface EditableTextColumnProps<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  rowId: string
  entityAtom: any // XState atom: createAtom<Record<string, T>>({})
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  variant?: 'input' | 'textarea'
  maxLength?: number
  placeholder?: string
  className?: string
  displayRenderer?: (value: any) => React.ReactNode
}

// ============================================================================
// Stable Atom Management System
// ============================================================================

interface CellEditingState {
  isEditing: boolean
  value: string
  error: string | null
  isLoading: boolean
  optimisticValue: string | null // Local optimistic value until atom updates
}

const DEFAULT_CELL_STATE: CellEditingState = {
  isEditing: false,
  value: '',
  error: null,
  isLoading: false,
  optimisticValue: null,
}

// Global atom cache to ensure stable atoms per cell
const cellAtomCache = new Map<string, ReturnType<typeof createAtom<CellEditingState>>>()

const getCellEditingAtom = (cellKey: string) => {
  if (!cellAtomCache.has(cellKey)) {
    cellAtomCache.set(cellKey, createAtom<CellEditingState>(DEFAULT_CELL_STATE))
  }
  return cellAtomCache.get(cellKey)!
}

// ============================================================================
// Atomic Text Column Component
// ============================================================================

export function EditableTextColumn<T extends BaseEntity>({ 
  accessorKey, 
  header, 
  rowId, 
  entityAtom, 
  updateAction,
  validate,
  variant = 'input',
  maxLength,
  placeholder,
  className,
  displayRenderer
}: EditableTextColumnProps<T>) {
  
  // ✅ STABLE ATOM: Create stable cell key and get cached atom
  const cellKey = `${rowId}:${String(accessorKey)}`
  const editingAtom = getCellEditingAtom(cellKey)
  
  // ✅ REACTIVE DATA: Get current value directly from domain atom
  const currentValue = useSelector(entityAtom, (entities: unknown) => {
    const entitiesRecord = entities as Record<string, T>
    const entity = entitiesRecord[rowId]
    return entity?.[accessorKey] as string || ''
  })
  
    // ✅ ATOMIC EDITING STATE: Only this cell's editing state
  const { isEditing, value, error, isLoading, optimisticValue } = useSelector(editingAtom, (state) => state)

  // ✅ CLEAR OPTIMISTIC VALUE: When atom catches up to optimistic value
  React.useEffect(() => {
    if (optimisticValue !== null && currentValue === optimisticValue) {
      // The atom has caught up to our optimistic value, clear it
      editingAtom.set(prev => ({ ...prev, optimisticValue: null }))
    }
  }, [currentValue, optimisticValue, editingAtom])

  // ============================================================================
  // Event Handlers (Atomic Actions)
  // ============================================================================
  
  const startEdit = useCallback(() => {
    // Capture the current value at the moment editing starts
    const editStartValue = currentValue
    
    // Simplified edit logging
    console.log(`[EditableTextColumn] Start editing ${String(accessorKey)} for ${rowId.slice(-8)}`)
    
    editingAtom.set({ 
      isEditing: true, 
      value: editStartValue, 
      error: null, 
      isLoading: false,
      optimisticValue: null
    })
  }, [currentValue, editingAtom, rowId, accessorKey])
  
  const saveEdit = useCallback(async () => {
    try {
      // Get the current value from the editing atom
      const currentEditingState = editingAtom.get()
      const valueToSave = currentEditingState.value
      
      // Validate if validation function provided
      const validationError = validate?.(valueToSave)
      if (validationError) {
        editingAtom.set(prev => ({ ...prev, error: validationError }))
        return
      }

      // Simplified save logging
      console.log(`[EditableTextColumn] Saving ${String(accessorKey)} for ${rowId.slice(-8)}: "${valueToSave}"`)
      
      // ✅ FIRE AND FORGET: Call updateAction and exit edit mode immediately
      updateAction(rowId, { [accessorKey]: valueToSave } as Partial<T>)
      
      // ✅ EXIT EDITING WITH OPTIMISTIC VALUE: Show saved value immediately
      editingAtom.set({ 
        isEditing: false, 
        value: '', 
        error: null, 
        isLoading: false,
        optimisticValue: valueToSave  // Show the saved value optimistically
      })
      
    } catch (error) {
      console.error('[EditableTextColumn] Save setup failed:', error)
      editingAtom.set(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Save failed',
        isLoading: false
      }))
    }
  }, [rowId, accessorKey, updateAction, validate, editingAtom, currentValue])

  const cancelEdit = useCallback(() => {
    editingAtom.set({ 
      isEditing: false, 
      value: '', 
      error: null, 
      isLoading: false,
      optimisticValue: null  // Clear optimistic value on cancel
    })
  }, [editingAtom])

  const updateValue = useCallback((newValue: string) => {
    // Only log if in development and value changes significantly
    if (process.env.NODE_ENV === 'development' && Math.abs(newValue.length - editingAtom.get().value.length) > 5) {
      console.log(`[EditableTextColumn] Value changed for ${String(accessorKey)}: ${editingAtom.get().value.length} → ${newValue.length} chars`)
    }
    
    editingAtom.set(prev => ({ 
      ...prev, 
      value: newValue, 
      error: null // Clear error when user types
    }))
  }, [editingAtom, rowId, accessorKey])

  // ✅ DISPLAY VALUE: Use optimistic value if available, otherwise atom value
  const displayValue = useMemo(() => {
    const valueToDisplay = optimisticValue !== null ? optimisticValue : currentValue
    
    if (displayRenderer) {
      return displayRenderer(valueToDisplay)
    }
    
    if (!valueToDisplay || valueToDisplay.trim() === '') {
      return <span className="text-muted-foreground">Click to edit</span>
    }
    
    return (
      <span className="text-foreground truncate">
        {valueToDisplay}
      </span>
    )
  }, [currentValue, optimisticValue, displayRenderer])

  // ============================================================================
  // Render Logic - ALL HOOKS CALLED BEFORE ANY CONDITIONAL RENDERING
  // ============================================================================
  
  // ✅ CONDITIONAL RENDERING: Only re-render this cell when its state changes
  if (isEditing) {
    return (
      <div 
        data-cell-id={cellKey}
        onBlur={(e) => {
          // Only cancel if blur goes outside this cell
          if (!e.currentTarget.contains(e.relatedTarget)) {
            cancelEdit()
          }
        }}
        className="w-full"
      >
        <LightweightTextInput
          value={value}
          onValueChange={updateValue}
          onSubmit={saveEdit}
          onCancel={cancelEdit}
          variant={variant}
          maxLength={maxLength}
          placeholder={placeholder}
          validationState={error ? 'error' : 'default'}
          helperText={error || undefined}
          autoFocus
          disabled={isLoading}
        />
      </div>
    )
  }

  // ✅ DISPLAY MODE: Optimized display with optional custom renderer
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

interface TextColumnConfig<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  entityAtom: any
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  variant?: 'input' | 'textarea'
  maxLength?: number
  placeholder?: string
  className?: string
  displayRenderer?: (value: any) => React.ReactNode
  size?: number
  enableSorting?: boolean
  enableFiltering?: boolean
}

export const createEditableTextColumn = <T extends BaseEntity>(
  config: TextColumnConfig<T>
) => ({
  accessorKey: config.accessorKey,
  header: config.header,
  size: config.size,
  enableSorting: config.enableSorting ?? true,
  enableFiltering: config.enableFiltering ?? true,
  cell: ({ row }: { row: { id: string } }) => (
    <EditableTextColumn
      accessorKey={config.accessorKey}
      header={config.header}
      rowId={row.id}
      entityAtom={config.entityAtom}
      updateAction={config.updateAction}
      validate={config.validate}
      variant={config.variant}
      maxLength={config.maxLength}
      placeholder={config.placeholder}
      className={config.className}
      displayRenderer={config.displayRenderer}
    />
  )
})

// ============================================================================
// Performance Notes
// ============================================================================

/*
🎯 PERFORMANCE BENEFITS:

1. **Atomic State Management**: Each cell has its own editing atom
   - No table-wide re-renders when editing a single cell
   - Zero interference between different cells
   - Isolated error states per cell

2. **Direct Domain Atom Subscription**: Each cell subscribes only to its entity
   - Uses useSelector with entityAtom for reactive updates
   - Only re-renders when the specific entity data changes
   - No complex helper function memoization needed

3. **Stable Component Identity**: Component doesn't change between renders
   - No function recreation causing column definition changes
   - Stable memo boundaries for React optimization
   - Predictable re-render behavior

4. **Optimized Event Handlers**: Atomic actions with minimal dependencies
   - useCallback with minimal deps for stable references
   - Direct atom updates without complex state merging
   - Clean error handling isolated per cell

5. **Lightweight Component Tree**: No complex context propagation
   - Direct props passing for all configuration
   - No context re-renders affecting performance
   - Minimal React reconciliation overhead

PREVIOUS ISSUES SOLVED:
❌ Helper functions requiring excessive memoization
❌ Table-wide re-renders for single cell edits  
❌ Complex state synchronization between cells
❌ Unstable column definitions causing table re-creation
❌ Context propagation performance overhead

✅ Atomic cell-level state management
✅ Direct domain atom reactive subscriptions
✅ Stable component-based architecture
✅ Zero cross-cell interference
✅ Optimized render boundaries
*/ 