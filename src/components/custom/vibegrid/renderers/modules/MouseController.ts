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
}

export class MouseController {
  private container: HTMLElement;
  private bodyRenderer?: any;
  private scrollController?: any;

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

    // Prevent default text selection behavior
    e.preventDefault();

    // Provide immediate visual feedback on mouse down
    const target = e.target as HTMLElement;
    const cellElement = target.closest('[data-row-id][data-column-id]');

    if (cellElement) {
      // This is a cell mouse down - delegate to BodyRenderer for immediate selection feedback
      fileLog.info('🖱️ Cell mouse down - providing immediate feedback', {
        rowId: cellElement.getAttribute('data-row-id'),
        columnId: cellElement.getAttribute('data-column-id')
      });

      if (this.bodyRenderer && this.bodyRenderer.handleCellMouseDown) {
        try {
          this.bodyRenderer.handleCellMouseDown(e, cellElement, target);
        } catch (error) {
          fileLog.error('❌ Error calling handleCellMouseDown:', error);
        }
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

      // Notify BodyRenderer to start drag selection now that actual dragging is detected
      if (this.bodyRenderer && this.bodyRenderer.startDragSelectionOnDrag) {
        try {
          fileLog.info('🖱️ Starting drag selection via BodyRenderer');
          this.bodyRenderer.startDragSelectionOnDrag(e);
        } catch (error) {
          fileLog.error('❌ Error calling startDragSelectionOnDrag:', error);
        }
      } else {
        fileLog.warn('⚠️ BodyRenderer or startDragSelectionOnDrag method not available', {
          hasBodyRenderer: !!this.bodyRenderer,
          hasMethod: !!(this.bodyRenderer && this.bodyRenderer.startDragSelectionOnDrag)
        });
      }
    }

    // If we're actively dragging, update drag selection
    if (this.isDragging) {
      if (this.bodyRenderer && this.bodyRenderer.updateDragSelectionOnMove) {
        try {
          this.bodyRenderer.updateDragSelectionOnMove(e);
        } catch (error) {
          fileLog.error('❌ Error calling updateDragSelectionOnMove:', error);
        }
      }
    }
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
      // End drag selection through BodyRenderer
      if (this.bodyRenderer && this.bodyRenderer.endDragSelectionOnMouseUp) {
        try {
          this.bodyRenderer.endDragSelectionOnMouseUp();
        } catch (error) {
          fileLog.error('❌ Error calling endDragSelectionOnMouseUp:', error);
        }
      }

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
    // Only handle events within our container
    if (!this.container.contains(e.target as Node)) {
      return;
    }

    // Ignore clicks that resulted from drag operations
    if (this.isDragging) {
      fileLog.info('🖱️ Click blocked - was result of drag operation');
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    const target = e.target as HTMLElement;
    const cellElement = target.closest('[data-row-id][data-column-id]');

    if (cellElement) {
      // This is a cell click - delegate to BodyRenderer
      fileLog.info('🖱️ Cell click detected - delegating to BodyRenderer', {
        rowId: cellElement.getAttribute('data-row-id'),
        columnId: cellElement.getAttribute('data-column-id')
      });

      if (this.bodyRenderer && this.bodyRenderer.handleCellClick) {
        try {
          this.bodyRenderer.handleCellClick(e, cellElement, target);
        } catch (error) {
          fileLog.error('❌ Error calling handleCellClick:', error);
        }
      } else {
        fileLog.warn('⚠️ BodyRenderer handleCellClick method not available');
      }
    } else {
      // This is an outside click - delegate to ScrollController
      fileLog.info('🖱️ Outside click detected - delegating to ScrollController');

      if (this.scrollController?.handleOutsideClick) {
        this.scrollController.handleOutsideClick(e);
      } else {
        fileLog.warn('⚠️ ScrollController handleOutsideClick method not available');
      }
    }
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