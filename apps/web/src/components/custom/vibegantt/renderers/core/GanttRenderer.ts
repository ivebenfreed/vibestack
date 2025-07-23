import { TimelineRenderer } from './TimelineRenderer';
import { TaskBarRenderer } from './TaskBarRenderer';
import { DependencyRenderer } from './DependencyRenderer';
import { TimeScaleEngine } from '../engines/TimeScaleEngine';
import { LayoutEngine } from '../engines/LayoutEngine';
import { VirtualizationSystem } from '../systems/VirtualizationSystem';
import type { 
  GanttMachineContext, 
  GanttTask, 
  TaskDependency, 
  TaskLayout,
  DateRange,
  ViewportState,
  SelectionState,
  TimeScale
} from '../../types';
import { RENDER_CONFIG, GANTT_COLORS } from '../../constants';

export class GanttRenderer {
  private container: HTMLElement;
  private timelineRenderer: TimelineRenderer;
  private taskRenderer: TaskBarRenderer;
  private dependencyRenderer: DependencyRenderer;
  private timeScaleEngine: TimeScaleEngine;
  private layoutEngine: LayoutEngine;
  private virtualizationSystem: VirtualizationSystem;
  
  // Containers
  private ganttContainer: HTMLElement;
  private timelineContainer: HTMLElement;
  private taskContainer: HTMLElement;
  private dependencyContainer: SVGElement;
  private overlayContainer: HTMLElement;
  
  // State
  private context: GanttMachineContext | null = null;
  private frameRate: number = 60;
  private isDestroyed: boolean = false;
  
  constructor(container: HTMLElement) {
    this.container = container;
    
    // Initialize engines
    this.timeScaleEngine = new TimeScaleEngine();
    this.layoutEngine = new LayoutEngine();
    this.virtualizationSystem = new VirtualizationSystem();
    
    // Create containers
    this.ganttContainer = this.createGanttContainer();
    this.timelineContainer = this.createTimelineContainer();
    this.taskContainer = this.createTaskContainer();
    this.dependencyContainer = this.createDependencyContainer();
    this.overlayContainer = this.createOverlayContainer();
    
    // Initialize renderers
    this.timelineRenderer = new TimelineRenderer(this.timelineContainer, this.timeScaleEngine);
    this.taskRenderer = new TaskBarRenderer(this.taskContainer, this.timeScaleEngine);
    this.dependencyRenderer = new DependencyRenderer(this.dependencyContainer, this.timeScaleEngine);
    
    // Append containers
    this.container.appendChild(this.ganttContainer);
    this.ganttContainer.appendChild(this.timelineContainer);
    this.ganttContainer.appendChild(this.taskContainer);
    this.ganttContainer.appendChild(this.dependencyContainer);
    this.ganttContainer.appendChild(this.overlayContainer);
  }
  
