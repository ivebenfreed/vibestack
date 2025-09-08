// ====================================
// UNIFIED TABLE RENDERER
// ====================================
// Single renderer that handles both flat and grouped data with full interactivity.
// Consolidates CleanTableRenderer + EnhancedTableRenderer into one system.

import type { 
  TableRow, 
  Column, 
  RenderState, 
  RendererOptions, 
  CellRef, 
  ViewportInfo,
  SortConfig,
  VirtualRow,
  VirtualRowType,
  GroupNode,
  GroupConfig
} from '../../types';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

// Import extracted utilities
import {
  ROW_HEIGHT,
  GROUP_ROW_HEIGHT,
  SUMMARY_ROW_HEIGHT,
  calculateRowOffset,
  calculateTotalHeight,
  findVisibleRange,
  applyRowTypeClasses,
  createRowElement
} from '../utils/row-rendering';
import {
  createCellElement,
  createCheckbox,
  createCellContent,
  updateCellContent,
  createHeaderCell
} from '../utils/cell-rendering';
import {
  createGroupToggle,
  createGroupHeaderContent,
  groupDataByField,
  calculateGroupAggregations,
  applyGroupRowStyles,
  applySummaryRowStyles
} from '../utils/group-behaviors';
import {
  setupColumnDragHandlers,
  setupColumnResizeHandlers,
  setupRowSelectionHandlers,
  setupCellEditingHandlers,
  setupKeyboardHandlers,
  setupContextMenuHandlers,
  setupRowDragHandlers
} from '../utils/interaction-handlers';

// File-level log control
const LOG_LEVEL: LogLevel | undefined = undefined;  // Use global (quiet)
const log = createLogger('UnifiedTableRenderer', LOG_LEVEL);

// ====================================
// UNIFIED ROW MODEL
// ====================================

export interface UnifiedTableRow {
  id: string;
  type: 'data' | 'group' | 'summary';
  data: Record<string, any>;
  level?: number;        // Nesting level for groups
  isExpanded?: boolean;  // For group headers
  groupId?: string;      // Parent group reference
  height: number;        // Dynamic row height
  originalData?: TableRow; // Reference to original data for compatibility
}

// ====================================
// CONSTANTS
// ====================================

const HEADER_HEIGHT = 40;
const BUFFER_ROWS = 5;

// ====================================
// CALLBACKS
// ====================================

interface RendererCallbacks {
  onSort?: (field: string) => void;
  onColumnResize?: (columnId: string, width: number) => void;
  onColumnReorder?: (columnId: string, newIndex: number) => void;
  onSelectionChange?: (selectedRows: Set<string>) => void;
  onCellEdit?: (rowId: string, columnId: string, value: any) => void;
  onScroll?: (viewport: ViewportInfo) => void;
  onStateChange?: (state: any) => void;
}

// ====================================
// UNIFIED TABLE RENDERER
// ====================================

export class UnifiedTableRenderer {
  // DOM elements
  private container: HTMLElement;
  private table: HTMLElement;
  private header: HTMLElement;
  private viewport: HTMLElement;
  private body: HTMLElement;
  private canvasContainer: HTMLElement;
  
  // State
  private state: RenderState | null = null;
  private unifiedRows: UnifiedTableRow[] = [];
  private visibleRange = { start: 0, end: 0 };
  private selectedRows = new Set<string>();
  private groupConfig: GroupConfig | null = null;
  private expandedGroups = new Set<string>();
  
  // Caches - unified for all row types
  private rowElements = new Map<string, HTMLElement>();
  private cellElements = new Map<string, HTMLElement>(); // key: "rowId:columnId"
  
  // Interaction state
  private cleanupKeyboard: (() => void) | null = null;
  private focusedCell: { rowId: string; columnId: string } | null = null;
  private editingCell: { rowId: string; columnId: string } | null = null;
  
  // Options and callbacks
  private options: RendererOptions;
  private callbacks: RendererCallbacks;
  
  // NEW: Legend State integration - no data duplication
  private entityType: string | null = null;
  private legendStateObservable: any = null;  // The Legend State entity observable
  private uiStore: any = null;  // The simplified UI store
  
  // Drag state
  private dragState: {
    type: 'column' | 'resize' | 'row' | null;
    columnId: string | null;
    rowId: string | null;
    startX: number;
    startY: number;
    startWidth: number;
    startMouseX?: number;
    startMouseY?: number;
  } = { type: null, columnId: null, rowId: null, startX: 0, startY: 0, startWidth: 0 };
  
  private mouseMovedDuringDrag = false;
  private _scrollRAF: number | null = null;
  private dragPreview: HTMLElement | null = null;
  private dropIndicator: HTMLElement | null = null;
  private _lastTargetIndex: number = -1;
  private _lastCalculatedTargetIndex: number = -1;

  constructor(options: RendererOptions) {
    this.options = options;
    this.container = options.container;
    
    // Validate container
    if (!this.container) {
      console.error('[UnifiedTableRenderer] Constructor received undefined container');
      throw new Error('UnifiedTableRenderer requires a valid container element');
    }
    
    // Extract callbacks from options
    this.callbacks = {
      onSort: options.onColumnClick,
      onColumnResize: options.onColumnResizeEnd,
      onColumnReorder: options.onColumnDragEnd,
      onScroll: options.onScroll,
      onStateChange: options.onStateChange
    };
    
    this.initializeDOM();
    this.attachEventListeners();
    
    // Store instance on window for EventDelegationManager access
    (window as any).__vibegridx_renderer_instance = this;
  }

  // ====================================
  // LEGEND STATE INTEGRATION
  // ====================================
  
  /**
   * Setup unified reactive data architecture:
   * - Legend State observable for all table data (single source of truth)
   * - UI Store for rendering instructions only (column visibility, sorting, etc.)
   */
  setLegendStateIntegration(entityType: string, legendStateObservable: any, uiStore: any): void {
    log.info('🔗 UnifiedTableRenderer: Setting up Legend State integration', {
      entityType,
      hasLegendState: !!legendStateObservable,
      hasUIStore: !!uiStore
    });
    
    this.entityType = entityType;
    this.legendStateObservable = legendStateObservable;
    this.uiStore = uiStore;
  }

  // ====================================
  // DOM INITIALIZATION
  // ====================================
  
