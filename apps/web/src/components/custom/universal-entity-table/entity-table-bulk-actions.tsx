import React from 'react'
import { ObjectLiteral } from 'typeorm'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface BulkActionConfig<T extends ObjectLiteral> {
  id: string
  label: string
  icon?: React.ComponentType<any>
  action: (selectedIds: string[], entities: T[]) => Promise<void>
  variant?: 'default' | 'destructive' | 'outline'
  confirmMessage?: string
}

interface EntityTableBulkActionsProps<T extends ObjectLiteral = any> {
  entityType: string
  selectedIds: string[]
  selectedEntities: T[]
  onBulkDelete?: () => Promise<void>
  onClearSelection: () => void
  customActions?: BulkActionConfig<T>[]
  isLoading?: boolean
}

export function EntityTableBulkActions<T extends ObjectLiteral>({
  entityType,
  selectedIds,
  selectedEntities,
  onBulkDelete,
  onClearSelection,
  customActions = [],
  isLoading = false,
}: EntityTableBulkActionsProps<T>) {
  const selectedCount = selectedIds.length

  if (selectedCount === 0) {
    return null
  }

  const handleCustomAction = async (action: BulkActionConfig<T>) => {
    if (action.confirmMessage) {
      const confirmed = window.confirm(action.confirmMessage)
      if (!confirmed) return
    }

    try {
      await action.action(selectedIds, selectedEntities)
    } catch (error) {
      console.error(`Error executing bulk action ${action.id}:`, error)
    }
  }

  return (
    <div 
      className={cn(
        "transition-all duration-200 ease-in-out overflow-hidden",
        selectedCount > 0 
          ? "max-h-20 opacity-100 mb-4" 
          : "max-h-0 opacity-0 mb-0"
      )}
    >
      <div className="flex items-center px-4 py-3 bg-muted/50 border rounded-lg">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium">
            {selectedCount} {entityType}{selectedCount > 1 ? 's' : ''} selected
          </span>
          
          {/* Default Delete Action */}
          {onBulkDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={onBulkDelete}
              disabled={isLoading}
              className="h-8"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
          
          {/* Custom Bulk Actions */}
          {customActions.map((action) => (
            <Button
              key={action.id}
              variant={action.variant || 'default'}
              size="sm"
              onClick={() => handleCustomAction(action)}
              disabled={isLoading}
              className="h-8"
            >
              {action.icon && <action.icon className="mr-2 h-4 w-4" />}
              {action.label}
            </Button>
          ))}
          
          {/* Clear Selection Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            disabled={isLoading}
            className="h-8"
          >
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  )
} 