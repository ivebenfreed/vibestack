import React, { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrashIcon, Cross2Icon } from '@radix-ui/react-icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export interface BulkActionConfig<T = any> {
  id: string
  label: string
  icon?: React.ReactNode
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  action: (selectedEntities: T[], selectedIds: string[]) => Promise<void> | void
  disabled?: (selectedEntities: T[]) => boolean
  confirmTitle?: string
  confirmDescription?: string
}

export interface EntityTableBulkActionsProps<T> {
  entityType: string
  selectedIds: string[]
  selectedEntities: T[]
  onBulkDelete?: () => Promise<void> | void
  onClearSelection: () => void
  customActions?: BulkActionConfig<T>[]
  isLoading?: boolean
}

/**
 * Entity Table Bulk Actions
 * 
 * Performance optimized bulk actions bar with:
 * - ✅ Memoized action configurations to prevent recreation
 * - ✅ Minimal re-renders using stable references
 * - ✅ Custom actions support with confirmation dialogs
 * - ✅ Built-in delete action with confirmation
 */
export function EntityTableBulkActions<T>({
  entityType,
  selectedIds,
  selectedEntities,
  onBulkDelete,
  onClearSelection,
  customActions = [],
  isLoading = false,
}: EntityTableBulkActionsProps<T>) {
  const selectedCount = selectedIds.length

  // ✅ Don't render anything if no selection
  if (selectedCount === 0) {
    return null
  }

  // ✅ Memoize filtered custom actions to prevent recreation
  const availableCustomActions = useMemo(() => {
    return customActions.filter(action => 
      !action.disabled || !action.disabled(selectedEntities)
    )
  }, [customActions, selectedEntities])

  // ✅ Memoized bulk delete action with confirmation
  const BulkDeleteAction = useMemo(() => {
    if (!onBulkDelete) return null

    return (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="destructive"
            size="sm"
            disabled={isLoading}
            className="h-8"
          >
            <TrashIcon className="mr-2 h-4 w-4" />
            Delete ({selectedCount})
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {entityType}s</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedCount} {entityType}{selectedCount > 1 ? 's' : ''}? 
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={onBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete {selectedCount} {entityType}{selectedCount > 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
  }, [onBulkDelete, selectedCount, entityType, isLoading])

  // ✅ Memoized custom action renderers
  const CustomActionRenderers = useMemo(() => {
    return availableCustomActions.map(action => {
      const ActionButton = (
        <Button
          key={action.id}
          variant={action.variant || 'outline'}
          size="sm"
          disabled={isLoading}
          className="h-8"
          onClick={() => action.action(selectedEntities, selectedIds)}
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </Button>
      )

      // Wrap with confirmation dialog if specified
      if (action.confirmTitle || action.confirmDescription) {
        return (
          <AlertDialog key={action.id}>
            <AlertDialogTrigger asChild>
              {ActionButton}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {action.confirmTitle || `Confirm ${action.label}`}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {action.confirmDescription || `Are you sure you want to ${action.label.toLowerCase()} ${selectedCount} ${entityType}${selectedCount > 1 ? 's' : ''}?`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => action.action(selectedEntities, selectedIds)}>
                  {action.label}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      }

      return ActionButton
    })
  }, [availableCustomActions, selectedEntities, selectedIds, selectedCount, entityType, isLoading])

  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 border rounded-md">
      <div className="flex items-center space-x-2">
        <Badge variant="secondary" className="font-medium">
          {selectedCount} selected
        </Badge>
        <span className="text-sm text-muted-foreground">
          {selectedCount} {entityType}{selectedCount > 1 ? 's' : ''} selected
        </span>
      </div>

      <div className="flex items-center space-x-2">
        {/* Custom Actions */}
        {CustomActionRenderers}
        
        {/* Built-in Delete Action */}
        {BulkDeleteAction}

        {/* Clear Selection */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={isLoading}
          className="h-8 w-8 p-0"
        >
          <Cross2Icon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
} 