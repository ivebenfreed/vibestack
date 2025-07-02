import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface BooleanEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Rich boolean editor for renderEditCell
 * Uses centralized behavior hook for consistent edit patterns
 */
export function BooleanEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: BooleanEditorProps<TEntity>) {
  const initialValue = Boolean(row[column.key])
  const [currentValue, setCurrentValue] = React.useState(initialValue)
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.boolean,
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
  
  // Toggle immediately when editor opens
  React.useEffect(() => {
    const newValue = !initialValue
    setCurrentValue(newValue)
    // For boolean with immediate commit, update row immediately
    onRowChange({
      ...row,
      [column.key]: newValue
    } as TEntity)
    
    // Close immediately after toggle with delay
    setTimeout(() => behavior.handleCommit(), 50)
  }, [])
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <input
        type="checkbox"
        checked={currentValue}
        onChange={() => {}} // No-op, already handled in useEffect
        onKeyDown={behavior.handleKeyDown}
        className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
        autoFocus
      />
    </div>
  )
}