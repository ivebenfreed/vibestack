// ====================================
// UNIFIED EVENT DELEGATION MANAGER
// ====================================
// 
// This replaces all the competing event systems:
// - VibeGridXEvents.tsx React handlers
// - EventSystem.ts DOM handlers  
// - Individual canvas/overlay handlers
//
// Single source of truth for ALL user interactions

import type { ActorRefFrom } from 'xstate';
import type { tableBaseMachine } from '../machines/table-machine';
import type { ViewportInfo, CellRef } from '../types';

// ====================================
// EVENT DELEGATION CONFIGURATION
// ====================================

export interface EventDelegationConfig {
  container: HTMLElement;
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'];
  // Optional callbacks for backwards compatibility during transition
  legacyCallbacks?: {
    onCellClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
    onCellDoubleClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
    onColumnClick?: (columnId: string, event: MouseEvent) => void;
  };
}

// ====================================
// UNIFIED EVENT DELEGATION MANAGER
// ====================================

export class EventDelegationManager {
  private config: EventDelegationConfig;
  private isDestroyed = false;
  
  // Focus management state
  private lastFocusTime = 0;
  private currentFocusElement: HTMLElement | null = null;
  
  // Drag state tracking
  private dragState = {
    isDragging: false,
    dragType: null as 'selection' | 'column' | 'resize' | 'fill' | null,
    startCell: null as CellRef | null,
    startPos: null as { x: number; y: number } | null,
    startColumnId: null as string | null,
    startWidth: 0,
    startX: 0
  };
  
  // Throttling for drag move events
  private dragMoveThrottleId: number | null = null;
  private lastDragMoveTime = 0;
  private readonly DRAG_MOVE_THROTTLE_MS = 16; // ~60fps
  
  // Bound handlers for cleanup
  private boundHandlers = {
    handleMouseDown: this.handleMouseDown.bind(this),
    handleMouseMove: this.handleMouseMove.bind(this),
    handleMouseUp: this.handleMouseUp.bind(this),
    handleKeyDown: this.handleKeyDown.bind(this),
    handleScroll: this.handleScroll.bind(this),
    handleClick: this.handleClick.bind(this),
    handleDoubleClick: this.handleDoubleClick.bind(this),
    handleFocusIn: this.handleFocusIn.bind(this),
    handleFocusOut: this.handleFocusOut.bind(this)
  };

  constructor(config: EventDelegationConfig) {
    this.config = config;
    this.setupEventListeners();
    console.log('🎯 EventDelegationManager: Initialized unified event system');
  }
  
  // ====================================
  // COORDINATE CONVERSION UTILITIES
  // ====================================
  
  /**
   * Convert viewport-relative mouse coordinates to container-relative coordinates
   * This ensures all coordinates are in the same system as the coordinate mapping
   */
  private convertToContainerCoordinates(event: MouseEvent): { x: number; y: number } {
    const containerRect = this.config.container.getBoundingClientRect();
    return {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top
    };
  }

  // ====================================
  // EVENT LISTENER SETUP
  // ====================================

  private setupEventListeners(): void {
    const { container } = this.config;
    
    // Make container focusable for keyboard events
    container.setAttribute('tabindex', '0');
    container.style.outline = 'none'; // Remove focus outline
    
    // SINGLE mouse event delegation on container
    container.addEventListener('mousedown', this.boundHandlers.handleMouseDown, { passive: false });
    container.addEventListener('click', this.boundHandlers.handleClick);
    container.addEventListener('dblclick', this.boundHandlers.handleDoubleClick);
    
    // Global document events (only when needed)
    document.addEventListener('mousemove', this.boundHandlers.handleMouseMove, { passive: false });
    document.addEventListener('mouseup', this.boundHandlers.handleMouseUp, { passive: false });
    
    // Keyboard events on container only
    container.addEventListener('keydown', this.boundHandlers.handleKeyDown, { passive: false });
    
    // Focus management
    container.addEventListener('focusin', this.boundHandlers.handleFocusIn);
    container.addEventListener('focusout', this.boundHandlers.handleFocusOut);
    
    // Scroll delegation - DISABLED: EventSystem in renderer handles scroll
    // this.setupScrollListener();
    
    console.log('🎯 EventDelegationManager: Event listeners attached');
  }

  // ====================================
  // MOUSE EVENT HANDLING
  // ====================================

