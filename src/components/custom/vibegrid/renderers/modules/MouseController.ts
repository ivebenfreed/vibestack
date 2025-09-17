/**
 * MouseController - Global mouse event coordinator for VibeGrid
 *
 * Single source of truth for all mouse interactions to prevent event conflicts.
 * Manages drag state and delegates click events to appropriate handlers.
 */

import { log } from '@/logger';

const fileLog = log('components/custom/vibegrid/renderers/modules/MouseController.ts');

export interface MouseControllerOptions {
  container: HTMLElement;
  bodyRenderer?: any; // Will delegate cell clicks here
  scrollController?: any; // Will delegate outside clicks here
  tableInteraction$: any; // For reactive state updates
}

export class MouseController {
  private container: HTMLElement;
  private bodyRenderer?: any;
  private scrollController?: any;
  private tableInteraction$: any;

  // Mouse state tracking
  private isDragging = false;
  private isTracking = false; // Flag to track if we're monitoring for drag
  private dragThreshold = 8; // pixels (increased to be less sensitive)
  private startPosition: { x: number; y: number } = { x: 0, y: 0 };

  // Event listeners for cleanup
  private eventListeners: Array<{
    element: EventTarget;
    event: string;
    handler: EventListener;
  }> = [];

  constructor(options: MouseControllerOptions) {
    this.container = options.container;
    this.bodyRenderer = options.bodyRenderer;
    this.scrollController = options.scrollController;
    this.tableInteraction$ = options.tableInteraction$;

    // Prevent text selection during drag operations
    this.container.style.userSelect = 'none';
    this.container.style.webkitUserSelect = 'none';

    this.setupGlobalMouseHandling();
    fileLog.info('🖱️ MouseController initialized with global event handling');
  }

  /**
   * Setup global mouse event listeners - ONLY these listeners should exist for mouse events
   */
  private setupGlobalMouseHandling(): void {
    fileLog.info('🖱️ Setting up global mouse event coordination');

    // Global mouse event handlers
    const mouseDownHandler = this.onMouseDown.bind(this);
    const mouseMoveHandler = this.onMouseMove.bind(this);
    const mouseUpHandler = this.onMouseUp.bind(this);
    const clickHandler = this.onClick.bind(this);

    // Add global listeners to document to catch all mouse events
    this.addEventListenerTracked(document, 'mousedown', mouseDownHandler);
    this.addEventListenerTracked(document, 'mousemove', mouseMoveHandler);
    this.addEventListenerTracked(document, 'mouseup', mouseUpHandler);
    this.addEventListenerTracked(document, 'click', clickHandler);

    fileLog.info('✅ Global mouse event coordination setup complete');
  }

  /**
   * Handle mouse down - start tracking potential drag and provide immediate feedback
   */
  private onMouseDown(e: MouseEvent): void {
    // Only handle events within our container
    if (!this.container.contains(e.target as Node)) {
      return;
    }

    this.startPosition = { x: e.clientX, y: e.clientY };
    this.isDragging = false;
    this.isTracking = true;

    // Provide immediate visual feedback on mouse down
    const target = e.target as HTMLElement;
    const cellElement = target.closest('[data-row-id][data-column-id]');

    if (cellElement) {
      // Get cell info
      const rowId = cellElement.getAttribute('data-row-id');
      const columnId = cellElement.getAttribute('data-column-id');
      const cellId = `${rowId}:${columnId}`;

      // Detect if click is on an editable element
      // IMPORTANT: Content elements with -editable classes have their own click handlers
      // that call stopPropagation(). We should NOT pass isEditableElement=true for them
      // because they handle their own editing. Only native input elements should be
      // marked as editable here.
      const isEditableElement = target.matches('input, textarea, select') ||
                                target.contentEditable === 'true';

      fileLog.info('🖱️ Cell mouse down - pure event coordination', {
        cellId,
        tagName: target.tagName,
        className: target.className,
        isEditableElement
      });

      // PURE: Update mouse coordinates
      this.tableInteraction$.setMousePosition(e.clientX, e.clientY);
      this.tableInteraction$.setMouseDown(true);

      // PURE: ALWAYS select the cell when clicked - this is the universal interaction pattern
      // Pass isEditableElement=false for content elements since they handle their own editing
      this.tableInteraction$.handleCellClick(cellId, isEditableElement, e.ctrlKey, e.shiftKey);

      // Only prevent tracking for actual input elements that need native behavior
      if (target.matches('input, textarea, select') || target.contentEditable === 'true') {
        // Don't track mouse for native input elements - allow normal editing behavior
        this.isDragging = false;
        this.isTracking = false;
        this.startPosition = { x: 0, y: 0 };
        return;
      } else {
        // For all other elements (including badges), track for drag selection
        e.preventDefault();
      }
    }

    fileLog.info('🖱️ Mouse down tracked', {
      position: this.startPosition,
      target: target.tagName
    });
  }

