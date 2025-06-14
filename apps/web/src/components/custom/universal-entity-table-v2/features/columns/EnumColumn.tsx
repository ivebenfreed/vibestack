import React, { useState, useMemo, useCallback } from 'react'
import { useSelector } from '@xstate/store/react'
import type { BaseEntity } from '../../core/table-types'
import { badge, taskStatus, taskPriority } from '../display-renderers'
import { LightweightSelect, type LightweightSelectOption } from '../../performance/LightweightSelect'

// ============================================================================
// STABLE ENUM COLUMN COMPONENT
// ============================================================================

interface EnumOption {
  value: string
  label: string
  color?: string
}

interface EnumColumnProps<T extends BaseEntity> {
  /** Current row ID */
  rowId: string
  /** Field name (e.g., 'status', 'priority') */
  accessorKey: keyof T
  /** Current field value */
  currentValue: any
  /** Available enum options */
  options: EnumOption[]
  /** Update callback */
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>
  /** Placeholder text */
  placeholder?: string
  /** Enum type for custom rendering */
  enumType?: 'status' | 'priority' | 'custom'
  /** Optional CSS classes */
  className?: string
}

export function EnumColumn<T extends BaseEntity>({
  rowId,
  accessorKey,
  currentValue,
  options,
  onUpdate,
  placeholder = 'Select...',
  enumType = 'custom',
  className = ''
}: EnumColumnProps<T>) {
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Convert EnumOption[] to LightweightSelectOption[]
  const selectOptions: LightweightSelectOption[] = useMemo(
    () => options.map(opt => ({ value: opt.value, label: opt.label })),
    [options]
  )

  // ✅ SINGLE CLICK TO EDIT
  const startEditing = useCallback(() => {
    if (isLoading) return
    setIsEditing(true)
  }, [isLoading])

  // ✅ RETURN TO DISPLAY MODE (on cancel/blur/escape)
  const stopEditing = useCallback(() => {
    setIsEditing(false)
  }, [])

  // ✅ VALUE CHANGE + RETURN TO DISPLAY MODE
  const handleValueChange = useCallback(async (newValue: string) => {
    if (newValue === currentValue) {
      // Same value selected, just exit editing mode
      setIsEditing(false)
      return
    }

    setIsLoading(true)
    try {
      await onUpdate(rowId, accessorKey, newValue)
      // Success: return to display mode
      setIsEditing(false)
    } catch (error) {
      console.error('[EnumColumn] Update failed:', error)
      // Error: stay in editing mode so user can retry
    } finally {
      setIsLoading(false)
    }
  }, [rowId, accessorKey, currentValue, onUpdate])

  // ✅ FORMATTED DISPLAY: Use the existing display renderers
  const displayValue = useMemo(() => {
    if (!currentValue || currentValue === '') {
      return <span className="text-muted-foreground">Click to select</span>
    }

    // Use specific renderers for known enum types
    switch (enumType) {
      case 'status':
        return taskStatus(currentValue)
      case 'priority':
        return taskPriority(currentValue)
      case 'custom':
      default:
        // Find the option and use badge renderer
        const option = options.find(opt => opt.value === currentValue)
        const displayLabel = option?.label || currentValue
        
        if (option?.color) {
          return badge(currentValue, {
            colorMapping: { [currentValue]: option.color },
            labelMapping: { [currentValue]: displayLabel }
          })
        }
        
        return <span className="text-foreground">{displayLabel}</span>
    }
  }, [currentValue, enumType, options])

  // ✅ EDITING MODE: Show LightweightSelect
  if (isEditing) {
    return (
      <div className="w-full">
        <LightweightSelect
          value={currentValue || ''}
          onValueChange={handleValueChange}
          options={selectOptions}
          placeholder={placeholder}
          autoOpen={true}
          onCancel={stopEditing}
          disabled={isLoading}
          className="w-full"
        />
      </div>
    )
  }

  // ✅ DISPLAY MODE: Show formatted value, click to edit
  return (
    <div
      className={`group w-full min-h-[2rem] text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center transition-colors ${className}`}
      onClick={startEditing}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          startEditing()
        }
      }}
      aria-label={`Edit ${String(accessorKey)}: ${currentValue || 'not set'}`}
    >
      <div className="flex-1 truncate">
        {displayValue}
      </div>
      {/* Optional: Show edit indicator on hover */}
      <div className="opacity-0 group-hover:opacity-50 transition-opacity">
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  )
}

// ============================================================================
// COLUMN DEFINITION HELPERS
// ============================================================================

/**
 * Create a status enum column with proper coloring
 */
export function createStatusColumn<T extends BaseEntity & { status: any }>(
  entityAtom: any,
  updateAction: (id: string, updates: Partial<T>) => Promise<void>,
  size: number = 140,
  enumValues: Record<string, string> = {
    'open': 'Open',
    'in_progress': 'In Progress', 
    'completed': 'Completed',
    'cancelled': 'Cancelled'
  }
) {
  const options = Object.entries(enumValues).map(([value, label]) => ({
    value,
    label
  }))

  return {
    accessorKey: 'status' as keyof T,
    header: 'Status',
    size,
    enableSorting: true,
    enableHiding: false, // Status is usually required
    cell: ({ row }: { row: { original: T } }) => {
      const entity = row.original
      return (
        <EnumColumn
          rowId={entity.id}
          accessorKey={'status' as keyof T}
          currentValue={entity.status}
          options={options}
          onUpdate={async (rowId, field, value) => {
            await updateAction(rowId, { [field]: value } as Partial<T>)
          }}
          enumType="status"
        />
      )
    }
  }
}

/**
 * Create a priority enum column with proper coloring
 */
export function createPriorityColumn<T extends BaseEntity & { priority: any }>(
  entityAtom: any,
  updateAction: (id: string, updates: Partial<T>) => Promise<void>,
  size: number = 120,
  enumValues: Record<string, string> = {
    'low': 'Low',
    'medium': 'Medium',
    'high': 'High',
    'critical': 'Critical'
  }
) {
  const options = Object.entries(enumValues).map(([value, label]) => ({
    value,
    label
  }))

  return {
    accessorKey: 'priority' as keyof T,
    header: 'Priority',
    size,
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }: { row: { original: T } }) => {
      const entity = row.original
      return (
        <EnumColumn
          rowId={entity.id}
          accessorKey={'priority' as keyof T}
          currentValue={entity.priority}
          options={options}
          onUpdate={async (rowId, field, value) => {
            await updateAction(rowId, { [field]: value } as Partial<T>)
          }}
          enumType="priority"
        />
      )
    }
  }
}

/**
 * Create a custom enum column
 */
export function createEnumColumn<T extends BaseEntity>(
  accessorKey: keyof T,
  header: string,
  entityAtom: any,
  updateAction: (id: string, updates: Partial<T>) => Promise<void>,
  options: EnumOption[],
  size: number = 120
) {
  return {
    accessorKey,
    header,
    size,
    enableSorting: true,
    enableHiding: true,
    cell: ({ row }: { row: { original: T } }) => {
      const entity = row.original
      return (
        <EnumColumn
          rowId={entity.id}
          accessorKey={accessorKey}
          currentValue={entity[accessorKey]}
          options={options}
          onUpdate={async (rowId, field, value) => {
            await updateAction(rowId, { [field]: value } as Partial<T>)
          }}
          enumType="custom"
        />
      )
    }
  }
} 