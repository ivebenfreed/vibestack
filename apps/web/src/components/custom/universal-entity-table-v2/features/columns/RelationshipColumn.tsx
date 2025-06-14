import React, { useState, useMemo, useCallback } from 'react'
import { useSelector } from '@xstate/store/react'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { LightweightSelect, type LightweightSelectOption } from '../../performance/LightweightSelect'
import type { BaseEntity } from '../../core/table-types'

// ============================================================================
// STABLE RELATIONSHIP COLUMN COMPONENT
// ============================================================================

interface RelationshipColumnProps<T extends BaseEntity> {
  /** Current row ID */
  rowId: string
  /** Field name (e.g., 'projectId', 'assigneeId') */
  accessorKey: keyof T
  /** Current field value */
  currentValue: any
  /** Available options for selection */
  options: LightweightSelectOption[]
  /** Update callback */
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>
  /** Placeholder text */
  placeholder?: string
  /** Optional CSS classes */
  className?: string
}

/**
 * ✅ STABLE RELATIONSHIP COLUMN
 * 
 * A stable React component that avoids hooks issues by:
 * - All hooks are called consistently on every render
 * - No conditional hook execution
 * - Stable component identity
 * - Proper state management
 */
export function RelationshipColumn<T extends BaseEntity>({
  rowId,
  accessorKey,
  currentValue,
  options,
  onUpdate,
  placeholder = 'Select...',
  className = ''
}: RelationshipColumnProps<T>) {
  // ✅ ALL HOOKS CALLED CONSISTENTLY
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ✅ STABLE CALLBACKS
  const handleStartEdit = useCallback(() => {
    setIsEditing(true)
    setError(null)
  }, [])

  const handleSave = useCallback(async (newValue: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Convert empty string to null for optional foreign keys
      const finalValue = newValue === '' ? null : newValue
      await onUpdate(rowId, accessorKey, finalValue)
      setIsEditing(false)
    } catch (err) {
      console.error('[RelationshipColumn] Update failed:', err)
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setIsLoading(false)
    }
  }, [rowId, accessorKey, onUpdate])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setError(null)
  }, [])

  // ✅ STABLE DISPLAY VALUE
  const displayValue = useMemo(() => {
    if (!currentValue || currentValue === '') {
      return <span className="text-muted-foreground">{placeholder}</span>
    }
    
    const selectedOption = options.find(opt => opt.value === currentValue)
    const displayText = selectedOption ? selectedOption.label : String(currentValue)
    
    return (
      <span className="text-foreground truncate">
        {displayText}
      </span>
    )
  }, [currentValue, options, placeholder])

  // ✅ CONDITIONAL RENDERING (AFTER ALL HOOKS)
  if (isEditing) {
    return (
      <div className={`w-full ${className}`}>
        <LightweightSelect
          value={currentValue || ''}
          onValueChange={handleSave}
          onCancel={handleCancel}
          options={options}
          placeholder={placeholder}
          autoOpen={true}
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

  return (
    <div 
      className={`group w-full min-h-[2rem] text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center justify-between ${className}`}
      onClick={handleStartEdit}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleStartEdit()
        }
      }}
    >
      {displayValue}
      <ChevronDownIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
    </div>
  )
}

// ============================================================================
// SPECIALIZED RELATIONSHIP COMPONENTS
// ============================================================================

interface ProjectColumnProps<T extends BaseEntity> {
  rowId: string
  currentValue: any
  allProjects: Array<{ id: string; name: string }>
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>
  className?: string
}

/**
 * ✅ PROJECT ASSIGNMENT COLUMN
 * Stable component for project selection
 */
export function ProjectColumn<T extends BaseEntity>({
  rowId,
  currentValue,
  allProjects,
  onUpdate,
  className
}: ProjectColumnProps<T>) {
  const options = useMemo<LightweightSelectOption[]>(() => [
    { value: '', label: 'No project' },
    ...allProjects.map(project => ({
      value: project.id,
      label: project.name
    }))
  ], [allProjects])

  return (
    <RelationshipColumn<T>
      rowId={rowId}
      accessorKey={'projectId' as keyof T}
      currentValue={currentValue}
      options={options}
      onUpdate={onUpdate}
      placeholder="No project"
      className={className}
    />
  )
}

interface AssigneeColumnProps<T extends BaseEntity> {
  rowId: string
  currentValue: any
  allUsers: Array<{ id: string; name?: string; email: string }>
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>
  className?: string
}

/**
 * ✅ ASSIGNEE COLUMN
 * Stable component for user assignment
 */
export function AssigneeColumn<T extends BaseEntity>({
  rowId,
  currentValue,
  allUsers,
  onUpdate,
  className
}: AssigneeColumnProps<T>) {
  const options = useMemo<LightweightSelectOption[]>(() => [
    { value: '', label: 'Unassigned' },
    ...allUsers.map(user => ({
      value: user.id,
      label: user.name || user.email
    }))
  ], [allUsers])

  return (
    <RelationshipColumn<T>
      rowId={rowId}
      accessorKey={'assigneeId' as keyof T}
      currentValue={currentValue}
      options={options}
      onUpdate={onUpdate}
      placeholder="Unassigned"
      className={className}
    />
  )
}

// ============================================================================
// COLUMN DEFINITION HELPERS
// ============================================================================

/**
 * Creates a stable project column definition
 */
export const createProjectColumn = <T extends BaseEntity>(
  allProjects: Array<{ id: string; name: string }>,
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>,
  size: number = 180
) => ({
  accessorKey: 'projectId' as keyof T,
  header: 'Project',
  size,
  enableSorting: true,
  enableFiltering: true,
  cell: ({ row, getValue }: { row: { id: string }, getValue: () => any }) => (
    <ProjectColumn<T>
      rowId={row.id}
      currentValue={getValue()}
      allProjects={allProjects}
      onUpdate={onUpdate}
    />
  )
})

/**
 * Creates a stable assignee column definition
 */
export const createAssigneeColumn = <T extends BaseEntity>(
  allUsers: Array<{ id: string; name?: string; email: string }>,
  onUpdate: (rowId: string, field: keyof T, value: any) => Promise<void>,
  size: number = 160
) => ({
  accessorKey: 'assigneeId' as keyof T,
  header: 'Assignee',
  size,
  enableSorting: true,
  enableFiltering: true,
  cell: ({ row, getValue }: { row: { id: string }, getValue: () => any }) => (
    <AssigneeColumn<T>
      rowId={row.id}
      currentValue={getValue()}
      allUsers={allUsers}
      onUpdate={onUpdate}
    />
  )
}) 