import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createTableCore$, createTableCoreSync$ } from './stores/data-state';
import { createTableInteraction$ } from './stores/interaction-state';
import { SimplePassiveRenderer } from './renderers/core/SimplePassiveRenderer';
import { VibeGridXHeaderPure } from './components/VibeGridXHeaderPure';
import type { Column } from './types';
import { log } from '@/logger';
import { createVibeGridVisualState } from './stores/visual-state';
import { universeOrgId$, universeUserId$ } from '@/legend-state/observables';
import { observable } from '@legendapp/state';
import { createHydrationManager, type VibeGridHydrationManager } from './stores/init-state';
import { VibeGridLoadingOverlay, useVibeGridLoadingState } from './components/VibeGridLoadingOverlay';

// Import VibeGrid CSS styles
import './vibegridx.css';

const fileLog = log('components/VibeGrid');

// ====================================
// COMPONENT PROPS
// ====================================

interface VibeGridProps<T = any> {
  tableId: string;  // Unique identifier for this table instance (required for persistence)
  entityType: string;  // Entity type (required - determines data source)
  
  // Column configuration (required - no more auto-generation)
  columns: Column<T>[];  // Explicit columns with type checking
  
  // Common options
  className?: string;
  height?: number | string;
  width?: number | string;
  
  // Event handlers (all optional)
  onCellClick?: (rowId: string, columnId: string) => void;
  onCellDoubleClick?: (rowId: string, columnId: string) => void;
  onSelectionChange?: (selectedCells: Set<string>) => void;
  onEditingChange?: (editingCell: { rowId: string; columnId: string } | null) => void;
  onPerformanceUpdate?: (metrics: any) => void;
  onEntityUpdate?: (rowId: string, updates: Record<string, any>) => Promise<void> | void;
  onBatchEntityUpdate?: (updates: Array<{ id: string; updates: Record<string, any> }>) => Promise<void> | void;
  
