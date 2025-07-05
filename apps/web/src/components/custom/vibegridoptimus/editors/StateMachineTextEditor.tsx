import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import { useGridCellState } from '../machines/gridCellStateMachine'

interface StateMachineTextEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
  cellMachine?: any // Will be passed from CellRenderer
}

/**
 * State machine-powered text editor that eliminates flash issues
 * Uses XState machine to manage transitions between editing, optimistic, and persisted states
 */
export function StateMachineTextEditor<TEntity extends BaseEntity>({
  row,
  column,
  onRowChange,
  onClose,
  onUpdate,
  cellMachine
}: StateMachineTextEditorProps<TEntity>) {
  const config = column.config || {}
  
  // Get current editing value from state machine
  const editingValue = cellMachine?.state.context.editingValue ?? String(row[column.key] || '')
  
  // Handle text changes - update machine state only
  const handleChange = React.useCallback((newValue: string) => {
    cellMachine?.actions.changeValue(newValue)
  }, [cellMachine])
  
  // Handle commit - trigger state machine transition
  const handleCommit = React.useCallback(() => {
    const valueToCommit = editingValue
    console.log('[StateMachineTextEditor] 🚀 Committing via state machine:', valueToCommit)
    
    // Update grid row immediately (for react-data-grid)
    const updatedRow = {
      ...row,
      [column.key]: valueToCommit
    } as TEntity
    onRowChange(updatedRow)
    
    // Trigger state machine commit (this will handle save and optimistic display)
    cellMachine?.actions.commitEdit(valueToCommit)
    
    // Close editor
    onClose(true)
  }, [editingValue, row, column.key, onRowChange, cellMachine, onClose])
  
  const handleCancel = React.useCallback(() => {
    console.log('[StateMachineTextEditor] ❌ Cancelling via state machine')
    cellMachine?.actions.cancelEdit()
    onClose(false)
  }, [cellMachine, onClose])

  return (
    <input
      type={config.inputType || 'text'}
      value={editingValue}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={() => {
        console.log('[StateMachineTextEditor] 🔥 BLUR event - committing')
        handleCommit()
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          console.log('[StateMachineTextEditor] ⚡ ENTER pressed - committing')
          handleCommit()
        } else if (e.key === 'Escape') {
          e.preventDefault()
          console.log('[StateMachineTextEditor] ❌ ESCAPE pressed - cancelling')
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