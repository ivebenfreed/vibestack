/**
 * Reactive Drag Overlay
 *
 * This component provides reactive drag and drop previews
 * using the hybrid positioning system for accurate feedback.
 */

import React, { useEffect, useState } from 'react';
import { observer } from '@legendapp/state/react';
import { useCellPositionStyle$, useSelectionBounds$, useClosestCell$ } from '../hooks';
import { GRID_DIMENSIONS } from '../constants/grid-dimensions';
import type { Position } from '../types/coordinate-types';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/overlays/ReactiveDragOverlay.tsx');

interface DragOverlayProps {
  dragOperation?: {
    type: 'move' | 'copy' | 'fill' | 'resize';
    sourceCells: string[];
    currentPosition: Position;
    targetCell?: string;
    previewData?: any;
  };
  onDragUpdate?: (operation: any) => void;
  onDragComplete?: (operation: any) => void;
  className?: string;
}

/**
 * Drag preview component showing the dragged cells
 */
const DragPreview = observer<{
  sourceCells: string[];
  currentPosition: Position;
  dragType: 'move' | 'copy' | 'fill' | 'resize';
  previewData?: any;
}>(({ sourceCells, currentPosition, dragType, previewData }) => {
  const bounds$ = useSelectionBounds$(sourceCells);
  const bounds = bounds$.get();

  if (!bounds) {
    return null;
  }

  const previewStyle: React.CSSProperties = {
    position: 'absolute',
    left: currentPosition.x - bounds.width / 2,
    top: currentPosition.y - bounds.height / 2,
    width: bounds.width,
    height: bounds.height,
    opacity: 0.7,
    pointerEvents: 'none',
    zIndex: GRID_DIMENSIONS.Z_INDEX.DRAG_PREVIEW,
    border: `2px solid var(--drag-preview-border-color, #0066cc)`,
    backgroundColor: 'var(--drag-preview-background-color, rgba(0, 102, 204, 0.2))',
    borderRadius: '4px',
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)'
  };

  // Different styles for different drag types
  switch (dragType) {
    case 'copy':
      previewStyle.borderStyle = 'dashed';
      previewStyle.backgroundColor = 'var(--drag-copy-background-color, rgba(0, 204, 0, 0.2))';
      break;
    case 'fill':
      previewStyle.backgroundColor = 'var(--drag-fill-background-color, rgba(255, 165, 0, 0.2))';
      break;
    case 'resize':
      previewStyle.backgroundColor = 'var(--drag-resize-background-color, rgba(204, 0, 204, 0.2))';
      break;
  }

  return (
    <div
      className={`drag-preview drag-preview--${dragType}`}
      style={previewStyle}
      data-drag-type={dragType}
      data-source-cells={sourceCells.length}
    >
      {/* Drag type indicator */}
      <div
        style={{
          position: 'absolute',
          top: '-24px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '2px 8px',
          backgroundColor: 'var(--drag-indicator-background, #333)',
          color: 'var(--drag-indicator-color, white)',
          fontSize: '12px',
          borderRadius: '4px',
          whiteSpace: 'nowrap'
        }}
      >
        {dragType.toUpperCase()} ({sourceCells.length} cells)
      </div>

      {/* Preview content if available */}
      {previewData && (
        <div
          style={{
            position: 'absolute',
            inset: '4px',
            overflow: 'hidden',
            fontSize: '11px',
            color: 'var(--drag-preview-text-color, #333)'
          }}
        >
          {typeof previewData === 'string' ? previewData : JSON.stringify(previewData)}
        </div>
      )}
    </div>
  );
});

/**
 * Drop target indicator
 */
const DropTarget = observer<{
  targetCell: string;
  dragType: 'move' | 'copy' | 'fill' | 'resize';
  isValid: boolean;
}>(({ targetCell, dragType, isValid }) => {
  const positionStyle$ = useCellPositionStyle$(targetCell, {
    zIndex: GRID_DIMENSIONS.Z_INDEX.DRAG_PREVIEW - 1
  });

  const style = positionStyle$.get();

  if (!style.left || !style.top) {
    return null;
  }

  const targetStyle: React.CSSProperties = {
    ...style,
    pointerEvents: 'none',
    border: `3px solid ${isValid
      ? 'var(--drop-target-valid-color, #00cc00)'
      : 'var(--drop-target-invalid-color, #cc0000)'
    }`,
    backgroundColor: isValid
      ? 'var(--drop-target-valid-background, rgba(0, 204, 0, 0.1))'
      : 'var(--drop-target-invalid-background, rgba(204, 0, 0, 0.1))',
    borderRadius: '4px',
    boxSizing: 'border-box'
  };

  return (
    <div
      className={`drop-target drop-target--${dragType} ${isValid ? 'drop-target--valid' : 'drop-target--invalid'}`}
      style={targetStyle}
      data-target-cell={targetCell}
      data-drag-type={dragType}
      data-valid={isValid}
    />
  );
});

/**
 * Fill range indicator (for autofill operations)
 */
