// ====================================
// ENHANCED TABLE RENDERER
// ====================================
// Extends CleanTableRenderer with group row support
// Maintains performance through direct DOM manipulation

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
  GroupConfig,
  GroupAggregation
} from '../../types';
import { CleanTableRenderer } from './CleanTableRenderer';
import { CellPipeline } from './CellPipeline';
import { uiLog } from '@/logger';
import { createLogger, type LogLevel } from '@/logger/simple-logger';

const LOG_LEVEL: LogLevel = 'info';  // DEBUG: Group toggle debugging
const log = createLogger('EnhancedTableRenderer', LOG_LEVEL);

// ====================================
// CONSTANTS
// ====================================

const DATA_ROW_HEIGHT = 40;
const GROUP_ROW_HEIGHT = 44; // Slightly taller for group headers
const SUMMARY_ROW_HEIGHT = 36;
const HEADER_HEIGHT = 40;
const BUFFER_ROWS = 5;

// ====================================
// ENHANCED TABLE RENDERER
// ====================================

export class EnhancedTableRenderer extends CleanTableRenderer {
  // Group-specific state
  private groupConfig: GroupConfig | null = null;
  private expandedGroups = new Set<string>();
  
  // Virtual row management
  private virtualRows: VirtualRow[] = [];
  private rowTypeCache = new Map<string, VirtualRowType>();
  
  // Group row elements cache
  private groupRowElements = new Map<string, HTMLElement>();
  
  constructor(options: RendererOptions) {
    super(options);
    log.info('EnhancedTableRenderer: Initialized with group support');
  }
  
  // ====================================
  // ENHANCED MAIN RENDER METHOD
  // ====================================
  
  render(state: RenderState): void {
    log.info('EnhancedTableRenderer: render() called', {
      hasGroupConfig: !!state.groupConfig,
      hasVirtualRows: !!state.virtualRows,
      regularRowCount: state.rows?.length,
      virtualRowCount: state.virtualRows?.length,
      version: state.version
    });
    
    // Update group state
    this.groupConfig = state.groupConfig || null;
    if (state.groupConfig) {
      this.expandedGroups = state.groupConfig.expandedGroups;
    }
    
    // Choose rendering path based on whether we have virtual rows (grouped data)
    if (state.virtualRows && state.virtualRows.length > 0) {
      this.renderGrouped(state);
    } else {
      // Fallback to parent's standard rendering
      super.render(state);
    }
  }
  
  // ====================================
  // GROUPED RENDERING
  // ====================================
  
  private renderGrouped(state: RenderState): void {
    log.info('EnhancedTableRenderer: renderGrouped() called', {
      virtualRowCount: state.virtualRows?.length,
      hasColumns: !!state.columns,
      hasCoordinateMapping: !!state.coordinateMapping
    });
    
    this.state = state;
    this.virtualRows = state.virtualRows || [];
    
    // Update dimensions for virtual rows
    this.updateGroupedDimensions(state);
    
    // Render header (same as parent)
    this.renderHeader(state);
    
    // Calculate visible range using virtual rows
    const scrollTop = this.viewport.scrollTop;
    const viewportHeight = this.viewport.clientHeight;
    this.updateGroupedVisibleRange(scrollTop, viewportHeight);
    
    // Render visible virtual rows (mixed types)
    this.renderVirtualRows(state);
    
    // Cleanup old rows (both data and group)
    this.cleanupVirtualRows();
    
    // Sync header scroll
    this.syncHeaderScroll();
  }
  
  // ====================================
  // VIRTUAL ROW RENDERING
  // ====================================
  
  private renderVirtualRows(state: RenderState): void {
    if (!state.columns || !this.virtualRows) {
      log.warn('EnhancedTableRenderer: renderVirtualRows early return - missing data');
      return;
    }
    
    const { start, end } = this.visibleRange;
    const visibleVirtualRows = this.virtualRows.slice(start, end);
    
    log.info('EnhancedTableRenderer: renderVirtualRows', {
      visibleRangeStart: start,
      visibleRangeEnd: end,
      visibleVirtualRowCount: visibleVirtualRows.length
    });
    
    visibleVirtualRows.forEach((virtualRow, index) => {
      const absoluteIndex = start + index;
      this.renderVirtualRow(virtualRow, absoluteIndex, state);
    });
  }
  
