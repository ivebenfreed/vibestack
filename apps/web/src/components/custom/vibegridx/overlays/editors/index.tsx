import React from 'react';
import { TextEditor } from './TextEditor';
import { NumberEditor } from './NumberEditor';
import { SelectEditor } from './SelectEditor';
import { BooleanEditor } from './BooleanEditor';
import { DateEditor } from './DateEditor';
import type { CellRef, Column } from '../../types';

// Export all editor components
export { TextEditor, NumberEditor, SelectEditor, BooleanEditor, DateEditor };

// Editor props interface
export interface EditorProps {
  cell: CellRef;
  column: Column;
  initialValue: any;
  onCommit: (value: any) => void;
  onCancel: () => void;
}

// Editor factory function
export function createEditor(props: EditorProps): React.ReactElement {
  const { column } = props;
  const cellType = column.cellType || column.type;

  switch (cellType) {
    case 'text':
    case 'string':
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
      
    default:
      // Default to text editor for unknown types
      console.warn(`Unknown cell type: ${cellType}, defaulting to text editor`);
      return <TextEditor {...props} />;
  }
}