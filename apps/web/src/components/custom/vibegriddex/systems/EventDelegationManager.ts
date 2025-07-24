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
  // Add a getter function to always get the current tableSend
  getTableSend?: () => ActorRefFrom<typeof tableBaseMachine>['send'];
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
    startX: 0,
    containerRect: null as DOMRect | null  // Cache container dimensions
  };
  
  // Throttling for drag move events
  private dragMoveThrottleId: number | null = null;
  
  // Helper getter to always get the current send function
  private get send() {
    return this.config.getTableSend ? this.config.getTableSend() : this.config.tableSend;
  }
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
  private convertToContainerCoordinates(event: MouseEvent | { clientX: number; clientY: number }): { x: number; y: number } {
    // Use cached container rect during drag operations to avoid forced reflow
    const containerRect = this.dragState.containerRect || this.config.container.getBoundingClientRect();
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
    
    // Defer console log to avoid forcing layout
    const logData = {
      target: 'vibegridx-header-text', // Use a placeholder to avoid accessing DOM
      timestamp: Date.now(),
      button: event.button
    };
    
    // Log after critical path
    requestAnimationFrame(() => {
      console.log('🎯 EventDelegationManager: MouseDown', {
        ...logData,
        target: (event.target as Element)?.className // Access DOM property later
      });
    });
    
    // Determine what was clicked and dispatch appropriate XState event
    const target = event.target as Element;
    
    // Use a single traversal to find the clicked element type
    let currentElement: Element | null = target;
    let foundElement: { type: string; element: HTMLElement } | null = null;
    
    // Walk up the DOM tree once to find what was clicked
    while (currentElement && currentElement !== this.config.container) {
      const classList = currentElement.classList;
      
      if (classList.contains('vibegridx-editing-portal')) {
        console.log('🎯 EventDelegationManager: Event on editing overlay - skipping table actions');
        return;
      }
      
      if (!foundElement) {
        if (classList.contains('vibegridx-resize-handle')) {
          foundElement = { type: 'resize', element: currentElement as HTMLElement };
        } else if (classList.contains('vibegridx-fill-handle')) {
          foundElement = { type: 'fill', element: currentElement as HTMLElement };
        } else if (classList.contains('vibegridx-header-cell')) {
          foundElement = { type: 'header', element: currentElement as HTMLElement };
        } else if (classList.contains('vibegridx-cell')) {
          foundElement = { type: 'cell', element: currentElement as HTMLElement };
        } else if (classList.contains('vibegridx-checkbox-wrapper') || 
                   classList.contains('vibegridx-row-checkbox')) {
          foundElement = { type: 'checkbox', element: currentElement as HTMLElement };
        }
      }
      
      currentElement = currentElement.parentElement;
    }
    
    // Handle the found element
    if (foundElement) {
      switch (foundElement.type) {
        case 'resize':
          this.handleResizeStart(event, foundElement.element);
          break;
        case 'fill':
          this.handleFillStart(event);
          break;
        case 'header':
          this.handleHeaderMouseDown(event, foundElement.element);
          break;
        case 'cell':
          this.handleCellMouseDown(event, foundElement.element);
          break;
        case 'checkbox':
          this.handleCheckboxMouseDown(event, foundElement.element);
          break;
      }
    } else {
      // If nothing specific was clicked, ensure focus but don't start any drag
      this.ensureFocus();
    }
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
            this.send({ type: 'selection.drag.end' });
            break;
          case 'column':
            this.handleColumnDragEnd(event);
            break;
          case 'resize':
            this.send({ type: 'view.columns.resize.end' });
            break;
          case 'fill':
            const containerCoords = this.convertToContainerCoordinates(event);
            this.send({ 
              type: 'FILL_COMPLETE', 
              x: containerCoords.x,
              y: containerCoords.y
            });
            break;
        }
      } else if (this.dragState.dragType === 'column') {
        // Column drag was started but not moved - restore cursor
        document.body.style.cursor = '';
        document.body.classList.remove('vibegridx-dragging-active');
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
    
    // Skip events on editing overlay
    if (target.closest('.vibegridx-editing-portal')) {
      console.log('🎯 EventDelegationManager: Ignoring click on editing overlay');
      return;
    }
    
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
      
      // Check if we clicked on the sort icon specifically
      const sortIcon = target.closest('.vibegridx-sort-icon');
      
      if (columnId && sortIcon) {
        // Only trigger sort if we clicked on the sort icon
        console.log('🎯 EventDelegationManager: Sort icon clicked, triggering sort');
        this.send({
          type: 'view.column.click',
          field: columnId // Use 'field' instead of 'columnId' to match view-slice expectation
        });
      } else if (columnId && !sortIcon) {
        console.log('🎯 EventDelegationManager: Header clicked but not on sort icon, ignoring');
      }
      return;
    }
    
    // Check for checkbox click first
    const checkbox = target.closest('.vibegridx-checkbox-wrapper, .vibegridx-row-checkbox, .vibegridx-header-checkbox');
    if (checkbox) {
      this.handleCheckboxClick(event, checkbox as HTMLElement);
      return;
    }
    
    // Check for editable content click (single-click editing)
    const editableContent = target.closest('.vibegridx-cell-content-editable, .vibegridx-cell-text-editable, .vibegridx-cell-badge-editable, .vibegridx-cell-number-editable, .vibegridx-cell-boolean-editable, .vibegridx-cell-empty-editable');
    if (editableContent) {
      const cell = editableContent.closest('.vibegridx-cell') as HTMLElement;
      if (cell) {
        this.handleCellContentClick(event, cell);
        return;
      }
    }
    
    // Check for regular cell click
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    if (cell) {
      const rowId = cell.dataset.rowId;
      const columnId = cell.dataset.columnId;
      
      if (rowId && columnId) {
        // Cell click handling - currently just handled by single-click content editing
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
        // Start editing on double-click - works anywhere in the cell
        this.send({
          type: 'edit.cell.start',
          rowId,
          columnId
        });
      }
    }
  }

  private handleCellContentClick(event: MouseEvent, cell: HTMLElement): void {
    if (this.isDestroyed) return;
    
    const rowId = cell.dataset.rowId;
    const columnId = cell.dataset.columnId;
    
    if (!rowId || !columnId) return;
    
    // Skip selection column
    if (columnId === '__selection') return;
    
    console.log('🎯 EventDelegationManager: Content click detected', {
      rowId,
      columnId,
      target: event.target,
      timestamp: Date.now()
    });
    
    // Check if we're currently editing a different cell - if so, ensure edit mode ends first
    const editingPortal = document.querySelector('.vibegridx-editing-portal');
    if (editingPortal && editingPortal.style.display !== 'none') {
      const currentEditingCell = editingPortal.getAttribute('data-cell-id');
      const newCellId = `${rowId}:${columnId}`;
      
      if (currentEditingCell && currentEditingCell !== newCellId) {
        console.log('🎯 EventDelegationManager: Content click on different cell while editing, ensuring edit ends first');
        
        // Force any blur handlers to run immediately
        const activeInput = editingPortal.querySelector('input, select, textarea') as HTMLElement;
        if (activeInput) {
          activeInput.blur();
        }
        
        // Then ensure edit mode is ended
        this.send({
          type: 'edit.ensure.end'
        });
        
        // Small delay to allow state to settle before starting new edit
        setTimeout(() => {
          this.send({
            type: 'edit.cell.start.single',
            rowId,
            columnId,
            immediate: true
          });
        }, 10);
        
        event.stopPropagation();
        event.preventDefault();
        return;
      }
    }
    
    // Stop propagation to prevent normal cell selection
    event.stopPropagation();
    event.preventDefault();
    
    // Start editing immediately on content click
    this.send({
      type: 'edit.cell.start.single',
      rowId,
      columnId,
      immediate: true
    });
    
    // Ensure focus without triggering cascading events
    this.ensureFocus();
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
    
    // Check if we clicked on editable content - if so, skip selection
    const target = event.target as Element;
    const isEditableContent = target.closest('.vibegridx-cell-content-editable, .vibegridx-cell-text-editable, .vibegridx-cell-badge-editable, .vibegridx-cell-number-editable, .vibegridx-cell-boolean-editable, .vibegridx-cell-empty-editable');
    if (isEditableContent) {
      console.log('🎯 EventDelegationManager: Clicked on editable content, skipping selection');
      // Don't send selection event - let click handler deal with it
      return;
    }
    
    // Check if we're currently editing - if so, ensure edit mode ends first
    const editingPortal = document.querySelector('.vibegridx-editing-portal');
    if (editingPortal && editingPortal.style.display !== 'none') {
      console.log('🎯 EventDelegationManager: Cell clicked while editing, ensuring edit ends first');
      
      // Force any blur handlers to run immediately
      const activeInput = editingPortal.querySelector('input, select, textarea') as HTMLElement;
      if (activeInput) {
        activeInput.blur();
      }
      
      // Then ensure edit mode is ended
      this.send({
        type: 'edit.ensure.end'
      });
    }
    
    // Ensure focus without triggering cascading events
    this.ensureFocus();
    
    // Start cell selection
    this.send({
      type: 'selection.cell.select',
      rowId,
      columnId,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey
    });
    
    // Only prepare for drag if it's a basic click (no modifiers)
    if (!event.ctrlKey && !event.shiftKey) {
      // Prepare for potential drag selection
      const containerRect = this.config.container.getBoundingClientRect();
      const containerCoords = this.convertToContainerCoordinates(event);
      this.dragState = {
        isDragging: false, // Will become true in mousemove if movement detected
        dragType: 'selection',
        startCell: { rowId, columnId },
        startPos: { x: containerCoords.x, y: containerCoords.y },
        startColumnId: null,
        startWidth: 0,
        startX: 0,
        containerRect  // Cache container dimensions at drag start
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
    // Check if sort icon without forcing layout
    if ((target as HTMLElement).classList?.contains('vibegridx-sort-icon') || 
        (target.parentElement as HTMLElement)?.classList?.contains('vibegridx-sort-icon')) {
      // Sort operation - handle in click, not mousedown
      return;
    }
    
    // Cache container rect once before any style changes
    const containerRect = this.config.container.getBoundingClientRect();
    
    // Batch DOM changes using requestAnimationFrame to avoid forced reflow
    requestAnimationFrame(() => {
      // Change cursor to grabbing for column drag
      document.body.style.cursor = 'grabbing';
      document.body.classList.add('vibegridx-dragging-active');
    });
    
    // Column drag start - use cached container rect
    const containerCoords = {
      x: event.clientX - containerRect.left,
      y: event.clientY - containerRect.top
    };
    
    this.dragState = {
      isDragging: false,
      dragType: 'column',
      startCell: null,
      startPos: { x: containerCoords.x, y: containerCoords.y },
      startColumnId: columnId,
      startWidth: 0,
      startX: event.clientX,
      containerRect  // Cache container dimensions at drag start
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
        this.send({
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
      this.send({
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
    
    const containerRect = this.config.container.getBoundingClientRect();
    this.dragState = {
      isDragging: true,
      dragType: 'resize',
      startCell: null,
      startPos: { x: event.clientX, y: event.clientY },
      startColumnId: columnId,
      startWidth: currentWidth,
      startX: event.clientX,
      containerRect  // Cache container dimensions at drag start
    };
    
    const containerCoords = this.convertToContainerCoordinates(event);
    this.send({
      type: 'view.columns.resize.start',
      columnId,
      x: containerCoords.x,
      width: currentWidth
    });
    
    event.preventDefault();
    event.stopPropagation();
  }

  private handleFillStart(event: MouseEvent): void {
    const containerRect = this.config.container.getBoundingClientRect();
    const containerCoords = this.convertToContainerCoordinates(event);
    this.dragState = {
      isDragging: true,
      dragType: 'fill',
      startCell: null,
      startPos: { x: containerCoords.x, y: containerCoords.y },
      startColumnId: null,
      startWidth: 0,
      startX: 0,
      containerRect  // Cache container dimensions at drag start
    };
    
    this.send({
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
        this.send({
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
            this.send({
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
        this.send({
          type: 'view.columns.drag.start',
          columnId: this.dragState.startColumnId!,
          x: containerCoords.x,
          y: containerCoords.y,
          clientX: event.clientX,
          clientY: event.clientY
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
        // Store the current mouse position to avoid closure issues
        const currentClientX = event.clientX;
        const currentClientY = event.clientY;
        
        this.dragMoveThrottleId = requestAnimationFrame(() => {
          this.lastDragMoveTime = Date.now();
          
          // Use the stored position instead of the closed-over event
          const freshEvent = { clientX: currentClientX, clientY: currentClientY } as MouseEvent;
          const containerCoords = this.convertToContainerCoordinates(freshEvent);
          
          this.send({
            type: 'view.columns.drag.move',
            x: containerCoords.x,
            y: containerCoords.y,
            clientX: currentClientX,
            clientY: currentClientY
          });
          this.dragMoveThrottleId = null;
        });
        return; // CRITICAL: Return early - don't send event now
      }
      
      // Enough time has passed, send immediately and update timestamp
      this.lastDragMoveTime = now;
      const containerCoords = this.convertToContainerCoordinates(event);
      this.send({
        type: 'view.columns.drag.move',
        x: containerCoords.x,
        y: containerCoords.y,
        clientX: event.clientX,
        clientY: event.clientY
      });
    }
  }

  private handleResizeDrag(event: MouseEvent): void {
    const containerCoords = this.convertToContainerCoordinates(event);
    this.send({
      type: 'view.columns.resize.move',
      x: containerCoords.x
    });
  }

  private handleFillDrag(event: MouseEvent): void {
    if (!this.dragState.isDragging || this.dragState.dragType !== 'fill') return;
    
    // Convert to container coordinates
    const containerCoords = this.convertToContainerCoordinates(event);
    
    // Send the mouse position to the fill system
    // The FillHandleLayer will calculate the preview cells based on position
    this.send({
      type: 'FILL_MOVE',
      x: containerCoords.x,
      y: containerCoords.y
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
    
    this.send({
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
      
      this.send({
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
        this.send({
          type: 'keyboard.enter',
          shift: event.shiftKey
        });
        break;
        
      case 'Tab':
        event.preventDefault();
        this.send({
          type: 'keyboard.tab',
          shift: event.shiftKey
        });
        break;
        
      case 'Escape':
        event.preventDefault();
        this.send({ type: 'keyboard.escape' });
        break;
        
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        this.send({ type: 'keyboard.delete' });
        break;
        
      // Handle Ctrl/Cmd combinations
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.send({ type: 'keyboard.selectAll' });
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.send({ type: 'keyboard.copy' });
        }
        break;
        
      case 'v':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.send({ type: 'keyboard.paste' });
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
        
        this.send({
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
    
    // Check if focus is leaving the editing area
    const relatedTarget = event.relatedTarget as HTMLElement;
    const isLeavingEditingArea = !relatedTarget || 
      (!relatedTarget.closest('.vibegridx-editing-portal') && 
       !relatedTarget.closest('.vibegridx-container') &&
       !relatedTarget.closest('[data-radix-popper-content-wrapper]') && // Radix dropdown content
       !relatedTarget.closest('[role="listbox"]') && // Select dropdown
       !relatedTarget.closest('[role="option"]') && // Select options
       !relatedTarget.closest('[data-radix-select-content]') && // Radix Select content
       !relatedTarget.closest('[data-radix-select-item]') && // Radix Select items
       !relatedTarget.closest('.select-content') && // Custom select content
       !relatedTarget.closest('.select-item')); // Custom select items
    
    if (isLeavingEditingArea) {
      // Small delay to allow blur events to process first, then ensure editing is ended
      setTimeout(() => {
        // Double-check that we're still leaving the editing area after the delay
        // This prevents race conditions where focus changes rapidly
        const currentActive = document.activeElement as HTMLElement;
        const stillLeavingEditingArea = !currentActive || 
          (!currentActive.closest('.vibegridx-editing-portal') && 
           !currentActive.closest('.vibegridx-container') &&
           !currentActive.closest('[data-radix-popper-content-wrapper]') && // Radix dropdown content
           !currentActive.closest('[role="listbox"]') && // Select dropdown
           !currentActive.closest('[role="option"]') && // Select options
           !currentActive.closest('[data-radix-select-content]') && // Radix Select content
           !currentActive.closest('[data-radix-select-item]') && // Radix Select items
           !currentActive.closest('.select-content') && // Custom select content
           !currentActive.closest('.select-item')); // Custom select items
        
        if (stillLeavingEditingArea) {
          console.log('🎯 EventDelegationManager: Focus left editing area, ensuring edit mode ends');
          // Don't cancel - let the blur handlers commit first, then just ensure we exit edit mode
          this.send({
            type: 'edit.ensure.end'
          });
        } else {
          console.log('🎯 EventDelegationManager: Focus returned to editing area, no action needed');
        }
      }, 50);
    }
  }

  private ensureFocus(): void {
    const now = Date.now();
    
    // Prevent rapid focus calls that can trigger synthetic events
    if (now - this.lastFocusTime < 100) {
      console.log('🎯 EventDelegationManager: Skipping focus (debounced)');
      return;
    }
    
    // Don't try to focus container if we're currently editing
    const editingPortal = document.querySelector('.vibegridx-editing-portal');
    const isCurrentlyEditing = editingPortal && editingPortal.style.display !== 'none';
    
    if (isCurrentlyEditing) {
      console.log('🎯 EventDelegationManager: Skipping focus - editing in progress');
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
      startX: 0,
      containerRect: null  // Clear cached container rect
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