  private renderVirtualRow(virtualRow: VirtualRow, absoluteIndex: number, state: RenderState): void {
    switch (virtualRow.type) {
      case 'data':
        this.renderDataRow(virtualRow, absoluteIndex, state);
        break;
      case 'group':
        this.renderGroupRow(virtualRow, absoluteIndex, state);
        break;
      case 'summary':
        this.renderSummaryRow(virtualRow, absoluteIndex, state);
        break;
      default:
        log.warn('EnhancedTableRenderer: Unknown virtual row type', { type: virtualRow.type });
    }
  }
  
  // ====================================
  // DATA ROW RENDERING (Enhanced)
  // ====================================
  
  private renderDataRow(virtualRow: VirtualRow, absoluteIndex: number, state: RenderState): void {
    const row = virtualRow.data as TableRow;
    let rowEl = this.rowElements.get(row.id);
    
    if (!rowEl) {
      rowEl = this.createDataRow(row, virtualRow, absoluteIndex);
      this.rowElements.set(row.id, rowEl);
      this.body.appendChild(rowEl);
    } else {
      // Update position based on virtual row offset
      const offset = this.calculateRowOffset(absoluteIndex);
      rowEl.style.top = `${offset}px`;
      rowEl.style.height = `${virtualRow.height}px`;
    }
    
    // Add group nesting styles
    if (virtualRow.level && virtualRow.level > 0) {
      rowEl.style.paddingLeft = `${virtualRow.level * 20}px`;
      rowEl.classList.add('vibegridx-grouped-row');
      rowEl.dataset.groupLevel = String(virtualRow.level);
    }
    
    // Render cells (same as parent but with group context)
    this.renderCells(row, rowEl, state);
  }
  
  private createDataRow(row: TableRow, virtualRow: VirtualRow, index: number): HTMLElement {
    const rowEl = this.createElement('div', 'vibegridx-row');
    rowEl.dataset.rowId = row.id;
    rowEl.dataset.rowType = 'data';
    
    const offset = this.calculateRowOffset(index);
    
    Object.assign(rowEl.style, {
      position: 'absolute',
      top: `${offset}px`,
      left: '0',
      right: '0',
      height: `${virtualRow.height}px`,
      display: 'flex',
      width: 'fit-content'
    });
    
    return rowEl;
  }
  
  // ====================================
  // GROUP ROW RENDERING
  // ====================================
  
  private renderGroupRow(virtualRow: VirtualRow, absoluteIndex: number, state: RenderState): void {
    const groupNode = virtualRow.data as GroupNode;
    let groupEl = this.groupRowElements.get(groupNode.id);
    
    if (!groupEl) {
      groupEl = this.createGroupRow(groupNode, virtualRow, absoluteIndex);
      this.groupRowElements.set(groupNode.id, groupEl);
      this.body.appendChild(groupEl);
    } else {
      // Update position
      const offset = this.calculateRowOffset(absoluteIndex);
      groupEl.style.top = `${offset}px`;
    }
    
    // Update group content (expand/collapse state, counts, etc.)
    this.updateGroupRowContent(groupEl, groupNode, virtualRow);
  }
  
  private createGroupRow(groupNode: GroupNode, virtualRow: VirtualRow, index: number): HTMLElement {
    const groupEl = this.createElement('div', 'vibegridx-group-row');
    groupEl.dataset.groupId = groupNode.id;
    groupEl.dataset.rowType = 'group';
    
    const offset = this.calculateRowOffset(index);
    const level = virtualRow.level || 0;
    
    Object.assign(groupEl.style, {
      position: 'absolute',
      top: `${offset}px`,
      left: '0',
      right: '0',
      height: `${virtualRow.height}px`,
      display: 'flex',
      alignItems: 'center',
      width: 'fit-content',
      paddingLeft: `${level * 20 + 12}px`,
      backgroundColor: 'var(--muted/50)',
      borderBottom: '1px solid var(--border)',
      fontWeight: '500',
      fontSize: '14px'
    });
    
    return groupEl;
  }
  
