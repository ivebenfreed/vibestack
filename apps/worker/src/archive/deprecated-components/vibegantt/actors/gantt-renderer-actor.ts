import { fromCallback } from 'xstate';
import type { CoordinateMapping } from '../stores/gantt-data-store';
import { GanttRenderer } from '../renderers/core/GanttRenderer';
import { log } from '@/logger';
const fileLog = log('archive/deprecated-components/vibegantt/actors/gantt-renderer-actor.ts');

/**
 * Gantt Renderer Actor - Following VibeGridDex Pattern
 * 
 * This actor uses the callback pattern with proper event isolation.
 * All rendering is coordinate-based using pre-calculated positions
 * from the store, eliminating runtime date calculations.
 * 
 * Key patterns adopted:
 * - fromCallback for proper actor lifecycle
 * - Coordinate-based rendering
 * - Event isolation with typed responses
 * - Performance metrics tracking
 * - Merged window options pattern
 */

// ====================================
// EVENT TYPES
// ====================================

export type RendererActorEvent = 
  | { type: 'INITIALIZE'; options: RendererOptions }
  | { type: 'RENDER_COORDINATES'; mapping: CoordinateMapping; tasks: any; dependencies: any }
  | { type: 'UPDATE_VIEWPORT'; width: number; height: number }
  | { type: 'UPDATE_SELECTION'; selectedTaskIds: Set<string> }
  | { type: 'UPDATE_SCROLL'; scrollX: number; scrollY: number }
  | { type: 'UPDATE_TIMELINE_LAYOUT'; dayWidth: number; scrollX: number; scrollY: number }
  | { type: 'APPLY_TIME_SCALE_ZOOM'; dayWidth: number; anchorX: number; anchorDate?: Date }
  | { type: 'HANDLE_DRAG_MOVE'; taskId: string; deltaX: number }
  | { type: 'HANDLE_RESIZE_MOVE'; taskId: string; handle: 'left' | 'right'; deltaX: number }
  | { type: 'RESET_DRAG_STATE'; taskId: string }
  | { type: 'DESTROY' };

export type RendererActorResponse =
  | { type: 'RENDERER_READY' }
  | { type: 'RENDER_COMPLETE'; renderTime: number; taskCount: number }
  | { type: 'VIEWPORT_UPDATED' }
  | { type: 'RENDERER_ERROR'; error: string };

interface RendererOptions {
  container?: HTMLElement;
  onTaskClick?: (taskId: string) => void;
  onTimelineClick?: (date: Date, x: number) => void;
}

// ====================================
// RENDERER ACTOR
// ====================================

