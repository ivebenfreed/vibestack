import { useEffect, useCallback } from 'react';
import { observe } from '@legendapp/state';
import type { TableState } from '../state/table-state';
import type { ViewportInfo } from '../types';
import { debounce } from '../utils/legend-helpers';

export function useTableViewport(
  tableState$: TableState,
  containerRef: React.RefObject<HTMLElement>
) {
  // Calculate visible range based on viewport and row data
  const calculateVisibleRange = useCallback((viewport: ViewportInfo, totalRows: number) => {
    const rowHeight = 40; // Default row height
    const startIndex = Math.floor(viewport.scrollTop / rowHeight);
    const visibleCount = Math.ceil(viewport.height / rowHeight);
    const bufferSize = Math.max(5, Math.floor(visibleCount / 2)); // Buffer for smooth scrolling
    
    const start = Math.max(0, startIndex - bufferSize);
    const end = Math.min(totalRows - 1, startIndex + visibleCount + bufferSize);
    
    return { start, end };
  }, []);
  
  // Handle scroll events
  const handleScroll = useCallback(
    debounce((event: Event) => {
      const target = event.target as HTMLElement;
      if (!target) return;
      
      const totalRows = tableState$.processedData.get().sortedData.length;
      const currentViewport = tableState$.viewport.get();
      
      const newViewport: ViewportInfo = {
        ...currentViewport,
        scrollTop: target.scrollTop,
        scrollLeft: target.scrollLeft
      };
      
      // Calculate new visible range
      const visibleRange = calculateVisibleRange(newViewport, totalRows);
      
      // Only update if range actually changed (avoid unnecessary re-renders)
      if (visibleRange.start !== currentViewport.start || visibleRange.end !== currentViewport.end) {
        tableState$.setViewport({
          ...newViewport,
          start: visibleRange.start,
          end: visibleRange.end
        });
      }
    }, 16), // ~60fps
    [tableState$, calculateVisibleRange]
  );
  
  // Handle resize events
  const handleResize = useCallback(
    debounce(() => {
      const container = containerRef.current;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      const totalRows = tableState$.processedData.get().sortedData.length;
      const currentViewport = tableState$.viewport.get();
      
      const newViewport: ViewportInfo = {
        ...currentViewport,
        height: rect.height,
        width: rect.width
      };
      
      // Recalculate visible range with new dimensions
      const visibleRange = calculateVisibleRange(newViewport, totalRows);
      
      tableState$.setViewport({
        ...newViewport,
        start: visibleRange.start,
        end: visibleRange.end
      });
    }, 100),
    [tableState$, containerRef, calculateVisibleRange]
  );
  
  // Set up event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    // Initial viewport calculation
    const rect = container.getBoundingClientRect();
    const totalRows = tableState$.processedData.get().sortedData.length;
    
    if (rect.height > 0 && rect.width > 0) {
      const initialViewport: ViewportInfo = {
        start: 0,
        end: Math.min(20, totalRows - 1), // Initial visible range
        scrollTop: 0,
        scrollLeft: 0,
        height: rect.height,
        width: rect.width
      };
      
      const visibleRange = calculateVisibleRange(initialViewport, totalRows);
      tableState$.setViewport({
        ...initialViewport,
        start: visibleRange.start,
        end: visibleRange.end
      });
    }
    
    // Add event listeners
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, [containerRef, tableState$, handleScroll, handleResize, calculateVisibleRange]);
  
  // Update viewport when data changes (e.g., after filtering/sorting)
  useEffect(() => {
    const cleanup = observe(() => {
      const totalRows = tableState$.processedData.get().sortedData.length;
      const currentViewport = tableState$.viewport.get();
      
      // Ensure viewport doesn't exceed data bounds
      if (currentViewport.end >= totalRows && totalRows > 0) {
        const visibleRange = calculateVisibleRange(currentViewport, totalRows);
        tableState$.setViewport({
          ...currentViewport,
          start: visibleRange.start,
          end: visibleRange.end
        });
      }
    });
    
    return cleanup;
  }, [tableState$, calculateVisibleRange]);
  
  // Return viewport utilities
  return {
    scrollToRow: useCallback((rowIndex: number) => {
      const container = containerRef.current;
      if (!container) return;
      
      const rowHeight = 40;
      const targetScrollTop = rowIndex * rowHeight;
      
      container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }, [containerRef]),
    
    scrollToTop: useCallback(() => {
      const container = containerRef.current;
      if (!container) return;
      
      container.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }, [containerRef]),
    
    getVisibleRowRange: useCallback(() => {
      const viewport = tableState$.viewport.get();
      return { start: viewport.start, end: viewport.end };
    }, [tableState$])
  };
}