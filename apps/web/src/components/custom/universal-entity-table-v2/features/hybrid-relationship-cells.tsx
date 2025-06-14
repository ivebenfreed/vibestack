/**
 * Hybrid Relationship Cells - Universal Entity Table v2
 * 
 * 🎯 Formalized pattern from MinimalTable performance optimizations
 * ✅ Primary: Use pre-joined SQL data (task.assigneeName)
 * ✅ Fallback: Lookup arrays for editing and missing data
 * ⚡ Zero prop drilling, optimal performance
 * 
 * Pattern:
 * 1. SQL joins provide displayName directly (instant display)
 * 2. Separate entity arrays for editing dropdowns
 * 3. Smart display logic prefers joined > lookup > fallback
 */

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { CellContext } from '@tanstack/react-table'
import { ChevronDownIcon } from '@radix-ui/react-icons'
import { LightweightSelect } from '../performance/LightweightSelect'
import type { LightweightSelectOption } from '../performance/LightweightSelect'

// ============================================================================
// TYPES
// ============================================================================

export interface HybridRelationshipConfig<TEntity = any, TRelated = any> {
  /** Field name in the entity for the relation ID (e.g., 'assigneeId') */
  relationIdField: string
  
  /** Pre-joined display field name (e.g., 'assigneeName' from SQL join) */
  displayField?: string
  
  /** Array of all related entities for dropdown options */
  relatedEntities: TRelated[]
  
  /** How to get the ID from a related entity */
  getEntityId: (entity: TRelated) => string
  
  /** How to get the display name from a related entity */
  getDisplayName: (entity: TRelated) => string
  
  /** Placeholder when no entity is selected */
  placeholder?: string
  
  /** Option for "no selection" */
  noneOption?: { value: string; label: string }
  
  /** Callback when value changes */
  onValueChange?: (newValue: string | null) => Promise<void>
}

export interface HybridRelationshipCellProps<TData = any> {
  /** TanStack Table cell context */
  cell: CellContext<TData, any>
  
  /** Relationship configuration */
  config: HybridRelationshipConfig
  
  /** Whether this cell is currently being edited */
  isEditing?: boolean
  
  /** Start editing callback */
  onStartEdit?: () => void
  
  /** Stop editing callback */
  onStopEdit?: () => void
  
  /** Custom CSS classes */
  className?: string
}

// ============================================================================
// HYBRID RELATIONSHIP CELL COMPONENT
// ============================================================================

/**
 * High-performance relationship cell with hybrid data pattern
 * 
 * Performance optimizations:
 * - Prefers pre-joined display data (no lookups needed)
 * - Falls back to array lookups only when needed
 * - Memoized options generation
 * - Stable callbacks to prevent re-renders
 * 
 * @example
 * ```tsx
 * {
 *   accessorKey: 'assigneeId',
 *   header: 'Assignee',
 *   cell: (props) => (
 *     <HybridRelationshipCell
 *       cell={props}
 *       config={{
 *         relationIdField: 'assigneeId',
 *         displayField: 'assigneeName', // From SQL join
 *         relatedEntities: allUsers,
 *         getEntityId: (user) => user.id,
 *         getDisplayName: (user) => user.name || user.email,
 *         placeholder: 'Unassigned',
 *         noneOption: { value: 'none', label: 'Unassigned' }
 *       }}
 *     />
 *   )
 * }
 * ```
 */
export const HybridRelationshipCell = React.memo(function HybridRelationshipCell<TData = any>({
  cell,
  config,
  isEditing: externalIsEditing = false,
  onStartEdit,
  onStopEdit,
  className = "",
}: HybridRelationshipCellProps<TData>) {
  const [internalIsEditing, setInternalIsEditing] = useState(false)
  const isEditing = externalIsEditing || internalIsEditing
  
  const {
    relationIdField,
    displayField,
    relatedEntities,
    getEntityId,
    getDisplayName,
    placeholder = "Select...",
    noneOption = { value: 'none', label: 'None' },
    onValueChange
  } = config

  // Get values from the row data
  const rowData = cell.row.original as any
  const relationId = cell.getValue() as string | null | undefined
  const preJoinedDisplayName = displayField ? rowData[displayField] : null

  // ✅ PERFORMANCE: Smart display logic - prefer joined data
  const displayName = useMemo(() => {
    // 1. Try pre-joined display field first (fastest - no lookup needed)
    if (preJoinedDisplayName) {
      return preJoinedDisplayName
    }
    
    // 2. Fallback to lookup in related entities array
    if (relationId && relatedEntities?.length > 0) {
      const relatedEntity = relatedEntities.find(entity => getEntityId(entity) === relationId)
      if (relatedEntity) {
        return getDisplayName(relatedEntity)
      }
    }
    
    // 3. Final fallback
    return null
  }, [preJoinedDisplayName, relationId, relatedEntities, getEntityId, getDisplayName])

  // ✅ PERFORMANCE: Memoized options for dropdown
  const options = useMemo<LightweightSelectOption[]>(() => {
    const opts: LightweightSelectOption[] = [noneOption]
    
    if (relatedEntities?.length > 0) {
      relatedEntities.forEach(entity => {
        opts.push({
          value: getEntityId(entity),
          label: getDisplayName(entity)
        })
      })
    }
    
    return opts
  }, [relatedEntities, getEntityId, getDisplayName, noneOption])

  // ✅ PERFORMANCE: Stable callbacks
  const handleClick = useCallback(() => {
    setInternalIsEditing(true)
    onStartEdit?.()
  }, [onStartEdit])

  const handleValueChange = useCallback(async (newValue: string) => {
    const finalValue = newValue === noneOption.value ? null : newValue
    
    try {
      if (onValueChange) {
        await onValueChange(finalValue)
      }
    } catch (error) {
      console.error('[HybridRelationshipCell] Update failed:', error)
    } finally {
      setInternalIsEditing(false)
      onStopEdit?.()
    }
  }, [onValueChange, noneOption.value, onStopEdit])

  const handleCancel = useCallback(() => {
    setInternalIsEditing(false)
    onStopEdit?.()
  }, [onStopEdit])

  // Current value for select component
  const currentValue = relationId || noneOption.value

  if (isEditing) {
    return (
      <LightweightSelect
        value={currentValue}
        onValueChange={handleValueChange}
        options={options}
        placeholder={placeholder}
        className={`w-full ${className}`}
        autoOpen={true}
        onCancel={handleCancel}
      />
    )
  }

  return (
    <div 
      className={`group w-full h-8 px-3 py-1 text-sm text-left border border-transparent rounded-md cursor-pointer hover:bg-muted/50 flex items-center justify-between ${className}`}
      onClick={handleClick}
    >
      <span className={displayName ? "text-foreground" : "text-muted-foreground"}>
        {displayName || placeholder}
      </span>
      <ChevronDownIcon className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-50" />
    </div>
  )
})

