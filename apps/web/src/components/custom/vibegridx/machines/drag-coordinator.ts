import { setup, assign, fromPromise } from 'xstate';
import type { 
  DragContext, 
  DraggedItem, 
  DropTarget, 
  TableRow, 
  Column,
  TableEvents 
} from '../types';

// ====================================
// HELPER FUNCTIONS
// ====================================

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
    
    case 'group':
      return dropTarget.type === 'group' || dropTarget.type === 'row';
    
    default:
      return false;
  }
};

const createDragImage = (
  draggedItem: DraggedItem,
  element: HTMLElement
): HTMLElement => {
  const dragImage = element.cloneNode(true) as HTMLElement;
  dragImage.style.position = 'absolute';
  dragImage.style.top = '-9999px';
  dragImage.style.left = '-9999px';
  dragImage.style.width = `${element.offsetWidth}px`;
  dragImage.style.height = `${element.offsetHeight}px`;
  dragImage.style.opacity = '0.8';
  dragImage.style.transform = 'rotate(2deg)';
  dragImage.style.boxShadow = '0 8px 16px rgba(0,0,0,0.3)';
  dragImage.style.borderRadius = '4px';
  dragImage.style.backgroundColor = 'var(--color-primary)';
  dragImage.style.color = 'white';
  dragImage.style.zIndex = '9999';
  
  document.body.appendChild(dragImage);
  return dragImage;
};

// ====================================
// ASYNC ACTORS
// ====================================

const executeDragOperation = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    dropTarget: DropTarget; 
    onMove: (sourceId: string, targetId: string, position: string) => Promise<void>;
  }
}) => {
  const { draggedItem, dropTarget, onMove } = input;
  
  // Simulate drag operation delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Execute the actual move operation
  await onMove(draggedItem.id, dropTarget.id, dropTarget.position);
  
  return {
    sourceId: draggedItem.id,
    targetId: dropTarget.id,
    position: dropTarget.position,
    type: draggedItem.type,
    timestamp: Date.now()
  };
});

const calculateDragPreview = fromPromise(async ({ input }: {
  input: { 
    draggedItem: DraggedItem; 
    mousePosition: { x: number; y: number };
    getAllRows: () => TableRow[];
    getColumns: () => Column[];
  }
}) => {
  const { draggedItem, mousePosition, getAllRows, getColumns } = input;
  
  let previewData: any = {};
  
  switch (draggedItem.type) {
    case 'row':
      const rows = getAllRows();
      const draggedRow = rows.find(r => r.id === draggedItem.id);
      if (draggedRow) {
        previewData = {
          type: 'row',
          title: `Moving row: ${draggedRow.id}`,
          subtitle: `${Object.keys(draggedRow.data).length} fields`,
          data: draggedRow.data
        };
      }
      break;
      
    case 'column':
      const columns = getColumns();
      const draggedColumn = columns.find(c => c.id === draggedItem.id);
      if (draggedColumn) {
        previewData = {
          type: 'column',
          title: `Moving column: ${draggedColumn.name}`,
          subtitle: draggedColumn.type,
          data: draggedColumn
        };
      }
      break;
      
    case 'group':
      previewData = {
        type: 'group',
        title: `Moving group: ${draggedItem.id}`,
        subtitle: 'Group with nested items',
        data: draggedItem.data
      };
      break;
  }
  
  return {
    previewData,
    mousePosition,
    timestamp: Date.now()
  };
});

// ====================================
// DRAG COORDINATOR MACHINE
// ====================================

interface DragCoordinatorContext extends DragContext {
  // Mouse tracking
  mousePosition: { x: number; y: number };
  startPosition: { x: number; y: number };
  
  // Drag state
  dragStartTime: number;
  dragDistance: number;
  dragThreshold: number;
  
  // Visual feedback
  dragImage: HTMLElement | null;
  dropIndicator: HTMLElement | null;
  
  // Performance
  lastUpdateTime: number;
  updateThrottleMs: number;
  
