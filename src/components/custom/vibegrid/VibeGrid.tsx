import React, { useEffect, useRef, useState, useMemo } from 'react';
import { createTableCore$, createTableCoreSync$ } from './stores/data-state';
import { createTableInteraction$ } from './stores/interaction-state';
import { SimplePassiveRenderer } from './renderers/core/SimplePassiveRenderer';
import { VibeGridXHeaderPure } from './components/VibeGridXHeaderPure';
import type { Column, GroupConfig } from './types';
import { log } from '@/logger';
import { createVibeGridVisualState } from './stores/visual-state';
import { universeOrgId$, universeUserId$ } from '@/legend-state/observables';
import { observable } from '@legendapp/state';
import { createHydrationManager, type VibeGridHydrationManager } from './stores/init-state';
import { VibeGridLoadingOverlay, useVibeGridLoadingState } from './components/VibeGridLoadingOverlay';
import { createVibeGridPreferences } from './stores/simple-persistence';

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
    visualStateRef.current = createVibeGridVisualState(entityType);
  }
  const visualState = visualStateRef.current;

  // Create simple persistence instance (isolated per VibeGrid)
  const simplePersistenceRef = useRef<ReturnType<typeof createVibeGridPreferences> | null>(null);
  if (!simplePersistenceRef.current) {
    simplePersistenceRef.current = createVibeGridPreferences(entityType);
  }
  const simplePersistence = simplePersistenceRef.current;

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

      // Create the three-layer observables directly with visual state connection
      const { tableCore$, tableCoreSync$ } = createTableCore$(entityType, columns, visualState.visualInputs$);
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

      fileLog.debug('✅ Created pure observables', { entityType, columnCount: columns.length });

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

        // Initialize simple persistence with columns first
        simplePersistence.operations.initializeColumns(columns);

        // Initialize visual state columns
        visualState.visualOperations.initializeColumns(columns, entityType, orgId, userId);

        // Keep visual state synchronized with tableCore$ observables
        visualState.visualInputs$.columns.set(columns);

        // Load saved preferences from simple persistence and apply to visual state
        const savedPrefs = simplePersistence.preferences$.get();
        if (savedPrefs.columnWidths && Object.keys(savedPrefs.columnWidths).length > 0) {
          visualState.visualInputs$.columnWidths.set(savedPrefs.columnWidths);
          fileLog.info('✅ Loaded column widths from simple persistence', { columnWidths: savedPrefs.columnWidths });
        }
        if (savedPrefs.columnOrder && savedPrefs.columnOrder.length > 0) {
          visualState.visualInputs$.columnOrder.set(savedPrefs.columnOrder);
          fileLog.info('✅ Loaded column order from simple persistence', { columnOrder: savedPrefs.columnOrder });
        }
        if (savedPrefs.columnVisibility && Object.keys(savedPrefs.columnVisibility).length > 0) {
          visualState.visualInputs$.columnVisibility.set(savedPrefs.columnVisibility);
          fileLog.info('✅ Loaded column visibility from simple persistence', { columnVisibility: savedPrefs.columnVisibility });
        }
        if (savedPrefs.sortBy) {
          // Handle both direct array and Legend State wrapped format
          const sortByArray = savedPrefs.sortBy.value || savedPrefs.sortBy;
          if (Array.isArray(sortByArray) && sortByArray.length > 0) {
            visualState.visualInputs$.sortBy.set(sortByArray);
            fileLog.info('✅ Loaded sort configuration from simple persistence', { sortBy: sortByArray });
          }
        }
        if (savedPrefs.filters && savedPrefs.filters.length > 0) {
          visualState.visualInputs$.filters.set(savedPrefs.filters);
          fileLog.info('✅ Loaded filters from simple persistence', { filters: savedPrefs.filters });
        }
        // Group configuration - Debug what we have
        fileLog.info('🔍 Group config debugging', {
          hasGroupConfig: !!savedPrefs.groupConfig,
          groupConfig: savedPrefs.groupConfig,
          hasFields: !!savedPrefs.groupConfig?.fields,
          fieldsIsArray: Array.isArray(savedPrefs.groupConfig?.fields),
          fieldsLength: savedPrefs.groupConfig?.fields?.length,
          validationPasses: !!(savedPrefs.groupConfig && savedPrefs.groupConfig.fields && Array.isArray(savedPrefs.groupConfig.fields) && savedPrefs.groupConfig.fields.length > 0)
        });

        if (savedPrefs.groupConfig && savedPrefs.groupConfig.fields && Array.isArray(savedPrefs.groupConfig.fields) && savedPrefs.groupConfig.fields.length > 0) {
          try {
            // Convert serializable GroupConfig (with Array) back to runtime GroupConfig (with Set)
            const runtimeGroupConfig: GroupConfig = {
              fields: savedPrefs.groupConfig.fields,
              sortBy: savedPrefs.groupConfig.sortBy || 'name',
              sortDirection: savedPrefs.groupConfig.sortDirection || 'asc',
              aggregations: savedPrefs.groupConfig.aggregations || [],
              expandedGroups: new Set(savedPrefs.groupConfig.expandedGroups || []), // Convert Array back to Set
              colorScheme: savedPrefs.groupConfig.colorScheme || 'auto'
            };
            visualState.visualInputs$.groupConfig.set(runtimeGroupConfig);
            fileLog.info('✅ Loaded group configuration from simple persistence', {
              groupConfig: runtimeGroupConfig,
              fieldsCount: runtimeGroupConfig.fields.length,
              expandedGroupsCount: runtimeGroupConfig.expandedGroups.size
            });
          } catch (error) {
            fileLog.error('❌ Failed to load group configuration from persistence', { error, savedGroupConfig: savedPrefs.groupConfig });
          }
        }

        // Load row ordering from persistence
        if (savedPrefs.flatRowOrder && savedPrefs.flatRowOrder.length > 0) {
          tableCore$.flatRowOrder.set(savedPrefs.flatRowOrder);
          fileLog.info('✅ Loaded flat row order from simple persistence', {
            rowCount: savedPrefs.flatRowOrder.length,
            firstFew: savedPrefs.flatRowOrder.slice(0, 3)
          });
        }

        if (savedPrefs.groupRowOrders && Object.keys(savedPrefs.groupRowOrders).length > 0) {
          tableCore$.groupRowOrders.set(savedPrefs.groupRowOrders);
          fileLog.info('✅ Loaded group row orders from simple persistence', {
            groupCount: Object.keys(savedPrefs.groupRowOrders).length,
            groups: Object.keys(savedPrefs.groupRowOrders)
          });
        }

        // Set up reactive sync from visual state to simple persistence
        // Watch for changes and save them automatically
        visualState.visualInputs$.columnWidths.onChange((newWidths) => {
          Object.entries(newWidths).forEach(([columnId, width]) => {
            simplePersistence.operations.setColumnWidth(columnId, width);
          });
          fileLog.debug('💾 Saved column widths to simple persistence', { newWidths });
        });

        visualState.visualInputs$.columnOrder.onChange((newOrder) => {
          simplePersistence.operations.setColumnOrder(newOrder);
          fileLog.debug('💾 Saved column order to simple persistence', { newOrder });
        });

        visualState.visualInputs$.columnVisibility.onChange((newVisibility) => {
          Object.entries(newVisibility).forEach(([columnId, visible]) => {
            simplePersistence.operations.setColumnVisibility(columnId, visible);
          });
          fileLog.debug('💾 Saved column visibility to simple persistence', { newVisibility });
        });

        visualState.visualInputs$.sortBy.onChange((newSortBy) => {
          simplePersistence.operations.setSortBy(newSortBy);
          fileLog.debug('💾 Saved sort configuration to simple persistence', { newSortBy });
        });

        // Use a debounced approach to prevent partial saves from rapid updates
        let groupConfigSaveTimeout: NodeJS.Timeout | null = null;

        visualState.visualInputs$.groupConfig.onChange((newGroupConfig) => {
          fileLog.info('🔍 Group config onChange triggered', {
            newGroupConfig,
            hasFields: !!newGroupConfig?.fields,
            fieldsLength: newGroupConfig?.fields?.length,
            fields: newGroupConfig?.fields,
            sortBy: newGroupConfig?.sortBy,
            sortDirection: newGroupConfig?.sortDirection,
            expandedGroups: newGroupConfig?.expandedGroups
          });

          // Clear any pending save
          if (groupConfigSaveTimeout) {
            clearTimeout(groupConfigSaveTimeout);
          }

          // Debounce the save to prevent partial updates from interfering
          groupConfigSaveTimeout = setTimeout(() => {
            const currentConfig = visualState.visualInputs$.groupConfig.get();

            // Only save if we have a complete group config or null (to clear)
            if (currentConfig === null || (currentConfig && currentConfig.fields && currentConfig.fields.length > 0)) {
              simplePersistence.operations.setGroupConfig(currentConfig);
              fileLog.debug('💾 Saved group configuration to simple persistence', { currentConfig });
            } else {
              fileLog.warn('⚠️ Skipping incomplete group config save', {
                currentConfig,
                hasFields: !!currentConfig?.fields,
                fieldsLength: currentConfig?.fields?.length
              });
            }
          }, 100); // Small delay to let any rapid updates settle
        });

        visualState.visualInputs$.filters.onChange((newFilters) => {
          simplePersistence.operations.setFilters(newFilters);
          fileLog.debug('💾 Saved filters to simple persistence', { newFilters });
        });

        // Row order persistence - flat mode (ungrouped)
        tableCore$.flatRowOrder.onChange((newFlatRowOrder) => {
          simplePersistence.operations.setFlatRowOrder(newFlatRowOrder);
          fileLog.debug('📋 Saved flat row order to simple persistence', {
            rowCount: newFlatRowOrder.length,
            firstFew: newFlatRowOrder.slice(0, 3)
          });
        });

        // Row order persistence - grouped mode
        tableCore$.groupRowOrders.onChange((newGroupRowOrders) => {
          fileLog.debug('🔍 DEBUG: groupRowOrders.onChange fired', {
            newGroupRowOrders,
            type: typeof newGroupRowOrders,
            keys: Object.keys(newGroupRowOrders || {}),
            entries: Object.entries(newGroupRowOrders || {})
          });

          // Save each group row order separately
          Object.entries(newGroupRowOrders).forEach(([groupId, rowOrder]) => {
            fileLog.debug('🔍 DEBUG: Processing group row order entry', {
              groupId,
              rowOrder,
              groupIdType: typeof groupId,
              rowOrderType: typeof rowOrder
            });
            simplePersistence.operations.setGroupRowOrder(groupId, rowOrder);
          });
          fileLog.debug('📋 Saved group row orders to simple persistence', {
            groupCount: Object.keys(newGroupRowOrders).length,
            groups: Object.keys(newGroupRowOrders)
          });
        });

        // Group config persistence is now handled by reactive persistence wrapper

        fileLog.info('🎯 Visual state initialized with simple persistence', {
          entityType, orgId, userId,
          columnsCount: columns.length,
          hasPersistedState: !!(savedPrefs.columnWidths && Object.keys(savedPrefs.columnWidths).length > 0)
        });
        initManager.markReady('visualStateReady');
      } else {
        fileLog.warn('⚠️ Cannot initialize visual state - missing orgId or userId', { orgId, userId });
        initManager.markError('visualStateReady', 'Missing orgId or userId', true);
      }

      // Wait for container ref to be available for renderer initialization (optimized)
      let retryCount = 0;
      const maxRetries = 30; // Reduced max retries since we're using RAF

      const checkReadyToInitializeRenderer = () => {
        // First check if container ref is available
        if (!containerRef.current) {
          retryCount++;
          if (retryCount < maxRetries) {
            fileLog.debug(`🔄 Container ref not ready, using RAF (attempt ${retryCount}/${maxRetries})`);
            requestAnimationFrame(checkReadyToInitializeRenderer);
            return;
          } else {
            fileLog.error('❌ Container ref is null after max retries, giving up');
            initManager.markError('containerReady', 'Container element not available for VibeGrid initialization', true);
            return;
          }
        }

        // PERFORMANCE: Skip dimension check during initialization to prevent forced reflows
        // The container will get dimensions during the rendering process
        const containerElement = containerRef.current;
        fileLog.debug('🔄 Container ref ready, proceeding with initialization', {
          hasContainer: !!containerElement,
          className: containerElement.className
        });

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
          visualState,
          initManager: initManager,
          enableSelectionColumn,
          bufferSize,
          onEntityUpdate,
          onBatchEntityUpdate,
          // sortedProcessedRows$ now created internally by renderer
        });

        rendererRef.current = renderer;
        // Don't mark as ready yet - renderer will do this after postInitialize

        fileLog.info('✅ SimplePassiveRenderer created successfully');

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

        // Don't mark dependencies here - renderer will mark them when ready
        // This prevents premature initialization signals

        // Coordinate state initialization with overall VibeGrid initialization
        initManager.isFullyHydrated$.onChange((isFullyInitialized) => {
          if (isFullyInitialized) {
            fileLog.info('🎯 VibeGrid fully ready', {
              entityType,
              tableId
            });
          }
        });
      };

      // Start checking for container readiness after a small delay to allow React to render
      // Use RAF instead of setTimeout for better performance
      requestAnimationFrame(checkReadyToInitializeRenderer);

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
          visualState={visualState}
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