import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import type { RenderState, ViewportInfo, Column, TableRow } from '../types';
import { createPortal } from 'react-dom';

interface ReactRendererProps {
  renderState: RenderState | null;
  onScroll?: (viewport: ViewportInfo) => void;
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onColumnClick?: (columnId: string) => void;
  container: HTMLElement;
}

// Virtualized row component
const VirtualRow = memo(({ 
  row, 
  columns, 
  top, 
  selectedCells,
  editingCell,
  onCellClick 
}: {
  row: TableRow;
  columns: Column[];
  top: number;
  selectedCells: Set<string>;
  editingCell: { rowId: string; columnId: string } | null;
  onCellClick?: (rowId: string, columnId: string) => void;
}) => {
  return (
    <div 
      className="vibegridx-row"
      style={{
        position: 'absolute',
        top: `${top}px`,
        left: 0,
        width: '100%',
        height: '40px',
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        boxSizing: 'border-box'
      }}
      data-row-id={row.id}
    >
      {/* Selection checkbox */}
      <div 
        className="vibegridx-cell vibegridx-selection-cell"
        style={{
          width: '48px',
          height: '40px',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <input type="checkbox" />
      </div>
      
      {/* Data cells */}
      {columns.map(col => {
        const cellKey = `${row.id}:${col.id}`;
        const isSelected = selectedCells.has(cellKey);
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === col.id;
        const value = row.data[col.field || col.id];
        
        return (
          <div
            key={col.id}
            className={`vibegridx-cell ${isSelected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
            style={{
              width: `${col.width || 120}px`,
              height: '40px',
              borderRight: '1px solid var(--border)',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              backgroundColor: isSelected ? '#dbeafe' : isEditing ? '#fef3c7' : 'transparent',
              boxSizing: 'border-box'
            }}
            data-row-id={row.id}
            data-column-id={col.id}
            onClick={() => onCellClick?.(row.id, col.id)}
          >
            {value != null ? String(value) : ''}
          </div>
        );
      })}
    </div>
  );
});

VirtualRow.displayName = 'VirtualRow';

export const ReactRenderer: React.FC<ReactRendererProps> = ({
  renderState,
  onScroll,
  onCellClick,
  onCellDoubleClick,
  onColumnClick,
  container
}) => {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
  const viewportRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 40;
  
  // Calculate visible rows on scroll
  const handleScroll = useCallback(() => {
    if (!viewportRef.current || !renderState) return;
    
    const viewport = viewportRef.current;
    const scrollTop = viewport.scrollTop;
    const viewportHeight = viewport.clientHeight;
    
    const start = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT);
    const end = Math.min(start + visibleCount + 5, renderState.rows.length); // +5 buffer
    
    setVisibleRange({ start: Math.max(0, start - 5), end }); // -5 buffer
    
    // Report viewport info
    onScroll?.({
      start,
      end,
      height: viewportHeight,
      width: viewport.clientWidth,
      scrollTop,
      scrollLeft: viewport.scrollLeft,
      itemHeight: ROW_HEIGHT
    });
  }, [renderState, onScroll]);
  
  // Initial viewport calculation
  useEffect(() => {
    handleScroll();
  }, [handleScroll]);
  
  if (!renderState) return null;
  
  const { rows, columns, selectedCells, editingCell, coordinateMapping } = renderState;
  const totalHeight = rows.length * ROW_HEIGHT;
  const totalWidth = coordinateMapping?.columns?.reduce((sum: number, col: any) => sum + col.width, 0) || 800;
  
  // Get visible rows
  const visibleRows = rows.slice(visibleRange.start, visibleRange.end);
  
  return createPortal(
    <div className="vibegridx-table" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Header */}
      <div className="vibegridx-header-viewport" style={{ overflow: 'hidden', flexShrink: 0 }}>
        <div 
          className="vibegridx-header" 
          style={{ 
            display: 'flex', 
            height: '40px',
            borderBottom: '2px solid var(--border)',
            backgroundColor: 'var(--background)'
          }}
        >
          {/* Selection header */}
          <div 
            className="vibegridx-header-cell"
            style={{
              width: '48px',
              height: '40px',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <input type="checkbox" />
          </div>
          
          {/* Column headers */}
          {columns.map(col => (
            <div
              key={col.id}
              className="vibegridx-header-cell"
              style={{
                width: `${col.width || 120}px`,
                height: '40px',
                borderRight: '1px solid var(--border)',
                padding: '0 8px',
                display: 'flex',
                alignItems: 'center',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}
              data-column-id={col.id}
              onClick={() => onColumnClick?.(col.id)}
            >
              {col.name || col.id}
            </div>
          ))}
        </div>
      </div>
      
      {/* Viewport */}
      <div 
        ref={viewportRef}
        className="vibegridx-viewport"
        style={{
          flex: '1 1 auto',
          overflow: 'auto',
          position: 'relative'
        }}
        onScroll={handleScroll}
      >
        {/* Body with virtual height */}
        <div 
          className="vibegridx-body"
          style={{
            position: 'relative',
            height: `${totalHeight}px`,
            width: `${totalWidth}px`
          }}
        >
          {/* Render only visible rows */}
          {visibleRows.map((row, index) => (
            <VirtualRow
              key={row.id}
              row={row}
              columns={columns}
              top={(visibleRange.start + index) * ROW_HEIGHT}
              selectedCells={selectedCells}
              editingCell={editingCell}
              onCellClick={onCellClick}
            />
          ))}
        </div>
      </div>
      
      {/* Canvas overlay container for selection/editing */}
      <div 
        className="vibegridx-canvas-overlay-container"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 100
        }}
      />
    </div>,
    container
  );
};