import React from 'react'
import { ColumnVisibilityDropdown } from './ColumnVisibilityDropdown'

interface VibeGridHeaderProps {
  // Column visibility props
  columns: any[]
  hiddenColumns: Set<string>
  onToggleColumn: (columnKey: string) => void
  isRequiredField: (column: any) => boolean
  
  // Status indicators props
  pendingUpdates: number
  gridMachinePendingSaves: number
  isEditing: boolean
  errors: any[]
  
  // Optional additional actions
  children?: React.ReactNode
}

export function VibeGridHeader({
  columns,
  hiddenColumns,
  onToggleColumn,
  isRequiredField,
  pendingUpdates,
  gridMachinePendingSaves,
  isEditing,
  errors,
  children
}: VibeGridHeaderProps) {
  const totalPendingUpdates = pendingUpdates + gridMachinePendingSaves
  
  return (
    <div className="vibegrid-header flex items-center justify-between p-2 border-b border-border bg-background">
      {/* Left side: Primary actions */}
      <div className="flex items-center gap-2">
        <ColumnVisibilityDropdown
          columns={columns}
          hiddenColumns={hiddenColumns}
          onToggleColumn={onToggleColumn}
          isRequiredField={isRequiredField}
        />
        {children}
      </div>
      
      {/* Right side: Status indicators */}
      <div className="flex items-center gap-2">
        {/* Pending updates indicator */}
        {totalPendingUpdates > 0 && (
          <div className="bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
            {totalPendingUpdates} pending update{totalPendingUpdates > 1 ? 's' : ''}
          </div>
        )}
        
        {/* Editing status */}
        {isEditing && (
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-medium">
            ✏️ Editing
          </div>
        )}
        
        {/* Error status */}
        {errors.length > 0 && (
          <div className="bg-red-500 text-white px-2 py-1 rounded text-xs font-medium">
            ❌ {errors.length} error{errors.length > 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  )
}