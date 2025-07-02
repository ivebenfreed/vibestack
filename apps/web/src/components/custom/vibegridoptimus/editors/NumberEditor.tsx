import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'

interface NumberEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Rich number editor for renderEditCell
 * Handles number validation and formatting
 */
export function NumberEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: NumberEditorProps<TEntity>) {
  const value = row[column.key] || ''
  const config = column.config || {}
  
  const handleChange = (newValue: string) => {
    // Allow empty string or valid number inputs
    if (newValue === '' || !isNaN(Number(newValue))) {
      const numericValue = newValue === '' ? null : Number(newValue)
      onRowChange({
        ...row,
        [column.key]: numericValue
      } as TEntity)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onClose(true)
    } else if (e.key === 'Escape') {
      onClose(false)
    } else if (e.key === 'Tab') {
      onClose(true)
    }
  }
  
  // Convert value for display (handle null/undefined)
  const displayValue = value === null || value === undefined ? '' : String(value)
  
  return (
    <input
      type="number"
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => onClose(true)}
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