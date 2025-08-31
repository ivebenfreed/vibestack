/**
 * MultiSelectEditor - For multi-selection fields using shadcn multi-select
 * 
 * ✅ SHADCN: Uses proper shadcn multi-select component with search
 * ✅ SEARCH: Instant filtering for options
 * ✅ KEYBOARD NAV: Full keyboard navigation support
 * ✅ BADGES: Shows selected items as removable badges
 * ✅ COLORS: Supports color-coded options
 */

import React from 'react';
import { MultiSelect } from '@/components/ui/multi-select';
import type { CellRef, Column, EnumOption } from '../../types';

interface MultiSelectEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string[] | null;
  onCommit: (value: string[]) => void;
  onCancel: () => void;
}

export function MultiSelectEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel
}: MultiSelectEditorProps) {
  const [hasCommitted, setHasCommitted] = React.useState(false);

  // Convert column options to MultiSelect format
  const options = React.useMemo(() => {
    const rawOptions = column.options || column.enumOptions || [];
    
    return rawOptions.map(option => {
      if (typeof option === 'string') {
        return { value: option, label: option };
      }
      return {
        value: option.value,
        label: option.label,
        color: option.color,
        group: option.group,
        disabled: option.disabled
      };
    });
  }, [column.options, column.enumOptions]);

  const handleValueChange = (values: string[]) => {
    if (hasCommitted) return;
    setHasCommitted(true);
    onCommit(values);
  };

  // Handle keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!hasCommitted) {
          setHasCommitted(true);
          onCancel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasCommitted, onCancel]);

  const initialValues = Array.isArray(initialValue) ? initialValue : [];

  return (
    <div className="w-full">
      <MultiSelect
        options={options}
        onValueChange={handleValueChange}
        defaultValue={initialValues}
        placeholder="Select items..."
        className="w-full"
      />
    </div>
  );
}