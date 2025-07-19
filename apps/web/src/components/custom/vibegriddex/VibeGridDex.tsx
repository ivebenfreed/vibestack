import React, { useEffect, useRef, useCallback, useMemo, lazy } from 'react';
import { useActorRef } from '@xstate/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { tableBaseMachine } from './machines/table-machine';
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
import { syncProcessView } from './utils/syncViewProcessor';
import './vibegridx.css';

// Import entity configurations from DataForge
import { 
  getEntityConfig, 
  VIBEGRIDX_ENTITY_CONFIGS,
  type VibeGridXEntityType,
  type VibeGridXEntityConfig
} from '@repo/dataforge/vibegridx-columns';

// Import Dexie domain services and queries
import * as dexieDomains from '@/domain-dexie';

// Import provider utilities
import type { RelationshipOptionsProvider } from './types';
import { createGenericRelationshipProvider } from './providers/generic-relationship-provider-dexie';
import { useDexieEntityConfig } from './hooks/useDexieEntityConfig';

// ====================================
// COMPONENT PROPS
// ====================================

// Entity-based configuration (recommended)
interface VibeGridDexEntityProps<T = any> {
  tableId: string;  // Unique identifier for this table instance (required for persistence)
  entityType: VibeGridXEntityType;  // Entity type for auto-configuration
  selectedColumns?: string[]; // Column IDs to include (optional - defaults to all)
  
  // Common options
  className?: string;
  height?: number | string;
  width?: number | string;
  
  // Initial data from route loader (for synchronous rendering)
  initialData?: {
    processedRows: any[];
    visibleColumns: Column[];
    coordinateMapping: any;
  };
  
  // Relationship options providers (optional - auto-generated if not provided)
  relationshipOptionsProviders?: RelationshipOptionsProviders;
  
  // Event handlers (all optional - entity config provides defaults)
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
  enableSelectionColumn?: boolean;
}

// Manual configuration (for custom use cases)
interface VibeGridDexManualProps<T = any> {
  tableId: string;
  columns: Column<T>[];
  data: T[];
  relationshipData?: Record<string, any>;
  relationshipResolvers?: Record<string, (id: string | string[]) => string>;
  relationshipOptionsProviders?: RelationshipOptionsProviders;
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
  
  // Common options (same as entity props)
  className?: string;
  height?: number | string;
  width?: number | string;
  initialData?: {
    processedRows: any[];
    visibleColumns: Column[];
    coordinateMapping: any;
  };
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: CellRef | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
  enableSelectionColumn?: boolean;
}

// Discriminated union type for props
type VibeGridDexProps<T = any> = VibeGridDexEntityProps<T> | VibeGridDexManualProps<T>;

// ====================================
// MAIN COMPONENT
// ====================================

