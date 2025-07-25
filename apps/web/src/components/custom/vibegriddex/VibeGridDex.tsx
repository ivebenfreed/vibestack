import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useActorRef, useSelector } from '@xstate/react';
// useLiveQuery removed - handled by XState store
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

// Store-based architecture removed - using direct Dexie subscriptions in XState

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
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 VibeGridDex: Preparing preloaded data', {
          entityCount: entities.length,
          relationshipDataKeys: Object.keys(relationshipData),
          hasRelationshipData: Object.keys(relationshipData).length > 0,
          initialDataKeys: Object.keys(props.initialData),
          // Debug: Show the actual structure
          initialDataStructure: props.initialData,
          relationshipDataExtracted: relationshipData
        });
      }
      
      return { entities, relationshipData };
    }
    return null;
  }, [props.initialData]);
  
  // Store will be created by XState machine - no React hooks needed
  
  // Apply defaults to columns - relationship providers will be added by the table machine
  const columnsWithDefaults = useMemo(() => {
    return applyColumnDefaults(props.columns);
  }, [props.columns]);
  
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
  const loadedPersistedDataRef = useRef<boolean>(false);
  
  // Store the loaded persisted data in a ref to survive re-renders
  const persistedDataRef = useRef<any>(undefined);
  
  const persistedData = useMemo(() => {
    // If we already have data in the ref, return it
    if (persistedDataRef.current !== undefined) {
      return persistedDataRef.current;
    }
    
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(persistenceKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          
          // Store in ref for future renders
          persistedDataRef.current = parsed.context;
          
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.log('🟢 VibeGridX: LOADING persisted state from localStorage', {
              key: persistenceKey,
              tableId: tableId,
              entityType: entityType,
              snapshotSize: stored.length,
              loadedData: parsed.context,
              hasContext: 'context' in parsed,
              timestamp: new Date().toISOString()
            });
          }
          
          // Return the context data for machine initialization
          return parsed.context;
        } else {
          // Mark as null so we don't try to load again
          persistedDataRef.current = null;
          
          if (process.env.NODE_ENV === 'development') {
            console.log('🟡 VibeGridX: No persisted state found for', persistenceKey);
          }
          return null;
        }
      } catch (error) {
        // Mark as null so we don't try to load again
        persistedDataRef.current = null;
        console.error('🔴 VibeGridX: FAILED to restore persisted state:', error);
        return null;
      }
    }
    persistedDataRef.current = null;
    return null;
  }, [persistenceKey]); // Depend on persistenceKey only

  // SIMPLIFIED - Store provides all data
  const columns = columnsWithDefaults;
  
  // Store debugging removed - store created by XState machine
  

  // Create machine configuration - XState will create store internally
  const machineConfig = useMemo(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 VibeGridDex: Creating machine config', {
        entityType: entityType,
        columnCount: columns.length,
        tableId: tableId
      });
    }
    
    return {
      input: {
        id: tableId,
        entityType: entityType,
        columns: columns,
        enableSelectionColumn: enableSelectionColumn,
        entities: [], // Start empty - store will populate via liveQuery
        persistedData: persistedData,
        relationshipResolvers: {}, // Store will handle relationships
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
  }, [tableId, entityType, columns, enableSelectionColumn, persistedData, height, width, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize]);
  
  // Create table actor with the machine config
  const tableActor = useActorRef(tableBaseMachine, machineConfig);
  const tableSend = tableActor.send;
  
  // The table machine handles persistence internally via persistSnapshot action
  // No need for duplicate persistence logic here
  
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
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 VibeGridX: Container attached, initializing renderer synchronously:', {
          timestamp: initStartTime
        });
      }
      
      const optionsWithContainer = {
        ...pendingRendererOptionsRef.current,
        container: node
      };
      
      (window as any).__vibegridx_renderer_options = optionsWithContainer;
      
      if (process.env.NODE_ENV === 'development') {
        console.log('🚀 VibeGridX: Sending INITIALIZE_RENDERER synchronously:', {
          timestamp: performance.now()
        });
      }
      // Defer renderer initialization to avoid blocking React's batching
      requestAnimationFrame(() => {
        tableSend({
          type: 'INITIALIZE_RENDERER',
          options: optionsWithContainer
        });
        
        rendererInitializedRef.current = true;
      });
    }
    
    containerRef.current = node;
  }, [tableSend]);

  // Cleanup window variable on unmount and clean up EditingOverlay
  useEffect(() => {
    return () => {
      delete (window as any).__vibegridx_renderer_options;
      
      // Cleanup store if exists
      if ((window as any).__vibegridx_store_cleanup) {
        (window as any).__vibegridx_store_cleanup();
        delete (window as any).__vibegridx_store_cleanup;
      }
      
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
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🎯 VibeGridX: Initializing unified event system');
    }
    
    const delegationConfig: EventDelegationConfig = {
      container: containerRef.current,
      tableSend,
      // Provide a getter to always get the current tableSend
      getTableSend: () => tableActor.send
    };
    
    const delegationManager = new EventDelegationManager(delegationConfig);
    eventDelegationManagerRef.current = delegationManager;
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ VibeGridX: Unified event system active');
    }
    
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

  // Check if we have columns (store will be created by XState)
  if (columns.length === 0) {
    console.log('VibeGridDex: Waiting for columns', {
      columnCount: columns.length
    });
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading...
      </div>
    );
  }

  // DEBUG: Track rendering - should only happen on prop changes, not XState transitions
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 VibeGridX: Rendering component (container shell only)', {
      entityType: entityType,
      renderReason: 'prop_change_or_mount',
      timestamp: performance.now()
    });
  }

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

// Suspense wrapper components removed - XState handles data loading directly

// ====================================
// EXPORTS
// ====================================

// Export the main component (without Suspense for backward compatibility)
export default VibeGridDex;

// Export types for external use
export type { VibeGridDexProps };

// Re-export the hook from VibeGridXHooks
// export { useVibeGridXRef } from './VibeGridXHooks';