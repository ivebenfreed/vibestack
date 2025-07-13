import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useActorRef } from '@xstate/react';
import { useSelector as useAtomSelector } from '@xstate/store/react';
import { shallowEqual } from '@xstate/store';
import { tableBaseMachine } from './machines/table-machine';
import { 
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
  tableId: string;  // Unique identifier for this table instance (required for persistence)
  entityType?: string;  // Entity type for data operations (optional)
  columns: Column<T>[];  // Required typed columns
  primaryAtom: any; // XState atom for primary data
  relationshipAtoms?: Record<string, any>; // XState atoms for relationship data
  className?: string;
  height?: number;
  width?: number;
  
  
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
    enableSelectionColumn = false,
    primaryAtom,
    relationshipAtoms = {},
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
  } = props;
  
  // CLEAN API: Use useSelector internally for reactive data
  const entities = useAtomSelector(primaryAtom, (atomData) => {
    const values = Object.values(atomData || {});
    // PERFORMANCE FIX: Only log when entity count actually changes
    return values;
  }, shallowEqual);
  
  // Subscribe to relationship atoms and create resolvers
  // We need to dynamically subscribe based on which columns need relationship data
  const relationshipColumns = useMemo(() => {
    return columns.filter(column => {
      const cellType = column.cellType || column.type;
      return cellType?.startsWith('relationship') && column.relationshipTable;
    });
  }, [columns]);
  
  // Subscribe to project atom if needed
  const projectsData = useAtomSelector(
    relationshipColumns.some(col => col.relationshipTable === 'project') ? relationshipAtoms.projects : null,
    (atomData) => atomData || {},
    shallowEqual
  );
  
  // Subscribe to user atom if needed  
  const usersData = useAtomSelector(
    relationshipColumns.some(col => col.relationshipTable === 'assignee' || col.relationshipTable === 'user') ? relationshipAtoms.users : null,
    (atomData) => atomData || {},
    shallowEqual
  );
  
  // Create resolvers based on subscribed data
  const relationshipResolvers = useMemo(() => {
    const resolvers: Record<string, (id: string | string[]) => string> = {};
    
    relationshipColumns.forEach(column => {
      const tableKey = column.relationshipTable!;
      const displayField = column.relationshipDisplayField;
      
      // Create resolver based on the table
      if (tableKey === 'project' && projectsData) {
        resolvers[column.id] = (id: string | string[]) => {
          if (Array.isArray(id)) {
            const names = id.map(i => {
              const entity = projectsData[i];
              return entity ? (entity[displayField || 'name'] || entity.name || i) : i;
            });
            return names.join(', ');
          }
          const entity = projectsData[id];
          return entity ? (entity[displayField || 'name'] || entity.name || id) : id;
        };
      } else if ((tableKey === 'assignee' || tableKey === 'user') && usersData) {
        resolvers[column.id] = (id: string | string[]) => {
          if (Array.isArray(id)) {
            const names = id.map(i => {
              const entity = usersData[i];
              return entity ? (entity[displayField || 'displayName'] || entity.name || i) : i;
            });
            return names.join(', ');
          }
          const entity = usersData[id];
          return entity ? (entity[displayField || 'displayName'] || entity.name || id) : id;
        };
      }
    });
    
    return resolvers;
  }, [relationshipColumns, projectsData, usersData]);
  
  // Track entities length to detect actual changes
  const entitiesLengthRef = useRef(0);
  const shouldLogEntities = entities.length !== entitiesLengthRef.current;
  if (shouldLogEntities) {
    entitiesLengthRef.current = entities.length;
    console.log('VibeGridX: useAtomSelector entity count changed:', { 
      newLength: entities.length,
      firstValue: entities[0]
    });
  }
  
  // ====================================
  // CORE INITIALIZATION - PERFORMANCE OPTIMIZED
  // ====================================
  
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
  
  // Use the stable tableId from props
  const { tableId, entityType } = props;
  
  // No atomConfig needed - we use useSelector internally
  
  // Load persisted state before creating machine config
  const persistenceKey = `vibegridx-${tableId}-state`;
  const persistedData = useMemo(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(persistenceKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          
          // Enhanced logging to show what's being loaded
          console.log('🟢 VibeGridX: LOADING persisted state from localStorage', {
            key: persistenceKey,
            tableId: tableId,
            entityType: entityType,
            snapshotSize: stored.length,
            loadedData: parsed.context,
            timestamp: new Date().toISOString()
          });
          
          // Return the context data for machine initialization
          return parsed.context;
        } else {
          console.log('🟡 VibeGridX: No persisted state found for', persistenceKey);
          return null;
        }
      } catch (error) {
        console.error('🔴 VibeGridX: FAILED to restore persisted state:', error);
        return null;
      }
    }
    return null;
  }, [persistenceKey]);

  // PERFORMANCE FIX: Stabilize machine configuration to prevent recreation
  // Include persisted data in the input configuration (sync machine pattern)
  const machineConfig = useMemo(() => ({
    input: {
      id: tableId,
      entityType: entityType || 'unknown',
      columns: props.columns,
      enableSelectionColumn: enableSelectionColumn,
      entities: entities, // Pass reactive entities directly
      relationshipResolvers: relationshipResolvers, // Pass resolvers for relationship columns
      // Include persisted data in input for context initialization
      persistedData: persistedData,
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
  }), [tableId, entityType, props.columns, enableSelectionColumn, entities, relationshipResolvers, persistedData, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize, height, width]);
  
  // PERFORMANCE: Use useActorRef instead of useMachine to avoid re-renders
  // All actual rendering is done via direct DOM manipulation, not React
  const tableActor = useActorRef(tableBaseMachine, machineConfig);
  const tableSend = tableActor.send;
  
  // Simple entities flow: atoms → machine → view → render
  // PERFORMANCE FIX: Send entities immediately - machine will handle timing
  useEffect(() => {
    if (entities && entities.length > 0) {
      const sendStartTime = performance.now();
      console.log('🚀 VibeGridX: Sending entities to machine for processing:', {
        entityCount: entities.length,
        timestamp: sendStartTime
      });
      tableSend({
        type: 'SET_VISIBLE_ENTITIES',
        entities: entities
      });
    }
  }, [entities.length]); // Only depend on entities, not machine state
  
  // PERFORMANCE: Remove excessive debug logging to reduce useEffect cascade
  
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
  // MINIMAL RENDERER INITIALIZATION
  // ====================================
  
  // PERFORMANCE FIX: Initialize renderer when container is ready
  useEffect(() => {
    if (!containerRef.current) return;
    
    const initStartTime = performance.now();
    console.log('🚀 VibeGridX: Starting renderer initialization:', {
      timestamp: initStartTime
    });
    
    // PERFORMANCE: Minimal initialization - just basics
    const rendererOptions = {
      container: containerRef.current,
      // Don't pass columns during init - wait for properly ordered columns from view actor
      // columns: columns,
      enableSelectionColumn: enableSelectionColumn,
      cellHeight: 40,
      // Add event handlers
      onColumnClick: handleColumnClick,
      onColumnDragStart: handleColumnDragStart,
      // onColumnDragMove: handleColumnDragMove, // Not needed - visual feedback is handled in DOM
      onColumnDragEnd: handleColumnDragEnd,
      onColumnResizeStart: handleColumnResizeStart,
      onColumnResizeMove: handleColumnResizeMove,
      onColumnResizeEnd: handleColumnResizeEnd
    };
    
    (window as any).__vibegridx_renderer_options = rendererOptions;
    
    // Send initialize to machine - it will forward to renderer actor when ready
    console.log('🚀 VibeGridX: Sending INITIALIZE_RENDERER to machine:', {
      timestamp: performance.now()
    });
    tableSend({
      type: 'INITIALIZE_RENDERER',
      options: rendererOptions
    });
    
    return () => {
      delete (window as any).__vibegridx_renderer_options;
    };
  }, []); // Only run once when component mounts
  
  // Selection state sync - REMOVED: Now handled reactively through XState event flow
  // useSelectionStateSync(tableActor, refs);
  
  // PERFORMANCE: Removed unnecessary useEffects - relationship data and global dispatchers spawn as needed
  
  // PERFORMANCE: Removed massive XState event listeners useEffect - events handled as needed
    
  
  // ====================================
  // PERFORMANCE MONITORING
  // ====================================
  
  // Performance metrics are reported inline after renders to avoid dependency issues
  
  // ====================================
  // STATE-TO-RENDERER SYNC
  // ====================================
  
  // ====================================
  // MINIMAL REACT SHELL - NO STATE WATCHING
  // ====================================
  // 
  // This component is just a container shell. All actual rendering
  // is handled by AtomicTableRenderer (direct DOM) and CanvasOverlay (Konva).
  // No React re-renders needed after initial mount.
  
  // Track container attachment
  useEffect(() => {
    if (containerRef.current) {
      console.log('🎯 VibeGridX: Container ref attached', {
        container: containerRef.current,
        timestamp: performance.now()
      });
    }
  }, []);
  
  // No state watching needed - machine handles all rendering internally
  
  // ====================================
  // PUBLIC API
  // ====================================
  
  const vibeGridXApi = useVibeGridXApi(tableSend, null, tableActor, rendererRef);
  
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
    // Attach handlers after short delay to allow renderer to create viewport
    
    // PERFORMANCE FIX: Use a ref to prevent duplicate event handler attachment
    let attached = false;
    
    const attachHandlers = (viewport: HTMLElement) => {
      if (attached) return; // Prevent duplicates
      
      viewport.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      attached = true;
    };
    
    // Get the viewport element from the container
    const viewport = containerRef.current?.querySelector('.vibegridx-viewport') as HTMLElement;
    if (!viewport) {
      // Renderer might not have created viewport yet, wait a bit
      const timer = setTimeout(() => {
        const viewport = containerRef.current?.querySelector('.vibegridx-viewport') as HTMLElement;
        if (viewport) {
          attachHandlers(viewport);
        }
      }, 100);
      
      return () => clearTimeout(timer);
    }
    
    attachHandlers(viewport);
    
    return () => {
      if (attached) {
        viewport.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      }
    };
  }, []); // Only run once on mount
  
  // ====================================
  // RENDER
  // ====================================
  
  // DEBUG: Track rendering - should only happen on prop changes, not XState transitions
  console.log('🎯 VibeGridX: Rendering component (container shell only)', {
    hasEntities: entities.length > 0,
    entitiesLength: entities.length,
    renderReason: 'prop_change_or_mount',
    timestamp: performance.now()
  });

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