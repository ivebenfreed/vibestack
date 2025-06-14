// ============================================================================
// Universal Entity Table v2 - Atomic Column Components
// ============================================================================

// Export individual column components
export { 
  EditableTextColumn, 
  createEditableTextColumn 
} from './EditableTextColumn'

export { 
  EditableSelectColumn, 
  EditableRelationshipColumn,
  createEditableSelectColumn,
  createEditableRelationshipColumn 
} from './EditableSelectColumn'

export { EditableDateColumn, createEditableDateColumn } from './EditableDateColumn'

// Export stable relationship components
export {
  RelationshipColumn,
  ProjectColumn,
  AssigneeColumn,
  createProjectColumn,
  createAssigneeColumn
} from './RelationshipColumn'

// Export types
export type { BaseEntity } from '../../core/table-types'
export type { LightweightSelectOption } from '../../performance/LightweightSelect'

// Export enum column components
export { 
  EnumColumn, 
  createStatusColumn, 
  createPriorityColumn, 
  createEnumColumn 
} from './EnumColumn'

export { HybridRelationshipCell } from '../hybrid-relationship-cells'

// ============================================================================
// Unified Column API - Replaces Helper Functions
// ============================================================================

import type { BaseEntity } from '../../core/table-types'
import type { LightweightSelectOption } from '../../performance/LightweightSelect'
import { createEditableTextColumn } from './EditableTextColumn'
import { createEditableDateColumn } from './EditableDateColumn'
import { createEditableSelectColumn, createEditableRelationshipColumn } from './EditableSelectColumn'

/**
 * ✅ ATOMIC COLUMN FACTORY
 * 
 * Replaces the complex helper functions with stable, component-based column definitions.
 * Each column type is a self-contained component with its own atomic state management.
 * 
 * Benefits:
 * - No more helper function memoization needed
 * - Stable column definitions that don't cause table re-renders
 * - Atomic cell-level state management
 * - Direct domain atom subscriptions
 * - Zero cross-cell interference
 */
