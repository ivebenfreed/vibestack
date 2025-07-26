// ====================================
// VIBEGRIDX RENDERER ACTOR
// ====================================
//
// XState callback actor that wraps the TableRenderer
// for proper actor model integration. Handles DOM rendering
// lifecycle and reports back actual rendered state.
//
// This eliminates direct method calls to the renderer and
// ensures all updates flow through XState events.
//
// ====================================

import { fromCallback } from 'xstate';
import type { TableRenderer } from '../renderers/core/TableRenderer';
import type { RenderState, RendererOptions, ViewportInfo, Column } from '../types';

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
  | { type: 'UPDATE_COORDINATES'; mapping: any; version: number }
  | { type: 'UPDATE_SELECTED_ROWS'; selectedRows: Set<string> }
  | { type: 'REMOVE_ROW'; rowId: string }
  | { type: 'SURGICAL_UPDATE'; changes: any[]; relationshipResolvers?: Record<string, (id: string | string[]) => string> }
  | { type: 'CALCULATE_COORDINATES'; rows: any[]; columns: Column[]; columnWidths?: Record<string, number> }
  | { type: 'DESTROY' };

export type RendererActorResponse =
  | { type: 'RENDERER_READY' }
  | { type: 'CANVAS_CONTAINER_READY'; container: HTMLElement }
  | { type: 'ROWS_RENDERED'; actualOrder?: string[]; viewport?: ViewportInfo | null; rowCount?: number }
  | { type: 'VIEWPORT_UPDATED'; viewport: ViewportInfo }
  | { type: 'COLUMNS_UPDATED' }
  | { type: 'COLUMN_WIDTH_UPDATED' }
  | { type: 'COORDINATES_UPDATED' }
  | { type: 'COORDINATES_CALCULATED'; mapping: any; version: number }
  | { type: 'SELECTED_ROWS_UPDATED' }
  | { type: 'RENDERER_ERROR'; error: string };

// ====================================
// COORDINATE CALCULATION
// ====================================

interface CoordinateMapping {
  rows: Array<{
    rowId: string;
    originalIndex: number;
    sortedIndex: number;
  }>;
  columns: Array<{
    columnId: string;
    index: number;
    offset: number;
    width: number;
  }>;
  version: number;
  sortBy: any[];
}

function calculateCoordinateMapping(
  rows: any[],
  columns: Column[],
  columnWidths?: Record<string, number>
): CoordinateMapping {
  const startTime = performance.now();
  
  // Calculate row mapping
  const rowMapping = rows.map((row, index) => ({
    rowId: row.id,
    originalIndex: index,
    sortedIndex: index
  }));
  
  // Calculate column mapping with offsets
  let currentOffset = 0;
  const columnMapping = columns.map((column, index) => {
    const width = columnWidths?.[column.id] || column.width || 120;
    const mapping = {
      columnId: column.id,
      index,
      offset: currentOffset,
      width
    };
    currentOffset += width;
    return mapping;
  });
  
  const calculationTime = performance.now() - startTime;
  console.log('RendererActor: Coordinate calculation completed in', calculationTime.toFixed(2) + 'ms');
  
  return {
    rows: rowMapping,
    columns: columnMapping,
    version: Date.now(),
    sortBy: []
  };
}

// ====================================
// RENDERER ACTOR
// ====================================

