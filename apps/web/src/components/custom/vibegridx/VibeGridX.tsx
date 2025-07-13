import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine, useSelector } from '@xstate/react';
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
  entityType: string;  // Any entity type, not just hardcoded ones
  columns: Column<T>[];  // Required typed columns
  primaryAtom: any; // XState atom for primary data
  relationshipAtoms?: Record<string, any>; // XState atoms for relationship data
  tableId?: string;
  className?: string;
  height?: number;
  width?: number;
  
  // Optional relationship data
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
  
  // PERFORMANCE FIX: Generate stable table ID that persists across renders
  const tableId = useMemo(() => `vibegridx-${props.entityType}-${Math.random().toString(36).substring(2, 9)}`, [props.entityType]);
  
  // No atomConfig needed - we use useSelector internally
  
  // PERFORMANCE FIX: Stabilize machine configuration to prevent recreation
  const machineConfig = useMemo(() => ({
    input: {
      id: tableId,
      entityType: props.entityType,
      columns: props.columns,
      enableSelectionColumn: enableSelectionColumn,
      entities: entities, // Pass reactive entities directly
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
  }), [tableId, props.entityType, props.columns, enableSelectionColumn, entities, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize, height, width]);

  // Create machine with stable configuration
  const [tableState, tableSend, tableActor] = useMachine(tableBaseMachine, machineConfig);
  
  // Simple entities flow: atoms → machine → view → render
  // PERFORMANCE FIX: Only send entities once when machine is active
  const entitiesSentRef = useRef(false);
  useEffect(() => {
    const isActive = tableState?.value && typeof tableState.value === 'object';
    
    if (entities && entities.length > 0 && !entitiesSentRef.current && isActive) {
      console.log('VibeGridX: Sending entities to machine for processing:', entities.length);
      tableSend({
        type: 'SET_VISIBLE_ENTITIES',
        entities: entities
      });
      entitiesSentRef.current = true;
    }
  }, [entities.length, tableState?.value]); // Need state dependency to know when active
  
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
  
  // PERFORMANCE FIX: Minimal initialization - just send INITIALIZE when ready
  useEffect(() => {
    if (!containerRef.current || !tableState?.context?.actors?.rendererActor) return;
    
    // PERFORMANCE: Minimal initialization - just basics
    const rendererOptions = {
      container: containerRef.current,
      columns: columns,
      enableSelectionColumn: enableSelectionColumn,
      cellHeight: 40
    };
    
    (window as any).__vibegridx_renderer_options = rendererOptions;
    
    tableState.context.actors.rendererActor.send({
      type: 'INITIALIZE',
      options: rendererOptions
    });
    
    return () => {
      delete (window as any).__vibegridx_renderer_options;
    };
  }, [tableState?.context?.actors?.rendererActor]);
  
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
  // XSTATE V5 PATTERN - USE USESELECTOR FOR STATE TRACKING
  // ====================================
  
  // PERFORMANCE FIX: Stabilize useSelector to prevent infinite re-renders
  const renderTrigger = useSelector(tableActor, (snapshot) => {
    const version = snapshot.context?.version || 0;
    const hasProcessedRows = snapshot.context?.rows && snapshot.context.rows.length > 0;
    const machineState = snapshot.value;
    
    // Only return stable references to prevent infinite re-renders
    return {
      version,
      hasProcessedRows,
      machineState
    };
  }, (prev, next) => {
    // Strict comparison - prevent cascading updates
    return prev.version === next.version && 
           prev.hasProcessedRows === next.hasProcessedRows && 
           prev.machineState === next.machineState;
  });
  
  // Track previous version to detect changes
  const previousVersionRef = useRef<number | undefined>();
  
  // PERFORMANCE FIX: Table machine now handles all rendering
  // This useEffect is only for tracking version changes and canvas updates
  useEffect(() => {
    if (!renderTrigger.hasProcessedRows || renderTrigger.machineState === 'initializing') {
      return;
    }
    
    const currentVersion = renderTrigger.version;
    const isFirstRender = previousVersionRef.current === undefined;
    
    // Skip if no version change (unless first render)
    if (!isFirstRender && previousVersionRef.current === currentVersion) {
      return;
    }
    
    previousVersionRef.current = currentVersion;
    
    // NOTE: Rendering is now handled entirely by the table machine in processingViewData.onDone
    // This component only needs to track version changes
    
    // Update canvas overlay if needed (legacy support)
    const snapshot = tableActor.getSnapshot();
    if (snapshot.context?.editingCell && canvasOverlayRef.current) {
      canvasOverlayRef.current.updateEditingCell(snapshot.context.editingCell);
    }
  }, [renderTrigger.version, renderTrigger.hasProcessedRows, renderTrigger.machineState]); // FIXED: Stable primitive dependencies only
  
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
    // Wait for renderer to be ready
    if (tableState?.value === 'initializing') return;
    
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
  }, [tableState?.value]);
  
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