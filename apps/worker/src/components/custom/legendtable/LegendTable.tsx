import React, { useRef, useCallback, useEffect, useState } from 'react';
import { observe } from '@legendapp/state';
import { useLegendTableState } from './hooks/use-legend-table-state';
import { useTableData } from './hooks/use-table-data';
import { useTableViewport } from './hooks/use-table-viewport';
import { TableRenderer } from './renderers/core/TableRenderer';
import type { LegendTableProps } from './types';
import { generateColumns } from './utils/legend-helpers';
import { CanvasOverlayDOM } from './overlays/CanvasOverlayDOM';
import { LegendTableEventSystem } from './events/LegendTableEventSystem';
import '../vibegrid/vibegridx.css';
import { uiLog } from '@/logger';

// Create logger instance for this file
const log = uiLog('components/custom/legendtable/LegendTable.tsx');

// Helper function to create coordinate mapping for the renderer
function createCoordinateMapping(columns: any[], rows: any[]) {
  const SELECTION_COLUMN_WIDTH = 48;
  const DEFAULT_ROW_HEIGHT = 40;
  let currentOffset = 0;
  
  // Create column coordinates
  const columnCoordinates = [];
  
  // Selection column
  columnCoordinates.push({
    columnId: '__selection',
    index: 0,
    offset: currentOffset,
    width: SELECTION_COLUMN_WIDTH
  });
  currentOffset += SELECTION_COLUMN_WIDTH;
  
  // Data columns
  columns.forEach((column, index) => {
    const width = column.width || 120;
    columnCoordinates.push({
      columnId: column.id,
      index: index + 1,
      offset: currentOffset,
      width: width
    });
    currentOffset += width;
  });
  
  // Create row coordinates
  const rowCoordinates = rows.map((row, index) => ({
    rowId: row.id,
    originalIndex: index,
    sortedIndex: index,
    offset: index * DEFAULT_ROW_HEIGHT
  }));
  
  return {
    rows: rowCoordinates,
    columns: columnCoordinates,
    version: Date.now()
  };
}

