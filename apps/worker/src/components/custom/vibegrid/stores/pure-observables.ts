/**
 * Pure Observable Architecture - Three Layer Separation
 * 
 * This implements the pure observable design from PURE_OBSERVABLE_ARCHITECTURE.md
 * separating concerns into three distinct observable layers:
 * 1. tableCore$ - Data & Configuration
 * 2. tableInteraction$ - UI State (selection, editing)
 * 3. tableViewport$ - Scroll State
 */

import { observable, computed, batch } from '@legendapp/state';
import { getEntity$, entityOperations, universeSchema$, universeLoading$ } from '@/legend-state/observables';
import { uiLog } from '@/logger';
import type { Column, SortConfig, FilterConfig, GroupConfig } from '../types';

const log = uiLog('components/custom/vibegrid/stores/pure-observables.ts');

// ====================================
// TYPES
// ====================================

export interface TableCoreState {
  entityType: string;
  columns: Column[];
  columnOrder: string[];
  columnWidths: Record<string, number>;
  columnVisibility: Record<string, boolean>;
  sortBy: SortConfig[];
  filters: FilterConfig[];
  groupConfig: GroupConfig | null;
}

export interface TableInteractionState {
  // Selection state
  selectedCells: Set<string>;
  selectedRows: Set<string>;
  anchorCell: string | null;
  selectionMode: 'cell' | 'row' | 'range' | 'multi';
  isSelecting: boolean;
  
  // Select all checkbox state
  selectAllCheckboxState: {
    checked: boolean;
    indeterminate: boolean;
  };
  
  // Editing state
  editingCell: string | null;
  editValue: any;
  isEditing: boolean;
  editValidation: { isValid: boolean; message?: string } | null;
  
  // Hover state
  hoveredCell: string | null;
  hoveredRow: string | null;
  
  // Drag state
  isDragging: boolean;
  dragSource: string | null;
  dragTarget: string | null;
  
  // Resize state
  resizingColumn: string | null;
  resizeStartX: number;
  resizeStartWidth: number;
}

export interface TableViewportState {
  scrollTop: number;
  scrollLeft: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
}

// ====================================
// PURE TRANSFORMATION FUNCTIONS
// ====================================

function applyFilters(rows: any[], filters: FilterConfig[]): any[] {
  if (!filters || filters.length === 0) return rows;
  
  return rows.filter(row => {
    return filters.every(filter => {
      const value = row.data ? row.data[filter.field] : row[filter.field];
      
      switch (filter.operator) {
        case 'equals':
          return value === filter.value;
        case 'contains':
          return String(value).toLowerCase().includes(String(filter.value).toLowerCase());
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(filter.value).toLowerCase());
        case 'endsWith':
          return String(value).toLowerCase().endsWith(String(filter.value).toLowerCase());
        case 'gt':
          return Number(value) > Number(filter.value);
        case 'gte':
          return Number(value) >= Number(filter.value);
        case 'lt':
          return Number(value) < Number(filter.value);
        case 'lte':
          return Number(value) <= Number(filter.value);
        default:
          return true;
      }
    });
  });
}

function applySorting(rows: any[], sortBy: SortConfig[]): any[] {
  if (!sortBy || sortBy.length === 0) return rows;
  
  return [...rows].sort((a, b) => {
    for (const sort of sortBy) {
      const aVal = a.data ? a.data[sort.field] : a[sort.field];
      const bVal = b.data ? b.data[sort.field] : b[sort.field];
      
      if (aVal === bVal) continue;
      
      const comparison = aVal < bVal ? -1 : 1;
      return sort.direction === 'asc' ? comparison : -comparison;
    }
    return 0;
  });
}

async function applyGrouping(rows: any[], groupConfig: GroupConfig): Promise<any[]> {
  if (!groupConfig || !groupConfig.fields || groupConfig.fields.length === 0) {
    return rows;
  }
  
  // For now, return rows as-is until we implement grouping
  // This will be replaced with actual grouping logic
  return rows;
}

// ====================================
// LAYER 1: TABLE CORE (Data & Configuration)
// ====================================