export const ganttRendererActor = fromCallback<RendererActorEvent, RendererActorResponse, RendererOptions>(({ 
  sendBack, 
  receive,
  input
}) => {
  let renderer: GanttRenderer | null = null;
  let isInitialized = false;
  let isInitializing = false;
  
  fileLog.info('GanttRendererActor: Created callback actor with input:', input);
  
  // Initialize immediately if input is provided
  if (input && input.container) {
    fileLog.info('GanttRendererActor: Auto-initializing with input');
    
    isInitializing = true;
    
    try {
      const eventHandler = (event: any) => {
        fileLog.info('GanttRendererActor: Forwarding event from renderer:', event);
        sendBack(event);
      };
      
      const machineEventHandler = (event: any) => {
        fileLog.info('GanttRendererActor: Forwarding machine event directly:', event);
        sendBack(event);
      };
      
      renderer = new GanttRenderer(input.container, eventHandler, machineEventHandler);
      renderer.initialize();
      
      isInitializing = false;
      isInitialized = true;
      
      // Store renderer instance on window for debugging
      (window as any).__vibegantt_renderer_instance = renderer;
      
      sendBack({ type: 'RENDERER_READY' });
    } catch (error) {
      fileLog.error('GanttRendererActor: Error during auto-initialization:', error);
      sendBack({ 
        type: 'RENDERER_ERROR', 
        error: `Auto-initialization failed: ${error.message}` 
      });
    }
  }
  
  // Handle incoming events
  receive(async (event) => {
    fileLog.info('GanttRendererActor: Received event:', event.type);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          fileLog.info('GanttRendererActor: Initializing with options:', event.options);
          
          // Prevent multiple initializations
          if (isInitializing || isInitialized) {
            fileLog.warn('GanttRendererActor: Already initialized/initializing');
            return;
          }
          
          isInitializing = true;
          
          // Merge stored options from window with event options
          const storedOptions = (window as any).__vibegantt_renderer_options || {};
          const mergedOptions = {
            ...storedOptions,
            ...event.options,
            // Add event callbacks that send back to parent
            onTaskClick: (taskId: string) => {
              sendBack({
                type: 'TASK_CLICKED',
                taskId
              });
            },
            onTimelineClick: (date: Date, x: number) => {
              sendBack({
                type: 'TIMELINE_CLICKED',
                date,
                x
              });
            }
          };
          
          const container = mergedOptions.container;
          if (!container) {
            throw new Error('Container is required for initialization');
          }
          
          fileLog.info('GanttRendererActor: Creating renderer with merged options');
          
          // Create renderer with event handler
          const eventHandler = (event: any) => {
            fileLog.info('GanttRendererActor: Forwarding event from renderer:', event);
            sendBack(event);
          };
          
          // Create machine event handler that forwards events to the parent machine directly
          const machineEventHandler = (event: any) => {
            fileLog.info('GanttRendererActor: Forwarding machine event directly:', event);
            sendBack(event);
          };
          
          renderer = new GanttRenderer(container, eventHandler, machineEventHandler);
          renderer.initialize();
          
          isInitializing = false;
          isInitialized = true;
          
          // Store renderer instance on window for debugging
          (window as any).__vibegantt_renderer_instance = renderer;
          
          sendBack({ type: 'RENDERER_READY' });
          break;
          
        case 'RENDER_COORDINATES':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot render - renderer not initialized');
            sendBack({ 
              type: 'RENDERER_ERROR', 
              error: 'Renderer not initialized' 
            });
            return;
          }
          
          fileLog.info('GanttRendererActor: Rendering with coordinates:', {
            taskCount: event.mapping.tasks.length,
            segmentCount: event.mapping.timeline.segments.length,
            version: event.mapping.version
          });
          
          const startTime = performance.now();
          
          // Render using pre-calculated coordinates
          renderer.renderFromCoordinates({
            coordinateMapping: event.mapping,
            tasks: event.tasks,
            dependencies: event.dependencies
          });
          
          const renderTime = performance.now() - startTime;
          
          sendBack({ 
            type: 'RENDER_COMPLETE',
            renderTime,
            taskCount: event.mapping.tasks.length
          });
          break;
          
        case 'UPDATE_VIEWPORT':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot update viewport - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: Updating viewport:', { 
            width: event.width, 
            height: event.height 
          });
          
          renderer.resize(event.width, event.height);
          sendBack({ type: 'VIEWPORT_UPDATED' });
          break;
          
        case 'UPDATE_SELECTION':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot update selection - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: Updating selection:', {
            selectedCount: event.selectedTaskIds.size
          });
          
          renderer.updateSelection(event.selectedTaskIds);
          break;
          
        case 'UPDATE_SCROLL':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot update scroll - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: Updating scroll position:', {
            scrollX: event.scrollX,
            scrollY: event.scrollY
          });
          
          renderer.updateScroll(event.scrollX, event.scrollY);
          break;
          
        case 'UPDATE_TIMELINE_LAYOUT':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot update timeline layout - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: Updating timeline layout and scroll:', {
            dayWidth: event.dayWidth,
            scrollX: event.scrollX,
            scrollY: event.scrollY
          });
          
          // Update the timeline layout with new day width and scroll position
          renderer.updateTimelineLayout(event.dayWidth);
          renderer.updateScroll(event.scrollX, event.scrollY);
          break;
          
        case 'UPDATE_DEPENDENCY_SELECTION':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot update dependency selection - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: Updating dependency selection:', event.dependencyId);
          renderer.updateDependencySelection(event.dependencyId);
          break;
          
        case 'APPLY_TIME_SCALE_ZOOM':
          fileLog.info('GanttRendererActor: APPLY_TIME_SCALE_ZOOM message received!', {
            dayWidth: event.dayWidth,
            anchorX: event.anchorX,
            anchorDate: event.anchorDate,
            rendererExists: !!renderer
          });
          
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot apply time scale zoom - renderer not initialized');
            return;
          }
          
          fileLog.info('GanttRendererActor: About to call applyTimeScaleZoom...');
          renderer.applyTimeScaleZoom(event.dayWidth, event.anchorX, event.anchorDate);
          fileLog.info('GanttRendererActor: applyTimeScaleZoom call completed');
          break;
          
        case 'HANDLE_DRAG_MOVE':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot handle drag - renderer not initialized');
            return;
          }
          
          renderer.handleDragMove(event.taskId, event.deltaX);
          break;
          
        case 'HANDLE_RESIZE_MOVE':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot handle resize - renderer not initialized');
            return;
          }
          
          renderer.handleResizeMove(event.taskId, event.handle, event.deltaX);
          break;
          
        case 'RESET_DRAG_STATE':
          if (!renderer) {
            fileLog.warn('GanttRendererActor: Cannot reset drag state - renderer not initialized');
            return;
          }
          
          renderer.resetDragState(event.taskId);
          break;
          
        case 'DESTROY':
          fileLog.info('GanttRendererActor: Destroying renderer');
          
          if (renderer) {
            renderer.destroy();
            renderer = null;
            // Clean up window reference
            delete (window as any).__vibegantt_renderer_instance;
          }
          break;
          
        default:
          fileLog.warn('GanttRendererActor: Unknown event type:', event);
      }
    } catch (error) {
      fileLog.error('GanttRendererActor: Error processing event:', error);
      sendBack({ 
        type: 'RENDERER_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    fileLog.info('GanttRendererActor: Cleanup - destroying renderer');
    
    if (renderer) {
      renderer.destroy();
      renderer = null;
    }
  };
});

// ====================================
// TYPE GUARDS
// ====================================

/**
 * Type guard to check if an event is a renderer actor event
 */
export function isRendererActorEvent(event: any): event is RendererActorEvent {
  return event && typeof event.type === 'string' && 
    ['INITIALIZE', 'RENDER_COORDINATES', 'UPDATE_VIEWPORT', 'UPDATE_SELECTION', 'DESTROY'].includes(event.type);
}

/**
 * Type guard to check if a response is a renderer actor response
 */
export function isRendererActorResponse(response: any): response is RendererActorResponse {
  return response && typeof response.type === 'string' && 
    ['RENDERER_READY', 'RENDER_COMPLETE', 'VIEWPORT_UPDATED', 'RENDERER_ERROR'].includes(response.type);
}