  private handleMouseDown(event: MouseEvent): void {
    if (this.isDestroyed) return;
    
    console.log('🎯 EventDelegationManager: MouseDown', {
      target: (event.target as Element)?.className,
      timestamp: Date.now(),
      button: event.button
    });
    
    // Determine what was clicked and dispatch appropriate XState event
    const target = event.target as Element;
    
    // Skip events on editing overlay - shadcn components handle their own events
    if (target.closest('.vibegridx-editing-portal')) {
      console.log('🎯 EventDelegationManager: Ignoring event on editing overlay');
      return;
    }
    
    // Check for resize handle
    const resizeHandle = target.closest('.vibegridx-resize-handle') as HTMLElement;
    if (resizeHandle) {
      this.handleResizeStart(event, resizeHandle);
      return;
    }
    
    // Check for fill handle
    const fillHandle = target.closest('.vibegridx-fill-handle');
    if (fillHandle) {
      this.handleFillStart(event);
      return;
    }
    
    // Check for header cell (column operations)
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    if (headerCell) {
      this.handleHeaderMouseDown(event, headerCell);
      return;
    }
    
    // Shadcn components in editing overlay handle their own events properly
    // No special handling needed - they work naturally within React portals
    
    // Check for regular cell
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    if (cell) {
      this.handleCellMouseDown(event, cell);
      return;
    }
    
    // Check for selection checkbox
    const checkbox = target.closest('.vibegridx-checkbox-wrapper, .vibegridx-row-checkbox');
    if (checkbox) {
      this.handleCheckboxMouseDown(event, checkbox as HTMLElement);
      return;
    }
    
    // If nothing specific was clicked, ensure focus but don't start any drag
    this.ensureFocus();
  }

  private handleMouseMove(event: MouseEvent): void {
    if (this.isDestroyed) return;
    
    // Check if we have potential for drag (startPos exists) OR are already dragging
    if (!this.dragState.startPos && !this.dragState.isDragging) return;
    
    switch (this.dragState.dragType) {
      case 'selection':
        this.handleSelectionDrag(event);
        break;
      case 'column':
        this.handleColumnDrag(event);
        break;
      case 'resize':
        this.handleResizeDrag(event);
        break;
      case 'fill':
        this.handleFillDrag(event);
        break;
    }
  }

  private handleMouseUp(event: MouseEvent): void {
    if (this.isDestroyed) return;
    
    // ALWAYS reset drag state on mouseup, regardless of whether we were actively dragging
    if (this.dragState.startPos) {
      if (this.dragState.isDragging) {
        console.log('🎯 EventDelegationManager: Ending drag', { type: this.dragState.dragType });
        
        switch (this.dragState.dragType) {
          case 'selection':
            this.config.tableSend({ type: 'selection.drag.end' });
            break;
          case 'column':
            this.handleColumnDragEnd(event);
            break;
          case 'resize':
            this.config.tableSend({ type: 'view.columns.resize.end' });
            break;
          case 'fill':
            this.config.tableSend({ type: 'FILL_COMPLETE', fillCells: new Set() });
            break;
        }
      }
      
      // Always reset drag state to prevent ghost dragging
      this.resetDragState();
    }
  }

  // ====================================
  // CLICK EVENT HANDLING
  // ====================================

  private handleClick(event: MouseEvent): void {
    if (this.isDestroyed) return;
    
    // Only handle clicks that aren't part of drag operations
    if (this.dragState.isDragging) return;
    
    const target = event.target as Element;
    
    console.log('🎯 EventDelegationManager: Click event', {
      target: target,
      targetClass: target.className,
      targetTagName: target.tagName,
      targetDataset: (target as HTMLElement).dataset
    });
    
    // Check for header cell click first
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    if (headerCell) {
      const columnId = headerCell.dataset.column; // Use data-column attribute, not data-column-id
      
      console.log('🎯 EventDelegationManager: Header cell found', {
        columnId,
        headerCell,
        dataset: headerCell.dataset
      });
      
      if (columnId) {
        // Send XState event for column click (triggers sorting)
        this.config.tableSend({
          type: 'view.column.click',
          field: columnId // Use 'field' instead of 'columnId' to match view-slice expectation
        });
        
        // Legacy callback support
        this.config.legacyCallbacks?.onHeaderClick?.(columnId, event);
      }
      return;
    }
    
    // Check for checkbox click first
    const checkbox = target.closest('.vibegridx-checkbox-wrapper, .vibegridx-row-checkbox, .vibegridx-header-checkbox');
    if (checkbox) {
      this.handleCheckboxClick(event, checkbox as HTMLElement);
      return;
    }
    
    // Check for regular cell click
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    if (cell) {
      const rowId = cell.dataset.rowId;
      const columnId = cell.dataset.columnId;
      
      if (rowId && columnId) {
        // Legacy callback support
        this.config.legacyCallbacks?.onCellClick?.(rowId, columnId, event);
      }
    }
  }

