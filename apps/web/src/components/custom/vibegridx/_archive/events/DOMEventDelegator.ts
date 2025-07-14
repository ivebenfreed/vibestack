import type { EventCoordinator } from './EventCoordinator';
import type { CellRef } from '../types';

// ====================================
// DOM EVENT DELEGATOR
// ====================================

export interface DOMEventDelegatorConfig {
  container: HTMLElement;
  eventCoordinator: EventCoordinator;
  getCellRef?: (element: HTMLElement) => CellRef | null;
}

export class DOMEventDelegator {
  private config: DOMEventDelegatorConfig;
  private dragState = {
    isDragging: false,
    startCell: null as CellRef | null,
    startPos: null as { x: number; y: number } | null
  };
  
  // Event listeners for cleanup
  private listeners: Array<{ element: Element | Document; event: string; handler: any }> = [];
  
  constructor(config: DOMEventDelegatorConfig) {
    this.config = config;
    this.setupEventDelegation();
  }
  
  // ====================================
  // SETUP
  // ====================================
  
  private setupEventDelegation(): void {
    const { container } = this.config;
    
    // Mouse events
    this.addListener(container, 'click', this.handleClick);
    this.addListener(container, 'dblclick', this.handleDoubleClick);
    this.addListener(container, 'contextmenu', this.handleContextMenu);
    this.addListener(container, 'mousedown', this.handleMouseDown);
    this.addListener(container, 'mousemove', this.handleMouseMove);
    this.addListener(container, 'mouseup', this.handleMouseUp);
    this.addListener(container, 'mouseleave', this.handleMouseLeave);
    
    // Keyboard events
    this.addListener(container, 'keydown', this.handleKeyDown);
    
    // Scroll events
    const viewport = container.querySelector('.vibegridx-viewport');
    if (viewport) {
      this.addListener(viewport, 'scroll', this.handleScroll);
    }
    
    // Wheel events
    this.addListener(container, 'wheel', this.handleWheel, { passive: false });
    
    // Focus events
    this.addListener(container, 'focus', this.handleFocus, true);
    this.addListener(container, 'blur', this.handleBlur, true);
    
    // Document-level events for drag
    this.addListener(document, 'mousemove', this.handleDocumentMouseMove);
    this.addListener(document, 'mouseup', this.handleDocumentMouseUp);
  }
  
  private addListener(
    element: Element | Document, 
    event: string, 
    handler: (e: Event) => void, 
    options?: boolean | AddEventListenerOptions
  ): void {
    const boundHandler = handler.bind(this);
    element.addEventListener(event, boundHandler, options);
    this.listeners.push({ element, event, handler: boundHandler });
  }
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  private handleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    
    // Handle cell clicks
    const cellElement = target.closest('.vibegridx-cell') as HTMLElement;
    if (cellElement) {
      const cellRef = this.getCellRef(cellElement);
      if (cellRef) {
        this.config.eventCoordinator.dispatch({
          type: 'cell:click',
          rowId: cellRef.rowId,
          columnId: cellRef.columnId,
          event
        });
      }
      return;
    }
    