export function LegendTable(props: LegendTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlayDOM | null>(null);
  const [isRendererReady, setIsRendererReady] = useState(false);
  
  // Centralized event system
  const eventSystemRef = useRef<LegendTableEventSystem | null>(null);
  
  // Initialize Legend State
  const tableConfig = {
    tableId: props.tableId,
    columns: props.columns,
    enableSelectionColumn: props.enableSelectionColumn ?? true,
    enableVirtualScrolling: props.enableVirtualScrolling ?? true,
    enableSorting: props.enableSorting ?? true,
    enableFiltering: props.enableFiltering ?? true,
    persistState: props.persistState ?? true
  };
  
  const tableState$ = useLegendTableState(tableConfig);
  const { data$, actions: dataActions } = useTableData(props.entityType || 'generic', props.initialData);
  
  // Set up viewport management
  const viewportUtils = useTableViewport(tableState$, containerRef);
  
  // Event system will be initialized when container is ready
  
  // Initialize renderer when container is available
  useEffect(() => {
    if (!rendererContainerRef.current || rendererRef.current) {
      return;
    }
    
    log.debug('[LegendTable] Initializing TableRenderer directly');
    
    let unsubscribeSelection: (() => void) | null = null;
    
    try {
      // Create TableRenderer directly with Legend State integration
      rendererRef.current = new TableRenderer({
        container: rendererContainerRef.current,
        columns: props.columns,
        enableSelectionColumn: props.enableSelectionColumn ?? true,
        debug: true,
          
        // Handle canvas overlay setup
        onStateChange: (event) => {
          if (event.type === 'canvas.container.ready' && event.container && !canvasOverlayRef.current) {
            // Initialize overlays when canvas container is ready
            log.debug('[LegendTable] Canvas container ready, initializing overlays');
            try {
              canvasOverlayRef.current = new CanvasOverlayDOM({
                cellHeight: 40,
                selectionColor: 'rgba(59, 130, 246, 0.2)',
                selectionBorderColor: 'rgba(59, 130, 246, 0.8)',
                selectionBorderWidth: 3,
                onSelectionChange: (selectedCells) => {
                  // Forward selection to Legend State
                  tableState$.selection.selectedCells.set(selectedCells);
                  const selectedRows = new Set<string>();
                  selectedCells.forEach(cellId => {
                    const [rowId] = cellId.split(':');
                    selectedRows.add(rowId);
                  });
                  props.onSelectionChange?.(selectedCells, selectedRows);
                }
              }, (fillEvent) => {
                // Handle fill operations
                log.debug('[LegendTable] Fill event received:', fillEvent);
                
                if (fillEvent.type === 'FILL_COMPLETE' && fillEvent.fillCells) {
                  const selectedCells = tableState$.selection.selectedCells.get();
                  log.debug('[LegendTable] Executing fill operation:', {
                    sourceCells: selectedCells.size,
                    fillCells: fillEvent.fillCells.size
                  });
                  
                  // Execute the fill operation
                  tableState$.fillDown(selectedCells, fillEvent.fillCells);
                }
                
                if (fillEvent.type === 'FILL_PREVIEW' && fillEvent.previewCells && canvasOverlayRef.current) {
                  // Render fill preview
                  const viewport = tableState$.viewport.get();
                  const coordinateMapping = createCoordinateMapping(props.columns, data$.get());
                  
                  // Convert preview cells to visual positions for rendering
                  const visualCells = Array.from(fillEvent.previewCells).map(cellKey => {
                    const [rowId, columnId] = cellKey.split(':');
                    const rowCoord = coordinateMapping.rows.find(r => r.rowId === rowId);
                    const colCoord = coordinateMapping.columns.find(c => c.columnId === columnId);
                    
                    if (rowCoord && colCoord) {
                      return {
                        cellKey,
                        x: colCoord.offset,
                        y: rowCoord.offset,
                        width: colCoord.width,
                        height: 40
                      };
                    }
                    return null;
                  }).filter(cell => cell !== null);
                  
                  canvasOverlayRef.current.renderFillPreviewWithVisualPositions(visualCells);
                }
                
                if (fillEvent.type === 'FILL_CANCEL' && canvasOverlayRef.current) {
                  canvasOverlayRef.current.clearFillPreview();
                }
              });
              
              // Initialize the overlay with the container
              canvasOverlayRef.current.init(event.container);
              
              // Set initial coordinate mapping and viewport
              const initialCoordinateMapping = createCoordinateMapping(props.columns, data$.get());
              const initialViewport = tableState$.viewport.get();
              
              canvasOverlayRef.current.updateCoordinateMapping(initialCoordinateMapping);
              canvasOverlayRef.current.updateViewport(initialViewport);
              
              // Update event system with canvas overlay reference
              if (eventSystemRef.current) {
                eventSystemRef.current.updateCanvasOverlay(canvasOverlayRef.current);
                log.debug('[LegendTable] Canvas overlay reference updated in event system');
              }
              
              log.debug('[LegendTable] Canvas overlay initialized successfully with coordinate mapping');
            } catch (error) {
              console.error('[LegendTable] Failed to initialize canvas overlay:', error);
            }
          }
        },
          
        // Forward cell interaction callbacks to Legend State and user handlers
        onCellClick: (rowId: string, columnId: string) => {
          const cellId = `${rowId}:${columnId}`;
          tableState$.selectCell(cellId, false);
          props.onCellClick?.(rowId, columnId);
        },
        
        onCellDoubleClick: (rowId: string, columnId: string) => {
          tableState$.startEdit(rowId, columnId);
        },
        
        onSelectionChange: (selectedCells: Set<string>) => {
          const selectedRows = new Set<string>();
          selectedCells.forEach(cellId => {
            const [rowId] = cellId.split(':');
            selectedRows.add(rowId);
          });
          tableState$.selection.selectedCells.set(selectedCells);
          props.onSelectionChange?.(selectedCells, selectedRows);
        },
        
        onColumnClick: (columnId: string) => {
          tableState$.sortByColumn(columnId);
        },
        
        onScroll: (viewport) => {
          tableState$.setViewport(viewport);
        }
      });
      
      // Initialize the renderer with initial render state
      const initialRenderState = {
        rows: data$.get(),
        columns: props.columns,
        selectedCells: tableState$.selection.selectedCells.get(),
        editingCell: tableState$.selection.editingCell.get(),
        groupedData: [],
        optimisticOperations: new Map(),
        version: Date.now(),
        sortBy: tableState$.sorting.get().column ? [tableState$.sorting.get()] : [],
        coordinateMapping: createCoordinateMapping(props.columns, data$.get())
      };
      
      rendererRef.current.initialize(initialRenderState);
      setIsRendererReady(true);
      
      // Initialize canvas overlays after renderer is ready
      setTimeout(() => {
        if (rendererRef.current) {
          rendererRef.current.initializeCanvasPostRender();
        }
      }, 0);
      
      log.debug('[LegendTable] TableRenderer initialized successfully');
      
      // Set up overlay updates when selection changes
      unsubscribeSelection = observe(() => {
        const selectedCells = tableState$.selection.selectedCells.get();
        const viewport = tableState$.viewport.get();
        const coordinateMapping = createCoordinateMapping(props.columns, data$.get());
        
        log.debug('[LegendTable] Observer triggered', {
          selectedCellsSize: selectedCells.size,
          hasCanvasOverlay: !!canvasOverlayRef.current,
          hasRenderer: !!rendererRef.current,
          overlayRefType: typeof canvasOverlayRef.current
        });
        
        // Update overlay if it exists
        if (canvasOverlayRef.current && rendererRef.current) {
          log.debug('[LegendTable] Observer: updating overlay', {
            selectedCellsSize: selectedCells.size,
            hasViewport: !!viewport,
            hasCoordinateMapping: !!coordinateMapping,
            coordinateColumns: coordinateMapping?.columns?.length
          });
          
          // Always update coordinate mapping and viewport before selection
          canvasOverlayRef.current.updateCoordinateMapping(coordinateMapping);
          canvasOverlayRef.current.updateViewport(viewport);
          
          // Convert selected cells to visual positions for fill handle rendering - do this immediately
          const visualCells = Array.from(selectedCells).map(cellId => {
            const [rowId, columnId] = cellId.split(':');
            const rowCoord = coordinateMapping.rows.find(r => r.rowId === rowId);
            const colCoord = coordinateMapping.columns.find(c => c.columnId === columnId);
            
            if (rowCoord && colCoord) {
              return {
                cellKey: cellId,
                x: colCoord.offset,
                y: rowCoord.offset,
                width: colCoord.width,
                height: 40
              };
            }
            return null;
          }).filter(cell => cell !== null);
          
          log.debug('[LegendTable] Calling updateSelectionWithVisualPositions for fill handle', {
            selectedCells: selectedCells.size,
            visualCells: visualCells.length,
            firstVisualCell: visualCells[0]
          });
          
          canvasOverlayRef.current.updateSelectionWithVisualPositions(visualCells);
        }
      });
    } catch (error) {
      console.error('[LegendTable] Failed to initialize renderer bridge:', error);
    }
    
    return () => {
      // Cleanup observer subscription
      if (unsubscribeSelection) {
        unsubscribeSelection();
      }
      
      // Cleanup renderer
      if (rendererRef.current) {
        log.debug('[LegendTable] Cleaning up TableRenderer');
        rendererRef.current.destroy();
        rendererRef.current = null;
        setIsRendererReady(false);
      }
      
      // Cleanup canvas overlay
      if (canvasOverlayRef.current) {
        log.debug('[LegendTable] Cleaning up CanvasOverlayDOM');
        canvasOverlayRef.current.destroy();
        canvasOverlayRef.current = null;
      }
    };
  }, [props.columns, props.enableSelectionColumn, props.onCellClick, props.onSelectionChange, tableState$]);
  
  // Initialize centralized event system
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isRendererReady || !tableState$) return;
    
    log.debug('[LegendTable] Initializing centralized event system');
    
    // Create the centralized event system (canvas overlay will be updated later when ready)
    eventSystemRef.current = new LegendTableEventSystem(container, tableState$, canvasOverlayRef.current);
    
    return () => {
      log.debug('[LegendTable] Cleaning up centralized event system');
      if (eventSystemRef.current) {
        eventSystemRef.current.destroy();
        eventSystemRef.current = null;
      }
    };
  }, [isRendererReady, tableState$]);
  
  // Connect data to table state and set up renderer observers
  useEffect(() => {
    const cleanup = observe(() => {
      const data = data$.get();
      tableState$.data.set(data);
    });
    return cleanup;
  }, [data$, tableState$]);

  // Set up Legend State observers to update renderer
  useEffect(() => {
    if (!rendererRef.current) return;

    const cleanupFunctions: (() => void)[] = [];

    // Observe data changes and trigger renderer updates
    const dataCleanup = observe(() => {
      const data = tableState$.sortedData.get();
      const selectedCells = tableState$.selection.selectedCells.get();
      const editingCell = tableState$.selection.editingCell.get();
      const sorting = tableState$.sorting.get();

      if (rendererRef.current) {
        const renderState = {
          rows: data,
          columns: props.columns,
          selectedCells,
          editingCell,
          groupedData: [],
          optimisticOperations: new Map(),
          version: Date.now(),
          sortBy: sorting.column ? [sorting] : [],
          coordinateMapping: createCoordinateMapping(props.columns, data)
        };
        
        rendererRef.current.render(renderState);
      }
    });
    cleanupFunctions.push(dataCleanup);

    // Observe selection changes
    const selectionCleanup = observe(() => {
      const selectedCells = tableState$.selection.selectedCells.get();
      const selectedRows = tableState$.selection.selectedRows.get();
      
      if (rendererRef.current) {
        rendererRef.current.setSelectedCells(selectedCells);
        rendererRef.current.setSelectedRows(selectedRows);
      }
    });
    cleanupFunctions.push(selectionCleanup);

    return () => {
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, [isRendererReady, props.columns, tableState$]);
  
  // Handle cell click events
  const handleCellClick = useCallback((rowId: string, columnId: string, event: MouseEvent) => {
    const cellId = `${rowId}:${columnId}`;
    
    if (event.ctrlKey || event.metaKey) {
      // Add to selection
      const currentSelected = new Set(tableState$.selection.selectedCells.get());
      currentSelected.add(cellId);
      tableState$.selection.selectedCells.set(currentSelected);
    } else {
      // Replace selection
      tableState$.selectCell(cellId, false);
    }
    
    // Call user-provided handler
    props.onCellClick?.(rowId, columnId);
  }, [tableState$, props.onCellClick]);
  
  // Handle cell editing
  const handleCellEdit = useCallback(async (rowId: string, columnId: string, value: any) => {
    try {
      // Update local state
      tableState$.commitEdit(value);
      
      // Call user-provided handler
      if (props.onCellEdit) {
        await props.onCellEdit(rowId, columnId, value);
      }
    } catch (error) {
      // Revert on error
      tableState$.cancelEdit();
      console.error('Failed to save cell edit:', error);
    }
  }, [tableState$, props.onCellEdit]);
  
  // Get performance metrics from renderer
  const getPerformanceMetrics = useCallback(() => {
    return rendererRef.current?.getPerformanceMetrics?.() || {
      renderTime: 0,
      cellCount: 0,
      visibleRows: 0
    };
  }, []);
  
  // Render with VibeGrid TableRenderer integration
  return (
    <div
      ref={containerRef}
      className={`legend-table-container ${props.className || ''}`}
      data-testid={`legend-table-${props.tableId}`}
      style={{
        width: props.width || '100%',
        height: props.height || 400,
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        backgroundColor: 'white',
        position: 'relative',
        overflow: 'hidden' // Let VibeGrid handle scrolling
      }}
    >
      {!isRendererReady && (
        <div style={{ 
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          padding: '16px',
          textAlign: 'center',
          color: '#6b7280',
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 1000
        }}>
          <div>🔄 Initializing LegendTable...</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            Entity: {props.entityType || 'generic'} • Columns: {props.columns.length}
          </div>
        </div>
      )}
      
      {/* Dedicated container for VibeGrid TableRenderer - will be controlled by DOMSystem */}
      <div 
        ref={rendererContainerRef}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          visibility: isRendererReady ? 'visible' : 'hidden'
        }}
      />
    </div>
  );
}

// Export the performance metrics getter for external use
LegendTable.displayName = 'LegendTable';