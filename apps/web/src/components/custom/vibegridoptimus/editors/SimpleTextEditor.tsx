import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'

interface SimpleTextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * Dead simple text editor - no complex hooks, just basic input behavior
 */
export function SimpleTextEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate
}: SimpleTextEditorProps<TEntity>) {
  const initialValue = String(row[column.key] || '')
  const [value, setValue] = React.useState(initialValue)
  const config = column.config || {}
  
  // Update row data on every change to keep RDG in sync
  const handleChange = React.useCallback((newValue: string) => {
    setValue(newValue)
    
    // Update the row data immediately (like enum editor does)
    const updatedRow = {
      ...row,
      [column.key]: newValue
    } as TEntity
    onRowChange(updatedRow)
  }, [row, column.key, onRowChange])
  
  const commitAndClose = React.useCallback(async () => {
    console.log('[SimpleTextEditor] Committing and closing with value:', value)
    
    // Trigger save handler if available
    if (onUpdate) {
      await onUpdate(row.id as string, column.key as string, value)
    }
    
    // Close the editor with commit
    onClose(true)
  }, [value, row, column.key, onUpdate, onClose])
  
  const cancel = React.useCallback(() => {
    onClose(false)
  }, [onClose])

  return (
    <input
      type={config.inputType || 'text'}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        console.log('[SimpleTextEditor] BLUR event triggered!')
        commitAndClose()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commitAndClose()
        } else if (e.key === 'Escape') {
          cancel()
        }
      }}
      placeholder={config.placeholder || 'Enter text...'}
      maxLength={config.maxLength}
      className="w-full h-full border-0 outline-0 bg-transparent text-foreground focus:bg-background text-sm px-2"
      autoFocus
    />
  )
}