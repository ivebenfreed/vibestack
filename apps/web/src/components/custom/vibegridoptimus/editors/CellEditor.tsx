import React from 'react'
import type { BaseEntity, OptimusColumn } from '../types'
import type { GridMachineAPI } from '../types/gridTypes'
import { 
  NumberEditor,
  EnumEditor,
  BooleanEditor,
  RelationshipEditor,
  DateEditor,
  SingleRelationshipEditor,
  MultiRelationshipEditor,
  CollectionRelationshipEditor
} from './index'
import { SimpleTextEditor } from './SimpleTextEditor'

interface CellEditorProps<TEntity extends BaseEntity> {
  row: TEntity
  column: OptimusColumn<TEntity>
  onRowChange: (row: TEntity) => void
  onClose: (commitChanges?: boolean) => void
  onUpdate?: (id: string, column: string, value: any) => Promise<void>
  gridMachine?: GridMachineAPI
}

/**
 * Universal cell editor that switches based on DataForge cellType
 * Used in renderEditCell to provide rich editing experiences
 */
export function CellEditor<TEntity extends BaseEntity>(
  props: CellEditorProps<TEntity>
): React.ReactNode {
  const { column } = props
  const { cellType, systemField } = column
  
  // System fields are read-only - shouldn't be editable
  if (systemField) {
    console.warn('[CellEditor] Attempted to edit system field:', column.key)
    return (
      <div className="flex items-center justify-center text-muted-foreground text-sm">
        Read-only
      </div>
    )
  }
  
  // Switch based on cell type for business data
  switch (cellType) {
    case 'text':
      return <SimpleTextEditor {...props} />
      
    case 'number':
      return <NumberEditor {...props} />
      
    case 'enum':
      return <EnumEditor {...props} />
      
    case 'relationship-single':
      return <SingleRelationshipEditor {...props} />
      
    case 'relationship-multi':
      return <MultiRelationshipEditor {...props} />
      
    case 'relationship-collection':
      return <CollectionRelationshipEditor {...props} />
      
    case 'boolean':
      return <BooleanEditor {...props} />
      
    case 'date':
      return <DateEditor {...props} />
      
    case 'uuid':
    case 'json':
      // These types are typically read-only
      return (
        <div className="flex items-center justify-center text-muted-foreground text-sm">
          Read-only
        </div>
      )
      
    default:
      // Fallback to text editor for unknown types
      console.warn('[CellEditor] Unknown cellType:', cellType, 'falling back to text editor')
      return <SimpleTextEditor {...props} />
  }
}