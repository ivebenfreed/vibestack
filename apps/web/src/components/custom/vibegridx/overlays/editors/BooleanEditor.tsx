import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import type { CellRef, Column } from '../../types';

interface BooleanEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: boolean | null;
  onCommit: (value: boolean | null) => void;
  onCancel: () => void;
  variant?: 'checkbox' | 'switch';
}

export function BooleanEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  variant = 'checkbox'
}: BooleanEditorProps) {
  const [value, setValue] = React.useState(initialValue ?? false);
  
  React.useEffect(() => {
    // Auto-commit immediately on value change for boolean inputs
    onCommit(value);
  }, [value, onCommit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        setValue(!value);
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

  if (variant === 'switch') {
    return (
      <div className="flex items-center justify-center p-2 bg-white border-2 border-blue-500 rounded shadow-lg">
        <Switch
          checked={value}
          onCheckedChange={setValue}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-2 bg-white border-2 border-blue-500 rounded shadow-lg">
      <Checkbox
        checked={value}
        onCheckedChange={(checked) => setValue(checked === true)}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-5 h-5"
      />
    </div>
  );
}