import type { ViewportInfo } from '../types';
import type { CoordinateMapping } from '../types';
import type { VisualCellPosition } from './OverlayTypes';

// ====================================
// DOM SELECTION OVERLAY
// ====================================

export interface SelectionOverlayConfig {
  selectionColor: string;
  selectionBorderColor: string;
  borderWidth: number;
  cellHeight: number;
}

export class SelectionOverlayDOM {
  private container: HTMLElement;
  private config: SelectionOverlayConfig;
  
  // Selection elements
  private selectionElements = new Map<string, HTMLDivElement>();
  
  // Fill preview elements (dotted border style)
  private fillPreviewElements = new Map<string, HTMLDivElement>();
  
  // Track previous state to avoid unnecessary updates
  private lastSelectedCells = new Set<string>();
  
  // Track elements being animated out for cleanup
  private animatingOut = new Set<string>();
  
  // Track document event listeners for cleanup
  private documentEventListeners = new Array<{ type: string, handler: EventListener, options: any }>();
  
  constructor(
    container: HTMLElement,
    config: SelectionOverlayConfig
  ) {
    this.container = container;
    this.config = config;
    
    // Ensure container has relative positioning for absolute children
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    
    console.log('SelectionOverlayDOM: Created', {
      container: this.container,
      config: this.config
    });
  }
  
  /**
   * Update selection using coordinate mapping directly (pure XState approach)
   */
  updateSelectionWithMapping(selectedCells: Set<string>, viewport: ViewportInfo | null, coordinateMapping: any): void {
    console.log('SelectionOverlayDOM.updateSelectionWithMapping called', {
      selectedCells: selectedCells.size,
      selectedCellKeys: Array.from(selectedCells),
      viewport: viewport,
      hasCoordinateMapping: !!coordinateMapping,
      coordinateVersion: coordinateMapping?.version,
      rowCount: coordinateMapping?.rows?.length,
      colCount: coordinateMapping?.columns?.length
    });

    if (selectedCells.size === 0) {
      this.clearSelection();
      return;
    }

    if (!viewport || !coordinateMapping) {
      console.warn('SelectionOverlayDOM: Missing viewport or coordinate mapping for selection render', {
        hasViewport: !!viewport,
        hasCoordinateMapping: !!coordinateMapping
      });
      return;
    }

    // Calculate visible selected cells using coordinate mapping directly
    const visibleCells = new Set<string>();
    const cellPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    
    for (const cellKey of selectedCells) {
      const [rowId, columnId] = cellKey.split(':');
      
      // Find row and column in coordinate mapping
      const rowCoord = coordinateMapping.rows.find((r: any) => r.rowId === rowId);
      const colCoord = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
      
      if (!rowCoord || !colCoord) continue;
      
      const rowIndex = coordinateMapping.rows.indexOf(rowCoord);
      
      // Check if cell is in viewport
      if (rowIndex >= viewport.start && rowIndex <= viewport.end) {
        visibleCells.add(cellKey);
        
        // Calculate position based on coordinate mapping
        // Adjust for viewport offset
        const viewportOffset = viewport.start * this.config.cellHeight;
        cellPositions.set(cellKey, {
          x: colCoord.offset,
          y: rowCoord.offset - viewportOffset,
          width: colCoord.width,
          height: this.config.cellHeight
        });
      }
    }

    console.log('SelectionOverlayDOM: Visible cells calculated', {
      totalSelected: selectedCells.size,
      visibleCount: visibleCells.size,
      viewport: {
        start: viewport.start,
        end: viewport.end
      }
    });

    // Remove selection elements that are no longer selected
    for (const [cellKey, element] of this.selectionElements) {
      if (!visibleCells.has(cellKey)) {
        this.removeSelectionElement(cellKey);
      }
    }

    // Add or update selection elements for visible cells
    for (const cellKey of visibleCells) {
      const position = cellPositions.get(cellKey);
      if (position) {
        this.addOrUpdateSelectionElement(cellKey, position);
      }
    }

    this.lastSelectedCells = new Set(selectedCells);
  }
  
