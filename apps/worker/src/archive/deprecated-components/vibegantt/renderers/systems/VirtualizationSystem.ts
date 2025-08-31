import type { ViewportState, GanttTask, TaskLayout } from '../../types';
import { RENDER_CONFIG } from '../../constants';

interface VirtualizationBounds {
  startRow: number;
  endRow: number;
  startDate: Date;
  endDate: Date;
  visibleTaskIds: Set<string>;
}

export class VirtualizationSystem {
  private viewport: ViewportState | null = null;
  private rowHeight: number = 36;
  private bufferRows: number = RENDER_CONFIG.VIRTUAL_SCROLL_OVERSCAN;
  private bufferMultiplier: number = RENDER_CONFIG.BUFFER_MULTIPLIER;
  
  updateViewport(viewport: ViewportState): void {
    this.viewport = viewport;
  }
  
  updateScroll(scrollX: number, scrollY: number): void {
    if (this.viewport) {
      this.viewport.scrollX = scrollX;
      this.viewport.scrollY = scrollY;
    }
  }
  
  calculateVirtualizationBounds(
    tasks: Map<string, GanttTask>,
    taskLayouts: Map<string, TaskLayout>,
    timelineStartDate: Date
  ): VirtualizationBounds | null {
    if (!this.viewport) return null;
    
    // Calculate visible row range
    const startRow = Math.max(0, Math.floor(this.viewport.scrollY / this.rowHeight) - this.bufferRows);
    const endRow = Math.ceil((this.viewport.scrollY + this.viewport.height) / this.rowHeight) + this.bufferRows;
    
    // Calculate visible date range with buffer
    const bufferWidth = this.viewport.width * (this.bufferMultiplier - 1) / 2;
    const extendedStartX = Math.max(0, this.viewport.scrollX - bufferWidth);
    const extendedEndX = this.viewport.scrollX + this.viewport.width + bufferWidth;
    
    // Convert to dates (would need TimeScaleEngine instance)
    // For now, use viewport's visible date range
    const startDate = this.viewport.visibleDateRange.start;
    const endDate = this.viewport.visibleDateRange.end;
    
    // Find visible tasks
    const visibleTaskIds = new Set<string>();
    
    taskLayouts.forEach((layout, taskId) => {
      // Check if task is within visible bounds
      if (layout.rowIndex >= startRow && 
          layout.rowIndex <= endRow &&
          layout.isVisible) {
        visibleTaskIds.add(taskId);
      }
    });
    
    return {
      startRow,
      endRow,
      startDate,
      endDate,
      visibleTaskIds
    };
  }
  
  shouldRenderTask(taskLayout: TaskLayout, bounds: VirtualizationBounds): boolean {
    // Check if task is within visible row range
    if (taskLayout.rowIndex < bounds.startRow || taskLayout.rowIndex > bounds.endRow) {
      return false;
    }
    
    // Additional checks can be added here
    return taskLayout.isVisible;
  }
  
  getVisibleTasks(
    tasks: Map<string, GanttTask>,
    taskLayouts: Map<string, TaskLayout>
  ): GanttTask[] {
    const bounds = this.calculateVirtualizationBounds(tasks, taskLayouts, new Date());
    if (!bounds) return Array.from(tasks.values());
    
    const visibleTasks: GanttTask[] = [];
    
    bounds.visibleTaskIds.forEach(taskId => {
      const task = tasks.get(taskId);
      if (task) {
        visibleTasks.push(task);
      }
    });
    
    return visibleTasks;
  }
  
  // Calculate if we need to update rendered content
  shouldUpdateRender(
    oldViewport: ViewportState | null,
    newViewport: ViewportState
  ): boolean {
    if (!oldViewport) return true;
    
    // Check if scroll has moved significantly
    const scrollXDelta = Math.abs(newViewport.scrollX - oldViewport.scrollX);
    const scrollYDelta = Math.abs(newViewport.scrollY - oldViewport.scrollY);
    
    // Update if scrolled more than 10% of viewport
    const scrollThresholdX = newViewport.width * 0.1;
    const scrollThresholdY = newViewport.height * 0.1;
    
    if (scrollXDelta > scrollThresholdX || scrollYDelta > scrollThresholdY) {
      return true;
    }
    
    // Check if viewport size changed
    if (newViewport.width !== oldViewport.width || 
        newViewport.height !== oldViewport.height) {
      return true;
    }
    
    // Check if zoom changed
    if (newViewport.zoom !== oldViewport.zoom) {
      return true;
    }
    
    return false;
  }
  
  // Optimize render commands by batching and prioritizing
  optimizeRenderCommands(commands: any[]): any[] {
    // Sort by priority and batch similar operations
    const sortedCommands = [...commands].sort((a, b) => {
      // Priority order: timeline > tasks > dependencies > overlays
      const priorityMap: Record<string, number> = {
        timeline: 4,
        task: 3,
        dependency: 2,
        overlay: 1,
        selection: 1
      };
      
      const aPriority = priorityMap[a.type] || 0;
      const bPriority = priorityMap[b.type] || 0;
      
      return bPriority - aPriority;
    });
    
    // Batch similar commands
    const batched: any[] = [];
    let currentBatch: any[] = [];
    let currentType: string | null = null;
    
    for (const command of sortedCommands) {
      if (command.type === currentType) {
        currentBatch.push(command);
      } else {
        if (currentBatch.length > 0) {
          batched.push({
            type: 'batch',
            batchType: currentType,
            commands: currentBatch
          });
        }
        currentBatch = [command];
        currentType = command.type;
      }
    }
    
    if (currentBatch.length > 0) {
      batched.push({
        type: 'batch',
        batchType: currentType,
        commands: currentBatch
      });
    }
    
    return batched;
  }
  
  // Memory management
  cleanupOffscreenElements(
    elements: Map<string, HTMLElement>,
    visibleIds: Set<string>,
    maxOffscreen: number = 100
  ): void {
    const offscreenIds: string[] = [];
    
    elements.forEach((element, id) => {
      if (!visibleIds.has(id)) {
        offscreenIds.push(id);
      }
    });
    
    // Remove oldest offscreen elements if we exceed the limit
    if (offscreenIds.length > maxOffscreen) {
      const toRemove = offscreenIds.slice(0, offscreenIds.length - maxOffscreen);
      toRemove.forEach(id => {
        const element = elements.get(id);
        if (element) {
          element.remove();
          elements.delete(id);
        }
      });
    }
  }
}