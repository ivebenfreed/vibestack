import type { ViewportInfo } from '../types';
import type { CoordinateMapping } from '../machines/table-machine/slices/dimensions-slice';
import type { VisualCellPosition } from './OverlayTypes';

// ====================================
// FILL HANDLE LAYER - DOM Implementation
// ====================================

export interface FillHandleConfig {
  cellHeight: number;
  selectionBorderColor: string;
}

export interface FillHandleCallbacks {
  onFillStart: (direction: 'vertical' | 'horizontal') => void;
  onFillPreview: (previewCells: Set<string>) => void;
  onFillComplete: (fillCells: Set<string>) => void;
  onFillCancel: () => void;
  getSelectedCells: () => Set<string>;
}

export class FillHandleLayerDOM {
  private container: HTMLElement;
  private config: FillHandleConfig;
  private callbacks: FillHandleCallbacks;
  private coordinateMapping: CoordinateMapping | null = null;
  private currentViewport: ViewportInfo | null = null;
  
  // DOM elements
  private fillHandleContainer: HTMLDivElement | null = null;
  private fillHandle: HTMLDivElement | null = null;
  private previewContainer: HTMLDivElement | null = null;
  private previewElements = new Map<string, HTMLDivElement>();
  
  // Drag state
  private isDragging = false;
  private dragStartPos: { x: number; y: number } | null = null;
  private dragDirection: 'vertical' | 'horizontal' | null = null;
  
  // Semantic throttling - only process when meaningful changes occur
  private lastRowsToFill: number = 0;
  private lastFillDirection: boolean | null = null;
  private cachedBounds: any = null;
  
  // Visual settings
  private handleSize = 10;
  
  constructor(
    container: HTMLElement,
    config: FillHandleConfig,
    callbacks: FillHandleCallbacks
  ) {
    this.container = container;
    this.config = config;
    this.callbacks = callbacks;
    
    this.initContainers();
  }
  
  /**
   * Initialize DOM containers
   */
  private initContainers(): void {
    // Create fill handle container
    this.fillHandleContainer = document.createElement('div');
    this.fillHandleContainer.className = 'vibegridx-fill-handle-container';
    Object.assign(this.fillHandleContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      pointerEvents: 'none',
      zIndex: '20'
    });
    
