// ====================================
// RENDER PIPELINE
// ====================================

import type { RenderState, ViewportInfo } from '../../types';
import type { VirtualScrollManager } from '../managers/VirtualScrollManager';
import type { ColumnManager } from '../managers/ColumnManager';
import type { DOMSystem } from '../systems/DOMSystem';
import type { HeaderEngine } from '../engines/HeaderEngine';
import type { RowEngine } from '../engines/RowEngine';
import type { PerformanceSystem } from '../systems/PerformanceSystem';

// ====================================
// TYPES
// ====================================

export interface RenderPipelineConfig {
  virtualGrid: VirtualScrollManager;
  domManager: DOMSystem;
  headerRenderer: HeaderEngine;
  rowRenderingEngine: RowEngine;
  performanceMonitor: PerformanceSystem;
  rowHeight: number;
  onScroll?: (viewport: ViewportInfo) => void;
}

export interface RenderContext {
  renderState: RenderState;
  isFirstRender: boolean;
}

// ====================================
// RENDER PIPELINE
// ====================================

/**
 * Orchestrates the rendering pipeline for the table
 * Manages render timing, viewport updates, and performance monitoring
 */
export class RenderPipeline {
  private config: RenderPipelineConfig;
  private isFirstRender = true;
  
  constructor(config: RenderPipelineConfig) {
    this.config = config;
  }
  
  /**
   * Main render method - orchestrates the entire rendering pipeline
   */
  render(state: RenderState): void {
    this.config.performanceMonitor.startRender();
    
    // Column information now comes from state machine coordinate mapping
    // No need to update ColumnManager as it's now passive and gets data from render state
    
    try {
      // STEP 1: Render header
      const headerMetrics = this.config.headerRenderer.renderHeader(state);
      this.config.performanceMonitor.recordPhase('header', headerMetrics.renderTime);
      
      // Check if this is the first render
      if (this.isFirstRender) {
        console.log('🎨 RenderOrchestrator: First render - executing synchronously');
        this.isFirstRender = false;
        
        // CRITICAL: Set row count BEFORE updating viewport
        this.config.virtualGrid.setRowCount(state.rows.length);
        
        // STEP 2: Update viewport
        const viewportStart = performance.now();
        this.updateViewport(state);
        const viewportTime = performance.now() - viewportStart;
        this.config.performanceMonitor.recordPhase('viewport', viewportTime);
        
        // Log viewport info for debugging
        console.log('🎨 RenderOrchestrator: First render viewport info AFTER updateViewport', {
          visibleRange: this.config.virtualGrid.getVisibleRange(),
          metrics: this.config.virtualGrid.getMetrics()
        });
        
        // STEP 3: Render visible rows
        console.log('🎨 RenderOrchestrator: About to render visible rows synchronously');
        const metrics = this.config.rowRenderingEngine.renderVisibleRows(state);
        this.config.performanceMonitor.recordPhase('visibleRows', metrics.renderTime);
        console.log('🎨 RenderOrchestrator: Visible rows rendered synchronously', metrics);
        
        // STEP 4: Apply optimistic operations
        const optimisticStart = performance.now();
        this.config.rowRenderingEngine.applyOptimisticOperations(state.optimisticOperations);
        const optimisticTime = performance.now() - optimisticStart;
        this.config.performanceMonitor.recordPhase('optimisticOps', optimisticTime);
        
        // Performance timing
        const totalTime = this.config.performanceMonitor.endRender(state.rows.length);
        this.config.performanceMonitor.recordPhase('total', totalTime);
        this.config.performanceMonitor.logBreakdown();
        
        console.log('🎨 RenderOrchestrator: First render complete synchronously', {
          renderTime: totalTime,
          rowCount: state.rows.length,
          timestamp: performance.now()
        });
        
        // Send viewport update for canvas overlay
        const initialViewport: ViewportInfo = {
          start: this.config.virtualGrid.getVisibleRange().start,
          end: this.config.virtualGrid.getVisibleRange().end,
          height: this.config.domManager.getElement('viewport').clientHeight,
          width: this.config.domManager.getElement('viewport').clientWidth,
          scrollTop: this.config.domManager.getElement('viewport').scrollTop,
          scrollLeft: this.config.domManager.getElement('viewport').scrollLeft,
          itemHeight: this.config.virtualGrid.getRowHeight()
        };
        
        this.config.onScroll?.(initialViewport);
      } else {
        // Subsequent renders: use RAF for better performance
        console.log('🎨 RenderOrchestrator: Using RAF render path (subsequent render)', {
          rowCount: state.rows.length,
          columnCount: state.columns?.length,
          timestamp: performance.now(),
          firstRenderComplete: this.firstRenderComplete
        });
        
        requestAnimationFrame(() => {
          console.log('🎨 RenderOrchestrator: RAF callback executing', {
            timestamp: performance.now()
          });
          
          // Batch all operations in single frame for better performance
          this.updateViewport(state);
          this.config.rowRenderingEngine.renderVisibleRows(state);
          this.config.rowRenderingEngine.applyOptimisticOperations(state.optimisticOperations);
          
          // Performance timing
          const renderTime = this.config.performanceMonitor.endRender(state.rows.length);
          this.config.performanceMonitor.recordPhase('total', renderTime);
          
          // Send viewport update for canvas overlay
          const viewport: ViewportInfo = {
            start: this.config.virtualGrid.getVisibleRange().start,
            end: this.config.virtualGrid.getVisibleRange().end,
            height: this.config.domManager.getElement('viewport').clientHeight,
            width: this.config.domManager.getElement('viewport').clientWidth,
            scrollTop: this.config.domManager.getElement('viewport').scrollTop,
            scrollLeft: this.config.domManager.getElement('viewport').scrollLeft,
            itemHeight: this.config.virtualGrid.getRowHeight()
          };
          
          this.config.onScroll?.(viewport);
        });
      }
      
    } finally {
      // Performance metrics are tracked by PerformanceMonitor
    }
  }
  
