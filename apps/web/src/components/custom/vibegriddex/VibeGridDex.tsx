import React, { useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tableBaseMachine } from './machines/table-machine';
import { toast } from 'sonner';
import { 
  type InitializationRefs 
} from './VibeGridXCore';
// PortalCanvasOverlayProvider removed - using embedded canvas approach
// Legacy event handlers removed - using unified EventDelegationManager only
import { EventDelegationManager, type EventDelegationConfig } from './systems/EventDelegationManager';
import {
  useChangeDetection,
  useRenderStateExtractor,
  useVibeGridXApi
} from './VibeGridXHooks';
import type { RenderState, TableRow, CellRef, Column, RelationshipOptionsProviders } from './types';
import type { TableRenderer } from './renderers/core/TableRenderer';
import { CanvasOverlay } from './overlays/CanvasOverlay';
import { createVibeGridXCoordinateManager, type VibeGridXCoordinateManager } from './coordinates/VibeGridXCoordinateManager';
import { VibeGridXHeader } from './components/VibeGridXHeader';
import './vibegridx.css';

// Import Dexie domain services and queries
import * as dexieDomains from '@/domain';

// Import provider utilities
import type { RelationshipOptionsProvider } from './types';
import { createGenericRelationshipProvider } from './providers/generic-relationship-provider-dexie';
// Entity type for VibeGrid
type VibeGridXEntityType = 'task' | 'project' | 'user' | 'comment';
import { applyColumnDefaults } from './column-defaults';
import { addRelationshipProvidersToColumns } from './providers/relationship-provider-factory';

// Import store-based architecture  
import { useTableData } from './hooks/useTableData';
import { TableSkeleton } from './components/TableSkeleton';

// ====================================
// COMPONENT PROPS
// ====================================

// Unified configuration - always entity-based with optional manual columns
interface VibeGridDexProps<T = any> {
  tableId: string;  // Unique identifier for this table instance (required for persistence)
  entityType: VibeGridXEntityType;  // Entity type (required - determines data source)
  
  // Column configuration (required - no more auto-generation)
  columns: Column<T>[];  // Explicit columns with type checking
  
  // Common options
  className?: string;
  height?: number | string;
  width?: number | string;
  
  // Initial data from route loader (for synchronous rendering)
  initialData?: {
    processedRows: any[];
    visibleColumns: Column[];
    coordinateMapping: any;
    relationshipData?: Record<string, any>;
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
  };
  
  // Relationship options providers (optional - auto-generated if not provided)
  relationshipOptionsProviders?: RelationshipOptionsProviders;
  
  // Event handlers (all optional - entity config provides defaults)
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
  onBatchEntityUpdate?: (updates: Array<{ id: string; updates: Record<string, any> }>) => Promise<void> | void;
  
  // Performance options
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  
  // Feature flags
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
  enableSelectionColumn?: boolean;
}

// ====================================
// MAIN COMPONENT
// ====================================

