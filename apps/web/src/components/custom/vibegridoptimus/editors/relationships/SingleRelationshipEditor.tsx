import React from 'react'
import type { BaseEntity, OptimusColumn } from '../../types'
import { ComboboxEditor } from '../ComboboxEditor'
import { useEditorBehavior } from '../../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../../types/editor'

interface SingleRelationshipEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, changes: Record<string, any>) => Promise<void>
}

/**
 * Dedicated editor for single relationship fields (many-to-one, one-to-one)
 * Uses ComboboxEditor for professional dropdown with search functionality
 * Uses centralized behavior hook for consistent edit patterns
 */
export function SingleRelationshipEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: SingleRelationshipEditorProps<TEntity>) {
  const config = column.config || {}
  const options = config.options || []
  
  // Get the current value - use accessorKey for foreign key fields
  const currentKey = column.accessorKey || column.key
  const initialValue = row[currentKey] || ''
  const [currentValue, setCurrentValue] = React.useState(initialValue)
  
  // Use centralized editor behavior
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.singleRelationship,
    onCommit: (value?: any) => {
      const valueToCommit = value !== undefined ? value : currentValue
      console.log('[SingleRelationshipEditor] 💾 Committing value:', valueToCommit)
      // Apply changes and close
      const updatedRow = {
        ...row,
        [currentKey]: valueToCommit || null
      } as TEntity
      onRowChange(updatedRow)
      onClose(true)
    },
    onCancel: () => {
      console.log('[SingleRelationshipEditor] ❌ Cancelling edit')
      onClose(false)
    },
    onUpdate,
    rowId: row.id as string,
    fieldKey: currentKey as string,
    initialValue,
    currentValue
  })
  
  const handleSelect = (newValue: string) => {
    console.log('[SingleRelationshipEditor] 🎯 Selected value:', newValue)
    setCurrentValue(newValue)
    
    // For immediate commit mode, let persistence handle the update
    // Don't call onRowChange as it can conflict with atom-based state
    behavior.handleImmediateCommit(newValue)
  }
  
  // Get appropriate placeholder
  const placeholder = currentValue ? 'Change owner...' : 'Select owner...'

  return (
    <ComboboxEditor
      options={options}
      currentValue={currentValue}
      onSelect={handleSelect}
      onCommit={behavior.handleCommit}
      onCancel={behavior.handleCancel}
      placeholder={placeholder}
      searchPlaceholder="Search options..."
    />
  )
}