  private handleDoubleClick(event: MouseEvent): void {
    if (this.isDestroyed) return;
    
    const target = event.target as Element;
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    
    if (cell) {
      const rowId = cell.dataset.rowId;
      const columnId = cell.dataset.columnId;
      
      if (rowId && columnId) {
        // Start editing on double-click
        this.config.tableSend({
          type: 'edit.cell.start',
          rowId,
          columnId
        });
        
        // Legacy callback support
        this.config.legacyCallbacks?.onCellDoubleClick?.(rowId, columnId, event);
      }
    }
  }

  // ====================================
  // SPECIALIZED MOUSE HANDLERS
  // ====================================

  private handleCellMouseDown(event: MouseEvent, cell: HTMLElement): void {
    const rowId = cell.dataset.rowId;
    const columnId = cell.dataset.columnId;
    
    if (!rowId || !columnId) return;
    
    // Skip selection column
    if (columnId === '__selection') return;
    
    // Ensure focus without triggering cascading events
    this.ensureFocus();
    
    // Start cell selection
    this.config.tableSend({
      type: 'selection.cell.select',
      rowId,
      columnId,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey
    });
    
    // Only prepare for drag if it's a basic click (no modifiers)
    if (!event.ctrlKey && !event.shiftKey) {
      // Prepare for potential drag selection
      const containerCoords = this.convertToContainerCoordinates(event);
      this.dragState = {
        isDragging: false, // Will become true in mousemove if movement detected
        dragType: 'selection',
        startCell: { rowId, columnId },
        startPos: { x: containerCoords.x, y: containerCoords.y },
        startColumnId: null,
        startWidth: 0,
        startX: 0
      };
      
      // Reset drag cell tracking
      this.lastDragCell = null;
    }
    
    event.preventDefault();
  }

  private handleHeaderMouseDown(event: MouseEvent, headerCell: HTMLElement): void {
    const columnId = headerCell.dataset.column;
    if (!columnId) return;
    
    const target = event.target as Element;
    const sortIcon = target.closest('.vibegridx-sort-icon');
    
    if (sortIcon) {
      // Sort operation - handle in click, not mousedown
      return;
    }
    
    // Column drag start
    const containerCoords = this.convertToContainerCoordinates(event);
    this.dragState = {
      isDragging: false,
      dragType: 'column',
      startCell: null,
      startPos: { x: containerCoords.x, y: containerCoords.y },
      startColumnId: columnId,
      startWidth: 0,
      startX: event.clientX
    };
    
    event.preventDefault();
  }

  private handleCheckboxMouseDown(event: MouseEvent, checkbox: HTMLElement): void {
    // Prevent drag operations
    event.stopPropagation();
  }

  private handleCheckboxClick(event: MouseEvent, checkbox: HTMLElement): void {
    // Handle selection logic on click, not mousedown
    event.stopPropagation();
    event.preventDefault(); // Prevent default checkbox behavior since we're handling it manually
    
    // Only handle clicks on the wrapper (label), not the input itself to avoid duplicates
    if (checkbox.tagName === 'INPUT') {
      return; // Skip input clicks, only handle wrapper clicks
    }
    
    // Find the row this checkbox belongs to
    const cell = checkbox.closest('.vibegridx-selection-cell') as HTMLElement;
    if (cell) {
      const rowId = cell.dataset.rowId;
      if (rowId) {
        console.log('🎯 EventDelegationManager: Row checkbox clicked', { rowId });
        // Send XState event for row selection toggle (correct event name)
        this.config.tableSend({
          type: 'selection.checkbox.toggle',
          rowId,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey
        });
      }
      return;
    }
    
    // Handle header checkbox (select all)
    const headerCheckbox = checkbox.closest('.vibegridx-selection-header');
    if (headerCheckbox) {
      console.log('🎯 EventDelegationManager: Header checkbox clicked');
      
      // Check if the checkbox is currently checked to determine action
      const checkboxInput = headerCheckbox.querySelector('input[type="checkbox"]') as HTMLInputElement;
      const isCurrentlyChecked = checkboxInput?.checked || false;
      
      // If currently checked, deselect all; if not checked, select all
      this.config.tableSend({
        type: isCurrentlyChecked ? 'selection.checkbox.none' : 'selection.checkbox.all'
      });
    }
  }