export function VibeGridDex<T extends Record<string, any> = any>(
  props: VibeGridDexProps<T>
): React.ReactElement {
  // ====================================
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // ====================================
  
  // Prepare preloaded data if we have initialData from the loader
  const preloadedData = useMemo(() => {
    if (props.initialData && props.initialData.processedRows) {
      // Extract entities from processed rows
      const entities = props.initialData.processedRows.map(row => row.data);
      
      // Get relationship data from initialData
      const relationshipData = (props.initialData as any).relationshipData || {};
      
      console.log('🔍 VibeGridDex: Preparing preloaded data', {
        entityCount: entities.length,
        relationshipDataKeys: Object.keys(relationshipData),
        hasRelationshipData: Object.keys(relationshipData).length > 0,
        initialDataKeys: Object.keys(props.initialData),
        // Debug: Show the actual structure
        initialDataStructure: props.initialData,
        relationshipDataExtracted: relationshipData
      });
      
      return { entities, relationshipData };
    }
    return null;
  }, [props.initialData]);
  
  // Get store first - entities will come from store subscription in table machine
  const store = (props as any).store;
  
  // Apply defaults to columns and add relationship providers
  const columnsWithDefaults = useMemo(() => {
    const withDefaults = applyColumnDefaults(props.columns);
    // Add relationship providers that read from the store
    return addRelationshipProvidersToColumns(withDefaults, () => store);
  }, [props.columns, store]);
  
  // REMOVED - Store provides all data
  // const dexieEntityConfig = useDexieEntityConfig(
  //   props.entityType,
  //   columnsWithDefaults,
  //   preloadedData
  // );
  
  // ====================================
  // REFS AND STATE - MUST BE DECLARED BEFORE ANY RETURNS
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlay | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const anchorCellRef = useRef<CellRef | null>(null);
  const subscriptionRef = useRef<any>(null);
  const dragStateRef = useRef<{
    isDragging: boolean;
    startCell: CellRef | null;
    startPos: { x: number; y: number } | null;
  }>({ isDragging: false, startCell: null, startPos: null });
  
  const eventDelegationManagerRef = useRef<EventDelegationManager | null>(null);
  const entitiesSentRef = useRef(false);
  const rendererInitializedRef = useRef(false);
  const pendingRendererOptionsRef = useRef<any>(null);

  // Extract common props early
  const {
    className = '',
    height = 600,
    width = '100%',
    enableSelectionColumn = false,
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
    initialData,
    enableVirtualScrolling,
    enableCanvasOverlays,
    bufferSize,
    enableGrouping,
    enableFiltering,
    enableSorting,
    enableDragAndDrop,
  } = props;

  // Use the stable tableId and entityType from props
  const { tableId, entityType } = props;
  
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
  }, [persistenceKey, tableId, entityType]);

  // SIMPLIFIED - Store provides all data
  const columns = columnsWithDefaults;
  
  console.log('🔍 VibeGridDex: Store debugging', {
    hasStore: !!store,
    storeType: typeof store,
    storeState: store?.getSnapshot?.()?.status,
    storeContext: store?.getSnapshot?.()?.context ? 'present' : 'missing',
    propsKeys: Object.keys(props),
    hasStoreInProps: 'store' in props
  });
  

  // Create machine configuration - SIMPLIFIED for store architecture
  const machineConfig = useMemo(() => {
    console.log('🔍 VibeGridDex: Creating machine config with store', {
      hasStore: !!store,
      storeType: typeof store,
      storeActorState: store?.getSnapshot?.()?.status,
      storeEntityCount: store?.getSnapshot?.()?.context?.entities ? Object.keys(store.getSnapshot().context.entities).length : 0,
      columnCount: columns.length,
      startingWithEmptyEntities: true
    });
    
    // Store actor in window for table machine to access
    if (store) {
      (window as any).__vibegridx_store_actor = store;
    }
    
    return {
      input: {
        id: tableId,
        entityType: entityType,
        columns: columns,
        enableSelectionColumn: enableSelectionColumn,
        entities: [], // Start empty - store subscription will populate
        persistedData: persistedData,
        relationshipResolvers: {}, // NOT NEEDED - store has resolved data
        storeActor: store, // Store subscription will provide entities
        onEntityUpdate: props.onEntityUpdate, // Pass update handler from props
        onBatchEntityUpdate: props.onBatchEntityUpdate, // Pass batch update handler from props
        onNotification: (message: string, type: 'info' | 'warning' | 'error' | 'success') => {
          // Show toast notification
          toast[type](message);
        },
        settings: {
          enableVirtualScrolling: props.enableVirtualScrolling ?? true,
          enableGrouping: props.enableGrouping ?? true,
          enableFiltering: props.enableFiltering ?? true,
          bufferSize: props.bufferSize ?? 10,
          initialViewport: {
            start: 0,
            end: Math.ceil((typeof height === 'number' ? height : 600) / 40),
            height: typeof height === 'number' ? height : 600,
            width: typeof width === 'number' ? width : Math.min(800, window.innerWidth - 32),
            scrollTop: 0,
            scrollLeft: 0,
            itemHeight: 40
          }
        }
      }
    };
  }, [tableId, entityType, columns, enableSelectionColumn, persistedData, height, width, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize, store]);
  
  // Create table actor with the machine config
  const tableActor = useActorRef(tableBaseMachine, machineConfig);
  const tableSend = tableActor.send;
  
  // Create renderer options
  const rendererOptions = useMemo(() => ({
    enableSelectionColumn: enableSelectionColumn,
    cellHeight: 40,
    onStateChange: (event: any) => {
      if (event.type === 'render.complete') {
        if (event.renderTime > 100) {
          console.warn('Slow render detected:', event);
        }
      }
    }
  }), [enableSelectionColumn]);
  
  // Store pending options for when container is ready
  pendingRendererOptionsRef.current = rendererOptions;
  
  // Initialize renderer when container is attached
  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node && !rendererInitializedRef.current) {
      const initStartTime = performance.now();
      console.log('🚀 VibeGridX: Container attached, initializing renderer synchronously:', {
        timestamp: initStartTime
      });
      
      const optionsWithContainer = {
        ...pendingRendererOptionsRef.current,
        container: node
      };
      
      (window as any).__vibegridx_renderer_options = optionsWithContainer;
      
      console.log('🚀 VibeGridX: Sending INITIALIZE_RENDERER synchronously:', {
        timestamp: performance.now()
      });
      tableSend({
        type: 'INITIALIZE_RENDERER',
        options: optionsWithContainer
      });
      
      rendererInitializedRef.current = true;
    }
    
    containerRef.current = node;
  }, [tableSend]);

  // Cleanup window variable on unmount and clean up EditingOverlay
  useEffect(() => {
    return () => {
      delete (window as any).__vibegridx_renderer_options;
      delete (window as any).__vibegridx_store_actor;
      
      // Import and call cleanupEditingOverlay to ensure global overlay is cleaned up
      import('./machines/table-machine/event-handlers/edit-handlers').then(({ cleanupEditingOverlay }) => {
        cleanupEditingOverlay();
        console.log('VibeGridDex: Cleaned up EditingOverlay on unmount');
      });
    };
  }, []);

  // Setup unified event handling system
  useEffect(() => {
    if (!containerRef.current) return;
    
    console.log('🎯 VibeGridX: Initializing unified event system');
    
    const delegationConfig: EventDelegationConfig = {
      container: containerRef.current,
      tableSend,
      // Provide a getter to always get the current tableSend
      getTableSend: () => tableActor.send
    };
    
    const delegationManager = new EventDelegationManager(delegationConfig);
    eventDelegationManagerRef.current = delegationManager;
    
    console.log('✅ VibeGridX: Unified event system active');
    
    return () => {
      if (eventDelegationManagerRef.current) {
        eventDelegationManagerRef.current.destroy();
        eventDelegationManagerRef.current = null;
      }
    };
  }, [tableSend, tableActor]);

  // Create public API
  const vibeGridXApi = useVibeGridXApi(tableSend, null, tableActor, rendererRef);
  
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

  // Entities come from store subscription - no need to send manually

  // ====================================
  // CONDITIONAL RENDERING - ALL HOOKS HAVE BEEN CALLED ABOVE
  // ====================================

  // Check if we have store and columns
  if (!store || columns.length === 0) {
    console.log('VibeGridDex: Waiting for store and columns', {
      hasStore: !!store,
      columnCount: columns.length
    });
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  // DEBUG: Track rendering - should only happen on prop changes, not XState transitions
  console.log('🎯 VibeGridX: Rendering component (container shell only)', {
    hasStore: !!store,
    renderReason: 'prop_change_or_mount',
    timestamp: performance.now()
  });

  return (
    <div
      className={`vibegridx-container ${className}`}
      style={{ 
        width, 
        height, 
        position: 'relative',
        outline: 'none' // Remove focus outline that can cause scroll
      }}
      // tabIndex removed - EventDelegationManager handles focus on renderer container
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
        ref={containerRefCallback}
        className="vibegridx-renderer"
        style={{ width: '100%', height: 'calc(100% - 48px)' }} // Subtract header height
      />
      
      {/* Canvas overlay handled by embedded approach in TableRenderer */}
      
      {/* Legacy Canvas Overlay Container - hidden, kept for backward compatibility */}
      <div
        ref={overlayContainerRef}
        style={{ display: 'none' }}
      />
    </div>
  );
}

