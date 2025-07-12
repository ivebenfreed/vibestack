// ====================================
// DRAG ACTOR - Pure Actor for Drag & Drop Operations
// ====================================

import { fromPromise } from 'xstate';
import type { DraggedItem, DropTarget } from '../types';

// ====================================
// VALIDATION HELPERS
// ====================================

const isValidDrop = (
  draggedItem: DraggedItem,
  dropTarget: DropTarget,
  constraints: Record<string, any>
): boolean => {
  // Basic validation
  if (!draggedItem || !dropTarget) return false;
  
  // Can't drop on self
  if (draggedItem.id === dropTarget.id) return false;
  
  // Type-specific validation
  switch (draggedItem.type) {
    case 'row':
      return dropTarget.type === 'row' && 
             (dropTarget.position === 'above' || dropTarget.position === 'below');
    
    case 'column':
      return dropTarget.type === 'column' &&
             (dropTarget.position === 'left' || dropTarget.position === 'right');
    
    case 'cell':
      return dropTarget.type === 'cell' || dropTarget.type === 'selection';
    
    default:
      return false;
  }
};

const calculateDropZone = (
  mouseY: number,
  targetElement: HTMLElement,
  itemHeight: number
): 'above' | 'below' | null => {
  const rect = targetElement.getBoundingClientRect();
  const relativeY = mouseY - rect.top;
  const threshold = itemHeight * 0.3; // 30% threshold
  
  if (relativeY < threshold) {
    return 'above';
  } else if (relativeY > itemHeight - threshold) {
    return 'below';
  }
  
  return null;
};

const calculateInsertIndex = (
  draggedItem: DraggedItem,
  dropTarget: DropTarget,
  items: any[]
): number => {
  const dragIndex = items.findIndex(item => item.id === draggedItem.id);
  const dropIndex = items.findIndex(item => item.id === dropTarget.id);
  
  if (dragIndex === -1 || dropIndex === -1) return -1;
  
  // Calculate new index based on drop position
  let newIndex = dropIndex;
  
  if (dropTarget.position === 'below' || dropTarget.position === 'right') {
    newIndex = dropIndex + 1;
  }
  
  // Adjust for items moving up vs down
  if (dragIndex < dropIndex) {
    newIndex = newIndex - 1;
  }
  
  return Math.max(0, Math.min(items.length - 1, newIndex));
};

// ====================================
// ASYNC OPERATIONS
// ====================================

const performDragValidation = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    dropTarget: DropTarget; 
    constraints: Record<string, any> 
  }
}) => {
  const { draggedItem, dropTarget, constraints } = input;
  
  console.log('DragActor: Validating drop', {
    draggedItem,
    dropTarget,
    constraints
  });
  
  // Simulate async validation
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const isValid = isValidDrop(draggedItem, dropTarget, constraints);
  
  if (!isValid) {
    throw new Error('Invalid drop target');
  }
  
  return {
    isValid: true,
    draggedItem,
    dropTarget
  };
});

const performRowReorder = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    dropTarget: DropTarget; 
    rows: any[] 
  }
}) => {
  const { draggedItem, dropTarget, rows } = input;
  
  console.log('DragActor: Performing row reorder', {
    draggedRowId: draggedItem.id,
    dropTargetId: dropTarget.id,
    position: dropTarget.position
  });
  
  // Calculate new index
  const newIndex = calculateInsertIndex(draggedItem, dropTarget, rows);
  const oldIndex = rows.findIndex(row => row.id === draggedItem.id);
  
  if (newIndex === -1 || oldIndex === -1) {
    throw new Error('Invalid row indices for reorder');
  }
  
  // Simulate async reorder operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Create new order
  const newRows = [...rows];
  const [movedRow] = newRows.splice(oldIndex, 1);
  newRows.splice(newIndex, 0, movedRow);
  
  return {
    success: true,
    oldIndex,
    newIndex,
    reorderedRows: newRows,
    movedRowId: draggedItem.id
  };
});

const performColumnReorder = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    dropTarget: DropTarget; 
    columns: any[] 
  }
}) => {
  const { draggedItem, dropTarget, columns } = input;
  
  console.log('DragActor: Performing column reorder', {
    draggedColumnId: draggedItem.id,
    dropTargetId: dropTarget.id,
    position: dropTarget.position
  });
  
  // Calculate new index
  const newIndex = calculateInsertIndex(draggedItem, dropTarget, columns);
  const oldIndex = columns.findIndex(col => col.id === draggedItem.id);
  
  if (newIndex === -1 || oldIndex === -1) {
    throw new Error('Invalid column indices for reorder');
  }
  
  // Simulate async reorder operation
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Create new order
  const newColumns = [...columns];
  const [movedColumn] = newColumns.splice(oldIndex, 1);
  newColumns.splice(newIndex, 0, movedColumn);
  
  return {
    success: true,
    oldIndex,
    newIndex,
    reorderedColumns: newColumns,
    movedColumnId: draggedItem.id
  };
});

const performCellDrag = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    dropTarget: DropTarget; 
    operation: 'move' | 'copy' | 'fill' 
  }
}) => {
  const { draggedItem, dropTarget, operation } = input;
  
  console.log('DragActor: Performing cell drag', {
    draggedCellId: draggedItem.id,
    dropTargetId: dropTarget.id,
    operation
  });
  
  // Simulate async cell operation
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return {
    success: true,
    operation,
    sourceCells: [draggedItem.id],
    targetCells: [dropTarget.id],
    timestamp: Date.now()
  };
});

// ====================================
// PURE DRAG ACTOR
// ====================================

export const dragActor = fromPromise(async ({ input }: {
  input: { 
    type: string;
    [key: string]: any;
  }
}) => {
  const { type } = input;
  
  console.log('DragActor: Processing operation', { type, input });
  
  switch (type) {
    case 'VALIDATE_DROP':
      return await performDragValidation({ input });
      
    case 'REORDER_ROWS':
      return await performRowReorder({ input });
      
    case 'REORDER_COLUMNS':
      return await performColumnReorder({ input });
      
    case 'CELL_DRAG':
      return await performCellDrag({ input });
      
    case 'CALCULATE_DROP_ZONE':
      const dropZone = calculateDropZone(
        input.mouseY,
        input.targetElement,
        input.itemHeight
      );
      return { success: true, dropZone };
      
    case 'CALCULATE_INSERT_INDEX':
      const insertIndex = calculateInsertIndex(
        input.draggedItem,
        input.dropTarget,
        input.items
      );
      return { success: true, insertIndex };
      
    default:
      console.warn('DragActor: Unknown operation type', { type });
      return { success: false, error: `Unknown operation: ${type}` };
  }
});