  /**
   * Update with visual cell positions directly - Excel-style unified selection
   */
  updateWithVisualPositions(visualCells: VisualCellPosition[]): void {
    console.log('SelectionOverlayDOM.updateWithVisualPositions', {
      cellCount: visualCells.length,
      containerExists: !!this.container,
      containerInDom: this.container ? document.body.contains(this.container) : false,
      containerClass: this.container?.className,
      firstCells: visualCells.slice(0, 2).map(c => ({
        key: c.cellKey,
        pos: { x: c.x, y: c.y, w: c.width, h: c.height }
      }))
    });
    
    // Clear all existing selection elements
    this.clearSelectionElements();
    
    if (visualCells.length === 0) {
      return;
    }
    
    if (visualCells.length === 1) {
      // Single cell selection - show individual cell highlight
      const cell = visualCells[0];
      this.addOrUpdateSelectionElement(cell.cellKey, {
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height
      });
    } else {
      // Multi-cell selection - create unified selection rectangle
      this.createUnifiedSelectionRectangle(visualCells);
    }
    
    console.log('SelectionOverlayDOM: After unified selection update', {
      elementCount: this.selectionElements.size,
      elementKeys: Array.from(this.selectionElements.keys())
    });
  }
  
  /**
   * Create a unified selection rectangle for multi-cell selections (Excel-style)
   * - Thin border around entire selection
   * - Thick border on anchor cell (top-left)
   */
  private createUnifiedSelectionRectangle(visualCells: VisualCellPosition[]): void {
    // Calculate bounding rectangle for all selected cells
    const minX = Math.min(...visualCells.map(c => c.x));
    const minY = Math.min(...visualCells.map(c => c.y));
    const maxX = Math.max(...visualCells.map(c => c.x + c.width));
    const maxY = Math.max(...visualCells.map(c => c.y + c.height));
    
    const boundingRect = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
    
    // Find the anchor cell (top-left cell in the selection)
    const anchorCell = visualCells.find(cell => cell.x === minX && cell.y === minY);
    
    console.log('SelectionOverlayDOM: Creating Excel-style unified selection', {
      boundingRect,
      cellCount: visualCells.length,
      anchorCell: anchorCell ? { key: anchorCell.cellKey, x: anchorCell.x, y: anchorCell.y } : null
    });
    
    // 1. Create thin unified selection rectangle for entire range
    const unifiedElement = document.createElement('div');
    unifiedElement.className = 'vibegridx-selection-overlay vibegridx-unified-selection';
    unifiedElement.dataset.cellKey = 'unified-selection';
    
    const thinBorderWidth = Math.max(1, Math.floor(this.config.borderWidth / 2));
    
    Object.assign(unifiedElement.style, {
      position: 'absolute',
      left: `${boundingRect.x}px`,
      top: `${boundingRect.y}px`,
      width: `${boundingRect.width}px`,
      height: `${boundingRect.height}px`,
      pointerEvents: 'none',
      backgroundColor: this.config.selectionColor,
      border: `${thinBorderWidth}px solid ${this.config.selectionBorderColor}`,
      boxSizing: 'border-box',
      zIndex: '10',
      opacity: '0',
      transform: 'scale(0.98)',
      transition: 'opacity 200ms ease-out, transform 200ms ease-out'
    });
    
    this.container.appendChild(unifiedElement);
    this.selectionElements.set('unified-selection', unifiedElement);
    
    // 2. Create thick border on anchor cell (Excel-style)
    if (anchorCell) {
      const anchorElement = document.createElement('div');
      anchorElement.className = 'vibegridx-selection-overlay vibegridx-anchor-cell';
      anchorElement.dataset.cellKey = 'anchor-cell';
      
      Object.assign(anchorElement.style, {
        position: 'absolute',
        left: `${anchorCell.x}px`,
        top: `${anchorCell.y}px`,
        width: `${anchorCell.width}px`,
        height: `${anchorCell.height}px`,
        pointerEvents: 'none',
        backgroundColor: 'transparent', // No fill, just border
        border: `${this.config.borderWidth}px solid ${this.config.selectionBorderColor}`,
        boxSizing: 'border-box',
        zIndex: '11', // Above unified selection
        opacity: '0',
        transform: 'scale(0.98)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out'
      });
      
      this.container.appendChild(anchorElement);
      this.selectionElements.set('anchor-cell', anchorElement);
      
      console.log('SelectionOverlayDOM: Anchor cell element created', {
        position: { x: anchorCell.x, y: anchorCell.y, width: anchorCell.width, height: anchorCell.height },
        thickBorder: this.config.borderWidth,
        thinBorder: thinBorderWidth
      });
    }
    
    // 3. Create fill handle at bottom-right corner of selection (Excel-style)
    const fillHandleSize = 8;
    const fillHandleElement = document.createElement('div');
    fillHandleElement.className = 'vibegridx-fill-handle';
    fillHandleElement.dataset.cellKey = 'fill-handle';
    
    Object.assign(fillHandleElement.style, {
      position: 'absolute',
      left: `${boundingRect.x + boundingRect.width - fillHandleSize / 2}px`,
      top: `${boundingRect.y + boundingRect.height - fillHandleSize / 2}px`,
      width: `${fillHandleSize}px`,
      height: `${fillHandleSize}px`,
      backgroundColor: this.config.selectionBorderColor,
      border: `2px solid white`,
      boxSizing: 'border-box',
      zIndex: '999', // Way above everything else
      cursor: 'crosshair',
      opacity: '0',
      transform: 'scale(0.8)',
      transition: 'opacity 200ms ease-out, transform 200ms ease-out',
      pointerEvents: 'auto', // Allow interaction with fill handle
      // Make it more obvious for debugging
      borderRadius: '1px'
    });
    
    this.container.appendChild(fillHandleElement);
    this.selectionElements.set('fill-handle', fillHandleElement);
    
    console.log('SelectionOverlayDOM: Fill handle created', {
      position: { 
        x: boundingRect.x + boundingRect.width - fillHandleSize / 2,
        y: boundingRect.y + boundingRect.height - fillHandleSize / 2 
      },
      size: fillHandleSize
    });
    
    // Initialize fill handle drag functionality
    this.initializeFillHandleDrag(fillHandleElement, boundingRect, visualCells);
    
    console.log('SelectionOverlayDOM: Excel-style selection elements created', {
      elementInDom: document.body.contains(unifiedElement),
      boundingRect,
      borderWidths: { thin: thinBorderWidth, thick: this.config.borderWidth }
    });
    
    // Trigger animation on next frame for all elements
    requestAnimationFrame(() => {
      unifiedElement.style.opacity = '1';
      unifiedElement.style.transform = 'scale(1)';
      
      const anchorElement = this.selectionElements.get('anchor-cell');
      if (anchorElement) {
        anchorElement.style.opacity = '1';
        anchorElement.style.transform = 'scale(1)';
      }
      
      fillHandleElement.style.opacity = '1';
      fillHandleElement.style.transform = 'scale(1)';
      
      console.log('SelectionOverlayDOM: Excel-style selection animation triggered');
    });
  }
  