export function createTableCore$(entityType: string, columns: Column[]) {
  log.info('🎯 Creating tableCore$ observable', { entityType, columnCount: columns.length });
  
  const tableCore$ = observable({
    // Don't use computed - just store the entity type and access it dynamically
    entityType,
    
    // Table configuration
    columns,
    columnOrder: columns.map(col => col.id),
    columnWidths: Object.fromEntries(columns.map(col => [col.id, col.width || 150])),
    columnVisibility: Object.fromEntries(columns.map(col => [col.id, true])),
    
    // Data transformations
    sortBy: [] as SortConfig[],
    filters: [] as FilterConfig[],
    groupConfig: null as GroupConfig | null,
    
    // Computed processed data (lazy)
    get processedRows() {
      // Check if universe schema is ready before getting entity
      const loading = universeLoading$.get();
      const schema = universeSchema$.get();
      
      if (loading || !schema?.entities || !schema.entities[entityType]) {
        log.debug('⏳ Schema not ready for processedRows', { entityType, loading });
        return [];
      }
      
      // Get entity observable directly like atomic bridge does
      const entityObs = getEntity$(entityType);
      const sortBy = tableCore$.sortBy.get();
      const filters = tableCore$.filters.get();
      const groupConfig = tableCore$.groupConfig.get();
      
      // Get the data from the entity observable
      let data = {};
      if (entityObs) {
        try {
          // Direct .get() call like atomic bridge
          data = entityObs.get() || {};
          log.debug('✅ Got entity data', {
            entityType,
            recordCount: Object.keys(data).length
          });
        } catch (error) {
          log.error('❌ Failed to get entity data', { entityType, error: error.message });
          data = {};
        }
      } else {
        log.warn('⚠️ Entity observable not available', { entityType });
      }
      
      let rows = Object.values(data || {});
      
      rows = applyFilters(rows, filters);
      rows = applySorting(rows, sortBy);
      
      // Skip async grouping in computed for now
      // if (groupConfig) {
      //   rows = applyGrouping(rows, groupConfig);
      // }
      
      log.info('🎯 Processed rows computed', {
        entityObservable: !!entityObs,
        inputCount: Object.keys(data || {}).length,
        outputCount: rows.length,
        hasFilters: filters.length > 0,
        hasSorting: sortBy.length > 0,
        hasGrouping: !!groupConfig
      });
      
      return rows;
    },
    
    // Direct manipulation methods
    toggleSort(field: string) {
      const current = tableCore$.sortBy.get();
      const index = current.findIndex(s => s.field === field);
      
      batch(() => {
        if (index === -1) {
          tableCore$.sortBy.set([...current, { field, direction: 'asc' }]);
        } else if (current[index].direction === 'asc') {
          current[index].direction = 'desc';
          tableCore$.sortBy.set([...current]);
        } else {
          tableCore$.sortBy.set(current.filter((_, i) => i !== index));
        }
      });
      
      log.info('🎯 Sort toggled', { field, sortBy: tableCore$.sortBy.get() });
    },
    
    setFilter(field: string, value: any, operator: string = 'contains') {
      batch(() => {
        const filters = tableCore$.filters.get();
        const existingIndex = filters.findIndex(f => f.field === field);
        
        if (existingIndex !== -1) {
          filters[existingIndex] = { field, value, operator };
        } else {
          filters.push({ field, value, operator });
        }
        
        tableCore$.filters.set([...filters]);
      });
      
      log.info('🎯 Filter set', { field, value, operator });
    },
    
    clearFilter(field: string) {
      const filters = tableCore$.filters.get();
      tableCore$.filters.set(filters.filter(f => f.field !== field));
      log.info('🎯 Filter cleared', { field });
    },
    
    toggleColumn(columnId: string) {
      const visibility = tableCore$.columnVisibility.get();
      tableCore$.columnVisibility.set({
        ...visibility,
        [columnId]: !visibility[columnId]
      });
      
      log.info('🎯 Column toggled', { columnId, visible: !visibility[columnId] });
    },
    
    setColumnWidth(columnId: string, width: number) {
      const widths = tableCore$.columnWidths.get();
      tableCore$.columnWidths.set({
        ...widths,
        [columnId]: width
      });
      
      log.info('🎯 Column width set', { columnId, width });
    },
    
    // Update column width (for resize overlay)
    updateColumnWidth(columnId: string, width: number) {
      batch(() => {
        const widths = { ...tableCore$.columnWidths.get() };
        widths[columnId] = width;
        tableCore$.columnWidths.set(widths);
        
        // Update columns array
        const columns = [...tableCore$.columns.get()];
        const colIndex = columns.findIndex(c => c.id === columnId);
        if (colIndex >= 0) {
          columns[colIndex] = { ...columns[colIndex], width };
          tableCore$.columns.set(columns);
        }
      });
      
      log.info('🎯 Column width updated', { columnId, width });
    },
    
    setGroupConfig(config: GroupConfig | null) {
      tableCore$.groupConfig.set(config);
      log.info('🎯 Group config set', { config });
    }
  });
  
  return tableCore$;
}

