import React from 'react';
import { ComboboxEditor } from './ComboboxEditor';
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
  return (
    <ComboboxEditor
      cell={cell}
      column={column}
      initialValue={initialValue}
      onCommit={onCommit}
      onCancel={onCancel}
      placeholder={column.placeholder || "Select..."}
      searchPlaceholder="Search options..."
    />
  );
}