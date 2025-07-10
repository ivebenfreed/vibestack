import { useEffect, useRef, MutableRefObject } from 'react';
import { useMachine } from '@xstate/react';
import { tableBaseMachine } from './machines/table-machine';
import { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import { CanvasOverlayManager } from './overlays/CanvasOverlayManager';
import { EntityIntegrationLayer, useTableConfigFromAtoms } from './integration/EntityIntegration';
import type { TableConfig, RendererOptions, Column } from './types';

// ====================================
// INITIALIZATION TYPES
// ====================================

export interface InitializationRefs {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  overlayContainerRef: MutableRefObject<HTMLDivElement | null>;
  rendererRef: MutableRefObject<AtomicTableRenderer | null>;
  canvasOverlayRef: MutableRefObject<CanvasOverlayManager | null>;
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
  enableVirtualScrolling?: boolean;
  enableCanvasOverlays?: boolean;
  bufferSize?: number;
  enableGrouping?: boolean;
  enableFiltering?: boolean;
  enableSorting?: boolean;
  enableDragAndDrop?: boolean;
}

// ====================================
// TABLE CONFIGURATION HOOK
// ====================================

export const useTableConfiguration = (props: InitializationProps) => {
  const {
    entityType,
    columns,
    tableId = `vibegridx-${entityType}-${Date.now()}`,
    enableVirtualScrolling = true,
    enableGrouping = true,
    enableFiltering = true,
    bufferSize = 10,
  } = props;

  const tableConfig = useTableConfigFromAtoms(entityType, tableId);
  
  // Update table config with props, using provided columns instead of generated ones
  const enhancedTableConfig: TableConfig = {
    ...tableConfig,
    columns, // Use columns from props
    settings: {
      ...tableConfig.settings,
      enableVirtualScrolling,
      enableGrouping,
      enableFiltering,
      bufferSize
    }
  };

  return { tableConfig: enhancedTableConfig, tableId };
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
  integrationRef: MutableRefObject<EntityIntegrationLayer | null>
) => {
  useEffect(() => {
    if (!tableActor) return;
    
    // Create and connect entity integration layer
    integrationRef.current = new EntityIntegrationLayer(entityType);
    integrationRef.current.connectToTable(tableActor);
    
    return () => {
      integrationRef.current?.disconnect();
      integrationRef.current = null;
    };
  }, [tableActor, entityType]);
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
    
    // Get dimension managers from table state if available
    const dimensionManager = tableState?.context?.dimensionManager;
    const rowDimensionManager = tableState?.context?.rowDimensionManager;
    
    // Initialize atomic renderer with canvas container callback
    refs.rendererRef.current = new AtomicTableRenderer({
      container: refs.containerRef.current,
      dimensionManager,
      rowDimensionManager,
      ...rendererOptions,
      onCanvasContainerReady: (canvasContainer: HTMLElement) => {
        console.log('useRendererInitialization: Canvas container ready inside viewport');
        
        // Initialize canvas overlay inside the scrollable viewport
        if (!refs.canvasOverlayRef.current) {
          refs.canvasOverlayRef.current = new CanvasOverlayManager(canvasContainer, {
            dimensionManager,
            rowDimensionManager,
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
            useV2: true // Enable XState-powered overlay system
            // overlayActor: tableState?.context?.actors?.overlayActor // TODO: Fix shared actor approach
          });
          
          // Set selection change callback
          refs.canvasOverlayRef.current.setOnSelectionChange?.(
            rendererOptions.onSelectionChange || (() => {})
          );
          
          // Set fill complete callback
          refs.canvasOverlayRef.current.setOnFillComplete?.(
            rendererOptions.onFillComplete || (() => {})
          );
          
          console.log('VibeGridX: Canvas Overlay initialized inside scrollable viewport');
          
          // Update data mappings if we have data
          const renderState = (window as any).__vibegridx_last_renderstate;
          
          if (renderState && renderState.rows.length > 0) {
            const rowIds = renderState.rows.map((row: any) => row.id);
            const columnIds = rendererOptions.columns.map((col: any) => col.id);
            console.log('VibeGridXCore: Updating canvas data mappings on init', {
              rowCount: rowIds.length,
              columnCount: columnIds.length
            });
            refs.canvasOverlayRef.current!.updateDataMappings(rowIds, columnIds);
            
            // Columns are now passed during initialization, no need to update them here
          } else {
            console.log('VibeGridXCore: No render state available for canvas init');
          }
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
    
    // Subscribe to selection coordinator changes
    let selectionSubscription: any;
    
    const setupSelectionSync = () => {
      const snapshot = tableActor.getSnapshot();
      const selectionCoordinator = snapshot.context.actors?.selectionCoordinator;
      
      if (selectionCoordinator) {
        // Subscribe to selection changes from the coordinator
        selectionSubscription = selectionCoordinator.subscribe((selectionSnapshot: any) => {
          const selectedCells = selectionSnapshot.context?.selectedCells || new Set();
          
          // Only update if there's an actual change
          const currentSize = refs.selectedCellsRef.current.size;
          const newSize = selectedCells.size;
          
          if (currentSize !== newSize || !areSetsEqual(refs.selectedCellsRef.current, selectedCells)) {
            console.log('VibeGridX: Selection changed from coordinator', {
              previous: currentSize,
              new: newSize
            });
            
            // Sync our local ref with coordinator state
            refs.selectedCellsRef.current = new Set(selectedCells);
            
            // Update canvas if it exists
            if (refs.canvasOverlayRef.current) {
              // Get DOM positions for selected cells
              const cellElements = new Map<string, DOMRect>();
              
              selectedCells.forEach(cellKey => {
                const [rowId, columnId] = cellKey.split(':');
                const cellElement = document.querySelector(
                  `.vibegridx-cell[data-row-id="${rowId}"][data-column-id="${columnId}"]`
                ) as HTMLElement;
                
                if (cellElement) {
                  cellElements.set(cellKey, cellElement.getBoundingClientRect());
                }
              });
              
              // Update overlay with DOM positions
              if (cellElements.size > 0) {
                refs.canvasOverlayRef.current.updateSelectionWithDOMPositions(cellElements);
              }
            }
          }
        });
      }
    };
    
    // Setup sync after coordinator is ready
    const timeoutId = setTimeout(setupSelectionSync, 200);
    
    return () => {
      clearTimeout(timeoutId);
      if (selectionSubscription) {
        selectionSubscription.unsubscribe();
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