import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { ComboboxEditor } from './ComboboxEditor'

interface RelationshipEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Professional relationship editor using shadcn ComboboxEditor
 * Supports single relationships with search functionality
 * Maintains original badge styling through displayCellContent: true
 */
export function RelationshipEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: RelationshipEditorProps<TEntity>) {
  const config = column.config || {}
  const options = config.options || []
  const cellType = column.cellType || 'relationship-single'
  
  // Get the current value - use accessorKey for foreign key fields
  const currentKey = column.accessorKey || column.key
  const currentValue = row[currentKey] || ''
  
  const handleChange = (newValue: string) => {
    if (cellType === 'relationship-multi') {
      // For multi-relationships, manage array of selected values
      const currentArray = Array.isArray(currentValue) ? currentValue : []
      const newValueArray = currentArray.includes(newValue) 
        ? currentArray.filter(v => v !== newValue) // Remove if already selected
        : [...currentArray, newValue] // Add if not selected
      
      onRowChange({
        ...row,
        [currentKey]: newValueArray.length > 0 ? newValueArray : null
      } as TEntity)
      // Don't close immediately for multi-select - allow multiple selections
    } else {
      // For single relationships, replace the value
      onRowChange({
        ...row,
        [currentKey]: newValue || null
      } as TEntity)
      onClose(true) // Close immediately after single selection
    }
  }
  
  const handleCancel = () => {
    onClose(false)
  }
  
  // Get appropriate placeholder based on relationship type and current state
  const getPlaceholder = () => {
    if (currentValue) {
      // If we have a value, show appropriate text for changing
      switch (cellType) {
        case 'relationship-single':
          return 'Change owner...'
        case 'relationship-multi':
          return 'Add member...'
        case 'relationship-collection':
          return 'Browse items...'
        default:
          return 'Select option...'
      }
    } else {
      // If no value, show appropriate text for adding
      switch (cellType) {
        case 'relationship-single':
          return 'Select owner...'
        case 'relationship-multi':
          return 'Select members...'
        case 'relationship-collection':
          return 'Browse collection...'
        default:
          return 'Select option...'
      }
    }
  }

  // For multi-select, we need to pass the array to ComboboxEditor
  const multiSelectValue = cellType === 'relationship-multi' && Array.isArray(currentValue) 
    ? currentValue 
    : currentValue

  return (
    <ComboboxEditor
      options={options}
      currentValue={multiSelectValue}
      onSelect={handleChange}
      onCancel={handleCancel}
      placeholder={getPlaceholder()}
      searchPlaceholder="Search options..."
      isMultiSelect={cellType === 'relationship-multi'}
    />
  )
}