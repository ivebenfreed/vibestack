/**
 * MouseController - Global mouse event coordinator for VibeGrid
 *
 * Single source of truth for all mouse interactions to prevent event conflicts.
 * Manages drag state and delegates click events to appropriate handlers.
 */

import { log } from '@/logger';
import type { createVibeGridVisualState } from '../../stores/visual-state';

const fileLog = log('components/custom/vibegrid/renderers/modules/MouseController.ts');

export interface MouseControllerOptions {
  container: HTMLElement;
  bodyRenderer?: any; // Will delegate cell clicks here
  scrollController?: any; // Will delegate outside clicks here
  selectionController?: any; // For row/column selection operations
  tableInteraction$: any; // For reactive state updates
  visualState: ReturnType<typeof createVibeGridVisualState>;
}

export class MouseController {
  private container: HTMLElement;
  private bodyRenderer?: any;
  private scrollController?: any;
  private selectionController?: any;
  private tableInteraction$: any;
  private visualState: ReturnType<typeof createVibeGridVisualState>;

  // Mouse state tracking
  private isDragging = false;
  private isTracking = false; // Flag to track if we're monitoring for drag
  private dragThreshold = 8; // pixels (increased to be less sensitive)
  private startPosition: { x: number; y: number } = { x: 0, y: 0 };
  private justEndedDrag = false; // Flag to prevent click events immediately after drag

  // Column drag state
  private isColumnDrag = false;
  private dragColumnId: string | null = null;
  private dragPreviewElement: HTMLElement | null = null;
  private dropLineElement: HTMLElement | null = null;

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
    this.selectionController = options.selectionController;
    this.tableInteraction$ = options.tableInteraction$;
    this.visualState = options.visualState;

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

    // NOTE: No HTML5 drag events needed - we use pure mouse events for column drag

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
    this.isColumnDrag = false;
    this.dragColumnId = null;

    // Provide immediate visual feedback on mouse down
    const target = e.target as HTMLElement;

    fileLog.debug('🖱️ Mouse down on element', {
      tagName: target.tagName,
      className: target.className,
      id: target.id,
      hasDataColumnId: target.hasAttribute('data-column-id'),
      hasDataRowId: target.hasAttribute('data-row-id'),
      parentTagName: target.parentElement?.tagName,
      parentClassName: target.parentElement?.className
    });

    // Check for column header drag first
    const headerElement = target.closest('[data-column-id]:not([data-row-id])');
    if (headerElement) {
      const columnId = headerElement.getAttribute('data-column-id');
      fileLog.debug('🎯 Header element detected', {
        element: headerElement.tagName,
        columnId,
        hasColumnId: !!columnId,
        attributes: Array.from(headerElement.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
      });
      if (columnId) {
        this.isColumnDrag = true;
        this.dragColumnId = columnId;
        fileLog.info('🎯 Column header mouse down - preparing for drag', { columnId });
        return;
      } else {
        fileLog.warn('⚠️ Header element found but no column ID', {
          element: headerElement.tagName,
          attributes: Array.from(headerElement.attributes).map(a => `${a.name}="${a.value}"`).join(' ')
        });
      }
    }

    const cellElement = target.closest('[data-row-id][data-column-id]');

    if (cellElement) {
      // Get cell info
      const rowId = cellElement.getAttribute('data-row-id');
      const columnId = cellElement.getAttribute('data-column-id');
      const cellId = `${rowId}:${columnId}`;

      // Check if this is a drag handle cell - if so, allow HTML5 drag and drop
      if (columnId === '__drag_handle') {
        // Don't track mouse for drag handle cells - allow HTML5 drag and drop
        this.isDragging = false;
        this.isTracking = false;
        this.startPosition = { x: 0, y: 0 };
        fileLog.info('🖱️ Allowing HTML5 drag for drag handle cell', {
          cellId,
          targetElement: target.tagName
        });
        return;
      }

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
        threshold: this.dragThreshold,
        isColumnDrag: this.isColumnDrag,
        dragColumnId: this.dragColumnId
      });

