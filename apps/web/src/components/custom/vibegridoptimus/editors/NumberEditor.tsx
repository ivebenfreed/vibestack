import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface NumberEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Rich number editor for renderEditCell
 * Handles number validation and formatting
 */
export function NumberEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: NumberEditorProps<TEntity>) {
  const initialValue = row[column.key] || ''
  const [currentValue, setCurrentValue] = React.useState(initialValue === null || initialValue === undefined ? '' : String(initialValue))
  const config = column.config || {}
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.number,
    onCommit: (value?: any) => {
      const valueToCommit = value !== undefined ? value : (currentValue === '' ? null : Number(currentValue))
      console.log('[NumberEditor] 💾 Committing value:', valueToCommit)
      // Apply changes and close
      const updatedRow = {
        ...row,
        [column.key]: valueToCommit
      } as TEntity
      onRowChange(updatedRow)
      onClose(true)
    },
    onCancel: () => {
      console.log('[NumberEditor] ❌ Cancelling edit')
      onClose(false)
    },
    onUpdate,
    rowId: row.id as string,
    fieldKey: column.key as string,
    initialValue,
    currentValue: currentValue === '' ? null : Number(currentValue)
  })
  
  const handleChange = (newValue: string) => {
    // Allow empty string or valid number inputs
    if (newValue === '' || !isNaN(Number(newValue))) {
      setCurrentValue(newValue)
      // For number inputs, we update the row immediately for live feedback
      const numericValue = newValue === '' ? null : Number(newValue)
      onRowChange({
        ...row,
        [column.key]: numericValue
      } as TEntity)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle Enter key specifically for immediate commit
    if (e.key === 'Enter') {
      e.preventDefault()
      // Trigger immediate commit if onUpdate is available
      const numericValue = currentValue === '' ? null : Number(currentValue)
      if (onUpdate) {
        behavior.handleCommitWithSave(numericValue)
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
      type="number"
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        const numericValue = currentValue === '' ? null : Number(currentValue)
        if (onUpdate) {
          behavior.handleCommitWithSave(numericValue)
        } else {
          behavior.handleBlur()
        }
      }}
      onKeyDown={handleKeyDown}
      placeholder={config.placeholder || 'Enter number...'}
      min={config.numberMin}
      max={config.numberMax}
      step={config.step || 'any'}
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