  private handleResizeStart(event: MouseEvent, resizeHandle: HTMLElement): void {
    const columnId = resizeHandle.dataset.column;
    if (!columnId) return;
    
    // Get actual column width from the resize handle's parent header cell
    const headerCell = resizeHandle.closest('.vibegridx-header-cell') as HTMLElement;
    let currentWidth = 150; // Default fallback
    
    if (headerCell) {
      // Try to get the actual rendered width
      const computedWidth = headerCell.offsetWidth;
      if (computedWidth > 0) {
        currentWidth = computedWidth;
        console.log('🎯 EventDelegationManager: Got column width from offsetWidth', {
          columnId,
          width: currentWidth
        });
      }
    }
    
    this.dragState = {
      isDragging: true,
      dragType: 'resize',
      startCell: null,
      startPos: { x: event.clientX, y: event.clientY },
      startColumnId: columnId,
      startWidth: currentWidth,
      startX: event.clientX
    };
    
    const containerCoords = this.convertToContainerCoordinates(event);
    this.config.tableSend({
      type: 'view.columns.resize.start',
      columnId,
      x: containerCoords.x,
      width: currentWidth
    });
    
    event.preventDefault();
    event.stopPropagation();
  }

  private handleFillStart(event: MouseEvent): void {
    const containerCoords = this.convertToContainerCoordinates(event);
    this.dragState = {
      isDragging: true,
      dragType: 'fill',
      startCell: null,
      startPos: { x: containerCoords.x, y: containerCoords.y },
      startColumnId: null,
      startWidth: 0,
      startX: 0
    };
    
    this.config.tableSend({
      type: 'FILL_START',
      direction: 'vertical'
    });
    
    event.preventDefault();
    event.stopPropagation();
  }

  // ====================================
  // DRAG OPERATION HANDLERS
  // ====================================

  private lastDragCell: string | null = null;
  
  private handleSelectionDrag(event: MouseEvent): void {
    if (!this.dragState.startPos) return;
    
    // Check if we should start dragging (movement threshold)
    if (!this.dragState.isDragging) {
      const deltaX = Math.abs(event.clientX - this.dragState.startPos.x);
      const deltaY = Math.abs(event.clientY - this.dragState.startPos.y);
      
      if (deltaX > 5 || deltaY > 5) {
        this.dragState.isDragging = true;
        this.config.tableSend({
          type: 'selection.drag.start',
          startCell: this.dragState.startCell!
        });
      }
    }
    
    if (this.dragState.isDragging) {
      // Find cell under current mouse position
      const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
      const targetCell = elementUnderMouse?.closest('.vibegridx-cell') as HTMLElement;
      
      if (targetCell) {
        const rowId = targetCell.dataset.rowId;
        const columnId = targetCell.dataset.columnId;
        
        if (rowId && columnId) {
          const currentCellKey = `${rowId}:${columnId}`;
          
          // Only send update if we've moved to a different cell
          if (currentCellKey !== this.lastDragCell) {
            this.lastDragCell = currentCellKey;
            this.config.tableSend({
              type: 'selection.drag.move',
              currentCell: { rowId, columnId }
            });
          }
        }
      }
    }
  }

  private lastDragOverColumn: string | null = null;
  
