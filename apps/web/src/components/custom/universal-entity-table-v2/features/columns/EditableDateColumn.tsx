import React, { useCallback, useMemo } from 'react'
import { useSelector } from '@xstate/store/react'
import { createAtom } from '@xstate/store'
import { LightweightDatePicker } from '../../performance/LightweightDatePicker'
import type { BaseEntity } from '../../core/table-types'

// ============================================================================
// Atomic Column Component for Editable Date Fields
// ============================================================================

interface EditableDateColumnProps<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  rowId: string
  entityAtom: any // XState atom: createAtom<Record<string, T>>({})
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  placeholder?: string
  className?: string
  displayRenderer?: (value: any) => React.ReactNode
  min?: string // Minimum date (ISO string)
  max?: string // Maximum date (ISO string)
  required?: boolean
}

// ============================================================================
// Cell Editing Atoms (Same pattern as EditableTextColumn)
// ============================================================================

interface CellEditingState {
  isEditing: boolean
  value: string
  error: string | null
  isLoading: boolean
  optimisticValue: string | null
}

const cellEditingAtoms = new Map<string, any>()

function getCellEditingAtom(cellKey: string) {
  if (!cellEditingAtoms.has(cellKey)) {
    const atom = createAtom<CellEditingState>({
      isEditing: false,
      value: '',
      error: null,
      isLoading: false,
      optimisticValue: null
    })
    cellEditingAtoms.set(cellKey, atom)
  }
  return cellEditingAtoms.get(cellKey)!
}

// ============================================================================
// Atomic Date Column Component
// ============================================================================

