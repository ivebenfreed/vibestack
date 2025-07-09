import { useEffect, useRef, MutableRefObject } from 'react';
import { useMachine } from '@xstate/react';
import { tableBaseMachine } from './machines/table-machine';
import { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import { CanvasOverlayManager } from './overlays/CanvasOverlayManager';
import { EntityIntegrationLayer, useTableConfigFromAtoms } from './integration/EntityIntegration';
import type { TableConfig, RendererOptions } from './types';

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
}

export interface InitializationProps {
  entityType: 'task' | 'project' | 'user';
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
    tableId = `vibegridx-${entityType}-${Date.now()}`,
    enableVirtualScrolling = true,
    enableGrouping = true,
    enableFiltering = true,
    bufferSize = 10,
  } = props;

  const tableConfig = useTableConfigFromAtoms(entityType, tableId);
  
  // Update table config with props
  const enhancedTableConfig: TableConfig = {
    ...tableConfig,
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
  rendererOptions: Omit<RendererOptions, 'container'>
) => {
  useEffect(() => {
    if (!refs.containerRef.current) return;
    
    // Initialize atomic renderer (DATA-ONLY)
    refs.rendererRef.current = new AtomicTableRenderer({
      container: refs.containerRef.current,
      ...rendererOptions
    });
    
    // Initialize canvas overlay after renderer creates DOM structure
    // Use MutationObserver for more efficient DOM watching
    const initializeCanvasOverlay = (container: HTMLElement) => {
      if (refs.canvasOverlayRef.current) return; // Already initialized
      
      refs.canvasOverlayRef.current = new CanvasOverlayManager(container, {
        cellWidth: 120,
        cellHeight: 40,
        selectionColor: '#3b82f6',
        selectionBorderColor: '#1d4ed8',
        editingColor: '#10b981',
        editingBorderColor: '#059669',
        enableAnimations: false,
        animationDuration: 0,
        borderWidth: 2
      });
      
      console.log('VibeGridX: Canvas Overlay initialized');
      
      // Set initial viewport
      const viewport = refs.containerRef.current.querySelector('.vibegridx-viewport');
      if (viewport) {
        const initialViewport = {
          start: 0,
          end: Math.ceil(viewport.clientHeight / 40), // 40 is row height
          height: viewport.clientHeight,
          scrollTop: 0,
          itemHeight: 40
        };
        refs.canvasOverlayRef.current.updateViewport(initialViewport);
      }
      
      if (refs.selectedCellsRef.current.size > 0) {
        refs.canvasOverlayRef.current.updateSelection(refs.selectedCellsRef.current);
      }
    };
    
    // Check if canvas container already exists
    const existingCanvas = refs.containerRef.current.querySelector('.vibegridx-canvas-overlay');
    if (existingCanvas) {
      initializeCanvasOverlay(existingCanvas as HTMLElement);
    } else {
      // Watch for canvas container to be added
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') {
            const addedNodes = Array.from(mutation.addedNodes);
            for (const node of addedNodes) {
              if (node instanceof HTMLElement) {
                const canvasContainer = node.classList.contains('vibegridx-canvas-overlay') 
                  ? node 
                  : node.querySelector('.vibegridx-canvas-overlay');
                if (canvasContainer) {
                  observer.disconnect();
                  initializeCanvasOverlay(canvasContainer as HTMLElement);
                  return;
                }
              }
            }
          }
        }
      });
      
      observer.observe(refs.containerRef.current, {
        childList: true,
        subtree: true
      });
      
      // Fallback timeout in case something goes wrong
      const fallbackTimer = setTimeout(() => {
        observer.disconnect();
        console.warn('VibeGridX: Canvas overlay container not found after timeout');
      }, 1000);
      
      return () => {
        observer.disconnect();
        clearTimeout(fallbackTimer);
      };
    }
    
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
    
    const syncSelectionState = () => {
      const snapshot = tableActor.getSnapshot();
      const selectionCoordinator = snapshot.context.actors?.selectionCoordinator;
      
      if (selectionCoordinator) {
        const selectionSnapshot = selectionCoordinator.getSnapshot();
        const selectedCells = selectionSnapshot.context?.selectedCells || new Set();
        
        // Sync our local ref with coordinator state
        refs.selectedCellsRef.current = new Set(selectedCells);
        
        // Update canvas if it exists
        if (refs.canvasOverlayRef.current) {
          refs.canvasOverlayRef.current.updateSelection(selectedCells);
        }
        
        console.log('VibeGridX: Synced selection state from coordinator', {
          selectedCells: selectedCells.size
        });
      }
    };
    
    // Sync after coordinator is ready
    const timeoutId = setTimeout(syncSelectionState, 200);
    
    return () => {
      clearTimeout(timeoutId);
    };
  }, [tableActor]);
};