import { assign } from 'xstate';
import type { GanttMachineContext, GanttEvent } from '../../../types';
import { KEYBOARD_SHORTCUTS } from '../../../constants';

export const interactionSlice = {
  initial: 'idle',
  states: {
    idle: {
      on: {
        MOUSE_MOVE: {
          actions: [
            'updateHoverState',
            'showTooltipIfNeeded',
          ],
        },
        MOUSE_LEAVE: {
          actions: [
            assign({ hoverState: null, tooltip: null }),
          ],
        },
        CONTEXT_MENU: {
          actions: [
            assign({
              contextMenu: ({ event }: { event: any }) => ({
                x: event.x,
                y: event.y,
                taskId: event.taskId,
              }),
            }),
          ],
        },
        KEYBOARD_SHORTCUT: {
          actions: [
            'handleKeyboardShortcut',
          ],
        },
      },
    },
    
    creatingDependency: {
      entry: assign({
        dragState: ({ event }: { event: Extract<GanttEvent, { type: 'DEPENDENCY_CREATE_START' }> }) => ({
          type: 'create-dependency' as const,
          taskId: event.sourceTaskId,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0,
        }),
      }),
      on: {
        DEPENDENCY_CREATE_END: {
          target: 'idle',
          guard: 'isValidDependency',
          actions: [
            'createDependency',
            assign({ dragState: null }),
          ],
        },
        ESCAPE: {
          target: 'idle',
          actions: [
            assign({ dragState: null }),
          ],
        },
      },
    },
    
    multiSelecting: {
      entry: 'startMultiSelect',
      on: {
        SELECTION_UPDATE: {
          actions: [
            'updateSelectionBox',
            'updateSelectedTasks',
          ],
        },
        SELECTION_END: {
          target: 'idle',
          actions: [
            'finalizeSelection',
          ],
        },
      },
    },
  },
  on: {
    // Global interaction events
    DEPENDENCY_CREATE_START: {
      target: '.creatingDependency',
    },
    MULTI_SELECT_START: {
      target: '.multiSelecting',
    },
  },
};