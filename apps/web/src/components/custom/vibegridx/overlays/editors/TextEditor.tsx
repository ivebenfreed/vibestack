import React from 'react';
import type { CellRef, Column } from '../../types';

interface TextEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  onUpdate?: (value: string) => void;
  onBlur?: () => void;
  multiline?: boolean;
}

export function TextEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  onUpdate,
  onBlur,
  multiline = false
}: TextEditorProps) {
  const [value, setValue] = React.useState(initialValue || '');
  
  console.log('🔧 TextEditor: Rendering', {
    cellId: cell.rowId + ':' + cell.columnId,
    columnName: column.name,
    initialValue,
    multiline,
    hasCallbacks: {
      onCommit: !!onCommit,
      onCancel: !!onCancel,
      onBlur: !!onBlur
    }
  });
  
  React.useEffect(() => {
    console.log('🔧 TextEditor: Component mounted');
    return () => {
      console.log('🔧 TextEditor: Component unmounted');
    };
  }, []);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        if (!multiline || !e.shiftKey) {
          e.preventDefault();
          onCommit(value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case 'Tab':
        e.preventDefault();
        onCommit(value);
        break;
    }
  };

  const handleBlur = () => {
    // Commit on blur - this is standard behavior
    onCommit(value);
  };

  // Container style to match cell layout
  const containerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    fontSize: '13px',
    boxSizing: 'border-box',
  };

  // Input styles that match cell content exactly
  const inputStyle: React.CSSProperties = {
    width: '100%',
    height: multiline ? '100%' : 'auto',
    border: 'none',
    outline: 'none',
    background: 'transparent',
    padding: '0 12px', // Match cell horizontal padding
    margin: '0',
    font: 'inherit',
    fontSize: 'inherit',
    color: 'inherit',
    lineHeight: multiline ? '1.5' : 'inherit',
    textAlign: 'inherit',
    resize: multiline ? 'none' : undefined,
    boxSizing: 'border-box',
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onUpdate?.(newValue);
  };

  if (multiline) {
    return (
      <div style={containerStyle}>
        <textarea
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoFocus
          style={inputStyle}
          placeholder={column.placeholder}
        />
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <input
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        autoFocus
        style={inputStyle}
        type={column.type === 'email' ? 'email' : column.type === 'url' ? 'url' : 'text'}
        placeholder={column.placeholder}
        maxLength={column.maxLength}
      />
    </div>
  );
}