  /**
   * Clear all selection elements immediately
   */
  private clearSelectionElements(): void {
    for (const element of this.selectionElements.values()) {
      element.remove();
    }
    this.selectionElements.clear();
    this.animatingOut.clear();
  }
  
  /**
   * Add or update a selection element
   */
  private addOrUpdateSelectionElement(
    cellKey: string,
    position: { x: number; y: number; width: number; height: number }
  ): void {
    let element = this.selectionElements.get(cellKey);
    
    if (!element) {
      console.log(`SelectionOverlayDOM: Creating new element for ${cellKey}`, {
        container: this.container.className,
        containerInDom: document.body.contains(this.container)
      });
      
      // Create new selection element
      element = document.createElement('div');
      element.className = 'vibegridx-selection-overlay';
      element.dataset.cellKey = cellKey;
      
      // Apply base styles
      Object.assign(element.style, {
        position: 'absolute',
        pointerEvents: 'none',
        backgroundColor: this.config.selectionColor,
        border: `${this.config.borderWidth}px solid ${this.config.selectionBorderColor}`,
        boxSizing: 'border-box',
        zIndex: '10',
        opacity: '0', // Start invisible for animation
        transform: 'scale(0.95)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out'
      });
      
      this.container.appendChild(element);
      this.selectionElements.set(cellKey, element);
      
      console.log(`SelectionOverlayDOM: Element created and appended for ${cellKey}`, {
        elementInDom: document.body.contains(element),
        parentClass: element.parentElement?.className
      });
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        element.style.opacity = '1';
        element.style.transform = 'scale(1)';
        console.log(`SelectionOverlayDOM: Animation triggered for ${cellKey}`);
      });
    }
    
    // Check if this is a position update for existing element
    const currentLeft = parseInt(element.style.left) || 0;
    const currentTop = parseInt(element.style.top) || 0;
    const isPositionChange = currentLeft !== position.x || currentTop !== position.y;
    
    // If position is changing, add smooth transition
    if (isPositionChange && element.style.opacity !== '0') {
      // Add position transition temporarily
      const originalTransition = element.style.transition;
      element.style.transition = 'left 200ms ease-out, top 200ms ease-out, width 200ms ease-out, height 200ms ease-out, opacity 200ms ease-out, transform 200ms ease-out';
      
      // Reset transition after animation
      setTimeout(() => {
        element.style.transition = originalTransition;
      }, 200);
    }
    
    // Update position and size
    Object.assign(element.style, {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${position.width}px`,
      height: `${position.height}px`
    });
    
    console.log(`SelectionOverlayDOM: Element positioned for ${cellKey}`, {
      left: position.x,
      top: position.y,
      width: position.width,
      height: position.height,
      actualLeft: element.style.left,
      actualTop: element.style.top,
      positionChanged: isPositionChange
    });
  }
  
  /**
   * Remove a selection element with animation
   */
  private removeSelectionElement(cellKey: string): void {
    const element = this.selectionElements.get(cellKey);
    if (!element || this.animatingOut.has(cellKey)) return;
    
    this.animatingOut.add(cellKey);
    
    // Animate out
    element.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in';
    element.style.opacity = '0';
    element.style.transform = 'scale(0.95)';
    
    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.selectionElements.delete(cellKey);
      this.animatingOut.delete(cellKey);
    }, 150);
  }
  
  /**
   * Clear all selection elements
   */
  clearSelection(): void {
    console.log('SelectionOverlayDOM: Clearing selection', {
      elementCount: this.selectionElements.size
    });
    
    // Animate all elements out simultaneously
    const elements = Array.from(this.selectionElements.entries());
    
    for (const [cellKey, element] of elements) {
      if (!this.animatingOut.has(cellKey)) {
        this.animatingOut.add(cellKey);
        element.style.transition = 'opacity 150ms ease-in, transform 150ms ease-in';
        element.style.opacity = '0';
        element.style.transform = 'scale(0.95)';
      }
    }
    
    // Remove all elements after animation
    setTimeout(() => {
      for (const [cellKey, element] of elements) {
        element.remove();
        this.animatingOut.delete(cellKey);
      }
      this.selectionElements.clear();
    }, 150);
    
    this.lastSelectedCells.clear();
  }
  
  /**
   * Update selection range (for drag selection)
   */
  updateSelectionRange(
    startCell: { rowId: string; columnId: string },
    endCell: { rowId: string; columnId: string },
    coordinateMapping: CoordinateMapping,
    viewport: ViewportInfo
  ): void {
    // Find row and column indices
    const startRowIdx = coordinateMapping.rows.findIndex(r => r.rowId === startCell.rowId);
    const endRowIdx = coordinateMapping.rows.findIndex(r => r.rowId === endCell.rowId);
    const startColIdx = coordinateMapping.columns.findIndex(c => c.columnId === startCell.columnId);
    const endColIdx = coordinateMapping.columns.findIndex(c => c.columnId === endCell.columnId);
    
    // Calculate range bounds
    const minRow = Math.min(startRowIdx, endRowIdx);
    const maxRow = Math.max(startRowIdx, endRowIdx);
    const minCol = Math.min(startColIdx, endColIdx);
    const maxCol = Math.max(startColIdx, endColIdx);
    
    // Build set of cells in range
    const rangeCells = new Set<string>();
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        if (r < coordinateMapping.rows.length && c < coordinateMapping.columns.length) {
          const rowId = coordinateMapping.rows[r].rowId;
          const columnId = coordinateMapping.columns[c].columnId;
          rangeCells.add(`${rowId}:${columnId}`);
        }
      }
    }
    
    // Update selection with the range
    this.updateSelectionWithMapping(rangeCells, viewport, coordinateMapping);
  }
  
  /**
   * Highlight cells temporarily (e.g., for hover effects)
   */
  highlightCells(cellKeys: Set<string>, coordinateMapping: CoordinateMapping, viewport: ViewportInfo): void {
    // Create temporary highlight elements with different styling
    for (const cellKey of cellKeys) {
      const [rowId, columnId] = cellKey.split(':');
      const rowCoord = coordinateMapping.rows.find(r => r.rowId === rowId);
      const colCoord = coordinateMapping.columns.find(c => c.columnId === columnId);
      
      if (!rowCoord || !colCoord) continue;
      
      const rowIndex = coordinateMapping.rows.indexOf(rowCoord);
      if (rowIndex < viewport.start || rowIndex > viewport.end) continue;
      
      const element = document.createElement('div');
      element.className = 'vibegridx-highlight-overlay';
      
      const viewportOffset = viewport.start * this.config.cellHeight;
      Object.assign(element.style, {
        position: 'absolute',
        left: `${colCoord.offset}px`,
        top: `${rowCoord.offset - viewportOffset}px`,
        width: `${colCoord.width}px`,
        height: `${this.config.cellHeight}px`,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        border: '2px solid rgba(59, 130, 246, 0.5)',
        pointerEvents: 'none',
        zIndex: '11',
        opacity: '0',
        transition: 'opacity 150ms ease-out'
      });
      
      this.container.appendChild(element);
      
      // Animate in
      requestAnimationFrame(() => {
        element.style.opacity = '1';
      });
      
      // Auto-remove after a delay
      setTimeout(() => {
        element.style.opacity = '0';
        setTimeout(() => element.remove(), 150);
      }, 650);
    }
  }
  
  /**
   * Initialize fill handle drag events (vertical only)
   */
  private initializeFillHandleDrag(fillHandleElement: HTMLElement, boundingRect: { x: number; y: number; width: number; height: number }, visualCells: VisualCellPosition[]): void {
    let isDragging = false;
    let startY = 0;
    let fillPreviewElement: HTMLElement | null = null;
    
    console.log('[SelectionOverlayDOM] Initializing fill handle drag events', {
      element: fillHandleElement,
      boundingRect,
      visualCells: visualCells.length
    });
    
    const handleMouseDown = (event: MouseEvent) => {
      console.log('[SelectionOverlayDOM] Fill handle mousedown triggered', {
        target: event.target,
        isFillHandle: event.target === fillHandleElement,
        className: (event.target as HTMLElement)?.className,
        eventPhase: event.eventPhase
      });
      
      // IMMEDIATELY stop all propagation to prevent container handlers from running
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      
      // Only proceed if this is specifically the fill handle
      if (event.target !== fillHandleElement) {
        console.log('[SelectionOverlayDOM] Mousedown not on fill handle, ignoring');
        return false;
      }
      
      isDragging = true;
      startY = event.clientY;
      
      console.log('[SelectionOverlayDOM] Fill handle drag started', { startY });
      
      // Change cursor for the entire document during drag
      document.body.style.cursor = 'ns-resize';
      fillHandleElement.style.cursor = 'ns-resize';
      
      // Add global event listeners
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      
      return false; // Additional prevention
    };
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      
      const deltaY = event.clientY - startY;
      
      // Only allow vertical dragging (ignore horizontal movement)
      if (Math.abs(deltaY) < 5) {
        // Remove preview if movement is too small
        if (fillPreviewElement) {
          fillPreviewElement.remove();
          fillPreviewElement = null;
        }
        return;
      }
      
      // Calculate fill direction and extent
      const direction = deltaY > 0 ? 'down' : 'up';
      const fillExtent = Math.abs(deltaY);
      const cellHeight = this.config.cellHeight;
      const additionalRows = Math.floor(fillExtent / cellHeight);
      
      if (additionalRows > 0) {
        this.showFillPreview(boundingRect, direction, additionalRows, cellHeight);
      }
      
      console.log('[SelectionOverlayDOM] Fill drag move', { 
        deltaY, 
        direction, 
        fillExtent, 
        additionalRows 
      });
    };
    
    const handleMouseUp = (event: MouseEvent) => {
      if (!isDragging) return;
      
      isDragging = false;
      document.body.style.cursor = '';
      
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      // Calculate final fill operation
      const deltaY = event.clientY - startY;
      const direction = deltaY > 0 ? 'down' : 'up';
      const additionalRows = Math.floor(Math.abs(deltaY) / this.config.cellHeight);
      
      // Clean up preview
      if (fillPreviewElement) {
        fillPreviewElement.remove();
        fillPreviewElement = null;
      }
      
      if (additionalRows > 0) {
        this.executeFillOperation(visualCells, direction, additionalRows);
      }
      
      console.log('[SelectionOverlayDOM] Fill handle drag completed', { 
        deltaY, 
        direction, 
        additionalRows 
      });
    };
    
    // Listen for the custom event from the container handler to avoid conflicts
    fillHandleElement.addEventListener('fillHandleMouseDown', (event: CustomEvent) => {
      console.log('[SelectionOverlayDOM] Fill handle custom event received - calling handler');
      // Create a synthetic mousedown event from the custom event details
      const syntheticEvent = new MouseEvent('mousedown', {
        bubbles: false,
        cancelable: true,
        clientX: event.detail.clientX,
        clientY: event.detail.clientY,
        button: event.detail.button
      });
      handleMouseDown(syntheticEvent);
    }, { passive: false });
    
    // Also keep the direct mousedown listener as backup
    fillHandleElement.addEventListener('mousedown', (event) => {
      console.log('[SelectionOverlayDOM] Fill handle direct mousedown - calling handler');
      handleMouseDown(event);
    }, { passive: false });
    fillHandleElement.addEventListener('click', (event) => {
      console.log('[SelectionOverlayDOM] Fill handle CLICK event triggered', event);
      event.preventDefault();
      event.stopPropagation();
    }, { passive: false });
    fillHandleElement.addEventListener('mouseenter', () => {
      console.log('[SelectionOverlayDOM] Fill handle MOUSEENTER');
      fillHandleElement.style.transform = 'scale(1.2)';
    });
    fillHandleElement.addEventListener('mouseleave', () => {
      console.log('[SelectionOverlayDOM] Fill handle MOUSELEAVE');
      fillHandleElement.style.transform = 'scale(1)';
    });
    
    // Add a generic event listener to capture all mouse events
    ['mousedown', 'mouseup', 'mousemove', 'click'].forEach(eventType => {
      fillHandleElement.addEventListener(eventType, (event) => {
        console.log(`[SelectionOverlayDOM] Fill handle ${eventType.toUpperCase()} event`, {
          type: event.type,
          target: event.target,
          currentTarget: event.currentTarget,
          clientX: event.clientX,
          clientY: event.clientY
        });
      }, { passive: false });
    });
    
    console.log('[SelectionOverlayDOM] Fill handle drag events attached', {
      elementExists: !!fillHandleElement,
      hasMouseDownListener: true,
      hasCustomEventListener: true,
      elementInDOM: document.body.contains(fillHandleElement),
      className: fillHandleElement.className,
      elementId: fillHandleElement.dataset.cellKey,
      styles: {
        position: fillHandleElement.style.position,
        zIndex: fillHandleElement.style.zIndex,
        pointerEvents: fillHandleElement.style.pointerEvents
      }
    });
    
    // Test that the custom event listener works
    setTimeout(() => {
      console.log('[SelectionOverlayDOM] Testing custom event dispatch');
      const testEvent = new CustomEvent('fillHandleMouseDown', {
        detail: { clientX: 0, clientY: 0, button: 0 },
        bubbles: false,
        cancelable: true
      });
      fillHandleElement.dispatchEvent(testEvent);
    }, 1000);
  }
  
  /**
   * Show fill preview during drag
   */
  private showFillPreview(boundingRect: { x: number; y: number; width: number; height: number }, direction: 'up' | 'down', additionalRows: number, cellHeight: number): void {
    // Remove existing preview
    if (this.selectionElements.has('fill-preview')) {
      const existingPreview = this.selectionElements.get('fill-preview')!;
      existingPreview.remove();
      this.selectionElements.delete('fill-preview');
    }
    
    // Calculate preview rectangle
    let previewRect;
    if (direction === 'down') {
      previewRect = {
        x: boundingRect.x,
        y: boundingRect.y + boundingRect.height,
        width: boundingRect.width,
        height: additionalRows * cellHeight
      };
    } else {
      const previewHeight = additionalRows * cellHeight;
      previewRect = {
        x: boundingRect.x,
        y: boundingRect.y - previewHeight,
        width: boundingRect.width,
        height: previewHeight
      };
    }
    
    // Create preview element
    const previewElement = document.createElement('div');
    previewElement.className = 'vibegridx-fill-preview';
    previewElement.dataset.cellKey = 'fill-preview';
    
    Object.assign(previewElement.style, {
      position: 'absolute',
      left: `${previewRect.x}px`,
      top: `${previewRect.y}px`,
      width: `${previewRect.width}px`,
      height: `${previewRect.height}px`,
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      border: '2px dashed rgba(59, 130, 246, 0.6)',
      boxSizing: 'border-box',
      zIndex: '11',
      pointerEvents: 'none'
    });
    
    this.container.appendChild(previewElement);
    this.selectionElements.set('fill-preview', previewElement);
  }
  
  /**
   * Execute the fill operation using Legend State
   */
  private executeFillOperation(visualCells: VisualCellPosition[], direction: 'up' | 'down', additionalRows: number): void {
    // This would need to be connected to the Legend State table state
    // For now, just log the operation
    console.log('[SelectionOverlayDOM] Executing fill operation', {
      visualCells: visualCells.length,
      direction,
      additionalRows,
      cellKeys: visualCells.map(c => c.cellKey)
    });
    
    // TODO: Connect to Legend State fillDown/fillUp operations
    // Example: this.tableState.fillDown(sourceRange, fillRange)
  }
  
  /**
   * Show fill preview with dotted border style
   */
  showFillPreview(previewCells: Set<string>, viewport: ViewportInfo | null, coordinateMapping: any): void {
    console.log('SelectionOverlayDOM: Showing fill preview', {
      previewCells: Array.from(previewCells),
      hasViewport: !!viewport,
      hasCoordinateMapping: !!coordinateMapping
    });
    
    if (previewCells.size === 0) {
      this.clearFillPreview();
      return;
    }
    
    if (!viewport || !coordinateMapping) {
      console.warn('SelectionOverlayDOM: Missing viewport or coordinate mapping for fill preview');
      return;
    }
    
    // Calculate visible preview cells
    const visiblePreviewCells = new Set<string>();
    const cellPositions = new Map<string, { x: number; y: number; width: number; height: number }>();
    
    for (const cellKey of previewCells) {
      const [rowId, columnId] = cellKey.split(':');
      
      // Find row and column in coordinate mapping
      const rowCoord = coordinateMapping.rows.find((r: any) => r.rowId === rowId);
      const colCoord = coordinateMapping.columns.find((c: any) => c.columnId === columnId);
      
      if (!rowCoord || !colCoord) continue;
      
      const rowIndex = coordinateMapping.rows.indexOf(rowCoord);
      
      // Check if cell is in viewport
      if (rowIndex >= viewport.start && rowIndex <= viewport.end) {
        visiblePreviewCells.add(cellKey);
        
        // Calculate position based on coordinate mapping
        const viewportOffset = viewport.start * this.config.cellHeight;
        cellPositions.set(cellKey, {
          x: colCoord.offset,
          y: rowCoord.offset - viewportOffset,
          width: colCoord.width,
          height: this.config.cellHeight
        });
      }
    }
    
    // Remove preview elements that are no longer needed
    for (const [cellKey, element] of this.fillPreviewElements) {
      if (!visiblePreviewCells.has(cellKey)) {
        element.remove();
        this.fillPreviewElements.delete(cellKey);
      }
    }
    
    // Add or update preview elements for visible cells
    for (const cellKey of visiblePreviewCells) {
      const position = cellPositions.get(cellKey);
      if (position) {
        this.addOrUpdateFillPreviewElement(cellKey, position);
      }
    }
  }
  
  /**
   * Clear fill preview
   */
  clearFillPreview(): void {
    console.log('SelectionOverlayDOM: Clearing fill preview');
    for (const element of this.fillPreviewElements.values()) {
      element.remove();
    }
    this.fillPreviewElements.clear();
  }
  
  /**
   * Add or update a fill preview element with dotted border
   */
  private addOrUpdateFillPreviewElement(cellKey: string, position: { x: number; y: number; width: number; height: number }): void {
    let element = this.fillPreviewElements.get(cellKey);
    
    if (!element) {
      element = document.createElement('div');
      element.className = 'vibegridx-fill-preview';
      element.style.position = 'absolute';
      element.style.pointerEvents = 'none';
      element.style.zIndex = '998'; // Below fill handle but above cells
      
      // Dotted border style to distinguish from selection
      element.style.border = '1px dotted rgba(59, 130, 246, 0.8)';
      element.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      element.style.boxSizing = 'border-box';
      
      this.container.appendChild(element);
      this.fillPreviewElements.set(cellKey, element);
      
      console.log('SelectionOverlayDOM: Created fill preview element for', cellKey);
    }
    
    // Update position
    element.style.left = `${position.x}px`;
    element.style.top = `${position.y}px`;
    element.style.width = `${position.width}px`;
    element.style.height = `${position.height}px`;
  }
  
  /**
   * Destroy the overlay and clean up
   */
  destroy(): void {
    // Remove all elements immediately
    for (const element of this.selectionElements.values()) {
      element.remove();
    }
    this.selectionElements.clear();
    
    // Remove all fill preview elements
    for (const element of this.fillPreviewElements.values()) {
      element.remove();
    }
    this.fillPreviewElements.clear();
    
    this.animatingOut.clear();
    this.lastSelectedCells.clear();
    
    // Clean up document event listeners
    for (const listener of this.documentEventListeners) {
      document.removeEventListener(listener.type, listener.handler, listener.options);
    }
    this.documentEventListeners.length = 0;
  }
}