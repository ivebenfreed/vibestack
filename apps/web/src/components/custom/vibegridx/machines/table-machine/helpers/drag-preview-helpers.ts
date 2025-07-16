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
  let foundTarget = false;
  
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
    console.log('🎯 ApplyDragPreview: Hiding original column for initial preview', {
      columnId: dragPreview.draggedColumnId
    });
    
    const draggingColumn = header.querySelector(`[data-column="${dragPreview.draggedColumnId}"]`) as HTMLElement;
    if (draggingColumn) {
      console.log('🎯 ApplyDragPreview: Found column to hide', {
        column: draggingColumn,
        dataset: draggingColumn.dataset,
        before: {
          opacity: draggingColumn.style.opacity,
          visibility: draggingColumn.style.visibility
        }
      });
      
      draggingColumn.style.opacity = '0';
      draggingColumn.style.visibility = 'hidden';
      draggingColumn.style.pointerEvents = 'none';
      
      console.log('🎯 ApplyDragPreview: Column hidden', {
        after: {
          opacity: draggingColumn.style.opacity,
          visibility: draggingColumn.style.visibility,
          pointerEvents: draggingColumn.style.pointerEvents
        }
      });
    } else {
      console.warn('🎯 ApplyDragPreview: Could not find column to hide', {
        columnId: dragPreview.draggedColumnId,
        selector: `[data-column="${dragPreview.draggedColumnId}"]`,
        headerChildren: Array.from(header.children).map(el => ({
          tag: el.tagName,
          class: el.className,
          dataset: (el as HTMLElement).dataset
        }))
      });
    }
  }
  
  // Create or update floating drag preview that follows mouse
  if (dragPreview.mouseX !== undefined && dragPreview.mouseY !== undefined) {
    console.log('🎯 ApplyDragPreview: Creating/updating floating preview', {
      mouseX: dragPreview.mouseX,
      mouseY: dragPreview.mouseY,
      columnName: dragPreview.columnName,
      draggedColumnId: dragPreview.draggedColumnId
    });
    
    let floatingPreview = document.querySelector('.vibegridx-drag-preview') as HTMLElement;
    
    if (!floatingPreview) {
      // Create floating preview element
      console.log('🎯 ApplyDragPreview: Creating new floating preview element');
      floatingPreview = document.createElement('div');
      floatingPreview.className = 'vibegridx-drag-preview';
      floatingPreview.textContent = dragPreview.columnName || dragPreview.draggedColumnId;
      document.body.appendChild(floatingPreview);
      console.log('🎯 ApplyDragPreview: Created element', {
        element: floatingPreview,
        parent: floatingPreview.parentElement,
        text: floatingPreview.textContent
      });
    }
    
    // Update text content if column name changed
    const newText = dragPreview.columnName || dragPreview.draggedColumnId;
    if (floatingPreview.textContent !== newText) {
      floatingPreview.textContent = newText;
    }
    
    // Position the preview at mouse coordinates
    // The coordinates should now be client coordinates (from event.clientX/Y)
    // Center the preview horizontally and vertically under the cursor
    const previewRect = floatingPreview.getBoundingClientRect();
    const centerOffsetX = previewRect.width / 2;
    const centerOffsetY = previewRect.height / 2;
    
    console.log('🎯 ApplyDragPreview: Preview dimensions', {
      width: previewRect.width,
      height: previewRect.height,
      centerOffsetX,
      centerOffsetY
    });
    
    // Position directly centered under cursor like it's being grabbed
    const finalLeft = dragPreview.mouseX - centerOffsetX;
    const finalTop = dragPreview.mouseY - centerOffsetY;
    
    floatingPreview.style.left = `${finalLeft}px`;
    floatingPreview.style.top = `${finalTop}px`;
    floatingPreview.style.display = 'block';
    
    console.log('🎯 ApplyDragPreview: Final position', {
      mouseX: dragPreview.mouseX,
      mouseY: dragPreview.mouseY,
      finalLeft,
      finalTop,
      centerOffsetX,
      centerOffsetY,
      styleLeft: floatingPreview.style.left,
      styleTop: floatingPreview.style.top,
      computedStyle: {
        position: window.getComputedStyle(floatingPreview).position,
        display: window.getComputedStyle(floatingPreview).display,
        visibility: window.getComputedStyle(floatingPreview).visibility
      }
    });
  } else {
    console.log('🎯 ApplyDragPreview: No mouse coordinates provided', {
      mouseX: dragPreview.mouseX,
      mouseY: dragPreview.mouseY
    });
  }
  
  // Clear all preview classes and styles
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-debug-boundary');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
    cell.style.removeProperty('border');
    cell.style.removeProperty('box-shadow');
  });
  
  // Ensure the header maintains its scroll position during drag
  if (header) {
    header.style.transform = `translateX(-${currentScrollLeft}px)`;
  }

  // Apply shifts to columns that need to move
  // Process column shifts
  
  dragPreview.columnsToShift.forEach(({ columnId, direction, offset }) => {
    const cell = header.querySelector(`[data-column="${columnId}"]`) as HTMLElement;
    if (cell) {
      // Apply shift to column
      
      // Remove opposite direction class if present
      cell.classList.remove(`vibegridx-will-move-${direction === 'left' ? 'right' : 'left'}`);
      
      cell.classList.add(`vibegridx-will-move-${direction}`);
      cell.style.setProperty('--drag-offset', `${offset}px`);
      cell.style.transition = 'transform 0.2s ease-out';
      
      // Apply transform relative to the cell, not affecting parent scroll
      const xOffset = direction === 'right' ? offset : -offset;
      cell.style.transform = `translateX(${xOffset}px)`;
    } else {
      console.warn('ApplyDragPreview: Column cell not found', columnId);
    }
  });

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