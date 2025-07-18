import React, { useEffect, useRef, useCallback, useMemo, lazy } from 'react';
import { useActorRef } from '@xstate/react';
import { useSelector as useAtomSelector } from '@xstate/store/react';
import { shallowEqual } from '@xstate/store';
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
import './vibegridx.css';

// Import entity configurations from DataForge
import { 
  getEntityConfig, 
  VIBEGRIDX_ENTITY_CONFIGS,
  type VibeGridXEntityType,
  type VibeGridXEntityConfig
} from '@repo/dataforge/vibegridx-columns';

// Import domain registry for dynamic atom/update function access
import { DOMAIN_REGISTRY, getDomainAtom, getDomainUpdateFn } from '@/domain/registry';

// Import provider utilities
import type { RelationshipOptionsProvider } from './types';
import { createGenericRelationshipProvider } from './providers/generic-relationship-provider';

// ====================================
// COMPONENT PROPS
// ====================================

// Entity-based configuration (recommended)
interface VibeGridXEntityProps<T = any> {
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
interface VibeGridXManualProps<T = any> {
  tableId: string;
  columns: Column<T>[];
  primaryAtom: any;
  relationshipAtoms?: Record<string, any>;
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
type VibeGridXProps<T = any> = VibeGridXEntityProps<T> | VibeGridXManualProps<T>;

// ====================================
// MAIN COMPONENT
// ====================================

export const VibeGridX = <T extends Record<string, any> = any>(
  props: VibeGridXProps<T>
): React.ReactElement => {
  // Type guard to check if props are entity-based
  const isEntityProps = (p: VibeGridXProps<T>): p is VibeGridXEntityProps<T> => {
    return 'entityType' in p;
  };
  
  // Handle entity-based configuration if entityType is provided
  const entityConfig = useMemo(() => {
    if (isEntityProps(props)) {
      const config = getEntityConfig(props.entityType);
      
      if (!config) {
        console.error(`VibeGridX: No entity configuration found for type "${props.entityType}"`);
        return null;
      }
      
      // Get primary atom and update function from domain registry
      const primaryAtom = getDomainAtom(props.entityType as any);
      const updateFn = getDomainUpdateFn(props.entityType as any);
      
      // Build relationship atoms from config
      const relationshipAtoms: Record<string, any> = {};
      for (const [key, relConfig] of Object.entries(config.relationshipAtoms)) {
        // Extract entity type from atom name (e.g., 'projectsAtom' -> 'project')
        const entityType = relConfig.name.replace('sAtom', '');
        const atom = getDomainAtom(entityType as any);
        if (atom) {
          relationshipAtoms[key] = atom;
        }
      }
      
      // Add commonly needed atoms that might be missing from config
      const commonAtoms = [
        { key: 'statusDefinitions', entityType: 'statusDefinition' },
        { key: 'statusSets', entityType: 'statusSet' },
        { key: 'tags', entityType: 'tag' },
        { key: 'tagSets', entityType: 'tagSet' }
      ];
      
      for (const { key, entityType } of commonAtoms) {
        if (!relationshipAtoms[key]) {
          const atom = getDomainAtom(entityType as any);
          if (atom) {
            relationshipAtoms[key] = atom;
            console.log('🔍 VibeGridX: Added common atom', { key, entityType, atomExists: !!atom });
          }
        }
      }
      
      console.log('🔍 VibeGridX: Final relationship atoms', {
        entityType: props.entityType,
        relationshipAtoms: Object.keys(relationshipAtoms)
      });
      
      // Filter columns if selectedColumns is provided
      let columns = config.columns;
      if (props.selectedColumns) {
        columns = columns.filter(col => props.selectedColumns.includes(col.id));
      }
      
      // Build relationship resolvers based on columns and atoms
      const relationshipResolvers: Record<string, (id: string | string[]) => string> = {};
      
      columns.forEach(column => {
        const cellType = column.cellType || column.type;
        if (cellType?.startsWith('relationship') && column.relationshipTable) {
          const tableKey = column.relationshipTable;
          const displayField = column.relationshipDisplayField;
          
          // Find the atom for this relationship using the same logic as the generic provider
          let targetAtom: any = null;
          
          // Try various atom naming patterns (same as generic provider)
          const atomKeys = [
            tableKey,
            `${tableKey}s`,
            `${tableKey}sAtom`,
            tableKey.replace(/s$/, ''),
            `${tableKey.replace(/s$/, '')}s`,
            `${tableKey}Definitions`,
            `${tableKey}Definition`,
            `${tableKey}definitions`,
            `${tableKey}definition`
          ];
          
          for (const key of atomKeys) {
            if (relationshipAtoms[key]) {
              targetAtom = relationshipAtoms[key];
              console.log('🔍 VibeGridX: Found resolver atom', {
                columnId: column.id,
                tableKey,
                atomKey: key,
                hasAtom: !!targetAtom
              });
              break;
            }
          }
          
          // Create resolver that reads atom data dynamically
          relationshipResolvers[column.id] = (id: string | string[]) => {
            // Get fresh atom data when resolver is called
            const atomData = targetAtom ? targetAtom.get() || {} : {};
            
            console.log('🔍 VibeGridX: Resolver called', {
              columnId: column.id,
              id,
              hasTargetAtom: !!targetAtom,
              atomDataKeys: Object.keys(atomData),
              atomDataCount: Object.keys(atomData).length
            });
            
            if (Array.isArray(id)) {
              const names = id.map(i => {
                const entity = atomData[i];
                if (!entity) return i;
                
                // Try different common display fields
                const display = entity[displayField || 'displayName'] || 
                              entity.displayName || 
                              entity.name || 
                              entity.title || 
                              entity.label ||
                              i;
                return display;
              });
              return names.join(', ');
            }
            
            const entity = atomData[id];
            if (!entity) {
              console.log('🔍 VibeGridX: Entity not found', { id, availableIds: Object.keys(atomData) });
              return id;
            }
            
            // Try different common display fields
            const display = entity[displayField || 'displayName'] || 
                          entity.displayName || 
                          entity.name || 
                          entity.title || 
                          entity.label ||
                          id;
            
            console.log('🔍 VibeGridX: Resolved display', {
              columnId: column.id,
              id,
              entity,
              displayField,
              resolvedDisplay: display
            });
            
            return display;
          };
        }
      });
      
      // Auto-generate options providers for relationship columns
      const autoRelationshipOptionsProviders: RelationshipOptionsProviders = {};
      
      // Add providers if not already provided
      const providedProviders = props.relationshipOptionsProviders || {};
      
      columns.forEach(column => {
        const cellType = column.cellType || column.type;
        if (cellType?.startsWith('relationship') && column.relationshipTable && !providedProviders[column.id]) {
          // Add entity type to column for filtering
          const enhancedColumn = {
            ...column,
            relationshipEntityType: props.entityType
          };
          
          console.log('🔍 VibeGridX: Creating generic relationship provider', {
            columnId: column.id,
            relationshipTable: column.relationshipTable,
            entityType: props.entityType,
            cellType,
            availableRelationshipAtoms: Object.keys(relationshipAtoms)
          });
          
          // Create a generic provider that works with any relationship pattern
          autoRelationshipOptionsProviders[column.id] = createGenericRelationshipProvider(enhancedColumn, relationshipAtoms);
        }
      });
      
      // Merge provided and auto-generated providers
      const allRelationshipOptionsProviders = { ...autoRelationshipOptionsProviders, ...providedProviders };
      
      // Add options providers to columns
      const columnsWithProviders = columns.map(column => {
        const provider = allRelationshipOptionsProviders[column.id];
        if (provider) {
          return { ...column, relationshipOptionsProvider: provider };
        }
        return column;
      });
      
      return {
        columns: columnsWithProviders,
        primaryAtom,
        relationshipAtoms,
        relationshipResolvers,
        relationshipOptionsProviders: allRelationshipOptionsProviders,
        onEntityUpdate: updateFn ? 
          (rowId: string, updates: Record<string, any>) => updateFn(rowId, updates) : 
          undefined
      };
    }
    return null;
  }, [props]);
  
  // Extract configuration based on prop type
  const columns = entityConfig?.columns || (!isEntityProps(props) ? props.columns : []);
  const primaryAtom = entityConfig?.primaryAtom || (!isEntityProps(props) ? props.primaryAtom : undefined);
  const relationshipAtoms = entityConfig?.relationshipAtoms || (!isEntityProps(props) ? props.relationshipAtoms : {}) || {};
  const relationshipOptionsProviders = entityConfig?.relationshipOptionsProviders || (!isEntityProps(props) ? props.relationshipOptionsProviders : {}) || {};
  const onEntityUpdate = entityConfig?.onEntityUpdate || (!isEntityProps(props) ? props.onEntityUpdate : undefined);
  
  // Common props (available in both types)
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
  
  // Validate required props
  if (!primaryAtom) {
    console.error('VibeGridX: primaryAtom is required. Either provide it directly or use entityType for auto-configuration.');
    return <div>Error: Missing required primaryAtom</div>;
  }
  
  if (!columns || columns.length === 0) {
    console.error('VibeGridX: columns are required. Either provide them directly or use entityType for auto-configuration.');
    return <div>Error: Missing required columns</div>;
  }
  
  // PERFORMANCE: Get initial entities but don't subscribe - renderer handles all updates via DOM
  const entities = useMemo(() => {
    const atomData = primaryAtom.get();
    return Object.values(atomData || {});
  }, []); // Empty deps - only run once on mount, never re-render
  
  // Get relationship resolvers from entity config or manual props
  // The parent component should provide pre-configured resolvers
  const relationshipResolvers = entityConfig?.relationshipResolvers || 
    (!isEntityProps(props) ? props.relationshipResolvers : undefined) || 
    {};
  
  // Log initial entity count only
  console.log('VibeGridX: Initial entity count:', { 
    entityCount: entities.length,
    renderOnce: true
  });
  
  // ====================================
  // CORE INITIALIZATION - PERFORMANCE OPTIMIZED
  // ====================================
  
  // ====================================
  // REFS AND STATE
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
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
  
  // Unified event system refs
  const eventDelegationManagerRef = useRef<EventDelegationManager | null>(null);
  
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
      columns: columns, // Use the derived columns variable, not props.columns
      enableSelectionColumn: enableSelectionColumn,
      entities: entities, // Initial entities for setup
      primaryAtom: primaryAtom, // Pass atom for machine to subscribe to changes
      relationshipAtoms: relationshipAtoms, // Pass relationship atoms
      relationshipResolvers: relationshipResolvers, // Pass resolvers for relationship columns
      // Include persisted data in input for context initialization
      persistedData: persistedData,
      // Pass initial processed data from route loader
      initialData: props.initialData,
      // Pass entity update handler for self-contained saves
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
  }), [tableId, entityType, columns, enableSelectionColumn, primaryAtom, relationshipAtoms, relationshipResolvers, persistedData, props.initialData, onEntityUpdate, props.enableVirtualScrolling, props.enableGrouping, props.enableFiltering, props.bufferSize, height, width]);
  
  // PERFORMANCE: Use useActorRef instead of useMachine to avoid re-renders
  // All actual rendering is done via direct DOM manipulation, not React
  const tableActor = useActorRef(tableBaseMachine, machineConfig);
  const tableSend = tableActor.send;
  
  // Unified Event System is always used
  
  // PERFORMANCE: Track if entities have been sent to avoid duplicates
  const entitiesSentRef = useRef(false);
  
  // PERFORMANCE: Send entities synchronously on first render with data
  if (entities && entities.length > 0 && !entitiesSentRef.current) {
    const sendStartTime = performance.now();
    // Entities are now pre-loaded by route loader - no need to send them
    entitiesSentRef.current = true;
  }
  
  // PERFORMANCE: Remove excessive debug logging to reduce useEffect cascade
  
  // All event handling is now done by the unified EventDelegationManager
  
  // ====================================
  // SYNCHRONOUS RENDERER INITIALIZATION
  // ====================================
  
  // PERFORMANCE: Track renderer initialization state
  const rendererInitializedRef = useRef(false);
  const pendingRendererOptionsRef = useRef<any>(null);
  
  // PERFORMANCE: Create renderer options synchronously (no useEffect delay)
  const rendererOptions = useMemo(() => ({
    // Don't pass container yet - will be set when ref is attached
    enableSelectionColumn: enableSelectionColumn,
    cellHeight: 40,
    // Note: onScroll is handled internally by EventSystem and updates the virtual grid directly
    // No need to forward to table machine as the renderer handles viewport changes internally
    // No event handlers - unified EventDelegationManager handles all events
    onStateChange: (event: any) => {
      // Simple state change handler for render events
      if (event.type === 'render.complete') {
        if (event.renderTime > 100) {
          console.warn('Slow render detected:', event);
        }
      }
    }
  }), [enableSelectionColumn]);
  
  // Store pending options for when container is ready
  pendingRendererOptionsRef.current = rendererOptions;
  
  // PERFORMANCE: Initialize renderer synchronously when container ref is attached
  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node && !rendererInitializedRef.current) {
      const initStartTime = performance.now();
      console.log('🚀 VibeGridX: Container attached, initializing renderer synchronously:', {
        timestamp: initStartTime
      });
      
      // Add container to options
      const optionsWithContainer = {
        ...pendingRendererOptionsRef.current,
        container: node
      };
      
      (window as any).__vibegridx_renderer_options = optionsWithContainer;
      
      // Send initialize immediately - no useEffect delay
      console.log('🚀 VibeGridX: Sending INITIALIZE_RENDERER synchronously:', {
        timestamp: performance.now()
      });
      tableSend({
        type: 'INITIALIZE_RENDERER',
        options: optionsWithContainer
      });
      
      rendererInitializedRef.current = true;
    }
    
    // Still store ref for other uses
    containerRef.current = node;
  }, [tableSend]);
  
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
  // is handled by TableRenderer (direct DOM) and CanvasOverlay (Konva).
  // No React re-renders needed after initial mount.
  
  // No state watching needed - machine handles all rendering internally
  // Container tracking moved to synchronous callback ref
  
  // Cleanup window variable on unmount
  useEffect(() => {
    return () => {
      delete (window as any).__vibegridx_renderer_options;
    };
  }, []);
  
  // Atom subscriptions are now handled inside XState machine
  // No need for useEffect here

  
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
  // EVENT SYSTEM SETUP
  // ====================================
  
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