      if (this.isColumnDrag && this.dragColumnId) {
        // Start column drag
        fileLog.info('🎯 Column drag started', { columnId: this.dragColumnId });
        this.tableInteraction$.isDragging.set(true);
        this.tableInteraction$.dragSource.set(this.dragColumnId);
        this.createDragPreview(this.dragColumnId);
      } else if (this.isColumnDrag) {
        // Column drag was attempted but failed - don't fall back to cell selection
        fileLog.warn('⚠️ Column drag detected but dragColumnId is missing');
      } else {
        // PURE: Start drag selection with focused cell as anchor (only for cell drags)
        const startCell = this.tableInteraction$.focusedCell.get();
        if (startCell) {
          this.tableInteraction$.startDragSelect(startCell);
          fileLog.info('🖱️ Started drag selection reactively', { startCell });
        } else {
          fileLog.warn('⚠️ No focused cell for drag start');
        }
      }
    }

    // Handle column drag target detection
    if (this.isDragging && this.isColumnDrag && this.dragColumnId) {
      const target = e.target as HTMLElement;
      const targetHeaderElement = target.closest('[data-column-id]:not([data-row-id])');
      if (targetHeaderElement) {
        const targetColumnId = targetHeaderElement.getAttribute('data-column-id');
        if (targetColumnId && targetColumnId !== this.dragColumnId) {
          this.tableInteraction$.dragTarget.set(targetColumnId);
          this.showDropLine(targetHeaderElement, e.clientX);
          fileLog.info('🎯 Column drag over target', {
            sourceColumnId: this.dragColumnId,
            targetColumnId
          });
        }
      } else {
        // Clear drop line when not over a valid target
        this.hideDropLine();
      }
    }

    // Handle cell drag selection updates
    if (this.isDragging && !this.isColumnDrag && this.tableInteraction$.isDragSelecting.get()) {
      const target = e.target as HTMLElement;
      const cellElement = target.closest('[data-row-id][data-column-id]');

      if (cellElement) {
        const rowId = cellElement.getAttribute('data-row-id');
        const columnId = cellElement.getAttribute('data-column-id');
        const currentCellId = `${rowId}:${columnId}`;

        // Update drag selection if we're over a different cell
        const currentDragCell = this.tableInteraction$.dragSelectCurrent.get();
        if (currentCellId !== currentDragCell) {
          fileLog.info('🖱️ Drag selection updated to new cell', {
            previousCell: currentDragCell,
            currentCell: currentCellId
          });

          // Get data context from visual state for proper range selection
          try {
            // Try different data sources in order of preference
            const rows = this.visualState.virtualizedData ||
                        this.visualState.data ||
                        this.visualState.processedRows$ ||
                        [];
            const columns = this.visualState.visualInputs$.columns.get() || [];
            const columnVisibility = this.visualState.visualInputs$.columnVisibility.get() || {};

            const dataContext = {
              rows,
              columns,
              columnVisibility
            };

            fileLog.debug('🖱️ Drag selection data context', {
              rowsCount: dataContext.rows.length,
              columnsCount: dataContext.columns.length,
              visibilityKeys: Object.keys(dataContext.columnVisibility).length,
              firstRowId: dataContext.rows[0]?.id,
              firstColumnId: dataContext.columns[0]?.id,
              visibleColumns: dataContext.columns.filter(col => dataContext.columnVisibility[col.id] !== false).map(c => c.id).slice(0, 3)
            });

            // Only use data context if we have valid data
            if (dataContext.rows.length > 0 && dataContext.columns.length > 0) {
              this.tableInteraction$.updateDragSelection(currentCellId, dataContext);
            } else {
              fileLog.warn('⚠️ Empty data context for drag selection, falling back to simple update', {
                rowsCount: dataContext.rows.length,
                columnsCount: dataContext.columns.length
              });
              this.tableInteraction$.updateDragSelection(currentCellId);
            }
          } catch (error) {
            fileLog.warn('⚠️ Failed to get data context for drag selection, falling back to simple update', { error });
            this.tableInteraction$.updateDragSelection(currentCellId);
          }
        }
      }
    }

    // PURE: Always update mouse coordinates (computed observables react to changes)
    this.tableInteraction$.setMousePosition(e.clientX, e.clientY);

    // Update drag preview position for column drag
    if (this.isDragging && this.isColumnDrag && this.dragPreviewElement) {
      this.updateDragPreviewPosition(e.clientX, e.clientY);
    }
  }


  /**
   * Handle mouse up - reset drag state
   */
  private onMouseUp(e: MouseEvent): void {
    // CRITICAL FIX: Always reset drag state on mouse up, regardless of where the mouse is released
    // The check for container was causing drag state to persist when mouse is released outside container
    fileLog.info('🖱️ Mouse up detected', {
      withinContainer: this.container.contains(e.target as Node),
      wasTracking: this.isTracking,
      wasDragging: this.isDragging,
      wasColumnDrag: this.isColumnDrag
    });

    if (this.isDragging) {
      if (this.isColumnDrag && this.dragColumnId) {
        // Handle column drag completion
        const targetColumnId = this.tableInteraction$.dragTarget.get();
        if (targetColumnId && targetColumnId !== this.dragColumnId) {
          // Calculate the same insertBefore logic used for drop line positioning
          const targetHeaderElement = this.container.querySelector(`[data-column-id="${targetColumnId}"]:not([data-row-id])`);
          let insertBefore = true; // default

          if (targetHeaderElement) {
            const rect = targetHeaderElement.getBoundingClientRect();
            const cellCenterX = rect.left + rect.width / 2;
            insertBefore = e.clientX < cellCenterX;
          }

          fileLog.info('🎯 Column dropped for reordering', {
            sourceColumnId: this.dragColumnId,
            targetColumnId,
            insertBefore,
            mouseX: e.clientX
          });
          this.visualState.visualOperations.reorderColumns(this.dragColumnId, targetColumnId, insertBefore);
        }

        // Reset column drag state
        fileLog.info('🎯 Column drag ended', { columnId: this.dragColumnId });
        this.tableInteraction$.isDragging.set(false);
        this.tableInteraction$.dragSource.set(null);
        this.tableInteraction$.dragTarget.set(null);
        this.removeDragPreview();
        this.hideDropLine();
        fileLog.info('🎯 Column drag state reset, continuing to general reset');
      } else {
        // PURE: End drag selection reactively
        const dragResult = this.tableInteraction$.endDragSelect();
        fileLog.info('🖱️ Ended drag selection reactively', dragResult);
      }

      fileLog.info('🖱️ Mouse up after drag - preventing synthetic click');
      fileLog.info('🖱️ About to reset all drag state');
      // Prevent the browser from generating a click event after drag
      e.preventDefault();
      e.stopPropagation();

      // Set flag to prevent click events immediately after drag
      this.justEndedDrag = true;

      // Reset drag state immediately - no delay needed
      this.isDragging = false;
      this.isTracking = false;
      this.isColumnDrag = false;
      this.dragColumnId = null;
      this.startPosition = { x: 0, y: 0 };
      fileLog.info('🖱️ Drag state reset immediately', {
        isDragging: this.isDragging,
        isTracking: this.isTracking,
        isColumnDrag: this.isColumnDrag
      });

      // Clear the flag after a brief delay to allow normal clicks again
      setTimeout(() => {
        this.justEndedDrag = false;
        fileLog.debug('🖱️ Post-drag click blocking cleared');
      }, 100);
    } else {
      // No drag was happening, reset immediately
      this.isDragging = false;
      this.isTracking = false;
      this.isColumnDrag = false;
      this.dragColumnId = null;
      this.startPosition = { x: 0, y: 0 };
      fileLog.info('🖱️ Non-drag mouse up - state reset', {
        isDragging: this.isDragging,
        isTracking: this.isTracking,
        isColumnDrag: this.isColumnDrag
      });
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

    fileLog.info('🔍 onClick entry', {
      targetTag: target.tagName,
      targetClass: target.className,
      targetId: target.id,
      isWithinContainer,
      targetHasDataColumnId: target.hasAttribute('data-column-id'),
      targetHasDataInteractionType: target.hasAttribute('data-interaction-type'),
      targetDataInteractionType: target.getAttribute('data-interaction-type')
    });

    if (isWithinContainer) {
      // Handle clicks within the container
      const cellElement = target.closest('[data-row-id][data-column-id]');
      const rowHeaderElement = target.closest('[data-interaction-type="row-header"]');

      if (rowHeaderElement && this.selectionController) {
        // Handle row header clicks
        const rowId = rowHeaderElement.getAttribute('data-row-id');
        if (rowId) {
          fileLog.info('🖱️ Row header click detected', {
            rowId,
            isShiftKey: e.shiftKey,
            isCtrlKey: e.ctrlKey
          });

          // Handle different click types properly:
          // Regular click (no modifiers) -> replace selection
          // Ctrl+click -> toggle row (add/remove from existing selection)
          // Shift+click -> range selection
          if (e.shiftKey) {
            // Shift+click: Range selection
            const lastRowId = this.selectionController.getLastSelectedRowId();
            if (lastRowId) {
              this.selectionController.selectRowRange(lastRowId, rowId);
            } else {
              this.selectionController.selectRow(rowId);
            }
          } else if (e.ctrlKey || e.metaKey) {
            // Ctrl+click: Toggle row (add/remove from existing selection)
            this.selectionController.toggleRowSelection(rowId);
          } else {
            // Regular checkbox click: Toggle row selection (checkboxes should always toggle)
            this.selectionController.toggleRowSelection(rowId);
          }
        }
      } else {
        // Check for group expansion clicks (triangle-icon)
        const triangleElement = target.closest('.triangle-icon');
        const groupRowElement = triangleElement?.closest('[data-group-id]');

        if (triangleElement && groupRowElement) {
          const groupId = groupRowElement.getAttribute('data-group-id');

          if (groupId) {
            fileLog.info('🎯 Group expansion triangle clicked', {
              groupId,
              targetTag: target.tagName,
              targetClass: target.className
            });

            // Use visual state operations for group expansion (same pattern as sorting)
            if (this.visualState?.visualOperations?.toggleGroupExpansion) {
              this.visualState.visualOperations.toggleGroupExpansion(groupId);
              fileLog.info('🔄 toggleGroupExpansion call completed', { groupId });
            } else {
              fileLog.warn('⚠️ Visual operations not available for group expansion', {
                hasVisualState: !!this.visualState,
                hasVisualOperations: !!this.visualState?.visualOperations,
                hasToggleGroupExpansion: !!this.visualState?.visualOperations?.toggleGroupExpansion
              });
            }
            return; // Important: exit early to prevent further processing
          }
        }

        // Check for column header clicks
        const columnHeaderElement = target.closest('[data-interaction-type="column-header"]');

        fileLog.debug('🔍 Click target analysis', {
          targetTag: target.tagName,
          targetClass: target.className,
          targetId: target.id,
          hasDataInteractionType: target.hasAttribute('data-interaction-type'),
          targetDataInteractionType: target.getAttribute('data-interaction-type'),
          columnHeaderElement: !!columnHeaderElement,
          columnHeaderTag: columnHeaderElement?.tagName,
          columnHeaderClass: columnHeaderElement?.className
        });

        if (columnHeaderElement) {
          // Don't sort if clicking on resize handle
          if ((e.target as HTMLElement).classList.contains('vibegridx-resize-handle')) {
            return;
          }

          const columnId = columnHeaderElement.getAttribute('data-column-id');
          const field = columnHeaderElement.getAttribute('data-field');

          if (columnId && field) {
            const isCtrlKey = e.ctrlKey || e.metaKey;
            const isShiftKey = e.shiftKey;

            fileLog.info('🖱️ Column header click detected', {
              columnId,
              field,
              isShiftKey,
              isCtrlKey
            });

            if (isCtrlKey && !isShiftKey && this.selectionController) {
              // Ctrl+Click on header - select entire column
              e.preventDefault();
              this.selectionController.selectColumn(columnId);
              fileLog.info('🎯 Column selected', { columnId });
            } else {
              // Regular click or Shift+click - toggle sort
              // Shift+click enables multi-column sorting
              const isMultiSort = isShiftKey;

              fileLog.info('🔄 Column header clicked for sort', {
                columnId,
                field,
                isMultiSort,
                isShiftKey
              });

              // Use visual state operations for sorting
              fileLog.info('🔄 About to call toggleSort', {
                hasVisualState: !!this.visualState,
                hasVisualOperations: !!this.visualState?.visualOperations,
                hasToggleSort: !!this.visualState?.visualOperations?.toggleSort,
                field,
                isMultiSort
              });
              this.visualState.visualOperations.toggleSort(field, isMultiSort);
              fileLog.info('🔄 toggleSort call completed');
            }
          }
        } else if (!cellElement) {
        // Check if this was actually a column header click that didn't get detected
        const columnHeaderElement = target.closest('[data-interaction-type="column-header"]');

        if (columnHeaderElement) {
          // This is a column header click that was missed in the earlier check
          const columnId = columnHeaderElement.getAttribute('data-column-id');
          const field = columnHeaderElement.getAttribute('data-field');

          fileLog.info('🔍 FOUND MISSED COLUMN HEADER in fallback check', {
            columnId,
            field,
            targetTag: target.tagName,
            targetClass: target.className
          });

          if (columnId && field) {
            const isCtrlKey = e.ctrlKey || e.metaKey;
            const isShiftKey = e.shiftKey;

            if (isCtrlKey && !isShiftKey && this.selectionController) {
              // Ctrl+Click on header - select entire column
              e.preventDefault();
              this.selectionController.selectColumn(columnId);
              fileLog.info('🎯 Column selected via fallback', { columnId });
            } else {
              // Regular click or Shift+click - toggle sort
              const isMultiSort = isShiftKey;
              fileLog.info('🔄 Column header clicked for sort via fallback', {
                columnId,
                field,
                isMultiSort,
                isShiftKey
              });
              this.visualState.visualOperations.toggleSort(field, isMultiSort);
            }
            return; // Important: exit early to prevent "container click" message
          }
        }

        // Click within container but not on a cell or row header - this should NOT clear selection
        // Only clicks outside the entire container should clear selection
        fileLog.info('🖱️ Container click (non-cell) detected - preserving selection', {
          targetTag: target.tagName,
          targetClass: target.className,
          targetId: target.id,
          targetHasDataColumnId: target.hasAttribute('data-column-id'),
          targetHasDataInteractionType: target.hasAttribute('data-interaction-type'),
          targetDataInteractionType: target.getAttribute('data-interaction-type'),
          closestColumnHeader: !!target.closest('[data-interaction-type="column-header"]'),
          closestWithDataColumnId: !!target.closest('[data-column-id]')
        });
        // Do nothing - preserve current selection
        }
      }
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
   * Force reset drag state - called by external components when drag ends
   */
  resetDragState(): void {
    fileLog.info('🖱️ Force resetting drag state', {
      wasTracking: this.isTracking,
      wasDragging: this.isDragging,
      wasColumnDrag: this.isColumnDrag,
      dragColumnId: this.dragColumnId
    });

    this.isDragging = false;
    this.isTracking = false;
    this.isColumnDrag = false;
    this.dragColumnId = null;
    this.startPosition = { x: 0, y: 0 };
    this.removeDragPreview();
    this.hideDropLine();
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

  setSelectionController(selectionController: any): void {
    this.selectionController = selectionController;
    fileLog.info('🖱️ SelectionController reference updated');
  }

  /**
   * Add event listener with tracking for cleanup
   */
  private addEventListenerTracked(element: EventTarget, event: string, handler: EventListener): void {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Create floating drag preview for column drag
   */
  private createDragPreview(columnId: string): void {
    // Get column info for preview text
    const headerElement = this.container.querySelector(`[data-column-id="${columnId}"]:not([data-row-id])`);
    const columnText = headerElement?.textContent?.trim() || columnId;

    // Create floating preview element
    this.dragPreviewElement = document.createElement('div');
    this.dragPreviewElement.className = 'vibegridx-column-drag-preview';
    this.dragPreviewElement.textContent = columnText;

    // Style the preview (similar to interaction-handlers.ts drag image)
    Object.assign(this.dragPreviewElement.style, {
      position: 'fixed',
      background: 'hsl(var(--background))',
      color: 'hsl(var(--muted-foreground))',
      padding: '4px 8px',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: '600',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
      border: '1px solid hsl(var(--border))',
      whiteSpace: 'nowrap',
      zIndex: '99999',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      pointerEvents: 'none',
      opacity: '0.9',
      transform: 'translate(-50%, -100%)', // Center horizontally, above cursor
      transition: 'none' // No transitions during drag
    });

    document.body.appendChild(this.dragPreviewElement);
    fileLog.info('🎯 Column drag preview created', { columnId, text: columnText });
  }

  /**
   * Update drag preview position to follow mouse
   */
  private updateDragPreviewPosition(x: number, y: number): void {
    if (!this.dragPreviewElement) return;

    this.dragPreviewElement.style.left = `${x}px`;
    this.dragPreviewElement.style.top = `${y - 10}px`; // Slight offset above cursor
  }

  /**
   * Remove drag preview element
   */
  private removeDragPreview(): void {
    if (this.dragPreviewElement) {
      this.dragPreviewElement.remove();
      this.dragPreviewElement = null;
      fileLog.info('🎯 Column drag preview removed');
    }
  }

  /**
   * Show drop line indicator (blue line between columns)
   */
  private showDropLine(targetHeaderElement: HTMLElement, mouseX: number): void {
    // Calculate if inserting before or after based on mouse position
    const rect = targetHeaderElement.getBoundingClientRect();
    const cellCenterX = rect.left + rect.width / 2;
    const insertBefore = mouseX < cellCenterX;

    // Get the header container
    const headerContainer = targetHeaderElement.parentElement;
    if (!headerContainer) return;

    // Remove existing drop line
    this.hideDropLine();

    // Create new drop line
    this.dropLineElement = document.createElement('div');
    this.dropLineElement.className = 'vibegridx-column-drop-line';

    // Calculate position relative to the header container
    const headerRect = headerContainer.getBoundingClientRect();
    const cellRect = targetHeaderElement.getBoundingClientRect();
    const linePosition = insertBefore ?
      cellRect.left - headerRect.left :
      cellRect.right - headerRect.left;

    // Style the drop line
    Object.assign(this.dropLineElement.style, {
      position: 'absolute',
      top: '0',
      bottom: '0',
      left: `${linePosition - 1.5}px`,
      width: '3px',
      background: '#3b82f6',
      borderRadius: '1px',
      zIndex: '9999',
      boxShadow: '0 0 4px rgba(59, 130, 246, 0.5)',
      pointerEvents: 'none',
      height: `${cellRect.height}px`
    });

    // Ensure header container has relative positioning
    headerContainer.style.position = 'relative';
    headerContainer.appendChild(this.dropLineElement);

    fileLog.debug('🎯 Drop line shown', { insertBefore, linePosition });
  }

  /**
   * Hide drop line indicator
   */
  private hideDropLine(): void {
    if (this.dropLineElement) {
      this.dropLineElement.remove();
      this.dropLineElement = null;
      fileLog.debug('🎯 Drop line hidden');
    }
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

    // Clean up drag preview and drop line
    this.removeDragPreview();
    this.hideDropLine();

    // Restore text selection
    this.container.style.userSelect = '';
    this.container.style.webkitUserSelect = '';

    fileLog.info('🧹 MouseController destroyed');
  }
}