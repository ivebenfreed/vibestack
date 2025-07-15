import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CellRef, Column } from '../../types';

interface SelectEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string | null;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
}

export function SelectEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel
}: SelectEditorProps) {
  const [isOpen, setIsOpen] = React.useState(true);
  
  const handleValueChange = (value: string) => {
    onCommit(value === '__null__' ? null : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        onCancel();
        break;
      case 'Tab':
        e.preventDefault();
        onCommit(initialValue); // Keep current value
        break;
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // If dropdown closes without selection, commit current value
      setTimeout(() => onCommit(initialValue), 100);
    }
  };

  const options = column.enumOptions || column.options || [];

  return (
    <Select 
      value={initialValue || '__null__'}
      onValueChange={handleValueChange}
      open={isOpen}
      onOpenChange={handleOpenChange}
    >
      <SelectTrigger 
        className="border-2 border-blue-500 shadow-lg"
        onKeyDown={handleKeyDown}
        autoFocus
      >
        <SelectValue placeholder={column.placeholder || "Select..."} />
      </SelectTrigger>
      <SelectContent>
        {/* Allow null/empty selection */}
        <SelectItem value="__null__">
          <em className="text-gray-400">None</em>
        </SelectItem>
        
        {options.map((option) => {
          const value = typeof option === 'string' ? option : option.value;
          const label = typeof option === 'string' ? option : option.label;
          
          return (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}