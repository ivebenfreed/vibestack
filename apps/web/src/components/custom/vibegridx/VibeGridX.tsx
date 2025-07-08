import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { tableBaseMachine } from './machines/table-machine';
import { AtomicTableRenderer } from './renderers/AtomicTableRenderer';
import { CanvasOverlayManager } from './overlays/CanvasOverlayManager';
import { EntityIntegrationLayer, useTableConfigFromAtoms } from './integration/EntityIntegration';
import type { TableConfig, RenderState, ViewportInfo, CellRef } from './types';
import './vibegridx.css';

// ====================================
// COMPONENT PROPS
// ====================================

interface VibeGridXProps {
  entityType: 'task' | 'project' | 'user';
  tableId?: string;
  className?: string;
  height?: number;
  width?: number;
  
  // Optional external data (if not using entity integration)
  data?: any[];
  
  // Event handlers
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
}

// ====================================
// MAIN COMPONENT
// ====================================

export const VibeGridX: React.FC<VibeGridXProps> = ({
  entityType,
  tableId = `vibegridx-${entityType}-${Date.now()}`,
  className = '',
  height = 600,
  width = '100%',
  data,
  onCellClick,
  onCellDoubleClick,
  onSelectionChange,
  onEditingChange,
  onPerformanceUpdate,
  enableVirtualScrolling = true,
  enableCanvasOverlays = false,
  bufferSize = 10,
  enableGrouping = true,
  enableFiltering = true,
  enableSorting = true,
  enableDragAndDrop = true
}) => {
  
  // ====================================
  // REFS AND STATE
  // ====================================
  
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayContainerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<AtomicTableRenderer | null>(null);
  const canvasOverlayRef = useRef<CanvasOverlayManager | null>(null);
  const integrationRef = useRef<EntityIntegrationLayer | null>(null);
  const selectedCellsRef = useRef<Set<string>>(new Set());
  const anchorCellRef = useRef<CellRef | null>(null);
  
  // ====================================
  // TABLE CONFIGURATION
  // ====================================
  
  const tableConfig = useTableConfigFromAtoms(entityType, tableId);
  
  // Update table config with props
  const enhancedTableConfig: TableConfig = useMemo(() => ({
    ...tableConfig,
    settings: {
      ...tableConfig.settings,
      enableVirtualScrolling,
      enableGrouping,
      enableFiltering,
      bufferSize
    }
  }), [tableConfig, enableVirtualScrolling, enableGrouping, enableFiltering, bufferSize]);
  
  // ====================================
  // XSTATE MACHINE
  // ====================================
  
  const [tableState, tableSend, tableActor] = useMachine(tableBaseMachine, {
    input: enhancedTableConfig
  });
  
  // ====================================
  // ENTITY INTEGRATION
  // ====================================
  
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
  
  // ====================================
  // RENDERER INITIALIZATION
  // ====================================
  
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Initialize atomic renderer (DATA-ONLY)
    rendererRef.current = new AtomicTableRenderer({
      container: containerRef.current,
      onCellClick: handleCellClick,
      onCellDoubleClick: handleCellDoubleClick,
      onColumnClick: handleColumnClick,
      onStateChange: handleRendererStateChange,
      onScroll: handleScroll,
      onKeyDown: (event: KeyboardEvent) => {
        // Convert native KeyboardEvent to React.KeyboardEvent-like structure
        handleKeyDown(event as any);
      }
    });
    
    // Initialize canvas overlay after renderer creates DOM structure
    const initCanvasTimer = setTimeout(() => {
      console.log('VibeGridX: Looking for canvas overlay container...');
      const canvasContainer = containerRef.current?.querySelector('.vibegridx-canvas-overlay');
      if (!canvasContainer) {
        console.warn('VibeGridX: Canvas overlay container not found in DOM, retrying...');
        // Try again after another delay
        setTimeout(() => {
          const retryContainer = containerRef.current?.querySelector('.vibegridx-canvas-overlay');
          if (retryContainer) {
            console.log('VibeGridX: Found canvas container on retry');
            canvasOverlayRef.current = new CanvasOverlayManager(retryContainer as HTMLElement, {
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
            
            console.log('VibeGridX: Canvas Overlay initialized on retry');
            if (selectedCellsRef.current.size > 0) {
              canvasOverlayRef.current.updateSelection(selectedCellsRef.current);
            }
          } else {
            console.error('VibeGridX: Canvas overlay container still not found after retry');
          }
        }, 500);
        return;
      }
      
      // Initialize canvas overlay inside the scrollable viewport
      canvasOverlayRef.current = new CanvasOverlayManager(canvasContainer as HTMLElement, {
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
      
      console.log('VibeGridX: Initialized Canvas Overlay inside scrollable viewport');
      
      // Update with initial selection if any
      if (selectedCellsRef.current.size > 0) {
        canvasOverlayRef.current.updateSelection(selectedCellsRef.current);
      }
    }, 100); // Give renderer time to create DOM
    
    return () => {
      clearTimeout(initCanvasTimer);
      rendererRef.current?.destroy();
      rendererRef.current = null;
      canvasOverlayRef.current?.destroy();
      canvasOverlayRef.current = null;
    };
  }, []);
  
  // ====================================
  // SELECTION HELPERS
  // ====================================
  
  const calculateRangeSelection = useCallback((
    start: CellRef, 
    end: CellRef, 
    integration: EntityIntegrationLayer | null
  ): Set<string> => {
    const selection = new Set<string>();
    
    if (!integration) return selection;
    
    // Get all entity IDs and column IDs
    const entities = integration.getAllEntityData();
    const columns = integration.getColumns();
    
    const entityIds = Object.keys(entities);
    
    // Use the actual columns from the first entity's data (same as renderer does)
    const firstEntity = Object.values(entities)[0];
    const columnIds = firstEntity ? Object.keys(firstEntity) : columns.map(c => c.id);
    
    // Find indices
    const startRowIndex = entityIds.indexOf(start.rowId);
    const endRowIndex = entityIds.indexOf(end.rowId);
    const startColIndex = columnIds.indexOf(start.columnId);
    const endColIndex = columnIds.indexOf(end.columnId);
    
    console.log('calculateRangeSelection:', {
      start,
      end,
      columnIds,
      startColIndex,
      endColIndex,
      entityCount: entityIds.length,
      startColumnId: start.columnId,
      endColumnId: end.columnId,
      columnsFromIntegration: columns
    });
    
    if (startRowIndex === -1 || endRowIndex === -1 || startColIndex === -1 || endColIndex === -1) {
      console.warn('Invalid indices in range selection:', { startRowIndex, endRowIndex, startColIndex, endColIndex });
      return selection;
    }
    
    // Calculate range
    const minRow = Math.min(startRowIndex, endRowIndex);
    const maxRow = Math.max(startRowIndex, endRowIndex);
    const minCol = Math.min(startColIndex, endColIndex);
    const maxCol = Math.max(startColIndex, endColIndex);
    
    // Add all cells in range
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const rowId = entityIds[row];
        const columnId = columnIds[col];
        if (rowId && columnId) {
          selection.add(`${rowId}:${columnId}`);
        }
      }
    }
    
    console.log('Range selection calculated:', {
      minRow, maxRow,
      minCol, maxCol,
      totalCells: selection.size,
      sample: Array.from(selection).slice(0, 5)
    });
    
    return selection;
  }, []);
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  const handleCellClick = useCallback((rowId: string, columnId: string, event: MouseEvent) => {
    console.log('VibeGridX.handleCellClick:', { rowId, columnId, ctrlKey: event.ctrlKey, shiftKey: event.shiftKey });
    
    // Ensure the container has focus for keyboard events
    if (containerRef.current) {
      containerRef.current.focus();
      console.log('VibeGridX: Container focused');
    }
    
    const cellKey = `${rowId}:${columnId}`;
    
    // Immediately update canvas overlay for instant feedback
    if (canvasOverlayRef.current) {
      // Simple selection logic for immediate UI update
      const newSelection = new Set<string>();
      
      if (event.ctrlKey && selectedCellsRef.current.has(cellKey)) {
        // Multi-select: copy current selection and toggle
        selectedCellsRef.current.forEach(key => newSelection.add(key));
        newSelection.delete(cellKey);
      } else if (event.ctrlKey) {
        // Multi-select: copy current selection and add
        selectedCellsRef.current.forEach(key => newSelection.add(key));
        newSelection.add(cellKey);
      } else if (event.shiftKey && anchorCellRef.current) {
        // Range select
        const rangeSelection = calculateRangeSelection(
          anchorCellRef.current,
          { rowId, columnId },
          integrationRef.current
        );
        rangeSelection.forEach(key => newSelection.add(key));
      } else {
        // Single select - also set anchor for future shift+click
        newSelection.add(cellKey);
        anchorCellRef.current = { rowId, columnId };
      }
      
      selectedCellsRef.current = newSelection;
      console.log('Updating canvas overlay with selection:', newSelection.size);
      canvasOverlayRef.current.updateSelection(newSelection);
      
      // Log selection action
      console.log(`Selection: ${newSelection.size} cells selected`, {
        ctrl: event.ctrlKey,
        shift: event.shiftKey,
        cells: newSelection.size <= 5 ? Array.from(newSelection) : `${newSelection.size} cells`
      });
    } else {
      console.warn('Canvas overlay ref not available');
    }
    
    // Send selection event to table machine for state management
    tableSend({
      type: 'selection.cell.select',
      rowId,
      columnId,
      ctrlKey: event.ctrlKey,
      shiftKey: event.shiftKey
    });
    
    onCellClick?.(rowId, columnId);
  }, [tableSend, onCellClick]);
  
  const handleCellDoubleClick = useCallback((rowId: string, columnId: string, event: MouseEvent) => {
    // Start editing
    tableSend({
      type: 'edit.cell.start',
      rowId,
      columnId
    });
    
    onCellDoubleClick?.(rowId, columnId);
  }, [tableSend, onCellDoubleClick]);
  
  const handleColumnClick = useCallback((columnId: string, event: MouseEvent) => {
    // Select entire column
    if (integrationRef.current) {
      const entities = integrationRef.current.getAllEntityData();
      const newSelection = new Set<string>();
      
      if (event.ctrlKey && selectedCellsRef.current.size > 0) {
        // Add to existing selection
        selectedCellsRef.current.forEach(key => newSelection.add(key));
      }
      
      // Add all cells in this column
      Object.keys(entities).forEach(rowId => {
        newSelection.add(`${rowId}:${columnId}`);
      });
      
      selectedCellsRef.current = newSelection;
      canvasOverlayRef.current?.updateSelection(newSelection);
      
      console.log(`Column selection: ${columnId} - ${newSelection.size} cells selected`);
      
      // Send to XState
      tableSend({
        type: 'selection.column.select',
        columnId,
        extend: event.ctrlKey
      });
    }
  }, [tableSend]);
  
  const handleScroll = useCallback((viewport: ViewportInfo) => {
    // Update viewport in table machine
    tableSend({
      type: 'view.viewport.update',
      viewport
    });
    
    // Re-render selection overlay after scroll
    if (canvasOverlayRef.current && selectedCellsRef.current.size > 0) {
      // Use requestAnimationFrame to update after DOM is updated
      requestAnimationFrame(() => {
        canvasOverlayRef.current?.updateSelection(selectedCellsRef.current);
      });
    }
  }, [tableSend]);
  
  const handleRendererStateChange = useCallback((event: any) => {
    // Handle renderer-specific events
    if (event.type === 'render.complete') {
      if (event.renderTime > 100) {
        console.warn('Slow render detected:', event);
      }
      
      // Re-render selection overlay after render completes
      if (canvasOverlayRef.current && selectedCellsRef.current.size > 0) {
        requestAnimationFrame(() => {
          canvasOverlayRef.current?.updateSelection(selectedCellsRef.current);
        });
      }
    }
  }, []);
  
  // ====================================
  // KEYBOARD HANDLERS
  // ====================================
  
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    console.log('VibeGridX handleKeyDown:', {
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      target: event.target,
      currentTarget: event.currentTarget
    });
    
    // Handle arrow key navigation directly for instant feedback
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      
      if (selectedCellsRef.current.size === 1 && integrationRef.current) {
        const currentCellKey = Array.from(selectedCellsRef.current)[0];
        const [rowId, columnId] = currentCellKey.split(':');
        
        const entities = integrationRef.current.getAllEntityData();
        const columns = integrationRef.current.getColumns();
        
        const entityIds = Object.keys(entities);
        const columnIds = columns.map(c => c.id);
        
        const currentRowIndex = entityIds.indexOf(rowId);
        const currentColIndex = columnIds.indexOf(columnId);
        
        let newRowIndex = currentRowIndex;
        let newColIndex = currentColIndex;
        
        switch (event.key) {
          case 'ArrowUp':
            newRowIndex = Math.max(0, currentRowIndex - 1);
            break;
          case 'ArrowDown':
            newRowIndex = Math.min(entityIds.length - 1, currentRowIndex + 1);
            break;
          case 'ArrowLeft':
            newColIndex = Math.max(0, currentColIndex - 1);
            break;
          case 'ArrowRight':
            newColIndex = Math.min(columnIds.length - 1, currentColIndex + 1);
            break;
        }
        
        const newRowId = entityIds[newRowIndex];
        const newColumnId = columnIds[newColIndex];
        
        if (newRowId && newColumnId) {
          const newCellKey = `${newRowId}:${newColumnId}`;
          
          if (event.shiftKey) {
            // Extend selection
            const rangeSelection = calculateRangeSelection(
              anchorCellRef.current || { rowId, columnId },
              { rowId: newRowId, columnId: newColumnId },
              integrationRef.current
            );
            selectedCellsRef.current = rangeSelection;
            canvasOverlayRef.current?.updateSelection(rangeSelection);
          } else {
            // Move selection
            selectedCellsRef.current = new Set([newCellKey]);
            anchorCellRef.current = { rowId: newRowId, columnId: newColumnId };
            canvasOverlayRef.current?.updateSelection(selectedCellsRef.current);
          }
          
          console.log(`Keyboard nav: ${event.shiftKey ? 'Extended' : 'Moved'} to ${newCellKey}`);
        }
      }
      
      // Still send to XState for state management
      tableSend({
        type: 'keyboard.arrow',
        direction: event.key.replace('Arrow', '').toLowerCase() as any,
        extend: event.shiftKey
      });
      return;
    }
    
    // Handle other keys
    switch (event.key) {
      case 'Enter':
        event.preventDefault();
        tableSend({
          type: 'keyboard.enter',
          shift: event.shiftKey
        });
        break;
        
      case 'Escape':
        event.preventDefault();
        // Clear selection immediately
        selectedCellsRef.current.clear();
        anchorCellRef.current = null;
        canvasOverlayRef.current?.updateSelection(selectedCellsRef.current);
        
        tableSend({
          type: 'keyboard.escape'
        });
        break;
        
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        tableSend({
          type: 'keyboard.delete'
        });
        break;
        
      case 'a':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          // Select all cells
          if (integrationRef.current) {
            const entities = integrationRef.current.getAllEntityData();
            const columns = integrationRef.current.getColumns();
            const allCells = new Set<string>();
            
            Object.keys(entities).forEach(rowId => {
              columns.forEach(col => {
                allCells.add(`${rowId}:${col.id}`);
              });
            });
            
            selectedCellsRef.current = allCells;
            canvasOverlayRef.current?.updateSelection(allCells);
            console.log(`Select All: ${allCells.size} cells selected`);
          }
        }
        break;
        
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Copy event triggered:', {
            selectedCells: selectedCellsRef.current.size,
            cells: Array.from(selectedCellsRef.current).slice(0, 5)
          });
          // Show copy indicator
          canvasOverlayRef.current?.selectionManager?.showCopyIndicator(false);
          console.log('Copy: Selected cells copied to clipboard');
          tableSend({
            type: 'keyboard.copy'
          });
        }
        break;
        
      case 'x':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Cut event triggered:', {
            selectedCells: selectedCellsRef.current.size,
            cells: Array.from(selectedCellsRef.current).slice(0, 5)
          });
          // Show cut indicator
          canvasOverlayRef.current?.selectionManager?.showCopyIndicator(true);
          console.log('Cut: Selected cells cut to clipboard');
          tableSend({
            type: 'keyboard.cut'
          });
        }
        break;
        
      case 'v':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          console.log('Paste event triggered:', {
            targetCell: anchorCellRef.current,
            selectedCells: selectedCellsRef.current.size
          });
          // Hide copy/cut indicator
          canvasOverlayRef.current?.selectionManager?.hideCopyIndicator();
          console.log('Paste: Pasting clipboard content');
          tableSend({
            type: 'keyboard.paste'
          });
        }
        break;
    }
  }, [tableSend, calculateRangeSelection]);
  
  // ====================================
  // PERFORMANCE MONITORING
  // ====================================
  
  // Performance metrics are reported inline after renders to avoid dependency issues
  
  // ====================================
  // STATE-TO-RENDERER SYNC
  // ====================================
  
  // ====================================
  // ACTOR-DRIVEN RENDERING (NO REACT EFFECTS)
  // ====================================
  
  // Track if subscription is already set up to avoid duplicates
  const subscriptionRef = useRef<any>(null);
  
  useEffect(() => {
    if (!rendererRef.current || !tableActor) {
      console.log('VibeGridX: Skipping actor subscription setup - missing renderer or actor');
      return;
    }
    
    // Avoid duplicate subscriptions
    if (subscriptionRef.current) {
      console.log('VibeGridX: Subscription already exists, skipping setup');
      return;
    }
    
    console.log('VibeGridX: Setting up actor subscription for TableMachine -> AtomicRenderer');
    
    let subscriptionCount = 0;
    
    // XState v5 proper subscription pattern - listen to all state changes
    const subscription = tableActor.subscribe((snapshot) => {
      subscriptionCount++;
      
      // Only log significant state changes
      const stateValue = snapshot.value;
      const version = snapshot.context?.version;
      
      // Skip selection-only updates since we handle those directly
      const currentDataVersion = snapshot.context?.version || 0;
      const lastProcessedVersion = previousState.current.version;
      const isDataChange = lastProcessedVersion === undefined || currentDataVersion !== lastProcessedVersion;
      
      if (!isDataChange) {
        // This is likely a selection change - skip expensive processing
        return;
      }
      
      console.log('VibeGridX: Processing data change:', {
        state: stateValue,
        version: version
      });
      
      const renderState = extractRenderStateFromActor(snapshot);
      if (renderState) {
        // HYBRID RENDERING: Only process data changes
        
        // 1. Data changes - use granular updates
        if (hasDataChanged(snapshot)) {
          const { changedRows, newRows, deletedRowIds, isStructuralChange } = getChangedRows(renderState);
          
          if (isStructuralChange) {
            // Structural changes need full re-render (new rows, deleted rows, initial load)
            console.log(`VibeGridX: STRUCTURAL CHANGE - Full table re-render (${newRows.length} new, ${deletedRowIds.length} deleted, ${renderState.rows.length} total)`);
            rendererRef.current!.render(renderState);
            // Report performance metrics after render
            setTimeout(() => {
              if (rendererRef.current && onPerformanceUpdate) {
                const metrics = rendererRef.current.getPerformanceMetrics();
                if (metrics) {
                  onPerformanceUpdate({
                    lastRenderTime: metrics.lastRenderTime,
                    visibleRows: metrics.visibleRows,
                    cacheSize: metrics.cacheSize,
                    updateQueueSize: metrics.updateQueueSize,
                    timestamp: Date.now()
                  });
                }
              }
            }, 50);
          } else if (changedRows.length > 0) {
            // Only specific rows changed - update those rows only
            console.log(`VibeGridX: ROW CHANGES - Updating ${changedRows.length} specific rows`);
            rendererRef.current!.updateRows(changedRows);
            // Report performance metrics after render
            setTimeout(() => {
              if (rendererRef.current && onPerformanceUpdate) {
                const metrics = rendererRef.current.getPerformanceMetrics();
                if (metrics) {
                  onPerformanceUpdate({
                    lastRenderTime: metrics.lastRenderTime,
                    visibleRows: metrics.visibleRows,
                    cacheSize: metrics.cacheSize,
                    updateQueueSize: metrics.updateQueueSize,
                    timestamp: Date.now()
                  });
                }
              }
            }, 50);
          }
        }
        
        // 2. Editing changes go to Canvas Overlay (if needed)
        if (renderState.editingCell && canvasOverlayRef.current) {
          canvasOverlayRef.current.updateEditingCell(renderState.editingCell);
        }
        
      } else {
        console.warn('VibeGridX: extractRenderStateFromActor returned null');
      }
    });
    
    // No need for initial render trigger - machine already has data from config
    
    // Store subscription reference
    subscriptionRef.current = subscription;
    
    
    return () => {
      console.log('VibeGridX: Cleaning up actor subscriptions');
      subscription.unsubscribe();
      subscriptionRef.current = null;
    };
  }, [tableActor]); // Only depend on tableActor reference
  
  // ====================================
  // HELPER FUNCTIONS
  // ====================================
  
  // Track previous state to detect what changed
  const previousState = useRef<{
    version?: number;
    selectedCellsSize?: number;
    editingCellId?: string;
    rowData?: Map<string, any>; // Track individual row data for granular updates
    lastStateKey?: string; // Track state transitions to avoid duplicates
  }>({
    rowData: new Map()
  });
  
  const hasDataChanged = useCallback((snapshot: any): boolean => {
    const currentVersion = snapshot.context?.version || 0;
    const previousVersion = previousState.current.version;
    
    console.log('VibeGridX.hasDataChanged:', {
      currentVersion,
      previousVersion,
      isFirstRender: previousVersion === undefined,
      willRender: previousVersion === undefined || currentVersion !== previousVersion
    });
    
    // First render or version changed
    if (previousVersion === undefined || currentVersion !== previousVersion) {
      previousState.current.version = currentVersion;
      return true;
    }
    return false;
  }, []);
  
  // NEW: Detect which specific rows changed
  const getChangedRows = useCallback((renderState: RenderState): { 
    changedRows: TableRow[],
    newRows: TableRow[],
    deletedRowIds: string[],
    isStructuralChange: boolean
  } => {
    const previousRowData = previousState.current.rowData!;
    const currentRowData = new Map();
    
    const changedRows: TableRow[] = [];
    const newRows: TableRow[] = [];
    const deletedRowIds: string[] = [];
    
    // Check for new or changed rows
    renderState.rows.forEach(row => {
      currentRowData.set(row.id, row);
      
      if (!previousRowData.has(row.id)) {
        // New row
        newRows.push(row);
      } else {
        // Check if row data changed
        const previousRow = previousRowData.get(row.id);
        const currentRowString = JSON.stringify(row.data);
        const previousRowString = JSON.stringify(previousRow?.data || {});
        
        if (currentRowString !== previousRowString) {
          changedRows.push(row);
        }
      }
    });
    
    // Check for deleted rows
    previousRowData.forEach((row, rowId) => {
      if (!currentRowData.has(rowId)) {
        deletedRowIds.push(rowId);
      }
    });
    
    // Update stored row data
    previousState.current.rowData = currentRowData;
    
    // Determine if this is a structural change (needs full re-render)
    const isStructuralChange = newRows.length > 0 || deletedRowIds.length > 0 || 
                               previousRowData.size === 0; // Initial load
    
    return { changedRows, newRows, deletedRowIds, isStructuralChange };
  }, []);
  
  const hasSelectionChanged = useCallback((renderState: RenderState): boolean => {
    const currentSelectedSize = renderState.selectedCells.size;
    const currentEditingId = renderState.editingCell?.rowId + ':' + renderState.editingCell?.columnId;
    
    const previousSelectedSize = previousState.current.selectedCellsSize || 0;
    const previousEditingId = previousState.current.editingCellId || '';
    
    const hasChanged = currentSelectedSize !== previousSelectedSize || currentEditingId !== previousEditingId;
    
    if (hasChanged) {
      console.log('VibeGridX.hasSelectionChanged: Selection changed', {
        previousSize: previousSelectedSize,
        currentSize: currentSelectedSize,
        previousEditingId,
        currentEditingId,
        selectedCells: Array.from(renderState.selectedCells).slice(0, 5)
      });
      previousState.current.selectedCellsSize = currentSelectedSize;
      previousState.current.editingCellId = currentEditingId;
      return true;
    }
    return false;
  }, []);
  
  const extractRenderStateFromActor = useCallback((snapshot: any): RenderState | null => {
    if (!integrationRef.current) {
      console.warn('extractRenderStateFromActor: No integration layer available');
      return null;
    }
    
    try {
      // Get entity data from integration layer
      const entityData = integrationRef.current.getAllEntityData();
      const columns = integrationRef.current.getColumns();
      
      // Only log during initial render or when entity count changes
      const entityCount = Object.keys(entityData).length;
      if (!previousState.current.version || previousState.current.rowData?.size !== entityCount) {
        console.log(`extractRenderStateFromActor: ${entityCount} entities, ${columns.length} columns`, {
          columnIds: columns.map(c => c.id),
          firstEntity: Object.values(entityData)[0]
        });
      }
      
      // Convert to table rows with proper structure for AtomicTableRenderer
      const rows = Object.values(entityData).map((entity: any) => {
        const tableRow = {
          id: entity.id,
          data: { ...entity }, // Spread all entity fields into data
          metadata: {
            createdAt: entity.createdAt || new Date(),
            updatedAt: entity.updatedAt || new Date(),
            version: entity.version || 1,
            isNew: entity.isNew || false,
            isDirty: entity.isDirty || false
          }
        };
        
        return tableRow;
      });
      
      // Extract state from coordinators (when available)
      const selectionCoordinator = snapshot.context.actors?.selectionCoordinator;
      const editCoordinator = snapshot.context.actors?.editCoordinator;
      const viewCoordinator = snapshot.context.actors?.viewCoordinator;
      
      let selectedCells = new Set<string>();
      let editingCell = null;
      let groupedData = [];
      let optimisticOperations = new Map();
      
      // Safely extract selection state
      if (selectionCoordinator) {
        try {
          const selectionSnapshot = selectionCoordinator.getSnapshot();
          selectedCells = selectionSnapshot.context?.selectedCells || new Set();
          console.log('Extracted selection state:', {
            hasCoordinator: true,
            selectedCellsSize: selectedCells.size,
            selectedCells: Array.from(selectedCells).slice(0, 5)
          });
        } catch (error) {
          console.warn('Failed to get selection coordinator snapshot:', error);
        }
      } else {
        console.log('Selection coordinator not available yet');
      }
      
      // Safely extract edit state
      if (editCoordinator) {
        try {
          const editSnapshot = editCoordinator.getSnapshot();
          editingCell = editSnapshot.context?.editingCell || null;
          optimisticOperations = editSnapshot.context?.optimisticOperations || new Map();
        } catch (error) {
          console.warn('Failed to get edit coordinator snapshot:', error);
        }
      }
      
      // Safely extract view state
      if (viewCoordinator) {
        try {
          const viewSnapshot = viewCoordinator.getSnapshot();
          groupedData = viewSnapshot.context?.groupedData || [];
        } catch (error) {
          console.warn('Failed to get view coordinator snapshot:', error);
        }
      }
      
      const renderState = {
        rows,
        selectedCells,
        editingCell,
        groupedData,
        optimisticOperations,
        version: snapshot.context.version || 0
      };
      
      console.log('Final render state:', {
        rowCount: renderState.rows.length,
        selectedCells: renderState.selectedCells.size,
        version: renderState.version,
        firstRowData: renderState.rows[0]?.data
      });
      
      return renderState;
    } catch (error) {
      console.error('Error extracting render state:', error);
      console.error('Snapshot context:', snapshot.context);
      return null;
    }
  }, [integrationRef]);
  
  // ====================================
  // STATE MACHINE EVENT SUBSCRIPTIONS
  // ====================================
  
  // Sync selection state from coordinator on initial load
  useEffect(() => {
    if (!tableActor) return;
    
    const syncSelectionState = () => {
      const snapshot = tableActor.getSnapshot();
      const selectionCoordinator = snapshot.context.actors?.selectionCoordinator;
      
      if (selectionCoordinator) {
        const selectionSnapshot = selectionCoordinator.getSnapshot();
        const selectedCells = selectionSnapshot.context?.selectedCells || new Set();
        
        // Sync our local ref with coordinator state
        selectedCellsRef.current = new Set(selectedCells);
        
        // Update canvas if it exists
        if (canvasOverlayRef.current) {
          canvasOverlayRef.current.updateSelection(selectedCells);
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
  
  // ====================================
  // PUBLIC API METHODS
  // ====================================
  
  const vibeGridXApi = useMemo(() => ({
    // Selection API
    selectCell: (rowId: string, columnId: string) => {
      tableSend({ type: 'selection.cell.select', rowId, columnId });
    },
    
    selectRange: (start: CellRef, end: CellRef) => {
      tableSend({ type: 'selection.range.select', start, end });
    },
    
    clearSelection: () => {
      tableSend({ type: 'selection.clear' });
    },
    
    // Edit API
    startEditing: (rowId: string, columnId: string) => {
      tableSend({ type: 'edit.cell.start', rowId, columnId });
    },
    
    commitEdit: () => {
      tableSend({ type: 'edit.commit' });
    },
    
    cancelEdit: () => {
      tableSend({ type: 'edit.cancel' });
    },
    
    // View API
    setGroupBy: (groupBy: string[]) => {
      tableSend({ type: 'view.group.set', groupBy });
    },
    
    setSortBy: (sortBy: any[]) => {
      tableSend({ type: 'view.sort.set', sortBy });
    },
    
    setFilters: (filters: any[]) => {
      tableSend({ type: 'view.filter.set', filters });
    },
    
    // Data API
    createRow: (insertAfter?: string) => {
      tableSend({ type: 'edit.row.create', insertAfter });
    },
    
    // Performance API
    getMetrics: () => {
      return {
        renderer: rendererRef.current?.getPerformanceMetrics(),
        machine: {
          state: tableState.value,
          context: tableState.context
        }
      };
    },
    
    // Debug API
    getState: () => tableState,
    getActor: () => tableActor
  }), [tableSend, tableState, tableActor]);
  
  // ====================================
  // RENDER
  // ====================================
  
  return (
    <div
      className={`vibegridx-container ${className}`}
      style={{ width, height }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Atomic Renderer Container */}
      <div
        ref={containerRef}
        className="vibegridx-renderer"
      />
    </div>
  );
};

// ====================================
// EXPORT API
// ====================================

// Export the main component
export default VibeGridX;

// Export types for external use
export type { VibeGridXProps };

// Export API hook for imperative control
export const useVibeGridXRef = () => {
  const ref = useRef<any>(null);
  
  return {
    ref,
    api: ref.current || {}
  };
};