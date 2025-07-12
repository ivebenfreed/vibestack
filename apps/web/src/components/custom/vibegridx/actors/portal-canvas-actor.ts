// ====================================
// VIBEGRIDX PORTAL CANVAS ACTOR
// ====================================
//
// XState callback actor that manages the portal-based canvas overlay
// with fixed positioning for reliable viewport tracking during virtual scrolling.
// This replaces the legacy embedded canvas approach.
//
// ====================================

import { fromCallback } from 'xstate';
import type { ViewportInfo } from '../types';
import type { CoordinateMapping } from '../coordinates/VibeGridXCoordinateManager';
import type { OverlayConfig, VisualCellPosition } from '../overlays/OverlayTypes';

// ====================================
// EVENT TYPES
// ====================================

export type PortalCanvasActorEvent = 
  | { type: 'INITIALIZE'; tableContainerRef: React.RefObject<HTMLElement>; config: Partial<OverlayConfig> }
  | { type: 'UPDATE_SELECTION'; selection: Set<string> }
  | { type: 'UPDATE_COORDINATES'; mapping: CoordinateMapping }
  | { type: 'UPDATE_VIEWPORT'; viewport: ViewportInfo }
  | { type: 'SHOW_COPY_INDICATOR'; isCut: boolean }
  | { type: 'HIDE_COPY_INDICATOR' }
  | { type: 'DESTROY' };

export type PortalCanvasActorResponse =
  | { type: 'PORTAL_CANVAS_READY' }
  | { type: 'SELECTION_UPDATED' }
  | { type: 'COORDINATES_UPDATED' }
  | { type: 'VIEWPORT_UPDATED' }
  | { type: 'CANVAS_ERROR'; error: string };

// ====================================
// PORTAL CANVAS CONTEXT
// ====================================

interface PortalCanvasContext {
  tableContainerRef: React.RefObject<HTMLElement> | null;
  config: Partial<OverlayConfig> | null;
  viewport: ViewportInfo | null;
  isInitialized: boolean;
  portalMountPoint: HTMLElement | null;
}

// ====================================
// PORTAL CANVAS ACTOR
// ====================================

