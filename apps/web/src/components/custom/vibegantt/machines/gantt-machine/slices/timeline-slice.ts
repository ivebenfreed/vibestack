import { assign } from 'xstate';
import type { GanttMachineContext, GanttEvent, TimeScale } from '../../../types';
import { TIME_SCALE_CONFIG, RENDER_CONFIG, ZOOM_UTILS } from '../../../constants';

export const timelineSlice = {
  initial: 'idle',
  states: {
    idle: {
      on: {
        // ZOOM_REQUEST is now handled by the main machine to avoid duplicate processing
        PAN: {
          target: 'panning',
        },
        // SCROLL is now handled by the main machine centrally
      },
    },
    panning: {
      entry: assign({
        dragState: ({ context }: { context: GanttMachineContext }) => ({
          type: 'pan' as const,
          startX: context.viewport.scrollX,
          startY: context.viewport.scrollY,
          currentX: context.viewport.scrollX,
          currentY: context.viewport.scrollY,
        }),
      }),
      on: {
        PAN: {
          actions: [
            assign({
              viewport: ({ context, event }: { context: GanttMachineContext; event: Extract<GanttEvent, { type: 'PAN' }> }) => {
                if (!context.dragState || context.dragState.type !== 'pan') return context.viewport;
                
                const newScrollX = context.dragState.startX - event.deltaX;
                const newScrollY = context.dragState.startY - event.deltaY;
                
                // Clamp scroll values
                const maxScrollX = Math.max(0, context.timelineLayout.totalWidth - context.viewport.width);
                const maxScrollY = Math.max(0, context.timelineLayout.totalHeight - context.viewport.height);
                
                return {
                  ...context.viewport,
                  scrollX: Math.max(0, Math.min(maxScrollX, newScrollX)),
                  scrollY: Math.max(0, Math.min(maxScrollY, newScrollY)),
                };
              },
            }),
            'updateVisibleRange',
            'queueViewportRender',
          ],
        },
        MOUSE_UP: {
          target: 'idle',
          actions: assign({
            dragState: null,
          }),
        },
      },
    },
  },
};