  /**
   * Handle mouse move - detect drag threshold and update drag selection
   */
  private onMouseMove(e: MouseEvent): void {
    // Debug all mouse moves to see if they're being detected
    if (this.isTracking) {
      const distance = Math.hypot(
        e.clientX - this.startPosition.x,
        e.clientY - this.startPosition.y
      );

      fileLog.info('🖱️ Mouse move while tracking', {
        distance,
        threshold: this.dragThreshold,
        startPos: this.startPosition,
        currentPos: { x: e.clientX, y: e.clientY },
        isTracking: this.isTracking,
        isDragging: this.isDragging
      });
    }

    // Only track if we started within our container
    if (!this.isTracking) {
      return;
    }

    // Calculate distance from start position
    const distance = Math.hypot(
      e.clientX - this.startPosition.x,
      e.clientY - this.startPosition.y
    );

    // Update drag state if threshold exceeded
    if (!this.isDragging && distance > this.dragThreshold) {
      this.isDragging = true;
      fileLog.info('🖱️ Drag threshold exceeded - now dragging', {
        distance,
        threshold: this.dragThreshold
      });

      // PURE: Start drag selection with focused cell as anchor
      const startCell = this.tableInteraction$.focusedCell.get();
      if (startCell) {
        this.tableInteraction$.startDragSelect(startCell);
        fileLog.info('🖱️ Started drag selection reactively', { startCell });
      } else {
        fileLog.warn('⚠️ No focused cell for drag start');
      }
    }

    // PURE: Always update mouse coordinates (computed observables react to changes)
    this.tableInteraction$.setMousePosition(e.clientX, e.clientY);
  }

  /**
   * Handle mouse up - reset drag state
   */
  private onMouseUp(e: MouseEvent): void {
    // Only handle events within our container
    if (!this.container.contains(e.target as Node)) {
      return;
    }

    if (this.isDragging) {
      // PURE: End drag selection reactively
      const dragResult = this.tableInteraction$.endDragSelect();
      fileLog.info('🖱️ Ended drag selection reactively', dragResult);

      fileLog.info('🖱️ Mouse up after drag - preventing synthetic click');
      // Prevent the browser from generating a click event after drag
      e.preventDefault();
      e.stopPropagation();

      // Delay resetting drag state to catch any synthetic click events
      // The browser may still generate a click event after this mouseup
      setTimeout(() => {
        this.isDragging = false;
        this.isTracking = false;
        this.startPosition = { x: 0, y: 0 };
        fileLog.info('🖱️ Drag state reset after delay');
      }, 10);
    } else {
      // No drag was happening, reset immediately
      this.isDragging = false;
      this.isTracking = false;
      this.startPosition = { x: 0, y: 0 };
    }
  }

  /**
   * Handle click events - route to appropriate handlers
   * This is the ONLY click handler in the entire VibeGrid system
   */
  private onClick(e: MouseEvent): void {
    // Ignore clicks that resulted from drag operations
    if (this.isDragging) {
      fileLog.info('🖱️ Click blocked - was result of drag operation');
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = e.target as HTMLElement;
    const isWithinContainer = this.container.contains(e.target as Node);

    if (isWithinContainer) {
      // Handle clicks within the container
      const cellElement = target.closest('[data-row-id][data-column-id]');

      if (!cellElement) {
        // Click within container but outside cells - delegate to ScrollController
        fileLog.info('🖱️ Container click (non-cell) detected - delegating to ScrollController');

        if (this.scrollController?.handleOutsideClick) {
          this.scrollController.handleOutsideClick(e);
        } else {
          fileLog.warn('⚠️ ScrollController handleOutsideClick method not available');
        }
      }
      // Note: Cell clicks are handled by mouse down for immediate selection
    } else {
      // Click outside the container - this is a true outside click for blur
      fileLog.info('🖱️ Outside container click detected - delegating to ScrollController for blur');

      if (this.scrollController?.handleOutsideClick) {
        this.scrollController.handleOutsideClick(e);
      } else {
        fileLog.warn('⚠️ ScrollController handleOutsideClick method not available');
      }
    }
  }

  /**
   * Robust check for VibeGrid editable elements using pattern matching
   * This approach is more maintainable than hardcoding class names
   */
  private hasEditableClass(element: HTMLElement): boolean {
    // Check if any class name matches the editable pattern
    const classList = Array.from(element.classList);
    return classList.some(className =>
      className.startsWith('vibegridx-cell-') && className.endsWith('-editable')
    );
  }

  /**
   * Get current drag state - for other components to query
   */
  get isCurrentlyDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Update renderer references (for late initialization)
   */
  setBodyRenderer(bodyRenderer: any): void {
    this.bodyRenderer = bodyRenderer;
    fileLog.info('🖱️ BodyRenderer reference updated');
  }

  setScrollController(scrollController: any): void {
    this.scrollController = scrollController;
    fileLog.info('🖱️ ScrollController reference updated');
  }

  /**
   * Add event listener with tracking for cleanup
   */
  private addEventListenerTracked(element: EventTarget, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Clean up all mouse event handling
   */
  destroy(): void {
    // Clean up all tracked event listeners
    this.eventListeners.forEach(({ element, event, handler }) => {
      try {
        element.removeEventListener(event, handler);
      } catch (error) {
        fileLog.error('❌ Error removing mouse event listener', { event, error });
      }
    });
    this.eventListeners = [];

    // Restore text selection
    this.container.style.userSelect = '';
    this.container.style.webkitUserSelect = '';

    fileLog.info('🧹 MouseController destroyed');
  }
}