const FillRange = observer<{
  sourceCells: string[];
  targetCells: string[];
  direction: 'horizontal' | 'vertical' | 'both';
}>(({ sourceCells, targetCells, direction }) => {
  const allCells = [...sourceCells, ...targetCells];
  const bounds$ = useSelectionBounds$(allCells);
  const bounds = bounds$.get();

  if (!bounds) {
    return null;
  }

  return (
    <div
      className={`fill-range fill-range--${direction}`}
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        pointerEvents: 'none',
        zIndex: GRID_DIMENSIONS.Z_INDEX.DRAG_PREVIEW - 2,
        border: '2px dashed var(--fill-range-border-color, #ff6600)',
        backgroundColor: 'var(--fill-range-background-color, rgba(255, 102, 0, 0.1))',
        borderRadius: '4px'
      }}
      data-source-cells={sourceCells.length}
      data-target-cells={targetCells.length}
      data-direction={direction}
    />
  );
});

/**
 * Main reactive drag overlay component
 */
export const ReactiveDragOverlay = observer<DragOverlayProps>(({
  dragOperation,
  onDragUpdate,
  onDragComplete,
  className = ''
}) => {
  const [candidateCells, setCandidateCells] = useState<string[]>([]);

  if (!dragOperation) {
    return null;
  }

  const { type, sourceCells, currentPosition, targetCell, previewData } = dragOperation;

  fileLog.debug('🎯 Rendering drag overlay', {
    type,
    sourceCells: sourceCells.length,
    targetCell,
    currentPosition
  });

  // Find closest cell to current position for smart targeting
  const closestCell$ = useClosestCell$(currentPosition, candidateCells);
  const closestCell = closestCell$.get();

  // Determine if the current target is valid
  const isValidTarget = targetCell ? isValidDropTarget(sourceCells, targetCell, type) : false;

  return (
    <div
      className={`vibegrid-drag-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: GRID_DIMENSIONS.Z_INDEX.DRAG_PREVIEW
      }}
    >
      {/* Drag preview */}
      <DragPreview
        sourceCells={sourceCells}
        currentPosition={currentPosition}
        dragType={type}
        previewData={previewData}
      />

      {/* Drop target indicator */}
      {targetCell && (
        <DropTarget
          targetCell={targetCell}
          dragType={type}
          isValid={isValidTarget}
        />
      )}

      {/* Fill range for autofill operations */}
      {type === 'fill' && targetCell && (
        <FillRange
          sourceCells={sourceCells}
          targetCells={calculateFillRange(sourceCells, targetCell)}
          direction={getFillDirection(sourceCells, targetCell)}
        />
      )}
    </div>
  );
});

/**
 * Batch drag overlay for multiple simultaneous drag operations
 */
export const BatchDragOverlay = observer<{
  dragOperations: Array<{
    id: string;
    type: 'move' | 'copy' | 'fill' | 'resize';
    sourceCells: string[];
    currentPosition: Position;
    targetCell?: string;
    previewData?: any;
  }>;
  onOperationUpdate?: (id: string, operation: any) => void;
  className?: string;
}>(({ dragOperations, onOperationUpdate, className = '' }) => {
  if (dragOperations.length === 0) {
    return null;
  }

  return (
    <div
      className={`vibegrid-batch-drag-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: GRID_DIMENSIONS.Z_INDEX.DRAG_PREVIEW
      }}
    >
      {dragOperations.map(operation => (
        <ReactiveDragOverlay
          key={operation.id}
          dragOperation={operation}
          onDragUpdate={op => onOperationUpdate?.(operation.id, op)}
        />
      ))}
    </div>
  );
});

// Helper functions

function isValidDropTarget(sourceCells: string[], targetCell: string, dragType: string): boolean {
  // Basic validation - can be enhanced based on business rules
  if (sourceCells.includes(targetCell)) {
    return false; // Can't drop on source
  }

  switch (dragType) {
    case 'move':
    case 'copy':
      return true; // Generally always valid
    case 'fill':
      return isValidFillTarget(sourceCells, targetCell);
    case 'resize':
      return isValidResizeTarget(sourceCells, targetCell);
    default:
      return false;
  }
}

function isValidFillTarget(sourceCells: string[], targetCell: string): boolean {
  // Check if target is adjacent to source range
  // This is a simplified version - real implementation would be more sophisticated
  return true;
}

function isValidResizeTarget(sourceCells: string[], targetCell: string): boolean {
  // Check if target allows resizing
  // This is a simplified version - real implementation would be more sophisticated
  return true;
}

function calculateFillRange(sourceCells: string[], targetCell: string): string[] {
  // Calculate the range of cells that would be filled
  // This is a simplified version - real implementation would parse cell coordinates
  return [targetCell];
}

function getFillDirection(sourceCells: string[], targetCell: string): 'horizontal' | 'vertical' | 'both' {
  // Determine fill direction based on source and target positions
  // This is a simplified version - real implementation would parse cell coordinates
  return 'horizontal';
}