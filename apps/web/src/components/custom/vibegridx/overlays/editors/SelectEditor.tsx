import React from 'react';
import { ComboboxEditor } from './ComboboxEditor';
import type { CellRef, Column, RelationshipContext } from '../../types';

interface SelectEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: string | null;
  onCommit: (value: string | null) => void;
  onCancel: () => void;
  // Additional context for relationship editors
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
    relationshipAtoms?: Record<string, any>;
  };
}

export function SelectEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  relationshipContext
}: SelectEditorProps) {
  // Convert the old relationshipContext format to the new RelationshipContext
  const newRelationshipContext: RelationshipContext | undefined = relationshipContext ? {
    currentEntity: null, // Will be set by the actual editor call
    atoms: relationshipContext.relationshipAtoms || {},
    column,
    fieldName: column.field || column.id
  } : undefined;

  return (
    <ComboboxEditor
      cell={cell}
      column={column}
      initialValue={initialValue}
      onCommit={onCommit}
      onCancel={onCancel}
      placeholder={column.placeholder || "Select..."}
      searchPlaceholder="Search options..."
      relationshipContext={newRelationshipContext}
    />
  );
}