// ====================================
// VIBEGRIDX RENDERER ACTOR
// ====================================
//
// XState callback actor that wraps the AtomicTableRenderer
// for proper actor model integration. Handles DOM rendering
// lifecycle and reports back actual rendered state.
//
// This eliminates direct method calls to the renderer and
// ensures all updates flow through XState events.
//
// ====================================

import { fromCallback } from 'xstate';
import type { AtomicTableRenderer } from '../renderers/AtomicTableRenderer';
import type { RenderState, RendererOptions, ViewportInfo } from '../types';

// ====================================
// EVENT TYPES
// ====================================

export type RendererActorEvent = 
  | { type: 'INITIALIZE'; options: RendererOptions }
  | { type: 'RENDER'; state: RenderState; coordinateMapping?: any }
  | { type: 'RENDER_ROWS'; state: RenderState }
  | { type: 'UPDATE_VIEWPORT'; viewport: ViewportInfo }
  | { type: 'UPDATE_COLUMNS'; columns: any[] }
  | { type: 'UPDATE_COLUMN_WIDTH'; columnId: string; width: number }
  | { type: 'DESTROY' };

export type RendererActorResponse =
  | { type: 'RENDERER_READY' }
  | { type: 'CANVAS_CONTAINER_READY'; container: HTMLElement }
  | { type: 'ROWS_RENDERED'; actualOrder?: string[]; viewport?: ViewportInfo | null; rowCount?: number }
  | { type: 'VIEWPORT_UPDATED'; viewport: ViewportInfo }
  | { type: 'COLUMNS_UPDATED' }
  | { type: 'COLUMN_WIDTH_UPDATED' }
  | { type: 'RENDERER_ERROR'; error: string };

// ====================================
// RENDERER ACTOR
// ====================================

