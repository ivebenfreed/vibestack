// ====================================
// LEGEND TABLE CENTRAL EVENT SYSTEM
// ====================================
// Using Legend State patterns for centralized, reactive event handling

import { observable, observe, event } from '@legendapp/state';
import type { TableState } from '../state/table-state';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/legendtable/events/LegendTableEventSystem.ts');

// ====================================
// EVENT TYPES & INTERFACES
// ====================================

export interface MouseEventData {
  clientX: number;
  clientY: number;
  target: HTMLElement;
  button: number;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface InteractionTarget {
  type: 'cell' | 'fillHandle' | 'header' | 'background';
  cellKey?: string;
  rowId?: string;
  columnId?: string;
  element?: HTMLElement;
}

export interface TableInteractionState {
  currentTool: 'select' | 'fillHandle' | 'resize' | 'idle';
  mouseState: {
    isDown: boolean;
    startPos: { x: number; y: number } | null;
    currentPos: { x: number; y: number } | null;
    target: InteractionTarget | null;
  };
  dragState: {
    isDragging: boolean;
    dragType: 'selection' | 'fillHandle' | null;
    startCell: string | null;
    previewCells: Set<string>;
  };
}

// ====================================
// CENTRALIZED EVENT SYSTEM
// ====================================

export class LegendTableEventSystem {
  // Simple state for mouse tracking (avoid observable reactivity issues)
  private mouseState = {
    isDown: false,
    startPos: null as { x: number; y: number } | null,
    currentPos: null as { x: number; y: number } | null,
    target: null as InteractionTarget | null
  };

  // Tool and drag state can still be observable
  private currentTool$ = observable<'select' | 'fillHandle' | 'resize' | 'idle'>('select');
  private dragState$ = observable({
    isDragging: false,
    dragType: null as 'selection' | 'fillHandle' | null,
    startCell: null as string | null,
    previewCells: new Set<string>()
  });

  // Value-less events for specific interactions
  private fillHandleStart$ = event<MouseEventData>();
  private cellSelectionStart$ = event<MouseEventData>();

  private container: HTMLElement;
  private tableState: TableState;
  private canvasOverlay: any; // Reference to CanvasOverlayDOM
  private disposers: Array<() => void> = [];

  constructor(container: HTMLElement, tableState: TableState, canvasOverlay?: any) {
    this.container = container;
    this.tableState = tableState;
    this.canvasOverlay = canvasOverlay;
    this.initializeEventSystem();
  }

  // ====================================
  // INITIALIZATION
  // ====================================

  private initializeEventSystem(): void {
    log.info('[LegendTableEventSystem] Initializing centralized event system');

    // Set up DOM event listeners
    this.setupDOMListeners();

    // Set up reactive event handlers using Legend State observe
    this.setupReactiveHandlers();

    log.info('[LegendTableEventSystem] Event system initialized');
  }

