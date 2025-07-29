// ====================================
// VIBEGRIDX CANVAS ACTOR
// ====================================
//
// XState callback actor that wraps the CanvasOverlay
// for proper actor model integration. Handles Konva canvas
// lifecycle and selection visualization.
//
// This eliminates direct method calls to the canvas overlay
// and ensures all updates flow through XState events.
//
// ====================================

import { fromCallback } from 'xstate';
import { CanvasOverlay } from '../overlays/CanvasOverlay';
import type { ViewportInfo, CellRef } from '../types';
import type { CoordinateMapping } from '../machines/table-machine/slices/dimensions-slice';
import type { OverlayConfig, VisualCellPosition } from '../overlays/OverlayTypes';

// ====================================
// EVENT TYPES
// ====================================

export type CanvasActorEvent = 
  | { type: 'INITIALIZE'; container: HTMLElement; config: Partial<OverlayConfig> }
  | { type: 'UPDATE_SELECTION'; selection: Set<string> }
  | { type: 'UPDATE_SELECTION_VISUAL'; visualCells: VisualCellPosition[] }
  | { type: 'UPDATE_COORDINATES'; mapping: CoordinateMapping }
  | { type: 'UPDATE_VIEWPORT'; viewport: ViewportInfo }
  | { type: 'UPDATE_COLUMN_DRAG'; dragState: any; mouseX: number; mouseY: number }
  | { type: 'UPDATE_COLUMN_RESIZE'; resizeState: any }
  | { type: 'SHOW_COPY_INDICATOR'; isCut: boolean }
  | { type: 'HIDE_COPY_INDICATOR' }
  | { type: 'UPDATE_CLIPBOARD_VISUAL'; clipboardState: { copiedCells: Set<string>; isCut: boolean; visualPositions?: VisualCellPosition[] } | null; viewport: ViewportInfo }
  | { type: 'RENDER_FILL_HANDLE'; visualCells: VisualCellPosition[]; selectedRows?: Set<string> }
  | { type: 'RENDER_FILL_HANDLE_ROW_SELECTION'; selectedRows: Set<string>; visualCells: VisualCellPosition[] }
  | { type: 'RENDER_FILL_PREVIEW'; previewCells: Set<string>; viewport: ViewportInfo }
  | { type: 'CLEAR_FILL_PREVIEW' }
  | { type: 'HIDE_FILL_HANDLE' }
  | { type: 'SHOW_EDITING'; position: VisualCellPosition }
  | { type: 'HIDE_EDITING' }
  | { type: 'DESTROY' };

export type CanvasActorResponse =
  | { type: 'CANVAS_READY' }
  | { type: 'CANVAS_DEFERRED_READY' }
  | { type: 'SELECTION_UPDATED' }
  | { type: 'CANVAS_COORDINATES_UPDATED' }
  | { type: 'VIEWPORT_UPDATED' }
  | { type: 'FILL_START'; direction: 'vertical' | 'horizontal' }
  | { type: 'FILL_PREVIEW'; previewCells: Set<string> }
  | { type: 'FILL_COMPLETE'; fillCells: Set<string> }
  | { type: 'FILL_CELLS_CALCULATED'; fillCells: Set<string> }
  | { type: 'FILL_CANCEL' }
  | { type: 'COPY'; cells: Set<string> }
  | { type: 'CUT'; cells: Set<string> }
  | { type: 'PASTE' }
  | { type: 'CLEAR_CLIPBOARD' }
  | { type: 'CANVAS_ERROR'; error: string };

// ====================================
// CANVAS ACTOR
// ====================================

