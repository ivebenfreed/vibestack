import React, { useEffect, useRef, useCallback, useMemo } from 'react';
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
import type { EntityIntegrationLayer } from './integration/EntityIntegration';
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
  const integrationRef = useRef<EntityIntegrationLayer | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const anchorCellRef = useRef<CellRef | null>(null);
  const subscriptionRef = useRef<any>(null);
  const coordinateManagerRef = useRef<VibeGridXCoordinateManager | null>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>({ isDragging: false, startCell: null, startPos: null });
  
  // ====================================
  // CORE INITIALIZATION
  // ====================================
  
  const { tableConfig, tableId } = useTableConfiguration(props);
  const { tableState, tableSend, tableActor } = useTableMachine(tableConfig);
  
  // Initialize coordinate manager once
  useEffect(() => {
    if (!coordinateManagerRef.current && tableActor) {
      coordinateManagerRef.current = createVibeGridXCoordinateManager();
      console.log('VibeGridX: Coordinate manager created');
      
      // Immediately send coordinate manager to selection coordinator
      tableSend({
        type: 'COORDINATE_MANAGER_SET',
        coordinateManager: coordinateManagerRef.current
      });
      
      // Initialize with columns if available
      if (columns.length > 0) {
        coordinateManagerRef.current.updateColumns(columns);
      }
      
      // Set up coordinate change listener
      const unsubscribe = coordinateManagerRef.current.subscribe((event) => {
        console.log('VibeGridX: Coordinate mapping changed:', event.type);
        
        // Notify selection coordinator when coordinates change
        tableSend({
          type: 'COORDINATE_MAPPING_CHANGED'
        });
      });
      
      // Store unsubscribe function
      return unsubscribe;
    }
  }, [tableSend, tableActor, columns]);
  
  // Refs object for event handlers
  const refs: InitializationRefs & { columns: Column[]; coordinateManagerRef: React.RefObject<VibeGridXCoordinateManager | null> } = {
    containerRef,
    overlayContainerRef,
    rendererRef,
    canvasOverlayRef,
    integrationRef,
    selectedCellsRef,
    anchorCellRef,
    subscriptionRef,
    dragStateRef,
    coordinateManagerRef,
    columns
  };
  
  // Entity integration (pass columns)
  useEntityIntegration(tableActor, props.entityType, integrationRef, columns);
  
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
    columns: tableConfig.columns,
    relationshipData: relationshipData,
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
      
      // Get the value from the first original cell to use for filling
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
    
    // XState v5 proper subscription pattern - listen to all state changes
    const subscription = tableActor.subscribe((snapshot) => {
      subscriptionCount++;
      
      // Only log significant state changes
      const stateValue = snapshot.value;
      const version = snapshot.context?.version;
      
      // Check if this is a meaningful change that requires re-render
      const viewCoordinatorSnapshot = snapshot.context.actors?.viewCoordinator?.getSnapshot();
      const currentSortState = viewCoordinatorSnapshot?.context?.sortBy;
      const lastSortState = (window as any).__vibegridx_last_sortstate;
      const sortChanged = JSON.stringify(currentSortState) !== JSON.stringify(lastSortState);
      
      const currentColumnVisibility = viewCoordinatorSnapshot?.context?.columnVisibility;
      const lastColumnVisibility = (window as any).__vibegridx_last_columnvisibility;
      const columnVisibilityChanged = JSON.stringify(currentColumnVisibility) !== JSON.stringify(lastColumnVisibility);
      
      const currentColumnOrder = viewCoordinatorSnapshot?.context?.columnOrder;
      const lastColumnOrder = (window as any).__vibegridx_last_columnorder;
      const columnOrderChanged = JSON.stringify(currentColumnOrder) !== JSON.stringify(lastColumnOrder);
      
      if (sortChanged) {
        console.log('VibeGridX: Sort state changed:', currentSortState);
        (window as any).__vibegridx_last_sortstate = currentSortState;
      }
      
      if (columnVisibilityChanged) {
        console.log('VibeGridX: Column visibility changed:', currentColumnVisibility);
        (window as any).__vibegridx_last_columnvisibility = currentColumnVisibility;
      }
      
      if (columnOrderChanged) {
        console.log('VibeGridX: Column order changed:', currentColumnOrder);
        (window as any).__vibegridx_last_columnorder = currentColumnOrder;
      }
      
      // Check if dimensions changed (e.g., column resize)
      const currentVersion = snapshot.context?.version;
      const lastVersion = (window as any).__vibegridx_last_version;
      const dimensionsChanged = currentVersion !== lastVersion && !sortChanged && !columnVisibilityChanged && !columnOrderChanged;
      if (dimensionsChanged) {
        console.log('VibeGridX: Dimensions changed, version:', currentVersion);
        (window as any).__vibegridx_last_version = currentVersion;
      }
      
      // Skip if only selection changed (no data, sort, column visibility, column order, or dimension changes)
      const isDataChange = hasDataChanged(snapshot);
      
      if (!isDataChange && !sortChanged && !columnVisibilityChanged && !columnOrderChanged && !dimensionsChanged) {
        // Skip expensive processing for selection-only changes
        return;
      }
      
      console.log('VibeGridX: Processing data change:', {
        state: stateValue,
        version: version
      });
      
      const renderState = extractRenderStateFromActor(snapshot);
      if (renderState) {
        // Store last render state for canvas initialization
        (window as any).__vibegridx_last_renderstate = renderState;
        
        // Update coordinate manager and canvas overlay with data mappings
        if (renderState.rows.length > 0 && coordinateManagerRef.current) {
          const sortBy = (snapshot.context.actors?.viewCoordinator?.getSnapshot()?.context?.sortBy) || [];
          
          // IMPORTANT: We need to use the SAME sorted order that the renderer will use
          // The renderer applies its own sorting, so we need to match that exactly
          let sortedRows = renderState.rows;
          if (sortBy.length > 0) {
            // Apply the same sorting logic as AtomicTableRenderer
            sortedRows = [...renderState.rows].sort((a, b) => {
              for (const sort of sortBy) {
                const aValue = a.data[sort.field];
                const bValue = b.data[sort.field];
                
                if (aValue === bValue) continue;
                
                let comparison = 0;
                
                if (aValue == null && bValue == null) {
                  comparison = 0;
                } else if (aValue == null) {
                  comparison = 1; // null values go to the end
                } else if (bValue == null) {
                  comparison = -1;
                } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                  comparison = aValue - bValue;
                } else if (aValue instanceof Date && bValue instanceof Date) {
                  comparison = aValue.getTime() - bValue.getTime();
                } else {
                  comparison = String(aValue).localeCompare(String(bValue));
                }
                
                if (comparison !== 0) {
                  return sort.direction === 'desc' ? -comparison : comparison;
                }
              }
              return 0;
            });
          }
          
          // Update coordinate manager with the SAME sorted data the renderer will use
          coordinateManagerRef.current.updateRows(sortedRows, sortBy);
          coordinateManagerRef.current.updateColumns(columns);
          
          console.log('VibeGridX: Updated coordinate manager', { 
            rowCount: sortedRows.length,
            columnCount: columns.length,
            sortBy: sortBy,
            firstRowId: sortedRows[0]?.id,
            lastRowId: sortedRows[sortedRows.length - 1]?.id
          });
          
          // Notify selection coordinator of coordinate mapping changes
          tableSend({
            type: 'COORDINATE_MANAGER_SET',
            coordinateManager: coordinateManagerRef.current
          });
          
          // Update canvas overlay with sorted row IDs in the correct order
          if (canvasOverlayRef.current) {
            const sortedRowIds = sortedRows.map(row => row.id);
            const columnIds = coordinateManagerRef.current.getColumnIds();
            
            console.log('VibeGridX: Updating canvas data mappings', { 
              sortedRowCount: sortedRowIds.length,
              visibleRowCount: sortedRows.length,
              columnCount: columnIds.length,
              firstRowId: sortedRowIds[0],
              lastRowId: sortedRowIds[sortedRowIds.length - 1]
            });
            
            // Update coordinate system with sorted rows so overlay positions match table
            canvasOverlayRef.current.updateDataMappings(sortedRowIds, columnIds);
          }
        }
        
        // HYBRID RENDERING: Only process data changes
        
        // 1. Data changes - use granular updates
        const { changedRows, newRows, deletedRowIds, isStructuralChange } = getChangedRows(renderState);
        
        if (isStructuralChange || sortChanged || dimensionsChanged) {
          // Structural changes, sort changes, or dimension changes need full re-render
          const reason = sortChanged ? 'SORT CHANGE' : dimensionsChanged ? 'DIMENSION CHANGE' : 'STRUCTURAL CHANGE';
          console.log(`VibeGridX: ${reason} - Full table re-render (${newRows.length} new, ${deletedRowIds.length} deleted, ${renderState.rows.length} total)`);
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
        } else if (columnVisibilityChanged || columnOrderChanged) {
          // Column visibility or order changes only need renderer column update (no coordinate manager updates)
          console.log('VibeGridX: COLUMN CHANGE - Lightweight renderer update', {
            visibilityChanged: columnVisibilityChanged,
            orderChanged: columnOrderChanged
          });
          if (renderState.columnVisibility && rendererRef.current) {
            rendererRef.current.setColumnVisibility(renderState.columnVisibility);
          }
          if (renderState.columnOrder && rendererRef.current) {
            rendererRef.current.setColumnOrder(renderState.columnOrder);
          }
          // Skip expensive coordinate manager and canvas updates
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
  }, [tableActor, hasDataChanged, getChangedRows, extractRenderStateFromActor, onPerformanceUpdate]); // Add all dependencies
  
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
      
      {/* Canvas Overlay Container will be created inside the viewport by AtomicTableRenderer */}
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