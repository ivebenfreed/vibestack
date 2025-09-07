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
import { CellPipeline } from './CellPipeline';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

// File-level log control
const LOG_LEVEL: LogLevel | undefined = undefined;  // Use global (quiet)
const log = createLogger('UnifiedTableRenderer', LOG_LEVEL);

// ====================================
// UNIFIED ROW MODEL
// ====================================

interface UnifiedTableRow {
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

const ROW_HEIGHT = 40;
const GROUP_ROW_HEIGHT = 44;
const SUMMARY_ROW_HEIGHT = 36;
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
    const groupConfig = uiState.context.groupConfig;
    
    // Debug grouping state
    log.info('🔗 UnifiedTableRenderer: Grouping state debug', {
      hasGroupConfig: !!groupConfig,
      groupConfig: groupConfig,
      contextKeys: Object.keys(uiState.context || {}),
      uiStateKeys: Object.keys(uiState || {})
    });
    
    // Check if grouping is enabled
    if (groupConfig && groupConfig.fields && groupConfig.fields.length > 0) {
      // GROUPED RENDERING: Create group headers + data rows
      log.info('🔗 UnifiedTableRenderer: Processing grouped data', {
        groupFields: groupConfig.fields.map(f => f.field),
        entityCount: entityRecords.length
      });
      
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
    
    // Auto-expand groups if no groups are currently expanded (UX improvement)
    const hasExpandedGroups = groupConfig.expandedGroups && groupConfig.expandedGroups.size > 0;
    const shouldAutoExpand = !hasExpandedGroups;
    
    if (shouldAutoExpand) {
      log.info('🔗 UnifiedTableRenderer: Auto-expanding all groups (no groups currently expanded)', {
        totalGroups: groupMap.size,
        expandedGroupsBefore: groupConfig.expandedGroups?.size || 0
      });
    }
    
    // Create unified rows with group headers + data rows
    let rowIndex = 0;
    for (const [groupValue, groupEntities] of groupMap) {
      const groupId = `group_${groupField}_${groupValue}`;
      
      // Determine if this group should be expanded
      const isConfigExpanded = groupConfig.expandedGroups?.has(groupId) || false;
      const isExpanded = shouldAutoExpand || isConfigExpanded;
      
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
        height: ROW_HEIGHT,
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
    const cell = this.createElement('div', 'vibegridx-header-cell');
    
    // Essential attributes for event handling
    cell.dataset.column = column.id;
    cell.dataset.field = column.field || column.id;
    
    // Positioning - use flex layout
    Object.assign(cell.style, {
      position: 'relative',
      width: `${colMapping.width}px`,
      height: `${HEADER_HEIGHT}px`,
      display: 'flex',
      alignItems: 'center',
      padding: '0 12px',
      borderRight: '1px solid var(--border)',
      cursor: column.sortable !== false ? 'pointer' : 'default',
      userSelect: 'none',
      flexShrink: '0'
    });
    
    if (column.id === '__selection') {
      // Selection checkbox
      cell.classList.add('vibegridx-selection-header');
      const checkbox = this.createCheckbox(this.unifiedRows.filter(r => r.type === 'data').every(row => this.selectedRows.has(row.id)));
      cell.appendChild(checkbox);
    } else {
      // Column content with sort icon
      const contentWrapper = document.createElement('div');
      contentWrapper.style.display = 'flex';
      contentWrapper.style.alignItems = 'center';
      contentWrapper.style.flex = '1';
      contentWrapper.style.gap = '4px';
      contentWrapper.style.overflow = 'hidden';
      
      const content = document.createElement('span');
      content.className = 'vibegridx-header-text';
      content.textContent = column.name || column.id;
      contentWrapper.appendChild(content);
      
      // Sort indicator
      if (column.sortable !== false) {
        const currentSortState = this.getCurrentSortState();
        const sortConfig = currentSortState.find(s => s.field === (column.field || column.id));
        
        const sortIcon = this.createSortIcon(sortConfig);
        
        // Add sort state class to header cell
        cell.classList.remove('sort-asc', 'sort-desc');
        if (sortConfig) {
          cell.classList.add(`sort-${sortConfig.direction}`);
        }
        
        contentWrapper.appendChild(sortIcon);
      }
      
      cell.appendChild(contentWrapper);
      
      // Resize handle
      if (column.resizable !== false) {
        const handle = document.createElement('div');
        handle.className = 'vibegridx-resize-handle';
        handle.dataset.column = column.id;
        Object.assign(handle.style, {
          position: 'absolute',
          right: '0',
          top: '0',
          width: '4px',
          height: '100%',
          cursor: 'col-resize'
        });
        cell.appendChild(handle);
      }
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
    const rowEl = this.createElement('div', 'vibegridx-row');
    rowEl.dataset.rowId = unifiedRow.id;
    rowEl.dataset.rowType = unifiedRow.type;
    
    if (unifiedRow.groupId) {
      rowEl.dataset.groupId = unifiedRow.groupId;
    }
    
    const offset = this.calculateRowOffset(index);
    
    Object.assign(rowEl.style, {
      position: 'absolute',
      top: `${offset}px`,
      left: '0',
      right: '0',
      height: `${unifiedRow.height}px`,
      display: 'flex',
      width: 'fit-content'
    });
    
    return rowEl;
  }

  private applyRowTypeStyles(rowEl: HTMLElement, unifiedRow: UnifiedTableRow): void {
    // Remove existing type classes
    rowEl.classList.remove('vibegridx-data-row', 'vibegridx-group-row', 'vibegridx-summary-row', 'vibegridx-grouped-row');
    
    // Apply type-specific classes
    rowEl.classList.add(`vibegridx-${unifiedRow.type}-row`);
    
    // Apply nesting styles for grouped rows
    if (unifiedRow.level && unifiedRow.level > 0) {
      rowEl.style.paddingLeft = `${unifiedRow.level * 20}px`;
      rowEl.classList.add('vibegridx-grouped-row');
      rowEl.dataset.groupLevel = String(unifiedRow.level);
    } else {
      rowEl.style.paddingLeft = '';
      rowEl.dataset.groupLevel = '';
    }
    
    // Apply group-specific styling
    if (unifiedRow.type === 'group') {
      Object.assign(rowEl.style, {
        backgroundColor: 'var(--muted/50)',
        borderBottom: '1px solid var(--border)',
        fontWeight: '500',
        fontSize: '14px'
      });
    } else if (unifiedRow.type === 'summary') {
      Object.assign(rowEl.style, {
        backgroundColor: 'var(--accent/10)',
        borderTop: '1px solid var(--accent)',
        fontWeight: '500',
        fontSize: '13px'
      });
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
    
    // Expand/collapse toggle
    const toggle = this.createGroupToggle(groupNode);
    rowEl.appendChild(toggle);
    
    // Group title and value
    const title = this.createElement('span', 'vibegridx-group-title');
    title.textContent = `${groupNode.field}: ${groupNode.displayValue}`;
    rowEl.appendChild(title);
    
    // Item count badge
    const countBadge = this.createElement('span', 'vibegridx-group-count');
    countBadge.textContent = `(${groupNode.rowCount})`;
    countBadge.style.cssText = `
      margin-left: 8px;
      padding: 2px 6px;
      background: var(--muted);
      border-radius: 4px;
      font-size: 12px;
      color: var(--muted-foreground);
    `;
    rowEl.appendChild(countBadge);
    
    // Aggregations display
    if (groupNode.aggregations && groupNode.aggregations.length > 0) {
      const aggregationsEl = this.createElement('div', 'vibegridx-group-aggregations');
      aggregationsEl.style.cssText = `
        margin-left: auto;
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: var(--muted-foreground);
      `;
      
      groupNode.aggregations.forEach(agg => {
        const aggEl = this.createElement('span', 'vibegridx-group-aggregation');
        aggEl.textContent = `${agg.function}: ${agg.displayValue}`;
        aggregationsEl.appendChild(aggEl);
      });
      
      rowEl.appendChild(aggregationsEl);
    }
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
    const cell = this.createElement('div', 'vibegridx-cell');
    cell.dataset.rowId = unifiedRow.id;
    cell.dataset.columnId = column.id;
    
    Object.assign(cell.style, {
      position: 'relative',
      width: `${colMapping.width}px`,
      height: `${unifiedRow.height}px`,
      borderRight: '1px solid var(--border)',
      flexShrink: '0',
      overflow: 'hidden',
      minWidth: '0'
    });
    
    return cell;
  }

  private updateCellContent(cell: HTMLElement, unifiedRow: UnifiedTableRow, column: Column): void {
    cell.innerHTML = '';
    
    if (column.id === '__selection') {
      const checkbox = this.createCheckbox(this.selectedRows.has(unifiedRow.id));
      cell.appendChild(checkbox);
    } else {
      const value = unifiedRow.data[column.field || column.id];
      const content = CellPipeline.createCellContent(value, column, unifiedRow.data);
      cell.appendChild(content);
    }
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
  
  private createGroupToggle(groupNode: GroupNode): HTMLElement {
    const toggle = this.createElement('button', 'vibegridx-group-toggle');
    toggle.dataset.groupId = groupNode.id;
    
    const isExpanded = this.expandedGroups.has(groupNode.id);
    
    Object.assign(toggle.style, {
      border: 'none',
      background: 'none',
      padding: '4px',
      marginRight: '8px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '2px',
      width: '20px',
      height: '20px'
    });
    
    // Arrow icon (chevron right/down)
    toggle.innerHTML = isExpanded 
      ? `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
           <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/>
         </svg>`
      : `<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
           <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" stroke-width="1.5" fill="none"/>
         </svg>`;
    
    // Click handler for expand/collapse
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleGroup(groupNode.id);
    });
    
    return toggle;
  }
  
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

  private createCheckbox(checked: boolean): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'vibegridx-checkbox-wrapper';
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'vibegridx-checkbox';
    checkbox.checked = checked;
    
    const custom = document.createElement('span');
    custom.className = 'vibegridx-checkbox-custom';
    
    wrapper.appendChild(checkbox);
    wrapper.appendChild(custom);
    
    return wrapper;
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
    
    if (this.unifiedRows.length === 0) {
      this.visibleRange = { start: 0, end: 0 };
      return;
    }
    
    // Find visible range using cumulative offsets
    let currentOffset = 0;
    let start = 0;
    let end = this.unifiedRows.length;
    
    // Find start index
    for (let i = 0; i < this.unifiedRows.length; i++) {
      if (currentOffset >= scrollTop - BUFFER_ROWS * ROW_HEIGHT) {
        start = Math.max(0, i);
        break;
      }
      currentOffset += this.unifiedRows[i].height;
    }
    
    // Find end index
    const viewportBottom = scrollTop + viewportHeight;
    currentOffset = 0;
    for (let i = 0; i < this.unifiedRows.length; i++) {
      currentOffset += this.unifiedRows[i].height;
      if (currentOffset >= viewportBottom + BUFFER_ROWS * ROW_HEIGHT) {
        end = Math.min(this.unifiedRows.length, i + 1);
        break;
      }
    }
    
    this.visibleRange = { start, end };
  }

  private calculateRowOffset(virtualIndex: number): number {
    if (!this.unifiedRows || virtualIndex >= this.unifiedRows.length) {
      return virtualIndex * ROW_HEIGHT; // Fallback
    }
    
    // Sum up heights of all previous rows
    let offset = 0;
    for (let i = 0; i < virtualIndex; i++) {
      offset += this.unifiedRows[i].height;
    }
    
    return offset;
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

  destroy(): void {
    this.viewport.removeEventListener('scroll', this.handleScroll);
    this.table.removeEventListener('change', this.handleCheckboxChange);
    
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