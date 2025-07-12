import React, { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CanvasOverlay } from '../overlays/CanvasOverlay';
import type { ViewportInfo } from '../types';
import type { OverlayConfig } from '../overlays/OverlayTypes';

interface PortalCanvasOverlayProviderProps {
  tableContainerRef: React.RefObject<HTMLElement>;
  viewport: ViewportInfo | null;
  config: Partial<OverlayConfig>;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onFillComplete?: (originalCells: Set<string>, fillCells: Set<string>) => void;
  isEnabled: boolean;
}

interface ViewportBounds {
  top: number;
  left: number;
  width: number;
  height: number;
  visible: boolean;
}

/**
 * Portal-based canvas overlay provider that renders overlays at document root
 * with fixed positioning for reliable viewport tracking during virtual scrolling.
 */
export const PortalCanvasOverlayProvider: React.FC<PortalCanvasOverlayProviderProps> = ({
  tableContainerRef,
  viewport,
  config,
  onSelectionChange,
  onFillComplete,
  isEnabled
}) => {
  const portalContainerRef = useRef<HTMLDivElement | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlay | null>(null);
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);

  // Calculate viewport bounds relative to document
  const calculateViewportBounds = useCallback((): ViewportBounds | null => {
    if (!tableContainerRef.current) return null;

    const viewportElement = tableContainerRef.current.querySelector('.vibegridx-viewport') as HTMLElement;
    
    if (!viewportElement) return null;

    const viewportRect = viewportElement.getBoundingClientRect();

    // Check if the table is visible in the document viewport
    const documentHeight = window.innerHeight;
    const documentWidth = window.innerWidth;
    
    // Constrain to visible viewport area
    const constrainedTop = Math.max(0, viewportRect.top);
    const constrainedLeft = Math.max(0, viewportRect.left);
    const constrainedBottom = Math.min(documentHeight, viewportRect.bottom);
    const constrainedRight = Math.min(documentWidth, viewportRect.right);
    
    const visible = (
      constrainedBottom > constrainedTop &&
      constrainedRight > constrainedLeft &&
      viewportRect.bottom > 0 &&
      viewportRect.right > 0
    );

    return {
      top: constrainedTop,
      left: constrainedLeft,
      width: constrainedRight - constrainedLeft,
      height: constrainedBottom - constrainedTop,
      visible
    };
  }, [tableContainerRef]);

  // Update portal container position and size
  const updatePortalPosition = useCallback(() => {
    if (!portalContainerRef.current || !isEnabled) return;

    const bounds = calculateViewportBounds();
    if (!bounds) return;

    // Debug the bounds calculation
    console.log('PortalCanvasOverlayProvider: Updating portal position', {
      bounds,
      originalViewportRect: tableContainerRef.current?.querySelector('.vibegridx-viewport')?.getBoundingClientRect(),
      viewportElement: tableContainerRef.current?.querySelector('.vibegridx-viewport'),
      tableContainer: tableContainerRef.current,
      windowDimensions: { width: window.innerWidth, height: window.innerHeight },
      pageScrollPosition: { x: window.scrollX, y: window.scrollY }
    });

    // Update portal container position to match table viewport
    portalContainerRef.current.style.cssText = `
      position: fixed;
      top: ${bounds.top}px;
      left: ${bounds.left}px;
      width: ${bounds.width}px;
      height: ${bounds.height}px;
      pointer-events: none;
      z-index: 1000;
      overflow: hidden;
      display: ${bounds.visible ? 'block' : 'none'};
      border: 2px solid red;
    `;

    // Update the canvas overlay's viewport if it has changed
    if (viewport && canvasOverlayRef.current) {
      const adjustedViewport: ViewportInfo = {
        ...viewport,
        width: bounds.width,
        height: bounds.height
      };
      
      canvasOverlayRef.current.updateViewport(adjustedViewport);
    }
  }, [calculateViewportBounds, viewport, isEnabled]);

  // Create and manage portal container
  useEffect(() => {
    if (!isEnabled) return;

    // Create portal container
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
    portalContainerRef.current = container;

    // Cleanup function
    const cleanup = () => {
      if (container && document.body.contains(container)) {
        document.body.removeChild(container);
      }
    };
    
    cleanupFunctionsRef.current.push(cleanup);

    return cleanup;
  }, [isEnabled]);

  // Initialize canvas overlay - use stable dependencies to prevent recreation
  useEffect(() => {
    if (!portalContainerRef.current || !isEnabled) return;

    // Skip if canvas overlay already exists
    if (canvasOverlayRef.current) {
      console.log('PortalCanvasOverlayProvider: Canvas overlay already exists, skipping creation');
      return;
    }

    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'vibegridx-fixed-canvas-container';
    canvasContainer.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    `;
    
    portalContainerRef.current.appendChild(canvasContainer);

    // Create canvas overlay with portal configuration
    const enhancedConfig: Partial<OverlayConfig> = {
      ...config,
      useFixedPositioning: true // Enable portal mode
    };

    try {
      canvasOverlayRef.current = new CanvasOverlay(canvasContainer, enhancedConfig);
      
      // Set up callbacks
      if (onSelectionChange) {
        canvasOverlayRef.current.onSelectionChange = onSelectionChange;
      }
      
      if (onFillComplete) {
        canvasOverlayRef.current.onFillComplete = onFillComplete;
      }

      console.log('PortalCanvasOverlayProvider: Canvas overlay created successfully');

      // Initial position update
      updatePortalPosition();

    } catch (error) {
      console.error('PortalCanvasOverlayProvider: Failed to create canvas overlay:', error);
    }

    return () => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.destroy();
        canvasOverlayRef.current = null;
      }
    };
  }, [isEnabled]); // Only depend on isEnabled, not the other changing props

  // Update callbacks when they change without recreating the canvas
  useEffect(() => {
    if (!canvasOverlayRef.current) return;
    
    if (onSelectionChange) {
      canvasOverlayRef.current.onSelectionChange = onSelectionChange;
    }
    
    if (onFillComplete) {
      canvasOverlayRef.current.onFillComplete = onFillComplete;
    }
  }, [onSelectionChange, onFillComplete]);

  // Setup intersection observer for performance optimization
  useEffect(() => {
    if (!tableContainerRef.current || !isEnabled) return;

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
            updatePortalPosition();
          });
        }
      });
    }, options);

    intersectionObserverRef.current.observe(tableContainerRef.current);

    const cleanup = () => {
      if (intersectionObserverRef.current) {
        intersectionObserverRef.current.disconnect();
        intersectionObserverRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    cleanupFunctionsRef.current.push(cleanup);

    return cleanup;
  }, [tableContainerRef, updatePortalPosition, isEnabled]);

  // Add window scroll and resize listeners for additional position updates
  useEffect(() => {
    if (!isEnabled) return;

    const handleScroll = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      animationFrameRef.current = requestAnimationFrame(() => {
        updatePortalPosition();
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });

    const cleanup = () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };

    cleanupFunctionsRef.current.push(cleanup);

    return cleanup;
  }, [updatePortalPosition, isEnabled]);

  // Update position when viewport changes
  useEffect(() => {
    if (isEnabled) {
      updatePortalPosition();
    }
  }, [viewport, updatePortalPosition, isEnabled]);

  // Cleanup all functions on unmount
  useEffect(() => {
    return () => {
      cleanupFunctionsRef.current.forEach(cleanup => cleanup());
      cleanupFunctionsRef.current = [];
    };
  }, []);

  // Expose canvas overlay methods for external access
  const canvasOverlayMethods = {
    updateSelection: (selectedCells: Set<string>) => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.updateSelection(selectedCells);
      }
    },
    updateCoordinates: (mapping: any) => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.updateCoordinates(mapping);
      }
    },
    showCopyIndicator: (isCut: boolean) => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.showCopyIndicator(isCut);
      }
    },
    hideCopyIndicator: () => {
      if (canvasOverlayRef.current) {
        canvasOverlayRef.current.hideCopyIndicator();
      }
    }
  };

  // Attach methods to a global reference for external access (temporary solution)
  useEffect(() => {
    if (isEnabled && canvasOverlayRef.current) {
      (window as any).vibegridxPortalCanvas = canvasOverlayMethods;
    }
    
    return () => {
      if ((window as any).vibegridxPortalCanvas === canvasOverlayMethods) {
        delete (window as any).vibegridxPortalCanvas;
      }
    };
  }, [canvasOverlayMethods, isEnabled]);

  // Don't render anything in the component tree - everything is portaled
  return null;
};

export default PortalCanvasOverlayProvider;