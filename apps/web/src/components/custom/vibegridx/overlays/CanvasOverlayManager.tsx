import React from 'react';
import type { CellRef, ViewportInfo, Column } from '../types';
import { CanvasOverlayCore } from './CanvasOverlayCore';
import type { OverlayConfig } from './OverlayTypes';

// ====================================
// CANVAS OVERLAY MANAGER
// ====================================

export class CanvasOverlayManager {
  private core: CanvasOverlayCore;
  private container: HTMLElement;
  
  // Public API for backward compatibility
  public stage: any; // Exposed for VibeGridX
  public selectionManager: any; // Exposed for keyboard shortcuts

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    
    // Create the core overlay system
    this.core = new CanvasOverlayCore(container, config);
    
    // Expose parts of the API for backward compatibility
    this.stage = (this.core as any).stage;
    this.selectionManager = {
      showCopyIndicator: (isCut: boolean) => this.core.showCopyIndicator(isCut),
      hideCopyIndicator: () => this.core.hideCopyIndicator()
    };
    
    console.log('CanvasOverlayManager: Initialized with new modular architecture');
  }

  // Update data mappings (row/column IDs)
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    this.core.updateDataMappings(rowIds, columnIds);
  }

  // Columns are now passed during initialization via config.dimensionManager

  // Update selection
  updateSelection(selectedCells: Set<string>): void {
    this.core.updateSelection(selectedCells);
  }

  // Update editing cell
  updateEditingCell(editingCell: CellRef | null): void {
    this.core.updateEditingCell(editingCell);
  }

  // Update viewport (called on scroll)
  updateViewport(viewport: ViewportInfo): void {
    this.core.updateViewport(viewport);
  }

  // Set selection change callback
  setOnSelectionChange(callback: (selectedCells: Set<string>) => void): void {
    this.core.onSelectionChange = callback;
  }

  // Set fill complete callback
  setOnFillComplete(callback: (originalCells: Set<string>, fillCells: Set<string>) => void): void {
    this.core.onFillComplete = callback;
  }

  // Performance metrics
  getPerformanceMetrics() {
    return this.core.getPerformanceMetrics();
  }

  // Destroy
  destroy(): void {
    this.core.destroy();
  }
}

// ====================================
// REACT COMPONENT (Optional)
// ====================================

export const CanvasOverlay: React.FC<{
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  viewport: ViewportInfo;
  config?: Partial<OverlayConfig>;
  onSelectionChange?: (selectedCells: Set<string>) => void;
}> = ({ selectedCells, editingCell, viewport, config, onSelectionChange }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const managerRef = React.useRef<CanvasOverlayManager | null>(null);

  React.useEffect(() => {
    if (!containerRef.current) return;

    // Create overlay manager
    const manager = new CanvasOverlayManager(containerRef.current, config);
    managerRef.current = manager;

    // Set callback
    if (onSelectionChange) {
      manager.setOnSelectionChange(onSelectionChange);
    }

    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []);

  // Update selection
  React.useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateSelection(selectedCells);
    }
  }, [selectedCells]);

  // Update editing cell
  React.useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateEditingCell(editingCell);
    }
  }, [editingCell]);

  // Update viewport
  React.useEffect(() => {
    if (managerRef.current) {
      managerRef.current.updateViewport(viewport);
    }
  }, [viewport]);

  return (
    <div 
      ref={containerRef}
      className="vibegridx-canvas-overlay"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none'
      }}
    />
  );
};