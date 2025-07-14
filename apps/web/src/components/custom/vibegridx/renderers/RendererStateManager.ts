// ====================================
// RENDERER STATE MANAGER
// ====================================

import type { 
  RenderState, 
  Column, 
  SortConfig, 
  TableRow,
  RendererOptions 
} from '../types';
import type { ColumnManager } from './ColumnManager';
import type { ColumnDimensionManager } from '../dimensions/ColumnDimensionManager';
import type { DOMStructureManager } from './DOMStructureManager';
import type { VirtualGridManager } from './VirtualGridManager';
import type { SelectionManager } from './SelectionManager';
import type { HeaderRenderer } from './HeaderRenderer';
import type { RowRenderingEngine } from './RowRenderingEngine';
import type { PerformanceMonitor } from './PerformanceMonitor';
import type { RenderOrchestrator } from './RenderOrchestrator';

// ====================================
// TYPES
// ====================================

export interface RendererStateManagerConfig {
  columnManager: ColumnManager;
  virtualGrid: VirtualGridManager;
  selectionManager: SelectionManager;
  headerRenderer: HeaderRenderer;
  rowRenderingEngine: RowRenderingEngine;
  performanceMonitor: PerformanceMonitor;
  renderOrchestrator: RenderOrchestrator;
  domManager: DOMStructureManager;
  options: RendererOptions;
}

export interface BatchUpdate {
  cellKey: string;
  rowId: string;
  columnId: string;
  value: any;
}

// ====================================
// RENDERER STATE MANAGER
// ====================================

/**
 * Manages renderer state, configuration, and batch updates
 * Handles initialization, sorting, and state synchronization
 */
export class RendererStateManager {
  private config: RendererStateManagerConfig;
  private lastRenderState: RenderState | null = null;
  private dimensionManager: ColumnDimensionManager | null = null;
  private canvasInitialized = false;
  
  // Batch update management
  private updateQueue = new Set<string>();
  private batchTimeoutId = 0;
  
  constructor(config: RendererStateManagerConfig) {
    this.config = config;
    this.dimensionManager = config.options.dimensionManager || null;
  }
  
  // ====================================
  // INITIALIZATION
  // ====================================
  
  /**
   * Initialize renderer with complete configuration - single render
   */
  initialize(state: RenderState): void {
    try {
      // Set all configuration at once without triggering updates
      if (state.columnVisibility) {
        this.config.columnManager.setColumnVisibility(state.columnVisibility);
      }
      
      if (state.columnOrder && state.columnOrder.length > 0) {
        this.config.columnManager.setColumnOrder(state.columnOrder);
      }
      
      if (state.columns && state.columns.length > 0) {
        this.config.columnManager.setColumns(state.columns);
      }
      
      // Update virtual grid with row count first
      this.config.virtualGrid.setRowCount(state.rows.length);
      
      // NOTE: Coordinate manager updates removed - now handled by coordinate actor
      // The TableMachine receives coordinate mappings from the coordinate actor
      // and provides them to the renderer via render state. This eliminates
      // the "hackery" of direct method calls and follows proper XState patterns.
      
      // Direct render without column reconfiguration
      this.renderDirectly(state);
    } catch (error) {
      console.error('[RendererStateManager] Initialize error:', error);
    }
  }
  
  /**
   * Initialize canvas overlay post-render (non-blocking)
   */
  initializeCanvasPostRender(): void {
    const canvasContainer = this.config.domManager.getElement('canvasContainer');
    if (canvasContainer && this.config.options.onStateChange && !this.canvasInitialized) {
      console.log('🔧 RendererStateManager: Emitting canvas.container.ready event post-render');
      this.config.options.onStateChange({
        type: 'canvas.container.ready',
        container: canvasContainer
      });
      this.canvasInitialized = true;
    }
  }
  
  // ====================================
  // CONFIGURATION
  // ====================================
  
  /**
   * Set or update columns
   */
  setColumns(columns: Column[]): void {
    this.config.columnManager.setColumns(columns);
    // Dimension manager will be set separately via setDimensionManager
  }
  
  /**
   * Set or update column visibility
   */
  setColumnVisibility(visibility: Record<string, boolean>): void {
    this.config.columnManager.setColumnVisibility(visibility);
    
    // Update dimensions without triggering full re-render to avoid infinite loop
    this.updateHeaderDimensions();
  }
  
  /**
   * Set column order
   */
  setColumnOrder(order: string[]): void {
    console.log('[RendererStateManager] Setting column order:', order);
    this.config.columnManager.setColumnOrder(order);
    this.updateHeaderDimensions();
  }
  