  private initializeDOM(): void {
    if (!this.container) {
      console.error('[UnifiedTableRenderer] Container is undefined - cannot initialize DOM');
      return;
    }
    
    // Clear container
    this.container.innerHTML = '';
    
    // Create structure
    this.table = this.createElement('div', 'vibegridx-table');
    this.header = this.createElement('div', 'vibegridx-header');
    this.viewport = this.createElement('div', 'vibegridx-viewport');
    this.body = this.createElement('div', 'vibegridx-body');
    this.canvasContainer = this.createElement('div', 'vibegridx-canvas-overlay-container');
    
    // Apply styles
    Object.assign(this.viewport.style, {
      position: 'relative',
      overflow: 'auto',
      flex: '1'
    });
    
    Object.assign(this.body.style, {
      position: 'relative'
    });
    
    Object.assign(this.canvasContainer.style, {
      position: 'absolute',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '100'
    });
    
    // Assemble
    this.body.appendChild(this.canvasContainer);
    this.viewport.appendChild(this.body);
    this.table.appendChild(this.header);
    this.table.appendChild(this.viewport);
    this.container.appendChild(this.table);
    
    // Notify about canvas container
    if (this.callbacks.onStateChange) {
      setTimeout(() => {
        this.callbacks.onStateChange!({
          type: 'canvas.container.ready',
          container: this.canvasContainer
        });
      }, 0);
    }
  }

  // ====================================
  // UNIFIED RENDER METHOD
  // ====================================
  
  render(state: RenderState): void {
    // Set state first so getVisibleColumns can use it
    this.state = state;
    
    log.info('UnifiedTableRenderer: render() called', {
      columnCount: state.columns?.length,
      hasLegendStateIntegration: !!(this.legendStateObservable && this.uiStore),
      entityType: this.entityType,
      version: state.version,
      columnVisibility: state.columnVisibility,
      visibleColumnCount: this.getVisibleColumns().length
    });
    
    // Update group configuration
    this.groupConfig = state.groupConfig || null;
    if (state.groupConfig) {
      this.expandedGroups = state.groupConfig.expandedGroups;
    }
    
    // Convert to unified row model
    this.convertToUnifiedRows(state);
    
    // Update dimensions
    this.updateDimensions();
    
    // Render header
    this.renderHeader();
    
    // Calculate visible rows
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    this.updateVisibleRange(scrollTop, viewportHeight);
    
    // Render all visible rows (unified approach)
    this.renderRows();
    
    // Cleanup old rows
    this.cleanupRows();
    
    // Ensure header is synchronized with current scroll position
    this.syncHeaderScroll();
  }

  // ====================================
  // UNIFIED ROW MODEL CONVERSION
  // ====================================
  
  private convertToUnifiedRows(state: RenderState): void {
    this.unifiedRows = [];
    
    // UNIFIED APPROACH: Get data directly from Legend State, UI state from UI store
    if (!this.legendStateObservable || !this.uiStore) {
      log.error('🔗 UnifiedTableRenderer: Legend State integration not configured', {
        hasLegendState: !!this.legendStateObservable,
        hasUIStore: !!this.uiStore,
        entityType: this.entityType
      });
      return;
    }

    const rawData = this.legendStateObservable.get(); // Direct from Legend State
    const uiState = this.uiStore.getSnapshot(); // Get UI configuration
    
    if (!rawData || typeof rawData !== 'object') {
      log.warn('🔗 UnifiedTableRenderer: No data available from Legend State', {
        rawDataType: typeof rawData,
        hasData: !!rawData,
        entityType: this.entityType
      });
      return;
    }

    const entityRecords = Object.values(rawData);
    
    // Check for grouping from BOTH state and UI store
    const stateGroupConfig = state.groupConfig;
    const uiGroupConfig = uiState.context?.groupConfig;
    const groupConfig = stateGroupConfig || uiGroupConfig;
    
    // Debug grouping state
    log.info('🔗 UnifiedTableRenderer: Grouping state debug', {
      hasStateGroupConfig: !!stateGroupConfig,
      stateGroupConfig: stateGroupConfig,
      hasUIGroupConfig: !!uiGroupConfig,
      uiGroupConfig: uiGroupConfig,
      finalGroupConfig: groupConfig,
      contextKeys: Object.keys(uiState.context || {}),
      uiStateKeys: Object.keys(uiState || {})
    });
    
    // Check if grouping is enabled
    if (groupConfig && groupConfig.fields && groupConfig.fields.length > 0) {
      // GROUPED RENDERING: Create group headers + data rows
      log.info('🔗 UnifiedTableRenderer: Processing grouped data', {
        groupFields: groupConfig.fields.map(f => f.field),
        entityCount: entityRecords.length,
        expandedGroups: Array.from(groupConfig.expandedGroups || new Set())
      });
      
      // Update expanded groups from config
      this.expandedGroups = groupConfig.expandedGroups || new Set();
      this.createGroupedUnifiedRows(entityRecords, groupConfig);
    } else {
      // FLAT RENDERING: Convert Legend State entities to unified rows
      entityRecords.forEach((entity: any) => {
        if (entity && typeof entity === 'object' && entity.id) {
          const unifiedRow: UnifiedTableRow = {
            id: entity.id,
            type: 'data',
            data: entity, // Direct entity data from Legend State
            height: ROW_HEIGHT,
            originalData: {
              id: entity.id,
              data: entity,
              metadata: {
                isSelected: false,
                isDirty: false,
                isGroup: false,
                level: 0
              }
            }
          };
          
          this.unifiedRows.push(unifiedRow);
        }
      });
    }
    
    // Apply sorting from UI store
    if (uiState.context.sortBy && uiState.context.sortBy.length > 0) {
      this.applySortingToUnifiedRows(uiState.context.sortBy);
    }
    
    // Apply filtering from UI store
    if (uiState.context.filters && uiState.context.filters.length > 0) {
      this.applyFiltersToUnifiedRows(uiState.context.filters);
    }
    
    log.info('🔗 UnifiedTableRenderer: Converted from Legend State', {
      totalRows: this.unifiedRows.length,
      dataRows: this.unifiedRows.filter(r => r.type === 'data').length,
      entityType: this.entityType,
      appliedSort: uiState.context.sortBy?.length > 0,
      appliedFilters: uiState.context.filters?.length > 0
    });
  }