  private updateGroupRowContent(groupEl: HTMLElement, groupNode: GroupNode, virtualRow: VirtualRow): void {
    // Clear existing content
    groupEl.innerHTML = '';
    
    // Expand/collapse toggle
    const toggle = this.createGroupToggle(groupNode);
    groupEl.appendChild(toggle);
    
    // Group title and value
    const title = this.createElement('span', 'vibegridx-group-title');
    title.textContent = `${groupNode.field}: ${groupNode.displayValue}`;
    groupEl.appendChild(title);
    
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
    groupEl.appendChild(countBadge);
    
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
      
      groupEl.appendChild(aggregationsEl);
    }
  }
  
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
  
  // ====================================
  // SUMMARY ROW RENDERING
  // ====================================
  
  private renderSummaryRow(virtualRow: VirtualRow, absoluteIndex: number, state: RenderState): void {
    // TODO: Implement summary row rendering for group totals
    log.info('EnhancedTableRenderer: Summary row rendering not yet implemented');
  }
  
  // ====================================
  // DIMENSION CALCULATIONS
  // ====================================
  
  private updateGroupedDimensions(state: RenderState): void {
    if (!state.coordinateMapping?.totalHeight) {
      // Fallback: calculate total height from virtual rows
      const totalHeight = this.virtualRows.reduce((sum, row) => sum + row.height, 0);
      this.body.style.height = `${totalHeight}px`;
    } else {
      this.body.style.height = `${state.coordinateMapping.totalHeight}px`;
    }
    
    // Width calculation (same as parent)
    let totalWidth = 0;
    if (state.coordinateMapping) {
      totalWidth = state.coordinateMapping.columns.reduce(
        (sum: number, col: any) => sum + col.width, 0
      );
    } else if (state.columns) {
      totalWidth = state.columns.reduce(
        (sum: number, col: Column) => sum + (col.width || 120), 0
      );
    }
    
    this.body.style.width = `${totalWidth}px`;
    
    log.info('EnhancedTableRenderer: Updated grouped dimensions', {
      totalWidth,
      totalHeight: this.body.style.height,
      virtualRowCount: this.virtualRows.length
    });
  }
  
  private updateGroupedVisibleRange(scrollTop?: number, viewportHeight?: number): void {
    scrollTop = scrollTop ?? this.viewport.scrollTop;
    viewportHeight = viewportHeight ?? this.viewport.clientHeight;
    
    if (this.virtualRows.length === 0) {
      this.visibleRange = { start: 0, end: 0 };
      return;
    }
    
    // Find visible range using cumulative offsets
    let currentOffset = 0;
    let start = 0;
    let end = this.virtualRows.length;
    
    // Find start index
    for (let i = 0; i < this.virtualRows.length; i++) {
      if (currentOffset >= scrollTop - BUFFER_ROWS * DATA_ROW_HEIGHT) {
        start = Math.max(0, i);
        break;
      }
      currentOffset += this.virtualRows[i].height;
    }
    
    // Find end index
    const viewportBottom = scrollTop + viewportHeight;
    currentOffset = 0;
    for (let i = 0; i < this.virtualRows.length; i++) {
      currentOffset += this.virtualRows[i].height;
      if (currentOffset >= viewportBottom + BUFFER_ROWS * DATA_ROW_HEIGHT) {
        end = Math.min(this.virtualRows.length, i + 1);
        break;
      }
    }
    
    this.visibleRange = { start, end };
    
    log.info('EnhancedTableRenderer: Updated grouped visible range', {
      scrollTop,
      viewportHeight,
      start,
      end,
      virtualRowCount: this.virtualRows.length
    });
  }
  
  private calculateRowOffset(virtualIndex: number): number {
    if (!this.virtualRows || virtualIndex >= this.virtualRows.length) {
      return virtualIndex * DATA_ROW_HEIGHT; // Fallback
    }
    
    // Sum up heights of all previous rows
    let offset = 0;
    for (let i = 0; i < virtualIndex; i++) {
      offset += this.virtualRows[i].height;
    }
    
    return offset;
  }
  
  // ====================================
  // GROUP INTERACTION
  // ====================================
  
  private toggleGroup(groupId: string): void {
    log.info('EnhancedTableRenderer: toggleGroup', { groupId });
    
    // This should trigger an event to the state machine
    if (this.options.onStateChange) {
      this.options.onStateChange({
        type: 'group.toggle',
        groupId
      });
    }
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  private cleanupVirtualRows(): void {
    if (!this.virtualRows) return;
    
    const visibleIds = new Set(
      this.virtualRows.slice(this.visibleRange.start, this.visibleRange.end).map(vr => vr.id)
    );
    
    // Cleanup data rows (existing logic)
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
    
    // Cleanup group rows
    this.groupRowElements.forEach((groupEl, groupId) => {
      if (!visibleIds.has(groupId)) {
        groupEl.remove();
        this.groupRowElements.delete(groupId);
      }
    });
  }
  
  // ====================================
  // ENHANCED DESTROY
  // ====================================
  
  destroy(): void {
    // Clear group-specific caches
    this.groupRowElements.clear();
    this.rowTypeCache.clear();
    this.virtualRows = [];
    this.expandedGroups.clear();
    
    // Call parent destroy
    super.destroy();
    
    log.info('EnhancedTableRenderer: Destroyed with group cleanup');
  }
}