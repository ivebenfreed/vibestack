import { assign } from 'xstate';
import type { GanttMachineContext, GanttEvent } from '../../../types';
import { RENDER_CONFIG } from '../../../constants';

export const viewportSlice = {
  initial: 'active',
  states: {
    active: {
      on: {
        VIEWPORT_RESIZE: {
          actions: [
            assign({
              viewport: ({ context, event }: {
                context: GanttMachineContext;
                event: Extract<GanttEvent, { type: 'VIEWPORT_RESIZE' }>;
              }) => ({
                ...context.viewport,
                width: event.width,
                height: event.height,
              }),
            }),
            'recalculateVisibleRange',
            'updateVisibleTasks',
            'queueFullRender',
          ],
        },
        // SCROLL is now handled by the main machine centrally
      },
    },
  },
};