export function VibeGridDex<T extends Record<string, any> = any>(
  props: VibeGridDexProps<T>
): React.ReactElement {
  // ====================================
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
  // ====================================
  
  // Type guard to check if props are entity-based
  const isEntityProps = (p: VibeGridDexProps<T>): p is VibeGridDexEntityProps<T> => {
    return 'entityType' in p;
  };
  
  // Handle entity-based configuration if entityType is provided
  const dexieEntityConfig = useDexieEntityConfig(
    isEntityProps(props) ? props.entityType : null,
    isEntityProps(props) ? props.selectedColumns : undefined
  );
  
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

  // Use the stable tableId from props
  const { tableId } = props;
  const entityType = isEntityProps(props) ? props.entityType : undefined;
  
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

  // Create entity config from dexie data
  const entityConfig = useMemo(() => {
    if (!dexieEntityConfig) return null;
    
    if (isEntityProps(props)) {
      const providedProviders = props.relationshipOptionsProviders || {};
      
      // Auto-generate options providers for relationship columns
      const autoRelationshipOptionsProviders: RelationshipOptionsProviders = {};
      
      dexieEntityConfig.columns.forEach(column => {
        const cellType = column.cellType || column.type;
        if (cellType?.startsWith('relationship') && column.relationshipTable && !providedProviders[column.id]) {
          // Add entity type to column for filtering
          const enhancedColumn = {
            ...column,
            relationshipEntityType: props.entityType
          };
          
          console.log('🔍 VibeGridDex: Creating generic relationship provider', {
            columnId: column.id,
            relationshipTable: column.relationshipTable,
            entityType: props.entityType,
            cellType
          });
          
          // Create a Dexie-based provider
          autoRelationshipOptionsProviders[column.id] = createGenericRelationshipProvider(enhancedColumn, dexieEntityConfig.relationshipData);
        }
      });
      
      // Merge provided and auto-generated providers
      const allRelationshipOptionsProviders = { ...autoRelationshipOptionsProviders, ...providedProviders };
      
      // Add options providers to columns
      const columnsWithProviders = dexieEntityConfig.columns.map(column => {
        const provider = allRelationshipOptionsProviders[column.id];
        if (provider) {
          return { ...column, relationshipOptionsProvider: provider };
        }
        return column;
      });
      
      return {
        columns: columnsWithProviders,
        data: dexieEntityConfig.data,
        relationshipData: dexieEntityConfig.relationshipData,
        relationshipResolvers: dexieEntityConfig.relationshipResolvers,
        relationshipOptionsProviders: allRelationshipOptionsProviders,
        onEntityUpdate: dexieEntityConfig.onEntityUpdate
      };
    }
    return null;
  }, [dexieEntityConfig, props]);
  
  // Extract configuration based on prop type
  const columns = entityConfig?.columns || (!isEntityProps(props) ? props.columns : []);
  const data = entityConfig?.data || (!isEntityProps(props) ? props.data : []);
  const relationshipData = entityConfig?.relationshipData || (!isEntityProps(props) ? props.relationshipData : {}) || {};
  const relationshipOptionsProviders = entityConfig?.relationshipOptionsProviders || (!isEntityProps(props) ? props.relationshipOptionsProviders : {}) || {};
  const onEntityUpdate = entityConfig?.onEntityUpdate || (!isEntityProps(props) ? props.onEntityUpdate : undefined);
  const relationshipResolvers = entityConfig?.relationshipResolvers || (!isEntityProps(props) ? props.relationshipResolvers : {}) || {};
  
  // Use data directly from Dexie live query
  const entities = data || [];
  
  // For manual configuration, add providers to columns
  const columnsWithProviders = useMemo(() => {
    if (!isEntityProps(props) && relationshipOptionsProviders) {
      return columns.map(column => {
        const provider = relationshipOptionsProviders[column.id];
        if (provider) {
          return { ...column, relationshipOptionsProvider: provider };
        }
        return column;
      });
    }
    return columns;
  }, [columns, relationshipOptionsProviders, props]);
  
  // Process data through syncViewProcessor for initial render
  const processedData = useMemo(() => {
    // If we have initialData from route loader, use that for first render
    if (props.initialData) {
      console.log('VibeGridDex: Using initialData from route loader', {
        rowCount: props.initialData.processedRows?.length || 0,
        hasProcessedRows: !!props.initialData.processedRows,
        sampleRow: props.initialData.processedRows?.[0]
      });
      return props.initialData;
    }
    
    // Otherwise process entities locally
    if (!entities || entities.length === 0) {
      return null;
    }
    
    // Filter out any undefined/null columns
    const validColumns = columnsWithProviders.filter(col => col != null);
    
    console.log('VibeGridDex: Processing data locally', {
      entityCount: entities.length,
      columnCount: validColumns.length,
      hasRelationshipResolvers: !!relationshipResolvers,
      resolverKeys: relationshipResolvers ? Object.keys(relationshipResolvers) : [],
      sampleEntity: entities[0]
    });
    
    const viewInput = {
      entities,
      columns: validColumns,
      relationshipResolvers,
      sortBy: persistedData?.sortBy || [],
      filters: persistedData?.filters || [],
      groupBy: persistedData?.groupBy || [],
      columnWidths: persistedData?.columnWidths || {},
      columnVisibility: persistedData?.columnVisibility || {},
      columnOrder: persistedData?.columnOrder || [],
      enableSelectionColumn: enableSelectionColumn,
      rowHeight: 40
    };
    
    const processed = syncProcessView(viewInput);
    console.log('VibeGridDex: Locally processed data:', {
      entityCount: entities.length,
      processedRows: processed.processedRows.length,
      columnCount: validColumns.length,
      sampleProcessedRow: processed.processedRows[0]
    });
    
    return {
      processedRows: processed.processedRows,
      visibleColumns: processed.visibleColumns,
      coordinateMapping: processed.coordinateMapping
    };
  }, [entities, columnsWithProviders, relationshipResolvers, props.initialData]);

  // Create machine configuration
  const machineConfig = useMemo(() => {
    console.log('VibeGridDex: Creating machine config', {
      hasProcessedData: !!processedData,
      processedRowCount: processedData?.processedRows?.length || 0,
      hasInitialData: !!props.initialData,
      initialDataRowCount: props.initialData?.processedRows?.length || 0,
      entityCount: entities.length,
      sampleProcessedRow: processedData?.processedRows?.[0]?.data,
      hasResolvedValues: processedData?.processedRows?.[0]?.data ? 
        Object.keys(processedData.processedRows[0].data).filter(k => k.includes('__resolved')).length > 0 : false,
      columns: columnsWithProviders,
      columnCount: columnsWithProviders.length,
      columnIds: columnsWithProviders.map(c => c.id)
    });
    
    return {
      input: {
        id: tableId,
        entityType: entityType || 'unknown',
        columns: columnsWithProviders,
        enableSelectionColumn: enableSelectionColumn,
        entities: entities,
        data: data,
        relationshipData: relationshipData,
        relationshipResolvers: relationshipResolvers,
        persistedData: persistedData,
        initialData: props.initialData || processedData,
        onEntityUpdate: onEntityUpdate,
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
    };
  }, [tableId, entityType, columns, enableSelectionColumn, data, relationshipData, relationshipResolvers, persistedData, props.initialData, processedData, onEntityUpdate, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize, height, width, entities]);
  
  // Create table actor
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
      tableSend
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
  }, [tableSend]);

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

  // Send entities synchronously on first render with data
  if (entities && entities.length > 0 && !entitiesSentRef.current) {
    const sendStartTime = performance.now();
    entitiesSentRef.current = true;
  }

  // ====================================
  // CONDITIONAL RENDERING - ALL HOOKS HAVE BEEN CALLED ABOVE
  // ====================================

  console.log('VibeGridDex: dexieEntityConfig status', {
    hasConfig: !!dexieEntityConfig,
    dataCount: dexieEntityConfig?.data?.length || 0,
    relationshipDataKeys: dexieEntityConfig ? Object.keys(dexieEntityConfig.relationshipData) : [],
    hasRelationshipResolvers: !!(dexieEntityConfig?.relationshipResolvers),
    resolverCount: dexieEntityConfig ? Object.keys(dexieEntityConfig.relationshipResolvers).length : 0
  });

  console.log('VibeGridDex: Configuration extracted', {
    isEntityProps: isEntityProps(props),
    hasEntityConfig: !!entityConfig,
    columnCount: columns.length,
    dataCount: data.length,
    relationshipResolverKeys: Object.keys(relationshipResolvers),
    relationshipDataKeys: Object.keys(relationshipData),
    sampleEntity: data[0],
    resolverDetails: Object.entries(relationshipResolvers).map(([key, resolver]) => ({
      key,
      hasResolver: !!resolver,
      resolverType: typeof resolver
    }))
  });
  
  // If using entity config and it's not ready yet, show loading
  if (isEntityProps(props) && !entityConfig) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading configuration...
      </div>
    );
  }
  
  // Check if we have relationship data loaded
  if (isEntityProps(props) && entityConfig) {
    const hasRelationshipColumns = columns.some(col => {
      const cellType = col.cellType || col.type;
      return cellType?.startsWith('relationship');
    });
    
    if (hasRelationshipColumns) {
      // Check if users data is loaded (most common relationship)
      const usersLoaded = relationshipData.users && Object.keys(relationshipData.users).length > 0;
      if (!usersLoaded) {
        console.log('VibeGridDex: Waiting for relationship data to load', {
          relationshipDataKeys: Object.keys(relationshipData),
          usersCount: relationshipData.users ? Object.keys(relationshipData.users).length : 0
        });
        return (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Loading relationship data...
          </div>
        );
      }
    }
  }
  
  // Validate required props - but allow rendering if we have initialData
  if (!data && !props.initialData) {
    console.error('VibeGridDex: data is required. Either provide it directly or use entityType for auto-configuration.');
    return <div>Error: Missing required data</div>;
  }
  
  if (!columns || columns.length === 0) {
    console.error('VibeGridDex: columns are required. Either provide them directly or use entityType for auto-configuration.');
    return <div>Error: Missing required columns</div>;
  }
  
  // Log entity count
  console.log('VibeGridDex: Entity count:', { 
    entityCount: entities.length
  });

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
// EXPORTS
// ====================================

// Export the main component
export default VibeGridDex;

// Export types for external use
export type { VibeGridDexProps };

// Re-export the hook from VibeGridXHooks
// export { useVibeGridXRef } from './VibeGridXHooks';