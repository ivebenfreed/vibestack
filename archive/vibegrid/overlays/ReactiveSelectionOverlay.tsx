/**
 * Reactive Selection Overlay
 *
 * This component replaces the old canvas-based selection rendering
 * with a reactive DOM-based approach using the hybrid positioning system.
 */

import React from 'react';
import { observer } from '@legendapp/state/react';
import { useCellPositionStyle$, useSelectionBounds$ } from '../hooks';
import { GRID_DIMENSIONS } from '../constants/grid-dimensions';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/overlays/ReactiveSelectionOverlay.tsx');

interface SelectionOverlayProps {
  selectedCells: Set<string>;
  selectionType?: 'cells' | 'rows' | 'columns' | 'range';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Individual cell selection indicator
 */
const SelectionCell = observer<{ cellKey: string; selectionType: string }>(({ cellKey, selectionType }) => {
  const positionStyle$ = useCellPositionStyle$(cellKey, {
    zIndex: GRID_DIMENSIONS.Z_INDEX.SELECTION
  });

  const style = positionStyle$.get();

  if (!style.left || !style.top) {
    return null; // Cell not positioned yet
  }

  return (
    <div
      className={`selection-cell selection-cell--${selectionType}`}
      style={{
        ...style,
        pointerEvents: 'none',
        border: `${GRID_DIMENSIONS.SELECTION_BORDER_WIDTH}px solid var(--selection-border-color, #0066cc)`,
        backgroundColor: 'var(--selection-background-color, rgba(0, 102, 204, 0.1))',
        boxSizing: 'border-box'
      }}
      data-cell-key={cellKey}
      data-selection-type={selectionType}
    />
  );
});

/**
 * Range selection indicator (for contiguous selections)
 */
const SelectionRange = observer<{ cellKeys: string[]; selectionType: string }>(({ cellKeys, selectionType }) => {
  const bounds$ = useSelectionBounds$(cellKeys);
  const bounds = bounds$.get();

  if (!bounds || bounds.cellCount === 0) {
    return null;
  }

  return (
    <div
      className={`selection-range selection-range--${selectionType}`}
      style={{
        position: 'absolute',
        left: bounds.x,
        top: bounds.y,
        width: bounds.width,
        height: bounds.height,
        pointerEvents: 'none',
        border: `${GRID_DIMENSIONS.SELECTION_BORDER_WIDTH}px solid var(--selection-border-color, #0066cc)`,
        backgroundColor: 'var(--selection-background-color, rgba(0, 102, 204, 0.1))',
        zIndex: GRID_DIMENSIONS.Z_INDEX.SELECTION,
        boxSizing: 'border-box'
      }}
      data-cell-count={bounds.cellCount}
      data-selection-type={selectionType}
    />
  );
});

/**
 * Main reactive selection overlay component
 */
export const ReactiveSelectionOverlay = observer<SelectionOverlayProps>(({
  selectedCells,
  selectionType = 'cells',
  className = '',
  style = {}
}) => {
  const cellKeys = Array.from(selectedCells);

  if (cellKeys.length === 0) {
    return null;
  }

  fileLog.debug('🎯 Rendering selection overlay', {
    cellCount: cellKeys.length,
    selectionType,
    firstCell: cellKeys[0]
  });

  // For single cell or non-contiguous selections, render individual cells
  if (cellKeys.length === 1 || selectionType === 'cells') {
    return (
      <div
        className={`vibegrid-selection-overlay ${className}`}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: GRID_DIMENSIONS.Z_INDEX.SELECTION,
          ...style
        }}
      >
        {cellKeys.map(cellKey => (
          <SelectionCell
            key={cellKey}
            cellKey={cellKey}
            selectionType={selectionType}
          />
        ))}
      </div>
    );
  }

  // For range selections, render a single bounding box
  return (
    <div
      className={`vibegrid-selection-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: GRID_DIMENSIONS.Z_INDEX.SELECTION,
        ...style
      }}
    >
      <SelectionRange
        cellKeys={cellKeys}
        selectionType={selectionType}
      />
    </div>
  );
});

/**
 * Multi-selection overlay for complex selections
 */
export const MultiSelectionOverlay = observer<{
  selections: Array<{
    id: string;
    cellKeys: string[];
    type: 'cells' | 'rows' | 'columns' | 'range';
    color?: string;
    priority?: number;
  }>;
  className?: string;
}>(({ selections, className = '' }) => {
  if (selections.length === 0) {
    return null;
  }

  // Sort selections by priority (higher priority renders on top)
  const sortedSelections = [...selections].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <div
      className={`vibegrid-multi-selection-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: GRID_DIMENSIONS.Z_INDEX.SELECTION
      }}
    >
      {sortedSelections.map(selection => (
        <div
          key={selection.id}
          style={{
            '--selection-border-color': selection.color || '#0066cc',
            '--selection-background-color': selection.color ? `${selection.color}20` : 'rgba(0, 102, 204, 0.1)'
          } as React.CSSProperties}
        >
          <ReactiveSelectionOverlay
            selectedCells={new Set(selection.cellKeys)}
            selectionType={selection.type}
          />
        </div>
      ))}
    </div>
  );
});

/**
 * Selection overlay with hover effects
 */
export const InteractiveSelectionOverlay = observer<{
  selectedCells: Set<string>;
  hoveredCell?: string;
  selectionType?: 'cells' | 'rows' | 'columns' | 'range';
  onCellHover?: (cellKey: string | null) => void;
  className?: string;
}>(({ selectedCells, hoveredCell, selectionType = 'cells', onCellHover, className = '' }) => {
  return (
    <div className={`vibegrid-interactive-selection-overlay ${className}`}>
      {/* Main selection */}
      <ReactiveSelectionOverlay
        selectedCells={selectedCells}
        selectionType={selectionType}
      />

      {/* Hover indicator */}
      {hoveredCell && !selectedCells.has(hoveredCell) && (
        <ReactiveSelectionOverlay
          selectedCells={new Set([hoveredCell])}
          selectionType="cells"
          style={{
            '--selection-border-color': 'var(--hover-border-color, #66b3ff)',
            '--selection-background-color': 'var(--hover-background-color, rgba(102, 179, 255, 0.1))'
          } as React.CSSProperties}
        />
      )}
    </div>
  );
});