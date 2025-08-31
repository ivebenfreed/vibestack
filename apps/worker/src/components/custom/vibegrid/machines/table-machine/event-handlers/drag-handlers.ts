// ====================================
// DRAG EVENT HANDLERS
// ====================================

import { sendTo, assign, emit } from 'xstate';
import { dragActions } from '../slices/drag-slice';
import { overlayActions } from '../slices/overlay-slice';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/machines/table-machine/event-handlers/drag-handlers.ts');

export const dragHandlers = {
  'drag.start': {
    actions: [
      dragActions.startDrag,
      
      // Update overlay visibility
      overlayActions.updateShapeVisibility,
      
      // Emit drag start event
      emit(({ event }) => ({
        type: 'vibegridx.drag.start',
        item: event.item,
        position: { x: event.x, y: event.y }
      })),
      
      ({ event }) => {
        log.info('TableMachine: Drag started', {
          item: event.item,
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },

  'drag.move': {
    actions: [
      dragActions.updateDragPosition,
      
      // TODO: Drag position visualization not implemented
      // overlayActor was supposed to handle this but was never spawned
      
      ({ event }) => {
        log.info('TableMachine: Drag position updated', {
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },

  'drag.over': {
    actions: [
      dragActions.setDropTarget,
      
      ({ event }) => {
        log.info('TableMachine: Drag over target', {
          target: event.target
        });
      }
    ]
  },

  'drag.leave': {
    actions: [
      dragActions.clearDropTarget,
      
      ({ event }) => {
        log.info('TableMachine: Drag left target', {
          target: event.target
        });
      }
    ]
  },

  'drag.complete': {
    actions: [
      // Emit drag complete event before clearing state
      emit(({ context }) => ({
        type: 'vibegridx.drag.complete',
        draggedItem: context.draggedItem,
        dropTarget: context.dropTarget
      })),
      
      dragActions.completeDrag,
      
      // Update overlay visibility
      overlayActions.updateShapeVisibility,
      
      ({ context }) => {
        log.info('TableMachine: Drag completed', {
          draggedItem: context.draggedItem,
          dropTarget: context.dropTarget
        });
      }
    ]
  },

  'drag.cancel': {
    actions: [
      dragActions.cancelDrag,
      
      // Update overlay visibility
      overlayActions.updateShapeVisibility,
      
      ({ context }) => {
        log.info('TableMachine: Drag cancelled', {
          draggedItem: context.draggedItem
        });
      }
    ]
  },

  'drag.preview.set': {
    actions: [
      dragActions.setDragPreview,
      
      ({ event }) => {
        log.info('TableMachine: Drag preview set', {
          element: event.element,
          offset: event.offset
        });
      }
    ]
  },

  'drag.constraints.update': {
    actions: [
      dragActions.updateDragConstraints,
      
      ({ event }) => {
        log.info('TableMachine: Drag constraints updated', {
          constraints: event.constraints
        });
      }
    ]
  },

  'drag.threshold.set': {
    actions: [
      dragActions.setDragThreshold,
      
      ({ event }) => {
        log.info('TableMachine: Drag threshold set', {
          threshold: event.threshold
        });
      }
    ]
  },

  // Row drag specific events
  'drag.row.start': {
    actions: [
      dragActions.startDrag,
      
      // Set row-specific constraints
      assign({
        constraints: ({ event }) => ({
          type: 'row',
          allowedTargets: ['row'],
          ...event.constraints
        })
      }),
      
      ({ event }) => {
        log.info('TableMachine: Row drag started', {
          rowId: event.rowId,
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },

  'drag.row.complete': {
    actions: [
      emit(({ context, event }) => ({
        type: 'vibegridx.row.reorder',
        fromIndex: context.draggedItem?.index,
        toIndex: event.toIndex,
        fromId: context.draggedItem?.id,
        toId: event.toId
      })),
      
      dragActions.completeDrag,
      
      ({ context, event }) => {
        log.info('TableMachine: Row drag completed', {
          fromIndex: context.draggedItem?.index,
          toIndex: event.toIndex
        });
      }
    ]
  },

  // Column drag specific events
  'drag.column.start': {
    actions: [
      dragActions.startDrag,
      
      // Set column-specific constraints
      assign({
        constraints: ({ event }) => ({
          type: 'column',
          allowedTargets: ['column'],
          ...event.constraints
        })
      }),
      
      ({ event }) => {
        log.info('TableMachine: Column drag started', {
          columnId: event.columnId,
          position: { x: event.x, y: event.y }
        });
      }
    ]
  },

  'drag.column.complete': {
    actions: [
      emit(({ context, event }) => ({
        type: 'vibegridx.column.reorder',
        fromIndex: context.draggedItem?.index,
        toIndex: event.toIndex,
        fromId: context.draggedItem?.id,
        toId: event.toId
      })),
      
      dragActions.completeDrag,
      
      // Update column order in view state
      ({ context, event }) => {
        const newOrder = [...context.columnOrder];
        const fromIndex = context.draggedItem?.index;
        const toIndex = event.toIndex;
        
        if (fromIndex !== undefined && toIndex !== undefined) {
          const [removed] = newOrder.splice(fromIndex, 1);
          newOrder.splice(toIndex, 0, removed);
          
          log.info('TableMachine: Column order updated', {
            fromIndex,
            toIndex,
            newOrder
          });
        }
      }
    ]
  }
};