// ====================================
// SUSPENSE WRAPPER COMPONENT
// ====================================

/**
 * Inner component that uses the Suspense data hook
 */
function VibeGridDexInner<T extends Record<string, any> = any>(
  props: VibeGridDexProps<T> & { store: any }
): React.ReactElement {
  // Call the original VibeGridDex with store data
  return <VibeGridDex {...props} />;
}

/**
 * Wrapper component that provides Suspense boundary
 */
export function VibeGridDexWithSuspense<T extends Record<string, any> = any>(
  props: VibeGridDexProps<T>
): React.ReactElement {
  const { columns: columnCount } = props;
  
  return (
    <Suspense fallback={<TableSkeleton columns={columnCount?.length || 5} />}>
      <VibeGridDexSuspenseLoader {...props} />
    </Suspense>
  );
}

/**
 * Component that loads data with Suspense
 */
function VibeGridDexSuspenseLoader<T extends Record<string, any> = any>(
  props: VibeGridDexProps<T>
): React.ReactElement {
  // This hook suspends until data is ready
  const { store } = useTableData(props.entityType, props.columns);
  
  // Pass store to inner component - store contains all data
  return (
    <VibeGridDexInner 
      {...props} 
      store={store}
    />
  );
}

// ====================================
// EXPORTS
// ====================================

// Export the main component (without Suspense for backward compatibility)
export default VibeGridDex;

// Export types for external use
export type { VibeGridDexProps };

// Re-export the hook from VibeGridXHooks
// export { useVibeGridXRef } from './VibeGridXHooks';