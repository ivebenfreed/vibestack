/**
 * SingleRelationshipEditor - For single relationship/foreign key fields
 * 
 * ✅ ADAPTED: From VibeGridOptimus SingleRelationshipEditor
 * ✅ SEARCH: Instant filtering for relationship options
 * ✅ KEYBOARD NAV: Full keyboard navigation support
 * ✅ NULL HANDLING: Proper null state with "None" option
 */

import React from 'react';
import { ComboboxEditor } from './ComboboxEditor';
import type { CellRef, Column, RelationshipContext } from '../../types';

interface SingleRelationshipEditorProps {
  cell: CellRef;
  column: Column;
  initialValue: any;
  onCommit: (value: any) => void;
  onCancel: () => void;
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
    relationshipAtoms?: Record<string, any>;
  };
}

export function SingleRelationshipEditor({
  cell,
  column,
  initialValue,
  onCommit,
  onCancel,
  relationshipContext
}: SingleRelationshipEditorProps) {
  
  // Generate options from relationship atoms
  const options = React.useMemo(() => {
    if (!relationshipContext?.relationshipAtoms || !column.relationshipTable) {
      return [];
    }
    
    const relationshipAtom = relationshipContext.relationshipAtoms[column.relationshipTable];
    if (!relationshipAtom) {
      return [];
    }
    
    const atomData = relationshipAtom.get() || {};
    const entities = Object.values(atomData);
    
    return entities.map((entity: any) => ({
      value: entity.id,
      label: entity[column.relationshipDisplayField || 'displayName'] || 
             entity.displayName || 
             entity.name || 
             entity.title || 
             entity.label || 
             entity.id
    }));
  }, [relationshipContext, column.relationshipTable, column.relationshipDisplayField]);
  
  // Convert relationship column to work with ComboboxEditor
  const relationshipColumn = {
    ...column,
    // Use generated options from relationship atoms
    options: options,
    // Mark as nullable to get "None" option
    nullable: true
  };

  // Convert value to string for ComboboxEditor
  const stringValue = initialValue == null ? null : String(initialValue);

  const handleCommit = (value: any) => {
    if (value === null) {
      onCommit(null);
    } else {
      // Convert back to appropriate type (likely string ID)
      onCommit(value);
    }
  };

  // Create proper RelationshipContext for ComboboxEditor
  const relationshipContextForCombobox: RelationshipContext | undefined = 
    relationshipContext?.relationshipAtoms ? {
      currentEntity: null, // TODO: Get current entity being edited
      atoms: relationshipContext.relationshipAtoms,
      column: column,
      fieldName: column.field || column.id
    } : undefined;

  console.log('🔍 SingleRelationshipEditor: Creating relationship context', {
    columnId: column.id,
    hasRelationshipContext: !!relationshipContext,
    hasRelationshipAtoms: !!relationshipContext?.relationshipAtoms,
    relationshipAtoms: relationshipContext?.relationshipAtoms ? Object.keys(relationshipContext.relationshipAtoms) : [],
    relationshipTable: column.relationshipTable,
    hasProvider: !!column.relationshipOptionsProvider,
    relationshipContextForCombobox: relationshipContextForCombobox
  });

  return (
    <ComboboxEditor
      cell={cell}
      column={relationshipColumn}
      initialValue={stringValue}
      onCommit={handleCommit}
      onCancel={onCancel}
      placeholder="Select..."
      searchPlaceholder="Search..."
      relationshipContext={relationshipContextForCombobox}
    />
  );
}