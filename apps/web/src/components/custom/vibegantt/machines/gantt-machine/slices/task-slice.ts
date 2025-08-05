import { assign } from 'xstate';
import type { GanttMachineContext, GanttEvent, GanttTask } from '../../../types';

export const taskSlice = {
  initial: 'idle',
  states: {
    idle: {
      on: {
        TASK_SELECT: {
          actions: [
            assign({
              selection: ({ context, event }: { 
                context: GanttMachineContext; 
                event: Extract<GanttEvent, { type: 'TASK_SELECT' }> 
              }) => {
                const newSelection = new Set(context.selection.selectedTaskIds);
                
                if (event.multi) {
                  // Toggle selection in multi-select mode
                  if (newSelection.has(event.taskId)) {
                    newSelection.delete(event.taskId);
                  } else {
                    newSelection.add(event.taskId);
                  }
                } else {
                  // Single selection mode
                  newSelection.clear();
                  newSelection.add(event.taskId);
                }
                
                return {
                  ...context.selection,
                  selectedTaskIds: newSelection,
                  focusedTaskId: event.taskId,
                };
              },
            }),
            'queueSelectionRender',
          ],
        },
        TASK_DRAG_START: {
          target: 'dragging',
          guard: 'canMoveTask',
        },
        TASK_RESIZE_START: {
          target: 'resizing',
          guard: 'canMoveTask',
        },
      },
    },
    
    dragging: {
      entry: assign({
        dragState: ({ event }: { event: Extract<GanttEvent, { type: 'TASK_DRAG_START' }> }) => ({
          type: 'move' as const,
          taskId: event.taskId,
          startX: event.x,
          startY: event.y,
          currentX: event.x,
          currentY: event.y,
          originalData: null, // Will be set with original task data
        }),
      }),
      on: {
        TASK_DRAG_MOVE: {
          actions: [
            assign({
              dragState: ({ context, event }: {
                context: GanttMachineContext;
                event: Extract<GanttEvent, { type: 'TASK_DRAG_MOVE' }>;
              }) => {
                if (!context.dragState || context.dragState.type !== 'move') return context.dragState;
                
                return {
                  ...context.dragState,
                  currentX: event.x,
                  currentY: event.y,
                };
              },
            }),
            'updateDragPreview',
          ],
        },
        TASK_DRAG_END: {
          target: 'idle',
          actions: [
            'applyTaskMove',
            assign({ dragState: null }),
            'notifyTaskUpdate',
          ],
        },
        ESCAPE: {
          target: 'idle',
          actions: [
            assign({ dragState: null }),
            'cancelDrag',
          ],
        },
      },
    },
    
    resizing: {
      entry: assign({
        dragState: ({ event }: { event: Extract<GanttEvent, { type: 'TASK_RESIZE_START' }> }) => ({
          type: event.handle === 'start' ? 'resize-start' : 'resize-end' as const,
          taskId: event.taskId,
          startX: event.x,
          startY: 0,
          currentX: event.x,
          currentY: 0,
          originalData: null, // Will be set with original task data
        }),
      }),
      on: {
        TASK_RESIZE_MOVE: {
          actions: [
            assign({
              dragState: ({ context, event }: {
                context: GanttMachineContext;
                event: Extract<GanttEvent, { type: 'TASK_RESIZE_MOVE' }>;
              }) => {
                if (!context.dragState || 
                    (context.dragState.type !== 'resize-start' && context.dragState.type !== 'resize-end')) {
                  return context.dragState;
                }
                
                return {
                  ...context.dragState,
                  currentX: event.x,
                };
              },
            }),
            'updateResizePreview',
          ],
        },
        TASK_RESIZE_END: {
          target: 'idle',
          actions: [
            'applyTaskResize',
            assign({ dragState: null }),
            'notifyTaskUpdate',
          ],
        },
        ESCAPE: {
          target: 'idle',
          actions: [
            assign({ dragState: null }),
            'cancelResize',
          ],
        },
      },
    },
  },
};