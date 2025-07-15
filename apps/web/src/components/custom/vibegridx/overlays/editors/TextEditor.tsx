import React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { CellRef, Column } from '../../types';

interface TextEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  multiline?: boolean;
}

export function TextEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  multiline = false
}: TextEditorProps) {
  const [value, setValue] = React.useState(initialValue || '');
  
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
    onCommit(value);
  };

  const commonProps = {
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValue(e.target.value),
    onKeyDown: handleKeyDown,
    onBlur: handleBlur,
    autoFocus: true,
    className: "border-2 border-blue-500 shadow-lg"
  };

  if (multiline) {
    return (
      <Textarea 
        {...commonProps}
        rows={3}
        placeholder={column.placeholder}
      />
    );
  }

  return (
    <Input 
      {...commonProps}
      type={column.type === 'email' ? 'email' : column.type === 'url' ? 'url' : 'text'}
      placeholder={column.placeholder}
      maxLength={column.maxLength}
    />
  );
}