// ====================================
// LAYER 2: TABLE INTERACTION (UI State - Isolated)
// ====================================

export function createTableInteraction$(tableCore$?: any) {
  log.info('🎯 Creating tableInteraction$ observable');
  
  const tableInteraction$ = observable({
    // Selection state
    selectedCells: new Set<string>(),
    selectedRows: new Set<string>(),
    anchorCell: null as string | null,
    selectionMode: 'cell' as 'cell' | 'row' | 'range' | 'multi',
    isSelecting: false,
    
    // Select all checkbox state (computed)
    selectAllCheckboxState: computed(() => {
      if (!tableCore$) {
        return { checked: false, indeterminate: false };
      }
      
      const selectedCells = tableInteraction$.selectedCells.get();
      const processedRows = tableCore$.processedRows.get();
      const columns = tableCore$.columns.get();
      const visibleColumns = columns.filter((col: any) => {
        const visibility = tableCore$.columnVisibility.get();
        return visibility[col.id] !== false;
      });
      
      const totalCells = processedRows.length * visibleColumns.length;
      const selectedCount = selectedCells.size;
      
      if (selectedCount === 0) {
        return { checked: false, indeterminate: false };
      } else if (selectedCount === totalCells) {
        return { checked: true, indeterminate: false };
      } else {
        return { checked: false, indeterminate: true };
      }
    }),
    
    // Editing state
    editingCell: null as string | null,
    editValue: null as any,
    isEditing: false,
    editValidation: null as { isValid: boolean; message?: string } | null,
    
    // Hover state
    hoveredCell: null as string | null,
    hoveredRow: null as string | null,
    
    // Drag state
    isDragging: false,
    dragSource: null as { row: string; column: string } | null,
    dragTarget: null as { row: string; column: string } | null,
    
    // Drag selection state (for drag-to-select ranges)
    isDragSelecting: false,
    dragSelectStart: null as string | null,
    dragSelectCurrent: null as string | null,
    
    // Resize state
    resizingColumn: null as string | null,
    resizeStartX: 0,
    resizeStartWidth: 0,
    
    // Column resize state for overlay
    columnResize: null as {
      isResizing: boolean;
      columnId: string;
      startWidth: number;
      newWidth: number;
    } | null,
    
    // Direct manipulation methods
    selectCell(cellId: string, isMulti: boolean = false) {
      batch(() => {
        const cells = new Set(tableInteraction$.selectedCells.get());
        if (!isMulti) cells.clear();
        cells.add(cellId);
        tableInteraction$.selectedCells.set(cells);
        tableInteraction$.selectionMode.set('cell');
        tableInteraction$.anchorCell.set(cellId);
      });
      
      log.info('🎯 Cell selected', { cellId, isMulti });
    },
    
    toggleCellSelection(rowId: string, columnId: string, isCtrlKey: boolean = false, isShiftKey: boolean = false) {
      const cellId = `${rowId}:${columnId}`;
      batch(() => {
        const cells = new Set(tableInteraction$.selectedCells.get());
        
        if (isShiftKey && tableInteraction$.anchorCell.get()) {
          // Shift+click for range selection
          tableInteraction$.selectRange(tableInteraction$.anchorCell.get()!, cellId);
        } else if (isCtrlKey) {
          // Ctrl/Cmd+click for multi-selection toggle
          if (cells.has(cellId)) {
            cells.delete(cellId);
          } else {
            cells.add(cellId);
          }
          tableInteraction$.selectedCells.set(cells);
          if (!tableInteraction$.anchorCell.get()) {
            tableInteraction$.anchorCell.set(cellId);
          }
        } else {
          // Single click - clear and select only this cell
          cells.clear();
          cells.add(cellId);
          tableInteraction$.selectedCells.set(cells);
          tableInteraction$.anchorCell.set(cellId);
        }
        
        tableInteraction$.selectionMode.set('cell');
      });
      
      log.info('🎯 Cell selection toggled', { 
        cellId, 
        isCtrlKey, 
        isShiftKey,
        selectedCount: tableInteraction$.selectedCells.get().size 
      });
    },
    
    selectRow(rowId: string, isMulti: boolean = false) {
      batch(() => {
        const rows = new Set(tableInteraction$.selectedRows.get());
        if (!isMulti) rows.clear();
        rows.add(rowId);
        tableInteraction$.selectedRows.set(rows);
        tableInteraction$.selectionMode.set('row');
      });
      
      log.info('🎯 Row selected', { rowId, isMulti });
    },
    
    selectRange(startCell: string, endCell: string) {
      batch(() => {
        tableInteraction$.selectionMode.set('range');
        tableInteraction$.anchorCell.set(startCell);
        
        // Calculate rectangular range selection
        const cells = new Set<string>();
        
        if (tableCore$) {
          // Parse start and end cell coordinates
          const [startRowId, startColId] = startCell.split(':');
          const [endRowId, endColId] = endCell.split(':');
          
          // Get current processed rows and columns
          const processedRows = tableCore$.processedRows.get();
          const columns = tableCore$.columns.get();
          
          // Find indices of start and end positions
          const startRowIndex = processedRows.findIndex((row: any) => row.id === startRowId);
          const endRowIndex = processedRows.findIndex((row: any) => row.id === endRowId);
          const startColIndex = columns.findIndex((col: any) => col.id === startColId);
          const endColIndex = columns.findIndex((col: any) => col.id === endColId);
          
          // Calculate rectangular bounds
          const minRowIndex = Math.min(startRowIndex, endRowIndex);
          const maxRowIndex = Math.max(startRowIndex, endRowIndex);
          const minColIndex = Math.min(startColIndex, endColIndex);
          const maxColIndex = Math.max(startColIndex, endColIndex);
          
          // Select all cells in the rectangle
          for (let r = minRowIndex; r <= maxRowIndex; r++) {
            for (let c = minColIndex; c <= maxColIndex; c++) {
              if (r >= 0 && r < processedRows.length && c >= 0 && c < columns.length) {
                const rowId = processedRows[r].id;
                const columnId = columns[c].id;
                cells.add(`${rowId}:${columnId}`);
              }
            }
          }
          
          log.info('🎯 Rectangular range selected', {
            startCell,
            endCell,
            bounds: { minRowIndex, maxRowIndex, minColIndex, maxColIndex },
            selectedCount: cells.size
          });
        } else {
          // Fallback to just start and end cells if no tableCore$ access
          cells.add(startCell);
          cells.add(endCell);
        }
        
        tableInteraction$.selectedCells.set(cells);
      });
      
      log.info('🎯 Range selected', { startCell, endCell, selectedCount: tableInteraction$.selectedCells.get().size });
    },
    
    // Drag selection methods
    startDragSelection(cellId: string) {
      batch(() => {
        tableInteraction$.isDragSelecting.set(true);
        tableInteraction$.dragSelectStart.set(cellId);
        tableInteraction$.dragSelectCurrent.set(cellId);
        
        // Start with single cell selection
        const cells = new Set<string>();
        cells.add(cellId);
        tableInteraction$.selectedCells.set(cells);
        tableInteraction$.anchorCell.set(cellId);
        tableInteraction$.selectionMode.set('range');
      });
      
      log.info('🎯 Drag selection started', { cellId });
    },
    
    updateDragSelection(cellId: string) {
      if (!tableInteraction$.isDragSelecting.get()) return;
      
      const startCell = tableInteraction$.dragSelectStart.get();
      if (!startCell) return;
      
      batch(() => {
        tableInteraction$.dragSelectCurrent.set(cellId);
        
        // Calculate rectangular range selection
        const cells = new Set<string>();
        
        if (tableCore$) {
          // Parse start and end cell coordinates
          const [startRowId, startColId] = startCell.split(':');
          const [endRowId, endColId] = cellId.split(':');
          
          // Get current processed rows and columns
          const processedRows = tableCore$.processedRows.get();
          const columns = tableCore$.columns.get();
          
          // Find indices of start and end positions
          const startRowIndex = processedRows.findIndex((row: any) => row.id === startRowId);
          const endRowIndex = processedRows.findIndex((row: any) => row.id === endRowId);
          const startColIndex = columns.findIndex((col: any) => col.id === startColId);
          const endColIndex = columns.findIndex((col: any) => col.id === endColId);
          
          // Calculate rectangular bounds
          const minRowIndex = Math.min(startRowIndex, endRowIndex);
          const maxRowIndex = Math.max(startRowIndex, endRowIndex);
          const minColIndex = Math.min(startColIndex, endColIndex);
          const maxColIndex = Math.max(startColIndex, endColIndex);
          
          // Select all cells in the rectangle
          for (let r = minRowIndex; r <= maxRowIndex; r++) {
            for (let c = minColIndex; c <= maxColIndex; c++) {
              if (r >= 0 && r < processedRows.length && c >= 0 && c < columns.length) {
                const rowId = processedRows[r].id;
                const columnId = columns[c].id;
                cells.add(`${rowId}:${columnId}`);
              }
            }
          }
          
          log.info('🎯 Rectangular range calculated', {
            startCell,
            endCell: cellId,
            bounds: { minRowIndex, maxRowIndex, minColIndex, maxColIndex },
            selectedCount: cells.size
          });
        } else {
          // Fallback to just start and end cells if no tableCore$ access
          cells.add(startCell);
          cells.add(cellId);
        }
        
        tableInteraction$.selectedCells.set(cells);
      });
      
      log.info('🎯 Drag selection updated', { startCell, currentCell: cellId, selectedCount: tableInteraction$.selectedCells.get().size });
    },
    
    endDragSelection() {
      batch(() => {
        tableInteraction$.isDragSelecting.set(false);
        tableInteraction$.dragSelectStart.set(null);
        tableInteraction$.dragSelectCurrent.set(null);
      });
      
      log.info('🎯 Drag selection ended');
    },
    
    clearSelection() {
      batch(() => {
        tableInteraction$.selectedCells.set(new Set());
        tableInteraction$.selectedRows.set(new Set());
        tableInteraction$.anchorCell.set(null);
        tableInteraction$.isSelecting.set(false);
      });
      
      log.info('🎯 Selection cleared');
    },
    
    startEdit(cellId: string, initialValue?: any) {
      batch(() => {
        tableInteraction$.editingCell.set(cellId);
        tableInteraction$.editValue.set(initialValue || '');
        tableInteraction$.isEditing.set(true);
        tableInteraction$.editValidation.set(null);
      });
      
      log.info('🎯 Edit started', { cellId, initialValue });
    },
    
    updateEditValue(value: any) {
      tableInteraction$.editValue.set(value);
    },
    
    validateEdit(isValid: boolean, message?: string) {
      tableInteraction$.editValidation.set({ isValid, message });
    },
    
    async saveEdit() {
      const cellId = tableInteraction$.editingCell.get();
      const value = tableInteraction$.editValue.get();
      
      if (cellId) {
        const [rowId, columnId] = cellId.split(':');
        
        log.info('🎯 Saving edit', { cellId, value, rowId, columnId });
        
        // Ensure we have a valid tableCore$ reference
        if (!tableCore$) {
          throw new Error('tableCore$ is not available in saveEdit method');
        }
        
        // Get the entity type from the tableCore$ - make sure to get the actual value, not observable
        const entityType = tableCore$.entityType.get ? tableCore$.entityType.get() : tableCore$.entityType;
        
        try {
          
          log.info('🔄 Attempting to save edit', { entityType, rowId, columnId, value });
          
          // CORRECT LEGEND STATE PATTERN: Use syncedCrud with .get() and .set()
          // Import the correct entity operations
          const { getUniverseEntity$, entityOperations } = await import('@/legend-state/observables');
          
          // Use the org-prefixed entity name directly
          // Legend State getEntity$() expects org-prefixed names for proper lookup
          const orgPrefixedEntityName = entityType;
          
          log.info('🔄 Using entityOperations.updateEntity for database persistence', { 
            originalEntityType: entityType,
            orgPrefixedEntityName: orgPrefixedEntityName,
            rowId,
            columnId,
            value 
          });
          
          await entityOperations.updateEntity(orgPrefixedEntityName, rowId, {
            [columnId]: value
          });
          
          log.info('✅ Edit saved successfully via syncedCrud', { entityType, rowId, columnId, value });
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          log.error('❌ Error saving edit', { cellId, value, error: errorMessage });
          
          // Show user-friendly error
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('vibestack:edit-error', {
              detail: { 
                entityType: entityType, 
                rowId, 
                columnId, 
                value, 
                error: errorMessage 
              }
            }));
          }
        }
      }
      
      tableInteraction$.cancelEdit();
    },
    
    cancelEdit() {
      batch(() => {
        tableInteraction$.editingCell.set(null);
        tableInteraction$.editValue.set(null);
        tableInteraction$.isEditing.set(false);
        tableInteraction$.editValidation.set(null);
      });
      
      log.info('🎯 Edit cancelled');
    },
    
    setHoveredCell(cellId: string | null) {
      tableInteraction$.hoveredCell.set(cellId);
    },
    
    setHoveredRow(rowId: string | null) {
      tableInteraction$.hoveredRow.set(rowId);
    },
    
    startDrag(sourceId: string) {
      batch(() => {
        tableInteraction$.isDragging.set(true);
        tableInteraction$.dragSource.set(sourceId);
      });
      
      log.info('🎯 Drag started', { sourceId });
    },
    
    updateDragTarget(targetId: string | null) {
      tableInteraction$.dragTarget.set(targetId);
    },
    
    endDrag() {
      const source = tableInteraction$.dragSource.get();
      const target = tableInteraction$.dragTarget.get();
      
      if (source && target && source !== target) {
        log.info('🎯 Drag completed', { source, target });
        // Implement actual drag logic here
      }
      
      batch(() => {
        tableInteraction$.isDragging.set(false);
        tableInteraction$.dragSource.set(null);
        tableInteraction$.dragTarget.set(null);
      });
    },
    
    startColumnResize(columnId: string, startX: number, startWidth: number) {
      batch(() => {
        tableInteraction$.resizingColumn.set(columnId);
        tableInteraction$.resizeStartX.set(startX);
        tableInteraction$.resizeStartWidth.set(startWidth);
      });
      
      log.info('🎯 Column resize started', { columnId, startX, startWidth });
    },
    
    endColumnResize() {
      tableInteraction$.resizingColumn.set(null);
      log.info('🎯 Column resize ended');
    }
  });
  
  return tableInteraction$;
}

