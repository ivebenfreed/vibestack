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
}

/**
 * Calculate drag preview data based on current mouse position
 */
export function calculateDragPreview(
  mouseX: number,
  draggedColumnId: string,
  coordinateMapping: any,
  viewportScrollLeft: number = 0
): DragPreviewData {
  if (!coordinateMapping?.columns) {
    return {
      draggedColumnId,
      targetIndex: -1,
      columnsToShift: [],
      dropIndicatorX: 0
    };
  }

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

  // Adjust mouse position for viewport scroll
  const adjustedMouseX = mouseX + viewportScrollLeft;

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

  // Find target position
  let targetIndex = 0;
  let dropIndicatorX = dataColumns[0].offset; // Start position

  for (let i = 0; i < dataColumns.length; i++) {
    const col = dataColumns[i];
    const colStart = col.offset;
    const colEnd = col.offset + col.width;
    const colMidpoint = colStart + col.width / 2;

    if (adjustedMouseX < colMidpoint) {
      targetIndex = i;
      dropIndicatorX = colStart;
      break;
    }

    // If we're past the last column
    if (i === dataColumns.length - 1) {
      targetIndex = dataColumns.length;
      dropIndicatorX = colEnd;
    }
  }

  // Adjust target index if dragging from left to right
  if (currentIndex < targetIndex) {
    targetIndex--;
  }

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
      // Dragging left - columns between target and current shift right
      for (let i = targetIndex; i < currentIndex; i++) {
        columnsToShift.push({
          columnId: dataColumns[i].columnId,
          direction: 'right',
          offset: draggedWidth
        });
      }
    } else {
      // Dragging right - columns between current and target shift left
      for (let i = currentIndex + 1; i <= targetIndex; i++) {
        columnsToShift.push({
          columnId: dataColumns[i].columnId,
          direction: 'left',
          offset: draggedWidth
        });
      }
    }
  }

  return {
    draggedColumnId,
    targetIndex,
    columnsToShift,
    dropIndicatorX: dropIndicatorX - viewportScrollLeft // Adjust for scroll
  };
}

/**
 * Apply drag preview to DOM elements
 */
export function applyDragPreview(
  dragPreview: DragPreviewData,
  domManager: any
): void {
  const header = domManager.getElement('header');
  
  // Clear all preview classes and styles
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
  });

  // Apply shifts to columns that need to move
  dragPreview.columnsToShift.forEach(({ columnId, direction, offset }) => {
    const cell = header.querySelector(`[data-column="${columnId}"]`) as HTMLElement;
    if (cell) {
      cell.classList.add(`vibegridx-will-move-${direction}`);
      cell.style.setProperty('--drag-offset', `${offset}px`);
      cell.style.transition = 'transform 0.2s ease-out';
      cell.style.transform = `translateX(${direction === 'right' ? offset : -offset}px)`;
    }
  });

  // Update drop indicator position
  const dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (dropIndicator) {
    dropIndicator.style.left = `${dragPreview.dropIndicatorX}px`;
    dropIndicator.style.opacity = '1';
  }
}

/**
 * Clear all drag preview effects
 */
export function clearDragPreview(domManager: any): void {
  const header = domManager.getElement('header');
  
  header.querySelectorAll('.vibegridx-header-cell').forEach((cell: HTMLElement) => {
    cell.classList.remove('vibegridx-will-move-left', 'vibegridx-will-move-right');
    cell.style.removeProperty('--drag-offset');
    cell.style.removeProperty('transform');
    cell.style.removeProperty('transition');
  });

  const dropIndicator = header.querySelector('.vibegridx-column-drop-indicator') as HTMLElement;
  if (dropIndicator) {
    dropIndicator.style.opacity = '0';
  }
}