import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/machines/table-machine/helpers/drag-preview-helpers.ts);
// ====================================
// DRAG PREVIEW HELPERS
// ====================================
// Calculates which columns should shift during drag preview

export interface DragPreviewData {
  draggedColumnId: string;
  targetIndex: number;
  columnsToShift: Array<{
    columnId: string;
    direction: 'left' | 'right';
    offset: number;
  }>;
  dropIndicatorX: number;
  // Mouse position for floating preview
  mouseX?: number;
  mouseY?: number;
  // Column display name
  columnName?: string;
  // Flag to indicate if this is the initial preview (for hiding original column)
  isInitialPreview?: boolean;
  // Debug information
  debugInfo?: {
    currentIndex: number;
    targetColumn?: string;
    mousePosition: number;
    columnBoundaries: Array<{ id: string; start: number; end: number }>;
  };
}

/**
 * Calculate drag preview data based on current mouse position
 * Mouse coordinates are expected to be in container-relative coordinates
 */
export function calculateDragPreview(
  mouseX: number,
  draggedColumnId: string,
  coordinateMapping: any,
  scrollLeft: number = 0
): DragPreviewData {
  if (!coordinateMapping?.columns) {
    return {
      draggedColumnId,
      targetIndex: -1,
      columnsToShift: [],
      dropIndicatorX: 0
    };
  }

  // Get ALL columns from coordinate mapping
  const allColumns = coordinateMapping.columns;
  
  // Get data columns only (exclude selection column)
  const dataColumns = coordinateMapping.columns
    .filter((col: any) => col.columnId !== '__selection')
    .sort((a: any, b: any) => a.index - b.index);

  if (dataColumns.length === 0) {
    return {
      draggedColumnId,
      targetIndex: -1,
      columnsToShift: [],
      dropIndicatorX: 0
    };
  }

  // Mouse coordinates are container-relative, but we need to add scrollLeft
  // to get the actual position in the scrolled content
  const adjustedMouseX = mouseX + scrollLeft;

  // Find current index of dragged column
  const currentIndex = dataColumns.findIndex((col: any) => col.columnId === draggedColumnId);
  if (currentIndex === -1) {
    return {
      draggedColumnId,
      targetIndex: -1,
      columnsToShift: [],
      dropIndicatorX: 0
    };
  }

  // Calculate column boundaries and midpoints for targeting logic

  // Find target position based on mouse position relative to column midpoints
  let targetIndex = currentIndex; // Default to no movement
  let dropIndicatorX = 0;
  const draggedColumn = dataColumns[currentIndex];
  
  // Removed verbose logging to reduce console spam
  
  // Mouse is outside the dragged column - now use midpoint logic
  // Check columns from left to right to find where the mouse is
  const foundTarget = false;
  
  // Find the best target position by checking all columns
  let bestTargetIndex = currentIndex;
  let bestDropX = 0;
  
  // When dragging left, find the leftmost column whose midpoint we haven't passed
  if (adjustedMouseX < draggedColumn.offset) {
    // Dragging left logic
    
    // Check if we should show the indicator at the absolute leftmost data position
    // This would be right after the selection column if it exists
    const selectionColumn = coordinateMapping.columns.find((col: any) => col.columnId === '__selection');
    const leftmostDataPosition = selectionColumn ? selectionColumn.offset + selectionColumn.width : 0;
    
    // Start from the position to the left of current column
    bestTargetIndex = currentIndex; // Default to current position
    bestDropX = draggedColumn.offset; // Default to current column start
    
    // Check all columns to the left, starting from the one immediately left
    for (let i = currentIndex - 1; i >= 0; i--) {
      const col = dataColumns[i];
      const colMidpoint = col.offset + col.width / 2;
      
      // Check if mouse is left of this column's midpoint
      
      if (adjustedMouseX < colMidpoint) {
        // Mouse is left of this column's midpoint, so we want to insert before it
        bestTargetIndex = i;
        bestDropX = col.offset;
        // Updated target to left
      } else {
        // Mouse has passed this column's midpoint, stop searching
        // Mouse past midpoint, stop searching
        break;
      }
    }
    
    // Special case: if we're at the leftmost position (index 0), 
    // make sure the drop indicator is positioned correctly after the selection column
    if (bestTargetIndex === 0 && selectionColumn) {
      // Adjust for selection column
      bestDropX = leftmostDataPosition;
    }
  }
  // When dragging right, find the rightmost column whose midpoint we've passed
  else if (adjustedMouseX > draggedColumn.offset + draggedColumn.width) {
    // Dragging right logic
    
    bestTargetIndex = currentIndex + 1; // Default to right of current position
    bestDropX = draggedColumn.offset + draggedColumn.width;
    
    for (let i = currentIndex + 1; i < dataColumns.length; i++) {
      const col = dataColumns[i];
      const colMidpoint = col.offset + col.width / 2;
      
      // Check if mouse has passed this column's midpoint
      
      if (adjustedMouseX > colMidpoint) {
        // Mouse has passed this column's midpoint, update target to after this column
        bestTargetIndex = i + 1;
        bestDropX = col.offset + col.width;
        // Updated target to right
      } else {
        // Mouse hasn't reached this column's midpoint, stop here
        // Mouse not past midpoint, stop searching
        break;
      }
    }
    
    // Ensure we don't exceed the array bounds
    // The maximum target index should be dataColumns.length (to insert at the end)
    if (bestTargetIndex > dataColumns.length) {
      // Clamp target index to array bounds
      bestTargetIndex = dataColumns.length;
    }
  }
  
  targetIndex = bestTargetIndex;
  dropIndicatorX = bestDropX;
  
  // Final target position calculated
  
  // If we didn't find a target, we're in a gap - use nearest position
  if (!foundTarget) {
    // No specific target found, using nearest position
  }

  // No adjustment needed - targetIndex represents the insertion point
  // If we're dragging from left to right, we want to insert at the calculated position

  // Calculate which columns need to shift
  const columnsToShift: Array<{
    columnId: string;
    direction: 'left' | 'right';
    offset: number;
  }> = [];

  if (targetIndex !== currentIndex) {
    const draggedColumn = dataColumns[currentIndex];
    const draggedWidth = draggedColumn.width;

    if (targetIndex < currentIndex) {
      // Dragging left - columns between target and current shift right to make room
      for (let i = targetIndex; i < currentIndex; i++) {
        columnsToShift.push({
          columnId: dataColumns[i].columnId,
          direction: 'right',
          offset: draggedWidth
        });
      }
    } else {
      // Dragging right - columns between current and target shift left to make room
      // Note: When targetIndex > currentIndex, we shift columns from currentIndex+1 to targetIndex-1
      // because targetIndex represents where we want to insert (after removal)
      const endIndex = Math.min(targetIndex - 1, dataColumns.length - 1);
      for (let i = currentIndex + 1; i <= endIndex; i++) {
        columnsToShift.push({
          columnId: dataColumns[i].columnId,
          direction: 'left',
          offset: draggedWidth
        });
      }
    }
  }

  const result = {
    draggedColumnId,
    targetIndex,
    columnsToShift,
    dropIndicatorX: dropIndicatorX, // No scroll adjustment needed
    debugInfo: {
      currentIndex,
      targetColumn: targetIndex > 0 && targetIndex <= dataColumns.length ? (targetIndex < dataColumns.length ? dataColumns[targetIndex].columnId : 'end') : 'start',
      mousePosition: adjustedMouseX,
      columnBoundaries: dataColumns.map((col: any) => ({
        id: col.columnId,
        start: col.offset,
        end: col.offset + col.width
      }))
    }
  };

  // Return final drag preview result

  return result;
}