  // Callbacks
  onDragStart?: (item: DraggedItem) => void;
  onDragMove?: (item: DraggedItem, target: DropTarget | null) => void;
  onDragEnd?: (item: DraggedItem, target: DropTarget | null, success: boolean) => void;
}

type DragEvents = 
  | { type: 'drag.row.start' }
  | { type: 'drag.row.over' }
  | { type: 'drag.row.drop' }
  | { type: 'drag.cancel' }
  // Internal events
  | { type: 'DRAG_START'; item: DraggedItem; element: HTMLElement; startPos: { x: number; y: number } }
  | { type: 'DRAG_MOVE'; mousePos: { x: number; y: number } }
  | { type: 'DRAG_OVER'; target: DropTarget }
  | { type: 'DRAG_LEAVE' }
  | { type: 'DRAG_END'; mousePos: { x: number; y: number } }
  | { type: 'DRAG_OPERATION_COMPLETE'; result: any }
  | { type: 'DRAG_OPERATION_FAILED'; error: string }
  | { type: 'PREVIEW_UPDATED'; preview: any }
  | { type: 'CONSTRAINTS_UPDATED'; constraints: Record<string, any> };

export const dragCoordinatorMachine = setup({
  types: {
    context: {} as DragCoordinatorContext,
    events: {} as DragEvents,
    input: {} as { constraints?: Record<string, any> }
  },
  
  actors: {
    executeDragOperation,
    calculateDragPreview
  },
  
  actions: {
    // Drag initialization
    initializeDrag: assign({
      draggedItem: ({ event }) => 
        event.type === 'DRAG_START' ? event.item : null,
      startPosition: ({ event }) => 
        event.type === 'DRAG_START' ? event.startPos : { x: 0, y: 0 },
      mousePosition: ({ event }) => 
        event.type === 'DRAG_START' ? event.startPos : { x: 0, y: 0 },
      dragStartTime: () => Date.now(),
      dragDistance: 0,
      isActive: true,
      dragImage: ({ event }) => {
        if (event.type === 'DRAG_START') {
          return createDragImage(event.item, event.element);
        }
        return null;
      }
    }),
    
    // Mouse movement tracking
    updateMousePosition: assign({
      mousePosition: ({ event }) => 
        event.type === 'DRAG_MOVE' ? event.mousePos : { x: 0, y: 0 },
      dragDistance: ({ context, event }) => {
        if (event.type !== 'DRAG_MOVE') return context.dragDistance;
        
        const dx = event.mousePos.x - context.startPosition.x;
        const dy = event.mousePos.y - context.startPosition.y;
        return Math.sqrt(dx * dx + dy * dy);
      },
      lastUpdateTime: () => Date.now()
    }),
    
    // Drop target management
    setDropTarget: assign({
      dropTarget: ({ context, event }) => {
        if (event.type !== 'DRAG_OVER') return context.dropTarget;
        
        const isValid = isValidDrop(
          context.draggedItem!,
          event.target,
          context.constraints
        );
        
        return {
          ...event.target,
          valid: isValid
        };
      }
    }),
    
    clearDropTarget: assign({
      dropTarget: null
    }),
    
    // Drag completion
    completeDrag: assign({
      isActive: false,
      draggedItem: null,
      dropTarget: null,
      dragImage: ({ context }) => {
        if (context.dragImage) {
          document.body.removeChild(context.dragImage);
        }
        return null;
      },
      dragDistance: 0
    }),
    
    // Callbacks
    notifyDragStart: ({ context }) => {
      if (context.onDragStart && context.draggedItem) {
        context.onDragStart(context.draggedItem);
      }
    },
    
    notifyDragMove: ({ context }) => {
      if (context.onDragMove && context.draggedItem) {
        context.onDragMove(context.draggedItem, context.dropTarget);
      }
    },
    
    notifyDragEnd: ({ context, event }) => {
      if (context.onDragEnd && context.draggedItem) {
        const success = event.type === 'DRAG_OPERATION_COMPLETE';
        context.onDragEnd(context.draggedItem, context.dropTarget, success);
      }
    },
    
    // Visual feedback
    updateDragImage: ({ context }) => {
      if (context.dragImage) {
        context.dragImage.style.left = `${context.mousePosition.x + 10}px`;
        context.dragImage.style.top = `${context.mousePosition.y + 10}px`;
      }
    },
    
    // Constraints
    updateConstraints: assign({
      constraints: ({ event }) => 
        event.type === 'CONSTRAINTS_UPDATED' ? event.constraints : {}
    })
  },
  
  guards: {
    isDragging: ({ context }) => context.isActive && context.draggedItem !== null,
    hasValidDropTarget: ({ context }) => 
      context.dropTarget !== null && context.dropTarget.valid,
    exceedsThreshold: ({ context }) => 
      context.dragDistance > context.dragThreshold,
    shouldThrottle: ({ context }) => 
      Date.now() - context.lastUpdateTime < context.updateThrottleMs,
    canExecuteDrop: ({ context }) => 
      context.draggedItem !== null && 
      context.dropTarget !== null && 
      context.dropTarget.valid
  }
  
}).createMachine({
  id: 'dragCoordinator',
  
  initial: 'idle',
  
  context: ({ input }) => ({
    draggedItem: null,
    dropTarget: null,
    isActive: false,
    constraints: input?.constraints || {},
    
    mousePosition: { x: 0, y: 0 },
    startPosition: { x: 0, y: 0 },
    dragStartTime: 0,
    dragDistance: 0,
    dragThreshold: 5,
    
    dragImage: null,
    dropIndicator: null,
    
    lastUpdateTime: 0,
    updateThrottleMs: 16, // 60fps
    
    onDragStart: undefined,
    onDragMove: undefined,
    onDragEnd: undefined
  }),
  
  states: {
    idle: {
      on: {
        DRAG_START: {
          target: 'dragging',
          actions: ['initializeDrag', 'notifyDragStart']
        },
        
        CONSTRAINTS_UPDATED: {
          actions: 'updateConstraints'
        }
      }
    },
    
    dragging: {
      on: {
        DRAG_MOVE: [
          {
            guard: 'shouldThrottle',
            // Skip update if throttling
          },
          {
            actions: ['updateMousePosition', 'updateDragImage', 'notifyDragMove']
          }
        ],
        
        DRAG_OVER: {
          actions: 'setDropTarget'
        },
        
        DRAG_LEAVE: {
          actions: 'clearDropTarget'
        },
        
        DRAG_END: [
          {
            guard: 'canExecuteDrop',
            target: 'executing'
          },
          {
            target: 'idle',
            actions: ['completeDrag', 'notifyDragEnd']
          }
        ],
        
        'drag.cancel': {
          target: 'idle',
          actions: ['completeDrag', 'notifyDragEnd']
        }
      },
      
      // Auto-cancel if drag takes too long
      after: {
        30000: {
          target: 'idle',
          actions: ['completeDrag', 'notifyDragEnd']
        }
      }
    },
    
    executing: {
      invoke: {
        src: 'executeDragOperation',
        input: ({ context }) => ({
          draggedItem: context.draggedItem!,
          dropTarget: context.dropTarget!,
          onMove: async (sourceId: string, targetId: string, position: string) => {
            // This would be provided by the table implementation
            console.log(`Moving ${sourceId} to ${targetId} (${position})`);
          }
        }),
        onDone: {
          target: 'idle',
          actions: [
            ({ event }) => {
              console.log('Drag operation completed:', event.output);
            },
            'completeDrag',
            'notifyDragEnd'
          ]
        },
        onError: {
          target: 'idle',
          actions: [
            ({ event }) => {
              console.error('Drag operation failed:', event.error);
            },
            'completeDrag',
            'notifyDragEnd'
          ]
        }
      }
    }
  }
});