  /**
   * Set dimension manager (called by parent component)
   */
  setDimensionManager(manager: ColumnDimensionManager): void {
    this.dimensionManager = manager;
    
    // If this is a coordinate manager, sync visible columns
    if (manager && typeof manager.getColumnIds === 'function') {
      const coordinateColumnIds = manager.getColumnIds();
      console.log('RendererStateManager: Syncing visible columns with coordinate manager', {
        coordinateManagerColumns: coordinateColumnIds,
        rendererColumns: this.config.columnManager.getVisibleColumns().map(c => c.id)
      });
      
      // Update column order to match coordinate manager
      this.config.columnManager.setColumnOrder(coordinateColumnIds);
      
      console.log('RendererStateManager: Updated visible columns', {
        newVisibleColumns: this.config.columnManager.getVisibleColumns().map(c => c.id)
      });
    }
    
    // Subscribe to dimension changes
    manager.subscribe?.((event) => {
      // Handle dimension changes - could trigger re-render of affected cells
      console.log('RendererStateManager: Column dimension changed', event);
      
      // Re-render header to reflect new widths
      if (this.lastRenderState) {
        this.config.headerRenderer.renderHeader(this.lastRenderState);
      }
    });
  }
  
  // ====================================
  // STATE MANAGEMENT
  // ====================================
  
  /**
   * Get the last render state
   */
  getLastRenderState(): RenderState | null {
    return this.lastRenderState;
  }
  
  /**
   * Set the last render state
   */
  setLastRenderState(state: RenderState): void {
    this.lastRenderState = state;
  }
  
  /**
   * Direct render without column configuration updates
   */
  private renderDirectly(state: RenderState): void {
    this.lastRenderState = state;
    
    try {
      // Delegate to render orchestrator
      this.config.renderOrchestrator.render(state);
    } catch (error) {
      console.error('[RendererStateManager] Render error:', error);
    }
  }
  
  /**
   * Update header dimensions without full re-render
   */
  private updateHeaderDimensions(): void {
    if (this.config.columnManager.getVisibleColumns().length > 0) {
      const totalWidth = this.config.columnManager.getTotalColumnsWidth(this.lastRenderState?.columnWidths);
      const header = this.config.domManager.getElement('header');
      header.style.width = `${totalWidth}px`;
      
      // Update dimension manager with visible columns
      if (this.dimensionManager) {
        this.dimensionManager.setColumns(this.config.columnManager.getVisibleColumns());
      }
      
      // Re-render header content to show/hide columns
      if (this.lastRenderState) {
        this.config.headerRenderer.renderHeader(this.lastRenderState);
        // Also re-render visible rows to update cell positions
        this.config.rowRenderingEngine.renderVisibleRows(this.lastRenderState);
      }
    }
  }
  
  // ====================================
  // SORTING
  // ====================================
  
  /**
   * Apply sorting to rows
   */
  applySorting(rows: TableRow[], sortBy: SortConfig[]): TableRow[] {
    if (sortBy.length === 0) return rows;
    
    return [...rows].sort((a, b) => {
      for (const sort of sortBy) {
        const aValue = a.data[sort.field];
        const bValue = b.data[sort.field];
        
        if (aValue === bValue) continue;
        
        let comparison = 0;
        
        if (aValue == null && bValue == null) {
          comparison = 0;
        } else if (aValue == null) {
          comparison = 1; // null values go to the end
        } else if (bValue == null) {
          comparison = -1;
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else if (aValue instanceof Date && bValue instanceof Date) {
          comparison = aValue.getTime() - bValue.getTime();
        } else {
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return sort.direction === 'desc' ? -comparison : comparison;
      }
      
      return 0;
    });
  }
  
  // ====================================
  // BATCH UPDATES
  // ====================================
  
  /**
   * Queue a cell update for batch processing
   */
  queueCellUpdate(rowId: string, columnId: string, value: any): void {
    const cellKey = `${rowId}:${columnId}`;
    this.updateQueue.add(cellKey);
    
    // Batch updates for performance
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
    }
    
    this.batchTimeoutId = window.setTimeout(() => {
      this.processBatchUpdates();
    }, 0);
  }
  
  /**
   * Process all queued batch updates
   */
  private processBatchUpdates(): void {
    const startTime = performance.now();
    const updateCount = this.updateQueue.size;
    
    this.updateQueue.forEach(cellKey => {
      const [rowId, columnId] = cellKey.split(':');
      const element = this.getCellElement(rowId, columnId);
      
      if (element) {
        // Update cell content - would get actual value from state
        element.classList.add('vibegridx-updated');
        
        // Remove update indicator after animation
        setTimeout(() => {
          element.classList.remove('vibegridx-updated');
        }, 300);
      }
    });
    
    this.updateQueue.clear();
    this.batchTimeoutId = 0;
    
    const duration = performance.now() - startTime;
    this.config.performanceMonitor.trackBatchUpdate(updateCount, duration);
  }
  
  /**
   * Get a cell element by row and column ID
   */
  private getCellElement(rowId: string, columnId: string): HTMLElement | null {
    return this.config.domManager.getElement('body').querySelector(
      `[data-row-id="${rowId}"][data-column-id="${columnId}"]`
    ) as HTMLElement;
  }
  
  /**
   * Clear the update queue
   */
  clearUpdateQueue(): void {
    this.updateQueue.clear();
    if (this.batchTimeoutId) {
      clearTimeout(this.batchTimeoutId);
      this.batchTimeoutId = 0;
    }
  }
  
  /**
   * Get update queue size
   */
  getUpdateQueueSize(): number {
    return this.updateQueue.size;
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  /**
   * Cleanup resources
   */
  cleanup(): void {
    this.clearUpdateQueue();
    this.lastRenderState = null;
    this.dimensionManager = null;
  }
}