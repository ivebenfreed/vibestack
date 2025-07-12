import { useEffect, useRef, useMemo, MutableRefObject } from 'react';
import { useMachine } from '@xstate/react';
import { tableBaseMachine } from './machines/table-machine';
import { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import { CanvasOverlay } from './overlays/CanvasOverlay';
import { EntityIntegrationLayer, createDomainAdapter } from './integration/EntityIntegration';
import type { TableConfig, RendererOptions, Column } from './types';

// ====================================
// INITIALIZATION TYPES
// ====================================

export interface InitializationRefs {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  overlayContainerRef: MutableRefObject<HTMLDivElement | null>;
  rendererRef: MutableRefObject<AtomicTableRenderer | null>;
  canvasOverlayRef: MutableRefObject<CanvasOverlay | null>;
  integrationRef: MutableRefObject<EntityIntegrationLayer | null>;
  selectedCellsRef: MutableRefObject<Set<string>>;
  anchorCellRef: MutableRefObject<any>;
  subscriptionRef: MutableRefObject<any>;
  dragStateRef: MutableRefObject<{
    isDragging: boolean;
    startCell: any | null;
    startPos: { x: number; y: number } | null;
  }>;
}

export interface InitializationProps {
  entityType: 'task' | 'project' | 'user';
  columns: Column<any>[];
  tableId?: string;
  height?: number;
  width?: number | string;
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
  enableSelectionColumn?: boolean;
}

// ====================================
// TABLE CONFIGURATION HOOK
// ====================================

export const useTableConfiguration = (props: InitializationProps) => {
  const {
    entityType,
    columns,
    tableId = `vibegridx-${entityType}-${Date.now()}`,
    height = 600,
    width = 800,
    enableVirtualScrolling = true,
    enableGrouping = true,
    enableFiltering = true,
    bufferSize = 10,
    enableSelectionColumn = false,
  } = props;

  // Memoize stable table config (no dynamic data to prevent machine recreation)
  const tableConfig: TableConfig = useMemo(() => {
    return {
      id: tableId,
      entityType,
      columns, // Use columns from props directly
      enableSelectionColumn,
      // No initialData - data comes through entity integration
      settings: {
        enableVirtualScrolling,
        enableGrouping,
        enableFiltering,
        bufferSize,
        // Calculate initial viewport based on height
        initialViewport: {
          start: 0,
          end: Math.ceil((typeof height === 'number' ? height : 600) / 40), // Assuming 40px row height
          height: typeof height === 'number' ? height : 600,
          width: typeof width === 'number' ? width : 800,
          scrollTop: 0,
          scrollLeft: 0,
          itemHeight: 40
        }
      }
    };
  }, [entityType, tableId, columns, height, width, enableVirtualScrolling, enableGrouping, enableFiltering, bufferSize, enableSelectionColumn]);

  return { tableConfig, tableId };
};

// ====================================
// XSTATE MACHINE HOOK
// ====================================

export const useTableMachine = (tableConfig: TableConfig) => {
  const [tableState, tableSend, tableActor] = useMachine(tableBaseMachine, {
    input: tableConfig
  });

  return { tableState, tableSend, tableActor };
};

// ====================================
// ENTITY INTEGRATION HOOK
// ====================================

export const useEntityIntegration = (
  tableActor: any,
  entityType: string,
  integrationRef: MutableRefObject<EntityIntegrationLayer | null>,
  columns?: Column[]
) => {
  useEffect(() => {
    if (!tableActor) return;
    
    // Create and connect entity integration layer
    integrationRef.current = new EntityIntegrationLayer(entityType);
    integrationRef.current.connectToTable(tableActor, columns);
    
    return () => {
      integrationRef.current?.disconnect();
      integrationRef.current = null;
    };
  }, [tableActor, entityType, columns]);
};

// ====================================
// RENDERER INITIALIZATION HOOK
// ====================================

export const useRendererInitialization = (
  refs: InitializationRefs,
  rendererOptions: Omit<RendererOptions, 'container'>,
  tableState?: any // XState snapshot with context
) => {
  useEffect(() => {
    if (!refs.containerRef.current) return;
    
    // Get managers from table state
    const dimensionManager = tableState?.context?.dimensionManager;
    const rowDimensionManager = tableState?.context?.rowDimensionManager;
    const coordinateManager = tableState?.context?.coordinateManager;
    const selectionManager = tableState?.context?.selectionManager;
    
    console.log('useRendererInitialization: Initial render debug:', {
      hasDimensionManager: !!dimensionManager,
      hasRowDimensionManager: !!rowDimensionManager,
      hasCoordinateManager: !!coordinateManager,
      tableStateValue: tableState?.value,
      contextKeys: tableState?.context ? Object.keys(tableState.context) : [],
      coordinateManagerColumnCount: coordinateManager?.getColumnCount?.() || 0,
      coordinateManagerType: coordinateManager ? coordinateManager.constructor.name : 'null'
    });
    
    // Initialize atomic renderer with canvas container callback
    refs.rendererRef.current = new AtomicTableRenderer({
      container: refs.containerRef.current,
      dimensionManager: coordinateManager || dimensionManager, // Use coordinate manager for positioning
      rowDimensionManager,
      coordinateManager, // Pass coordinate manager for direct updates
      ...rendererOptions,
      onCanvasContainerReady: (canvasContainer: HTMLElement) => {
        console.log('useRendererInitialization: Canvas container ready inside viewport');
        
        // Initialize canvas overlay inside the scrollable viewport
        console.log('useRendererInitialization: Checking overlay actor', {
          hasTableState: !!tableState,
          hasContext: !!tableState?.context,
          hasActors: !!tableState?.context?.actors,
          hasOverlayActor: !!tableState?.context?.actors?.overlayActor,
          actors: tableState?.context?.actors
        });
        
        // Store canvas container for deferred overlay initialization
        (refs as any).canvasContainer = canvasContainer;
        
        // Defer overlay creation until actually needed
        if (!refs.canvasOverlayRef.current && tableState?.context?.actors?.overlayActor) {
          console.log('useRendererInitialization: Creating CanvasOverlay');
          refs.canvasOverlayRef.current = new CanvasOverlay(canvasContainer, {
            dimensionManager,
            rowDimensionManager,
            coordinateManager,
            columns: rendererOptions.columns,
            cellWidth: 120,
            cellHeight: rowDimensionManager?.getRowHeight() || 40,
            selectionColor: '#3b82f6',
            selectionBorderColor: '#1d4ed8',
            editingColor: '#10b981',
            editingBorderColor: '#059669',
            enableAnimations: false,
            animationDuration: 0,
            borderWidth: 2,
            overlayActor: tableState.context.actors.overlayActor // Required: Use shared actor from table machine
          });
          
          // Set selection change callback
          refs.canvasOverlayRef.current.onSelectionChange = 
            rendererOptions.onSelectionChange || (() => {});
          
          // Set fill complete callback
          refs.canvasOverlayRef.current.onFillComplete = 
            rendererOptions.onFillComplete || (() => {});
          
          // Connect canvas overlay to selection manager
          if (selectionManager && refs.canvasOverlayRef.current) {
            selectionManager.setCanvasOverlay(refs.canvasOverlayRef.current);
          }
          
          console.log('VibeGridX: Canvas Overlay initialized inside scrollable viewport with coordinate manager');
        } else {
          console.log('VibeGridXCore: No overlay actor available for canvas init');
        }
      }
    });
    
    return () => {
      refs.rendererRef.current?.destroy();
      refs.rendererRef.current = null;
      refs.canvasOverlayRef.current?.destroy();
      refs.canvasOverlayRef.current = null;
    };
  }, []);
};

// ====================================
// SELECTION STATE SYNC HOOK
// ====================================

export const useSelectionStateSync = (
  tableActor: any,
  refs: InitializationRefs
) => {
  useEffect(() => {
    if (!tableActor) return;
    
    // Subscribe to selection manager changes
    let selectionUnsubscribe: (() => void) | null = null;
    
    const setupSelectionSync = () => {
      const snapshot = tableActor.getSnapshot();
      const selectionManager = snapshot.context?.selectionManager;
      
      if (selectionManager) {
        // Subscribe to selection changes from the manager
        selectionUnsubscribe = selectionManager.onChange((state: any) => {
          const selectedCells = state.selectedCells || new Set();
          
          // Only update if there's an actual change
          const currentSize = refs.selectedCellsRef.current.size;
          const newSize = selectedCells.size;
          
          if (currentSize !== newSize || !areSetsEqual(refs.selectedCellsRef.current, selectedCells)) {
            // Selection updated from manager
            
            // Sync our local ref with manager state
            refs.selectedCellsRef.current = new Set(selectedCells);
            
            // Canvas overlay is updated directly by selection manager,
            // but we might need to trigger viewport update
            if (refs.canvasOverlayRef.current) {
              // Get current viewport from table machine
              const tableSnapshot = tableActor.getSnapshot();
              const currentViewport = tableSnapshot?.context?.viewport;
              if (currentViewport) {
                refs.canvasOverlayRef.current.updateViewport(currentViewport);
              }
            }
          }
        });
      }
    };
    
    // Setup sync after manager is ready
    const timeoutId = setTimeout(setupSelectionSync, 200);
    
    return () => {
      clearTimeout(timeoutId);
      if (selectionUnsubscribe) {
        selectionUnsubscribe();
      }
    };
  }, [tableActor]);
};

// Helper function to compare sets
function areSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}