export const rendererActor = fromCallback<RendererActorEvent, RendererActorResponse>(({ sendBack, receive }) => {
  let renderer: TableRenderer | null = null;
  let renderState: RenderState | null = null;
  let isInitializing = false;
  let isInitialized = false;
  let lastRenderedVersion = -1; // Track last rendered version to prevent duplicates
  let pendingRenderEvents: Array<{ type: string; state?: RenderState; coordinateMapping?: any }> = [];
  
  console.log('RendererActor: Created callback actor');
  
  receive(async (event) => {
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
          
          // Import TableRenderer dynamically to avoid circular imports
          import('../renderers/core/TableRenderer').then(({ TableRenderer }) => {
            // Merge stored options from window with event options
            const storedOptions = (window as any).__vibegridx_renderer_options || {};
            const mergedOptions = {
              ...storedOptions,
              ...event.options,
              onStateChange: (state: any) => {
                // Reduce logging for performance
                if (state.type !== 'render.complete' || Math.random() < 0.05) {
                  console.log('RendererActor: Received state change from TableRenderer:', state);
                }
                
                // Handle canvas container ready event
                if (state.type === 'canvas.container.ready') {
                  console.log('RendererActor: Canvas container ready, emitting CANVAS_CONTAINER_READY');
                  sendBack({
                    type: 'CANVAS_CONTAINER_READY',
                    container: state.container
                  });
                }
                
                // Handle render complete event
                if (state.type === 'render.complete') {
                  // Only log occasionally for performance
                  if (Math.random() < 0.05) {
                    console.log('RendererActor: Render complete, emitting RENDER_COMPLETE');
                  }
                  sendBack({
                    type: 'RENDER_COMPLETE',
                    renderTime: state.renderTime,
                    rowCount: state.rowCount,
                    visibleRange: state.visibleRange
                  });
                  
                  // PERFORMANCE: Initialize canvas post-render to avoid blocking critical path
                  if (renderer && typeof renderer.initializeCanvasPostRender === 'function') {
                    if (Math.random() < 0.05) {
                      console.log('RendererActor: Triggering canvas initialization post-render');
                    }
                    renderer.initializeCanvasPostRender();
                  }
                }
                
                // Forward other state changes if there was an original handler
                if (storedOptions.onStateChange) {
                  storedOptions.onStateChange(state);
                }
              },
              
              // Column drag callbacks
              onColumnDragStart: (columnId: string, x: number, y: number) => {
                sendBack({
                  type: 'view.column.drag.start',
                  columnId,
                  x,
                  y
                });
              },
              
              onColumnDragMove: (x: number, y: number) => {
                sendBack({
                  type: 'view.column.drag.move',
                  x,
                  y
                });
              },
              
              onColumnDragEnd: (clientX: number) => {
                sendBack({
                  type: 'view.column.drag.end',
                  clientX
                });
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
            
            renderer = new TableRenderer(mergedOptions);
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
          
        // UPDATE_COLUMN_WIDTH removed - column widths now updated via UPDATE_COORDINATES
          
        case 'UPDATE_COORDINATES':
          if (!renderer) {
            console.warn('RendererActor: Cannot update coordinates - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Updating coordinates from state machine:', {
            version: event.version,
            columnCount: event.mapping.columns.length
          });
          
          // Update coordinate mapping in renderer - this is the authoritative source
          if (renderer.updateCoordinateMapping) {
            renderer.updateCoordinateMapping(event.mapping, event.version);
          } else {
            console.warn('RendererActor: Renderer does not support updateCoordinateMapping');
          }
          
          sendBack({ type: 'COORDINATES_UPDATED' });
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
          
          // Note: Removed version checking - we want to render whenever data changes
          
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
            
            // Version tracking removed - we render on data changes
          } catch (renderError) {
            console.error('RendererActor: Error in renderer.render():', renderError);
            throw renderError;
          }
          
          sendBack({ 
            type: 'ROWS_RENDERED',
            rowCount: event.state.rows?.length || 0
          });
          break;
          
          
        case 'UPDATE_SELECTED_ROWS':
          if (!renderer) {
            console.warn('RendererActor: Cannot update selected rows - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Updating selected rows:', {
            selectedRowsSize: event.selectedRows.size,
            selectedRowIds: Array.from(event.selectedRows)
          });
          
          // Update selected rows in renderer to sync checkbox states and row styles
          if (renderer.setSelectedRows) {
            renderer.setSelectedRows(event.selectedRows);
          } else {
            console.warn('RendererActor: setSelectedRows method not available on renderer');
          }
          
          sendBack({ type: 'SELECTED_ROWS_UPDATED' });
          break;
          
        case 'REMOVE_ROW':
          if (!renderer) {
            console.warn('RendererActor: Cannot remove row - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Removing row:', {
            rowId: event.rowId
          });
          
          // Remove the row from DOM
          if (renderer.removeRow) {
            renderer.removeRow(event.rowId);
          } else {
            // Fallback: Find and remove the row element directly
            const rowElement = renderer.getRowElement?.(event.rowId);
            if (rowElement) {
              rowElement.remove();
            }
          }
          
          sendBack({ 
            type: 'ROWS_RENDERED',
            rowCount: (renderState?.rows?.length || 0) - 1
          });
          break;
          
        case 'SURGICAL_UPDATE':
          if (!renderer) {
            console.warn('RendererActor: Cannot perform surgical update - renderer not initialized');
            return;
          }
          
          console.log('RendererActor: Performing surgical update:', {
            changesCount: event.changes.length,
            changeTypes: event.changes.map(c => `${c.operation}:${c.id}`)
          });
          
          // Apply each change surgically
          for (const change of event.changes) {
            if (change.operation === 'update') {
              // Update the entire row with new data
              if (renderer.updateRow) {
                renderer.updateRow(change.id, change.data, event.relationshipResolvers);
              }
            }
          }
          
          console.log('RendererActor: Surgical update completed');
          break;
          
        case 'APPLY_DRAG_PREVIEW':
          if (!renderer) {
            console.warn('RendererActor: Cannot apply drag preview - renderer not initialized');
            return;
          }
          
          // Import and use the drag preview helper
          const { applyDragPreview } = await import('../machines/table-machine/helpers/drag-preview-helpers');
          
          // Get DOM manager from renderer
          const domManager = (renderer as any).domManager;
          if (domManager && event.dragPreview) {
            applyDragPreview(event.dragPreview, domManager);
          }
          break;
          
        case 'CLEAR_DRAG_PREVIEW':
          if (!renderer) {
            console.warn('RendererActor: Cannot clear drag preview - renderer not initialized');
            return;
          }
          
          // Import and use the drag preview helper
          const { clearDragPreview } = await import('../machines/table-machine/helpers/drag-preview-helpers');
          
          // Get DOM manager from renderer
          const domManagerClear = (renderer as any).domManager;
          if (domManagerClear) {
            clearDragPreview(domManagerClear);
          }
          break;
          
        case 'CALCULATE_COORDINATES':
          console.log('RendererActor: Calculating coordinates', {
            rowCount: event.rows.length,
            columnCount: event.columns.length,
            hasColumnWidths: !!event.columnWidths
          });
          
          try {
            const coordinateMapping = calculateCoordinateMapping(
              event.rows,
              event.columns,
              event.columnWidths
            );
            
            sendBack({
              type: 'COORDINATES_CALCULATED',
              mapping: coordinateMapping,
              version: coordinateMapping.version
            });
          } catch (error) {
            console.error('RendererActor: Error calculating coordinates:', error);
            sendBack({
              type: 'RENDERER_ERROR',
              error: `Failed to calculate coordinates: ${error.message}`
            });
          }
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
    ['INITIALIZE', 'RENDER_ROWS', 'UPDATE_VIEWPORT', 'UPDATE_COLUMNS', 'UPDATE_SELECTED_ROWS', 'DESTROY'].includes(event.type);
}

/**
 * Type guard to check if a response is a renderer actor response
 */
export function isRendererActorResponse(response: any): response is RendererActorResponse {
  return response && typeof response.type === 'string' && 
    ['RENDERER_READY', 'CANVAS_CONTAINER_READY', 'ROWS_RENDERED', 'VIEWPORT_UPDATED', 'COLUMNS_UPDATED', 'SELECTED_ROWS_UPDATED', 'RENDERER_ERROR'].includes(response.type);
}