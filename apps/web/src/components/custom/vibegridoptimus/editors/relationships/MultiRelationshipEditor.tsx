import React from 'react'
import { X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BaseEntity, OptimusColumn } from '../../types'
import { CSS_CLASSES } from '../../utils/constants'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useEditorBehavior } from '../../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../../types/editor'

interface MultiRelationshipEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Dedicated editor for multi-relationship fields (many-to-many)
 * Uses transparent overlay pattern like SingleRelationshipEditor
 * Shows professional tagging interface in popover while preserving original badge display
 * Uses centralized behavior hook for consistent edit patterns
 */
export function MultiRelationshipEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: MultiRelationshipEditorProps<TEntity>) {
  const config = column.config || {}
  const options = config.options || []
  
  // Get the current value - use accessorKey for foreign key fields
  const currentKey = column.accessorKey || column.key
  const initialValue = row[currentKey] || []
  
  // Handle both array of IDs and array of objects for initial state
  const getInitialSelectedValues = (value: any[]): string[] => {
    if (!Array.isArray(value)) return []
    return value.map(item => {
      if (typeof item === 'string') {
        return item
      } else if (typeof item === 'object' && item?.id) {
        return item.id
      }
      return String(item)
    })
  }
  
  const [selectedValues, setSelectedValues] = React.useState<string[]>(
    getInitialSelectedValues(initialValue)
  )
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.multiRelationship,
    onCommit: () => {
      // Apply final changes and close
      onRowChange({
        ...row,
        [currentKey]: selectedValues.length > 0 ? selectedValues : null
      } as TEntity)
      onClose(true)
    },
    onCancel: () => onClose(false),
    initialValue: getInitialSelectedValues(initialValue),
    currentValue: selectedValues
  })
  
  const [searchValue, setSearchValue] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  // Auto-open popover after mount (like ComboboxEditor)
  React.useEffect(() => {
    setOpen(true)
  }, [])
  
  // Filter ALL options based on search (include both selected and unselected)
  const filteredOptions = options.filter(option => 
    searchValue === '' || option.label.toLowerCase().includes(searchValue.toLowerCase())
  )
  
  // Get selected items for badge display
  const selectedItems = options.filter(option => selectedValues.includes(option.value))
  
  const handleToggleItem = (value: string) => {
    let newValues: string[]
    if (selectedValues.includes(value)) {
      // Remove if already selected
      newValues = selectedValues.filter(v => v !== value)
    } else {
      // Add if not selected
      newValues = [...selectedValues, value]
    }
    
    setSelectedValues(newValues)
    behavior.markChanged()
    
    // For multi-relationship with allowPartialCommits, update row incrementally
    if (EDITOR_BEHAVIORS.multiRelationship.allowPartialCommits) {
      onRowChange({
        ...row,
        [currentKey]: newValues.length > 0 ? newValues : null
      } as TEntity)
    }
    
    setSearchValue('')
    inputRef.current?.focus()
  }
  
  const handleRemoveItem = (value: string) => {
    const newValues = selectedValues.filter(v => v !== value)
    setSelectedValues(newValues)
    behavior.markChanged()
    
    // For multi-relationship with allowPartialCommits, update row incrementally
    if (EDITOR_BEHAVIORS.multiRelationship.allowPartialCommits) {
      onRowChange({
        ...row,
        [currentKey]: newValues.length > 0 ? newValues : null
      } as TEntity)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle centralized key behaviors first
    if (['Enter', 'Escape', 'Tab'].includes(e.key)) {
      behavior.handleKeyDown(e)
      setOpen(false)
      return
    }
    
    // Handle multi-select specific keys
    if (e.key === 'Backspace' && searchValue === '' && selectedValues.length > 0) {
      e.preventDefault()
      handleRemoveItem(selectedValues[selectedValues.length - 1])
    }
  }

  return (
    <div className={cn("absolute inset-0 z-50")}>
      <Popover 
        open={open} 
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            behavior.handleCommit() // Use centralized commit logic
          }
        }}
      >
        <PopoverTrigger asChild>
          <div 
            className="w-full h-full cursor-pointer bg-transparent border-0 outline-0 opacity-0"
            tabIndex={0}
            autoFocus
          />
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="start" side="bottom">
          {/* Search input */}
          <div className="mb-3">
            <input
              ref={inputRef}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search members..."
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
          </div>
          
          {/* Currently selected items */}
          <div className="mb-3">
            <div className="text-xs text-muted-foreground mb-2">
              Currently selected ({selectedItems.length})
            </div>
            <div className="flex flex-wrap gap-1 min-h-[28px]">
              {selectedItems.length > 0 ? (
                selectedItems.map(item => (
                  <span 
                    key={item.value}
                    className={cn(
                      CSS_CLASSES.badge,
                      CSS_CLASSES.primaryBadge,
                      "flex items-center gap-1 pr-1"
                    )}
                  >
                    {item.label}
                    <X 
                      className="h-3 w-3 cursor-pointer hover:text-destructive transition-colors" 
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveItem(item.value)
                      }}
                    />
                  </span>
                ))
              ) : (
                <span className="text-xs text-muted-foreground italic">No members selected</span>
              )}
            </div>
          </div>
          
          {/* Options list - showing all with selection state */}
          {filteredOptions.length > 0 && (
            <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
              {filteredOptions.map(option => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <div
                    key={option.value}
                    className={cn(
                      "px-3 py-2 text-sm cursor-pointer hover:bg-accent transition-colors flex items-center gap-2",
                      isSelected && "bg-accent/50"
                    )}
                    onClick={() => handleToggleItem(option.value)}
                  >
                    <Check 
                      className={cn(
                        "h-4 w-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span>{option.label}</span>
                  </div>
                )
              })}
            </div>
          )}
          
          {/* Empty state when searching with no results */}
          {searchValue && filteredOptions.length === 0 && (
            <div className="text-sm text-muted-foreground px-3 py-2 text-center">
              No results found for "{searchValue}"
            </div>
          )}
          
          {/* Help text */}
          <div className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border">
            Type to search • Enter to toggle • Backspace to remove last • Escape to close
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}