  // Performance options
  enableVirtualScrolling?: boolean;
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

export function VibeGrid<T extends Record<string, any> = any>(
  props: VibeGridProps<T>
): React.ReactElement {

  const {
    tableId,
    entityType,
    columns,
    className = '',
    height = 600,
    width = '100%',
    enableSelectionColumn = false,
    onCellClick,
    onCellDoubleClick,
    onSelectionChange,
    onEditingChange,
    onPerformanceUpdate,
    onEntityUpdate,
    onBatchEntityUpdate,
    enableVirtualScrolling = true,
    bufferSize = 10,
    enableGrouping = true,
    enableFiltering = true,
    enableSorting = true,
    enableDragAndDrop = true,
  } = props;

  // ====================================
  // REFS AND STATE
  // ====================================

  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SimplePassiveRenderer | null>(null);
  const observablesRef = useRef<{
    tableCore$: any;
    tableCoreSync$: any;
    tableInteraction$: any;
    tableViewport$: any;
  } | null>(null);

  // Create init manager instance
  const initManagerRef = useRef<VibeGridHydrationManager | null>(null);
  if (!initManagerRef.current) {
    initManagerRef.current = createHydrationManager(tableId, entityType);
  }
  const initManager = initManagerRef.current;

  // Create visual state instance (isolated per VibeGrid)
  const visualStateRef = useRef<ReturnType<typeof createVibeGridVisualState> | null>(null);
  if (!visualStateRef.current) {
    visualStateRef.current = createVibeGridVisualState();
  }
  const visualState = visualStateRef.current;

  // Use init manager hook for loading state
  const { isLoading, isReady, hasErrors, retry } = useVibeGridLoadingState(initManager);

  // ====================================
  // INITIALIZATION
  // ====================================

  useEffect(() => {
    // Initialize observables and setup persistence checking
    const initializeVibeGrid = () => {
    try {
      fileLog.info('🚀 Initializing VibeGrid', {
        tableId,
        entityType,
        columnCount: columns.length
      });

      // Mark CSS and basic dependencies as ready immediately
      initManager.markReady('cssStylesLoaded');
      initManager.markReady('entityDataLoaded');
      initManager.markReady('entityObservableReady');

      // Create the three-layer observables directly
      const { tableCore$, tableCoreSync$ } = createTableCore$(entityType, columns);
      const tableInteraction$ = createTableInteraction$(tableCore$);

      // Create a proper viewport observable with Legend State observables for each property
      const tableViewport$ = {
        scrollTop: observable(0),
        scrollLeft: observable(0),
        viewportWidth: observable(0),
        viewportHeight: observable(0),
        updateViewport(width: number, height: number) {
          tableViewport$.viewportWidth.set(width);
          tableViewport$.viewportHeight.set(height);
        },
        updateScroll(scrollTop: number, scrollLeft: number) {
          tableViewport$.scrollTop.set(scrollTop);
          tableViewport$.scrollLeft.set(scrollLeft);
        }
      };

      const observables = {
        tableCore$,
        tableCoreSync$,
        tableInteraction$,
        tableViewport$
      };
      observablesRef.current = observables;

      fileLog.debug('✅ Created pure observables', { entityType });

      // Mark data state dependencies as ready
      initManager.markReady('dataStateReady');
      initManager.markReady('interactionStateReady');

      // Mark persistence as loaded (Legend State handles this automatically)
      initManager.markReady('dataPersistenceLoaded');
      initManager.markReady('visualPersistenceLoaded');

      // Initialize isolated visual state for this VibeGrid instance
      const orgId = universeOrgId$.get();
      const userId = universeUserId$.get();
      if (orgId && userId) {
        visualState.visualOperations.initializeColumns(columns, entityType, orgId, userId);
        fileLog.info('🎯 Visual state initialized (isolated), waiting for persistence', { entityType, orgId, userId });
        initManager.markReady('visualStateReady');
      } else {
        fileLog.warn('⚠️ Cannot initialize visual state - missing orgId or userId', { orgId, userId });
        initManager.markError('visualStateReady', 'Missing orgId or userId', true);
      }

      // Wait for container ref to be available for renderer initialization
      let retryCount = 0;
      const maxRetries = 100; // Max 5 seconds (50ms * 100)

      const checkReadyToInitializeRenderer = () => {
        // First check if container ref is available
        if (!containerRef.current) {
          retryCount++;
          if (retryCount < maxRetries) {
            fileLog.debug(`🔄 Container ref not ready, retrying in 50ms (attempt ${retryCount}/${maxRetries})`);
            setTimeout(checkReadyToInitializeRenderer, 50);
            return;
          } else {
            fileLog.error('❌ Container ref is null after max retries, giving up');
            initManager.markError('containerReady', 'Container element not available for VibeGrid initialization', true);
            return;
          }
        }

        // Additional check: ensure container is actually attached to DOM and has dimensions
        const containerElement = containerRef.current;
        const rect = containerElement.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          retryCount++;
          if (retryCount < maxRetries) {
            fileLog.debug(`🔄 Container has no dimensions (${rect.width}x${rect.height}), retrying in 50ms (attempt ${retryCount}/${maxRetries})`);
            setTimeout(checkReadyToInitializeRenderer, 50);
            return;
          } else {
            fileLog.error('❌ Container has no dimensions after max retries');
            initManager.markError('containerReady', 'Container element has no dimensions', true);
            return;
          }
        }

        // Mark container as ready
        initManager.markReady('containerReady');

        // Initialize renderer directly (persistence is automatic with Legend State)
        fileLog.info('✅ Container ready, initializing renderer', { entityType });

        // Create the SimplePassiveRenderer with enhanced selection
        const renderer = new SimplePassiveRenderer({
          container: containerRef.current,
          tableCore$: observables.tableCore$,
          tableInteraction$: observables.tableInteraction$,
          tableViewport$: observables.tableViewport$,
          enableSelectionColumn,
          bufferSize,
          onEntityUpdate,
          onBatchEntityUpdate
        });

        rendererRef.current = renderer;
        initManager.markReady('rendererInitialized');

        fileLog.info('✅ SimplePassiveRenderer initialized successfully');

        // Set up event handlers after renderer is created
        if (onSelectionChange) {
          // Subscribe to selection changes
          const unsubscribe = observables.tableInteraction$.selectedCells.onChange(() => {
            const selectedCells = observables.tableInteraction$.selectedCells.get();
            onSelectionChange(selectedCells);
          });

          // Store unsubscribe function
          (renderer as any).selectionUnsubscribe = unsubscribe;
        }

        if (onEditingChange) {
          // Subscribe to editing changes
          const unsubscribe = observables.tableInteraction$.editingCell.onChange(() => {
            const editingCell = observables.tableInteraction$.editingCell.get();
            if (editingCell) {
              const [rowId, columnId] = editingCell.split(':');
              onEditingChange({ rowId, columnId });
            } else {
              onEditingChange(null);
            }
          });

          // Store unsubscribe function
          (renderer as any).editingUnsubscribe = unsubscribe;
        }

        // Update viewport when container size changes
        const resizeObserver = new ResizeObserver(() => {
          if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            observables.tableViewport$.updateViewport(rect.width, rect.height);
          }
        });

        resizeObserver.observe(containerRef.current);
        (renderer as any).resizeObserver = resizeObserver;

        // Initial viewport update
        const initialRect = containerRef.current.getBoundingClientRect();
        observables.tableViewport$.updateViewport(initialRect.width, initialRect.height);

        // Mark all remaining dependencies as ready
        initManager.markReady('eventHandlersReady');
        initManager.markReady('viewportReady');
        initManager.markReady('overlaySystemReady');
        initManager.markReady('positionTrackingReady');
        initManager.markReady('mouseControllerReady');
        initManager.markReady('scrollControllerReady');
      };

      // Start checking for container readiness after a small delay to allow React to render
      setTimeout(checkReadyToInitializeRenderer, 100);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      fileLog.error('❌ Failed to initialize VibeGrid', err);
      initManager.markError('rendererInitialized', errorMsg, true);
    }
    };

    // Call the initialization function
    initializeVibeGrid();

    // Cleanup
    return () => {
      if (rendererRef.current) {
        fileLog.debug('🧹 Cleaning up VibeGrid');

        // Cleanup event subscriptions
        if ((rendererRef.current as any).selectionUnsubscribe) {
          (rendererRef.current as any).selectionUnsubscribe();
        }
        if ((rendererRef.current as any).editingUnsubscribe) {
          (rendererRef.current as any).editingUnsubscribe();
        }
        if ((rendererRef.current as any).resizeObserver) {
          (rendererRef.current as any).resizeObserver.disconnect();
        }

        rendererRef.current.destroy();
        rendererRef.current = null;
      }

      observablesRef.current = null;
      initManager.cleanup();
    };
  }, [tableId, entityType, initManager]); // Only re-initialize if table identity changes


  // ====================================
  // PUBLIC API METHODS
  // ====================================

  const api = useMemo(() => {
    if (!observablesRef.current || !isReady) return null;

    const { tableCore$, tableInteraction$, tableViewport$ } = observablesRef.current;

    // Ensure all observables exist before creating API
    if (!tableCore$ || !tableInteraction$ || !tableViewport$) return null;

    return {
      // Data manipulation
      toggleSort: (field: string) => tableCore$.toggleSort(field),
      setFilter: (field: string, value: any, operator: string) => tableCore$.setFilter(field, value, operator),
      clearFilters: () => tableCore$.clearFilters(),
      toggleColumn: (columnId: string) => tableCore$.toggleColumn(columnId),
      showAllColumns: () => tableCore$.showAllColumns(),
      hideAllColumns: () => tableCore$.hideAllColumns(),

      // Selection
      selectCell: (cellId: string, isMulti?: boolean) => tableInteraction$.selectCell(cellId, isMulti),
      selectRow: (rowId: string, isMulti?: boolean) => tableInteraction$.selectRow(rowId, isMulti),
      clearSelection: () => tableInteraction$.clearSelection(),
      getSelectedCells: () => tableInteraction$.selectedCells.get(),
      getSelectedRows: () => tableInteraction$.selectedRows.get(),

      // Editing
      startEdit: (cellId: string, initialValue: any) => tableInteraction$.startEdit(cellId, initialValue),
      saveEdit: () => tableInteraction$.saveEdit(),
      cancelEdit: () => tableInteraction$.cancelEdit(),

      // Viewport
      scrollTo: (top: number, left?: number) => {
        if (containerRef.current) {
          const scrollContainer = containerRef.current.querySelector('.vibegrid-viewport');
          if (scrollContainer) {
            scrollContainer.scrollTop = top;
            if (left !== undefined) {
              scrollContainer.scrollLeft = left;
            }
          }
        }
      },

      // Data access
      getProcessedRows: () => tableCore$.processedRows.get(),
      getVisibleRange: () => {
        try {
          return tableViewport$.visibleRange?.get() || { start: 0, end: 10 };
        } catch (error) {
          fileLog.error('Error getting visible range', error);
          return { start: 0, end: 10 };
        }
      },
    };
  }, [isReady]);

  // ====================================
  // RENDER
  // ====================================

  if (columns.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading table structure...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`vibegridx-container ${className}`}
      data-testid={`vibegrid-pure-${tableId}`}
      data-entity-type={entityType}
      style={{
        width,
        height,
        position: 'relative',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Show loading overlay while initializing */}
      {isLoading && (
        <div className="absolute inset-0 z-10">
          <VibeGridLoadingOverlay
            initManager={initManager}
            height={height}
            width={width}
            showDetailedProgress={false}
          />
        </div>
      )}

      {/* Status indicator */}
      {!isLoading && hasErrors && (
        <div className="p-2 mb-2 bg-red-100 text-red-700 rounded text-sm">
          Initialization issues detected. <button onClick={retry} className="underline">Retry</button>
        </div>
      )}


      {/* Header with menu components */}
      {isReady && !hasErrors && observablesRef.current && (
        <VibeGridXHeaderPure
          tableCore$={observablesRef.current.tableCore$}
          tableInteraction$={observablesRef.current.tableInteraction$}
          enableGrouping={enableGrouping}
        />
      )}

      {/* Main table container - Always render for initialization */}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <div
          ref={containerRef}
          className="vibegrid-pure-renderer h-full w-full"
          data-testid={`vibegrid-pure-renderer-${tableId}`}
          data-vibegrid-container="true"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative'
          }}
        />
      </div>

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && isReady && (
        <div className="p-2 border-t bg-muted/50 text-xs space-y-1">
          <p><strong>Architecture:</strong> Pure Observables (Legend State)</p>
          <p><strong>Renderer:</strong> SimplePassiveRenderer with init state management</p>
          <p><strong>Init Manager:</strong> ✅ All dependencies initialized</p>
          <p><strong>Event Binding:</strong> Direct DOM → Observable methods</p>
        </div>
      )}
    </div>
  );
}

export default VibeGrid;
export type { VibeGridProps };