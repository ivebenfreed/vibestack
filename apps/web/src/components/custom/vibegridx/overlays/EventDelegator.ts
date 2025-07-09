import type { ViewportInfo } from '../types';
import { CoordinateSystem } from './CoordinateSystem';

// ====================================
// EVENT DELEGATOR
// ====================================

export interface DelegatedEvent {
  type: 'click' | 'dblclick' | 'mousedown' | 'mouseup' | 'mousemove' | 'mouseenter' | 'mouseleave';
  cellKey: string | null;
  rowId: string | null;
  columnId: string | null;
  position: { x: number; y: number };
  originalEvent: MouseEvent;
}

export type EventHandler = (event: DelegatedEvent) => void;

export class EventDelegator {
  private container: HTMLElement;
  private coordinateSystem: CoordinateSystem;
  private handlers = new Map<string, Set<EventHandler>>();
  private currentHoveredCell: string | null = null;
  
  // Event batching for mousemove
  private mouseMoveThrottleId: number | null = null;
  private lastMouseMoveEvent: MouseEvent | null = null;
  
  constructor(container: HTMLElement, coordinateSystem: CoordinateSystem) {
    this.container = container;
    this.coordinateSystem = coordinateSystem;
    
    this.setupEventListeners();
  }
  
  private setupEventListeners(): void {
    // Use passive listeners for better scroll performance
    const options = { passive: true, capture: false };
    
    // Click events
    this.container.addEventListener('click', this.handleClick, options);
    this.container.addEventListener('dblclick', this.handleDoubleClick, options);
    
    // Mouse events
    this.container.addEventListener('mousedown', this.handleMouseDown, options);
    this.container.addEventListener('mouseup', this.handleMouseUp, options);
    this.container.addEventListener('mousemove', this.handleMouseMove, options);
    this.container.addEventListener('mouseleave', this.handleMouseLeave, options);
  }
  
  // Register event handler
  on(eventType: DelegatedEvent['type'], handler: EventHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    
    this.handlers.get(eventType)!.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.handlers.get(eventType)?.delete(handler);
    };
  }
  
  // Handle click events
  private handleClick = (e: MouseEvent): void => {
    const delegatedEvent = this.createDelegatedEvent('click', e);
    this.dispatch(delegatedEvent);
  };
  
  // Handle double click events
  private handleDoubleClick = (e: MouseEvent): void => {
    const delegatedEvent = this.createDelegatedEvent('dblclick', e);
    this.dispatch(delegatedEvent);
  };
  
  // Handle mouse down events
  private handleMouseDown = (e: MouseEvent): void => {
    const delegatedEvent = this.createDelegatedEvent('mousedown', e);
    this.dispatch(delegatedEvent);
  };
  
  // Handle mouse up events
  private handleMouseUp = (e: MouseEvent): void => {
    const delegatedEvent = this.createDelegatedEvent('mouseup', e);
    this.dispatch(delegatedEvent);
  };
  
  // Handle mouse move events with throttling
  private handleMouseMove = (e: MouseEvent): void => {
    this.lastMouseMoveEvent = e;
    
    // Throttle mousemove events to 60fps (16ms)
    if (!this.mouseMoveThrottleId) {
      this.mouseMoveThrottleId = window.setTimeout(() => {
        if (this.lastMouseMoveEvent) {
          const delegatedEvent = this.createDelegatedEvent('mousemove', this.lastMouseMoveEvent);
          
          // Handle cell enter/leave events
          if (delegatedEvent.cellKey !== this.currentHoveredCell) {
            // Mouse leave previous cell
            if (this.currentHoveredCell) {
              const leaveEvent: DelegatedEvent = {
                ...delegatedEvent,
                type: 'mouseleave',
                cellKey: this.currentHoveredCell,
                rowId: this.currentHoveredCell.split(':')[0],
                columnId: this.currentHoveredCell.split(':')[1]
              };
              this.dispatch(leaveEvent);
            }
            
            // Mouse enter new cell
            if (delegatedEvent.cellKey) {
              const enterEvent: DelegatedEvent = {
                ...delegatedEvent,
                type: 'mouseenter'
              };
              this.dispatch(enterEvent);
            }
            
            this.currentHoveredCell = delegatedEvent.cellKey;
          }
          
          this.dispatch(delegatedEvent);
        }
        
        this.mouseMoveThrottleId = null;
      }, 16);
    }
  };
  
  // Handle mouse leave events
  private handleMouseLeave = (e: MouseEvent): void => {
    if (this.currentHoveredCell) {
      const delegatedEvent = this.createDelegatedEvent('mouseleave', e);
      delegatedEvent.cellKey = this.currentHoveredCell;
      delegatedEvent.rowId = this.currentHoveredCell.split(':')[0];
      delegatedEvent.columnId = this.currentHoveredCell.split(':')[1];
      this.dispatch(delegatedEvent);
      this.currentHoveredCell = null;
    }
  };
  
  // Create delegated event from mouse event
  private createDelegatedEvent(type: DelegatedEvent['type'], e: MouseEvent): DelegatedEvent {
    const rect = this.container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Get viewport info from container
    const viewport: ViewportInfo = {
      start: 0,
      end: 50,
      height: this.container.clientHeight,
      width: this.container.clientWidth,
      scrollTop: this.container.scrollTop || 0,
      itemHeight: 40 // Default cell height
    };
    
    // Calculate cell position
    const cellPos = this.coordinateSystem.viewportToCell(x, y, viewport);
    
    let cellKey: string | null = null;
    let rowId: string | null = null;
    let columnId: string | null = null;
    
    if (cellPos) {
      const ids = this.coordinateSystem.cellIndicesToIds(cellPos.row, cellPos.column);
      if (ids.rowId && ids.columnId) {
        cellKey = `${ids.rowId}:${ids.columnId}`;
        rowId = ids.rowId;
        columnId = ids.columnId;
      }
    }
    
    return {
      type,
      cellKey,
      rowId,
      columnId,
      position: { x, y },
      originalEvent: e
    };
  }
  
  // Dispatch event to handlers
  private dispatch(event: DelegatedEvent): void {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(event);
        } catch (error) {
          console.error(`Error in event handler for ${event.type}:`, error);
        }
      });
    }
  }
  
  // Update viewport for coordinate calculations
  updateViewport(viewport: ViewportInfo): void {
    // This would be used if we need to cache viewport info
  }
  
  // Cleanup
  destroy(): void {
    // Remove event listeners
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('dblclick', this.handleDoubleClick);
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    this.container.removeEventListener('mouseup', this.handleMouseUp);
    this.container.removeEventListener('mousemove', this.handleMouseMove);
    this.container.removeEventListener('mouseleave', this.handleMouseLeave);
    
    // Clear throttle timeout
    if (this.mouseMoveThrottleId) {
      clearTimeout(this.mouseMoveThrottleId);
    }
    
    // Clear handlers
    this.handlers.clear();
  }
}