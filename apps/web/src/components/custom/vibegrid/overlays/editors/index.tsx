import React from 'react';
import { TextEditor } from './TextEditor';
import { NumberEditor } from './NumberEditor';
import { SelectEditor } from './SelectEditor';
import { BooleanEditor } from './BooleanEditor';
import { DateEditor } from './DateEditor';
import { SingleRelationshipEditor } from './SingleRelationshipEditor';
import { MultiRelationshipEditor } from './MultiRelationshipEditor';
import type { CellRef, Column } from '../../types';

// Export all editor components
export { TextEditor, NumberEditor, SelectEditor, BooleanEditor, DateEditor, SingleRelationshipEditor, MultiRelationshipEditor };

// Editor props interface
export interface EditorProps {
  cell: CellRef;
  column: Column;
  initialValue: any;
  onCommit: (value: any) => void;
  onCancel: () => void;
  onUpdate?: (value: any) => void;
  onBlur?: () => void;
  // Additional context for relationship editors
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
  };
}

// Editor factory function
export function createEditor(props: EditorProps): React.ReactElement {
  const { column } = props;
  const cellType = column.cellType || column.type;
  
  console.log('🔧 createEditor: Creating editor', {
    cellType,
    columnId: column.id,
    columnName: column.name,
    initialValue: props.initialValue,
    hasCallbacks: {
      onCommit: !!props.onCommit,
      onCancel: !!props.onCancel,
      onUpdate: !!props.onUpdate
    }
  });

  switch (cellType) {
    case 'text':
    case 'string':
      console.log('🔧 createEditor: Creating TextEditor');
      return <TextEditor {...props} />;
      
    case 'textarea':
    case 'longtext':
      return <TextEditor {...props} multiline />;
      
    case 'number':
    case 'integer':
    case 'float':
    case 'decimal':
      return <NumberEditor {...props} />;
      
    case 'select':
    case 'enum':
      return <SelectEditor {...props} />;
      
    case 'boolean':
    case 'checkbox':
      return <BooleanEditor {...props} variant="checkbox" />;
      
    case 'switch':
      return <BooleanEditor {...props} variant="switch" />;
      
    case 'date':
      return <DateEditor {...props} />;
      
    case 'datetime':
    case 'timestamp':
      return <DateEditor {...props} includeTime />;
      
    case 'email':
      return <TextEditor {...props} />;
      
    case 'url':
      return <TextEditor {...props} />;
      
    case 'relationship':
    case 'relationship-single':
      return <SingleRelationshipEditor {...props} />;
      
    case 'relationship-multi':
    case 'relationship-collection':
      return <MultiRelationshipEditor {...props} />;
      
    default:
      // Default to text editor for unknown types
      console.warn(`Unknown cell type: ${cellType}, defaulting to text editor`);
      return <TextEditor {...props} />;
  }
}