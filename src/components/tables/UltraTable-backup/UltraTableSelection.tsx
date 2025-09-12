/**
 * Ultra-Lightweight Table Selection Overlay
 * 
 * Floating selection toolbar with bulk actions:
 * - Appears when rows are selected
 * - Positioned absolutely to avoid table re-renders
 * - Provides bulk operations (select all, delete, etc.)
 * - Animated appearance/disappearance
 */

import React, { useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckSquare, 
  X, 
  Trash2, 
  Download, 
  Copy,
  MoreHorizontal 
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface UltraTableSelectionProps {
  /** Number of selected rows */
  selectedCount: number
  /** Total number of visible rows */
  totalCount: number
  /** Select all visible rows */
  onSelectAll: () => void
  /** Clear all selections */
  onClearSelection: () => void
  /** Delete selected rows */
  onDeleteSelected?: () => void
  /** Export selected rows */
  onExportSelected?: () => void
  /** Copy selected rows */
  onCopySelected?: () => void
  /** Custom actions */
  customActions?: Array<{
    label: string
    icon?: React.ComponentType<{ className?: string }>
    onClick: () => void
    variant?: 'default' | 'destructive' | 'secondary'
  }>
}

/**
 * Floating selection toolbar
 * 
 * Performance optimizations:
 * - Only renders when selections exist
 * - Positioned absolutely (no layout impact)
 * - Memoized action handlers
 * - CSS animations for smooth UX
 */
export function UltraTableSelection({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onExportSelected,
  onCopySelected,
  customActions = []
}: UltraTableSelectionProps) {
  // Don't render if no selections
  if (selectedCount === 0) return null

  const isAllSelected = selectedCount === totalCount
  const selectionText = selectedCount === totalCount 
    ? `All ${totalCount} selected`
    : `${selectedCount} of ${totalCount} selected`

  const handleToggleSelectAll = useCallback(() => {
    if (isAllSelected) {
      onClearSelection()
    } else {
      onSelectAll()
    }
  }, [isAllSelected, onSelectAll, onClearSelection])

  return (
    <div className={cn(
      'fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50',
      'bg-background/95 backdrop-blur-sm border border-border/50 rounded-lg shadow-lg',
      'px-4 py-3 flex items-center gap-3',
      'animate-in slide-in-from-bottom-2 duration-200'
    )}>
      {/* Selection count */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs">
          {selectionText}
        </Badge>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Select all toggle */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleToggleSelectAll}
        className="h-8 px-2"
      >
        <CheckSquare className={cn(
          "h-4 w-4 mr-1",
          isAllSelected && "text-primary"
        )} />
        {isAllSelected ? 'Deselect All' : 'Select All'}
      </Button>

      {/* Bulk actions */}
      <div className="flex items-center gap-1">
        {/* Copy action */}
        {onCopySelected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCopySelected}
            className="h-8 px-2"
            title="Copy selected rows"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}

        {/* Export action */}
        {onExportSelected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onExportSelected}
            className="h-8 px-2"
            title="Export selected rows"
          >
            <Download className="h-4 w-4" />
          </Button>
        )}

        {/* Delete action */}
        {onDeleteSelected && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDeleteSelected}
            className="h-8 px-2 text-destructive hover:text-destructive"
            title="Delete selected rows"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}

        {/* Custom actions dropdown */}
        {customActions.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {customActions.map((action, index) => {
                const Icon = action.icon
                return (
                  <DropdownMenuItem
                    key={index}
                    onClick={action.onClick}
                    className={cn(
                      action.variant === 'destructive' && 'text-destructive focus:text-destructive'
                    )}
                  >
                    {Icon && <Icon className="h-4 w-4 mr-2" />}
                    {action.label}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-border" />

      {/* Clear selection */}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        className="h-8 px-2"
        title="Clear selection"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

/**
 * Selection indicator overlay for individual rows
 * This would be used if we need to show selection state
 * without affecting the table cell rendering
 */
export function UltraTableRowIndicator({ 
  isSelected, 
  rowIndex 
}: { 
  isSelected: boolean
  rowIndex: number 
}) {
  if (!isSelected) return null

  return (
    <div 
      className={cn(
        'absolute left-0 top-0 bottom-0 w-1 bg-primary',
        'animate-in slide-in-from-left duration-150'
      )}
      data-row-indicator={rowIndex}
    />
  )
}

/**
 * Keyboard shortcuts helper for table selection
 */
export function useTableSelectionShortcuts({
  onSelectAll,
  onClearSelection,
  onDeleteSelected,
  onCopySelected
}: {
  onSelectAll: () => void
  onClearSelection: () => void
  onDeleteSelected?: () => void
  onCopySelected?: () => void
}) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if focus is within the table
      const target = e.target as HTMLElement
      if (!target.closest('[role="grid"]')) return

      // Ctrl/Cmd + A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        onSelectAll()
        return
      }

      // Escape - Clear selection
      if (e.key === 'Escape') {
        onClearSelection()
        return
      }

      // Delete - Delete selected (if enabled)
      if (e.key === 'Delete' && onDeleteSelected) {
        onDeleteSelected()
        return
      }

      // Ctrl/Cmd + C - Copy selected (if enabled)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && onCopySelected) {
        e.preventDefault()
        onCopySelected()
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onSelectAll, onClearSelection, onDeleteSelected, onCopySelected])
}