  private setupDOMListeners(): void {
    // Single mousedown handler for the entire container
    const handleMouseDown = (event: MouseEvent) => {
      const target = this.identifyTarget(event.target as HTMLElement);
      const eventData: MouseEventData = {
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target as HTMLElement,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey
      };

      log.info('[LegendTableEventSystem] Mouse down detected', { 
        target, 
        eventData,
        coords: { x: event.clientX, y: event.clientY }
      });

      // Update mouse state (simple object, not observable)
      this.mouseState = {
        isDown: true,
        startPos: { x: event.clientX, y: event.clientY },
        currentPos: { x: event.clientX, y: event.clientY },
        target
      };

      log.info('[LegendTableEventSystem] Mouse state updated', { 
        startPos: this.mouseState.startPos,
        isDown: this.mouseState.isDown,
        target: target.type 
      });

      // Fire appropriate events based on target type
      this.routeMouseDownEvent(target, eventData);

      // Prevent default behavior for interactive elements
      if (target.type !== 'background') {
        event.preventDefault();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!this.mouseState.isDown || !this.mouseState.startPos) return;

      // Update current position
      this.mouseState.currentPos = { x: event.clientX, y: event.clientY };

      const deltaX = event.clientX - this.mouseState.startPos.x;
      const deltaY = event.clientY - this.mouseState.startPos.y;

      // Only process significant movements to avoid spam
      if (Math.abs(deltaX) < 2 && Math.abs(deltaY) < 2) return;

      const currentTool = this.currentTool$.get();

      log.info('[LegendTableEventSystem] Mouse move during drag', { 
        currentTool, 
        deltaX, 
        deltaY,
        isDragging: this.dragState$.isDragging.get()
      });

      // Determine if we should start dragging
      if (!this.dragState$.isDragging.get() && (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5)) {
        log.info('[LegendTableEventSystem] Starting drag operation');
        this.dragState$.assign({
          isDragging: true,
          dragType: currentTool === 'fillHandle' ? 'fillHandle' : 'selection'
        });
      }

      if (this.dragState$.isDragging.get()) {
        const eventData: MouseEventData = {
          clientX: event.clientX,
          clientY: event.clientY,
          target: event.target as HTMLElement,
          button: event.button,
          ctrlKey: event.ctrlKey,
          shiftKey: event.shiftKey
        };

        switch (currentTool) {
          case 'fillHandle':
            this.handleFillHandleDragMove(eventData, deltaX, deltaY);
            break;
          case 'select':
            this.handleSelectionDragMove(eventData);
            break;
        }
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      const eventData: MouseEventData = {
        clientX: event.clientX,
        clientY: event.clientY,
        target: event.target as HTMLElement,
        button: event.button,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey
      };

      log.info('[LegendTableEventSystem] Mouse up received');
      const currentTool = this.currentTool$.get();
      const dragState = this.dragState$.get();

      if (dragState.isDragging) {
        log.info('[LegendTableEventSystem] Completing drag operation', { currentTool });
        switch (currentTool) {
          case 'fillHandle':
            this.completeFillHandleDrag();
            break;
          case 'select':
            this.completeSelectionDrag();
            break;
        }
      }

      // Reset state
      this.mouseState = {
        isDown: false,
        startPos: null,
        currentPos: null,
        target: null
      };

      this.dragState$.assign({
        isDragging: false,
        dragType: null,
        startCell: null,
        previewCells: new Set()
      });

      // Reset to idle
      this.currentTool$.set('idle');
    };

    // Attach listeners
    this.container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Store disposers for cleanup
    this.disposers.push(() => {
      this.container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    });
  }

  // ====================================
  // TARGET IDENTIFICATION
  // ====================================

  private identifyTarget(element: HTMLElement): InteractionTarget {
    // Check for fill handle
    if (element.classList.contains('vibegridx-fill-handle') || element.closest('.vibegridx-fill-handle')) {
      return {
        type: 'fillHandle',
        element: element.classList.contains('vibegridx-fill-handle') ? element : element.closest('.vibegridx-fill-handle') as HTMLElement
      };
    }

    // Check for cell
    const cellElement = element.closest('.vibegridx-cell') as HTMLElement;
    if (cellElement) {
      const rowId = cellElement.dataset.rowId;
      const columnId = cellElement.dataset.columnId;
      if (rowId && columnId) {
        return {
          type: 'cell',
          cellKey: `${rowId}:${columnId}`,
          rowId,
          columnId,
          element: cellElement
        };
      }
    }

    // Check for header
    const headerElement = element.closest('.vibegridx-header') as HTMLElement;
    if (headerElement) {
      return {
        type: 'header',
        element: headerElement
      };
    }

    // Default to background
    return {
      type: 'background',
      element
    };
  }

  // ====================================
  // EVENT ROUTING
  // ====================================

  private routeMouseDownEvent(target: InteractionTarget, eventData: MouseEventData): void {
    switch (target.type) {
      case 'fillHandle':
        log.info('[LegendTableEventSystem] Routing to fill handle');
        this.currentTool$.set('fillHandle');
        this.fillHandleStart$.fire(eventData);
        break;

      case 'cell':
        log.info('[LegendTableEventSystem] Routing to cell selection');
        this.currentTool$.set('select');
        this.cellSelectionStart$.fire(eventData);
        break;

      case 'header':
        log.info('[LegendTableEventSystem] Header interaction - not implemented');
        break;

      case 'background':
        log.info('[LegendTableEventSystem] Background click - clear selection');
        this.tableState.clearSelection();
        break;
    }
  }

  // ====================================
  // REACTIVE EVENT HANDLERS
  // ====================================

  private setupReactiveHandlers(): void {
    log.info('[LegendTableEventSystem] Setting up reactive event handlers');

    // Set up direct event listeners for initial interactions
    const fillHandleDisposer = this.fillHandleStart$.on((eventData) => {
      log.info('[LegendTableEventSystem] Fill handle drag started');
      this.handleFillHandleDrag(eventData);
    });

    const cellSelectionDisposer = this.cellSelectionStart$.on((eventData) => {
      log.info('[LegendTableEventSystem] Cell selection started');
      this.handleCellSelection(eventData);
    });

    // Store disposers for cleanup
    this.disposers.push(fillHandleDisposer, cellSelectionDisposer);
    log.info('[LegendTableEventSystem] Reactive handlers setup complete');
  }

  // ====================================
  // INTERACTION HANDLERS
  // ====================================

  private handleFillHandleDrag(eventData: MouseEventData): void {
    log.info('[LegendTableEventSystem] Fill handle drag initiated');
    // Set cursor
    document.body.style.cursor = 'ns-resize';
  }

  private handleFillHandleDragMove(eventData: MouseEventData, deltaX: number, deltaY: number): void {
    // Only handle vertical movement for fill handle
    if (Math.abs(deltaY) < 5) {
      // Clear preview if movement is too small
      this.dragState$.previewCells.set(new Set());
      this.showFillPreview(new Set());
      return;
    }

    log.info('[LegendTableEventSystem] Fill handle drag move', { deltaY });

    // Calculate fill direction and extent
    const direction = deltaY > 0 ? 'down' : 'up';
    const cellHeight = 40; // Should match config.cellHeight
    const additionalRows = Math.floor(Math.abs(deltaY) / cellHeight);
    
    if (additionalRows > 0) {
      // Calculate preview cells based on current selection and direction
      const selectedCells = this.tableState.selection.selectedCells.get();
      const previewCells = this.calculateFillPreviewCells(selectedCells, direction, additionalRows);
      
      // Update preview cells in state
      this.dragState$.previewCells.set(previewCells);
      
      // Show visual preview
      this.showFillPreview(previewCells);
      
      log.info('[LegendTableEventSystem] Fill preview calculated', {
        direction,
        additionalRows,
        previewCount: previewCells.size
      });
    }
  }

  private calculateFillPreviewCells(selectedCells: Set<string>, direction: 'up' | 'down', additionalRows: number): Set<string> {
    const previewCells = new Set<string>();
    const sortedData = this.tableState.sortedData.get();
    const columns = this.tableState.columns.get();
    
    if (selectedCells.size === 0 || sortedData.length === 0) return previewCells;
    
    // Find the bounding box of current selection
    const cellPositions = Array.from(selectedCells).map(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const rowIndex = sortedData.findIndex(row => row.id === rowId);
      const columnIndex = columns.findIndex(col => col.id === columnId);
      return { rowIndex, columnIndex, rowId, columnId };
    }).filter(pos => pos.rowIndex !== -1 && pos.columnIndex !== -1);
    
    if (cellPositions.length === 0) return previewCells;
    
    const minRowIndex = Math.min(...cellPositions.map(p => p.rowIndex));
    const maxRowIndex = Math.max(...cellPositions.map(p => p.rowIndex));
    const minColumnIndex = Math.min(...cellPositions.map(p => p.columnIndex));
    const maxColumnIndex = Math.max(...cellPositions.map(p => p.columnIndex));
    
    // Calculate fill range based on direction
    let fillStartRow: number;
    let fillEndRow: number;
    
    if (direction === 'down') {
      fillStartRow = maxRowIndex + 1;
      fillEndRow = Math.min(fillStartRow + additionalRows - 1, sortedData.length - 1);
    } else {
      fillEndRow = minRowIndex - 1;
      fillStartRow = Math.max(fillEndRow - additionalRows + 1, 0);
    }
    
    // Generate preview cell keys
    for (let rowIndex = fillStartRow; rowIndex <= fillEndRow; rowIndex++) {
      if (rowIndex >= 0 && rowIndex < sortedData.length) {
        for (let columnIndex = minColumnIndex; columnIndex <= maxColumnIndex; columnIndex++) {
          if (columnIndex >= 0 && columnIndex < columns.length) {
            const rowId = sortedData[rowIndex].id;
            const columnId = columns[columnIndex].id;
            previewCells.add(`${rowId}:${columnId}`);
          }
        }
      }
    }
    
    return previewCells;
  }

