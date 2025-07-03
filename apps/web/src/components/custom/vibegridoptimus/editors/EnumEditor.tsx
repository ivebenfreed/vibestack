import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { ComboboxEditor } from './ComboboxEditor'
import { useEditorBehavior } from '../hooks/useEditorBehavior'
import { EDITOR_BEHAVIORS } from '../types/editor'

interface EnumEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Professional enum editor using shadcn ComboboxEditor
 * Uses centralized behavior hook for consistent edit patterns
 */
export function EnumEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: EnumEditorProps<TEntity>) {
  const initialValue = row[column.key] || ''
  const [currentValue, setCurrentValue] = React.useState(initialValue)
  const config = column.config || {}
  const enumValues = config.enumValues || {}
  
  // Use centralized editor behavior 
  const behavior = useEditorBehavior({
    config: EDITOR_BEHAVIORS.enum,
    onCommit: (value?: any) => {
      const valueToCommit = value !== undefined ? value : currentValue
      console.log('[EnumEditor] 💾 Committing value:', valueToCommit)
      // Apply changes and close
      const updatedRow = {
        ...row,
        [column.key]: valueToCommit || null
      } as TEntity
      onRowChange(updatedRow)
      onClose(true)
    },
    onCancel: () => {
      console.log('[EnumEditor] ❌ Cancelling edit')
      onClose(false)
    },
    onUpdate,
    rowId: row.id as string,
    fieldKey: column.key as string,
    initialValue,
    currentValue
  })
  
  const handleSelect = (newValue: string) => {
    console.log('[EnumEditor] 🎯 Selected value:', newValue)
    setCurrentValue(newValue)
    
    // Update grid state immediately for live preview
    const updatedRow = {
      ...row,
      [column.key]: newValue || null
    } as TEntity
    
    onRowChange(updatedRow)
    // Use centralized immediate commit with new value
    behavior.handleCommitWithSave(newValue)
  }
  
  // Get available options from enum values
  const options = Object.entries(enumValues).map(([key, label]) => ({
    value: key,
    label: String(label)
  }))

  return (
    <ComboboxEditor
      options={options}
      currentValue={currentValue}
      onSelect={handleSelect}
      onCommit={behavior.handleCommit}
      onCancel={behavior.handleCancel}
      placeholder="Select value..."
      searchPlaceholder="Search values..."
    />
  )
}