  /**
   * Create grouped unified rows with group headers and data rows
   */
  private createGroupedUnifiedRows(entityRecords: any[], groupConfig: any): void {
    // Group entities by the first grouping field
    const groupField = groupConfig.fields[0].field;
    const groupMap = new Map<string, any[]>();
    
    // Group the data
    entityRecords.forEach(entity => {
      if (entity && typeof entity === 'object' && entity.id) {
        const groupValue = String(entity[groupField] || 'Ungrouped');
        if (!groupMap.has(groupValue)) {
          groupMap.set(groupValue, []);
        }
        groupMap.get(groupValue)!.push(entity);
      }
    });
    
    // Check if we have expanded groups from the group config
    const expandedGroups = groupConfig.expandedGroups || new Set();
    const hasExpandedGroups = expandedGroups.size > 0;
    const shouldAutoExpand = !hasExpandedGroups && groupMap.size > 0;
    
    if (shouldAutoExpand) {
      log.info('🔗 UnifiedTableRenderer: Auto-expanding all groups (no groups currently expanded)', {
        totalGroups: groupMap.size,
        expandedGroupsSize: expandedGroups.size
      });
      // Auto-expand all groups
      for (const [groupValue] of groupMap) {
        const groupId = `group_${groupField}_${groupValue}`;
        expandedGroups.add(groupId);
      }
      this.expandedGroups = expandedGroups;
    } else {
      this.expandedGroups = expandedGroups;
    }
    
    // Create unified rows with group headers + data rows
    let rowIndex = 0;
    for (const [groupValue, groupEntities] of groupMap) {
      const groupId = `group_${groupField}_${groupValue}`;
      
      // Determine if this group should be expanded
      const isExpanded = this.expandedGroups.has(groupId);
      
      // Create group header row
      const groupHeaderRow: UnifiedTableRow = {
        id: groupId,
        type: 'group',
        data: {
          id: groupId,
          field: groupField,
          displayValue: groupValue,
          value: groupValue,
          rowCount: groupEntities.length,
          aggregations: [],
          isExpanded: isExpanded
        },
        height: GROUP_ROW_HEIGHT,
        level: 0,
        isExpanded: isExpanded,
        groupId: groupId,
        originalData: null
      };
      
      this.unifiedRows.push(groupHeaderRow);
      rowIndex++;
      
      // Add data rows for this group (if expanded)
      if (isExpanded) {
        groupEntities.forEach(entity => {
          const dataRow: UnifiedTableRow = {
            id: entity.id,
            type: 'data',
            data: entity,
            height: ROW_HEIGHT,
            level: 1, // Indented under group header
            groupId: groupId,
            originalData: {
              id: entity.id,
              data: entity,
              metadata: {
                isSelected: false,
                isDirty: false,
                isGroup: false,
                level: 1
              }
            }
          };
          
          this.unifiedRows.push(dataRow);
          rowIndex++;
        });
      }
    }
    
    log.info('🔗 UnifiedTableRenderer: Created grouped unified rows', {
      totalGroups: groupMap.size,
      totalUnifiedRows: this.unifiedRows.length,
      groupHeaders: this.unifiedRows.filter(r => r.type === 'group').length,
      dataRows: this.unifiedRows.filter(r => r.type === 'data').length,
      expandedGroups: this.unifiedRows.filter(r => r.type === 'group' && r.isExpanded).length,
      autoExpandApplied: shouldAutoExpand
    });
  }

  // ====================================
  // REACTIVE DATA PROCESSING
  // ====================================
  
  /**
   * Apply sorting to unified rows based on UI store configuration
   */
  private applySortingToUnifiedRows(sortBy: Array<{ field: string; direction: 'asc' | 'desc' }>): void {
    if (sortBy.length === 0) return;
    
    this.unifiedRows.sort((a, b) => {
      for (const sort of sortBy) {
        const aValue = a.data[sort.field];
        const bValue = b.data[sort.field];
        
        // Handle null/undefined
        if (aValue == null && bValue == null) continue;
        if (aValue == null) return sort.direction === 'asc' ? 1 : -1;
        if (bValue == null) return sort.direction === 'asc' ? -1 : 1;
        
        let comparison = 0;
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          const aStr = String(aValue).toLowerCase();
          const bStr = String(bValue).toLowerCase();
          comparison = aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        }
        
        if (comparison !== 0) {
          return sort.direction === 'desc' ? -comparison : comparison;
        }
      }
      return 0;
    });
    