  private completeFillHandleDrag(): void {
    log.info('[LegendTableEventSystem] Fill handle drag completed');
    document.body.style.cursor = '';
    
    // Execute fill operation using Legend State methods
    const dragState = this.dragState$.get();
    const previewCells = dragState.previewCells;
    
    if (previewCells.size > 0) {
      log.info('[LegendTableEventSystem] Executing fillDown operation', {
        previewCells: Array.from(previewCells)
      });
      
      // Get the current selection as the source range
      const selectedCells = this.tableState.selection.selectedCells.get();
      
      // Execute the fill operation
      this.tableState.fillDown(selectedCells, previewCells);
      
      // Update selection to include all filled cells (original + preview)
      const finalSelection = new Set([...selectedCells, ...previewCells]);
      this.tableState.selection.selectedCells.set(finalSelection);
      
      log.info('[LegendTableEventSystem] Fill operation completed', {
        originalSelection: selectedCells.size,
        fillCells: previewCells.size,
        finalSelection: finalSelection.size
      });
    }
    
    // Clear the fill preview (dotted lines)
    this.showFillPreview(new Set());
  }

  private handleCellSelection(eventData: MouseEventData): void {
    const target = this.mouseState.target;
    if (target?.type !== 'cell' || !target.cellKey) return;

    log.info('[LegendTableEventSystem] Cell selection initiated', { cellKey: target.cellKey });

    if (!eventData.ctrlKey && !eventData.shiftKey) {
      // Single cell selection
      this.tableState.selectCell(target.cellKey, false);
      this.dragState$.startCell.set(target.cellKey);
    }
  }