  private handleColumnDrag(event: MouseEvent): void {
    if (!this.dragState.startPos) return;
    
    // Check movement threshold
    if (!this.dragState.isDragging) {
      const deltaX = Math.abs(event.clientX - this.dragState.startPos.x);
      const deltaY = Math.abs(event.clientY - this.dragState.startPos.y);
      
      if (deltaX > 5 || deltaY > 5) {
        this.dragState.isDragging = true;
        const containerCoords = this.convertToContainerCoordinates(event);
        this.config.tableSend({
          type: 'view.columns.drag.start',
          columnId: this.dragState.startColumnId!,
          x: containerCoords.x,
          y: containerCoords.y
        });
      }
    }
    
    if (this.dragState.isDragging) {
      // Track which column we're over during drag
      const elementUnderMouse = document.elementFromPoint(event.clientX, event.clientY);
      const targetHeaderCell = elementUnderMouse?.closest('.vibegridx-header-cell') as HTMLElement;
      
      if (targetHeaderCell) {
        const targetColumnId = targetHeaderCell.dataset.column;
        if (targetColumnId && targetColumnId !== this.lastDragOverColumn) {
          this.lastDragOverColumn = targetColumnId;
          console.log('🎯 EventDelegationManager: Dragging over column', targetColumnId);
        }
      }
      
      // FIXED: Proper throttling - only send if enough time has passed
      const now = Date.now();
      if (now - this.lastDragMoveTime < this.DRAG_MOVE_THROTTLE_MS) {
        // Cancel any existing scheduled update
        if (this.dragMoveThrottleId) {
          cancelAnimationFrame(this.dragMoveThrottleId);
        }
        
        // Schedule a single update for the next frame
        this.dragMoveThrottleId = requestAnimationFrame(() => {
          this.lastDragMoveTime = Date.now();
          const containerCoords = this.convertToContainerCoordinates(event);
          this.config.tableSend({
            type: 'view.columns.drag.move',
            x: containerCoords.x,
            y: containerCoords.y
          });
          this.dragMoveThrottleId = null;
        });
        return; // CRITICAL: Return early - don't send event now
      }
      
      // Enough time has passed, send immediately and update timestamp
      this.lastDragMoveTime = now;
      const containerCoords = this.convertToContainerCoordinates(event);
      this.config.tableSend({
        type: 'view.columns.drag.move',
        x: containerCoords.x,
        y: containerCoords.y
      });
    }
  }

  private handleResizeDrag(event: MouseEvent): void {
    const containerCoords = this.convertToContainerCoordinates(event);
    this.config.tableSend({
      type: 'view.columns.resize.move',
      x: containerCoords.x
    });
  }

  private handleFillDrag(event: MouseEvent): void {
    // Fill drag logic would go here
    // For now, just send preview event
    this.config.tableSend({
      type: 'FILL_PREVIEW',
      previewCells: new Set()
    });
  }

  private handleColumnDragEnd(event: MouseEvent): void {
    // Send raw coordinates to XState - let the state machine handle all the logic
    const containerCoords = this.convertToContainerCoordinates(event);
    
    console.log('🎯 EventDelegationManager: Column drag end - sending coordinates to XState', {
      startColumn: this.dragState.startColumnId,
      mouseX: containerCoords.x,
      mouseY: containerCoords.y,
      clientX: event.clientX,
      clientY: event.clientY
    });
    
    this.config.tableSend({
      type: 'view.columns.drag.end',
      columnId: this.dragState.startColumnId!,
      x: containerCoords.x,
      y: containerCoords.y
    });
  }

  // ====================================
  // KEYBOARD EVENT HANDLING
  // ====================================

  private handleKeyDown(event: KeyboardEvent): void {
    if (this.isDestroyed) return;
    
    // Skip keyboard handling when editing overlay is active
    const target = event.target as Element;
    if (target.closest('.vibegridx-editing-portal')) {
      console.log('🎯 EventDelegationManager: Ignoring keyboard event on editing overlay');
      return;
    }
    
    // Handle arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      
      this.config.tableSend({
        type: 'keyboard.arrow',
        direction: event.key.replace('Arrow', '').toLowerCase() as any,
        extend: event.shiftKey
      });
      return;
    }
    
    // Handle other keys
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        this.config.tableSend({
          type: 'keyboard.enter',
          shift: event.shiftKey
        });
        break;
        
      case 'Tab':
        event.preventDefault();
        this.config.tableSend({
          type: 'keyboard.tab',
          shift: event.shiftKey
        });
        break;
        
      case 'Escape':
        event.preventDefault();
        this.config.tableSend({ type: 'keyboard.escape' });
        break;
        
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.config.tableSend({ type: 'keyboard.delete' });
        break;
        
