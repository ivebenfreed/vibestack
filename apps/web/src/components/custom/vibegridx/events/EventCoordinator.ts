import type { ActorRefFrom } from 'xstate';
import type { CellRef, Column, ViewportInfo } from '../types';
import type { tableBaseMachine } from '../machines/table-machine';
import type { CanvasOverlay } from '../overlays/CanvasOverlay';
import type { EntityIntegrationLayer } from '../integration/EntityIntegration';

// ====================================
// EVENT TYPES
// ====================================

export type GridEvent = 
  | CellEvent
  | SelectionEvent
  | EditEvent
  | ScrollEvent
  | KeyboardEvent
  | DragEvent
  | ResizeEvent
  | StateEvent;

export interface CellEvent {
  type: 'cell:click' | 'cell:doubleClick' | 'cell:contextMenu' | 'cell:hover';
  rowId: string;
  columnId: string;
  event: MouseEvent;
}

export interface SelectionEvent {
  type: 'selection:change' | 'selection:clear' | 'selection:all';
  cells?: Set<string>;
  mode?: 'single' | 'range' | 'multi';
}

export interface EditEvent {
  type: 'edit:start' | 'edit:end' | 'edit:cancel' | 'edit:save';
  cellRef?: CellRef;
  value?: any;
}

export interface ScrollEvent {
  type: 'scroll:viewport' | 'scroll:horizontal' | 'scroll:vertical';
  viewport?: ViewportInfo;
  scrollLeft?: number;
  scrollTop?: number;
}

export interface KeyboardEvent {
  type: 'keyboard:arrow' | 'keyboard:tab' | 'keyboard:enter' | 'keyboard:escape' | 
        'keyboard:delete' | 'keyboard:copy' | 'keyboard:cut' | 'keyboard:paste' |
        'keyboard:undo' | 'keyboard:redo' | 'keyboard:selectAll';
  event: React.KeyboardEvent | globalThis.KeyboardEvent;
  direction?: 'up' | 'down' | 'left' | 'right';
}

export interface DragEvent {
  type: 'drag:start' | 'drag:move' | 'drag:end' | 'drag:cancel';
  startCell?: CellRef;
  currentCell?: CellRef;
  startPos?: { x: number; y: number };
  currentPos?: { x: number; y: number };
}

export interface ResizeEvent {
  type: 'resize:column' | 'resize:row';
  id: string;
  size: number;
}

export interface StateEvent {
  type: 'state:render' | 'state:performance' | 'state:error';
  data?: any;
}

// ====================================
// EVENT LISTENER TYPE
// ====================================

export type EventListener<T extends GridEvent = GridEvent> = (event: T) => void;

// ====================================
// EVENT COORDINATOR CONFIG
// ====================================

export interface EventCoordinatorConfig {
  tableSend: ActorRefFrom<typeof tableBaseMachine>['send'];
  canvasOverlay?: CanvasOverlay;
  integration?: EntityIntegrationLayer;
  columns: Column[];
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
}

// ====================================
// EVENT COORDINATOR CLASS
// ====================================

export class EventCoordinator {
  private config: EventCoordinatorConfig;
  private listeners = new Map<string, Set<EventListener>>();
  private eventQueue: GridEvent[] = [];
  private isProcessing = false;
  private rafId: number | null = null;
  
  // Event statistics
  private eventStats = {
    total: 0,
    byType: new Map<string, number>(),
    processingTime: 0
  };
  
  constructor(config: EventCoordinatorConfig) {
    this.config = config;
    this.setupInternalListeners();
  }
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  /**
   * Dispatch an event
   */
  dispatch(event: GridEvent): void {
    // Add to queue
    this.eventQueue.push(event);
    
    // Process queue on next frame
    if (!this.isProcessing && !this.rafId) {
      this.rafId = requestAnimationFrame(() => {
        this.processEventQueue();
        this.rafId = null;
      });
    }
  }
  
