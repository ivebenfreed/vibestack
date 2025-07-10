import React from 'react';
import type { CellRef, ViewportInfo, Column } from '../types';
import { CanvasOverlayCoreV2 } from './CanvasOverlayCoreV2';
import type { OverlayConfig } from './OverlayTypes';

// ====================================
// CANVAS OVERLAY MANAGER
// ====================================

export class CanvasOverlayManager {
  private overlay: CanvasOverlayCoreV2;
  private container: HTMLElement;
  
  // Public API for backward compatibility
  public stage: any; // Exposed for VibeGridX
  public selectionManager: any; // Exposed for keyboard shortcuts
  public overlayRenderer: {
    handleCopy: (cells: Set<string>) => void;
    handleCut: (cells: Set<string>) => void;
    handlePaste: () => void;
    cancelFill: () => void;
  }; // Exposed for copy/cut/paste and fill operations

  constructor(container: HTMLElement, config: Partial<OverlayConfig> = {}) {
    this.container = container;
    
    // Create the V2 overlay system (XState-based)
    this.overlay = new CanvasOverlayCoreV2(container, config);
    console.log('CanvasOverlayManager: Initialized with XState architecture');
    
    // Get the renderer reference
    const renderer = (this.overlay as any).renderer;
    
    // Expose parts of the API for backward compatibility
    this.stage = (this.overlay as any).stage;
    this.overlayRenderer = {
      handleCopy: (cells: Set<string>) => renderer.handleCopy(cells),
      handleCut: (cells: Set<string>) => renderer.handleCut(cells),
      handlePaste: () => renderer.handlePaste(),
      cancelFill: () => this.overlay.cancelFill()
    };
    this.selectionManager = {
      showCopyIndicator: (isCut: boolean) => this.overlay.showCopyIndicator(isCut),
      hideCopyIndicator: () => this.overlay.hideCopyIndicator()
    };
  }

  // Update data mappings (row/column IDs)
  updateDataMappings(rowIds: string[], columnIds: string[]): void {
    this.overlay.updateDataMappings(rowIds, columnIds);
  }

  // Update selection
  updateSelection(selectedCells: Set<string>): void {
    this.overlay.updateSelection(selectedCells);
  }
  
  // Update selection with DOM positions - NEW METHOD
  updateSelectionWithDOMPositions(cellElements: Map<string, DOMRect>): void {
    this.overlay.updateSelectionWithDOMPositions(cellElements);
  }

  // Update editing cell
  updateEditingCell(editingCell: CellRef | null): void {
    this.overlay.updateEditingCell(editingCell);
  }

  // Update viewport (called on scroll)
  updateViewport(viewport: ViewportInfo): void {
    this.overlay.updateViewport(viewport);
  }

  // Set selection change callback
  setOnSelectionChange(callback: (selectedCells: Set<string>) => void): void {
    this.overlay.onSelectionChange = callback;
  }

  // Set fill complete callback
  setOnFillComplete(callback: (originalCells: Set<string>, fillCells: Set<string>) => void): void {
    this.overlay.onFillComplete = callback;
  }

  // Performance metrics
  getPerformanceMetrics() {
    return this.overlay.getPerformanceMetrics();
  }

  // Destroy
  destroy(): void {
    this.overlay.destroy();
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