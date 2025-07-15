// ====================================
// EVENT DELEGATION SYSTEM
// ====================================

import { ViewportInfo } from '../../types';

// ====================================
// TYPES
// ====================================

export interface EventCallbacks {
  onCellClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onCellDoubleClick?: (rowId: string, columnId: string, event: MouseEvent) => void;
  onHeaderClick?: (columnId: string, event: MouseEvent) => void;
  onColumnResizeStart?: (columnId: string, x: number, width: number) => void;
  onColumnResizeMove?: (x: number) => void;
  onColumnResizeEnd?: () => void;
  onColumnDragStart?: (columnId: string, x: number, y: number) => void;
  onColumnDragMove?: (x: number, y: number) => void;
  onColumnDragEnd?: (targetIndex: number) => void;
  onScroll?: (viewport: ViewportInfo) => void;
}

export interface EventSystemConfig {
  domManager: any; // DOMSystem
  virtualGrid: any; // VirtualScrollManager
  callbacks: EventCallbacks;
}

// ====================================
// CSS CLASSES
// ====================================

const CSS_CLASSES = {
  CELL: 'vibegridx-cell',
  ROW: 'vibegridx-row',
  HEADER_CELL: 'vibegridx-header-cell',
  SORT_ICON: 'vibegridx-sort-icon',
  RESIZE_HANDLE: 'vibegridx-resize-handle',
  DROP_INDICATOR: 'vibegridx-column-drop-indicator'
} as const;

// ====================================
// EVENT DELEGATION SYSTEM
// ====================================

export class EventSystem {
  private config: EventSystemConfig;
  private isScrolling = false;
  private isResizing = false;
  
  // Drag state
  private dragState = {
    isDragging: false,
    draggedColumnId: null as string | null,
    startX: 0,
    startY: 0,
    offsetX: 0,
    offsetY: 0,
    dragPreview: null as HTMLElement | null,
    dropIndicator: null as HTMLElement | null
  };

  // Bound handlers for cleanup
  private boundHandleResizeMove: (event: MouseEvent) => void;
  private boundHandleResizeEnd: (event: MouseEvent) => void;
  private boundHandleDragMove: (event: MouseEvent) => void;
  private boundHandleDragEnd: (event: MouseEvent) => void;
  private boundHandleScroll: () => void;

  constructor(config: EventSystemConfig) {
    this.config = config;
    
    // Bind handlers for cleanup
    this.boundHandleResizeMove = this.handleResizeMove.bind(this);
    this.boundHandleResizeEnd = this.handleResizeEnd.bind(this);
    this.boundHandleDragMove = this.handleDragMove.bind(this);
    this.boundHandleDragEnd = this.handleDragEnd.bind(this);
    this.boundHandleScroll = this.handleScroll.bind(this);
  }

  // ====================================
  // SETUP AND CLEANUP
  // ====================================

  setupEventListeners(): void {
    const { domManager } = this.config;
    const header = domManager.getElement('header');
    const body = domManager.getElement('body');
    const viewport = domManager.getElement('viewport');

    // Scroll handling
    viewport.addEventListener('scroll', this.boundHandleScroll);

    // Cell interaction handlers
    body.addEventListener('click', this.handleCellClick.bind(this));
    body.addEventListener('dblclick', this.handleCellDoubleClick.bind(this));

    // Header interaction handlers
    header.addEventListener('click', this.handleHeaderClick.bind(this));
    header.addEventListener('mousedown', this.handleHeaderMouseDown.bind(this));

    // Make viewport focusable
    viewport.setAttribute('tabindex', '0');
  }

  cleanup(): void {
    const { domManager } = this.config;
    const header = domManager.getElement('header');
    const body = domManager.getElement('body');
    const viewport = domManager.getElement('viewport');

    // Remove scroll listener
    viewport.removeEventListener('scroll', this.boundHandleScroll);

    // Remove cell listeners
    body.removeEventListener('click', this.handleCellClick.bind(this));
    body.removeEventListener('dblclick', this.handleCellDoubleClick.bind(this));

    // Remove header listeners
    header.removeEventListener('click', this.handleHeaderClick.bind(this));
    header.removeEventListener('mousedown', this.handleHeaderMouseDown.bind(this));

    // Remove global listeners if active
    this.removeGlobalDragListeners();
    this.removeGlobalResizeListeners();
  }

