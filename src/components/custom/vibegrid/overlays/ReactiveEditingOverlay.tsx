/**
 * Reactive Editing Overlay
 *
 * This component provides reactive cell editing functionality
 * using the hybrid positioning system for perfect alignment.
 */

import React, { useEffect, useRef, useState } from 'react';
import { observer } from '@legendapp/state/react';
import { useCellPositionStyle$ } from '../hooks';
import { GRID_DIMENSIONS } from '../constants/grid-dimensions';
import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/overlays/ReactiveEditingOverlay.tsx');

interface EditingOverlayProps {
  editingCell?: {
    cellKey: string;
    initialValue?: string;
    type?: 'text' | 'number' | 'textarea' | 'select';
    options?: string[];
  };
  onValueChange?: (cellKey: string, value: string) => void;
  onEditComplete?: (cellKey: string, value: string, cancelled: boolean) => void;
  onEditCancel?: (cellKey: string) => void;
  className?: string;
}

/**
 * Individual cell editor component
 */
const CellEditor = observer<{
  cellKey: string;
  initialValue: string;
  type: 'text' | 'number' | 'textarea' | 'select';
  options?: string[];
  onValueChange?: (value: string) => void;
  onComplete?: (value: string, cancelled: boolean) => void;
}>(({ cellKey, initialValue, type, options, onValueChange, onComplete }) => {
  const [value, setValue] = useState(initialValue);
  const [isValid, setIsValid] = useState(true);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  const positionStyle$ = useCellPositionStyle$(cellKey, {
    zIndex: GRID_DIMENSIONS.Z_INDEX.EDITING,
    includeSize: true
  });

  const style = positionStyle$.get();

  // Focus the input when it mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      if (type === 'text' || type === 'number') {
        (inputRef.current as HTMLInputElement).select();
      }
    }
  }, [type]);

  const handleChange = (newValue: string) => {
    setValue(newValue);
    onValueChange?.(newValue);

    // Basic validation
    if (type === 'number') {
      const isValidNumber = !isNaN(Number(newValue)) || newValue === '';
      setIsValid(isValidNumber);
    } else {
      setIsValid(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        if (type !== 'textarea' || e.ctrlKey) {
          e.preventDefault();
          onComplete?.(value, false);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onComplete?.(initialValue, true);
        break;
      case 'Tab':
        e.preventDefault();
        onComplete?.(value, false);
        break;
    }
  };

  const handleBlur = () => {
    onComplete?.(value, false);
  };

  if (!style.left || !style.top) {
    return null; // Cell not positioned yet
  }

  const inputStyle: React.CSSProperties = {
    ...style,
    border: `2px solid ${isValid ? 'var(--edit-border-color, #0066cc)' : 'var(--edit-error-border-color, #cc0000)'}`,
    backgroundColor: 'var(--edit-background-color, white)',
    fontSize: 'var(--edit-font-size, 14px)',
    fontFamily: 'var(--edit-font-family, inherit)',
    padding: '4px 8px',
    margin: 0,
    outline: 'none',
    boxSizing: 'border-box',
    borderRadius: '2px'
  };

  if (type === 'textarea') {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={{
          ...inputStyle,
          resize: 'none',
          minHeight: style.height
        }}
        data-cell-key={cellKey}
        data-edit-type={type}
      />
    );
  }

  if (type === 'select' && options) {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={value}
        onChange={e => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        style={inputStyle}
        data-cell-key={cellKey}
        data-edit-type={type}
      >
        {options.map(option => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  }

  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type={type === 'number' ? 'number' : 'text'}
      value={value}
      onChange={e => handleChange(e.target.value)}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
      style={inputStyle}
      data-cell-key={cellKey}
      data-edit-type={type}
    />
  );
});

/**
 * Main reactive editing overlay component
 */
export const ReactiveEditingOverlay = observer<EditingOverlayProps>(({
  editingCell,
  onValueChange,
  onEditComplete,
  onEditCancel,
  className = ''
}) => {
  if (!editingCell) {
    return null;
  }

  fileLog.debug('✏️ Rendering editing overlay', {
    cellKey: editingCell.cellKey,
    type: editingCell.type,
    initialValue: editingCell.initialValue
  });

  const handleComplete = (value: string, cancelled: boolean) => {
    if (cancelled) {
      onEditCancel?.(editingCell.cellKey);
    } else {
      onEditComplete?.(editingCell.cellKey, value, cancelled);
    }
  };

  return (
    <div
      className={`vibegrid-editing-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: GRID_DIMENSIONS.Z_INDEX.EDITING
      }}
    >
      <CellEditor
        cellKey={editingCell.cellKey}
        initialValue={editingCell.initialValue || ''}
        type={editingCell.type || 'text'}
        options={editingCell.options}
        onValueChange={value => onValueChange?.(editingCell.cellKey, value)}
        onComplete={handleComplete}
      />
    </div>
  );
});

/**
 * Multi-cell editing overlay for batch operations
 */
export const MultipleCellEditingOverlay = observer<{
  editingCells: Array<{
    cellKey: string;
    initialValue: string;
    type?: 'text' | 'number' | 'textarea' | 'select';
    options?: string[];
  }>;
  onValueChange?: (cellKey: string, value: string) => void;
  onEditComplete?: (results: Array<{ cellKey: string; value: string; cancelled: boolean }>) => void;
  className?: string;
}>(({ editingCells, onValueChange, onEditComplete, className = '' }) => {
  const [completedEdits, setCompletedEdits] = useState<Array<{ cellKey: string; value: string; cancelled: boolean }>>([]);

  if (editingCells.length === 0) {
    return null;
  }

  const handleSingleComplete = (cellKey: string, value: string, cancelled: boolean) => {
    const newCompleted = [...completedEdits, { cellKey, value, cancelled }];
    setCompletedEdits(newCompleted);

    // If all cells are completed, call the parent handler
    if (newCompleted.length === editingCells.length) {
      onEditComplete?.(newCompleted);
      setCompletedEdits([]); // Reset for next batch
    }
  };

  return (
    <div
      className={`vibegrid-multiple-editing-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: GRID_DIMENSIONS.Z_INDEX.EDITING
      }}
    >
      {editingCells.map(cell => (
        <CellEditor
          key={cell.cellKey}
          cellKey={cell.cellKey}
          initialValue={cell.initialValue}
          type={cell.type || 'text'}
          options={cell.options}
          onValueChange={value => onValueChange?.(cell.cellKey, value)}
          onComplete={(value, cancelled) => handleSingleComplete(cell.cellKey, value, cancelled)}
        />
      ))}
    </div>
  );
});