    // Handle header clicks
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    if (headerCell) {
      const columnId = headerCell.dataset.column;
      if (columnId) {
        // Could dispatch column:click event here
      }
    }
  };
  
  private handleDoubleClick = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const cellElement = target.closest('.vibegridx-cell') as HTMLElement;
    
    if (cellElement) {
      const cellRef = this.getCellRef(cellElement);
      if (cellRef) {
        this.config.eventCoordinator.dispatch({
          type: 'cell:doubleClick',
          rowId: cellRef.rowId,
          columnId: cellRef.columnId,
          event
        });
      }
    }
  };
  
  private handleContextMenu = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const cellElement = target.closest('.vibegridx-cell') as HTMLElement;
    
    if (cellElement) {
      const cellRef = this.getCellRef(cellElement);
      if (cellRef) {
        event.preventDefault();
        this.config.eventCoordinator.dispatch({
          type: 'cell:contextMenu',
          rowId: cellRef.rowId,
          columnId: cellRef.columnId,
          event
        });
      }
    }
  };
  
  private handleMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const cellElement = target.closest('.vibegridx-cell') as HTMLElement;
    
    if (cellElement) {
      const cellRef = this.getCellRef(cellElement);
      if (cellRef) {
        // Start potential drag
        this.dragState = {
          isDragging: false,
          startCell: cellRef,
          startPos: { x: event.clientX, y: event.clientY }
        };
        
        // Prevent text selection
        event.preventDefault();
      }
    }
  };
  
  private handleMouseMove = (event: MouseEvent): void => {
    if (!this.dragState.startCell || !this.dragState.startPos) return;
    
    // Check if we should start dragging
    if (!this.dragState.isDragging) {
      const deltaX = Math.abs(event.clientX - this.dragState.startPos.x);
      const deltaY = Math.abs(event.clientY - this.dragState.startPos.y);
      
      if (deltaX > 5 || deltaY > 5) {
        this.dragState.isDragging = true;
        this.config.eventCoordinator.dispatch({
          type: 'drag:start',
          startCell: this.dragState.startCell,
          startPos: this.dragState.startPos
        });
      }
    }
    
    if (this.dragState.isDragging) {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      const cellElement = target?.closest('.vibegridx-cell') as HTMLElement;
      
      if (cellElement) {
        const cellRef = this.getCellRef(cellElement);
        if (cellRef) {
          this.config.eventCoordinator.dispatch({
            type: 'drag:move',
            currentCell: cellRef,
            currentPos: { x: event.clientX, y: event.clientY }
          });
        }
      }
    }
  };
  
  private handleMouseUp = (event: MouseEvent): void => {
    if (this.dragState.isDragging) {
      this.config.eventCoordinator.dispatch({
        type: 'drag:end'
      });
    }
    
    // Reset drag state
    this.dragState = {
      isDragging: false,
      startCell: null,
      startPos: null
    };
  };
  
  private handleMouseLeave = (event: MouseEvent): void => {
    // Continue drag outside container
  };
  
  private handleDocumentMouseMove = (event: MouseEvent): void => {
    if (this.dragState.isDragging) {
      this.handleMouseMove(event);
    }
  };
  
  private handleDocumentMouseUp = (event: MouseEvent): void => {
    if (this.dragState.isDragging) {
      this.handleMouseUp(event);
    }
  };
  
  private handleKeyDown = (event: KeyboardEvent): void => {
    // Map keys to event types
    const keyMap: Record<string, string> = {
      'ArrowUp': 'keyboard:arrow',
      'ArrowDown': 'keyboard:arrow',
      'ArrowLeft': 'keyboard:arrow',
      'ArrowRight': 'keyboard:arrow',
      'Tab': 'keyboard:tab',
      'Enter': 'keyboard:enter',
      'Escape': 'keyboard:escape',
      'Delete': 'keyboard:delete',
      'Backspace': 'keyboard:delete'
    };
    
    // Handle key combinations
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
      switch (event.key) {
        case 'a':
        case 'A':
          event.preventDefault();
          this.config.eventCoordinator.dispatch({
            type: 'keyboard:selectAll',
            event
          });
          return;
          
        case 'c':
        case 'C':
          event.preventDefault();
          this.config.eventCoordinator.dispatch({
            type: 'keyboard:copy',
            event
          });
          return;
          
        case 'x':
        case 'X':
          event.preventDefault();
          this.config.eventCoordinator.dispatch({
            type: 'keyboard:cut',
            event
          });
          return;
          
        case 'v':
        case 'V':
          event.preventDefault();
          this.config.eventCoordinator.dispatch({
            type: 'keyboard:paste',
            event
          });
          return;
          
        case 'z':
        case 'Z':
          event.preventDefault();
          this.config.eventCoordinator.dispatch({
            type: 'keyboard:undo',
            event
          });
          return;
      }
    }
    
    // Handle Ctrl+Shift+Z or Cmd+Shift+Z for redo
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      this.config.eventCoordinator.dispatch({
        type: 'keyboard:redo',
        event
      });
      return;
    }
    
    // Handle regular keys
    const eventType = keyMap[event.key];
    if (eventType) {
      const direction = event.key.replace('Arrow', '').toLowerCase() as any;
      this.config.eventCoordinator.dispatch({
        type: eventType as any,
        event,
        direction
      });
    }
  };
  
  private handleScroll = (event: Event): void => {
    const viewport = event.target as HTMLElement;
    
    // Calculate viewport info
    const rowHeight = 40; // Should come from config
    const scrollTop = viewport.scrollTop;
    const scrollLeft = viewport.scrollLeft;
    const height = viewport.clientHeight;
    const width = viewport.clientWidth;
    
    const start = Math.floor(scrollTop / rowHeight);
    const end = start + Math.ceil(height / rowHeight);
    
    this.config.eventCoordinator.dispatch({
      type: 'scroll:viewport',
      viewport: {
        start,
        end,
        height,
        width,
        scrollTop,
        itemHeight: rowHeight
      },
      scrollLeft,
      scrollTop
    });
  };
  
  private handleWheel = (event: WheelEvent): void => {
    // Allow natural scrolling
    // Could add zoom handling here with Ctrl+Wheel
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      // Could dispatch zoom event
    }
  };
  
  private handleFocus = (event: FocusEvent): void => {
    // Grid gained focus
  };
  
  private handleBlur = (event: FocusEvent): void => {
    // Grid lost focus
  };
  
  // ====================================
  // HELPERS
  // ====================================
  
  private getCellRef(element: HTMLElement): CellRef | null {
    if (this.config.getCellRef) {
      return this.config.getCellRef(element);
    }
    
    // Default implementation
    const rowId = element.dataset.rowId;
    const columnId = element.dataset.columnId;
    
    if (rowId && columnId) {
      return { rowId, columnId };
    }
    
    return null;
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  destroy(): void {
    // Remove all listeners
    this.listeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    
    this.listeners = [];
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createDOMEventDelegator(config: DOMEventDelegatorConfig): DOMEventDelegator {
  return new DOMEventDelegator(config);
}