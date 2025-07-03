import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface TextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Rich text editor for renderEditCell
 * Uses centralized behavior hook for consistent edit patterns
 */
export function TextEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: TextEditorProps<TEntity>) {
  console.log('[TextEditor] Editor created with initial value:', row[column.key])
  const initialValue = row[column.key] || ''
  const [currentValue, setCurrentValue] = React.useState(String(initialValue))
  const config = column.config || {}
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.text,
    onCommit: (value?: any) => {
      const valueToCommit = value !== undefined ? value : currentValue
      console.log('[TextEditor] 💾 Committing value:', valueToCommit)
      // Apply changes and close
      const updatedRow = {
        ...row,
        [column.key]: valueToCommit
      } as TEntity
      onRowChange(updatedRow)
      onClose(true)
    },
    onCancel: () => {
      console.log('[TextEditor] ❌ Cancelling edit')
      onClose(false)
    },
    onUpdate,
    rowId: row.id as string,
    fieldKey: column.key as string,
    initialValue,
    currentValue
  })
  
  const handleChange = (newValue: string) => {
    setCurrentValue(newValue)
    // Don't update row on every keystroke - only on commit
    // This prevents excessive re-renders
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key specifically for immediate commit
    if (e.key === 'Enter') {
      e.preventDefault()
      // Trigger immediate commit if onUpdate is available
      if (onUpdate) {
        behavior.handleCommitWithSave(currentValue)
      } else {
        behavior.handleKeyDown(e)
      }
      return
    }
    
    // Handle other keys with centralized behavior
    behavior.handleKeyDown(e)
  }
  
  return (
    <input
      type={config.inputType || 'text'}
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        console.log('[TextEditor] 🔄 onBlur triggered with value:', currentValue)
        if (onUpdate) {
          behavior.handleCommitWithSave(currentValue)
        } else {
          behavior.handleBlur()
        }
      }}
      onKeyDown={handleKeyDown}
      placeholder={config.placeholder || 'Enter text...'}
      maxLength={config.maxLength}
      className="w-full h-full border-0 outline-0 bg-transparent text-foreground focus:bg-background text-sm"
      style={{ 
        padding: '0',
        margin: '0',
        lineHeight: '1.4'
      }}
      autoFocus
    />
  )
}