// ====================================
// LAYER 3: TABLE VIEWPORT (Scroll State - Completely Independent)
// ====================================

export function createTableViewport$() {
  log.info('🎯 Creating tableViewport$ observable');
  
  const tableViewport$ = observable({
    // Scroll position
    scrollTop: 0,
    scrollLeft: 0,
    
    // Viewport dimensions
    viewportWidth: 0,
    viewportHeight: 0,
    
    // Content dimensions
    contentWidth: 0,
    contentHeight: 0,
    
    // Visible range (computed from scroll)
    visibleRange: function() {
      const top = tableViewport$.scrollTop.get();
      const height = tableViewport$.viewportHeight.get();
      const rowHeight = 40; // TODO: Make this configurable
      
      const start = Math.floor(top / rowHeight);
      const end = Math.ceil((top + height) / rowHeight);
      
      return {
        start: Math.max(0, start - 5), // 5 row buffer
        end: end + 5 // 5 row buffer
      };
    },
    
    // Visible columns (computed from horizontal scroll)
    visibleColumns: function() {
      const left = tableViewport$.scrollLeft.get();
      const width = tableViewport$.viewportWidth.get();
      
      // TODO: Calculate based on column widths
      return {
        start: 0,
        end: 20 // Show all columns for now
      };
    },
    
    // Direct manipulation methods
    updateScroll(top: number, left: number) {
      batch(() => {
        tableViewport$.scrollTop.set(top);
        tableViewport$.scrollLeft.set(left);
      });
      
      log.debug('🎯 Scroll updated', { top, left });
    },
    
    updateViewport(width: number, height: number) {
      batch(() => {
        tableViewport$.viewportWidth.set(width);
        tableViewport$.viewportHeight.set(height);
      });
      
      log.info('🎯 Viewport updated', { width, height });
    },
    
    updateContent(width: number, height: number) {
      batch(() => {
        tableViewport$.contentWidth.set(width);
        tableViewport$.contentHeight.set(height);
      });
      
      log.info('🎯 Content dimensions updated', { width, height });
    },
    
    scrollToRow(rowIndex: number) {
      const rowHeight = 40;
      const newTop = rowIndex * rowHeight;
      tableViewport$.scrollTop.set(newTop);
      
      log.info('🎯 Scrolled to row', { rowIndex, scrollTop: newTop });
    },
    
    scrollToColumn(columnIndex: number, columnWidths: number[]) {
      let newLeft = 0;
      for (let i = 0; i < columnIndex && i < columnWidths.length; i++) {
        newLeft += columnWidths[i];
      }
      tableViewport$.scrollLeft.set(newLeft);
      
      log.info('🎯 Scrolled to column', { columnIndex, scrollLeft: newLeft });
    },
    
    ensureCellVisible(rowIndex: number, columnIndex: number, columnWidths: number[]) {
      const rowHeight = 40;
      const rowTop = rowIndex * rowHeight;
      const rowBottom = rowTop + rowHeight;
      
      const currentTop = tableViewport$.scrollTop.get();
      const viewportHeight = tableViewport$.viewportHeight.get();
      const currentBottom = currentTop + viewportHeight;
      
      // Adjust vertical scroll if needed
      if (rowTop < currentTop) {
        tableViewport$.scrollTop.set(rowTop);
      } else if (rowBottom > currentBottom) {
        tableViewport$.scrollTop.set(rowBottom - viewportHeight);
      }
      
      // Adjust horizontal scroll if needed
      let columnLeft = 0;
      for (let i = 0; i < columnIndex && i < columnWidths.length; i++) {
        columnLeft += columnWidths[i];
      }
      const columnRight = columnLeft + (columnWidths[columnIndex] || 150);
      
      const currentLeft = tableViewport$.scrollLeft.get();
      const viewportWidth = tableViewport$.viewportWidth.get();
      const currentRight = currentLeft + viewportWidth;
      
      if (columnLeft < currentLeft) {
        tableViewport$.scrollLeft.set(columnLeft);
      } else if (columnRight > currentRight) {
        tableViewport$.scrollLeft.set(columnRight - viewportWidth);
      }
      
      log.info('🎯 Ensured cell visible', { rowIndex, columnIndex });
    }
  });
  
  return tableViewport$;
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createPureObservables(entityType: string, columns: Column[]) {
  log.info('🎯 Creating pure observables for table', { entityType, columns: columns.length });
  
  const tableCore$ = createTableCore$(entityType, columns);
  
  return {
    tableCore$,
    tableInteraction$: createTableInteraction$(tableCore$),
    tableViewport$: createTableViewport$()
  };
}

// Export types for external use
export type TableCore$ = ReturnType<typeof createTableCore$>;
export type TableInteraction$ = ReturnType<typeof createTableInteraction$>;
export type TableViewport$ = ReturnType<typeof createTableViewport$>;