      // Handle Ctrl/Cmd combinations
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.config.tableSend({ type: 'keyboard.selectAll' });
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.config.tableSend({ type: 'keyboard.copy' });
        }
        break;
        
      case 'v':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.config.tableSend({ type: 'keyboard.paste' });
        }
        break;
    }
  }

  // ====================================
  // SCROLL EVENT HANDLING
  // ====================================

  private handleScroll(): void {
    if (this.isDestroyed) return;
    
    const viewport = this.config.container.querySelector('.vibegridx-viewport') as HTMLElement;
    if (!viewport) return;
    
    // Cancel any pending RAF
    if (this.scrollRAF !== null) {
      cancelAnimationFrame(this.scrollRAF);
    }
    
    // Use RAF to debounce scroll events for better performance
    this.scrollRAF = requestAnimationFrame(() => {
      // Only send update if scroll position actually changed
      if (viewport.scrollTop !== this.lastScrollTop) {
        this.lastScrollTop = viewport.scrollTop;
        
        const viewportInfo: ViewportInfo = {
          scrollTop: viewport.scrollTop,
          scrollLeft: viewport.scrollLeft,
          clientHeight: viewport.clientHeight,
          clientWidth: viewport.clientWidth,
          startRow: 0, // TODO: Calculate from scroll position
          endRow: 0,   // TODO: Calculate from scroll position
          startColumn: 0, // TODO: Calculate from scroll position
          endColumn: 0,   // TODO: Calculate from scroll position
          visibleRows: [] // TODO: Calculate visible rows
        };
        
        this.config.tableSend({
          type: 'view.viewport.update',
          viewport: viewportInfo
        });
      }
      
      this.scrollRAF = null;
    });
  }

  // ====================================
  // FOCUS MANAGEMENT
  // ====================================

  private handleFocusIn(event: FocusEvent): void {
    this.currentFocusElement = event.target as HTMLElement;
    console.log('🎯 EventDelegationManager: Focus in', { target: this.currentFocusElement?.className });
  }

  private handleFocusOut(event: FocusEvent): void {
    console.log('🎯 EventDelegationManager: Focus out', { target: (event.target as HTMLElement)?.className });
  }

  private ensureFocus(): void {
    const now = Date.now();
    
    // Prevent rapid focus calls that can trigger synthetic events
    if (now - this.lastFocusTime < 100) {
      console.log('🎯 EventDelegationManager: Skipping focus (debounced)');
      return;
    }
    
    if (document.activeElement !== this.config.container) {
      console.log('🎯 EventDelegationManager: Ensuring container focus');
      this.lastFocusTime = now;
      this.config.container.focus({ preventScroll: true });
    }
  }

  // ====================================
  // UTILITY METHODS
  // ====================================

  private resetDragState(): void {
    // Cancel any pending drag move updates
    if (this.dragMoveThrottleId) {
      cancelAnimationFrame(this.dragMoveThrottleId);
      this.dragMoveThrottleId = null;
    }
    
    this.dragState = {
      isDragging: false,
      dragType: null,
      startCell: null,
      startPos: null,
      startColumnId: null,
      startWidth: 0,
      startX: 0
    };
    this.lastDragCell = null;
    this.lastDragOverColumn = null;
  }

  // ====================================
  // LIFECYCLE
  // ====================================

  public destroy(): void {
    if (this.isDestroyed) return;
    
    const { container } = this.config;
    
    // Remove all event listeners
    container.removeEventListener('mousedown', this.boundHandlers.handleMouseDown);
    container.removeEventListener('click', this.boundHandlers.handleClick);
    container.removeEventListener('dblclick', this.boundHandlers.handleDoubleClick);
    container.removeEventListener('keydown', this.boundHandlers.handleKeyDown);
    container.removeEventListener('focusin', this.boundHandlers.handleFocusIn);
    container.removeEventListener('focusout', this.boundHandlers.handleFocusOut);
    
    document.removeEventListener('mousemove', this.boundHandlers.handleMouseMove);
    document.removeEventListener('mouseup', this.boundHandlers.handleMouseUp);
    
    // Scroll handling disabled - EventSystem in renderer handles it
    
    this.isDestroyed = true;
    console.log('🎯 EventDelegationManager: Destroyed');
  }

  // ====================================
  // PUBLIC API
  // ====================================

  public updateConfig(newConfig: Partial<EventDelegationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public getDragState() {
    return { ...this.dragState };
  }

  public getCurrentFocus(): HTMLElement | null {
    return this.currentFocusElement;
  }
}