// ============================================================================
// SPECIALIZED RELATIONSHIP CELLS
// ============================================================================

/**
 * Pre-configured User Assignment Cell
 */
export interface UserAssignmentCellProps<TData = any> {
  cell: CellContext<TData, any>
  allUsers: any[]
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onValueChange?: (userId: string | null) => Promise<void>
  className?: string
}

export const UserAssignmentCell = React.memo(function UserAssignmentCell<TData = any>({
  cell,
  allUsers,
  isEditing,
  onStartEdit,
  onStopEdit,
  onValueChange,
  className
}: UserAssignmentCellProps<TData>) {
  const config: HybridRelationshipConfig = useMemo(() => ({
    relationIdField: 'assigneeId',
    displayField: 'assigneeName', // Expected from SQL join
    relatedEntities: allUsers || [],
    getEntityId: (user: any) => user.id,
    getDisplayName: (user: any) => user.name || user.email,
    placeholder: 'Unassigned',
    noneOption: { value: 'none', label: 'Unassigned' },
    onValueChange
  }), [allUsers, onValueChange])

  return (
    <HybridRelationshipCell
      cell={cell as any}
      config={config}
      isEditing={isEditing}
      onStartEdit={onStartEdit}
      onStopEdit={onStopEdit}
      className={className}
    />
  )
})

/**
 * Pre-configured Project Assignment Cell
 */
export interface ProjectAssignmentCellProps<TData = any> {
  cell: CellContext<TData, any>
  allProjects: any[]
  isEditing?: boolean
  onStartEdit?: () => void
  onStopEdit?: () => void
  onValueChange?: (projectId: string | null) => Promise<void>
  className?: string
}

export const ProjectAssignmentCell = React.memo(function ProjectAssignmentCell<TData = any>({
  cell,
  allProjects,
  isEditing,
  onStartEdit,
  onStopEdit,
  onValueChange,
  className
}: ProjectAssignmentCellProps<TData>) {
  const config: HybridRelationshipConfig = useMemo(() => ({
    relationIdField: 'projectId',
    displayField: 'projectName', // Expected from SQL join
    relatedEntities: allProjects || [],
    getEntityId: (project: any) => project.id,
    getDisplayName: (project: any) => project.name,
    placeholder: 'No project',
    noneOption: { value: 'none', label: 'No project' },
    onValueChange
  }), [allProjects, onValueChange])

  return (
    <HybridRelationshipCell
      cell={cell as any}
      config={config}
      isEditing={isEditing}
      onStartEdit={onStartEdit}
      onStopEdit={onStopEdit}
      className={className}
    />
  )
})

// ============================================================================
// HELPER HOOKS
// ============================================================================

/**
 * Hook for managing relationship cell editing state
 */
export function useRelationshipCellEditing(rowId: string, columnId: string) {
  const [isEditing, setIsEditing] = useState(false)
  const [editingValue, setEditingValue] = useState<string | null>(null)

  const startEditing = useCallback((initialValue: string | null = null) => {
    setEditingValue(initialValue)
    setIsEditing(true)
  }, [])

  const stopEditing = useCallback(() => {
    setIsEditing(false)
    setEditingValue(null)
  }, [])

  const updateValue = useCallback((newValue: string | null) => {
    setEditingValue(newValue)
  }, [])

  return {
    isEditing,
    editingValue,
    startEditing,
    stopEditing,
    updateValue
  }
}

/**
 * Helper for creating relationship column definitions
 */
export function createHybridRelationshipColumn<TData = any>(
  accessorKey: string,
  header: string,
  config: Omit<HybridRelationshipConfig, 'onValueChange'>,
  options: {
    size?: number
    onValueChange?: (rowId: string, newValue: string | null) => Promise<void>
  } = {}
) {
  return {
    accessorKey,
    header,
    size: options.size || 150,
    cell: (props: CellContext<TData, any>) => {
      const handleValueChange = options.onValueChange 
        ? (newValue: string | null) => options.onValueChange!(props.row.id, newValue)
        : undefined

      return (
        <HybridRelationshipCell
          cell={props as any}
          config={{
            ...config,
            onValueChange: handleValueChange
          }}
        />
      )
    }
  }
} 