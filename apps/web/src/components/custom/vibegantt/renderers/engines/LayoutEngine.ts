import type { GanttTask, TaskLayout, ViewportState, DateRange } from '../../types';
import { TimeScaleEngine } from './TimeScaleEngine';

interface LayoutConfig {
  rowHeight: number;
  taskPadding: number;
  minTaskWidth: number;
  taskLabelWidth?: number;
}

export class LayoutEngine {
  private config: LayoutConfig;
  private taskRows: Map<string, number> = new Map(); // Task ID to row index
  private rowOccupancy: Map<number, Array<{ start: Date; end: Date; taskId: string }>> = new Map();
  
  constructor(config?: Partial<LayoutConfig>) {
    this.config = {
      rowHeight: 36,
      taskPadding: 4,
      minTaskWidth: 20,
      taskLabelWidth: 0,
      ...config
    };
  }
  
  updateConfig(config: Partial<LayoutConfig>): void {
    this.config = { ...this.config, ...config };
  }
  
  calculateTaskLayout(
    task: GanttTask,
    viewport: ViewportState | null,
    timeScaleEngine?: TimeScaleEngine,
    timelineStartDate?: Date
  ): TaskLayout | null {
    // If no time scale engine provided, create basic layout
    if (!timeScaleEngine || !timelineStartDate) {
      const rowIndex = this.getOrAssignRow(task);
      return {
        x: 0,
        y: rowIndex * this.config.rowHeight + this.config.taskPadding,
        width: 100, // Default width
        height: this.config.rowHeight - (this.config.taskPadding * 2),
        labelX: 8,
        progressWidth: 0,
        isVisible: true,
        rowIndex
      };
    }
    // Calculate horizontal position and width
    const x = timeScaleEngine.dateToPixel(task.plannedStartDate, timelineStartDate);
    const endX = timeScaleEngine.dateToPixel(task.plannedEndDate, timelineStartDate);
    const width = Math.max(this.config.minTaskWidth, endX - x);
    
    // Calculate progress width
    const progressWidth = width * (task.progress / 100);
    
    // Get or assign row for this task
    const rowIndex = this.getOrAssignRow(task);
    const y = rowIndex * this.config.rowHeight + this.config.taskPadding;
    const height = this.config.rowHeight - (this.config.taskPadding * 2);
    
    // Calculate label position
    const labelX = x + 8; // 8px padding from left edge
    
    // Check if task is visible in viewport
    const isVisible = viewport ? this.isTaskVisible(x, x + width, y, y + height, viewport) : true;
    
    return {
      x,
      y,
      width,
      height,
      labelX,
      progressWidth,
      isVisible,
      rowIndex
    };
  }
  
  calculateAllTaskLayouts(
    tasks: GanttTask[],
    viewport: ViewportState | null,
    timeScaleEngine: TimeScaleEngine,
    timelineStartDate: Date
  ): Map<string, TaskLayout> {
    const layouts = new Map<string, TaskLayout>();
    
    // Reset row assignments
    this.resetRowAssignments();
    
    // Sort tasks by start date for better row allocation
    const sortedTasks = [...tasks].sort((a, b) => 
      a.plannedStartDate.getTime() - b.plannedStartDate.getTime()
    );
    
    // Calculate layout for each task
    for (const task of sortedTasks) {
      const layout = this.calculateTaskLayout(task, viewport, timeScaleEngine, timelineStartDate);
      if (layout) {
        layouts.set(task.id, layout);
      }
    }
    
    return layouts;
  }
  
  private getOrAssignRow(task: GanttTask): number {
    // Check if task already has a row assigned
    const existingRow = this.taskRows.get(task.id);
    if (existingRow !== undefined) {
      return existingRow;
    }
    
    // If task has a parent, place it below the parent
    if (task.parentId) {
      const parentRow = this.taskRows.get(task.parentId);
      if (parentRow !== undefined) {
        return this.findNextAvailableRow(task, parentRow + 1);
      }
    }
    
    // Find the first available row
    return this.findNextAvailableRow(task, 0);
  }
  
  private findNextAvailableRow(task: GanttTask, startRow: number = 0): number {
    let row = startRow;
    
    while (true) {
      if (this.canPlaceTaskInRow(task, row)) {
        // Place task in this row
        this.placeTaskInRow(task, row);
        return row;
      }
      row++;
    }
  }
  
  private canPlaceTaskInRow(task: GanttTask, row: number): boolean {
    const rowTasks = this.rowOccupancy.get(row);
    if (!rowTasks || rowTasks.length === 0) {
      return true;
    }
    
    // Check if task overlaps with any existing task in this row
    for (const existing of rowTasks) {
      if (this.tasksOverlap(
        task.plannedStartDate,
        task.plannedEndDate,
        existing.start,
        existing.end
      )) {
        return false;
      }
    }
    
    return true;
  }
  
  private placeTaskInRow(task: GanttTask, row: number): void {
    // Add task to row
    this.taskRows.set(task.id, row);
    
    // Update row occupancy
    const rowTasks = this.rowOccupancy.get(row) || [];
    rowTasks.push({
      start: task.plannedStartDate,
      end: task.plannedEndDate,
      taskId: task.id
    });
    this.rowOccupancy.set(row, rowTasks);
  }
  
  private tasksOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): boolean {
    return start1 < end2 && end1 > start2;
  }
  
  private isTaskVisible(
    x: number,
    endX: number,
    y: number,
    endY: number,
    viewport: ViewportState
  ): boolean {
    // Check horizontal visibility
    if (endX < viewport.scrollX || x > viewport.scrollX + viewport.width) {
      return false;
    }
    
    // Check vertical visibility
    if (endY < viewport.scrollY || y > viewport.scrollY + viewport.height) {
      return false;
    }
    
    return true;
  }
  
  resetRowAssignments(): void {
    this.taskRows.clear();
    this.rowOccupancy.clear();
  }
  
  getRowForTask(taskId: string): number | undefined {
    return this.taskRows.get(taskId);
  }
  
  getTotalRows(): number {
    let maxRow = -1;
    this.taskRows.forEach(row => {
      if (row > maxRow) {
        maxRow = row;
      }
    });
    return maxRow + 1;
  }
  
  getTotalHeight(): number {
    return this.getTotalRows() * this.config.rowHeight;
  }
  
  // Group tasks by their parent for hierarchical layout
  groupTasksByParent(tasks: GanttTask[]): Map<string | null, GanttTask[]> {
    const groups = new Map<string | null, GanttTask[]>();
    
    for (const task of tasks) {
      const parentId = task.parentId || null;
      const group = groups.get(parentId) || [];
      group.push(task);
      groups.set(parentId, group);
    }
    
    return groups;
  }
  
  // Calculate indentation level for hierarchical tasks
  calculateTaskLevel(task: GanttTask, tasks: Map<string, GanttTask>): number {
    let level = 0;
    let currentTask = task;
    
    while (currentTask.parentId) {
      level++;
      const parent = tasks.get(currentTask.parentId);
      if (!parent) break;
      currentTask = parent;
    }
    
    return level;
  }
}