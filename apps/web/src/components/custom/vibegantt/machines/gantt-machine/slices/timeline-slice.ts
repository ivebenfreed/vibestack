import { assign } from 'xstate';
import type { GanttMachineContext, GanttEvent, TimeScale } from '../../../types';
import { TIME_SCALE_CONFIG, RENDER_CONFIG, ZOOM_UTILS } from '../../../constants';

export const timelineSlice = {
  initial: 'idle',
  states: {
    idle: {
      on: {
        // Handle zoom requests from event delegation
        ZOOM_REQUEST: {
          guard: ({ context }) => !context.isZooming, // Prevent concurrent zooms
          actions: [
            // Mark zoom as in progress
            assign({ isZooming: true }),
            // Forward zoom direction and mouse position to store
            ({ context, event }) => {
              if (context.dataStore) {
                // Forward the zoom request with mouse position to store
                context.dataStore.send({
                  type: 'ZOOM_REQUEST',
                  direction: event.direction,
                  mouseX: event.mouseX,
                  currentScrollX: event.currentScrollX
                });
              }
            },
            // Reset zoom state after a delay to allow DOM updates
            ({ context, self }) => {
              setTimeout(() => {
                self.send({ type: 'ZOOM_COMPLETE' });
              }, 100);
            }
          ],
        },
        ZOOM_COMPLETE: {
          actions: assign({ isZooming: false })
        },
        PAN: {
          target: 'panning',
        },
        SCROLL: {
          actions: [
            // Forward scroll event to store
            ({ context, event }) => {
              if (context.dataStore) {
                context.dataStore.send({
                  type: 'UPDATE_SCROLL',
                  x: event.scrollX,
                  y: event.scrollY
                });
              }
            }
          ],
        },
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