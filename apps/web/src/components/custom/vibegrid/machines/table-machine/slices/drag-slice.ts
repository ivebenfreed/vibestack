// ====================================
// DRAG SLICE - State Management for Drag & Drop Operations
// ====================================

import { assign } from 'xstate';
import type { DraggedItem, DropTarget } from '../../../types';

// ====================================
// STATE INTERFACE
// ====================================

export interface DragState {
  draggedItem: DraggedItem | null;
  dropTarget: DropTarget | null;
  isActive: boolean;
  constraints: Record<string, any>;
  startPosition: { x: number; y: number } | null;
  currentPosition: { x: number; y: number } | null;
  dragThreshold: number;
  dragPreview: {
    element: HTMLElement | null;
    offset: { x: number; y: number };
  } | null;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialDragState = (): DragState => ({
  draggedItem: null,
  dropTarget: null,
  isActive: false,
  constraints: {},
  startPosition: null,
  currentPosition: null,
  dragThreshold: 5, // pixels
  dragPreview: null
});

// ====================================
// ACTIONS
// ====================================

export const dragActions = {
  startDrag: assign({
    draggedItem: (_, event: any) => event.item,
    startPosition: (_, event: any) => ({ x: event.x, y: event.y }),
    currentPosition: (_, event: any) => ({ x: event.x, y: event.y }),
    isActive: () => true,
    constraints: (_, event: any) => event.constraints || {}
  }),

  updateDragPosition: assign({
    currentPosition: (_, event: any) => ({ x: event.x, y: event.y })
  }),

  setDropTarget: assign({
    dropTarget: (_, event: any) => event.target
  }),

  clearDropTarget: assign({
    dropTarget: () => null
  }),

  setDragPreview: assign({
    dragPreview: (_, event: any) => ({
      element: event.element,
      offset: event.offset || { x: 0, y: 0 }
    })
  }),

  updateDragConstraints: assign({
    constraints: ({ context, event }: any) => ({
      ...context.constraints,
      ...event.constraints
    })
  }),

  completeDrag: assign({
    draggedItem: () => null,
    dropTarget: () => null,
    isActive: () => false,
    startPosition: () => null,
    currentPosition: () => null,
    dragPreview: () => null
  }),

  cancelDrag: assign({
    draggedItem: () => null,
    dropTarget: () => null,
    isActive: () => false,
    startPosition: () => null,
    currentPosition: () => null,
    dragPreview: () => null
  }),

  setDragThreshold: assign({
    dragThreshold: (_, event: any) => event.threshold
  })
};