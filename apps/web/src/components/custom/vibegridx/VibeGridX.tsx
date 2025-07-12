import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { tableBaseMachine } from './machines/table-machine';
import { 
  useRendererInitialization,
  useSelectionStateSync,
  type InitializationRefs 
} from './VibeGridXCore';
// PortalCanvasOverlayProvider removed - using embedded canvas approach
import {
  createCellClickHandler,
  createCellDoubleClickHandler,
  createColumnClickHandler,
  createKeyboardHandler,
  createScrollHandler,
  createRendererStateChangeHandler,
  createMouseDownHandler,
  createMouseMoveHandler,
  createMouseUpHandler,
  createColumnDragStartHandler,
  createColumnDragMoveHandler,
  createColumnDragEndHandler,
  createColumnResizeStartHandler,
  createColumnResizeMoveHandler,
  createColumnResizeEndHandler,
  type EventHandlerRefs,
  type EventHandlerCallbacks
} from './VibeGridXEvents';
import {
  useChangeDetection,
  useRenderStateExtractor,
  useVibeGridXApi
} from './VibeGridXHooks';
import type { RenderState, TableRow, CellRef, Column } from './types';
import type { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import { CanvasOverlay } from './overlays/CanvasOverlay';
import { createVibeGridXCoordinateManager, type VibeGridXCoordinateManager } from './coordinates/VibeGridXCoordinateManager';
import { VibeGridXHeader } from './components/VibeGridXHeader';
import './vibegridx.css';

// ====================================
// COMPONENT PROPS
// ====================================

interface VibeGridXProps<T = any> {
  entityType: 'task' | 'project' | 'user';
  columns: Column<T>[];  // Required typed columns
  tableId?: string;
  className?: string;
  height?: number;
  width?: number;
  
  // Optional external data (if not using entity integration)
  data?: any[];
  relationshipData?: any;
  
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
  enableSelectionColumn?: boolean; // Enable checkbox selection column
}

// ====================================
// MAIN COMPONENT
// ====================================

export const VibeGridX = <T extends Record<string, any> = any>(
  props: VibeGridXProps<T>
): React.ReactElement => {
  const {
    columns,
    className = '',
    height = 600,
    width = '100%',
    relationshipData,
    enableSelectionColumn = false,
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
  } = props;
  
  // ====================================
  // HMR DETECTION AND HANDLING
  // ====================================
  
  // Force refresh on HMR to avoid direct DOM issues
  useEffect(() => {
    if (import.meta.hot) {
      const handleHMR = (payload: any) => {
        // Only reload if VibeGridX-related files are updated
        const isVibeGridXUpdate = payload?.updates?.some((update: any) => 
          update.path?.includes('/vibegridx/') || 
          update.acceptedPath?.includes('/vibegridx/')
        );
        
        if (isVibeGridXUpdate) {
          console.log('VibeGridX: HMR detected for VibeGridX files, forcing page refresh to avoid DOM issues');
          window.location.reload();
        }
      };
      
      import.meta.hot.on('vite:beforeUpdate', handleHMR);
      
      return () => {
        import.meta.hot.off('vite:beforeUpdate', handleHMR);
      };
    }
  }, []);
  
  // ====================================
  // REFS AND STATE
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AtomicTableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlay | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const anchorCellRef = useRef<CellRef | null>(null);
  const subscriptionRef = useRef<any>(null);
  // Coordinate manager is now owned by table machine, not React refs
  const dragStateRef = useRef<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>({ isDragging: false, startCell: null, startPos: null });
  
  // ====================================
  // CORE INITIALIZATION
  // ====================================
  
  // Generate stable table ID that persists across renders
  const tableId = useRef(`vibegridx-${props.entityType}-${Date.now()}`).current;
  
  // Create machine with props directly - machine will handle its own state
  const [tableState, tableSend, tableActor] = useMachine(tableBaseMachine, {
    input: {
      id: tableId,
      entityType: props.entityType,
      columns: props.columns,
      enableSelectionColumn: enableSelectionColumn,
      settings: {
        enableVirtualScrolling: props.enableVirtualScrolling ?? true,
        enableGrouping: props.enableGrouping ?? true,
        enableFiltering: props.enableFiltering ?? true,
        bufferSize: props.bufferSize ?? 10,
        initialViewport: {
          start: 0,
          end: Math.ceil((typeof height === 'number' ? height : 600) / 40),
          height: typeof height === 'number' ? height : 600,
          width: typeof width === 'number' ? width : 800,
          scrollTop: 0,
          scrollLeft: 0,
          itemHeight: 40
        }
      }
    }
  });
  
  // Debug table state only on state transitions, not every update
  useEffect(() => {
    const stateValue = tableState?.value;
    
    // Only log on actual state transitions or initial mount
    if (typeof stateValue === 'string') {
      console.log('VibeGridX: Table state transition:', {
        state: stateValue,
        hasCoordinateManager: !!tableState?.context?.coordinateManager,
        coordinateManagerColumnCount: tableState?.context?.coordinateManager?.getColumnCount?.() || 0
      });
    }
  }, [tableState?.value]); // Only when state value changes, not context
  
  // Refs object for event handlers
  const refs: InitializationRefs & { columns: Column[] } = {
    containerRef,
    overlayContainerRef,
    rendererRef,
    canvasOverlayRef,
    selectedCellsRef,
    anchorCellRef,
    subscriptionRef,
    dragStateRef,
    columns
  };
  
  // State extraction hooks
  const { getChangedRows } = useChangeDetection();
  const { extractRenderStateFromActor } = useRenderStateExtractor();
  
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
  
  // Cell click is now handled by mousedown/mouseup to avoid duplicate events
  const handleCellClick = createCellClickHandler(refs, tableSend, eventCallbacks);
  const handleCellDoubleClick = createCellDoubleClickHandler(tableSend, eventCallbacks);
  const handleColumnClick = createColumnClickHandler(refs, tableSend);
  const handleKeyDown = createKeyboardHandler(refs, tableSend);
  const handleScroll = createScrollHandler(refs, tableSend);
  const handleRendererStateChange = createRendererStateChangeHandler(refs, eventCallbacks);
  
  // Cell selection drag handlers
  const handleMouseDown = createMouseDownHandler(refs, tableSend);
  const handleMouseMove = createMouseMoveHandler(refs, tableSend);
  const handleMouseUp = createMouseUpHandler(refs, tableSend);
  
  // Column drag handlers
  const handleColumnDragStart = createColumnDragStartHandler(tableSend);
  const handleColumnDragMove = createColumnDragMoveHandler(tableSend);
  const handleColumnDragEnd = createColumnDragEndHandler(tableSend);
  
  // Column resize handlers
  const handleColumnResizeStart = createColumnResizeStartHandler(tableSend);
  const handleColumnResizeMove = createColumnResizeMoveHandler(tableSend);
  const handleColumnResizeEnd = createColumnResizeEndHandler(tableSend);
  
  // ====================================
  // RENDERER INITIALIZATION
  // ====================================
  
  // Remove wheel event debugging - not needed anymore
  
  useRendererInitialization(refs, {
    columns: columns,
    relationshipData: relationshipData,
    enableSelectionColumn: enableSelectionColumn,
    onCellClick: handleCellClick,
    onCellDoubleClick: handleCellDoubleClick,
    onColumnClick: handleColumnClick,
    onColumnDragStart: handleColumnDragStart,
    onColumnDragMove: handleColumnDragMove,
    onColumnDragEnd: handleColumnDragEnd,
    onColumnResizeStart: handleColumnResizeStart,
    onColumnResizeMove: handleColumnResizeMove,
    onColumnResizeEnd: handleColumnResizeEnd,
    onStateChange: handleRendererStateChange,
    onScroll: handleScroll,
    onKeyDown: (event: KeyboardEvent) => {
      handleKeyDown(event as any);
    },
    onSelectionChange: (selectedCells: Set<string>) => {
      // Update XState machine with drag selection
      tableSend({
        type: 'selection.bulk.set',
        selectedCells
      });
      
      // Call user callback if provided
      onSelectionChange?.(selectedCells);
    },
    onFillComplete: (originalCells: Set<string>, fillCells: Set<string>) => {
      console.log('VibeGridX: Fill operation requested', {
        originalCount: originalCells.size,
        fillCount: fillCells.size
      });
      
      // Check if this is a selection column fill operation
      const isSelectionColumnFill = Array.from(fillCells).some(cellKey => {
        const [, columnId] = cellKey.split(':');
        return columnId === '__selection';
      });
      
      if (isSelectionColumnFill) {
        // Handle selection column fill - select/deselect rows
        const rowIdsToSelect = new Set<string>();
        
        // Get all row IDs from fill cells
        fillCells.forEach(cellKey => {
          const [rowId, columnId] = cellKey.split(':');
          if (columnId === '__selection') {
            rowIdsToSelect.add(rowId);
          }
        });
        
        // Also include original selection
        originalCells.forEach(cellKey => {
          const [rowId, columnId] = cellKey.split(':');
          if (columnId === '__selection') {
            rowIdsToSelect.add(rowId);
          }
        });
        
        // Send checkbox range selection event
        if (rowIdsToSelect.size > 0) {
          const rowIds = Array.from(rowIdsToSelect);
          const firstRowId = rowIds[0];
          const lastRowId = rowIds[rowIds.length - 1];
          
          tableSend({
            type: 'selection.checkbox.range',
            startRowId: firstRowId,
            endRowId: lastRowId
          });
          
          console.log(`VibeGridX: Selected ${rowIdsToSelect.size} rows via fill handle`);
        }
      } else {
        // Regular data fill operation
        if (originalCells.size > 0 && fillCells.size > 0) {
          const firstCell = Array.from(originalCells)[0];
          const [rowId, columnId] = firstCell.split(':');
          
          // Find the value in the current data
          const snapshot = tableActor.getSnapshot();
          const row = snapshot.context.rows.find((r: any) => r.id === rowId);
          
          if (row && row.data[columnId] !== undefined) {
            const fillValue = row.data[columnId];
            
            // For now, we'll use the integration layer to update cells
            // This is a temporary solution until bulk edit is implemented
            for (const cellKey of fillCells) {
              const [targetRowId, targetColumnId] = cellKey.split(':');
              
              // Find the target row
              const targetRow = snapshot.context.rows.find((r: any) => r.id === targetRowId);
              if (targetRow) {
                // Create an update for this cell
                const updatedRow = {
                  ...targetRow,
                  data: {
                    ...targetRow.data,
                    [targetColumnId]: fillValue
                  }
                };
                
                // Send update through table machine
                tableSend({
                  type: 'data.row.update',
                  row: updatedRow
                });
              }
            }
            
            console.log(`VibeGridX: Filled ${fillCells.size} cells with value:`, fillValue);
          }
        }
      }
    },
    cellHeight: 40,
    selectionColor: '#3b82f6',
    selectionBorderColor: '#1d4ed8',
    editingColor: '#10b981',
    editingBorderColor: '#059669',
    enableAnimations: false,
    animationDuration: 0,
    borderWidth: 2
  }, tableState);
  
  // Selection state sync - REMOVED: Now handled reactively through XState event flow
  // useSelectionStateSync(tableActor, refs);
  
  // Update relationship data when it changes
  useEffect(() => {
    if (!refs.rendererRef.current || !relationshipData) return;
    
    refs.rendererRef.current.setRelationshipData(relationshipData);
  }, [relationshipData]);

  // Column visibility updates are handled through XState events - no useEffect needed
  
  // ====================================
  // GLOBAL EVENT DISPATCHER FOR CHECKBOXES
  // ====================================
  
  useEffect(() => {
    // Set up global event dispatcher for checkbox events
    (window as any).vibegridxDispatch = (event: any) => {
      console.log('VibeGridX: Global event dispatch', event);
      tableSend(event);
    };
    
    return () => {
      delete (window as any).vibegridxDispatch;
    };
  }, [tableSend]);
  
  // ====================================
  // XSTATE EVENT LISTENERS
  // ====================================
  
  useEffect(() => {
    if (!tableActor) return;
    
    // Check if the actor supports event listeners (XState v5 feature)
    if (!tableActor.on) {
      console.log('VibeGridX: Actor does not support event listeners');
      return;
    }
    
    // Listen for emitted events from the state machine
    const unsubscribers: Array<() => void> = [];
    
    try {
      // Selection change events
      const unsubSelection = tableActor.on('vibegridx.selection.change', (event) => {
        console.log('VibeGridX: Selection changed via XState event', event.selectedCells.size);
        onSelectionChange?.(event.selectedCells);
      });
      if (unsubSelection) unsubscribers.push(unsubSelection);
      
      // Row selection change events (for checkboxes)
      const unsubRowSelection = tableActor.on('selection.rows.changed', (event) => {
        console.log('VibeGridX: Row selection changed', event.selectedRows);
        // Update renderer with new selected rows
        if (refs.rendererRef.current) {
          refs.rendererRef.current.setSelectedRows(event.selectedRows);
        }
      });
      if (unsubRowSelection) unsubscribers.push(unsubRowSelection);
      
      // Performance events
      const unsubPerf = tableActor.on('vibegridx.perf.render', (event) => {
        onPerformanceUpdate?.({
          lastRenderTime: event.duration,
          visibleRows: event.cellCount,
          cacheSize: 0,
          updateQueueSize: 0,
          timestamp: Date.now()
        });
      });
      if (unsubPerf) unsubscribers.push(unsubPerf);
      
      // Error events
      const unsubError = tableActor.on('vibegridx.error', (event) => {
        console.error(`VibeGridX Error in ${event.context}:`, event.error);
      });
      if (unsubError) unsubscribers.push(unsubError);
      
      // Column drag events
      const unsubDragStarted = tableActor.on('view.drag.started', (event) => {
        console.log('VibeGridX: Column drag started', event.columnDragState);
        if (canvasOverlayRef.current && event.columnDragState) {
          canvasOverlayRef.current.updateColumnDrag(
            event.columnDragState,
            event.columnDragState.mouseX,
            event.columnDragState.mouseY
          );
        }
      });
      if (unsubDragStarted) unsubscribers.push(unsubDragStarted);
      
      const unsubDragUpdated = tableActor.on('view.drag.updated', (event) => {
        if (canvasOverlayRef.current && event.columnDragState) {
          canvasOverlayRef.current.updateColumnDrag(
            event.columnDragState,
            event.columnDragState.mouseX,
            event.columnDragState.mouseY
          );
        }
      });
      if (unsubDragUpdated) unsubscribers.push(unsubDragUpdated);
      
      const unsubDragCancelled = tableActor.on('view.drag.cancelled', (event) => {
        console.log('VibeGridX: Column drag cancelled');
        if (canvasOverlayRef.current) {
          canvasOverlayRef.current.updateColumnDrag(null, 0, 0);
        }
      });
      if (unsubDragCancelled) unsubscribers.push(unsubDragCancelled);
      
      // Column resize events
      const unsubResizeStarted = tableActor.on('view.resize.started', (event) => {
        console.log('VibeGridX: Column resize started', event.columnResizeState);
        if (canvasOverlayRef.current && event.columnResizeState) {
          // Start resize preview through overlay
          canvasOverlayRef.current.updateColumnResize(event.columnResizeState);
        }
      });
      if (unsubResizeStarted) unsubscribers.push(unsubResizeStarted);
      
      const unsubResizeUpdated = tableActor.on('view.resize.updated', (event) => {
        console.log('VibeGridX: Column resize updated', event.columnResizeState);
        if (canvasOverlayRef.current && event.columnResizeState) {
          // Update resize preview through overlay
          canvasOverlayRef.current.updateColumnResize(event.columnResizeState);
        }
      });
      if (unsubResizeUpdated) unsubscribers.push(unsubResizeUpdated);
      
      const unsubResizeEnded = tableActor.on('view.resize.ended', (event) => {
        console.log('VibeGridX: Column resize ended');
        if (canvasOverlayRef.current) {
          // Clear resize preview
          canvasOverlayRef.current.updateColumnResize(null);
        }
      });
      if (unsubResizeEnded) unsubscribers.push(unsubResizeEnded);
    } catch (error) {
      console.warn('VibeGridX: Failed to set up event listeners:', error);
    }
    
    return () => {
      unsubscribers.forEach(fn => {
        if (typeof fn === 'function') {
          try {
            fn();
          } catch (error) {
            console.warn('VibeGridX: Error during event listener cleanup:', error);
          }
        }
      });
    };
  }, [tableActor, onSelectionChange, onPerformanceUpdate]);
  
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
    
    // XState v5 proper subscription pattern - listen to version changes
    let previousVersion: number | undefined;
    
    const subscription = tableActor.subscribe((snapshot) => {
      subscriptionCount++;
      
      const currentVersion = snapshot.context?.version || 0;
      const hasProcessedRows = snapshot.context?.rows && snapshot.context.rows.length > 0;
      
      // Simple checks:
      // 1. Version must change (or be first render)  
      // 2. Must have processed rows from ViewActor
      if (previousVersion !== undefined && currentVersion === previousVersion) {
        return; // No version change, no render needed
      }
      
      if (!hasProcessedRows) {
        return; // No processed rows from ViewActor yet
      }
      
      // Version changed and view is ready - render!
      const isFirstRender = previousVersion === undefined;
      previousVersion = currentVersion;
      
      console.log('VibeGridX: Rendering', {
        version: currentVersion,
        isFirstRender
      });
      
      console.log('[RENDER FLOW 1] Extracting render state from actor');
      const renderState = extractRenderStateFromActor(snapshot);
      console.log('[RENDER FLOW 2] Render state extracted:', {
        hasRenderState: !!renderState,
        rowCount: renderState?.rows.length || 0,
        firstRowId: renderState?.rows[0]?.id
      });
      
      if (renderState) {
        // Process the render state update
        const { changedRows, newRows, deletedRowIds, isStructuralChange } = getChangedRows(renderState);
        
        if (isStructuralChange) {
          // Use initialize for first render, render for subsequent updates
          if (isFirstRender) {
            console.log(`VibeGridX: INITIAL LOAD - Initializing table (${renderState.rows.length} rows)`);
            rendererRef.current!.initialize(renderState);
          } else {
            console.log(`VibeGridX: STRUCTURAL CHANGE - Full table re-render (${newRows.length} new, ${deletedRowIds.length} deleted, ${renderState.rows.length} total)`);
            rendererRef.current!.render(renderState);
          }
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
        } else if (!isFirstRender && (renderState.columnVisibility || renderState.columnOrder)) {
          // Column visibility or order changes need renderer updates (skip during first render)
          console.log('VibeGridX: COLUMN CHANGE - Updating renderer only', {
            hasVisibility: !!renderState.columnVisibility,
            hasOrder: !!renderState.columnOrder
          });
          if (renderState.columnVisibility && rendererRef.current) {
            rendererRef.current.setColumnVisibility(renderState.columnVisibility);
          }
          if (renderState.columnOrder && rendererRef.current) {
            rendererRef.current.setColumnOrder(renderState.columnOrder);
          }
          
          // Trigger full render to update visible columns
          rendererRef.current!.render(renderState);
          
          // Coordinate updates are handled by the table machine
          return;
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
  }, [tableActor, getChangedRows, extractRenderStateFromActor, onPerformanceUpdate]); // Simplified dependencies
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  const vibeGridXApi = useVibeGridXApi(tableSend, tableState, tableActor, rendererRef);
  
  // ====================================
  // COLUMN VISIBILITY HANDLERS (Pure XState Events)
  // ====================================
  
  // Column visibility handlers
  const handleToggleColumn = useCallback((columnId: string) => {
    vibeGridXApi.toggleColumnVisibility(columnId);
  }, [vibeGridXApi]);
  
  const handleShowAllColumns = useCallback(() => {
    vibeGridXApi.showAllColumns();
  }, [vibeGridXApi]);
  
  const handleHideAllColumns = useCallback(() => {
    vibeGridXApi.hideAllColumns();
  }, [vibeGridXApi]);
  
  // ====================================
  // STATE MACHINE EVENT SUBSCRIPTIONS
  // ====================================
  
  // Selection state sync is now handled by useSelectionStateSync hook
  
  // ====================================
  // DRAG EVENT HANDLERS
  // ====================================
  
  // Attach drag handlers to the viewport after renderer is ready
  useEffect(() => {
    if (!rendererRef.current) return;
    
    // Get the viewport element from the renderer
    const viewport = containerRef.current?.querySelector('.vibegridx-viewport') as HTMLElement;
    if (!viewport) {
      console.warn('VibeGridX: Could not find viewport element for drag handlers');
      return;
    }
    
    // Attach drag event handlers
    viewport.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    console.log('VibeGridX: Attached drag event handlers to viewport');
    
    return () => {
      viewport.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseDown, handleMouseMove, handleMouseUp]);
  
  // ====================================
  // RENDER
  // ====================================
  
  return (
    <div
      className={`vibegridx-container ${className}`}
      style={{ width, height, position: 'relative' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Header with Column Visibility Controls */}
      <VibeGridXHeader
        columns={columns}
        tableActor={tableActor}
        onToggleColumn={handleToggleColumn}
        onShowAll={handleShowAllColumns}
        onHideAll={handleHideAllColumns}
      />
      
      {/* Atomic Renderer Container */}
      <div
        ref={containerRef}
        className="vibegridx-renderer"
        style={{ width: '100%', height: 'calc(100% - 48px)' }} // Subtract header height
      />
      
      {/* Canvas overlay handled by embedded approach in AtomicTableRenderer */}
      
      {/* Legacy Canvas Overlay Container - hidden, kept for backward compatibility */}
      <div
        ref={overlayContainerRef}
        style={{ display: 'none' }}
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