/**
 * Apply drag preview to DOM elements
 */
export function applyDragPreview(
  dragPreview: DragPreviewData,
  domManager: any
): void {
  const header = domManager.getElement('header');
  const viewport = domManager.getElement('viewport');
  const container = domManager.getElement('container');
  
  // Get current scroll position
  const currentScrollLeft = viewport?.scrollLeft || 0;
  
  // Apply drag preview to DOM
  
  // Hide the original column if this is the initial preview
  if ((dragPreview as any).isInitialPreview) {
    const draggingColumn = header.querySelector(`[data-column="${dragPreview.draggedColumnId}"]`) as HTMLElement;
    if (draggingColumn) {
      draggingColumn.style.opacity = '0';
      draggingColumn.style.visibility = 'hidden';
      draggingColumn.style.pointerEvents = 'none';
    }
  }
  
  // Create or update floating drag preview that follows mouse
  if (dragPreview.mouseX !== undefined && dragPreview.mouseY !== undefined) {
    let floatingPreview = document.querySelector('.vibegridx-drag-preview') as HTMLElement;
    
    // Only log on initial creation
    if (!floatingPreview) {
      log.info('🎯 ApplyDragPreview: Creating floating preview', {
        columnName: dragPreview.columnName,
        draggedColumnId: dragPreview.draggedColumnId
      });
    }
    
    if (!floatingPreview) {
      // Create floating preview element
      floatingPreview = document.createElement('div');
      floatingPreview.className = 'vibegridx-drag-preview';
      floatingPreview.textContent = dragPreview.columnName || dragPreview.draggedColumnId;
      
      // Set positioning styles
      floatingPreview.style.position = 'fixed';
      floatingPreview.style.left = '0';
      floatingPreview.style.top = '0';
      floatingPreview.style.willChange = 'transform';
      floatingPreview.style.pointerEvents = 'none';
      
      // Estimate dimensions instead of measuring to avoid reflow
      const text = dragPreview.columnName || dragPreview.draggedColumnId;
      const estimatedWidth = Math.max(60, text.length * 8 + 24); // 8px per char + padding
      const estimatedHeight = 36; // Standard height for drag preview
      
      // Store estimated offsets
      floatingPreview.dataset.offsetX = (estimatedWidth / 2).toString();
      floatingPreview.dataset.offsetY = (estimatedHeight / 2).toString();
      
      // Apply initial transform before adding to DOM
      const initialX = dragPreview.mouseX - (estimatedWidth / 2);
      const initialY = dragPreview.mouseY - (estimatedHeight / 2);
      floatingPreview.style.transform = `translate3d(${initialX}px, ${initialY}px, 0)`;
      
      document.body.appendChild(floatingPreview);
    }
    
    // Update text content if column name changed
    const newText = dragPreview.columnName || dragPreview.draggedColumnId;
    if (floatingPreview.textContent !== newText) {
      floatingPreview.textContent = newText;
      // Re-estimate offsets without measuring DOM
      const estimatedWidth = Math.max(60, newText.length * 8 + 24);
      const estimatedHeight = 36;
      floatingPreview.dataset.offsetX = (estimatedWidth / 2).toString();
      floatingPreview.dataset.offsetY = (estimatedHeight / 2).toString();
    }
    
    // Use cached offsets or fallback to defaults
    const centerOffsetX = parseFloat(floatingPreview.dataset.offsetX || '40');
    const centerOffsetY = parseFloat(floatingPreview.dataset.offsetY || '20');
    
    // Use transform for hardware-accelerated positioning
    const translateX = dragPreview.mouseX - centerOffsetX;
    const translateY = dragPreview.mouseY - centerOffsetY;
    
    // Use transform for positioning without overwriting other styles
    floatingPreview.style.left = '0';
    floatingPreview.style.top = '0';
    floatingPreview.style.transform = `translate3d(${translateX}px, ${translateY}px, 0)`;
    floatingPreview.style.willChange = 'transform';
    floatingPreview.style.display = 'block';
    
    // Remove excessive logging for performance
  } else {
    log.info('🎯 ApplyDragPreview: No mouse coordinates provided', {
      mouseX: dragPreview.mouseX,
      mouseY: dragPreview.mouseY
    });
  }
  
  // Only update columns if we have shifts to apply
  if (dragPreview.columnsToShift.length > 0) {
    // Use a more efficient selector and batch class operations
    const classesToRemove = ['vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-debug-boundary'];
    const headerCells = header.querySelectorAll('.vibegridx-header-cell');
    
    // Create a set of columns that need to shift for faster lookup
    const shiftingColumns = new Set(dragPreview.columnsToShift.map(s => s.columnId));
    
    // Batch all DOM writes together
    headerCells.forEach((cell: HTMLElement) => {
      const columnId = cell.dataset.column;
      if (columnId && !shiftingColumns.has(columnId)) {
        // Only reset styles for columns that aren't shifting
        cell.classList.remove(...classesToRemove);
        // Reset transform and transition in one go
        cell.style.cssText = cell.style.cssText.replace(/(?:--drag-offset|transform|transition|border|box-shadow):[^;]+;?/g, '');
      }
    });
  }
  
  // Ensure the header maintains its scroll position during drag
  if (header) {
    header.style.transform = `translateX(-${currentScrollLeft}px)`;
  }

  // Apply shifts to columns that need to move
  // Process column shifts
  
  // Apply shifts in a single pass
  if (dragPreview.columnsToShift.length > 0) {
    // Build a map of column shifts for efficiency
    const shiftMap = new Map(dragPreview.columnsToShift.map(s => [s.columnId, s]));
    
    // Apply all shifts in one DOM query
    header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
      const columnId = cell.dataset.column;
      if (columnId && shiftMap.has(columnId)) {
        const { direction, offset } = shiftMap.get(columnId)!;
        
        // Remove opposite direction class if present
        cell.classList.remove(`vibegridx-will-move-${direction === 'left' ? 'right' : 'left'}`);
        
        cell.classList.add(`vibegridx-will-move-${direction}`);
        cell.style.setProperty('--drag-offset', `${offset}px`);
        cell.style.transition = 'transform 0.2s ease-out';
        
        // Apply transform relative to the cell, not affecting parent scroll
        const xOffset = direction === 'right' ? offset : -offset;
        cell.style.transform = `translateX(${xOffset}px)`;
      }
    });
  }

  // Update drop indicator position
  let dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (!dropIndicator) {
    // Create drop indicator if missing
    // Create drop indicator if it doesn't exist
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'vibegridx-column-drop-indicator';
    header.appendChild(dropIndicator);
  }
  
  // The dropIndicatorX is in content coordinates, no need to adjust for scroll
  // because the indicator is inside the header which scrolls with content
  // Position drop indicator
  dropIndicator.style.left = `${dragPreview.dropIndicatorX}px`;
  dropIndicator.style.opacity = '1';
}

/**
 * Clear all drag preview effects
 */
export function clearDragPreview(domManager: any): void {
  const header = domManager.getElement('header');
  const viewport = domManager.getElement('viewport');
  
  // Get current scroll position to maintain it
  const currentScrollLeft = viewport?.scrollLeft || 0;
  
  // Clear all drag preview effects
  
  // Remove floating drag preview
  const floatingPreview = document.querySelector('.vibegridx-drag-preview');
  if (floatingPreview) {
    // Remove floating preview
    floatingPreview.remove();
  }
  
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
  });
  
  // Restore the header's scroll transform after clearing cell transforms
  if (header && currentScrollLeft > 0) {
    header.style.transform = `translateX(-${currentScrollLeft}px)`;
  }

  const dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (dropIndicator) {
    // Hide drop indicator
    dropIndicator.style.opacity = '0';
    dropIndicator.style.left = '0px';
  }
}