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
import type { CoordinateMapping } from '../coordinates/VibeGridXCoordinateManager';
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
  | { type: 'DESTROY' };

export type CanvasActorResponse =
  | { type: 'CANVAS_READY' }
  | { type: 'SELECTION_UPDATED' }
  | { type: 'CANVAS_COORDINATES_UPDATED' }
  | { type: 'VIEWPORT_UPDATED' }
  | { type: 'CANVAS_ERROR'; error: string };

// ====================================
// CANVAS ACTOR
// ====================================

export const canvasActor = fromCallback<CanvasActorEvent, CanvasActorResponse>(({ sendBack, receive }) => {
  let canvas: CanvasOverlay | null = null;
  
  console.log('CanvasActor: Created for embedded mode');
  
  receive((event) => {
    // Only log non-viewport events for debugging
    if (event.type !== 'UPDATE_VIEWPORT') {
      console.log('CanvasActor: Received event:', event.type, event);
    }
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          console.log('CanvasActor: Initializing with container and config', {
            container: event.container,
            containerClass: event.container.className,
            containerBounds: event.container.getBoundingClientRect(),
            config: event.config,
            currentCanvasState: {
              hasCanvas: !!canvas,
              canvasType: canvas?.constructor?.name
            }
          });
          
          try {
            canvas = new CanvasOverlay(event.container, event.config);
            console.log('CanvasActor: Canvas overlay created successfully');
            
            sendBack({ type: 'CANVAS_READY' });
          } catch (error) {
            console.error('CanvasActor: Failed to create canvas overlay:', error);
            console.error('CanvasActor: Error stack:', error.stack);
            sendBack({ 
              type: 'CANVAS_ERROR', 
              error: `Failed to initialize canvas: ${error.message}` 
            });
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
      'INITIALIZE', 'UPDATE_SELECTION', 'UPDATE_COORDINATES', 'UPDATE_VIEWPORT',
      'UPDATE_COLUMN_DRAG', 'UPDATE_COLUMN_RESIZE', 'SHOW_COPY_INDICATOR', 
      'HIDE_COPY_INDICATOR', 'DESTROY'
    ].includes(event.type);
}

/**
 * Type guard to check if a response is a canvas actor response
 */
export function isCanvasActorResponse(response: any): response is CanvasActorResponse {
  return response && typeof response.type === 'string' && 
    ['CANVAS_READY', 'SELECTION_UPDATED', 'CANVAS_COORDINATES_UPDATED', 'VIEWPORT_UPDATED', 'CANVAS_ERROR'].includes(response.type);
}