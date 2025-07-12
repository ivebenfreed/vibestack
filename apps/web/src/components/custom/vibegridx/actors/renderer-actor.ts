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
  | { type: 'RENDER_ROWS'; state: RenderState }
  | { type: 'UPDATE_VIEWPORT'; viewport: ViewportInfo }
  | { type: 'UPDATE_COLUMNS'; columns: any[] }
  | { type: 'DESTROY' };

export type RendererActorResponse =
  | { type: 'RENDERER_READY' }
  | { type: 'ROWS_RENDERED'; actualOrder: string[]; viewport: ViewportInfo | null }
  | { type: 'VIEWPORT_UPDATED'; viewport: ViewportInfo }
  | { type: 'COLUMNS_UPDATED' }
  | { type: 'RENDERER_ERROR'; error: string };

// ====================================
// RENDERER ACTOR
// ====================================

export const rendererActor = fromCallback<RendererActorEvent, RendererActorResponse>(({ sendBack, receive }) => {
  let renderer: AtomicTableRenderer | null = null;
  
  console.log('RendererActor: Created callback actor');
  
  receive((event) => {
    console.log('RendererActor: Received event:', event.type, event);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          console.log('RendererActor: Initializing with options:', event.options);
          
          // Import AtomicTableRenderer dynamically to avoid circular imports
          import('../renderers/AtomicTableRenderer').then(({ AtomicTableRenderer }) => {
            renderer = new AtomicTableRenderer(event.options);
            console.log('RendererActor: Renderer created successfully');
            
            sendBack({ type: 'RENDERER_READY' });
          }).catch((error) => {
            console.error('RendererActor: Failed to create renderer:', error);
            sendBack({ 
              type: 'RENDERER_ERROR', 
              error: `Failed to initialize renderer: ${error.message}` 
            });
          });
          break;
          
        case 'RENDER_ROWS':
          if (!renderer) {
            console.warn('RendererActor: Cannot render - renderer not initialized');
            sendBack({ 
              type: 'RENDERER_ERROR', 
              error: 'Renderer not initialized' 
            });
            return;
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
          if (!renderer) {
            console.warn('RendererActor: Cannot render - renderer not initialized');
            return;
          }
          
          if (!event.state) {
            console.warn('RendererActor: Cannot render - no state provided');
            return;
          }
          
          console.log('RendererActor: Rendering with state:', {
            rows: event.state.rows?.length,
            columns: event.state.columns?.length
          });
          
          // Store the render state
          renderState = event.state;
          
          // Render with the new state
          renderer.render(event.state);
          
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
    ['RENDERER_READY', 'ROWS_RENDERED', 'VIEWPORT_UPDATED', 'COLUMNS_UPDATED', 'RENDERER_ERROR'].includes(response.type);
}