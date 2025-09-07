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
import type { EnhancedTableRenderer } from '../renderers/core/EnhancedTableRenderer';
import type { RenderState, RendererOptions, ViewportInfo, Column } from '../types';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

// File-level log control
const LOG_LEVEL: LogLevel | undefined = undefined;  // Use global (quiet)
const log = createLogger('RendererActor', LOG_LEVEL);

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
  | { type: 'CALCULATE_COORDINATES'; rows: any[]; columns: Column[]; columnWidths?: Record<string, number>; deferredEvent?: any }
  | { type: 'DESTROY' };

export type RendererActorResponse =
  | { type: 'RENDERER_READY' }
  | { type: 'CANVAS_CONTAINER_READY'; container: HTMLElement }
  | { type: 'ROWS_RENDERED'; actualOrder?: string[]; viewport?: ViewportInfo | null; rowCount?: number }
  | { type: 'VIEWPORT_UPDATED'; viewport: ViewportInfo }
  | { type: 'COLUMNS_UPDATED' }
  | { type: 'COLUMN_WIDTH_UPDATED' }
  | { type: 'COORDINATES_UPDATED' }
  | { type: 'COORDINATES_CALCULATED'; mapping: any; version: number; deferredEvent?: any }
  | { type: 'SELECTED_ROWS_UPDATED' }
  | { type: 'GROUP_TOGGLE'; groupId: string }
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
  log.info('RendererActor: Coordinate calculation completed in', calculationTime.toFixed(2) + 'ms');
  
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
  let renderer: EnhancedTableRenderer | null = null;
  let renderState: RenderState | null = null;
  let isInitializing = false;
  let isInitialized = false;
  const lastRenderedVersion = -1; // Track last rendered version to prevent duplicates
  let pendingRenderEvents: Array<{ type: string; state?: RenderState; coordinateMapping?: any }> = [];
  
  log.info('RendererActor: Created callback actor');
  
  receive(async (event) => {
    log.info('RendererActor: Received event:', event.type, event);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          log.info('RendererActor: Initializing with options:', event.options);
          
          // Prevent multiple initializations
          if (isInitializing) {
            log.warn('RendererActor: Already initializing, ignoring duplicate INITIALIZE event');
            return;
          }
          
          if (isInitialized) {
            log.warn('RendererActor: Already initialized, ignoring duplicate INITIALIZE event');
            return;
          }
          
          isInitializing = true;
          
          // Import EnhancedTableRenderer dynamically to avoid circular imports
          import('../renderers/core/EnhancedTableRenderer').then(({ EnhancedTableRenderer }) => {
            // Merge stored options from window with event options
            const storedOptions = (window as any).__vibegridx_renderer_options || {};
            const mergedOptions = {
              ...storedOptions,
              ...event.options,
              onStateChange: (state: any) => {
                // Reduce logging for performance
                if (state.type !== 'render.complete' || Math.random() < 0.05) {
                  log.info('RendererActor: Received state change from TableRenderer:', state);
                }
                
                // Handle canvas container ready event
                if (state.type === 'canvas.container.ready') {
                  log.info('RendererActor: Canvas container ready, emitting CANVAS_CONTAINER_READY');
                  sendBack({
                    type: 'CANVAS_CONTAINER_READY',
                    container: state.container
                  });
                }
                
                // Handle render complete event
                if (state.type === 'render.complete') {
                  // Only log occasionally for performance
                  if (Math.random() < 0.05) {
                    log.info('RendererActor: Render complete, emitting RENDER_COMPLETE');
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
                      log.info('RendererActor: Triggering canvas initialization post-render');
                    }
                    renderer.initializeCanvasPostRender();
                  }
                }
                
                // Handle group toggle event
                if (state.type === 'group.toggle') {
                  log.info('RendererActor: Group toggle requested', { groupId: state.groupId });
                  sendBack({
                    type: 'GROUP_TOGGLE',
                    groupId: state.groupId
                  });
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
            
            // Prioritize container from event options (direct pass) over window global to avoid race conditions
            // Direct container passing is more reliable during navigation than global window references
            const container = event.options.container || mergedOptions.container || (window as any).__vibegrid_renderer_container;
            
            // Validate container before proceeding - check both existence and DOM connection
            if (!container || !container.isConnected) {
              log.debug('RendererActor: Container validation failed during navigation', {
                hasContainer: !!container,
                isConnected: container?.isConnected,
                containerTagName: container?.tagName
              });
              
              // For navigation race conditions, retry container validation with progressive backoff
              // This allows the new VibeGrid component's DOM to stabilize
              const retryValidation = (attempt = 1, maxAttempts = 5) => {
                const delay = Math.min(50 * attempt, 200); // Progressive backoff: 50ms, 100ms, 150ms, 200ms, 200ms
                
                setTimeout(() => {
                  // Prioritize original event container over window reference for reliability
                  const retryContainer = event.options.container || (window as any).__vibegrid_renderer_container;
                  if (retryContainer && retryContainer.isConnected) {
                    log.debug(`RendererActor: Container validation succeeded on retry ${attempt}`);
                    // Continue with renderer creation using the valid container
                    const finalOptions = { ...mergedOptions, container: retryContainer };
                    
                    renderer = new EnhancedTableRenderer(finalOptions);
                    isInitializing = false;
                    isInitialized = true;
                    
                    // Store renderer instance on window for access by view handlers
                    (window as any).__vibegridx_renderer_instance = renderer;
                    
                    log.info(`RendererActor: Renderer created successfully on retry ${attempt}`);
                    sendBack({ type: 'RENDERER_READY' });
                    
                    // Process any queued render events
                    if (pendingRenderEvents.length > 0) {
                      log.info('RendererActor: Processing', pendingRenderEvents.length, 'queued render events');
                      for (const queuedEvent of pendingRenderEvents) {
                        log.info('RendererActor: Processing queued', queuedEvent.type, 'event');
                        // Handle queued events (simplified - just RENDER events for now)
                        if (queuedEvent.type === 'RENDER' && queuedEvent.state && renderer) {
                          renderer.render(queuedEvent.state.columns, queuedEvent.state.rows);
                        }
                      }
                      pendingRenderEvents = [];
                    }
                  } else if (attempt < maxAttempts) {
                    log.debug(`RendererActor: Container invalid on retry ${attempt}/${maxAttempts}, retrying...`);
                    retryValidation(attempt + 1, maxAttempts);
                  } else {
                    log.debug(`RendererActor: Container still invalid after ${maxAttempts} retries, aborting`);
                    isInitializing = false;
                  }
                }, delay);
              };
              
              retryValidation();
              return;
              
              // If no cleanup is active and container is invalid, silently abort
              // This is expected behavior when components unmount/remount quickly
              isInitializing = false;
              return;
            }
            
            // Update merged options with container
            const finalOptions = { ...mergedOptions, container };
            
            log.info('RendererActor: Creating renderer with merged options:', {
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
            
            renderer = new EnhancedTableRenderer(finalOptions);
            isInitializing = false;
            isInitialized = true;
            
            // Store renderer instance on window for access by view handlers
            (window as any).__vibegridx_renderer_instance = renderer;
            
            log.info('RendererActor: Renderer created successfully', {
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
              log.info(`RendererActor: Processing ${pendingRenderEvents.length} queued render events`);
              
              for (const queuedEvent of pendingRenderEvents) {
                if (queuedEvent.type === 'RENDER' && queuedEvent.state) {
                  log.info('RendererActor: Processing queued RENDER event');
                  renderer.render(queuedEvent.state);
                  sendBack({
                    type: 'ROWS_RENDERED',
                    rowCount: queuedEvent.state.rows?.length || 0
                  });
                } else if (queuedEvent.type === 'RENDER_ROWS' && queuedEvent.state) {
                  log.info('RendererActor: Processing queued RENDER_ROWS event');
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
            log.error('RendererActor: Failed to create renderer:', error);
            log.error('Full error:', error.stack);
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
              log.info('RendererActor: Queueing RENDER_ROWS event during initialization');
              pendingRenderEvents.push({
                type: 'RENDER_ROWS',
                state: event.state
              });
              return;
            } else {
              log.warn('RendererActor: Cannot render - renderer not initialized');
              sendBack({ 
                type: 'RENDERER_ERROR', 
                error: 'Renderer not initialized' 
              });
              return;
            }
          }
          
          log.info('RendererActor: Rendering rows:', {
            rowCount: event.state.rows?.length || 0,
            hasColumns: !!event.state.columns,
            hasViewport: !!event.state.viewport
          });
          
          // Perform the actual rendering
          renderer.render(event.state);
          
          // Report back what was actually rendered
          const actualOrder = renderer.getRenderedRowIds?.() || [];
          const currentViewport = renderer.getCurrentViewport?.() || null;
          
          log.info('RendererActor: Render completed, reporting back:', {
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
            log.warn('RendererActor: Cannot update viewport - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Updating viewport:', event.viewport);
          
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
            log.warn('RendererActor: Cannot update columns - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Updating columns:', event.columns.length);
          
          // Update renderer columns if method exists
          if (renderer.updateColumns) {
            renderer.updateColumns(event.columns);
          }
          
          sendBack({ type: 'COLUMNS_UPDATED' });
          break;
          
        // UPDATE_COLUMN_WIDTH removed - column widths now updated via UPDATE_COORDINATES
          
        case 'UPDATE_COORDINATES':
          if (!renderer) {
            log.warn('RendererActor: Cannot update coordinates - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Updating coordinates from state machine:', {
            version: event.version,
            columnCount: event.mapping.columns.length
          });
          
          // Update coordinate mapping in renderer - this is the authoritative source
          if (renderer.updateCoordinateMapping) {
            renderer.updateCoordinateMapping(event.mapping, event.version);
          } else {
            log.warn('RendererActor: Renderer does not support updateCoordinateMapping');
          }
          
          sendBack({ type: 'COORDINATES_UPDATED' });
          break;
          
          
        case 'RENDER':
          log.info('RendererActor: RENDER event received', {
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
              log.info('RendererActor: Queueing RENDER event during initialization');
              pendingRenderEvents.push({
                type: 'RENDER',
                state: event.state,
                coordinateMapping: (event as any).coordinateMapping
              });
              return;
            } else {
              log.warn('RendererActor: Cannot render - renderer not initialized', {
                isInitializing,
                isInitialized
              });
              return;
            }
          }
          
          if (!event.state) {
            log.warn('RendererActor: Cannot render - no state provided');
            return;
          }
          
          // Note: Removed version checking - we want to render whenever data changes
          
          log.info('RendererActor: Rendering with state:', {
            rows: event.state.rows?.length,
            columns: event.state.columns?.length,
            version: event.state.version
          });
          
          // Store the render state
          renderState = event.state;
          
          try {
            // Render with the new state
            log.info('RendererActor: About to call renderer.render()');
            renderer.render(event.state);
            log.info('RendererActor: renderer.render() completed successfully');
            
            // Version tracking removed - we render on data changes
          } catch (renderError) {
            log.error('RendererActor: Error in renderer.render():', renderError);
            throw renderError;
          }
          
          sendBack({ 
            type: 'ROWS_RENDERED',
            rowCount: event.state.rows?.length || 0
          });
          break;
          
          
        case 'UPDATE_SELECTED_ROWS':
          if (!renderer) {
            log.warn('RendererActor: Cannot update selected rows - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Updating selected rows:', {
            selectedRowsSize: event.selectedRows.size,
            selectedRowIds: Array.from(event.selectedRows)
          });
          
          // Update selected rows in renderer to sync checkbox states and row styles
          if (renderer.setSelectedRows) {
            renderer.setSelectedRows(event.selectedRows);
          } else {
            log.warn('RendererActor: setSelectedRows method not available on renderer');
          }
          
          sendBack({ type: 'SELECTED_ROWS_UPDATED' });
          break;
          
        case 'REMOVE_ROW':
          if (!renderer) {
            log.warn('RendererActor: Cannot remove row - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Removing row:', {
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
            log.warn('RendererActor: Cannot perform surgical update - renderer not initialized');
            return;
          }
          
          log.info('RendererActor: Performing surgical update:', {
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
          
          log.info('RendererActor: Surgical update completed');
          break;
          
        case 'APPLY_DRAG_PREVIEW':
          if (!renderer) {
            log.warn('RendererActor: Cannot apply drag preview - renderer not initialized');
            return;
          }
          
          // Call the drag preview method on the renderer
          if ('applyDragPreview' in renderer && typeof renderer.applyDragPreview === 'function') {
            renderer.applyDragPreview(event.dragPreview);
          } else {
            log.warn('RendererActor: Renderer does not have applyDragPreview method');
          }
          break;
          
        case 'UPDATE_DRAG_POSITION':
          if (!renderer) {
            log.warn('RendererActor: Cannot update drag position - renderer not initialized');
            return;
          }
          
          // Let renderer handle all drag calculations internally
          if ('updateDragPosition' in renderer && typeof renderer.updateDragPosition === 'function') {
            renderer.updateDragPosition({
              mouseX: event.mouseX,
              mouseY: event.mouseY
            });
          } else {
            log.warn('RendererActor: Renderer does not have updateDragPosition method');
          }
          break;
          
        case 'CLEAR_DRAG_PREVIEW':
          if (!renderer) {
            log.warn('RendererActor: Cannot clear drag preview - renderer not initialized');
            return;
          }
          
          // Call the clear drag preview method on the renderer
          if ('clearDragPreview' in renderer && typeof renderer.clearDragPreview === 'function') {
            renderer.clearDragPreview();
          } else {
            log.warn('RendererActor: Renderer does not have clearDragPreview method');
          }
          break;
          
        case 'CALCULATE_COORDINATES':
          log.info('RendererActor: Calculating coordinates', {
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
              version: coordinateMapping.version,
              deferredEvent: event.deferredEvent
            });
          } catch (error) {
            log.error('RendererActor: Error calculating coordinates:', error);
            sendBack({
              type: 'RENDERER_ERROR',
              error: `Failed to calculate coordinates: ${error.message}`
            });
          }
          break;
          
        case 'DESTROY':
          log.info('RendererActor: Destroying renderer');
          
          if (renderer) {
            renderer.destroy?.();
            renderer = null;
            // Clean up window reference
            delete (window as any).__vibegridx_renderer_instance;
          }
          break;
          
        default:
          log.warn('RendererActor: Unknown event type:', event);
      }
    } catch (error) {
      log.error('RendererActor: Error processing event:', error);
      sendBack({ 
        type: 'RENDERER_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    log.info('RendererActor: Cleanup - destroying renderer');
    
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