  /**
   * Update viewport based on current dimensions and scroll position
   */
  private updateViewport(state: RenderState): void {
    // PERFORMANCE OPTIMIZATION: Batch all DOM measurements to prevent layout thrashing
    const measurements = this.batchMeasureDOMElements();
    
    // Use cached measurements for calculations - but check container if viewport is 0
    let viewportHeight = measurements.viewport.client.height;
    let viewportWidth = measurements.viewport.client.width;
    
    // If viewport has no height yet, try container measurements
    if (!viewportHeight || viewportHeight === 0) {
      viewportHeight = measurements.container.client.height || 
                       measurements.table.client.height || 
                       600; // Ultimate fallback
      console.log('🎨 RenderOrchestrator: Using container height as viewport had no height', {
        viewportHeight,
        containerHeight: measurements.container.client.height,
        tableHeight: measurements.table.client.height
      });
    }
    
    if (!viewportWidth || viewportWidth === 0) {
      viewportWidth = measurements.container.client.width || 
                      measurements.table.client.width || 
                      800; // Ultimate fallback
    }
    
    const scrollTop = measurements.viewport.scroll.top;
    const scrollLeft = measurements.viewport.scroll.left;
    
    // Debug log actual measurements
    console.log('🎨 RenderOrchestrator: updateViewport measurements', {
      viewportHeight,
      viewportWidth,
      containerHeight: measurements.container.client.height,
      viewportClientHeight: measurements.viewport.client.height,
      tableHeight: measurements.table.client.height,
      scrollTop,
      rowHeight: this.config.rowHeight,
      expectedRows: Math.ceil(viewportHeight / this.config.rowHeight)
    });
    
    // Use VirtualGridManager to calculate viewport
    const currentViewport = this.config.virtualGrid.calculateViewportFromScroll(
      scrollTop,
      viewportHeight,
      viewportWidth,
      scrollLeft
    );
    
    this.config.virtualGrid.updateViewport(currentViewport, state.rows.length);
  }
  
  /**
   * Batch all DOM measurements to prevent layout thrashing.
   * The original updateViewport() method caused 42ms forced reflow by doing
   * 14 sequential DOM queries. This method consolidates them into a single pass.
   */
  private batchMeasureDOMElements() {
    return {
      viewport: {
        bounds: this.config.domManager.getElement('viewport').getBoundingClientRect(),
        client: {
          width: this.config.domManager.getElement('viewport').clientWidth,
          height: this.config.domManager.getElement('viewport').clientHeight
        },
        scroll: {
          top: this.config.domManager.getElement('viewport').scrollTop || 0,
          left: this.config.domManager.getElement('viewport').scrollLeft || 0
        },
        offset: {
          width: this.config.domManager.getElement('viewport').offsetWidth,
          height: this.config.domManager.getElement('viewport').offsetHeight
        }
      },
      container: {
        bounds: this.config.domManager.getElement('container').getBoundingClientRect(),
        client: {
          width: this.config.domManager.getElement('container').clientWidth,
          height: this.config.domManager.getElement('container').clientHeight
        }
      },
      table: {
        bounds: this.config.domManager.getElement('table').getBoundingClientRect(),
        client: {
          width: this.config.domManager.getElement('table').clientWidth,
          height: this.config.domManager.getElement('table').clientHeight
        }
      }
    };
  }
  
  /**
   * Reset first render flag (useful for reinitialization)
   */
  resetFirstRender(): void {
    this.isFirstRender = true;
  }
  
  /**
   * Check if this is the first render
   */
  getIsFirstRender(): boolean {
    return this.isFirstRender;
  }
}