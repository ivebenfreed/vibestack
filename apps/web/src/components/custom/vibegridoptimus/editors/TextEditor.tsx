import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface TextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Rich text editor for renderEditCell
 * Uses centralized behavior hook for consistent edit patterns
 */
export function TextEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: TextEditorProps<TEntity>) {
  const initialValue = row[column.key] || ''
  const [currentValue, setCurrentValue] = React.useState(String(initialValue))
  const config = column.config || {}
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.text,
    onCommit: () => {
      // Apply changes and close
      onRowChange({
        ...row,
        [column.key]: currentValue
      } as TEntity)
      onClose(true)
    },
    onCancel: () => onClose(false),
    initialValue,
    currentValue
  })
  
  const handleChange = (newValue: string) => {
    setCurrentValue(newValue)
    // For text inputs, we update the row immediately for live feedback
    onRowChange({
      ...row,
      [column.key]: newValue
    } as TEntity)
  }
  
  return (
    <input
      type={config.inputType || 'text'}
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={behavior.handleBlur}
      onKeyDown={behavior.handleKeyDown}
      placeholder={config.placeholder || 'Enter text...'}
      maxLength={config.maxLength}
      className="w-full h-full border-0 outline-0 px-2 bg-transparent text-foreground focus:bg-background"
      autoFocus
    />
  )
}