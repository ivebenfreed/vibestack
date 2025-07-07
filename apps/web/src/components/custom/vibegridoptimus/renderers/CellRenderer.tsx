import React from 'react'
import type { BaseEntity, CellRendererProps } from '../types'
import { TextRenderer } from './TextRenderer'
import { NumberRenderer } from './NumberRenderer'
import { EnumRenderer } from './EnumRenderer'
import { RelationshipRenderer } from './RelationshipRenderer'
import { DateRenderer } from './DateRenderer'
import { BooleanRenderer } from './BooleanRenderer'
import { CSS_CLASSES } from '../utils/constants'

/**
 * Universal cell renderer that switches based on DataForge cellType
 * Pure display component - no editing state management
 */
export function CellRenderer<TEntity extends BaseEntity>(
  props: CellRendererProps<TEntity>
): React.ReactNode {
  const { row, column, value: atomValue, rowIndex, onContentClick, onUpdate, relationshipResolver } = props
  const { cellType, config, systemField } = column
  
  // Use the provided value directly
  const displayValue = atomValue
  
  // System fields are read-only
  if (systemField) {
    return (
      <div className={CSS_CLASSES.systemCell}>
        {renderSystemField(displayValue, cellType, config)}
      </div>
    )
  }

  // Create content click handler - pass through directly to onContentClick
  const handleContentClick = React.useCallback((event: React.MouseEvent) => {
    if (onContentClick && column.config?.editable) {
      onContentClick(rowIndex, String(column.key), event)
    }
  }, [onContentClick, rowIndex, column.key, column.config?.editable])

  // Switch based on cell type for business data
  switch (cellType) {
    case 'text':
      return <TextRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
      
    case 'number':
      return <NumberRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
      
    case 'enum':
      return <EnumRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
      
    case 'relationship-single':
    case 'relationship-multi':
    case 'relationship-collection':
      return <RelationshipRenderer value={displayValue} config={config} cellType={cellType} onContentClick={handleContentClick} relationshipResolver={relationshipResolver} column={column} />
      
    case 'boolean':
      return <BooleanRenderer value={displayValue} onContentClick={handleContentClick} />
      
    case 'date':
      return <DateRenderer value={displayValue} config={config} onContentClick={handleContentClick} />
      
    case 'uuid':
      return renderUUID(displayValue)
      
    case 'json':
      return renderJSON(displayValue)
      
    default:
      return renderDefault(displayValue)
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