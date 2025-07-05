import React from 'react'
import type { BaseEntity, CellRendererProps } from '../types'
import { useGridCellState } from '../machines/gridCellStateMachine'
import { TextRenderer } from './TextRenderer'
import { NumberRenderer } from './NumberRenderer'
import { EnumRenderer } from './EnumRenderer'
import { RelationshipRenderer } from './RelationshipRenderer'
import { DateRenderer } from './DateRenderer'
import { BooleanRenderer } from './BooleanRenderer'
import { CSS_CLASSES } from '../utils/constants'

interface StateMachineCellRendererProps<TEntity extends BaseEntity> extends CellRendererProps<TEntity> {
  onSave?: (id: string, column: string, value: any) => Promise<void>
}

/**
 * State machine-powered cell renderer that eliminates flash issues
 * Uses XState machine to manage optimistic display values during edit transitions
 */
export function StateMachineCellRenderer<TEntity extends BaseEntity>(
  props: StateMachineCellRendererProps<TEntity>
): React.ReactNode {
  const { row, column, value: atomValue, rowIndex, onContentClick, onSave } = props
  const { cellType, config, systemField } = column
  
  // Initialize state machine for this cell
  const cellId = String(row.id)
  const columnKey = String(column.key)
  
  const {
    displayValue,
    isEditing,
    isCommitting,
    isPersisting,
    hasError,
    error,
    actions
  } = useGridCellState(cellId, columnKey, atomValue, onSave)
  
  // System fields are read-only
  if (systemField) {
    return (
      <div className={CSS_CLASSES.systemCell}>
        {renderSystemField(displayValue, cellType, config)}
      </div>
    )
  }

  // Show loading indicator during save operations
  const isLoading = isCommitting || isPersisting
  
  // Show error state if save failed
  if (hasError && error) {
    return (
      <div className={`${CSS_CLASSES.cell} border-red-200 bg-red-50`} title={`Save failed: ${error}`}>
        <span className="text-red-600 text-xs">
          ❌ {renderCellValue(displayValue, cellType, config)}
        </span>
      </div>
    )
  }

  // Create content click handler
  const handleContentClick = React.useCallback((event: React.MouseEvent) => {
    if (onContentClick && column.config?.editable && !isLoading) {
      // Start editing through state machine
      actions.startEdit()
      onContentClick(rowIndex, columnKey, event)
    }
  }, [onContentClick, rowIndex, columnKey, column.config?.editable, isLoading, actions])

  // Show optimistic/loading state during saves
  const cellClassName = `${CSS_CLASSES.cell} ${isLoading ? 'opacity-75 bg-blue-50' : ''} ${isEditing ? 'ring-2 ring-blue-300' : ''}`

  // Switch based on cell type for business data
  switch (cellType) {
    case 'text':
      return (
        <div className={cellClassName}>
          <TextRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    case 'number':
      return (
        <div className={cellClassName}>
          <NumberRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    case 'enum':
      return (
        <div className={cellClassName}>
          <EnumRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    case 'relationship-single':
    case 'relationship-multi':
    case 'relationship-collection':
      return (
        <div className={cellClassName}>
          <RelationshipRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    case 'date':
      return (
        <div className={cellClassName}>
          <DateRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    case 'boolean':
      return (
        <div className={cellClassName}>
          <BooleanRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
      
    default:
      return (
        <div className={cellClassName}>
          <TextRenderer 
            value={displayValue} 
            config={config} 
            onContentClick={handleContentClick}
          />
          {isLoading && <span className="text-xs text-blue-600 ml-1">💾</span>}
        </div>
      )
  }
}

/**
 * Helper function to render system fields (read-only)
 */
function renderSystemField(value: any, cellType: string, config: any): React.ReactNode {
  return renderCellValue(value, cellType, config)
}

/**
 * Helper function to render cell values
 */
function renderCellValue(value: any, cellType: string, config: any): React.ReactNode {
  switch (cellType) {
    case 'text':
      return <TextRenderer value={value} config={config} />
    case 'number':
      return <NumberRenderer value={value} config={config} />
    case 'enum':
      return <EnumRenderer value={value} config={config} />
    case 'date':
      return <DateRenderer value={value} config={config} />
    case 'boolean':
      return <BooleanRenderer value={value} config={config} />
    default:
      return <TextRenderer value={value} config={config} />
  }
}