  private createGanttContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vibegantt-container';
    container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      overflow: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px;
      color: #1f2937;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
    `;
    return container;
  }
  
  private createTimelineContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vibegantt-timeline';
    container.style.cssText = `
      position: sticky;
      top: 0;
      left: 0;
      right: 0;
      height: 60px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      z-index: 10;
    `;
    return container;
  }
  
  private createTaskContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vibegantt-tasks';
    container.style.cssText = `
      position: relative;
      min-height: 100%;
    `;
    return container;
  }
  
  private createDependencyContainer(): SVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'vibegantt-dependencies');
    svg.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
    `;
    return svg;
  }
  
  private createOverlayContainer(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vibegantt-overlay';
    container.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 20;
    `;
    return container;
  }
  
  initialize(): void {
    if (this.isDestroyed) return;
    
    // Set up scroll listeners
    this.ganttContainer.addEventListener('scroll', this.handleScroll);
    
    // Set up resize observer
    const resizeObserver = new ResizeObserver(this.handleResize);
    resizeObserver.observe(this.container);
  }
  
  updateContext(context: GanttMachineContext): void {
    this.context = context;
    
    // Update engines with new context
    this.timeScaleEngine.setZoomLevel(context.viewConfig.zoomLevel);
    this.layoutEngine.updateConfig({
      rowHeight: context.viewConfig.rowHeight,
      taskPadding: RENDER_CONFIG.TASK_PADDING,
      minTaskWidth: context.viewConfig.minTaskWidth,
    });
    
    // Update viewport in virtualization system
    if (context.viewport) {
      this.virtualizationSystem.updateViewport(context.viewport);
    }
  }
  
  renderTimeline(data: { dateRange: DateRange; zoomLevel: TimeScale }): void {
    if (!this.context) return;
    
    this.timelineRenderer.render({
      dateRange: data.dateRange,
      zoomLevel: data.zoomLevel,
      showWeekends: this.context.viewConfig.showWeekends,
      showToday: this.context.viewConfig.showToday,
    });
  }
  
  createTask(task: GanttTask): void {
    if (!this.context) return;
    
    // Get timeline start date from context
    const timelineStartDate = this.context.viewConfig.timeRange?.start || new Date();
    const layout = this.layoutEngine.calculateTaskLayout(
      task, 
      this.context.viewport, 
      this.timeScaleEngine, 
      timelineStartDate
    );
    if (!layout) return;
    
    this.taskRenderer.createTask(task, layout, {
      showProgress: this.context.viewConfig.showProgress,
      isSelected: this.context.selection.selectedTaskIds.has(task.id),
      isCritical: this.context.criticalPath.has(task.id),
    });
    
    // Store layout for future updates
    this.context.taskLayout.set(task.id, layout);
  }
  
  updateTask(task: GanttTask): void {
    if (!this.context) return;
    
    // Get timeline start date from context
    const timelineStartDate = this.context.viewConfig.timeRange?.start || new Date();
    const layout = this.layoutEngine.calculateTaskLayout(
      task, 
      this.context.viewport, 
      this.timeScaleEngine, 
      timelineStartDate
    );
    if (!layout) return;
    
    this.taskRenderer.updateTask(task, layout, {
      showProgress: this.context.viewConfig.showProgress,
      isSelected: this.context.selection.selectedTaskIds.has(task.id),
      isCritical: this.context.criticalPath.has(task.id),
    });
    
    // Update stored layout
    this.context.taskLayout.set(task.id, layout);
  }
  
  deleteTask(taskId: string): void {
    this.taskRenderer.deleteTask(taskId);
    this.context?.taskLayout.delete(taskId);
  }
  
  createDependency(dependency: TaskDependency): void {
    if (!this.context) return;
    
    const sourceLayout = this.context.taskLayout.get(dependency.sourceTaskId);
    const targetLayout = this.context.taskLayout.get(dependency.targetTaskId);
    
    if (!sourceLayout || !targetLayout) return;
    
    this.dependencyRenderer.createDependency(dependency, sourceLayout, targetLayout, {
      isCritical: this.context.criticalPath.has(dependency.sourceTaskId) && 
                  this.context.criticalPath.has(dependency.targetTaskId),
    });
  }
  
  deleteDependency(dependencyId: string): void {
    this.dependencyRenderer.deleteDependency(dependencyId);
  }
  
  updateSelection(selection: SelectionState): void {
    if (!this.context) return;
    
    // Update task selection states
    this.context.tasks.forEach(task => {
      const isSelected = selection.selectedTaskIds.has(task.id);
      this.taskRenderer.updateTaskSelection(task.id, isSelected);
    });
  }
  
  updateOverlay(data: any): void {
    // Update overlay elements (tooltips, drag previews, etc.)
    // This would be implemented based on specific overlay needs
  }
  
  resize(width: number, height: number): void {
    this.ganttContainer.style.width = `${width}px`;
    this.ganttContainer.style.height = `${height}px`;
    
    // Update renderers
    this.timelineRenderer.resize(width);
    this.taskRenderer.resize(width, height);
    this.dependencyRenderer.resize(width, height);
  }
  
  setFrameRate(fps: number): void {
    this.frameRate = fps;
  }
  
  private handleScroll = (event: Event): void => {
    const target = event.target as HTMLElement;
    const scrollX = target.scrollLeft;
    const scrollY = target.scrollTop;
    
    // Notify virtualization system
    this.virtualizationSystem.updateScroll(scrollX, scrollY);
    
    // Update timeline sticky position
    this.timelineContainer.style.transform = `translateX(${-scrollX}px)`;
  };
  
  private handleResize = (entries: ResizeObserverEntry[]): void => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;
      this.resize(width, height);
    }
  };
  
  destroy(): void {
    this.isDestroyed = true;
    
    // Clean up event listeners
    this.ganttContainer.removeEventListener('scroll', this.handleScroll);
    
    // Destroy renderers
    this.timelineRenderer.destroy();
    this.taskRenderer.destroy();
    this.dependencyRenderer.destroy();
    
    // Clear containers
    this.container.innerHTML = '';
  }
}