export const portalCanvasActor = fromCallback<PortalCanvasActorEvent, PortalCanvasActorResponse>(({ sendBack, receive }) => {
  let context: PortalCanvasContext = {
    tableContainerRef: null,
    config: null,
    viewport: null,
    isInitialized: false,
    portalMountPoint: null
  };
  
  let intersectionObserver: IntersectionObserver | null = null;
  let animationFrame: number | null = null;
  
  console.log('PortalCanvasActor: Created callback actor');
  
  // Create portal mount point
  const createPortalMountPoint = (): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'vibegridx-portal-canvas-overlay';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      pointer-events: none;
      z-index: 1000;
      overflow: visible;
    `;
    
    document.body.appendChild(container);
    return container;
  };
  
  // Calculate viewport bounds relative to document
  const calculateViewportBounds = () => {
    if (!context.tableContainerRef?.current) return null;

    const tableRect = context.tableContainerRef.current.getBoundingClientRect();
    const viewportElement = context.tableContainerRef.current.querySelector('.vibegridx-viewport') as HTMLElement;
    
    if (!viewportElement) return null;

    const viewportRect = viewportElement.getBoundingClientRect();

    // Check if the table is visible in the document viewport
    const documentHeight = window.innerHeight;
    const documentWidth = window.innerWidth;
    
    const visible = (
      viewportRect.top < documentHeight &&
      viewportRect.bottom > 0 &&
      viewportRect.left < documentWidth &&
      viewportRect.right > 0
    );

    return {
      top: viewportRect.top,
      left: viewportRect.left,
      width: viewportRect.width,
      height: viewportRect.height,
      visible
    };
  };
  
  // Update portal container position
  const updatePortalPosition = () => {
    if (!context.portalMountPoint) return;

    const bounds = calculateViewportBounds();
    if (!bounds) return;

    // Update portal container position to match table viewport
    context.portalMountPoint.style.cssText = `
      position: fixed;
      top: ${bounds.top}px;
      left: ${bounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      pointer-events: auto;
      z-index: 1000;
      overflow: visible;
      display: ${bounds.visible ? 'block' : 'none'};
    `;

    console.log('PortalCanvasActor: Updated portal position:', bounds);
  };
  
  // Setup intersection observer
  const setupIntersectionObserver = () => {
    if (!context.tableContainerRef?.current || typeof window === 'undefined') return;

    const options: IntersectionObserverInit = {
      root: null,
      rootMargin: '50px',
      threshold: [0, 0.1, 0.5, 1.0]
    };

    intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === context.tableContainerRef?.current) {
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
          }
          
          animationFrame = requestAnimationFrame(() => {
            updatePortalPosition();
          });
        }
      });
    }, options);

    intersectionObserver.observe(context.tableContainerRef.current);
  };
  
  receive((event) => {
    console.log('PortalCanvasActor: Received event:', event.type);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          console.log('PortalCanvasActor: Initializing portal canvas');
          
          context.tableContainerRef = event.tableContainerRef;
          context.config = {
            ...event.config,
            useFixedPositioning: true // Force portal mode
          };
          
          // Create portal mount point
          context.portalMountPoint = createPortalMountPoint();
          
          // Setup intersection observer for position tracking
          setupIntersectionObserver();
          
          // Setup window event listeners
          const handleScroll = () => {
            if (animationFrame) {
              cancelAnimationFrame(animationFrame);
            }
            
            animationFrame = requestAnimationFrame(() => {
              updatePortalPosition();
            });
          };

          window.addEventListener('scroll', handleScroll, { passive: true });
          window.addEventListener('resize', handleScroll, { passive: true });
          
          // Store cleanup functions
          (context as any).cleanup = () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
          };
          
          context.isInitialized = true;
          
          sendBack({ type: 'PORTAL_CANVAS_READY' });
          break;
          
        case 'UPDATE_VIEWPORT':
          if (!context.isInitialized) {
            console.warn('PortalCanvasActor: Cannot update viewport - not initialized');
            return;
          }
          
          context.viewport = event.viewport;
          updatePortalPosition();
          
          sendBack({ type: 'VIEWPORT_UPDATED' });
          break;
          
        case 'UPDATE_SELECTION':
          if (!context.isInitialized) {
            console.warn('PortalCanvasActor: Cannot update selection - not initialized');
            return;
          }
          
          console.log('PortalCanvasActor: Selection updated:', {
            selectionSize: event.selection.size
          });
          
          // The actual canvas overlay will be managed by the PortalCanvasOverlay React component
          // This actor just manages the portal container positioning
          
          sendBack({ type: 'SELECTION_UPDATED' });
          break;
          
        case 'UPDATE_COORDINATES':
          if (!context.isInitialized) {
            console.warn('PortalCanvasActor: Cannot update coordinates - not initialized');
            return;
          }
          
          console.log('PortalCanvasActor: Coordinates updated:', {
            mappingVersion: event.mapping.version,
            rowCount: event.mapping.rows?.length || 0,
            columnCount: event.mapping.columns?.length || 0
          });
          
          sendBack({ type: 'COORDINATES_UPDATED' });
          break;
          
        case 'SHOW_COPY_INDICATOR':
        case 'HIDE_COPY_INDICATOR':
          if (!context.isInitialized) {
            console.warn(`PortalCanvasActor: Cannot ${event.type.toLowerCase()} - not initialized`);
            return;
          }
          
          // These will be handled by the PortalCanvasOverlay component
          console.log(`PortalCanvasActor: ${event.type}`);
          break;
          
        case 'DESTROY':
          console.log('PortalCanvasActor: Destroying portal canvas');
          
          // Cleanup intersection observer
          if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
          }
          
          // Cleanup animation frame
          if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
          }
          
          // Cleanup window listeners
          if ((context as any).cleanup) {
            (context as any).cleanup();
          }
          
          // Remove portal mount point
          if (context.portalMountPoint && document.body.contains(context.portalMountPoint)) {
            document.body.removeChild(context.portalMountPoint);
          }
          
          // Reset context
          context = {
            tableContainerRef: null,
            config: null,
            viewport: null,
            isInitialized: false,
            portalMountPoint: null
          };
          break;
          
        default:
          console.warn('PortalCanvasActor: Unknown event type:', event);
      }
    } catch (error) {
      console.error('PortalCanvasActor: Error processing event:', error);
      sendBack({ 
        type: 'CANVAS_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    console.log('PortalCanvasActor: Cleanup - destroying portal canvas');
    
    // Cleanup intersection observer
    if (intersectionObserver) {
      intersectionObserver.disconnect();
      intersectionObserver = null;
    }
    
    // Cleanup animation frame
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    
    // Cleanup window listeners
    if ((context as any).cleanup) {
      (context as any).cleanup();
    }
    
    // Remove portal mount point
    if (context.portalMountPoint && document.body.contains(context.portalMountPoint)) {
      document.body.removeChild(context.portalMountPoint);
    }
  };
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Type guard to check if an event is a portal canvas actor event
 */
export function isPortalCanvasActorEvent(event: any): event is PortalCanvasActorEvent {
  return event && typeof event.type === 'string' && 
    [
      'INITIALIZE', 'UPDATE_SELECTION', 'UPDATE_COORDINATES', 'UPDATE_VIEWPORT',
      'SHOW_COPY_INDICATOR', 'HIDE_COPY_INDICATOR', 'DESTROY'
    ].includes(event.type);
}

/**
 * Type guard to check if a response is a portal canvas actor response
 */
export function isPortalCanvasActorResponse(response: any): response is PortalCanvasActorResponse {
  return response && typeof response.type === 'string' && 
    ['PORTAL_CANVAS_READY', 'SELECTION_UPDATED', 'COORDINATES_UPDATED', 'VIEWPORT_UPDATED', 'CANVAS_ERROR'].includes(response.type);
}