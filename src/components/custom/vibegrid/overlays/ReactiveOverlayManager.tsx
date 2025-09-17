/**
 * Reactive Overlay Manager
 *
 * This component manages all reactive overlays and their coordination.
 * It replaces the old OverlayManager with a reactive, DOM-based approach.
 */

import React from 'react';
import { observer } from '@legendapp/state/react';
import {
  ReactiveSelectionOverlay,
  MultiSelectionOverlay,
  InteractiveSelectionOverlay
} from './ReactiveSelectionOverlay';
import {
  ReactiveEditingOverlay,
  MultipleCellEditingOverlay,
  FormulaEditingOverlay
} from './ReactiveEditingOverlay';
import {
  ReactiveDragOverlay,
  BatchDragOverlay
} from './ReactiveDragOverlay';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/overlays/ReactiveOverlayManager.tsx');

export interface OverlayState {
  // Selection state
  selection?: {
    selectedCells: Set<string>;
    type: 'cells' | 'rows' | 'columns' | 'range';
    hoveredCell?: string;
    multiSelections?: Array<{
      id: string;
      cellKeys: string[];
      type: 'cells' | 'rows' | 'columns' | 'range';
      color?: string;
      priority?: number;
    }>;
  };

  // Editing state
  editing?: {
    editingCell?: {
      cellKey: string;
      initialValue?: string;
      type?: 'text' | 'number' | 'textarea' | 'select';
      options?: string[];
    };
    multipleCells?: Array<{
      cellKey: string;
      initialValue: string;
      type?: 'text' | 'number' | 'textarea' | 'select';
      options?: string[];
    }>;
    formula?: {
      cellKey: string;
      formula: string;
      references?: string[];
    };
  };

  // Drag and drop state
  dragDrop?: {
    operation?: {
      type: 'move' | 'copy' | 'fill' | 'resize';
      sourceCells: string[];
      currentPosition: { x: number; y: number };
      targetCell?: string;
      previewData?: any;
    };
    batchOperations?: Array<{
      id: string;
      type: 'move' | 'copy' | 'fill' | 'resize';
      sourceCells: string[];
      currentPosition: { x: number; y: number };
      targetCell?: string;
      previewData?: any;
    }>;
  };

  // General overlay settings
  settings?: {
    enableInteractiveSelection?: boolean;
    enableMultiSelection?: boolean;
    enableBatchDrag?: boolean;
    className?: string;
  };
}

export interface OverlayCallbacks {
  // Selection callbacks
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onCellHover?: (cellKey: string | null) => void;

  // Editing callbacks
  onEditStart?: (cellKey: string) => void;
  onEditValueChange?: (cellKey: string, value: string) => void;
  onEditComplete?: (cellKey: string, value: string, cancelled: boolean) => void;
  onEditCancel?: (cellKey: string) => void;
  onFormulaChange?: (cellKey: string, formula: string) => void;

  // Drag and drop callbacks
  onDragStart?: (operation: any) => void;
  onDragUpdate?: (operation: any) => void;
  onDragComplete?: (operation: any) => void;
  onDragCancel?: () => void;
}

interface ReactiveOverlayManagerProps {
  state: OverlayState;
  callbacks?: OverlayCallbacks;
  className?: string;
}

/**
 * Main reactive overlay manager component
 */