export function EditableDateColumn<T extends BaseEntity>({ 
  accessorKey, 
  header, 
  rowId, 
  entityAtom, 
  updateAction,
  validate,
  placeholder = "Select date...",
  className,
  displayRenderer,
  min,
  max,
  required = false
}: EditableDateColumnProps<T>) {
  
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
  const { isEditing, value, error, isLoading, optimisticValue } = useSelector(editingAtom, (state) => state as CellEditingState)

  // ✅ CLEAR OPTIMISTIC VALUE: When atom catches up to optimistic value
  React.useEffect(() => {
    if (optimisticValue !== null && currentValue === optimisticValue) {
      // The atom has caught up to our optimistic value, clear it
      editingAtom.set((prev: CellEditingState) => ({ ...prev, optimisticValue: null }))
    }
  }, [currentValue, optimisticValue, editingAtom])

  // ============================================================================
  // Event Handlers (Atomic Actions)
  // ============================================================================
  
  const startEdit = useCallback(() => {
    // Capture the current value at the moment editing starts
    const editStartValue = currentValue
    
    console.log(`[EditableDateColumn] Start editing ${String(accessorKey)} for ${rowId.slice(-8)}`)
    
    editingAtom.set({ 
      isEditing: true, 
      value: editStartValue, 
      error: null, 
      isLoading: false,
      optimisticValue: null
    })
  }, [currentValue, editingAtom, rowId, accessorKey])
  
  const saveEdit = useCallback(async (dateValue?: string) => {
    try {
      // Use provided value or get from editing atom
      const valueToSave = dateValue !== undefined ? dateValue : editingAtom.get().value
      
      // Validate if validation function provided
      const validationError = validate?.(valueToSave)
      if (validationError) {
        editingAtom.set((prev: CellEditingState) => ({ ...prev, error: validationError }))
        return
      }

      console.log(`[EditableDateColumn] Saving ${String(accessorKey)} for ${rowId.slice(-8)}: "${valueToSave}"`)
      
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
      console.error('[EditableDateColumn] Save setup failed:', error)
      editingAtom.set((prev: CellEditingState) => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Save failed',
        isLoading: false
      }))
    }
  }, [rowId, accessorKey, updateAction, validate, editingAtom])

  const cancelEdit = useCallback(() => {
    console.log(`[EditableDateColumn] Cancelling edit for ${String(accessorKey)} - ${rowId.slice(-8)}`)
    editingAtom.set({ 
      isEditing: false, 
      value: '', 
      error: null, 
      isLoading: false,
      optimisticValue: null  // Clear optimistic value on cancel
    })
  }, [editingAtom, accessorKey, rowId])

  const updateValue = useCallback((newValue: string) => {
    console.log(`[EditableDateColumn] Value changed for ${String(accessorKey)}: "${newValue}"`)
    
    editingAtom.set((prev: CellEditingState) => ({ 
      ...prev, 
      value: newValue, 
      error: null // Clear error when user changes date
    }))
  }, [editingAtom, accessorKey])

  // ✅ HANDLE DATE PICKER SUBMIT: When user selects a date, save and exit
  const handleDateSubmit = useCallback((dateValue?: string) => {
    console.log(`[EditableDateColumn] Date selected for ${String(accessorKey)}: "${dateValue}"`)
    saveEdit(dateValue)
  }, [saveEdit, accessorKey])

  // ✅ HANDLE DATE PICKER CANCEL: When user cancels (blur/escape), just cancel
  const handleDateCancel = useCallback(() => {
    console.log(`[EditableDateColumn] Date picker cancelled for ${String(accessorKey)}`)
    cancelEdit()
  }, [cancelEdit, accessorKey])

  // ✅ DISPLAY VALUE: Use optimistic value if available, otherwise atom value
  const displayValue = useMemo(() => {
    const valueToDisplay = optimisticValue !== null ? optimisticValue : currentValue
    
    if (displayRenderer) {
      return displayRenderer(valueToDisplay)
    }
    
    if (!valueToDisplay) {
      return <span className="text-muted-foreground">No date set</span>
    }
    
    try {
      const date = new Date(valueToDisplay)
      return (
        <span className="text-foreground">
          {date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })}
        </span>
      )
    } catch {
      return <span className="text-muted-foreground">Invalid date</span>
    }
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
        className="w-full min-w-[140px]" // Ensure minimum width for date picker
      >
        <LightweightDatePicker
          value={value}
          onValueChange={updateValue}
          onSubmit={handleDateSubmit}
          onCancel={handleDateCancel}
          placeholder={placeholder}
          min={min}
          max={max}
          required={required}
          autoFocus
          disabled={isLoading}
          className="w-full"
        />
        {error && (
          <div className="text-xs text-red-600 mt-1 absolute z-10 bg-background border border-border rounded px-2 py-1 shadow-md">
            {error}
          </div>
        )}
      </div>
    )
  }

  // ✅ DISPLAY MODE: Optimized display with consistent width
  return (
    <div 
              className={`group w-full min-w-[140px] min-h-[2rem] text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center justify-between transition-colors ${className || ''}`}
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
      <span className="truncate flex-1 min-w-0">
        {displayValue}
      </span>
      <div className="ml-2 opacity-0 group-hover:opacity-50 transition-opacity">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    </div>
  )
}

// ============================================================================
// Column Definition Helper (For TanStack Table Integration)
// ============================================================================

interface DateColumnConfig<T extends BaseEntity> {
  accessorKey: keyof T
  header: string
  entityAtom: any
  updateAction: (id: string, updates: Partial<T>) => void | Promise<void>
  validate?: (value: any) => string | null
  placeholder?: string
  className?: string
  displayRenderer?: (value: any) => React.ReactNode
  min?: string
  max?: string
  required?: boolean
  size?: number
  enableSorting?: boolean
  enableFiltering?: boolean
}

export const createEditableDateColumn = <T extends BaseEntity>(
  config: DateColumnConfig<T>
) => ({
  accessorKey: config.accessorKey,
  header: config.header,
  size: config.size,
  enableSorting: config.enableSorting ?? true,
  enableFiltering: config.enableFiltering ?? true,
  cell: ({ row }: { row: { id: string } }) => (
    <EditableDateColumn
      accessorKey={config.accessorKey}
      header={config.header}
      rowId={row.id}
      entityAtom={config.entityAtom}
      updateAction={config.updateAction}
      validate={config.validate}
      placeholder={config.placeholder}
      className={config.className}
      displayRenderer={config.displayRenderer}
      min={config.min}
      max={config.max}
      required={config.required}
    />
  )
}) 