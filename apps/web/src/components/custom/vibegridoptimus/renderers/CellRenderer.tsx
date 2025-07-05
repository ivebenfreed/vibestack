import React from 'react'
import type { BaseEntity, CellRendererProps } from '../types'
import type { GridMachineAPI } from '../types/gridTypes'
import { TextRenderer } from './TextRenderer'
import { NumberRenderer } from './NumberRenderer'
import { EnumRenderer } from './EnumRenderer'
import { RelationshipRenderer } from './RelationshipRenderer'
import { DateRenderer } from './DateRenderer'
import { BooleanRenderer } from './BooleanRenderer'
import { CSS_CLASSES } from '../utils/constants'

interface GridCellRendererProps<TEntity extends BaseEntity> extends CellRendererProps<TEntity> {
  gridMachine?: GridMachineAPI
}

/**
 * Universal cell renderer with grid machine integration
 * Provides optimistic updates and comprehensive state management
 */
export function CellRenderer<TEntity extends BaseEntity>(
  props: GridCellRendererProps<TEntity>
): React.ReactNode {
  const { row, column, value: atomValue, rowIndex, onContentClick, onUpdate, gridMachine } = props
  const { cellType, config, systemField } = column
  
  // Cell identification - optimize string conversion
  const cellId = row.id
  const columnKey = column.key
  
  // PERFORMANCE OPTIMIZATION: Only check cell state if grid machine exists and has active states
  // Most cells are not in edit state, so avoid expensive getCellState calls
  const hasActiveCellStates = gridMachine?.activeCellCount > 0
  const cellState = hasActiveCellStates ? gridMachine?.getCellState(cellId, columnKey) : null
  
  // Use override value if available, otherwise use atom value naturally
  const displayValue = cellState?.displayValue ?? atomValue
  const isEditing = cellState?.isEditing ?? false
  const hasError = cellState?.hasError ?? false
  const error = cellState?.error ?? null
  
  // No automatic registration - let's simplify and avoid the actor complexity for now
  // The grid machine will handle state coordination without individual cell actors
  
  // System fields are read-only
  if (systemField) {
    return (
      <div className={CSS_CLASSES.systemCell}>
        {renderSystemField(displayValue, cellType, config)}
      </div>
    )
  }

  // No loading indicators needed - display overrides handle temporary states
  
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

  // PERFORMANCE: Only create click handler if cell is actually editable
  const handleContentClick = column.config?.editable ? React.useCallback((event: React.MouseEvent) => {
    if (onContentClick) {
      // Start cell editing with grid machine - creates simple display override
      if (gridMachine && onUpdate) {
        gridMachine.startCellEdit(cellId, columnKey, atomValue, onUpdate)
      }
      
      onContentClick(rowIndex, String(column.key), event)
    }
  }, [onContentClick, rowIndex, column.key, gridMachine, cellId, columnKey, atomValue, onUpdate]) : undefined

  // Show editing state only
  const cellClassName = `${isEditing ? 'ring-2 ring-blue-300' : ''}`

  // Switch based on cell type for business data
  switch (cellType) {
    case 'text':
      return (
        <div className={cellClassName}>
          <TextRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'number':
      return (
        <div className={cellClassName}>
          <NumberRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'enum':
      return (
        <div className={cellClassName}>
          <EnumRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'relationship-single':
    case 'relationship-multi':
    case 'relationship-collection':
      return (
        <div className={cellClassName}>
          <RelationshipRenderer value={displayValue} config={config} cellType={cellType} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'boolean':
      return (
        <div className={cellClassName}>
          <BooleanRenderer value={displayValue} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'date':
      return (
        <div className={cellClassName}>
          <DateRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'uuid':
      return (
        <div className={cellClassName}>
          {renderUUID(displayValue)}
          {/* No loading indicators needed */}
        </div>
      )
      
    case 'json':
      return (
        <div className={cellClassName}>
          {renderJSON(displayValue)}
          {/* No loading indicators needed */}
        </div>
      )
      
    default:
      return (
        <div className={cellClassName}>
          {renderDefault(displayValue)}
          {/* No loading indicators needed */}
        </div>
      )
  }
}

/**
 * System field renderer (read-only)
 */
function renderSystemField(value: any, cellType: string, config?: any): React.ReactNode {
  if (cellType === 'date') {
    return <DateRenderer value={value} config={config} readOnly />
  }
  
  if (cellType === 'uuid') {
    return renderUUID(value)
  }
  
  return <span className={CSS_CLASSES.mutedText}>{String(value || '')}</span>
}

/**
 * UUID renderer (truncated display)
 */
function renderUUID(value: any): React.ReactNode {
  const uuid = String(value || '')
  const truncated = uuid.length > 8 ? `${uuid.slice(0, 8)}...` : uuid
  
  return (
    <span 
      className="text-sm font-mono text-muted-foreground" 
      title={uuid}
    >
      {truncated}
    </span>
  )
}

/**
 * JSON renderer (collapsible preview)
 */
function renderJSON(value: any): React.ReactNode {
  const jsonString = JSON.stringify(value, null, 2)
  const preview = jsonString.length > 50 ? `${jsonString.slice(0, 50)}...` : jsonString
  
  return (
    <span 
      className="text-sm font-mono text-muted-foreground" 
      title={jsonString}
    >
      {preview}
    </span>
  )
}

/**
 * Default fallback renderer
 */
function renderDefault(value: any): React.ReactNode {
  let displayValue = ''
  if (value === null || value === undefined) {
    displayValue = ''
  } else if (typeof value === 'object') {
    // If we get an object in the default case, try to extract a meaningful value
    displayValue = value.name || value.title || value.id || JSON.stringify(value)
  } else {
    displayValue = String(value)
  }
  return <span className="text-sm">{displayValue}</span>
}

/**
 * Helper function to render cell values for error states
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
      return <BooleanRenderer value={value} />
    case 'uuid':
      return renderUUID(value)
    case 'json':
      return renderJSON(value)
    default:
      return renderDefault(value)
  }
}