export const canvasActor = fromCallback<CanvasActorEvent, CanvasActorResponse>(({ sendBack, receive }) => {
  let canvas: CanvasOverlay | null = null;
  let queuedCoordinateUpdate: any = null;
  
  console.log('CanvasActor: Created for embedded mode');
  
  receive((event) => {
    // Only log non-viewport events for debugging
    if (event.type !== 'UPDATE_VIEWPORT') {
      console.log('CanvasActor: Received event:', event.type, event);
    }
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          const initStartTime = performance.now();
          console.log('CanvasActor: Deferring canvas initialization', {
            container: event.container,
            containerClass: event.container.className,
            config: event.config
          });
          
          // Store config for deferred initialization
          const storedConfig = event.config;
          const storedContainer = event.container;
          
          // Send ready immediately to unblock table rendering
          sendBack({ type: 'CANVAS_READY' });
          
          // Initialize canvas when browser is idle
          // Note: This may show a 50ms+ warning in console but it's acceptable
          // since it runs in idle time and doesn't block the initial table render
          const initializeCanvas = async () => {
            try {
              console.log('CanvasActor: Starting deferred canvas initialization');
              const deferredStartTime = performance.now();
              
              canvas = new CanvasOverlay(storedContainer, storedConfig);
              
              // Set up callbacks for pure actors approach
              canvas.onFillStart = (direction) => sendBack({ type: 'FILL_START', direction });
              canvas.onFillPreview = (previewCells) => sendBack({ type: 'FILL_PREVIEW', previewCells });
              canvas.onFillComplete = (fillCells) => sendBack({ type: 'FILL_COMPLETE', fillCells });
              canvas.onFillCancel = () => sendBack({ type: 'FILL_CANCEL' });
              canvas.onCopy = (cells) => sendBack({ type: 'COPY', cells });
              canvas.onCut = (cells) => sendBack({ type: 'CUT', cells });
              canvas.onPaste = () => sendBack({ type: 'PASTE' });
              canvas.onClearClipboard = () => sendBack({ type: 'CLEAR_CLIPBOARD' });
              
              // Pre-initialize Stage progressively
              await canvas.preInitializeAsync();
              
              const deferredInitTime = performance.now() - deferredStartTime;
              console.log('🔥 CanvasActor: Deferred canvas initialization complete', {
                initTime: `${deferredInitTime.toFixed(2)}ms`,
                totalTimeFromInitialize: `${(performance.now() - initStartTime).toFixed(2)}ms`
              });
              
              // Process any queued events
              if (queuedCoordinateUpdate) {
                console.log('CanvasActor: Processing queued coordinate update');
                canvas.updateCoordinates(queuedCoordinateUpdate);
                queuedCoordinateUpdate = null;
              }
              
              sendBack({ type: 'CANVAS_DEFERRED_READY' });
            } catch (error) {
              console.error('CanvasActor: Failed to create canvas overlay:', error);
              sendBack({ 
                type: 'CANVAS_ERROR', 
                error: `Failed to initialize canvas: ${error.message}` 
              });
            }
          };
          
          // Use requestIdleCallback if available, otherwise fall back to setTimeout
          if ('requestIdleCallback' in window) {
            requestIdleCallback(initializeCanvas, { timeout: 100 });
          } else {
            setTimeout(initializeCanvas, 16); // ~1 frame
          }
          break;
          
        case 'UPDATE_SELECTION':
          if (!canvas) {
            console.warn('CanvasActor: Cannot update selection - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Updating selection:', {
            selectionSize: event.selection.size
          });
          
          canvas.updateSelection(event.selection);
          sendBack({ type: 'SELECTION_UPDATED' });
          break;
          
        case 'UPDATE_SELECTION_VISUAL':
          console.log('CanvasActor: UPDATE_SELECTION_VISUAL debug', {
            hasCanvas: !!canvas,
            canvasType: canvas?.constructor?.name,
            canvasInstance: canvas
          });
          
          if (!canvas) {
            console.warn('CanvasActor: Cannot update selection visual - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Updating selection with visual positions:', {
            cellCount: event.visualCells.length,
            positions: event.visualCells
          });
          
          // Update canvas overlay with pre-calculated visual positions
          canvas.updateSelectionVisual(event.visualCells);
          sendBack({ type: 'SELECTION_UPDATED' });
          break;
          
        case 'UPDATE_COORDINATES':
          if (!canvas) {
            // Queue this event to be processed after initialization
            console.log('CanvasActor: Queuing UPDATE_COORDINATES event until canvas is initialized');
            queuedCoordinateUpdate = event.mapping;
            return;
          }
          
          console.log('CanvasActor: Updating coordinates:', {
            mappingVersion: event.mapping.version,
            rowCount: event.mapping.rows?.length || 0,
            columnCount: event.mapping.columns?.length || 0
          });
          
          canvas.updateCoordinates(event.mapping);
          sendBack({ type: 'CANVAS_COORDINATES_UPDATED' });
          break;
          
        case 'UPDATE_VIEWPORT':
          if (!canvas) {
            console.warn('CanvasActor: Cannot update viewport - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Updating viewport:', event.viewport);
          canvas.updateViewport(event.viewport);
          sendBack({ type: 'VIEWPORT_UPDATED' });
          break;
          
        case 'UPDATE_COLUMN_DRAG':
          console.log('CanvasActor: Column drag updates handled by DOM elements');
          break;
          
        case 'UPDATE_COLUMN_RESIZE':
          console.log('CanvasActor: Column resize updates handled by DOM elements');
          break;
          
        case 'SHOW_COPY_INDICATOR':
          if (!canvas) {
            console.warn('CanvasActor: Cannot show copy indicator - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Showing copy indicator:', { isCut: event.isCut });
          canvas.showCopyIndicator(event.isCut);
          break;
          
        case 'HIDE_COPY_INDICATOR':
          if (!canvas) {
            console.warn('CanvasActor: Cannot hide copy indicator - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Hiding copy indicator');
          canvas.hideCopyIndicator();
          break;
          
        case 'UPDATE_CLIPBOARD_VISUAL':
          if (!canvas) {
            console.warn('CanvasActor: Cannot update clipboard visual - canvas not initialized');
            return;
          }
          console.log('CanvasActor: Updating clipboard visual', {
            hasClipboard: !!event.clipboardState,
            cellCount: event.clipboardState?.copiedCells.size || 0,
            isCut: event.clipboardState?.isCut || false,
            hasVisualPositions: !!event.clipboardState?.visualPositions
          });
          
          // Update clipboard overlay if available
          const clipboardOverlay = (canvas as any).getClipboardOverlay();
          if (clipboardOverlay) {
            // Use visual positions if available
            if (event.clipboardState?.visualPositions && event.clipboardState.visualPositions.length > 0) {
              clipboardOverlay.updateIndicatorWithVisualPositions(
                event.clipboardState.visualPositions,
                event.clipboardState.isCut
              );
            } else {
              // Fall back to coordinate-based calculation
              clipboardOverlay.updateIndicator(event.clipboardState, event.viewport);
            }
          }
          break;
          
        case 'RENDER_FILL_HANDLE':
          if (!canvas) {
            console.warn('CanvasActor: Cannot render fill handle - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Rendering fill handle with visual positions:', {
            cellCount: event.visualCells.length,
            selectedRowsCount: event.selectedRows?.size || 0
          });
          const fillHandleLayer = (canvas as any).getFillHandleLayer();
          fillHandleLayer.renderFillHandleWithVisualPositions(event.visualCells, event.selectedRows);
          break;
          
        case 'RENDER_FILL_HANDLE_ROW_SELECTION':
          if (!canvas) {
            console.warn('CanvasActor: Cannot render row selection fill handle - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Rendering fill handle for row selection:', {
            selectedRowsCount: event.selectedRows.size,
            visualCellsCount: event.visualCells.length
          });
          const rowFillHandleLayer = (canvas as any).getFillHandleLayer();
          rowFillHandleLayer.renderFillHandleWithVisualPositions(event.visualCells, event.selectedRows);
          break;
          
        case 'RENDER_FILL_PREVIEW':
          if (!canvas) {
            console.warn('CanvasActor: Cannot render fill preview - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Rendering fill preview');
          const fillLayer = (canvas as any).getFillHandleLayer();
          fillLayer.renderFillPreview(event.previewCells, event.viewport);
          break;
          
        case 'CLEAR_FILL_PREVIEW':
          if (!canvas) {
            console.warn('CanvasActor: Cannot clear fill preview - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Clearing fill preview');
          const clearFillLayer = (canvas as any).getFillHandleLayer();
          clearFillLayer.clearFillPreview();
          break;
          
        case 'HIDE_FILL_HANDLE':
          if (!canvas) {
            console.warn('CanvasActor: Cannot hide fill handle - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Hiding fill handle');
          const hideFillLayer = (canvas as any).getFillHandleLayer();
          hideFillLayer.hideFillHandle();
          break;
          
        case 'SHOW_EDITING':
          if (!canvas) {
            console.warn('CanvasActor: Cannot show editing overlay - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Showing editing overlay', event.position);
          canvas.showEditingOverlay(event.position);
          break;
          
        case 'HIDE_EDITING':
          if (!canvas) {
            console.warn('CanvasActor: Cannot hide editing overlay - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Hiding editing overlay');
          canvas.hideEditingOverlay();
          break;
          
        case 'CALCULATE_FILL_PREVIEW':
          if (!canvas) {
            console.warn('CanvasActor: Cannot calculate fill preview - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Calculating fill preview');
          const fillHandleLayerPreview = (canvas as any).getFillHandleLayer();
          const previewCells = fillHandleLayerPreview.calculateFillPreviewCells(
            event.dragPos,
            event.selectedCells,
            event.viewport
          );
          
          // Send back the calculated preview cells
          sendBack({
            type: 'FILL_PREVIEW',
            previewCells: previewCells
          });
          break;
          
        case 'CALCULATE_FILL_COMPLETE':
          if (!canvas) {
            console.warn('CanvasActor: Cannot calculate fill complete - canvas not initialized');
            return;
          }
          
          console.log('CanvasActor: Calculating fill complete');
          const fillHandleLayerComplete = (canvas as any).getFillHandleLayer();
          const fillCells = fillHandleLayerComplete.calculateFillPreviewCells(
            event.dragPos,
            event.selectedCells,
            event.viewport
          );
          
          // Send back a different event name to avoid re-triggering the handler
          sendBack({
            type: 'FILL_CELLS_CALCULATED',
            fillCells: fillCells
          });
          break;
          
        case 'DESTROY':
          console.log('CanvasActor: Destroying canvas overlay');
          
          if (canvas) {
            canvas.destroy();
            canvas = null;
          }
          break;
          
        default:
          console.warn('CanvasActor: Unknown event type:', event);
      }
    } catch (error) {
      console.error('CanvasActor: Error processing event:', error);
      sendBack({ 
        type: 'CANVAS_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    console.log('CanvasActor: Cleanup - destroying canvas overlay');
    
    if (canvas) {
      canvas.destroy();
      canvas = null;
    }
  };
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Type guard to check if an event is a canvas actor event
 */
export function isCanvasActorEvent(event: any): event is CanvasActorEvent {
  return event && typeof event.type === 'string' && 
    [
      'INITIALIZE', 'UPDATE_SELECTION', 'UPDATE_SELECTION_VISUAL', 'UPDATE_COORDINATES', 'UPDATE_VIEWPORT',
      'UPDATE_COLUMN_DRAG', 'UPDATE_COLUMN_RESIZE', 'SHOW_COPY_INDICATOR', 
      'HIDE_COPY_INDICATOR', 'UPDATE_CLIPBOARD_VISUAL', 'RENDER_FILL_HANDLE', 'RENDER_FILL_HANDLE_ROW_SELECTION', 'RENDER_FILL_PREVIEW',
      'CLEAR_FILL_PREVIEW', 'HIDE_FILL_HANDLE', 'DESTROY'
    ].includes(event.type);
}

/**
 * Type guard to check if a response is a canvas actor response
 */
export function isCanvasActorResponse(response: any): response is CanvasActorResponse {
  return response && typeof response.type === 'string' && 
    [
      'CANVAS_READY', 'CANVAS_DEFERRED_READY', 'SELECTION_UPDATED', 'CANVAS_COORDINATES_UPDATED', 'VIEWPORT_UPDATED',
      'FILL_START', 'FILL_PREVIEW', 'FILL_COMPLETE', 'FILL_CELLS_CALCULATED', 'FILL_CANCEL',
      'COPY', 'CUT', 'PASTE', 'CLEAR_CLIPBOARD', 'CANVAS_ERROR'
    ].includes(response.type);
}