/**
 * Formula editing overlay with enhanced features
 */
export const FormulaEditingOverlay = observer<{
  editingCell: {
    cellKey: string;
    formula: string;
    references?: string[];
  };
  onFormulaChange?: (cellKey: string, formula: string) => void;
  onEditComplete?: (cellKey: string, formula: string, cancelled: boolean) => void;
  className?: string;
}>(({ editingCell, onFormulaChange, onEditComplete, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const positionStyle$ = useCellPositionStyle$(editingCell.cellKey, {
    zIndex: GRID_DIMENSIONS.Z_INDEX.EDITING + 1,
    includeSize: true
  });

  const style = positionStyle$.get();

  if (!style.left || !style.top) {
    return null;
  }

  const expandedStyle: React.CSSProperties = isExpanded
    ? {
        minWidth: Math.max(300, Number(style.width) || 0),
        minHeight: Math.max(100, Number(style.height) || 0)
      }
    : {};

  return (
    <div
      className={`vibegrid-formula-editing-overlay ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'auto',
        zIndex: GRID_DIMENSIONS.Z_INDEX.EDITING + 1
      }}
    >
      <div
        style={{
          ...style,
          ...expandedStyle,
          border: '2px solid var(--formula-border-color, #00aa00)',
          backgroundColor: 'var(--formula-background-color, #f0fff0)',
          borderRadius: '4px',
          padding: '2px'
        }}
      >
        <CellEditor
          cellKey={editingCell.cellKey}
          initialValue={editingCell.formula}
          type="textarea"
          onValueChange={value => onFormulaChange?.(editingCell.cellKey, value)}
          onComplete={(value, cancelled) => onEditComplete?.(editingCell.cellKey, value, cancelled)}
        />

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            position: 'absolute',
            top: '2px',
            right: '2px',
            width: '16px',
            height: '16px',
            border: 'none',
            background: 'var(--formula-expand-button-color, #00aa00)',
            color: 'white',
            fontSize: '10px',
            cursor: 'pointer',
            borderRadius: '2px'
          }}
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
    </div>
  );
});