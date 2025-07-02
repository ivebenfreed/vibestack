import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'

interface DateEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
}

/**
 * Rich date editor for renderEditCell
 * Date input with proper ISO string handling
 */
export function DateEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose
}: DateEditorProps<TEntity>) {
  const value = row[column.key]
  const config = column.config || {}
  
  // Convert value to date input format (YYYY-MM-DD)
  const getDateInputValue = (dateValue: any): string => {
    if (!dateValue) return ''
    
    try {
      const date = new Date(dateValue)
      if (isNaN(date.getTime())) return ''
      
      // Return in YYYY-MM-DD format for date input
      return date.toISOString().split('T')[0]
    } catch {
      return ''
    }
  }
  
  const handleChange = (newValue: string) => {
    let dateValue: Date | null = null
    
    if (newValue) {
      // Create date from input value (which is in YYYY-MM-DD format)
      dateValue = new Date(newValue + 'T00:00:00.000Z')
    }
    
    onRowChange({
      ...row,
      [column.key]: dateValue
    } as TEntity)
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
  
  const displayValue = getDateInputValue(value)
  
  return (
    <input
      type="date"
      value={displayValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => onClose(true)}
      onKeyDown={handleKeyDown}
      min={config.dateMin}
      max={config.dateMax}
      className="w-full h-full border-0 outline-0 px-2 bg-transparent text-foreground focus:bg-background"
      autoFocus
    />
  )
}