    log.info('🔗 UnifiedTableRenderer: Applied sorting', {
      sortFields: sortBy.map(s => `${s.field}:${s.direction}`)
    });
  }
  
  /**
   * Apply filtering to unified rows based on UI store configuration
   */
  private applyFiltersToUnifiedRows(filters: Array<{ field: string; operator: string; value: any }>): void {
    if (filters.length === 0) return;
    
    const originalCount = this.unifiedRows.length;
    
    this.unifiedRows = this.unifiedRows.filter(row => {
      return filters.every(filter => {
        const fieldValue = row.data[filter.field];
        
        switch (filter.operator) {
          case 'equals':
            return fieldValue === filter.value;
          case 'contains':
            return String(fieldValue).toLowerCase().includes(String(filter.value).toLowerCase());
          case 'startsWith':
            return String(fieldValue).toLowerCase().startsWith(String(filter.value).toLowerCase());
          case 'endsWith':
            return String(fieldValue).toLowerCase().endsWith(String(filter.value).toLowerCase());
          case 'gt':
            return Number(fieldValue) > Number(filter.value);
          case 'gte':
            return Number(fieldValue) >= Number(filter.value);
          case 'lt':
            return Number(fieldValue) < Number(filter.value);
          case 'lte':
            return Number(fieldValue) <= Number(filter.value);
          case 'isEmpty':
            return fieldValue == null || String(fieldValue).trim() === '';
          case 'isNotEmpty':
            return fieldValue != null && String(fieldValue).trim() !== '';
          default:
            return true;
        }
      });
    });
    
    log.info('🔗 UnifiedTableRenderer: Applied filtering', {
      originalCount,
      filteredCount: this.unifiedRows.length,
      filterCount: filters.length
    });
  }

  // ====================================
  // HEADER RENDERING
  // ====================================
  
  private renderHeader(): void {
    if (!this.state?.columns) {
      log.warn('UnifiedTableRenderer: No columns provided to renderHeader');
      return;
    }
    
    // Force complete re-render of header
    while (this.header.firstChild) {
      this.header.removeChild(this.header.firstChild);
    }
    
    // Create header row container
    const headerRow = this.createElement('div', 'vibegridx-header-row');
    headerRow.style.height = `${HEADER_HEIGHT}px`;
    headerRow.style.position = 'relative';
    headerRow.style.display = 'flex';
    headerRow.style.width = 'fit-content';
    
    // Get visible columns only (filter out hidden columns)
    const visibleColumns = this.getVisibleColumns();
    
    // Render visible columns in order
    visibleColumns.forEach((column, index) => {
      const colMapping = this.state!.coordinateMapping?.columns.find((cm: any) => cm.columnId === column.id);
      
      const mapping = colMapping || {
        columnId: column.id,
        index: index,
        offset: index * 120,
        width: column.width || 120
      };
      
      const headerCell = this.createHeaderCell(column, mapping);
      headerRow.appendChild(headerCell);
    });
    
    this.header.appendChild(headerRow);
  }
  
  private createHeaderCell(column: Column, colMapping: any): HTMLElement {
    // Use utility to create header cell
    const cell = createHeaderCell(
      column,
      colMapping.width,
      column.sortable !== false,
      column.resizable !== false
    );
    
    // Add sort indicator if not selection column
    if (column.id !== '__selection' && column.sortable !== false) {
      const currentSortState = this.getCurrentSortState();
      const sortConfig = currentSortState.find(s => s.field === (column.field || column.id));
      
      const contentWrapper = cell.querySelector('div') as HTMLElement;
      if (contentWrapper) {
        const sortIcon = this.createSortIcon(sortConfig);
        contentWrapper.appendChild(sortIcon);
        
        // Add sort state class to header cell
        cell.classList.remove('sort-asc', 'sort-desc');
        if (sortConfig) {
          cell.classList.add(`sort-${sortConfig.direction}`);
        }
      }
    }
    
    // Update checkbox state for selection header
    if (column.id === '__selection') {
      const checkbox = cell.querySelector('.vibegridx-checkbox') as HTMLInputElement;
      if (checkbox) {
        const dataRows = this.unifiedRows.filter(r => r.type === 'data');
        checkbox.checked = dataRows.length > 0 && 
          dataRows.every(row => this.selectedRows.has(row.id));
      }
    }
    
    // Setup column drag and resize handlers
    if (column.id !== '__selection') {
      setupColumnDragHandlers(
        cell,
        column,
        (columnId, e) => {
          this.dragState.type = 'column';
          this.dragState.columnId = columnId;
        },
        (columnId, e) => {
          this.dragState.type = null;
          this.dragState.columnId = null;
          this.callbacks.onColumnReorder?.(columnId, 0); // TODO: Calculate new index
        },
        (e) => {
          // Handle drag over
        },
        (targetColumnId, e) => {
          // Handle drop
          if (this.dragState.columnId && this.dragState.columnId !== targetColumnId) {
            // TODO: Calculate new positions and reorder
          }
        }
      );
    }
    
    return cell;
  }

  private createSortIcon(sortConfig?: SortConfig): HTMLElement {
    const icon = document.createElement('span');
    icon.className = 'vibegridx-sort-icon';
    
    icon.style.marginLeft = '4px';
    icon.style.opacity = sortConfig ? '1' : '0.5';
    icon.style.flexShrink = '0';
    
    const ascOpacity = sortConfig?.direction === 'asc' ? '1' : '0.3';
    const descOpacity = sortConfig?.direction === 'desc' ? '1' : '0.3';
    
    icon.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M3 5L6 2L9 5" stroke="currentColor" stroke-width="1.5" opacity="${ascOpacity}"/>
        <path d="M3 7L6 10L9 7" stroke="currentColor" stroke-width="1.5" opacity="${descOpacity}"/>
      </svg>
    `;
    
    return icon;
  }

  private getCurrentSortState(): Array<{ field: string; direction: 'asc' | 'desc' }> {
    // NEW: Get sort state from UI store if available
    if (this.uiStore) {
      const uiState = this.uiStore.getSnapshot();
      const sortBy = uiState.context.sortBy || [];
      
      log.info('🔗 UnifiedTableRenderer: Using sort state from UI store', {
        sortFields: sortBy.map((s: any) => `${s.field}:${s.direction}`)
      });
      
      return sortBy;
    }
    
    // Fallback to render state
    return this.state?.sortBy || [];
  }

  // ====================================
  // UNIFIED ROW RENDERING
  // ====================================
  
  private renderRows(): void {
    if (!this.state?.columns) {
      log.warn('UnifiedTableRenderer: renderRows - missing columns');
      return;
    }
    
    if (this.unifiedRows.length === 0) {
      log.warn('UnifiedTableRenderer: renderRows - no unified rows');
      return;
    }
    
    const { start, end } = this.visibleRange;
    const visibleRows = this.unifiedRows.slice(start, end);
    
    log.info('UnifiedTableRenderer: renderRows', {
      visibleRangeStart: start,
      visibleRangeEnd: end,
      visibleRowCount: visibleRows.length
    });
    
    visibleRows.forEach((unifiedRow, index) => {
      const absoluteIndex = start + index;
      this.renderUnifiedRow(unifiedRow, absoluteIndex);
    });
  }

  private renderUnifiedRow(unifiedRow: UnifiedTableRow, absoluteIndex: number): void {
    let rowEl = this.rowElements.get(unifiedRow.id);
    
    if (!rowEl) {
      // Create new row element
      rowEl = this.createUnifiedRowElement(unifiedRow, absoluteIndex);
      this.rowElements.set(unifiedRow.id, rowEl);
      this.body.appendChild(rowEl);
    } else {
      // Update position
      const offset = this.calculateRowOffset(absoluteIndex);
      rowEl.style.top = `${offset}px`;
      rowEl.style.height = `${unifiedRow.height}px`;
    }
    
    // Apply type-specific styling and behaviors
    this.applyRowTypeStyles(rowEl, unifiedRow);
    
    // Render row content based on type
    this.renderRowContent(rowEl, unifiedRow);
    
    // Attach full interactivity to all row types
    this.attachRowInteractions(rowEl, unifiedRow);
  }

  private createUnifiedRowElement(unifiedRow: UnifiedTableRow, index: number): HTMLElement {
    const offset = this.calculateRowOffset(index);
    // Use utility function for creating row element
    const rowEl = createRowElement(unifiedRow, offset);
    
    // Setup row interactivity based on type
    if (unifiedRow.type === 'data') {
      setupRowSelectionHandlers(
        rowEl,
        unifiedRow.id,
        (rowId, multi, range) => this.handleRowSelection(rowId, multi, range)
      );
      
      setupRowDragHandlers(
        rowEl,
        unifiedRow.id,
        unifiedRow.type,
        (rowId) => this.handleRowDragStart(rowId),
        (e, targetRowId) => this.handleRowDragOver(e, targetRowId),
        (sourceRowId, targetRowId, position) => this.handleRowDrop(sourceRowId, targetRowId, position)
      );
    }
    
    return rowEl;
  }

  private applyRowTypeStyles(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    // Use utility function for applying row type classes
    applyRowTypeClasses(rowEl, unifiedRow);
    
    // Apply nesting styles for grouped rows
    if (unifiedRow.level && unifiedRow.level > 0) {
      rowEl.style.paddingLeft = `${unifiedRow.level * 20}px`;
    } else {
      rowEl.style.paddingLeft = '';
    }
    
    // Apply type-specific styling using utilities
    if (unifiedRow.type === 'group') {
      applyGroupRowStyles(rowEl);
    } else if (unifiedRow.type === 'summary') {
      applySummaryRowStyles(rowEl);
    }
  }

  private renderRowContent(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    // Clear existing content
    rowEl.innerHTML = '';
    
    if (unifiedRow.type === 'group') {
      this.renderGroupRowContent(rowEl, unifiedRow);
    } else if (unifiedRow.type === 'summary') {
      this.renderSummaryRowContent(rowEl, unifiedRow);
    } else {
      // Data row - render cells normally
      this.renderDataRowContent(rowEl, unifiedRow);
    }
  }

  private renderGroupRowContent(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    const groupNode = unifiedRow.data as GroupNode;
    const isExpanded = this.expandedGroups.has(groupNode.id);
    
    // Use utility to create group header content
    const content = createGroupHeaderContent(
      groupNode,
      isExpanded,
      (groupId) => this.toggleGroup(groupId)
    );
    
    rowEl.appendChild(content);
  }

  private renderSummaryRowContent(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    // TODO: Implement summary row rendering
    const summaryEl = this.createElement('span', 'vibegridx-summary-content');
    summaryEl.textContent = 'Summary Row';
    rowEl.appendChild(summaryEl);
  }

  private renderDataRowContent(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    if (!this.state?.columns) return;
    
    // Get visible columns only (filter out hidden columns)
    const visibleColumns = this.getVisibleColumns();
    
    // Render cells for visible columns only
    visibleColumns.forEach((column, index) => {
      const colMapping = this.state!.coordinateMapping?.columns.find((cm: any) => cm.columnId === column.id);
      
      const mapping = colMapping || {
        columnId: column.id,
        index: index,
        offset: index * 120,
        width: column.width || 120
      };
      
      const cell = this.createCell(unifiedRow, column, mapping);
      rowEl.appendChild(cell);
      
      const cellKey = `${unifiedRow.id}:${column.id}`;
      this.cellElements.set(cellKey, cell);
      
      // Update cell content
      this.updateCellContent(cell, unifiedRow, column);
    });
  }

  private createCell(unifiedRow: UnifiedTableRow, column: Column, colMapping: any): HTMLElement {
    // Use utility to create cell element
    const cell = createCellElement(
      unifiedRow.id,
      column,
      colMapping.width,
      unifiedRow.height
    );
    
    // Setup cell editing handlers for data cells
    if (unifiedRow.type === 'data' && column.id !== '__selection') {
      setupCellEditingHandlers(
        cell,
        unifiedRow.id,
        column.id,
        (rowId, columnId) => this.startCellEdit(rowId, columnId),
        (rowId, columnId, value) => this.callbacks.onCellEdit?.(rowId, columnId, value),
        (rowId, columnId) => {
          this.editingCell = null;
          if (this.callbacks.onStateChange) {
            this.callbacks.onStateChange({
              type: 'cell.edit.cancel',
              rowId,
              columnId
            });
          }
        }
      );
    }
    
    return cell;
  }

  private updateCellContent(cell: HTMLElement, unifiedRow: UnifiedTableRow, column: Column): void {
    const value = unifiedRow.data[column.field || column.id];
    const isSelected = this.selectedRows.has(unifiedRow.id);
    
    // Use utility to update cell content
    updateCellContent(cell, value, column, isSelected);
  }

  // ====================================
  // FULL INTERACTIVITY FOR ALL ROW TYPES
  // ====================================
  
  private attachRowInteractions(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    // All rows support:
    // - Selection (click)
    // - Context menu (right-click)
    // - Keyboard navigation
    // - Drag and drop (depending on type)
    
    // Selection is handled by event delegation
    // Context menus are handled by event delegation
    // Keyboard navigation is handled by event delegation
    
    // Type-specific interactions
    if (unifiedRow.type === 'data') {
      // Data rows support editing
      rowEl.setAttribute('data-editable', 'true');
    } else if (unifiedRow.type === 'group') {
      // Group rows support expand/collapse
      rowEl.setAttribute('data-expandable', 'true');
    }
    
    // All rows support drag and drop for reordering
    rowEl.setAttribute('draggable', 'true');
  }

  // ====================================
  // GROUP INTERACTIONS
  // ====================================
  
  
  private toggleGroup(groupId: string): void {
    log.info('UnifiedTableRenderer: toggleGroup', { groupId });
    
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        type: 'group.toggle',
        groupId
      });
    }
  }

  // ====================================
  // UTILITIES
  // ====================================
  
  private getVisibleColumns(): Column[] {
    if (!this.state?.columns) return [];
    
    // NEW: Get column visibility from UI store if available
    let columnVisibility: Record<string, boolean> = {};
    
    if (this.uiStore) {
      const uiState = this.uiStore.getSnapshot();
      columnVisibility = uiState.context.columnVisibility || {};
      
      log.info('🔗 UnifiedTableRenderer: Using column visibility from UI store', {
        hiddenCount: Object.values(columnVisibility).filter(v => v === false).length,
        visibleCount: Object.values(columnVisibility).filter(v => v !== false).length
      });
    } else {
      // Fallback to render state
      columnVisibility = this.state.columnVisibility || {};
    }
    
    // Filter to visible columns only
    return this.state.columns.filter(col => columnVisibility[col.id] !== false);
  }
  
  private createElement(tag: string, className: string): HTMLElement {
    const el = document.createElement(tag);
    el.className = className;
    return el;
  }


  private updateDimensions(): void {
    if (!this.state) return;
    
    let totalWidth = 0;
    let totalHeight = 0;
    
    if (this.state.coordinateMapping) {
      totalWidth = this.state.coordinateMapping.columns.reduce(
        (sum: number, col: any) => sum + col.width, 0
      );
      totalHeight = this.state.coordinateMapping.totalHeight || 0;
    } else if (this.state.columns) {
      totalWidth = this.state.columns.reduce(
        (sum: number, col: Column) => sum + (col.width || 120), 0
      );
    }
    
    // Calculate height from unified rows if not provided
    if (!totalHeight) {
      totalHeight = this.unifiedRows.reduce((sum, row) => sum + row.height, 0);
    }
    
    this.body.style.width = `${totalWidth}px`;
    this.body.style.height = `${totalHeight}px`;
    
    log.info('UnifiedTableRenderer: Updated dimensions', {
      totalWidth,
      totalHeight,
      unifiedRowCount: this.unifiedRows.length
    });
  }

  private updateVisibleRange(scrollTop?: number, viewportHeight?: number): void {
    scrollTop = scrollTop ?? this.viewport.scrollTop;
    viewportHeight = viewportHeight ?? this.viewport.clientHeight;
    
    // Use utility function for finding visible range
    this.visibleRange = findVisibleRange(
      this.unifiedRows,
      scrollTop,
      viewportHeight,
      BUFFER_ROWS
    );
  }

  private calculateRowOffset(virtualIndex: number): number {
    // Use utility function for calculating row offset
    return calculateRowOffset(this.unifiedRows, virtualIndex);
  }

  private cleanupRows(): void {
    if (this.unifiedRows.length === 0) return;
    
    const visibleIds = new Set(
      this.unifiedRows.slice(this.visibleRange.start, this.visibleRange.end).map(r => r.id)
    );
    
    this.rowElements.forEach((rowEl, rowId) => {
      if (!visibleIds.has(rowId)) {
        rowEl.remove();
        this.rowElements.delete(rowId);
        
        // Clean up cell cache
        this.cellElements.forEach((_, key) => {
          if (key.startsWith(`${rowId}:`)) {
            this.cellElements.delete(key);
          }
        });
      }
    });
  }

  private syncHeaderScroll(): void {
    if (!this._scrollRAF) {
      this._scrollRAF = requestAnimationFrame(() => {
        const scrollLeft = this.viewport.scrollLeft;
        this.header.style.transform = `translateX(-${scrollLeft}px)`;
        this._scrollRAF = null;
      });
    }
  }

  // ====================================
  // EVENT HANDLING
  // ====================================
  
  private attachEventListeners(): void {
    // Scroll
    this.viewport.addEventListener('scroll', this.handleScroll);
    
    // Selection
    this.table.addEventListener('change', this.handleCheckboxChange);
    
    // Header interactions
    this.header.addEventListener('click', this.handleHeaderClick);
    this.header.addEventListener('mousedown', this.handleHeaderMouseDown);
    
    // Row interactions
    this.body.addEventListener('click', this.handleBodyClick);
    this.body.addEventListener('dblclick', this.handleBodyDoubleClick);
    
    // Keyboard navigation
    this.cleanupKeyboard = setupKeyboardHandlers(
      this.table,
      (direction) => this.handleKeyboardNavigation(direction),
      () => this.startCellEdit(),
      () => this.deleteCellContent(),
      () => this.selectAll(),
      () => this.copySelection(),
      () => this.pasteSelection(),
      () => this.undo(),
      () => this.redo()
    );
    
    // Context menu
    setupContextMenuHandlers(this.table, (x, y, context) => {
      this.handleContextMenu(x, y, context);
    });
  }

  private handleScroll = (): void => {
    const scrollTop = this.viewport.scrollTop;
    const scrollLeft = this.viewport.scrollLeft;
    const viewportHeight = this.viewport.clientHeight;
    const viewportWidth = this.viewport.clientWidth;
    
    this.updateVisibleRange(scrollTop, viewportHeight);
    if (this.state) {
      this.renderRows();
      this.cleanupRows();
    }
    
    this.syncHeaderScroll();
    
    this.callbacks.onScroll?.({
      start: this.visibleRange.start,
      end: this.visibleRange.end,
      height: viewportHeight,
      width: viewportWidth,
      scrollTop: scrollTop,
      scrollLeft: scrollLeft,
      itemHeight: ROW_HEIGHT
    });
  };

  private handleCheckboxChange = (e: Event): void => {
    const target = e.target as HTMLInputElement;
    if (!target.classList.contains('vibegridx-checkbox')) return;
    
    const wrapper = target.closest('.vibegridx-checkbox-wrapper') as HTMLElement;
    const cell = wrapper?.closest('.vibegridx-cell, .vibegridx-header-cell') as HTMLElement;
    
    if (!cell) return;
    
    if (cell.classList.contains('vibegridx-selection-header')) {
      // Header checkbox - select all/none data rows
      const dataRows = this.unifiedRows.filter(r => r.type === 'data');
      if (target.checked) {
        this.selectedRows = new Set(dataRows.map(r => r.id));
      } else {
        this.selectedRows.clear();
      }
      
      this.updateAllCheckboxes();
    } else {
      // Row checkbox
      const rowId = cell.dataset.rowId;
      if (!rowId) return;
      
      if (target.checked) {
        this.selectedRows.add(rowId);
      } else {
        this.selectedRows.delete(rowId);
      }
      
      this.updateHeaderCheckbox();
    }
    
    this.callbacks.onSelectionChange?.(this.selectedRows);
  };
  
  private handleHeaderClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const headerCell = target.closest('.vibegridx-header-cell') as HTMLElement;
    if (!headerCell) return;
    
    const columnId = headerCell.dataset.column;
    if (!columnId || columnId === '__selection') return;
    
    // Trigger sort unless clicking resize handle
    if (!target.classList.contains('vibegridx-resize-handle')) {
      this.callbacks.onSort?.(columnId);
    }
  };
  
  private handleHeaderMouseDown = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('vibegridx-resize-handle')) return;
    
    const columnId = target.dataset.column;
    if (!columnId) return;
    
    const headerCell = target.parentElement as HTMLElement;
    const startX = e.clientX;
    const startWidth = headerCell.offsetWidth;
    
    setupColumnResizeHandlers(
      target,
      { id: columnId } as Column,
      (colId, x, width) => {
        this.dragState.type = 'resize';
        this.dragState.columnId = colId;
        this.dragState.startX = x;
        this.dragState.startWidth = width;
      },
      (deltaX) => {
        if (headerCell) {
          const newWidth = Math.max(50, startWidth + deltaX);
          headerCell.style.width = `${newWidth}px`;
        }
      },
      (colId, newWidth) => {
        this.callbacks.onColumnResize?.(colId, newWidth);
        this.dragState.type = null;
        this.dragState.columnId = null;
      }
    );
  };
  
  private handleBodyClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    const row = target.closest('.vibegridx-row') as HTMLElement;
    
    if (!cell || !row) return;
    
    const rowId = row.dataset.rowId;
    const columnId = cell.dataset.columnId;
    const rowType = row.dataset.rowType;
    
    if (!rowId || !columnId) return;
    
    // Handle group toggle
    if (rowType === 'group' && target.closest('.vibegridx-group-toggle')) {
      this.toggleGroup(rowId);
      return;
    }
    
    // Handle cell focus
    this.focusedCell = { rowId, columnId };
    
    // Notify about cell click
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        type: 'cell.click',
        rowId,
        columnId
      });
    }
  };
  
  private handleBodyDoubleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    const cell = target.closest('.vibegridx-cell') as HTMLElement;
    const row = target.closest('.vibegridx-row') as HTMLElement;
    
    if (!cell || !row) return;
    
    const rowId = row.dataset.rowId;
    const columnId = cell.dataset.columnId;
    const rowType = row.dataset.rowType;
    
    if (!rowId || !columnId || rowType !== 'data') return;
    
    // Start cell editing
    this.startCellEdit(rowId, columnId);
  };
  
  private handleContextMenu = (x: number, y: number, context: any): void => {
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        type: 'contextmenu.show',
        x,
        y,
        context
      });
    }
  };
  
  private handleKeyboardNavigation = (direction: 'up' | 'down' | 'left' | 'right'): void => {
    if (!this.focusedCell) return;
    
    const currentRowIndex = this.unifiedRows.findIndex(r => r.id === this.focusedCell!.rowId);
    if (currentRowIndex === -1) return;
    
    const visibleColumns = this.getVisibleColumns();
    const currentColIndex = visibleColumns.findIndex(c => c.id === this.focusedCell!.columnId);
    
    let newRowIndex = currentRowIndex;
    let newColIndex = currentColIndex;
    
    switch (direction) {
      case 'up':
        newRowIndex = Math.max(0, currentRowIndex - 1);
        break;
      case 'down':
        newRowIndex = Math.min(this.unifiedRows.length - 1, currentRowIndex + 1);
        break;
      case 'left':
        newColIndex = Math.max(0, currentColIndex - 1);
        break;
      case 'right':
        newColIndex = Math.min(visibleColumns.length - 1, currentColIndex + 1);
        break;
    }
    
    if (newRowIndex !== currentRowIndex || newColIndex !== currentColIndex) {
      const newRow = this.unifiedRows[newRowIndex];
      const newColumn = visibleColumns[newColIndex];
      
      if (newRow && newColumn) {
        this.focusedCell = { rowId: newRow.id, columnId: newColumn.id };
        this.ensureCellVisible(newRow.id, newColumn.id);
      }
    }
  };
  
  private handleRowSelection = (rowId: string, multi: boolean, range: boolean): void => {
    if (multi) {
      if (this.selectedRows.has(rowId)) {
        this.selectedRows.delete(rowId);
      } else {
        this.selectedRows.add(rowId);
      }
    } else if (range && this.focusedCell) {
      // Range selection
      const startIndex = this.unifiedRows.findIndex(r => r.id === this.focusedCell!.rowId);
      const endIndex = this.unifiedRows.findIndex(r => r.id === rowId);
      
      if (startIndex !== -1 && endIndex !== -1) {
        const start = Math.min(startIndex, endIndex);
        const end = Math.max(startIndex, endIndex);
        
        for (let i = start; i <= end; i++) {
          const row = this.unifiedRows[i];
          if (row.type === 'data') {
            this.selectedRows.add(row.id);
          }
        }
      }
    } else {
      this.selectedRows.clear();
      this.selectedRows.add(rowId);
    }
    
    this.updateAllCheckboxes();
    this.updateHeaderCheckbox();
    this.callbacks.onSelectionChange?.(this.selectedRows);
  };
  
  private handleRowDragStart = (rowId: string): void => {
    this.dragState.type = 'row';
    this.dragState.rowId = rowId;
  };
  
  private handleRowDragOver = (e: DragEvent, targetRowId: string): void => {
    // Visual feedback during drag
    const targetRow = this.rowElements.get(targetRowId);
    if (targetRow) {
      targetRow.classList.add('drag-over');
    }
  };
  
  private handleRowDrop = (sourceRowId: string, targetRowId: string, position: 'before' | 'after'): void => {
    // Notify about row reorder
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        type: 'row.reorder',
        sourceRowId,
        targetRowId,
        position
      });
    }
    
    this.dragState.type = null;
    this.dragState.rowId = null;
  };

  private updateAllCheckboxes(): void {
    this.rowElements.forEach((rowEl, rowId) => {
      const checkbox = rowEl.querySelector('.vibegridx-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = this.selectedRows.has(rowId);
      }
    });
  }

  private updateHeaderCheckbox(): void {
    const headerCheckbox = this.header.querySelector('.vibegridx-selection-header .vibegridx-checkbox') as HTMLInputElement;
    if (headerCheckbox) {
      const dataRows = this.unifiedRows.filter(r => r.type === 'data');
      headerCheckbox.checked = dataRows.length > 0 && 
        dataRows.every(row => this.selectedRows.has(row.id));
    }
  }

  // ====================================
  // PUBLIC API
  // ====================================

  updateRow(rowId: string, newData: any): void {
    const unifiedRow = this.unifiedRows.find(r => r.id === rowId);
    if (!unifiedRow || unifiedRow.type !== 'data') return;
    
    // Store old data for comparison
    const oldData = { ...unifiedRow.data };
    
    // Update data
    unifiedRow.data = newData;
    
    log.info('UnifiedTableRenderer: Row updated', {
      rowId,
      hasChanges: JSON.stringify(oldData) !== JSON.stringify(newData)
    });
    
    // Surgical update: only update cells where data has changed
    const rowEl = this.rowElements.get(rowId);
    if (rowEl && this.state) {
      let updatedCellsCount = 0;
      
      this.state.columns.forEach(column => {
        const fieldName = column.field || column.id;
        const oldValue = oldData[fieldName];
        const newValue = newData[fieldName];
        
        const hasChanged = JSON.stringify(oldValue) !== JSON.stringify(newValue);
        
        if (hasChanged) {
          const cellKey = `${rowId}:${column.id}`;
          const cell = this.cellElements.get(cellKey);
          
          if (cell) {
            this.updateCellContent(cell, unifiedRow, column);
            updatedCellsCount++;
          }
        }
      });
      
      log.info(`UnifiedTableRenderer: Surgical update completed - ${updatedCellsCount} cells updated`);
    }
  }

  setSelectedRows(selectedRows: Set<string>): void {
    this.selectedRows = selectedRows;
    this.updateAllCheckboxes();
    this.updateHeaderCheckbox();
  }

  updateCoordinateMapping(mapping: any, version: number): void {
    if (this.state) {
      this.state.coordinateMapping = mapping;
    }
    
    log.info('UnifiedTableRenderer: Updated coordinate mapping', {
      version,
      columnCount: mapping?.columns?.length
    });
    
    this.applyColumnWidths(mapping);
  }

  private applyColumnWidths(mapping: any): void {
    if (!mapping?.columns) return;
    
    mapping.columns.forEach((colMapping: any) => {
      const headerCell = this.header?.querySelector(`[data-column="${colMapping.columnId}"]`) as HTMLElement;
      if (headerCell) {
        headerCell.style.width = `${colMapping.width}px`;
      }
      
      // Update body cell widths for all visible rows
      this.cellElements.forEach((cell, cellKey) => {
        if (cellKey.endsWith(`:${colMapping.columnId}`)) {
          cell.style.width = `${colMapping.width}px`;
        }
      });
    });
  }

  // ====================================
  // CELL EDITING METHODS
  // ====================================
  
  private startCellEdit(rowId?: string, columnId?: string): void {
    const targetRowId = rowId || this.focusedCell?.rowId;
    const targetColumnId = columnId || this.focusedCell?.columnId;
    
    if (!targetRowId || !targetColumnId) return;
    
    this.editingCell = { rowId: targetRowId, columnId: targetColumnId };
    
    if (this.callbacks.onStateChange) {
      this.callbacks.onStateChange({
        type: 'cell.edit.start',
        rowId: targetRowId,
        columnId: targetColumnId
      });
    }
  }
  
  private deleteCellContent(): void {
    if (!this.focusedCell) return;
    
    const row = this.unifiedRows.find(r => r.id === this.focusedCell!.rowId);
    if (!row || row.type !== 'data') return;
    
    this.callbacks.onCellEdit?.(
      this.focusedCell.rowId,
      this.focusedCell.columnId,
      null
    );
  }
  
  private selectAll(): void {
    const dataRows = this.unifiedRows.filter(r => r.type === 'data');
    this.selectedRows = new Set(dataRows.map(r => r.id));
    this.updateAllCheckboxes();
    this.updateHeaderCheckbox();
    this.callbacks.onSelectionChange?.(this.selectedRows);
  }
  
  private copySelection(): void {
    // TODO: Implement copy to clipboard
    log.info('Copy selection');
  }
  
  private pasteSelection(): void {
    // TODO: Implement paste from clipboard
    log.info('Paste selection');
  }
  
  private undo(): void {
    // TODO: Implement undo
    log.info('Undo');
  }
  
  private redo(): void {
    // TODO: Implement redo
    log.info('Redo');
  }
  
  private ensureCellVisible(rowId: string, columnId: string): void {
    const rowIndex = this.unifiedRows.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;
    
    const rowOffset = this.calculateRowOffset(rowIndex);
    const rowHeight = this.unifiedRows[rowIndex].height;
    
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    
    // Scroll vertically if needed
    if (rowOffset < scrollTop) {
      this.viewport.scrollTop = rowOffset;
    } else if (rowOffset + rowHeight > scrollTop + viewportHeight) {
      this.viewport.scrollTop = rowOffset + rowHeight - viewportHeight;
    }
    
    // TODO: Horizontal scrolling for column visibility
  }
  
  destroy(): void {
    this.viewport.removeEventListener('scroll', this.handleScroll);
    this.table.removeEventListener('change', this.handleCheckboxChange);
    this.header.removeEventListener('click', this.handleHeaderClick);
    this.header.removeEventListener('mousedown', this.handleHeaderMouseDown);
    this.body.removeEventListener('click', this.handleBodyClick);
    this.body.removeEventListener('dblclick', this.handleBodyDoubleClick);
    
    if (this.cleanupKeyboard) {
      this.cleanupKeyboard();
      this.cleanupKeyboard = null;
    }
    
    if (this._scrollRAF) {
      cancelAnimationFrame(this._scrollRAF);
      this._scrollRAF = null;
    }
    
    if ((window as any).__vibegridx_renderer_instance === this) {
      delete (window as any).__vibegridx_renderer_instance;
    }
    
    this.rowElements.clear();
    this.cellElements.clear();
    this.container.innerHTML = '';
  }
}