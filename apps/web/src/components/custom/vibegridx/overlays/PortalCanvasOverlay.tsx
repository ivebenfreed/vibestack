import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { ViewportInfo } from '../types';
import { CanvasOverlay } from './CanvasOverlay';
import type { OverlayConfig } from './OverlayTypes';

interface PortalCanvasOverlayProps {
  tableContainerRef: React.RefObject<HTMLElement>;
  viewport: ViewportInfo | null;
  config: Partial<OverlayConfig>;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;
}

interface ViewportBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Portal-based canvas overlay that uses fixed positioning relative to the document
 * to ensure reliable positioning during virtual scrolling.
 */
export const PortalCanvasOverlay: React.FC<PortalCanvasOverlayProps> = ({
  tableContainerRef,
  viewport,
  config,
  onSelectionChange,
  onFillComplete
}) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlay | null>(null);
  const viewportBoundsRef = useRef<ViewportBounds | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Create portal container element
  const portalContainer = useMemo(() => {
    if (typeof document === 'undefined') return null;
    
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
  }, []);

  // Calculate viewport bounds relative to document
  const calculateViewportBounds = useCallback((): ViewportBounds | null => {
    if (!tableContainerRef.current) return null;

    const tableRect = tableContainerRef.current.getBoundingClientRect();
    const viewportElement = tableContainerRef.current.querySelector('.vibegridx-viewport') as HTMLElement;
    
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
  }, [tableContainerRef]);

  // Update canvas overlay position and size
  const updateCanvasPosition = useCallback(() => {
    if (!portalContainer || !canvasOverlayRef.current) return;

    const bounds = calculateViewportBounds();
    if (!bounds) return;

    viewportBoundsRef.current = bounds;

    // Update portal container position to match table viewport
    portalContainer.style.cssText = `
      position: fixed;
      top: ${bounds.top}px;
      left: ${bounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      pointer-events: none;
      z-index: 1000;
      overflow: visible;
      display: ${bounds.visible ? 'block' : 'none'};
    `;

    // Update the canvas overlay's internal viewport if it has changed
    if (viewport) {
      const adjustedViewport: ViewportInfo = {
        ...viewport,
        // Convert scroll positions to document-relative coordinates
        scrollTop: viewport.scrollTop,
        scrollLeft: viewport.scrollLeft || 0,
        width: bounds.width,
        height: bounds.height
      };
      
      canvasOverlayRef.current.updateViewport(adjustedViewport);
    }
  }, [portalContainer, calculateViewportBounds, viewport]);

  // Setup intersection observer for performance optimization
  useEffect(() => {
    if (!tableContainerRef.current || typeof window === 'undefined') return;

    const options: IntersectionObserverInit = {
      root: null, // Document viewport
      rootMargin: '50px', // Extend detection area for smoother updates
      threshold: [0, 0.1, 0.5, 1.0] // Multiple thresholds for precise tracking
    };

    intersectionObserverRef.current = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === tableContainerRef.current) {
          // Use requestAnimationFrame for smooth position updates
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          
          animationFrameRef.current = requestAnimationFrame(() => {
            updateCanvasPosition();
          });
        }
      });
    }, options);

    intersectionObserverRef.current.observe(tableContainerRef.current);

    return () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [tableContainerRef, updateCanvasPosition]);

  // Update position when viewport changes
  useEffect(() => {
    updateCanvasPosition();
  }, [viewport, updateCanvasPosition]);

  // Initialize canvas overlay
  useEffect(() => {
    if (!portalContainer) return;

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'vibegridx-fixed-canvas-container';
    canvasContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;
    
    portalContainer.appendChild(canvasContainer);
    portalContainerRef.current = canvasContainer;

    // Create canvas overlay with enhanced config
    const enhancedConfig: Partial<OverlayConfig> = {
      ...config,
      // Override positioning behavior for fixed mode
      useFixedPositioning: true
    };

    canvasOverlayRef.current = new CanvasOverlay(canvasContainer, enhancedConfig);
    
    // Set up callbacks
    if (onSelectionChange) {
      canvasOverlayRef.current.onSelectionChange = onSelectionChange;
    }
    
    if (onFillComplete) {
      canvasOverlayRef.current.onFillComplete = onFillComplete;
    }

    // Initial position update
    updateCanvasPosition();

    return () => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.destroy();
        canvasOverlayRef.current = null;
      }
    };
  }, [portalContainer, config, onSelectionChange, onFillComplete, updateCanvasPosition]);

  // Cleanup portal on unmount
  useEffect(() => {
    return () => {
      if (portalContainer && document.body.contains(portalContainer)) {
        document.body.removeChild(portalContainer);
      }
    };
  }, [portalContainer]);

  // Expose canvas overlay methods for external access
  useEffect(() => {
    if (canvasOverlayRef.current && config.overlayActor) {
      // Forward any additional setup needed
    }
  }, [config.overlayActor]);

  // Add window scroll listener for additional position updates
  useEffect(() => {
    const handleScroll = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(() => {
        updateCanvasPosition();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [updateCanvasPosition]);

  // Return the portal - rendering the canvas overlay at document root
  if (!portalContainer) return null;

  return createPortal(
    <div 
      className="vibegridx-portal-canvas-content"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        pointerEvents: 'auto' // Enable interactions within the portal
      }}
    />, 
    portalContainer
  );
};

// Export the canvas overlay ref for external access
export const usePortalCanvasOverlay = (portalRef: React.RefObject<PortalCanvasOverlay>) => {
  return useMemo(() => {
    // This could be expanded to provide access to canvas overlay methods
    // For now, we'll handle this through the component props
    return {
      updateSelection: (selectedCells: Set<string>) => {
        // This would be handled through the overlay actor
      },
      updateViewport: (viewport: ViewportInfo) => {
        // This would be handled through props
      }
    };
  }, [portalRef]);
};