  /**
   * Dispatch an event immediately (bypass queue)
   */
  dispatchImmediate(event: GridEvent): void {
    this.processEvent(event);
  }
  
  /**
   * Add event listener
   */
  on<T extends GridEvent>(eventType: T['type'], listener: EventListener<T>): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    
    this.listeners.get(eventType)!.add(listener as EventListener);
    
    // Return unsubscribe function
    return () => {
      this.off(eventType, listener);
    };
  }
  
  /**
   * Remove event listener
   */
  off<T extends GridEvent>(eventType: T['type'], listener: EventListener<T>): void {
    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.delete(listener as EventListener);
    }
  }
  
  /**
   * Get event statistics
   */
  getStats(): typeof this.eventStats {
    return { ...this.eventStats };
  }
  
  /**
   * Reset event statistics
   */
  resetStats(): void {
    this.eventStats.total = 0;
    this.eventStats.byType.clear();
    this.eventStats.processingTime = 0;
  }
  
  /**
   * Destroy coordinator
   */
  destroy(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
    }
    
    this.listeners.clear();
    this.eventQueue = [];
    this.resetStats();
  }
  
  // ====================================
  // PRIVATE METHODS
  // ====================================
  
  private setupInternalListeners(): void {
    // Cell events
    this.on('cell:click', this.handleCellClick.bind(this));
    this.on('cell:doubleClick', this.handleCellDoubleClick.bind(this));
    
    // Selection events
    this.on('selection:change', this.handleSelectionChange.bind(this));
    this.on('selection:clear', this.handleSelectionClear.bind(this));
    this.on('selection:all', this.handleSelectAll.bind(this));
    
    // Edit events
    this.on('edit:start', this.handleEditStart.bind(this));
    this.on('edit:save', this.handleEditSave.bind(this));
    this.on('edit:cancel', this.handleEditCancel.bind(this));
    
    // Keyboard events
    this.on('keyboard:arrow', this.handleArrowKey.bind(this));
    this.on('keyboard:tab', this.handleTab.bind(this));
    this.on('keyboard:enter', this.handleEnter.bind(this));
    this.on('keyboard:escape', this.handleEscape.bind(this));
    this.on('keyboard:delete', this.handleDelete.bind(this));
    this.on('keyboard:copy', this.handleCopy.bind(this));
    this.on('keyboard:cut', this.handleCut.bind(this));
    this.on('keyboard:paste', this.handlePaste.bind(this));
    
    // Scroll events
    this.on('scroll:viewport', this.handleViewportScroll.bind(this));
    
    // Drag events
    this.on('drag:start', this.handleDragStart.bind(this));
    this.on('drag:move', this.handleDragMove.bind(this));
    this.on('drag:end', this.handleDragEnd.bind(this));
  }
  
  private processEventQueue(): void {
    if (this.eventQueue.length === 0) return;
    
    this.isProcessing = true;
    const startTime = performance.now();
    
    // Process all queued events
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    events.forEach(event => {
      this.processEvent(event);
    });
    
    const endTime = performance.now();
    this.eventStats.processingTime += endTime - startTime;
    
    this.isProcessing = false;
  }
  
  private processEvent(event: GridEvent): void {
    // Update statistics
    this.eventStats.total++;
    this.eventStats.byType.set(
      event.type,
      (this.eventStats.byType.get(event.type) || 0) + 1
    );
    
    // Notify listeners
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in event listener for ${event.type}:`, error);
        }
      });
    }
  }
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  private handleCellClick(event: CellEvent): void {
    const { rowId, columnId, event: mouseEvent } = event;
    
    // Send to table machine
    this.config.tableSend({
      type: 'selection.cell.select',
      rowId,
      columnId,
      ctrlKey: mouseEvent.ctrlKey,
      shiftKey: mouseEvent.shiftKey
    });
    
    // Notify external handler
    this.config.onCellClick?.(rowId, columnId);
  }
  
  private handleCellDoubleClick(event: CellEvent): void {
    const { rowId, columnId } = event;
    
    // Start editing
    this.config.tableSend({
      type: 'edit.cell.start',
      rowId,
      columnId
    });
    
    // Notify external handler
    this.config.onCellDoubleClick?.(rowId, columnId);
  }
  
  private handleSelectionChange(event: SelectionEvent): void {
    const { cells } = event;
    
    if (cells) {
      // Update canvas overlay
      this.config.canvasOverlay?.updateSelection(cells);
      
      // Notify external handler
      this.config.onSelectionChange?.(cells);
    }
  }
  
  private handleSelectionClear(): void {
    this.config.tableSend({ type: 'selection.clear' });
  }
  
  private handleSelectAll(): void {
    this.config.tableSend({ type: 'keyboard.selectAll' });
  }
  
  private handleEditStart(event: EditEvent): void {
    const { cellRef } = event;
    
    if (cellRef) {
      this.config.onEditingChange?.(cellRef);
    }
  }
  
  private handleEditSave(event: EditEvent): void {
    const { cellRef, value } = event;
    
    if (cellRef) {
      this.config.tableSend({
        type: 'edit.cell.save',
        rowId: cellRef.rowId,
        columnId: cellRef.columnId,
        value
      });
    }
  }
  
  private handleEditCancel(): void {
    this.config.tableSend({ type: 'edit.cell.cancel' });
    this.config.onEditingChange?.(null);
  }
  
  private handleArrowKey(event: KeyboardEvent): void {
    const { direction, event: keyEvent } = event;
    
    if (direction) {
      keyEvent.preventDefault();
      keyEvent.stopPropagation();
      
      this.config.tableSend({
        type: 'keyboard.arrow',
        direction,
        extend: keyEvent.shiftKey
      });
    }
  }
  
  private handleTab(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({
      type: 'keyboard.tab',
      reverse: keyEvent.shiftKey
    });
  }
  
  private handleEnter(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({
      type: 'keyboard.enter',
      shift: keyEvent.shiftKey
    });
  }
  
  private handleEscape(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    // Priority handling
    if (this.config.canvasOverlay?.hasClipboardOutline()) {
      this.config.canvasOverlay.hideCopyIndicator();
    } else if (this.config.canvasOverlay?.hasFillOperation()) {
      this.config.canvasOverlay.overlayRenderer.cancelFill();
    } else {
      this.config.tableSend({ type: 'selection.clear' });
    }
  }
  
  private handleDelete(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({ type: 'keyboard.delete' });
  }
  
  private handleCopy(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({ type: 'keyboard.copy' });
  }
  
  private handleCut(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({ type: 'keyboard.cut' });
  }
  
  private handlePaste(event: KeyboardEvent): void {
    const { event: keyEvent } = event;
    
    keyEvent.preventDefault();
    
    this.config.tableSend({ type: 'keyboard.paste' });
  }
  
  private handleViewportScroll(event: ScrollEvent): void {
    const { viewport } = event;
    
    if (viewport) {
      this.config.tableSend({
        type: 'view.viewport.update',
        viewport
      });
    }
  }
  
  private handleDragStart(event: DragEvent): void {
    const { startCell } = event;
    
    if (startCell) {
      this.config.tableSend({
        type: 'selection.drag.start',
        startCell
      });
    }
  }
  
  private handleDragMove(event: DragEvent): void {
    const { currentCell } = event;
    
    if (currentCell) {
      this.config.tableSend({
        type: 'selection.drag.move',
        currentCell,
        selectedCells: new Set() // Will be calculated by machine
      });
    }
  }
  
  private handleDragEnd(event: DragEvent): void {
    this.config.tableSend({
      type: 'selection.drag.end',
      selectedCells: new Set() // Will be finalized by machine
    });
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createEventCoordinator(config: EventCoordinatorConfig): EventCoordinator {
  return new EventCoordinator(config);
}