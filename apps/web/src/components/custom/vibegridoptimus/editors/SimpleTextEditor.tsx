import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import type { GridMachineAPI } from '../types/gridTypes'

interface SimpleTextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
  gridMachine?: GridMachineAPI
}

/**
 * Grid machine-aware text editor with optimistic updates
 */
export function SimpleTextEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate,
  gridMachine
}: SimpleTextEditorProps<TEntity>) {
  const cellId = String(row.id)
  const columnKey = String(column.key)
  const config = column.config || {}
  
  // Get cell state from grid machine
  const cellState = gridMachine?.getCellState(cellId, columnKey)
  
  // Use grid machine state or fallback to row value
  const initialValue = cellState?.displayValue ?? String(row[column.key] || '')
  const [value, setValue] = React.useState(initialValue)
  
  // Update local state during typing and notify grid machine
  const handleChange = React.useCallback((newValue: string) => {
    setValue(newValue)
    
    // Notify grid machine of value change
    if (cellState?.actions) {
      cellState.actions.changeValue(newValue)
    }
  }, [cellState])
  
  // Grid machine-aware commit
  const handleCommit = React.useCallback(async () => {
    console.log('[SimpleTextEditor] 🚀 Committing:', value)
    
    // Update grid immediately for react-data-grid
    const updatedRow = {
      ...row,
      [column.key]: value
    } as TEntity
    onRowChange(updatedRow)
    
    // Commit through grid machine if available
    if (cellState?.actions) {
      cellState.actions.commitEdit(value)
    } else if (onUpdate) {
      // Fallback to direct save
      try {
        await onUpdate(row.id as string, column.key as string, value)
        console.log('[SimpleTextEditor] ✅ Save successful')
      } catch (error) {
        console.error('[SimpleTextEditor] ❌ Save failed:', error)
      }
    }
    
    // Close editor
    onClose(true)
  }, [value, row, column.key, onRowChange, onUpdate, onClose, cellState])
  
  const handleCancel = React.useCallback(() => {
    console.log('[SimpleTextEditor] ❌ Cancelling')
    
    // Cancel through grid machine if available
    if (cellState?.actions) {
      cellState.actions.cancelEdit()
    }
    
    onClose(false)
  }, [onClose, cellState])
  

  return (
    <input
      type={config.inputType || 'text'}
      value={value}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        console.log('[SimpleTextEditor] 🔥 BLUR event triggered with value:', value)
        handleCommit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          console.log('[SimpleTextEditor] ⚡ ENTER pressed with value:', value)
          handleCommit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          console.log('[SimpleTextEditor] ❌ ESCAPE pressed')
          handleCancel()
        }
      }}
      placeholder={config.placeholder || 'Enter text...'}
      maxLength={config.maxLength}
      className="w-full h-full border-0 outline-0 bg-transparent text-foreground focus:bg-background text-sm px-2"
      autoFocus
    />
  )
}