export const rendererActor = fromCallback<RendererActorEvent, RendererActorResponse>(({ sendBack, receive }) => {
  let renderer: AtomicTableRenderer | null = null;
  let renderState: RenderState | null = null;
  let isInitializing = false;
  let isInitialized = false;
  let pendingRenderEvents: Array<{ type: string; state?: RenderState; coordinateMapping?: any }> = [];
  
  console.log('RendererActor: Created callback actor');
  
  receive((event) => {
    console.log('RendererActor: Received event:', event.type, event);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          console.log('RendererActor: Initializing with options:', event.options);
          
          // Prevent multiple initializations
          if (isInitializing) {
            console.warn('RendererActor: Already initializing, ignoring duplicate INITIALIZE event');
            return;
          }
          
          if (isInitialized) {
            console.warn('RendererActor: Already initialized, ignoring duplicate INITIALIZE event');
            return;
          }
          
          isInitializing = true;
          
          // Import AtomicTableRenderer dynamically to avoid circular imports
          import('../renderers/AtomicTableRenderer').then(({ AtomicTableRenderer }) => {
            // Merge stored options from window with event options
            const storedOptions = (window as any).__vibegridx_renderer_options || {};
            const mergedOptions = {
              ...storedOptions,
              ...event.options,
              onStateChange: (state: any) => {
                console.log('RendererActor: Received state change from AtomicTableRenderer:', state);
                
                // Handle canvas container ready event
                if (state.type === 'canvas.container.ready') {
                  console.log('RendererActor: Canvas container ready, emitting CANVAS_CONTAINER_READY');
                  sendBack({
                    type: 'CANVAS_CONTAINER_READY',
                    container: state.container
                  });
                }
                
                // Forward other state changes if there was an original handler
                if (storedOptions.onStateChange) {
                  storedOptions.onStateChange(state);
                }
              }
            };
            
            const container = mergedOptions.container;
            console.log('RendererActor: Creating renderer with merged options:', {
              hasStoredOptions: !!storedOptions,
              hasEventOptions: !!event.options,
              container,
              containerBounds: container ? container.getBoundingClientRect() : null,
              containerStyle: container ? {
                width: container.style.width,
                height: container.style.height,
                position: container.style.position
              } : null,
              containerComputedStyle: container ? {
                width: window.getComputedStyle(container).width,
                height: window.getComputedStyle(container).height,
                display: window.getComputedStyle(container).display,
                position: window.getComputedStyle(container).position
              } : null
            });
            
            renderer = new AtomicTableRenderer(mergedOptions);
            isInitializing = false;
            isInitialized = true;
            
            console.log('RendererActor: Renderer created successfully', {
              renderer,
              containerAfterInit: container ? {
                bounds: container.getBoundingClientRect(),
                clientDimensions: {
                  clientWidth: container.clientWidth,
                  clientHeight: container.clientHeight
                }
              } : null,
              pendingEventsCount: pendingRenderEvents.length
            });
            
            sendBack({ type: 'RENDERER_READY' });
            
            // Process any queued render events
            if (pendingRenderEvents.length > 0) {
              console.log(`RendererActor: Processing ${pendingRenderEvents.length} queued render events`);
              
              for (const queuedEvent of pendingRenderEvents) {
                if (queuedEvent.type === 'RENDER' && queuedEvent.state) {
                  console.log('RendererActor: Processing queued RENDER event');
                  renderer.render(queuedEvent.state);
                  sendBack({
                    type: 'ROWS_RENDERED',
                    rowCount: queuedEvent.state.rows?.length || 0
                  });
                } else if (queuedEvent.type === 'RENDER_ROWS' && queuedEvent.state) {
                  console.log('RendererActor: Processing queued RENDER_ROWS event');
                  renderer.render(queuedEvent.state);
                  const actualOrder = renderer.getRenderedRowIds?.() || [];
                  const currentViewport = renderer.getCurrentViewport?.() || null;
                  sendBack({
                    type: 'ROWS_RENDERED',
                    actualOrder,
                    viewport: currentViewport
                  });
                }
              }
              
              // Clear the queue
              pendingRenderEvents = [];
            }
          }).catch((error) => {
            console.error('RendererActor: Failed to create renderer:', error);
            isInitializing = false; // Reset flag on error
            sendBack({ 
              type: 'RENDERER_ERROR', 
              error: `Failed to initialize renderer: ${error.message}` 
            });
          });
          break;
          
        case 'RENDER_ROWS':
          if (!renderer) {
            if (isInitializing) {
              // Queue the event for processing after initialization
              console.log('RendererActor: Queueing RENDER_ROWS event during initialization');
              pendingRenderEvents.push({
                type: 'RENDER_ROWS',
                state: event.state
              });
              return;
            } else {
              console.warn('RendererActor: Cannot render - renderer not initialized');
              sendBack({ 
                type: 'RENDERER_ERROR', 
                error: 'Renderer not initialized' 
              });
              return;
            }
          }
          
          console.log('RendererActor: Rendering rows:', {
            rowCount: event.state.rows?.length || 0,
            hasColumns: !!event.state.columns,
            hasViewport: !!event.state.viewport
          });
          
          // Perform the actual rendering
          renderer.render(event.state);
          
          // Report back what was actually rendered
          const actualOrder = renderer.getRenderedRowIds?.() || [];
          const currentViewport = renderer.getCurrentViewport?.() || null;
          
          console.log('RendererActor: Render completed, reporting back:', {
            actualOrderLength: actualOrder.length,
            hasViewport: !!currentViewport
          });
          
          sendBack({ 
            type: 'ROWS_RENDERED',
            actualOrder,
            viewport: currentViewport
          });
          break;
          
        case 'UPDATE_VIEWPORT':
          if (!renderer) {
            console.warn('RendererActor: Cannot update viewport - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Updating viewport:', event.viewport);
          
          // Update renderer viewport
          if (renderer.updateViewport) {
            renderer.updateViewport(event.viewport);
          }
          
          sendBack({ 
            type: 'VIEWPORT_UPDATED',
            viewport: event.viewport
          });
          break;
          
        case 'UPDATE_COLUMNS':
          if (!renderer) {
            console.warn('RendererActor: Cannot update columns - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Updating columns:', event.columns.length);
          
          // Update renderer columns if method exists
          if (renderer.updateColumns) {
            renderer.updateColumns(event.columns);
          }
          
          sendBack({ type: 'COLUMNS_UPDATED' });
          break;
          
        case 'UPDATE_COLUMN_WIDTH':
          if (!renderer) {
            console.warn('RendererActor: Cannot update column width - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Updating column width:', event.columnId, event.width);
          
          // Update column width in renderer
          if (renderer.updateColumnWidth) {
            renderer.updateColumnWidth(event.columnId, event.width);
          } else {
            console.warn('RendererActor: Renderer does not support updateColumnWidth');
          }
          
          sendBack({ type: 'COLUMN_WIDTH_UPDATED' });
          break;
          
        case 'RENDER':
          console.log('RendererActor: RENDER event received', {
            hasRenderer: !!renderer,
            isInitialized,
            isInitializing,
            hasState: !!event.state,
            stateKeys: event.state ? Object.keys(event.state) : [],
            queueLength: pendingRenderEvents.length
          });
          
          if (!renderer) {
            if (isInitializing) {
              // Queue the event for processing after initialization
              console.log('RendererActor: Queueing RENDER event during initialization');
              pendingRenderEvents.push({
                type: 'RENDER',
                state: event.state,
                coordinateMapping: (event as any).coordinateMapping
              });
              return;
            } else {
              console.warn('RendererActor: Cannot render - renderer not initialized', {
                isInitializing,
                isInitialized
              });
              return;
            }
          }
          
          if (!event.state) {
            console.warn('RendererActor: Cannot render - no state provided');
            return;
          }
          
          console.log('RendererActor: Rendering with state:', {
            rows: event.state.rows?.length,
            columns: event.state.columns?.length,
            version: event.state.version
          });
          
          // Store the render state
          renderState = event.state;
          
          try {
            // Render with the new state
            console.log('RendererActor: About to call renderer.render()');
            renderer.render(event.state);
            console.log('RendererActor: renderer.render() completed successfully');
          } catch (renderError) {
            console.error('RendererActor: Error in renderer.render():', renderError);
            throw renderError;
          }
          
          sendBack({ 
            type: 'ROWS_RENDERED',
            rowCount: event.state.rows?.length || 0
          });
          break;
          
        case 'DESTROY':
          console.log('RendererActor: Destroying renderer');
          
          if (renderer) {
            renderer.destroy?.();
            renderer = null;
          }
          break;
          
        default:
          console.warn('RendererActor: Unknown event type:', event);
      }
    } catch (error) {
      console.error('RendererActor: Error processing event:', error);
      sendBack({ 
        type: 'RENDERER_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    console.log('RendererActor: Cleanup - destroying renderer');
    
    if (renderer) {
      renderer.destroy?.();
      renderer = null;
    }
  };
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Type guard to check if an event is a renderer actor event
 */
export function isRendererActorEvent(event: any): event is RendererActorEvent {
  return event && typeof event.type === 'string' && 
    ['INITIALIZE', 'RENDER_ROWS', 'UPDATE_VIEWPORT', 'UPDATE_COLUMNS', 'DESTROY'].includes(event.type);
}

/**
 * Type guard to check if a response is a renderer actor response
 */
export function isRendererActorResponse(response: any): response is RendererActorResponse {
  return response && typeof response.type === 'string' && 
    ['RENDERER_READY', 'CANVAS_CONTAINER_READY', 'ROWS_RENDERED', 'VIEWPORT_UPDATED', 'COLUMNS_UPDATED', 'RENDERER_ERROR'].includes(response.type);
}