export const TableColumns = {
  
  /**
   * 📝 Text Column - Editable text input with validation
   */
  text: <T extends BaseEntity>(config: {
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
  }) => createEditableTextColumn(config),
  
  /**
   * 📅 Date Column - Editable date picker with validation
   */
  date: <T extends BaseEntity>(config: {
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
  }) => createEditableDateColumn(config),
  
  /**
   * 🔽 Select Column - Dropdown with predefined options
   */
  select: <T extends BaseEntity>(config: {
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
  }) => createEditableSelectColumn(config),
  
  /**
   * 🔗 Relationship Column - Foreign key selector with reactive options
   */
  relationship: <T extends BaseEntity, R extends BaseEntity>(config: {
    accessorKey: keyof T
    header: string
    entityAtom: any
    relationshipAtom: any
    onUpdate?: (rowId: string, columnId: string, value: any) => Promise<void>
    getDisplayValue: (entity: R) => string
    getValueId: (entity: R) => string
    placeholder?: string
    searchable?: boolean
    className?: string
    allowNull?: boolean
    nullLabel?: string
    size?: number
    enableSorting?: boolean
    enableFiltering?: boolean
  }) => createEditableRelationshipColumn(config),
  
  /**
   * 👀 Display Column - Read-only column with custom renderer
   */
  display: <T extends BaseEntity>(config: {
    accessorKey: keyof T
    header: string
    cell?: (value: any, row: T) => React.ReactNode
    size?: number
    enableSorting?: boolean
    enableFiltering?: boolean
  }) => ({
    accessorKey: config.accessorKey,
    header: config.header,
    size: config.size,
    enableSorting: config.enableSorting ?? true,
    enableFiltering: config.enableFiltering ?? false,
    cell: ({ row, getValue }: { row: { original: T }, getValue: () => any }) => {
      const value = getValue()
      
      if (config.cell) {
        return config.cell(value, row.original)
      }
      
      // Default display logic
      if (value === null || value === undefined) {
        return <span className="text-muted-foreground">—</span>
      }
      
      if (typeof value === 'boolean') {
        return <span className={value ? 'text-green-600' : 'text-gray-600'}>
          {value ? 'Yes' : 'No'}
        </span>
      }
      
      if (value instanceof Date) {
        return <span>{value.toLocaleDateString()}</span>
      }
      
      if (Array.isArray(value)) {
        return <span>{value.join(', ')}</span>
      }
      
      return <span className="truncate">{String(value)}</span>
    }
  }),
  
  /**
   * ⚡ Action Column - Custom action buttons
   */
  actions: <T extends BaseEntity>(config: {
    header?: string
    actions: Array<{
      label: string
      icon?: React.ComponentType<any>
      onClick: (row: T) => void
      variant?: 'default' | 'destructive' | 'outline' | 'ghost'
      size?: 'sm' | 'default' | 'lg'
      disabled?: (row: T) => boolean
    }>
    size?: number
  }) => ({
    id: 'actions',
    header: config.header || 'Actions',
    size: config.size || 100,
    enableSorting: false,
    enableFiltering: false,
    cell: ({ row }: { row: { original: T } }) => (
      <div className="flex items-center gap-2">
        {config.actions.map((action, index) => {
          const isDisabled = action.disabled?.(row.original) ?? false
          const IconComponent = action.icon
          
          return (
            <button
              key={index}
              onClick={() => !isDisabled && action.onClick(row.original)}
              disabled={isDisabled}
              className={`
                inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md transition-colors
                ${action.variant === 'destructive' 
                  ? 'bg-destructive/10 text-destructive hover:bg-destructive/20' 
                  : action.variant === 'outline'
                  ? 'border border-border hover:bg-muted'
                  : action.variant === 'ghost'
                  ? 'hover:bg-muted'
                  : 'bg-primary/10 text-primary hover:bg-primary/20'
                }
                ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {IconComponent && <IconComponent className="h-3 w-3" />}
              {action.label}
            </button>
          )
        })}
      </div>
    )
  })
}

// ============================================================================
// Column Type Definitions for TypeScript
// ============================================================================

export type TableColumnType = 'text' | 'select' | 'relationship' | 'display' | 'actions'

export interface ColumnConfig<T extends BaseEntity> {
  type: TableColumnType
  accessorKey: keyof T
  header: string
  [key: string]: any // Allow additional type-specific props
}

// ============================================================================
// Migration Utilities (For Converting from Helper Functions)
// ============================================================================

/**
 * 🔄 MIGRATION HELPER
 * 
 * Converts old helper function-based column definitions to new atomic components.
 * Use this during migration to gradually replace helper functions.
 */
export const migrateColumnDefinition = <T extends BaseEntity>(
  oldColumn: any, 
  entityAtom: any,
  onUpdate?: (rowId: string, columnId: string, value: any) => Promise<void>
) => {
  // Detect column type based on old column properties
  if (oldColumn.dataType === 'relationship' && oldColumn.relationshipConfig) {
    return TableColumns.relationship({
      accessorKey: oldColumn.accessorKey,
      header: oldColumn.header,
      entityAtom,
      relationshipAtom: oldColumn.relationshipConfig.relatedEntityService.atoms.allEntitiesAtom,
      getDisplayValue: oldColumn.relationshipConfig.getDisplayValue,
      getValueId: oldColumn.relationshipConfig.getEntityId,
      onUpdate,
      size: oldColumn.size,
      enableSorting: oldColumn.sortable,
      enableFiltering: oldColumn.filterable
    })
  }
  
  if (oldColumn.dataType === 'text' || !oldColumn.dataType) {
    return TableColumns.text({
      accessorKey: oldColumn.accessorKey,
      header: oldColumn.header,
      entityAtom,
      onUpdate,
      validate: oldColumn.validate,
      size: oldColumn.size,
      enableSorting: oldColumn.sortable,
      enableFiltering: oldColumn.filterable
    })
  }
  
  // Default to display column for unknown types
  return TableColumns.display({
    accessorKey: oldColumn.accessorKey,
    header: oldColumn.header,
    size: oldColumn.size,
    enableSorting: oldColumn.sortable,
    enableFiltering: oldColumn.filterable
  })
}

// ============================================================================
// Performance Notes
// ============================================================================

/*
🎯 PERFORMANCE IMPROVEMENTS:

✅ STABLE COLUMN DEFINITIONS:
- Component-based columns don't recreate on every render
- No more useMemo/useCallback needed for column definitions
- TanStack Table sees consistent column identity

✅ ATOMIC CELL STATE:
- Each cell manages its own editing state independently
- No table-wide re-renders when editing a single cell
- Zero interference between different cells

✅ DIRECT DOMAIN SUBSCRIPTIONS:
- Each cell subscribes directly to its entity in the domain atom
- Only re-renders when the specific entity data changes
- No complex state synchronization needed

✅ ELIMINATED HELPER FUNCTION COMPLEXITY:
- No more 458-line helper files requiring extensive memoization
- No more function recreation causing column definition changes
- No more complex context propagation for state

MIGRATION PATH:
1. Replace createEditableTextColumn() calls with TableColumns.text()
2. Replace createEditableSelectColumn() calls with TableColumns.select()
3. Replace relationship helpers with TableColumns.relationship()
4. Remove old helper function imports
5. Remove complex memoization code
6. Enjoy stable, performant table columns!
*/ 