  // ====================================
  // SCROLL HANDLING
  // ====================================

  private handleScroll(): void {
    const { domManager, virtualGrid, callbacks } = this.config;
    const header = domManager.getElement('header');
    const viewport = domManager.getElement('viewport');

    // Always sync header immediately for smooth horizontal scrolling
    header.style.transform = `translateX(-${viewport.scrollLeft}px)`;

    // Prevent multiple simultaneous updates
    if (this.isScrolling) return;
    this.isScrolling = true;

    requestAnimationFrame(() => {
      const scrollTop = viewport.scrollTop;
      const viewportHeight = viewport.clientHeight;
      const viewportWidth = viewport.clientWidth;
      const scrollLeft = viewport.scrollLeft;

      // Use VirtualScrollManager to calculate viewport
      const newViewport = virtualGrid.calculateViewportFromScroll(
        scrollTop,
        viewportHeight,
        viewportWidth,
        scrollLeft
      );

      callbacks.onScroll?.(newViewport);

      // Allow next update
      this.isScrolling = false;
    });
  }

  // ====================================
  // CELL EVENT HANDLERS
  // ====================================

  private handleCellClick(event: MouseEvent): void {
    const cellElement = (event.target as Element).closest(`.${CSS_CLASSES.CELL}`) as HTMLElement;
    if (!cellElement) return;

    const rowId = cellElement.dataset.rowId!;
    const columnId = cellElement.dataset.columnId!;

    // Ensure viewport has focus for keyboard events, but prevent scrolling
    this.config.domManager.getElement('viewport').focus({ preventScroll: true });

    this.config.callbacks.onCellClick?.(rowId, columnId, event);
  }

  private handleCellDoubleClick(event: MouseEvent): void {
    const cellElement = (event.target as Element).closest(`.${CSS_CLASSES.CELL}`) as HTMLElement;
    if (!cellElement) return;

    const rowId = cellElement.dataset.rowId!;
    const columnId = cellElement.dataset.columnId!;

    this.config.callbacks.onCellDoubleClick?.(rowId, columnId, event);
  }

  // ====================================
  // HEADER EVENT HANDLERS
  // ====================================

  private handleHeaderClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const headerCell = target.closest(`.${CSS_CLASSES.HEADER_CELL}`) as HTMLElement;
    const resizeHandle = target.closest(`.${CSS_CLASSES.RESIZE_HANDLE}`);

    // Don't handle click if it's on a resize handle (handled in mousedown)
    if (resizeHandle) return;

