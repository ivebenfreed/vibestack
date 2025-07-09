import React, { useEffect, useRef, useCallback } from 'react';
import { 
  useTableConfiguration, 
  useTableMachine, 
  useEntityIntegration, 
  useRendererInitialization,
  useSelectionStateSync,
  type InitializationRefs 
} from './VibeGridXCore';
import {
  createCellClickHandler,
  createCellDoubleClickHandler,
  createColumnClickHandler,
  createKeyboardHandler,
  createScrollHandler,
  createRendererStateChangeHandler,
  type EventHandlerRefs,
  type EventHandlerCallbacks
} from './VibeGridXEvents';
import {
  useChangeDetection,
  useRenderStateExtractor,
  useVibeGridXApi
} from './VibeGridXHooks';
import type { RenderState, TableRow, CellRef } from './types';
import type { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import type { CanvasOverlayManager } from './overlays/CanvasOverlayManager';
import type { EntityIntegrationLayer } from './integration/EntityIntegration';
import './vibegridx.css';

// ====================================
// COMPONENT PROPS
// ====================================

interface VibeGridXProps {
  entityType: 'task' | 'project' | 'user';
  tableId?: string;
  className?: string;
  height?: number;
  width?: number;
  
  // Optional external data (if not using entity integration)
  data?: any[];
  
  // Event handlers
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
  
  // Performance options
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  
  // Feature flags
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
}

// ====================================
// MAIN COMPONENT
// ====================================

export const VibeGridX: React.FC<VibeGridXProps> = (props) => {
  const {
    className = '',
    height = 600,
    width = '100%',
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
  } = props;
  
  // ====================================
  // REFS AND STATE
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AtomicTableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlayManager | null>(null);
  const integrationRef = useRef<EntityIntegrationLayer | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const anchorCellRef = useRef<CellRef | null>(null);
  const subscriptionRef = useRef<any>(null);
  
  // Refs object for event handlers
  const refs: InitializationRefs = {
    containerRef,
    overlayContainerRef,
    rendererRef,
    canvasOverlayRef,
    integrationRef,
    selectedCellsRef,
    anchorCellRef,
    subscriptionRef
  };
  
  // ====================================
  // CORE INITIALIZATION
  // ====================================
  
  const { tableConfig, tableId } = useTableConfiguration(props);
  const { tableState, tableSend, tableActor } = useTableMachine(tableConfig);
  
  // Entity integration
  useEntityIntegration(tableActor, props.entityType, integrationRef);
  
  // State extraction hooks
  const { hasDataChanged, getChangedRows, hasSelectionChanged } = useChangeDetection();
  const { extractRenderStateFromActor } = useRenderStateExtractor(integrationRef);
  
  // Event callbacks
  const eventCallbacks: EventHandlerCallbacks = {
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate
  };
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  const handleCellClick = createCellClickHandler(refs, tableSend, eventCallbacks);
  const handleCellDoubleClick = createCellDoubleClickHandler(tableSend, eventCallbacks);
  const handleColumnClick = createColumnClickHandler(refs, tableSend);
  const handleKeyDown = createKeyboardHandler(refs, tableSend);
  const handleScroll = createScrollHandler(refs, tableSend);
  const handleRendererStateChange = createRendererStateChangeHandler(refs, eventCallbacks);
  
  // ====================================
  // RENDERER INITIALIZATION
  // ====================================
  
  useRendererInitialization(refs, {
    onCellClick: handleCellClick,
    onCellDoubleClick: handleCellDoubleClick,
    onColumnClick: handleColumnClick,
    onStateChange: handleRendererStateChange,
    onScroll: handleScroll,
    onKeyDown: (event: KeyboardEvent) => {
      handleKeyDown(event as any);
    },
    cellHeight: 40,
    selectionColor: '#3b82f6',
    selectionBorderColor: '#1d4ed8',
    editingColor: '#10b981',
    editingBorderColor: '#059669',
    enableAnimations: false,
    animationDuration: 0,
    borderWidth: 2
  });
  
  // Selection state sync
  useSelectionStateSync(tableActor, refs);
  
  // ====================================
  // PERFORMANCE MONITORING
  // ====================================
  
  // Performance metrics are reported inline after renders to avoid dependency issues
  
  // ====================================
  // STATE-TO-RENDERER SYNC
  // ====================================
  
  // ====================================
  // ACTOR-DRIVEN RENDERING (NO REACT EFFECTS)
  // ====================================
  
  useEffect(() => {
    if (!rendererRef.current || !tableActor) {
      console.log('VibeGridX: Skipping actor subscription setup - missing renderer or actor');
      return;
    }
    
    // Avoid duplicate subscriptions
    if (subscriptionRef.current) {
      console.log('VibeGridX: Subscription already exists, skipping setup');
      return;
    }
    
    console.log('VibeGridX: Setting up actor subscription for TableMachine -> AtomicRenderer');
    
    let subscriptionCount = 0;
    
    // XState v5 proper subscription pattern - listen to all state changes
    const subscription = tableActor.subscribe((snapshot) => {
      subscriptionCount++;
      
      // Only log significant state changes
      const stateValue = snapshot.value;
      const version = snapshot.context?.version;
      
      // Skip selection-only updates since we handle those directly
      const isDataChange = hasDataChanged(snapshot);
      
      if (!isDataChange) {
        // This is likely a selection change - skip expensive processing
        return;
      }
      
      console.log('VibeGridX: Processing data change:', {
        state: stateValue,
        version: version
      });
      
      const renderState = extractRenderStateFromActor(snapshot);
      if (renderState) {
        // HYBRID RENDERING: Only process data changes
        
        // 1. Data changes - use granular updates
        const { changedRows, newRows, deletedRowIds, isStructuralChange } = getChangedRows(renderState);
        
        if (isStructuralChange) {
          // Structural changes need full re-render (new rows, deleted rows, initial load)
          console.log(`VibeGridX: STRUCTURAL CHANGE - Full table re-render (${newRows.length} new, ${deletedRowIds.length} deleted, ${renderState.rows.length} total)`);
          rendererRef.current!.render(renderState);
            // Report performance metrics after render
            setTimeout(() => {
              if (rendererRef.current && onPerformanceUpdate) {
                const metrics = rendererRef.current.getPerformanceMetrics();
                if (metrics) {
                  onPerformanceUpdate({
                    lastRenderTime: metrics.lastRenderTime,
                    visibleRows: metrics.visibleRows,
                    cacheSize: metrics.cacheSize,
                    updateQueueSize: metrics.updateQueueSize,
                    timestamp: Date.now()
                  });
                }
              }
            }, 50);
        } else if (changedRows.length > 0) {
          // Only specific rows changed - update those rows only
          console.log(`VibeGridX: ROW CHANGES - Updating ${changedRows.length} specific rows`);
          rendererRef.current!.updateRows(changedRows);
          // Report performance metrics after render
          setTimeout(() => {
            if (rendererRef.current && onPerformanceUpdate) {
              const metrics = rendererRef.current.getPerformanceMetrics();
              if (metrics) {
                onPerformanceUpdate({
                  lastRenderTime: metrics.lastRenderTime,
                  visibleRows: metrics.visibleRows,
                  cacheSize: metrics.cacheSize,
                  updateQueueSize: metrics.updateQueueSize,
                  timestamp: Date.now()
                });
              }
            }
          }, 50);
        }
        
        // 2. Editing changes go to Canvas Overlay (if needed)
        if (renderState.editingCell && canvasOverlayRef.current) {
          canvasOverlayRef.current.updateEditingCell(renderState.editingCell);
        }
        
      } else {
        console.warn('VibeGridX: extractRenderStateFromActor returned null');
      }
    });
    
    // No need for initial render trigger - machine already has data from config
    
    // Store subscription reference
    subscriptionRef.current = subscription;
    
    
    return () => {
      console.log('VibeGridX: Cleaning up actor subscriptions');
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [tableActor, hasDataChanged, getChangedRows, extractRenderStateFromActor, onPerformanceUpdate]); // Add all dependencies
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  const vibeGridXApi = useVibeGridXApi(tableSend, tableState, tableActor, rendererRef);
  
  // ====================================
  // STATE MACHINE EVENT SUBSCRIPTIONS
  // ====================================
  
  // Selection state sync is now handled by useSelectionStateSync hook
  
  // ====================================
  // RENDER
  // ====================================
  
  return (
    <div
      className={`vibegridx-container ${className}`}
      style={{ width, height }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Atomic Renderer Container */}
      <div
        ref={containerRef}
        className="vibegridx-renderer"
      />
    </div>
  );
};

// ====================================
// EXPORTS
// ====================================

// Export the main component
export default VibeGridX;

// Export types for external use
export type { VibeGridXProps };

// Re-export the hook from VibeGridXHooks
export { useVibeGridXRef } from './VibeGridXHooks';