export const ReactiveOverlayManager = observer<ReactiveOverlayManagerProps>(({
  state,
  callbacks = {},
  className = ''
}) => {
  const {
    selection,
    editing,
    dragDrop,
    settings = {}
  } = state;

  const {
    enableInteractiveSelection = true,
    enableMultiSelection = true,
    enableBatchDrag = false,
    className: settingsClassName = ''
  } = settings;

  fileLog.debug('🎭 Rendering overlay manager', {
    hasSelection: !!selection,
    hasEditing: !!editing,
    hasDragDrop: !!dragDrop,
    settings
  });

  return (
    <div
      className={`vibegrid-reactive-overlay-manager ${className} ${settingsClassName}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none', // Allow clicks through to underlying grid
        overflow: 'hidden'
      }}
    >
      {/* Selection Overlays */}
      {selection && (
        <>
          {/* Multi-selections (render first, lower z-index) */}
          {enableMultiSelection && selection.multiSelections && selection.multiSelections.length > 0 && (
            <MultiSelectionOverlay
              selections={selection.multiSelections}
              className="overlay-layer overlay-layer--multi-selection"
            />
          )}

          {/* Main selection */}
          {selection.selectedCells.size > 0 && (
            <>
              {enableInteractiveSelection ? (
                <InteractiveSelectionOverlay
                  selectedCells={selection.selectedCells}
                  hoveredCell={selection.hoveredCell}
                  selectionType={selection.type}
                  onCellHover={callbacks.onCellHover}
                  className="overlay-layer overlay-layer--interactive-selection"
                />
              ) : (
                <ReactiveSelectionOverlay
                  selectedCells={selection.selectedCells}
                  selectionType={selection.type}
                  className="overlay-layer overlay-layer--selection"
                />
              )}
            </>
          )}
        </>
      )}

      {/* Editing Overlays */}
      {editing && (
        <>
          {/* Formula editing (highest priority) */}
          {editing.formula && (
            <FormulaEditingOverlay
              editingCell={editing.formula}
              onFormulaChange={callbacks.onFormulaChange}
              onEditComplete={callbacks.onEditComplete}
              className="overlay-layer overlay-layer--formula-editing"
            />
          )}

          {/* Multiple cell editing */}
          {editing.multipleCells && editing.multipleCells.length > 0 && (
            <MultipleCellEditingOverlay
              editingCells={editing.multipleCells}
              onValueChange={callbacks.onEditValueChange}
              onEditComplete={(results) => {
                results.forEach(result => {
                  callbacks.onEditComplete?.(result.cellKey, result.value, result.cancelled);
                });
              }}
              className="overlay-layer overlay-layer--multiple-editing"
            />
          )}

          {/* Single cell editing */}
          {editing.editingCell && (
            <ReactiveEditingOverlay
              editingCell={editing.editingCell}
              onValueChange={callbacks.onEditValueChange}
              onEditComplete={callbacks.onEditComplete}
              onEditCancel={callbacks.onEditCancel}
              className="overlay-layer overlay-layer--editing"
            />
          )}
        </>
      )}

      {/* Drag and Drop Overlays */}
      {dragDrop && (
        <>
          {/* Batch drag operations */}
          {enableBatchDrag && dragDrop.batchOperations && dragDrop.batchOperations.length > 0 && (
            <BatchDragOverlay
              dragOperations={dragDrop.batchOperations}
              onOperationUpdate={(id, operation) => {
                // Update specific operation in batch
                callbacks.onDragUpdate?.({ ...operation, id });
              }}
              className="overlay-layer overlay-layer--batch-drag"
            />
          )}

          {/* Single drag operation */}
          {dragDrop.operation && (
            <ReactiveDragOverlay
              dragOperation={dragDrop.operation}
              onDragUpdate={callbacks.onDragUpdate}
              onDragComplete={callbacks.onDragComplete}
              className="overlay-layer overlay-layer--drag"
            />
          )}
        </>
      )}
    </div>
  );
});

/**
 * Simplified overlay manager for basic use cases
 */
export const SimpleOverlayManager = observer<{
  selectedCells: Set<string>;
  editingCell?: string;
  editingValue?: string;
  dragOperation?: any;
  onEditComplete?: (cellKey: string, value: string) => void;
  onDragComplete?: (operation: any) => void;
  className?: string;
}>(({
  selectedCells,
  editingCell,
  editingValue,
  dragOperation,
  onEditComplete,
  onDragComplete,
  className = ''
}) => {
  const state: OverlayState = {
    selection: selectedCells.size > 0 ? {
      selectedCells,
      type: 'cells'
    } : undefined,

    editing: editingCell ? {
      editingCell: {
        cellKey: editingCell,
        initialValue: editingValue,
        type: 'text'
      }
    } : undefined,

    dragDrop: dragOperation ? {
      operation: dragOperation
    } : undefined
  };

  const callbacks: OverlayCallbacks = {
    onEditComplete,
    onDragComplete
  };

  return (
    <ReactiveOverlayManager
      state={state}
      callbacks={callbacks}
      className={`simple-overlay-manager ${className}`}
    />
  );
});

/**
 * Hook for managing overlay state reactively
 */
export function useOverlayState() {
  const [state, setState] = React.useState<OverlayState>({});

  const updateSelection = (update: Partial<OverlayState['selection']>) => {
    setState(prev => ({
      ...prev,
      selection: { ...prev.selection, ...update }
    }));
  };

  const updateEditing = (update: Partial<OverlayState['editing']>) => {
    setState(prev => ({
      ...prev,
      editing: { ...prev.editing, ...update }
    }));
  };

  const updateDragDrop = (update: Partial<OverlayState['dragDrop']>) => {
    setState(prev => ({
      ...prev,
      dragDrop: { ...prev.dragDrop, ...update }
    }));
  };

  const clearAll = () => {
    setState({});
  };

  return {
    state,
    updateSelection,
    updateEditing,
    updateDragDrop,
    clearAll,
    setState
  };
}