    if (headerCell) {
      const columnId = headerCell.dataset.column!;
      this.config.callbacks.onHeaderClick?.(columnId, event);
    }
  }

  private handleHeaderMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const headerCell = target.closest(`.${CSS_CLASSES.HEADER_CELL}`) as HTMLElement;
    const sortIcon = target.closest(`.${CSS_CLASSES.SORT_ICON}`);
    const resizeHandle = target.closest(`.${CSS_CLASSES.RESIZE_HANDLE}`);

    // Handle resize
    if (resizeHandle) {
      this.startResize(event, resizeHandle as HTMLElement);
      return;
    }

    // Handle column drag (but not on sort icon)
    if (headerCell && !sortIcon && !resizeHandle) {
      this.startColumnDrag(event, headerCell);
      return;
    }
  }

  // ====================================
  // COLUMN RESIZE HANDLING
  // ====================================

  private startResize(event: MouseEvent, resizeHandle: HTMLElement): void {
    event.preventDefault();
    const columnId = resizeHandle.dataset.column;

    if (columnId) {
      const currentWidth = this.config.columnManager.getColumnWidth(columnId);

      // Send resize start event
      this.config.callbacks.onColumnResizeStart?.(columnId, event.clientX, currentWidth);

      // Set resizing state
      this.isResizing = true;

      // Add global mouse event listeners
      document.addEventListener('mousemove', this.boundHandleResizeMove);
      document.addEventListener('mouseup', this.boundHandleResizeEnd);
    }
  }

  private handleResizeMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    this.config.callbacks.onColumnResizeMove?.(event.clientX);
  }

  private handleResizeEnd(event: MouseEvent): void {
    if (!this.isResizing) return;

    // Clear resizing state
    this.isResizing = false;

    // Send resize end event
    this.config.callbacks.onColumnResizeEnd?.();

    // Remove global listeners
    this.removeGlobalResizeListeners();
  }

  private removeGlobalResizeListeners(): void {
    document.removeEventListener('mousemove', this.boundHandleResizeMove);
    document.removeEventListener('mouseup', this.boundHandleResizeEnd);
  }

  // ====================================
  // COLUMN DRAG HANDLING
  // ====================================

  private startColumnDrag(event: MouseEvent, headerCell: HTMLElement): void {
    event.preventDefault();
    const columnId = headerCell.dataset.column!;
    
    // Don't allow dragging the selection column
    if (columnId === '__selection') {
      return;
    }

    // Calculate offset from click position to header cell position
    const headerRect = headerCell.getBoundingClientRect();
    const offsetX = event.clientX - headerRect.left;
    const offsetY = event.clientY - headerRect.top;
    
    // Create drag preview
    const columnText = headerCell.querySelector('.vibegridx-header-text')?.textContent || columnId;
    const dragPreview = document.createElement('div');
    dragPreview.className = 'vibegridx-drag-preview';
    dragPreview.textContent = columnText;
    // Position preview so text stays under cursor
    dragPreview.style.left = `${event.clientX - offsetX}px`;
    dragPreview.style.top = `${event.clientY - offsetY}px`;
    document.body.appendChild(dragPreview);
    
    // Create drop indicator
    const dropIndicator = document.createElement('div');
    dropIndicator.className = 'vibegridx-column-drop-indicator';
    // Append to header so it scrolls with columns
    this.config.domManager.getElement('header').appendChild(dropIndicator);

    // Initialize drag state
    this.dragState = {
      isDragging: true,
      draggedColumnId: columnId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: offsetX,
      offsetY: offsetY,
      dragPreview: dragPreview,
      dropIndicator: dropIndicator
    };
    
    // Add dragging class to header cell
    headerCell.classList.add('vibegridx-dragging');

    // Send drag start event
    this.config.callbacks.onColumnDragStart?.(columnId, event.clientX, event.clientY);

    // Add global mouse event listeners
    document.addEventListener('mousemove', this.boundHandleDragMove);
    document.addEventListener('mouseup', this.boundHandleDragEnd);
  }

  private handleDragMove(event: MouseEvent): void {
    // Skip if we're resizing
    if (this.isResizing) return;

    if (!this.dragState.isDragging || !this.dragState.dragPreview) return;
    
    event.preventDefault();
    
    // Update drag preview position maintaining the offset
    this.dragState.dragPreview.style.left = `${event.clientX - this.dragState.offsetX}px`;
    this.dragState.dragPreview.style.top = `${event.clientY - this.dragState.offsetY}px`;
    
    // Calculate drop position and update displacement
    const headerViewportRect = this.config.domManager.getElement('headerViewport').getBoundingClientRect();
    
    // Since the header is transformed, we need to calculate the position differently
    const relativeToViewport = event.clientX - headerViewportRect.left;
    const relativeX = relativeToViewport + this.config.domManager.getElement('viewport').scrollLeft;
    
    // Find target position and update column displacement
    let targetIndex = 0;
    let accumulatedWidth = 48; // Start after selection column (48px)
    let dropX = 48; // Initial drop position after selection column
    
    // Clear all displacement classes
    this.config.domManager.getElement('header').querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
      htmlCell.style.removeProperty('--drag-offset');
    });
    
    // Find current position of dragged column (excluding selection column)
    const dataColumns = this.config.columnManager.getDataColumns();
    const draggedIndex = dataColumns.findIndex(col => col.id === this.dragState.draggedColumnId);
    
    // Find where the mouse is in relation to columns
    let foundColumn = false;
    for (let i = 0; i < dataColumns.length; i++) {
      const column = dataColumns[i];
      const columnWidth = this.config.columnManager.getColumnWidth(column.id);
      const columnStart = accumulatedWidth;
      const columnEnd = accumulatedWidth + columnWidth;
      
      // Check if mouse is within this column's bounds
      if (relativeX >= columnStart && relativeX < columnEnd) {
        // Determine if we're in the left or right half of the column
        const columnMidPoint = columnStart + columnWidth / 2;
        
        if (relativeX < columnMidPoint) {
          // Mouse is in left half - drop before this column
          targetIndex = i;
          dropX = columnStart;
        } else {
          // Mouse is in right half - drop after this column
          targetIndex = i + 1;
          dropX = columnEnd;
        }
        
        foundColumn = true;
        break;
      }
      
      accumulatedWidth += columnWidth;
    }
    
    // Handle case where mouse is beyond all columns
    if (!foundColumn) {
      // Mouse is past all columns
      targetIndex = dataColumns.length;
      dropX = accumulatedWidth;
    }
    
    // Get the width of the dragged column
    const draggedColumn = dataColumns[draggedIndex];
    const draggedWidth = this.config.columnManager.getColumnWidth(draggedColumn.id);
    
    // Adjust target index to account for removing the dragged column
    let adjustedTargetIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      adjustedTargetIndex = targetIndex - 1;
    }
    
    // Apply displacement classes with proper offset (only to data columns, not selection column)
    dataColumns.forEach((column, index) => {
      const cell = this.config.domManager.getElement('header').querySelector(`[data-column="${column.id}"]`) as HTMLElement;
      if (cell && column.id !== this.dragState.draggedColumnId) {
        // Moving right: columns between old and new position shift left
        if (draggedIndex < adjustedTargetIndex && index > draggedIndex && index <= adjustedTargetIndex) {
          cell.classList.add('vibegridx-will-move-left');
          cell.style.setProperty('--drag-offset', `-${draggedWidth}px`);
        } 
        // Moving left: columns between new and old position shift right
        else if (draggedIndex > targetIndex && index >= targetIndex && index < draggedIndex) {
          cell.classList.add('vibegridx-will-move-right');
          cell.style.setProperty('--drag-offset', `${draggedWidth}px`);
        }
      }
    });
    
    // Update drop indicator position
    if (this.dragState.dropIndicator) {
      this.dragState.dropIndicator.style.left = `${dropX}px`;
    }

    // Don't send drag move events to parent - visual feedback is handled entirely here
  }

  private handleDragEnd(event: MouseEvent): void {
    // Skip if we're resizing
    if (this.isResizing) return;

    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    // Remove drag preview
    if (this.dragState.dragPreview) {
      this.dragState.dragPreview.remove();
    }
    
    // Remove drop indicator
    if (this.dragState.dropIndicator) {
      this.dragState.dropIndicator.remove();
    }
    
    // Remove all displacement classes
    this.config.domManager.getElement('header').querySelectorAll('.vibegridx-header-cell').forEach(cell => {
      const htmlCell = cell as HTMLElement;
      htmlCell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-dragging');
      htmlCell.style.removeProperty('--drag-offset');
    });

    // Calculate target index based on final position
    const targetIndex = this.calculateDropTargetIndex(event.clientX);

    // Send drag end event
    this.config.callbacks.onColumnDragEnd?.(targetIndex);

    // Reset drag state
    this.dragState = {
      isDragging: false,
      draggedColumnId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      dragPreview: null,
      dropIndicator: null
    };

    // Remove global listeners
    this.removeGlobalDragListeners();
  }

  private removeGlobalDragListeners(): void {
    document.removeEventListener('mousemove', this.boundHandleDragMove);
    document.removeEventListener('mouseup', this.boundHandleDragEnd);
  }

  private calculateDropTargetIndex(clientX: number): number {
    // Get header viewport position
    const headerViewportRect = this.config.domManager.getElement('headerViewport').getBoundingClientRect();

    // Calculate position relative to viewport accounting for scroll
    const relativeToViewport = clientX - headerViewportRect.left;
    const relativeX = relativeToViewport + this.config.domManager.getElement('viewport').scrollLeft;

    // Find target column index, excluding selection column
    let targetIndex = 0;
    let accumulatedWidth = 48; // Start with selection column width
    
    // Get data columns only (excluding selection column)
    const dataColumns = this.config.columnManager.getDataColumns();
    
    for (let i = 0; i < dataColumns.length; i++) {
      const columnWidth = this.config.columnManager.getColumnWidth(dataColumns[i].id);
      if (relativeX > accumulatedWidth + columnWidth / 2) {
        targetIndex = i + 1;
      }
      accumulatedWidth += columnWidth;
    }
    
    return targetIndex;
  }

  // ====================================
  // PUBLIC METHODS
  // ====================================

  getDragState() {
    return { ...this.dragState };
  }

  getResizeState() {
    return { isResizing: this.isResizing };
  }
}