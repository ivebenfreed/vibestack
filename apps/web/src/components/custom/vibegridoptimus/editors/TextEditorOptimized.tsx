import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'

interface TextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Optimized text editor with proper blur-to-save and minimal re-renders
 * - Single render per keystroke
 * - Proper blur-to-save behavior
 * - No unnecessary state updates
 */
export function TextEditorOptimized<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: TextEditorProps<TEntity>) {
  const initialValue = row[column.key] || ''
  const [value, setValue] = React.useState(String(initialValue))
  const valueRef = React.useRef(String(initialValue)) // Track current value with ref
  const config = column.config || {}
  
  // Update ref whenever value changes
  React.useEffect(() => {
    valueRef.current = value
  }, [value])
  
  const hasChanges = value !== initialValue
  
  // Memoized commit function to prevent recreating on every render
  const commitValue = React.useCallback(async (valueToCommit: string = value) => {
    const actualHasChanges = valueToCommit !== initialValue
    
    console.log('[TextEditorOptimized] 💾 Committing value:', { 
      valueToCommit, 
      initialValue, 
      hasChanges: actualHasChanges 
    })
    
    if (!actualHasChanges) {
      console.log('[TextEditorOptimized] No changes detected, closing without save')
      onClose(false) // No changes to save
      return
    }
    
    // Update the row data
    const updatedRow = {
      ...row,
      [column.key]: valueToCommit
    } as TEntity
    
    onRowChange(updatedRow)

    // If we have an update handler, also trigger the save
    if (onUpdate) {
      try {
        await onUpdate(row.id as string, column.key as string, valueToCommit)
        console.log('[TextEditorOptimized] ✅ Save successful')
      } catch (error) {
        console.error('[TextEditorOptimized] ❌ Save failed:', error)
      }
    }
    
    onClose(true)
  }, [value, hasChanges, initialValue, row, column.key, onRowChange, onUpdate, onClose])

  // Memoized cancel function
  const cancelEdit = React.useCallback(() => {
    console.log('[TextEditorOptimized] ❌ Cancelling edit')
    onClose(false)
  }, [onClose])

  // Handle keyboard events
  const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        commitValue()
        break
      case 'Escape':
        e.preventDefault()
        cancelEdit()
        break
      case 'Tab':
        // Let React Data Grid handle tab navigation
        // but commit changes first
        if (hasChanges) {
          commitValue()
        } else {
          onClose(false)
        }
        break
    }
  }, [commitValue, cancelEdit, hasChanges, onClose])

  // Handle blur - always save current value on blur
  const handleBlur = React.useCallback(() => {
    const currentValue = valueRef.current
    const currentHasChanges = currentValue !== initialValue
    console.log('[TextEditorOptimized] 🔄 onBlur triggered:', { 
      currentValue, 
      initialValue, 
      hasChanges: currentHasChanges 
    })
    
    // Always commit the current value from the ref (most up-to-date)
    commitValue(currentValue)
  }, [initialValue, commitValue])

  // Handle input change
  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)
    valueRef.current = newValue // Update ref immediately
  }, [])

  return (
    <input
      type={config.inputType || 'text'}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={config.placeholder || 'Enter text...'}
      maxLength={config.maxLength}
      className="w-full h-full border-0 outline-0 bg-transparent text-foreground focus:bg-background text-sm px-2"
      style={{ 
        padding: '4px 8px',
        margin: '0',
        lineHeight: '1.4'
      }}
      autoFocus
    />
  )
}