  private handleSelectionDragMove(eventData: MouseEventData): void {
    const target = this.identifyTarget(eventData.target);
    const startCell = this.dragState$.startCell.get();
    
    if (target.type !== 'cell' || !target.cellKey || !startCell) return;

    log.info('[LegendTableEventSystem] Selection drag move', { 
      from: startCell, 
      to: target.cellKey 
    });

    // Use Legend State's selectRange method
    this.tableState.selectRange(startCell, target.cellKey);
  }

  private completeSelectionDrag(): void {
    log.info('[LegendTableEventSystem] Selection drag completed');
  }

  // ====================================
  // FILL PREVIEW HELPERS
  // ====================================

  private showFillPreview(previewCells: Set<string>): void {
    if (!this.canvasOverlay) {
      log.warn('[LegendTableEventSystem] Cannot show fill preview - no canvas overlay reference');
      return;
    }

    // Get the selection overlay from canvas overlay
    const selectionOverlay = this.canvasOverlay.getSelectionOverlay?.();
    if (!selectionOverlay) {
      log.warn('[LegendTableEventSystem] Cannot show fill preview - no selection overlay');
      return;
    }

    // Get viewport and coordinate mapping
    const viewport = this.canvasOverlay.getCurrentViewport?.();
    const coordinateMapping = this.canvasOverlay.getCurrentCoordinateMapping?.();

    if (previewCells.size === 0) {
      selectionOverlay.clearFillPreview();
    } else {
      selectionOverlay.showFillPreview(previewCells, viewport, coordinateMapping);
    }
  }

  // ====================================
  // PUBLIC API
  // ====================================

  public getCurrentTool() {
    return this.currentTool$.get();
  }

  public getDragState() {
    return this.dragState$.get();
  }

  public updateCanvasOverlay(canvasOverlay: any): void {
    log.info('[LegendTableEventSystem] Updating canvas overlay reference');
    this.canvasOverlay = canvasOverlay;
  }

  // ====================================
  // CLEANUP
  // ====================================

  public destroy(): void {
    log.info('[LegendTableEventSystem] Cleaning up event system');
    this.disposers.forEach(dispose => dispose());
    this.disposers.length = 0;
  }
}