    // Create preview container
    this.previewContainer = document.createElement('div');
    this.previewContainer.className = 'vibegridx-fill-preview-container';
    Object.assign(this.previewContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      right: '0',
      bottom: '0',
      pointerEvents: 'none',
      zIndex: '15'
    });
    
    this.container.appendChild(this.previewContainer);
    this.container.appendChild(this.fillHandleContainer);
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  /**
   * Update coordinate mapping when it changes
   */
  updateCoordinateMapping(mapping: CoordinateMapping): void {
    this.coordinateMapping = mapping;
  }
  
  /**
   * Update viewport and coordinate mapping directly (simplified approach like selections)
   */
  updateViewportAndMapping(viewport: ViewportInfo | null, mapping: CoordinateMapping | null): void {
    this.currentViewport = viewport;
    if (mapping) {
      this.coordinateMapping = mapping;
    }
    console.log('FillHandleLayerDOM: Updated viewport and mapping', {
      hasViewport: !!this.currentViewport,
      hasMapping: !!this.coordinateMapping,
      viewport: this.currentViewport,
      timestamp: Date.now()
    });
  }
  
  /**
   * Render fill handle using pre-calculated visual positions
   */
  renderFillHandleWithVisualPositions(visualCells: VisualCellPosition[], selectedRows?: Set<string>): void {
    // Invalidate cached bounds when selection changes
    this.cachedBounds = null;
    if (visualCells.length === 0) {
      this.hideFillHandle();
      return;
    }
    
    // Calculate bounds from visual positions
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    for (const cell of visualCells) {
      const cellRight = cell.x + cell.width;
      const cellBottom = cell.y + cell.height;
      
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cellRight);
      maxY = Math.max(maxY, cellBottom);
    }
    
    if (minX === Infinity) {
      this.hideFillHandle();
      return;
    }
    
    // Check if this is a complete row selection
    const isCompleteRowSelection = this.isCompleteRowSelection(visualCells, selectedRows);
    
    let handleX: number;
    let handleY: number;
    
    if (isCompleteRowSelection) {
      // Position fill handle in checkbox column for row selections
      const CHECKBOX_COLUMN_WIDTH = 48;
      handleX = CHECKBOX_COLUMN_WIDTH - this.handleSize / 2;
      handleY = maxY - this.handleSize / 2;
      
      console.log('FillHandleLayerDOM: Positioning fill handle in checkbox column', {
        handleX,
        handleY,
        selectedRowsCount: selectedRows?.size || 0
      });
    } else {
      // Position at bottom-right of cell selection
      handleX = maxX - this.handleSize / 2;
      handleY = maxY - this.handleSize / 2;
      
      console.log('FillHandleLayerDOM: Positioning fill handle at bottom-right', {
        handleX,
        handleY,
        bounds: { minX, minY, maxX, maxY }
      });
    }
    
    // Create or update fill handle
    this.showFillHandle(handleX, handleY);
  }
  
  /**
   * Show fill handle at specified position
   */
  private showFillHandle(x: number, y: number): void {
    if (!this.fillHandle) {
      // Create fill handle element
      this.fillHandle = document.createElement('div');
      this.fillHandle.className = 'vibegridx-fill-handle';
      Object.assign(this.fillHandle.style, {
        position: 'absolute',
        width: `${this.handleSize}px`,
        height: `${this.handleSize}px`,
        backgroundColor: this.config.selectionBorderColor,
        border: '2px solid white',
        borderRadius: '2px',
        cursor: 'crosshair',
        pointerEvents: 'auto',
        zIndex: '25',
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        transition: 'transform 150ms ease-out'
      });
      
      // Event handlers are managed by EventDelegationManager through vibegridx-fill-handle class
      
      if (this.fillHandleContainer) {
        this.fillHandleContainer.appendChild(this.fillHandle);
      }
    }
    
    // Update position
    Object.assign(this.fillHandle.style, {
      left: `${x}px`,
      top: `${y}px`,
      display: 'block',
      transform: 'scale(1)'
    });
    
    // Add hover effect
    this.fillHandle.addEventListener('mouseenter', () => {
      if (this.fillHandle && !this.isDragging) {
        this.fillHandle.style.transform = 'scale(1.2)';
      }
    });
    
    this.fillHandle.addEventListener('mouseleave', () => {
      if (this.fillHandle && !this.isDragging) {
        this.fillHandle.style.transform = 'scale(1)';
      }
    });
  }
  
  /**
   * Hide fill handle
   */
  hideFillHandle(): void {
    if (this.fillHandle) {
      this.fillHandle.style.display = 'none';
    }
    this.clearFillPreview();
  }
  
  /**
   * Render fill preview
   */
  renderFillPreview(previewCells: Set<string>, viewport: ViewportInfo): void {
    this.clearFillPreview();
    
    if (!this.coordinateMapping || previewCells.size === 0) return;
    
    for (const cellKey of previewCells) {
      const [rowId, columnId] = cellKey.split(':');
      
      // Find coordinates
      const rowCoord = this.coordinateMapping.rows.find(r => r.rowId === rowId);
      const colCoord = this.coordinateMapping.columns.find(c => c.columnId === columnId);
      
      if (!rowCoord || !colCoord) continue;
      
      const rowIndex = this.coordinateMapping.rows.indexOf(rowCoord);
      
      // Check if in viewport
      if (rowIndex < viewport.start || rowIndex > viewport.end) continue;
      
      // Calculate position
      const viewportOffset = viewport.start * this.config.cellHeight;
      const x = colCoord.x;
      const y = rowCoord.y - viewportOffset;
      
      // Create preview element
      const preview = document.createElement('div');
      preview.className = 'vibegridx-fill-preview';
      preview.dataset.cellKey = cellKey;
      Object.assign(preview.style, {
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${colCoord.width}px`,
        height: `${rowCoord.height}px`,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '2px dashed rgba(59, 130, 246, 0.5)',
        boxSizing: 'border-box',
        pointerEvents: 'none',
        opacity: '0',
        transition: 'opacity 150ms ease-out'
      });
      
      if (this.previewContainer) {
        this.previewContainer.appendChild(preview);
        this.previewElements.set(cellKey, preview);
        
        // Animate in
        requestAnimationFrame(() => {
          preview.style.opacity = '1';
        });
      }
    }
  }
  
  /**
   * Render fill preview with visual positions directly (same path as selections)
   */
  renderFillPreviewWithVisualPositions(visualCells: VisualCellPosition[]): void {
    console.log('FillHandleLayerDOM: renderFillPreviewWithVisualPositions', {
      cellCount: visualCells.length,
      containerExists: !!this.container,
      firstCells: visualCells.slice(0, 2).map(c => ({
        key: c.cellKey,
        pos: { x: c.x, y: c.y, w: c.width, h: c.height }
      }))
    });
    
    // Build set of new cell keys for comparison (same pattern as selections)
    const newCellKeys = new Set(visualCells.map(cell => cell.cellKey));
    const currentCellKeys = new Set(this.previewElements.keys());
    
    // Remove elements that are no longer in preview (smooth removal like selections)
    for (const cellKey of currentCellKeys) {
      if (!newCellKeys.has(cellKey)) {
        console.log(`FillHandleLayerDOM: Removing preview cell ${cellKey}`);
        this.removeFillPreviewElement(cellKey);
      }
    }
    
    // Add or update elements for new/existing preview cells (same pattern as selections)
    for (const cell of visualCells) {
      const cellKey = cell.cellKey;
      const isNewPreview = !currentCellKeys.has(cellKey);
      
      console.log(`FillHandleLayerDOM: ${isNewPreview ? 'Adding new' : 'Updating existing'} preview element for ${cellKey}`, {
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height
      });
      
      this.addOrUpdateFillPreviewElement(cellKey, {
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height
      });
    }
    
    console.log('FillHandleLayerDOM: Fill preview elements updated', {
      elementCount: this.previewElements.size,
      elementKeys: Array.from(this.previewElements.keys())
    });
  }
  
  /**
   * Add or update a fill preview element (same pattern as selections)
   */
  private addOrUpdateFillPreviewElement(
    cellKey: string,
    position: { x: number; y: number; width: number; height: number }
  ): void {
    let element = this.previewElements.get(cellKey);
    
    if (!element) {
      // Create new preview element (same pattern as selections)
      element = document.createElement('div');
      element.className = 'vibegridx-fill-preview';
      element.dataset.cellKey = cellKey;
      
      // Apply styles (same pattern as selections but with dashed border for preview)
      Object.assign(element.style, {
        position: 'absolute',
        pointerEvents: 'none',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '2px dashed rgba(59, 130, 246, 0.5)',
        boxSizing: 'border-box',
        zIndex: '15',
        opacity: '0', // Start invisible for animation
        transition: 'opacity 150ms ease-out, left 150ms ease-out, top 150ms ease-out'
      });
      
      if (this.previewContainer) {
        this.previewContainer.appendChild(element);
        this.previewElements.set(cellKey, element);
        
        // Animate in (same as selections)
        requestAnimationFrame(() => {
          element.style.opacity = '1';
        });
      }
    }
    
    // Update position and size (smooth transitions like selections)
    Object.assign(element.style, {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${position.width}px`,
      height: `${position.height}px`
    });
  }
  
  /**
   * Remove a fill preview element with animation (same pattern as selections)
   */
  private removeFillPreviewElement(cellKey: string): void {
    const element = this.previewElements.get(cellKey);
    if (!element) return;
    
    // Animate out (same as selections)
    element.style.transition = 'opacity 150ms ease-in';
    element.style.opacity = '0';
    
    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.previewElements.delete(cellKey);
    }, 150);
  }

  /**
   * Clear fill preview
   */
  clearFillPreview(): void {
    for (const element of this.previewElements.values()) {
      element.remove();
    }
    this.previewElements.clear();
  }
  
  /**
   * Calculate fill preview cells based on drag position
   */
  calculateFillPreviewCells(
    dragPos: { x: number; y: number },
    selectedCells: Set<string>,
    viewport: ViewportInfo
  ): Set<string> {
    console.log('FillHandleLayerDOM: calculateFillPreviewCells called', {
      dragPos,
      selectedCellsSize: selectedCells.size,
      selectedCellsArray: Array.from(selectedCells),
      hasCoordinateMapping: !!this.coordinateMapping
    });
    
    if (!this.coordinateMapping || selectedCells.size === 0) {
      console.log('FillHandleLayerDOM: Early return - missing coordinate mapping or no selected cells');
      return new Set();
    }
    
    // Get bounds of selected cells
    const bounds = this.getSelectionBounds(selectedCells);
    console.log('FillHandleLayerDOM: getSelectionBounds result', bounds);
    if (!bounds) {
      console.log('FillHandleLayerDOM: No bounds calculated, returning empty set');
      return new Set();
    }
    
    // Force vertical-only direction as requested (vertical only)
    const dragDeltaY = Math.abs(dragPos.y - bounds.centerY);
    const direction = 'vertical'; // Always vertical as requested by user
    
    console.log('FillHandleLayerDOM: Drag direction and distance', {
      dragDeltaY,
      direction,
      boundsCenter: { x: bounds.centerX, y: bounds.centerY },
      cellHeight: this.config.cellHeight
    });
    
    // Only vertical filling (as requested by user)
    const rowsToFill = Math.floor(dragDeltaY / this.config.cellHeight);
    const fillDown = dragPos.y > bounds.centerY;
    
    console.log('FillHandleLayerDOM: Vertical fill calculation', {
      rowsToFill,
      fillDown,
      dragDeltaY,
      cellHeight: this.config.cellHeight,
      availableRows: this.coordinateMapping.rows.length
    });
    
    const previewCells = new Set<string>();
    
    // Early return if no cells to fill (user dragged back to original selection)
    if (rowsToFill === 0) {
      console.log('FillHandleLayerDOM: No rows to fill - user dragged back to original selection');
      // Clear any existing preview immediately
      this.clearFillPreview();
      // Also send empty preview through callback to ensure state machine clears its preview
      this.callbacks.onFillPreview(previewCells);
      return previewCells; // Return empty set
    }
    
    // Add cells in vertical direction only
    for (let i = 1; i <= rowsToFill; i++) {
      const targetRowIndex = fillDown ? 
        bounds.maxRowIndex + i : 
        bounds.minRowIndex - i;
      
      console.log(`FillHandleLayerDOM: Processing fill row ${i}, targetRowIndex: ${targetRowIndex}`);
      
      if (targetRowIndex >= 0 && targetRowIndex < this.coordinateMapping.rows.length) {
        const targetRow = this.coordinateMapping.rows[targetRowIndex];
        
        // Add cells for each column in selection
        for (let c = bounds.minColIndex; c <= bounds.maxColIndex; c++) {
          const col = this.coordinateMapping.columns[c];
          if (col) {
            const cellKey = `${targetRow.rowId}:${col.columnId}`;
            previewCells.add(cellKey);
            console.log(`FillHandleLayerDOM: Added preview cell: ${cellKey}`);
          }
        }
      } else {
        console.log(`FillHandleLayerDOM: Target row index ${targetRowIndex} out of bounds`);
      }
    }
    
    return previewCells;
  }
  
  // ====================================
  // PRIVATE HELPERS
  // ====================================
  
  /**
   * Check if selection represents complete rows
   */
  private isCompleteRowSelection(visualCells: VisualCellPosition[], selectedRows?: Set<string>): boolean {
    if (!selectedRows || selectedRows.size === 0) return false;
    
    // Check if we have cells for all columns in the selected rows
    const rowIds = new Set(visualCells.map(c => c.cellKey.split(':')[0]));
    return rowIds.size === selectedRows.size;
  }
  
  /**
   * Get selection bounds
   */
  private getSelectionBounds(selectedCells: Set<string>) {
    if (!this.coordinateMapping) {
      console.log('FillHandleLayerDOM: getSelectionBounds - no coordinate mapping');
      return null;
    }
    
    let minRowIndex = Infinity, maxRowIndex = -Infinity;
    let minColIndex = Infinity, maxColIndex = -Infinity;
    
    console.log('FillHandleLayerDOM: getSelectionBounds processing cells', {
      selectedCellsArray: Array.from(selectedCells),
      availableRows: this.coordinateMapping.rows.length,
      availableCols: this.coordinateMapping.columns.length
    });
    
    for (const cellKey of selectedCells) {
      const [rowId, columnId] = cellKey.split(':');
      console.log(`FillHandleLayerDOM: Processing cell ${cellKey} (rowId: ${rowId}, columnId: ${columnId})`);
      
      const rowIndex = this.coordinateMapping.rows.findIndex(r => r.rowId === rowId);
      const colIndex = this.coordinateMapping.columns.findIndex(c => c.columnId === columnId);
      
      console.log(`FillHandleLayerDOM: Found indices - row: ${rowIndex}, col: ${colIndex}`);
      
      if (rowIndex !== -1 && colIndex !== -1) {
        minRowIndex = Math.min(minRowIndex, rowIndex);
        maxRowIndex = Math.max(maxRowIndex, rowIndex);
        minColIndex = Math.min(minColIndex, colIndex);
        maxColIndex = Math.max(maxColIndex, colIndex);
      } else {
        console.log(`FillHandleLayerDOM: Could not find indices for cell ${cellKey}`);
      }
    }
    
    if (minRowIndex === Infinity) {
      console.log('FillHandleLayerDOM: No valid cell indices found');
      return null;
    }
    
    const minRow = this.coordinateMapping.rows[minRowIndex];
    const maxRow = this.coordinateMapping.rows[maxRowIndex];
    const minCol = this.coordinateMapping.columns[minColIndex];
    const maxCol = this.coordinateMapping.columns[maxColIndex];
    
    const centerX = (minCol.offset + maxCol.offset + maxCol.width) / 2;
    // Since row offset is undefined, calculate it using row index * cell height
    const minRowOffset = minRowIndex * this.config.cellHeight;
    const centerY = minRowOffset + this.config.cellHeight / 2;
    
    console.log('FillHandleLayerDOM: Center calculation', {
      minColOffset: minCol.offset,
      maxColOffset: maxCol.offset,
      maxColWidth: maxCol.width,
      centerX: centerX,
      minRowIndex: minRowIndex,
      minRowOffset: minRowOffset,
      cellHeight: this.config.cellHeight,
      centerY: centerY
    });
    
    const bounds = {
      minRowIndex,
      maxRowIndex,
      minColIndex,
      maxColIndex,
      centerX: centerX,
      centerY: centerY
    };
    
    console.log('FillHandleLayerDOM: Calculated bounds', bounds);
    
    return bounds;
  }
  
  // ====================================
  // PUBLIC METHODS FOR UNIFIED EVENT SYSTEM
  // ====================================
  
  /**
   * Handle fill move from EventDelegationManager with semantic throttling
   */
  handleFillMove(dragPos: { x: number; y: number }): void {
    const selectedCells = this.callbacks.getSelectedCells();
    const viewport = this.currentViewport;
    
    if (!viewport || !this.coordinateMapping || selectedCells.size === 0) {
      return;
    }

    // Use cached bounds if available (expensive operation)
    if (!this.cachedBounds) {
      this.cachedBounds = this.getSelectionBounds(selectedCells);
      if (!this.cachedBounds) return;
    }

    const dragDeltaY = Math.abs(dragPos.y - this.cachedBounds.centerY);
    const rowsToFill = Math.floor(dragDeltaY / this.config.cellHeight);
    const fillDown = dragPos.y > this.cachedBounds.centerY;

    // SEMANTIC THROTTLING: Only process if meaningful change occurred
    if (rowsToFill === this.lastRowsToFill && fillDown === this.lastFillDirection) {
      // Same result as last calculation - skip expensive operations
      return;
    }

    // Store semantic values for next comparison
    this.lastRowsToFill = rowsToFill;
    this.lastFillDirection = fillDown;

    // Now do the expensive calculation only when needed
    const previewCells = this.calculateFillPreviewCells(dragPos, selectedCells, viewport);
    this.callbacks.onFillPreview(previewCells);
  }
  
  /**
   * Handle fill start from EventDelegationManager
   */
  handleFillStart(): void {
    // Reset semantic throttling state for new drag operation
    this.lastRowsToFill = 0;
    this.lastFillDirection = null;
    this.cachedBounds = null;
    
    this.callbacks.onFillStart('vertical'); // Always vertical as requested
  }
  
  /**
   * Handle fill complete from EventDelegationManager
   */
  handleFillComplete(dragPos: { x: number; y: number }): void {
    console.log('FillHandleLayerDOM: Fill complete via unified system', {
      dragPos
    });
    
    const selectedCells = this.callbacks.getSelectedCells();
    const viewport = this.currentViewport;
    
    if (viewport && this.coordinateMapping) {
      const fillCells = this.calculateFillPreviewCells(dragPos, selectedCells, viewport);
      
      if (fillCells.size > 0) {
        console.log('FillHandleLayerDOM: Calling onFillComplete with', fillCells.size, 'cells');
        this.callbacks.onFillComplete(fillCells);
      } else {
        console.log('FillHandleLayerDOM: Calling onFillCancel - no fill cells calculated');
        this.callbacks.onFillCancel();
      }
    } else {
      console.warn('FillHandleLayerDOM: Cannot complete fill - missing viewport or coordinate mapping');
    }
    
    // Clear preview after completion
    this.clearFillPreview();
  }
  
  /**
   * Destroy the layer and clean up
   */
  destroy(): void {
    this.hideFillHandle();
    
    if (this.fillHandle) {
      this.fillHandle.remove();
      this.fillHandle = null;
    }
    
    if (this.fillHandleContainer) {
      this.fillHandleContainer.remove();
      this.fillHandleContainer = null;
    }
    
    if (this.previewContainer) {
      this.previewContainer.remove();
      this.previewContainer = null;
    }
  }
}