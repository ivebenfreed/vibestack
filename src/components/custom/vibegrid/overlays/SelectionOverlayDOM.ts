import type { VisualCellPosition } from './OverlayTypes';
import { GRID_DIMENSIONS } from '../constants/grid-dimensions';
import { log } from '@/logger';
const myLog = log('components/custom/vibegrid/overlays/SelectionOverlayDOM.ts');

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
  
  // Track previous state to avoid unnecessary updates
  private lastSelectedCells = new Set<string>();
  
  // Track elements being animated out for cleanup
  private animatingOut = new Set<string>();
  
  // NOTE: Viewport tracking removed - now handled by DOM positioning system
  
  constructor(
    container: HTMLElement,
    config: SelectionOverlayConfig
  ) {
    this.container = container;
    // Make selection much more visible
    this.config = {
      ...config,
      selectionColor: 'rgba(59, 130, 246, 0.15)', // More opaque background
      selectionBorderColor: 'rgb(59, 130, 246)', // Solid border
      borderWidth: 2
    };
    
    // Ensure container has relative positioning for absolute children
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }
    
    myLog.info('SelectionOverlayDOM: Created', {
      container: this.container,
      config: this.config
    });
  }
  
  // NOTE: updateViewport method removed - viewport handled by DOM positioning system
  
  // NOTE: Old coordinate mapping method removed - now using DOM positioning only
  
  /**
   * Update with visual cell positions directly
   */
  updateWithVisualPositions(visualCells: VisualCellPosition[]): void {
    myLog.info('SelectionOverlayDOM.updateWithVisualPositions', {
      cellCount: visualCells.length,
      containerExists: !!this.container,
      containerInDom: this.container ? document.body.contains(this.container) : false,
      containerClass: this.container?.className,
      firstCells: visualCells.slice(0, 2).map(c => ({
        key: c.cellKey,
        pos: { x: c.x, y: c.y, w: c.width, h: c.height }
      }))
    });
    
    // Build set of new cell keys for comparison
    const newCellKeys = new Set(visualCells.map(cell => cell.cellKey));
    const currentCellKeys = new Set(this.selectionElements.keys());
    
    // Remove elements that are no longer selected (smooth fade out)
    for (const cellKey of currentCellKeys) {
      if (!newCellKeys.has(cellKey)) {
        myLog.info(`SelectionOverlayDOM: Removing deselected cell ${cellKey}`);
        this.removeSelectionElement(cellKey);
      }
    }
    
    // Add or update elements for new/existing selections
    for (const cell of visualCells) {
      const cellKey = cell.cellKey;
      const isNewSelection = !currentCellKeys.has(cellKey);
      
      myLog.info(`SelectionOverlayDOM: ${isNewSelection ? 'Adding new' : 'Updating existing'} element for ${cellKey}`, {
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height
      });
      
      this.addOrUpdateSelectionElement(cellKey, {
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height
      });
    }
    
    myLog.info('SelectionOverlayDOM: After smooth update', {
      elementCount: this.selectionElements.size,
      elementKeys: Array.from(this.selectionElements.keys()),
      previousKeys: Array.from(currentCellKeys),
      newKeys: Array.from(newCellKeys)
    });
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
      myLog.info(`SelectionOverlayDOM: Creating new element for ${cellKey}`, {
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
        zIndex: `${GRID_DIMENSIONS.Z_INDEX.SELECTION}`, // Use SELECTION z-index from GRID_DIMENSIONS
        opacity: '0', // Start invisible for animation
        transform: 'scale(0.95)',
        transition: 'opacity 200ms ease-out, transform 200ms ease-out',
        // Ensure pixel-perfect alignment
        borderRadius: '2px'
      });
      
      this.container.appendChild(element);
      this.selectionElements.set(cellKey, element);
      
      myLog.info(`SelectionOverlayDOM: Element created and appended for ${cellKey}`, {
        elementInDom: document.body.contains(element),
        parentClass: element.parentElement?.className
      });
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        element.style.opacity = '0.3';
        element.style.transform = 'scale(1)';
        myLog.info(`SelectionOverlayDOM: Animation triggered for ${cellKey}`);
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
    // No need to adjust for scroll since we're inside the scrolling container
    Object.assign(element.style, {
      left: `${position.x}px`,
      top: `${position.y}px`,
      width: `${position.width}px`,
      height: `${position.height}px`
    });
    
    myLog.info(`SelectionOverlayDOM: Element positioned for ${cellKey}`, {
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
    myLog.info('SelectionOverlayDOM: Clearing selection', {
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
  
  // NOTE: updateSelectionRange method removed - range selection now handled by hybrid coordinate system
  
  // NOTE: highlightCells method removed - cell highlighting now handled by hybrid coordinate system
  
  /**
   * Destroy the overlay and clean up
   */
  destroy(): void {
    // Remove all elements immediately
    for (const element of this.selectionElements.values()) {
      element.remove();
    }
    this.selectionElements.clear();
    this.animatingOut.clear();
    this.lastSelectedCells.clear();
  }
}