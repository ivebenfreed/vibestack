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
  coordinateMapping: any
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

  // Mouse coordinates are now container-relative, no adjustment needed
  const adjustedMouseX = mouseX;

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
  
  console.log('🎯 DragPreview: Calculating target position', {
    draggedColumn: draggedColumnId,
    mouseX: adjustedMouseX,
    currentIndex,
    draggedBounds: { start: draggedColumn.offset, end: draggedColumn.offset + draggedColumn.width }
  });
  
  // Mouse is outside the dragged column - now use midpoint logic
  // Check columns from left to right to find where the mouse is
  let foundTarget = false;
  
  // Find the best target position by checking all columns
  let bestTargetIndex = currentIndex;
  let bestDropX = 0;
  
  // When dragging left, find the leftmost column whose midpoint we haven't passed
  if (adjustedMouseX < draggedColumn.offset) {
    console.log('🎯 DragPreview: Dragging left logic', {
      mouseX: adjustedMouseX,
      draggedOffset: draggedColumn.offset,
      currentIndex
    });
    
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
      
      console.log('🎯 DragPreview: Checking left column', {
        columnId: col.columnId,
        index: i,
        colOffset: col.offset,
        colMidpoint,
        mouseX: adjustedMouseX,
        isLeftOfMidpoint: adjustedMouseX < colMidpoint
      });
      
      if (adjustedMouseX < colMidpoint) {
        // Mouse is left of this column's midpoint, so we want to insert before it
        bestTargetIndex = i;
        bestDropX = col.offset;
        console.log('🎯 DragPreview: Updated target to left', {
          bestTargetIndex,
          bestDropX,
          columnId: col.columnId
        });
      } else {
        // Mouse has passed this column's midpoint, stop searching
        console.log('🎯 DragPreview: Mouse past midpoint, stopping search');
        break;
      }
    }
    
    // Special case: if we're at the leftmost position (index 0), 
    // make sure the drop indicator is positioned correctly after the selection column
    if (bestTargetIndex === 0 && selectionColumn) {
      console.log('🎯 DragPreview: Adjusting for selection column', {
        oldDropX: bestDropX,
        newDropX: leftmostDataPosition,
        selectionWidth: selectionColumn.width
      });
      bestDropX = leftmostDataPosition;
    }
  }
  // When dragging right, find the rightmost column whose midpoint we've passed
  else if (adjustedMouseX > draggedColumn.offset + draggedColumn.width) {
    console.log('🎯 DragPreview: Dragging right logic', {
      mouseX: adjustedMouseX,
      draggedEnd: draggedColumn.offset + draggedColumn.width,
      currentIndex,
      totalColumns: dataColumns.length
    });
    
    bestTargetIndex = currentIndex + 1; // Default to right of current position
    bestDropX = draggedColumn.offset + draggedColumn.width;
    
    for (let i = currentIndex + 1; i < dataColumns.length; i++) {
      const col = dataColumns[i];
      const colMidpoint = col.offset + col.width / 2;
      
      console.log('🎯 DragPreview: Checking right column', {
        columnId: col.columnId,
        index: i,
        colOffset: col.offset,
        colMidpoint,
        colEnd: col.offset + col.width,
        mouseX: adjustedMouseX,
        hasPassedMidpoint: adjustedMouseX > colMidpoint
      });
      
      if (adjustedMouseX > colMidpoint) {
        // Mouse has passed this column's midpoint, update target to after this column
        bestTargetIndex = i + 1;
        bestDropX = col.offset + col.width;
        console.log('🎯 DragPreview: Updated target to right', {
          bestTargetIndex,
          bestDropX,
          isLastColumn: i === dataColumns.length - 1,
          maxPossibleIndex: dataColumns.length
        });
      } else {
        // Mouse hasn't reached this column's midpoint, stop here
        console.log('🎯 DragPreview: Mouse not past midpoint, stopping search');
        break;
      }
    }
    
    // Ensure we don't exceed the array bounds
    // The maximum target index should be dataColumns.length (to insert at the end)
    if (bestTargetIndex > dataColumns.length) {
      console.log('🎯 DragPreview: Clamping target index to array bounds', {
        originalTarget: bestTargetIndex,
        clampedTarget: dataColumns.length
      });
      bestTargetIndex = dataColumns.length;
    }
  }
  
  targetIndex = bestTargetIndex;
  dropIndicatorX = bestDropX;
  
  console.log('🎯 DragPreview: Final target position', {
    currentIndex,
    targetIndex,
    dropIndicatorX,
    mouseX: adjustedMouseX,
    draggedBounds: { start: draggedColumn.offset, end: draggedColumn.offset + draggedColumn.width }
  });
  
  // If we didn't find a target, we're in a gap - use nearest position
  if (!foundTarget) {
    console.log('🎯 DragPreview: No specific target found, using nearest', {
      mouseX: adjustedMouseX
    });
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

  console.log('🎯 DragPreview: Final result', {
    currentIndex,
    targetIndex: result.targetIndex,
    dropIndicatorX: result.dropIndicatorX,
    columnsToShift: result.columnsToShift.length,
    shiftDetails: result.columnsToShift.map(s => ({ 
      columnId: s.columnId, 
      direction: s.direction, 
      offset: s.offset 
    }))
  });

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
  
  console.log('🎯 ApplyDragPreview: Applying preview', {
    draggedColumn: dragPreview.draggedColumnId,
    targetIndex: dragPreview.targetIndex,
    dropIndicatorX: dragPreview.dropIndicatorX,
    columnsToShift: dragPreview.columnsToShift,
    debugInfo: dragPreview.debugInfo
  });
  
  // Clear all preview classes and styles
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right', 'vibegridx-debug-boundary');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
    cell.style.removeProperty('border');
    cell.style.removeProperty('box-shadow');
  });
  

  // Apply shifts to columns that need to move
  console.log('🎯 ApplyDragPreview: Processing column shifts', {
    shiftCount: dragPreview.columnsToShift.length,
    shifts: dragPreview.columnsToShift
  });
  
  dragPreview.columnsToShift.forEach(({ columnId, direction, offset }) => {
    const cell = header.querySelector(`[data-column="${columnId}"]`) as HTMLElement;
    if (cell) {
      console.log('🎯 ApplyDragPreview: Shifting column', {
        columnId,
        direction,
        offset,
        cellFound: true,
        currentTransform: cell.style.transform,
        currentClasses: cell.className
      });
      
      // Remove opposite direction class if present
      cell.classList.remove(`vibegridx-will-move-${direction === 'left' ? 'right' : 'left'}`);
      
      cell.classList.add(`vibegridx-will-move-${direction}`);
      cell.style.setProperty('--drag-offset', `${offset}px`);
      cell.style.transition = 'transform 0.2s ease-out';
      cell.style.transform = `translateX(${direction === 'right' ? offset : -offset}px)`;
    } else {
      console.warn('🎯 ApplyDragPreview: Column cell not found', columnId);
    }
  });

  // Update drop indicator position
  let dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (!dropIndicator) {
    console.warn('🎯 ApplyDragPreview: Drop indicator not found, creating one');
    // Create drop indicator if it doesn't exist
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'vibegridx-column-drop-indicator';
    header.appendChild(dropIndicator);
  }
  
  console.log('🎯 ApplyDragPreview: Setting drop indicator', {
    left: dragPreview.dropIndicatorX,
    dropIndicator: dropIndicator
  });
  dropIndicator.style.left = `${dragPreview.dropIndicatorX}px`;
  dropIndicator.style.opacity = '1';
}

/**
 * Clear all drag preview effects
 */
export function clearDragPreview(domManager: any): void {
  const header = domManager.getElement('header');
  
  console.log('🎯 ClearDragPreview: Clearing all drag preview effects');
  
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
  });

  const dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (dropIndicator) {
    console.log('🎯 ClearDragPreview: Hiding drop indicator');
    dropIndicator.style.opacity = '0';
    dropIndicator.style.left = '0px';
  }
}