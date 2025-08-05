import type { 
  GanttTask, 
  TaskDependency
} from '../../types';
import type { CoordinateMapping } from '../../stores/gantt-data-store';
import { GanttEventDelegationManager } from '../../systems/GanttEventDelegationManager';

/**
 * GanttRenderer with Coordinate-Based Rendering
 * 
 * Following VibeGridDex pattern:
 * - Renders from pre-calculated coordinates
 * - No date calculations during render
 * - Direct DOM manipulation for performance
 * - Event delegation for interaction handling
 */
export class GanttRenderer {
  private container: HTMLElement;
  private eventHandler: (event: any) => void;
  private eventManager: GanttEventDelegationManager | null = null;
  
  // DOM containers
  private taskListContainer!: HTMLElement;
  private timelineContainer!: HTMLElement;
  private taskContainer!: HTMLElement;
  private dependencyContainer!: SVGElement;
  private timelineScrollWrapper!: HTMLElement;
  private taskScrollWrapper!: HTMLElement;
  private containerWidth: number = 0;
  private containerHeight: number = 0;
  private taskListWidth: number = 300; // Fixed width for task list
  
  // State
  private currentCoordinates: CoordinateMapping | null = null;
  private selectedTaskIds = new Set<string>();
  
  constructor(container: HTMLElement, eventHandler: (event: any) => void) {
    this.container = container;
    this.eventHandler = eventHandler;
    
    console.log('GanttRenderer: Created with container', { 
      container: this.container.className,
      bounds: this.container.getBoundingClientRect()
    });
  }
  
  initialize(): void {
    console.log('GanttRenderer: Initializing');
    
    this.createContainerStructure();
    this.measureContainer();
    this.initializeRenderers();
    this.setupEventDelegation();
    this.setupScrollSync();
    
    console.log('GanttRenderer: Initialization complete');
  }
  
  private createContainerStructure(): void {
    // Clear existing content
    this.container.innerHTML = '';
    
    // Set base container styles - ensure horizontal flex layout
    this.container.style.cssText = `
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: row;
      overflow: hidden;
      background: #ffffff;
    `;
    
    // Create task list container
    this.taskListContainer = document.createElement('div');
    this.taskListContainer.className = 'vibegantt-task-list';
    this.taskListContainer.style.cssText = `
      width: ${this.taskListWidth}px;
      min-width: ${this.taskListWidth}px;
      max-width: ${this.taskListWidth}px;
      flex-shrink: 0;
      background: #fafafa;
      border-right: 1px solid #e5e7eb;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create task list header
    const taskListHeader = document.createElement('div');
    taskListHeader.className = 'vibegantt-task-list-header';
    taskListHeader.style.cssText = `
      height: 60px;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      align-items: center;
      padding: 0 16px;
      font-weight: 600;
      font-size: 14px;
      color: #374151;
    `;
    taskListHeader.textContent = 'Tasks';
    
    // Create task list body
    const taskListBody = document.createElement('div');
    taskListBody.className = 'vibegantt-task-list-body';
    taskListBody.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
    `;
    
    this.taskListContainer.appendChild(taskListHeader);
    this.taskListContainer.appendChild(taskListBody);
    
    // Create chart container
    const chartContainer = document.createElement('div');
    chartContainer.className = 'vibegantt-chart';
    chartContainer.style.cssText = `
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;
    
    // Create timeline scroll wrapper
    const timelineScrollWrapper = document.createElement('div');
    timelineScrollWrapper.style.cssText = `
      height: 60px;
      overflow-x: hidden;
      overflow-y: hidden;
      position: relative;
    `;
    
    // Create timeline container
    this.timelineContainer = document.createElement('div');
    this.timelineContainer.className = 'vibegantt-timeline';
    this.timelineContainer.style.cssText = `
      height: 100%;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
      position: relative;
    `;
    
    // Create task scroll wrapper
    const taskScrollWrapper = document.createElement('div');
    taskScrollWrapper.className = 'vibegantt-tasks-wrapper';
    taskScrollWrapper.style.cssText = `
      flex: 1;
      overflow: auto;
      position: relative;
    `;
    
    // Create task container
    this.taskContainer = document.createElement('div');
    this.taskContainer.className = 'vibegantt-tasks';
    this.taskContainer.style.cssText = `
      position: relative;
      min-width: 100%;
    `;
    
    // Create dependency SVG container
    this.dependencyContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.dependencyContainer.setAttribute('class', 'vibegantt-dependencies');
    this.dependencyContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      overflow: visible;
    `;
    
    // Assemble structure
    timelineScrollWrapper.appendChild(this.timelineContainer);
    chartContainer.appendChild(timelineScrollWrapper);
    
    taskScrollWrapper.appendChild(this.taskContainer);
    this.taskContainer.appendChild(this.dependencyContainer);
    chartContainer.appendChild(taskScrollWrapper);
    
    this.container.appendChild(this.taskListContainer);
    this.container.appendChild(chartContainer);
    
    // Store references to scroll wrappers
    this.timelineScrollWrapper = timelineScrollWrapper;
    this.taskScrollWrapper = taskScrollWrapper;
    
    // Sync horizontal scrolling between timeline and tasks
    taskScrollWrapper.addEventListener('scroll', () => {
      timelineScrollWrapper.scrollLeft = taskScrollWrapper.scrollLeft;
    });
    
    // Sync scrolling between task list and chart
    this.setupScrollSync();
  }
  
  private measureContainer(): void {
    const bounds = this.container.getBoundingClientRect();
    this.containerWidth = bounds.width;
    this.containerHeight = bounds.height;
    
    console.log('GanttRenderer: Container measured', {
      width: this.containerWidth,
      height: this.containerHeight
    });
  }
  
  private initializeRenderers(): void {
    console.log('GanttRenderer: Initializing renderers');
    
    // No longer need sub-renderers with coordinate-based approach
    // All rendering is done directly in renderFromCoordinates
    
    console.log('GanttRenderer: Renderers initialized');
  }
  
  private setupEventDelegation(): void {
    this.eventManager = new GanttEventDelegationManager(
      this.container,
      this.eventHandler,
      'day', // Initial zoom level
      1.0    // Initial zoom factor
    );
    
    console.log('GanttRenderer: Event delegation setup complete');
  }
  
  private setupScrollSync(): void {
    const taskListBody = this.taskListContainer.querySelector('.vibegantt-task-list-body') as HTMLElement;
    
    // Sync vertical scrolling between task list and chart
    this.taskScrollWrapper.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      taskListBody.scrollTop = target.scrollTop;
    });
    
    taskListBody.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      this.taskScrollWrapper.scrollTop = target.scrollTop;
    });
  }
  
  /**
   * Render from pre-calculated coordinates (VibeGridDex pattern)
   * No date calculations, just direct positioning
   */
  renderFromCoordinates(params: {
    coordinateMapping: CoordinateMapping;
    tasks: Record<string, GanttTask>;
    dependencies: Record<string, TaskDependency>;
  }): void {
    console.log('GanttRenderer: Rendering from coordinates', {
      taskCount: params.coordinateMapping.tasks.length,
      segmentCount: params.coordinateMapping.timeline.segments.length,
      totalWidth: params.coordinateMapping.timeline.totalWidth
    });
    
    const { coordinateMapping, tasks, dependencies } = params;
    this.currentCoordinates = coordinateMapping;
    
    // Set container dimensions based on coordinate mapping
    const totalWidth = coordinateMapping.timeline.totalWidth;
    const totalHeight = coordinateMapping.tasks.length * 40 + 100; // 40px per row + padding
    
    this.timelineContainer.style.width = `${totalWidth}px`;
    this.taskContainer.style.width = `${totalWidth}px`;
    this.taskContainer.style.minHeight = `${totalHeight}px`;
    
    // Update SVG dimensions
    this.dependencyContainer.setAttribute('width', totalWidth.toString());
    this.dependencyContainer.setAttribute('height', totalHeight.toString());
    
    // Clear existing content
    this.clearAllContent();
    
    // Render timeline segments
    this.renderTimelineSegments(coordinateMapping.timeline.segments);
    
    // Render task list items and task bars
    const taskListBody = this.taskListContainer.querySelector('.vibegantt-task-list-body') as HTMLElement;
    taskListBody.innerHTML = ''; // Clear task list
    
    for (const taskCoord of coordinateMapping.tasks) {
      const task = tasks[taskCoord.taskId];
      if (task) {
        // Render task list item
        this.renderTaskListItem(task, taskCoord, taskListBody);
        
        // Render task bar
        this.renderTaskFromCoordinates(task, taskCoord);
      }
    }
    
    // Render dependencies
    this.renderDependenciesFromCoordinates(coordinateMapping, dependencies);
    
  }
  
  /**
   * Clear all rendered content
   */
  private clearAllContent(): void {
    // Don't clear timeline here - it will be updated in renderTimelineSegments
    
    // Clear tasks (preserve SVG)
    const taskElements = this.taskContainer.querySelectorAll('.vibegantt-task');
    taskElements.forEach(el => el.remove());
    
    // Clear dependencies
    if (this.dependencyContainer) {
      this.dependencyContainer.innerHTML = '';
    }
  }
  
  // Track last rendered timeline type to minimize re-renders
  private lastTimelineType: 'single' | 'double' | null = null;
  private timelineInner: HTMLElement | null = null;

  /**
   * Render timeline segments from coordinates
   */
  private renderTimelineSegments(segments: CoordinateMapping['timeline']['segments']): void {
    // Check if we're showing months only (hideSecondRow flag)
    const hideSecondRow = (segments as any).hideSecondRow || false;
    const isMonthView = segments.length > 0 && segments[0].isMonth;
    const currentTimelineType = (hideSecondRow || isMonthView) ? 'single' : 'double';
    
    // Only rebuild timeline structure if type changed
    if (this.lastTimelineType !== currentTimelineType || !this.timelineInner) {
      this.timelineContainer.innerHTML = '';
      
      // Create timeline inner container
      this.timelineInner = document.createElement('div');
      this.timelineInner.style.cssText = `
        position: relative;
        height: 100%;
        display: flex;
        align-items: stretch;
      `;
      
      this.timelineContainer.appendChild(this.timelineInner);
      this.lastTimelineType = currentTimelineType;
    }
    
    // Clear existing segments but keep structure
    this.timelineInner.innerHTML = '';
    
    if (hideSecondRow || isMonthView) {
      // Single row for months/quarters/years - full height
      const singleRow = document.createElement('div');
      singleRow.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        height: 60px;
        width: 100%;
        display: flex;
      `;
      
      // Render month segments directly
      for (const segment of segments) {
        const segmentEl = document.createElement('div');
        segmentEl.style.cssText = `
          position: absolute;
          left: ${segment.xPosition}px;
          width: ${segment.width}px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: 600;
          color: #374151;
          border-right: 1px solid #e5e7eb;
          background: #f9fafb;
        `;
        segmentEl.textContent = segment.label;
        singleRow.appendChild(segmentEl);
      }
      
      this.timelineInner.appendChild(singleRow);
    } else {
      // Two rows for days/weeks
      // Render month headers
      const monthRow = document.createElement('div');
      monthRow.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        height: 30px;
        width: 100%;
        display: flex;
        border-bottom: 1px solid #e5e7eb;
      `;
      
      // Render day segments
      const dayRow = document.createElement('div');
      dayRow.style.cssText = `
        position: absolute;
        top: 30px;
        left: 0;
        height: 30px;
        width: 100%;
        display: flex;
      `;
      
      let currentMonth = -1;
      let monthStartX = 0;
      
      for (const segment of segments) {
        const month = segment.date.getMonth();
        
        // Add month header when month changes
        if (month !== currentMonth) {
          if (currentMonth !== -1) {
            // Create month label for previous month
            const monthLabel = document.createElement('div');
            monthLabel.style.cssText = `
              position: absolute;
              left: ${monthStartX}px;
              width: ${segment.xPosition - monthStartX}px;
              height: 30px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              color: #374151;
              border-right: 1px solid #e5e7eb;
            `;
            monthLabel.textContent = new Date(segment.date.getFullYear(), currentMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            monthRow.appendChild(monthLabel);
          }
          currentMonth = month;
          monthStartX = segment.xPosition;
        }
        
        // Create day segment
        const daySegment = document.createElement('div');
        daySegment.style.cssText = `
          position: absolute;
          left: ${segment.xPosition}px;
          width: ${segment.width}px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          color: #6b7280;
          border-right: 1px solid #e5e7eb;
          ${segment.date.getDay() === 0 || segment.date.getDay() === 6 ? 'background: #f9fafb;' : ''}
        `;
        daySegment.textContent = segment.label;
        dayRow.appendChild(daySegment);
      }
      
      // Add final month label
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        const monthLabel = document.createElement('div');
        monthLabel.style.cssText = `
          position: absolute;
          left: ${monthStartX}px;
          width: ${lastSegment.xPosition + lastSegment.width - monthStartX}px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
        `;
        monthLabel.textContent = lastSegment.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        monthRow.appendChild(monthLabel);
      }
      
      this.timelineInner.appendChild(monthRow);
      this.timelineInner.appendChild(dayRow);
    }
  }
  
  /**
   * Render a task from coordinates
   */
  private renderTaskFromCoordinates(task: GanttTask, coordinates: CoordinateMapping['tasks'][0]): void {
    const taskEl = document.createElement('div');
    taskEl.className = 'vibegantt-task';
    taskEl.dataset.taskId = task.id;
    taskEl.style.cssText = `
      position: absolute;
      left: ${coordinates.xPosition}px;
      top: ${coordinates.yPosition}px;
      width: ${coordinates.width}px;
      height: ${coordinates.height}px;
      background: ${task.color || '#3b82f6'};
      border-radius: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      padding: 0 8px;
      color: white;
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: transform 0.1s ease;
      ${this.selectedTaskIds.has(task.id) ? 'box-shadow: 0 0 0 2px #3b82f6;' : ''}
    `;
    
    // Add progress bar if exists
    if (task.progress !== undefined && task.progress > 0) {
      const progressBar = document.createElement('div');
      progressBar.style.cssText = `
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: ${task.progress}%;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
      `;
      taskEl.appendChild(progressBar);
    }
    
    // Add task name
    const nameEl = document.createElement('span');
    nameEl.style.position = 'relative';
    nameEl.textContent = task.title || task.name || 'Untitled Task';
    taskEl.appendChild(nameEl);
    
    // Add resize handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'vibegantt-resize-handle vibegantt-resize-handle-left';
    leftHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      width: 8px;
      height: 100%;
      cursor: ew-resize;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    
    const rightHandle = document.createElement('div');
    rightHandle.className = 'vibegantt-resize-handle vibegantt-resize-handle-right';
    rightHandle.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      width: 8px;
      height: 100%;
      cursor: ew-resize;
      opacity: 0;
      transition: opacity 0.2s;
    `;
    
    // Add dependency link handle
    const linkHandle = document.createElement('div');
    linkHandle.className = 'vibegantt-link-handle';
    linkHandle.dataset.taskId = task.id;
    linkHandle.style.cssText = `
      position: absolute;
      right: -12px;
      top: 50%;
      transform: translateY(-50%);
      width: 8px;
      height: 8px;
      background: #6b7280;
      border: 2px solid white;
      border-radius: 50%;
      cursor: crosshair;
      opacity: 0;
      transition: opacity 0.2s;
      z-index: 10;
    `;
    
    // Add click handler for dependency creation
    linkHandle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      this.startDependencyCreation(task.id, e);
    });
    
    taskEl.appendChild(leftHandle);
    taskEl.appendChild(rightHandle);
    taskEl.appendChild(linkHandle);
    
    // Show handles on hover
    taskEl.addEventListener('mouseenter', () => {
      leftHandle.style.opacity = '1';
      rightHandle.style.opacity = '1';
      linkHandle.style.opacity = '1';
    });
    
    taskEl.addEventListener('mouseleave', () => {
      leftHandle.style.opacity = '0';
      rightHandle.style.opacity = '0';
      linkHandle.style.opacity = '0';
    });
    
    this.taskContainer.appendChild(taskEl);
  }
  
  private renderTaskListItem(task: GanttTask, coordinates: CoordinateMapping['tasks'][0], container: HTMLElement): void {
    const taskItem = document.createElement('div');
    taskItem.className = 'vibegantt-task-list-item';
    taskItem.dataset.taskId = task.id;
    taskItem.style.cssText = `
      height: ${coordinates.height}px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
      transition: background-color 0.1s ease;
      position: relative;
      ${this.selectedTaskIds.has(task.id) ? 'background: #eff6ff;' : ''}
    `;
    
    // Add hover effect
    taskItem.addEventListener('mouseenter', () => {
      if (!this.selectedTaskIds.has(task.id)) {
        taskItem.style.backgroundColor = '#f9fafb';
      }
    });
    
    taskItem.addEventListener('mouseleave', () => {
      if (!this.selectedTaskIds.has(task.id)) {
        taskItem.style.backgroundColor = 'transparent';
      }
    });
    
    // Add click handler to select task
    taskItem.addEventListener('click', (e) => {
      e.stopPropagation();
      this.eventHandler({
        type: 'SELECT_TASK',
        taskId: task.id
      });
    });
    
    // Task name
    const taskName = document.createElement('span');
    taskName.style.cssText = `
      flex: 1;
      font-size: 14px;
      color: #374151;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `;
    taskName.textContent = task.title || task.name || 'Untitled Task';
    
    // Progress indicator
    if (task.progress !== undefined) {
      const progressBadge = document.createElement('span');
      progressBadge.style.cssText = `
        margin-left: 8px;
        font-size: 12px;
        color: #6b7280;
        background: #f3f4f6;
        padding: 2px 8px;
        border-radius: 4px;
      `;
      progressBadge.textContent = `${task.progress}%`;
      taskItem.appendChild(progressBadge);
    }
    
    taskItem.appendChild(taskName);
    container.appendChild(taskItem);
  }
  
  /**
   * Render dependencies from coordinates
   */
  private renderDependenciesFromCoordinates(
    coordinateMapping: CoordinateMapping,
    dependencies: Record<string, TaskDependency>
  ): void {
    // Create arrow marker definition
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', 'dependency-arrow');
    marker.setAttribute('markerWidth', '10');
    marker.setAttribute('markerHeight', '10');
    marker.setAttribute('refX', '9');
    marker.setAttribute('refY', '3');
    marker.setAttribute('orient', 'auto');
    marker.setAttribute('markerUnits', 'strokeWidth');
    
    const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    arrow.setAttribute('d', 'M0,0 L0,6 L9,3 z');
    arrow.setAttribute('fill', '#6b7280');
    
    marker.appendChild(arrow);
    defs.appendChild(marker);
    this.dependencyContainer.appendChild(defs);
    
    // Render each dependency
    for (const dep of Object.values(dependencies)) {
      const sourceCoord = coordinateMapping.tasks.find(t => t.taskId === dep.predecessorId);
      const targetCoord = coordinateMapping.tasks.find(t => t.taskId === dep.successorId);
      
      if (!sourceCoord || !targetCoord) continue;
      
      // Calculate connection points
      const sourceX = sourceCoord.xPosition + sourceCoord.width;
      const sourceY = sourceCoord.yPosition + sourceCoord.height / 2;
      const targetX = targetCoord.xPosition;
      const targetY = targetCoord.yPosition + targetCoord.height / 2;
      
      // Create path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'vibegantt-dependency');
      path.setAttribute('data-dependency-id', dep.id);
      
      // Simple L-shaped path
      const midX = sourceX + 10;
      const d = `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#6b7280');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('marker-end', 'url(#dependency-arrow)');
      
      this.dependencyContainer.appendChild(path);
    }
  }
  
  /**
   * Update selection state
   */
  updateSelection(selectedTaskIds: Set<string>): void {
    this.selectedTaskIds = selectedTaskIds;
    
    // Update task elements
    const taskElements = this.taskContainer.querySelectorAll('.vibegantt-task');
    taskElements.forEach(el => {
      const taskId = (el as HTMLElement).dataset.taskId;
      if (taskId) {
        if (selectedTaskIds.has(taskId)) {
          (el as HTMLElement).style.boxShadow = '0 0 0 2px #3b82f6';
        } else {
          (el as HTMLElement).style.boxShadow = '';
        }
      }
    });
  }
  
  /**
   * Resize the renderer
   */
  resize(width: number, height: number): void {
    this.containerWidth = width;
    this.containerHeight = height;
    
    console.log('GanttRenderer: Resized', { width, height });
    
    // Container will scroll to show full timeline
    // No need to update internal dimensions as they're coordinate-based
  }
  
  /**
   * Start dependency creation from a task
   */
  private startDependencyCreation(sourceTaskId: string, event: MouseEvent): void {
    console.log('GanttRenderer: Starting dependency creation from task', sourceTaskId);
    
    // Send event to machine
    this.eventHandler({
      type: 'DEPENDENCY_CREATE_START',
      sourceTaskId
    });
    
    // Create visual feedback - a line that follows the mouse
    const dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    dragLine.setAttribute('class', 'vibegantt-dependency-drag-line');
    dragLine.setAttribute('stroke', '#3b82f6');
    dragLine.setAttribute('stroke-width', '2');
    dragLine.setAttribute('stroke-dasharray', '5,5');
    
    // Get source task position
    const sourceTask = this.taskContainer.querySelector(`[data-task-id="${sourceTaskId}"]`) as HTMLElement;
    if (!sourceTask) return;
    
    const sourceRect = sourceTask.getBoundingClientRect();
    const containerRect = this.taskContainer.getBoundingClientRect();
    const startX = sourceRect.right - containerRect.left + this.taskContainer.scrollLeft;
    const startY = sourceRect.top - containerRect.top + sourceRect.height / 2 + this.taskContainer.scrollTop;
    
    dragLine.setAttribute('x1', startX.toString());
    dragLine.setAttribute('y1', startY.toString());
    dragLine.setAttribute('x2', startX.toString());
    dragLine.setAttribute('y2', startY.toString());
    
    this.dependencyContainer.appendChild(dragLine);
    
    // Track mouse movement
    const handleMouseMove = (e: MouseEvent) => {
      const x = e.clientX - containerRect.left + this.taskContainer.scrollLeft;
      const y = e.clientY - containerRect.top + this.taskContainer.scrollTop;
      dragLine.setAttribute('x2', x.toString());
      dragLine.setAttribute('y2', y.toString());
    };
    
    // Handle mouse up
    const handleMouseUp = (e: MouseEvent) => {
      // Find target task
      const target = e.target as HTMLElement;
      const targetTask = target.closest('.vibegantt-task') as HTMLElement;
      
      if (targetTask) {
        const targetTaskId = targetTask.dataset.taskId;
        if (targetTaskId && targetTaskId !== sourceTaskId) {
          console.log('GanttRenderer: Creating dependency to task', targetTaskId);
          this.eventHandler({
            type: 'DEPENDENCY_CREATE_END',
            targetTaskId
          });
        }
      }
      
      // Clean up
      dragLine.remove();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }
  
  /**
   * Handle drag move for real-time visual feedback
   */
  handleDragMove(taskId: string, deltaX: number): void {
    const taskElement = this.taskContainer.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
    if (!taskElement || !this.currentCoordinates) return;
    
    // Find task coordinates
    const taskCoord = this.currentCoordinates.tasks.find(t => t.taskId === taskId);
    if (!taskCoord) return;
    
    // Apply transform for visual feedback
    taskElement.style.transform = `translateX(${deltaX}px)`;
    taskElement.style.zIndex = '1000';
  }
  
  /**
   * Handle resize move for real-time visual feedback
   */
  handleResizeMove(taskId: string, handle: 'left' | 'right', deltaX: number): void {
    const taskElement = this.taskContainer.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
    if (!taskElement || !this.currentCoordinates) return;
    
    // Find task coordinates
    const taskCoord = this.currentCoordinates.tasks.find(t => t.taskId === taskId);
    if (!taskCoord) return;
    
    if (handle === 'left') {
      // Resize from left - adjust position and width
      taskElement.style.transform = `translateX(${deltaX}px)`;
      taskElement.style.width = `${taskCoord.width - deltaX}px`;
    } else {
      // Resize from right - just adjust width
      taskElement.style.width = `${taskCoord.width + deltaX}px`;
    }
    
    taskElement.style.zIndex = '1000';
  }
  
  /**
   * Reset drag/resize visual state
   */
  resetDragState(taskId: string): void {
    const taskElement = this.taskContainer.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;
    if (taskElement) {
      taskElement.style.transform = '';
      taskElement.style.width = '';
      taskElement.style.zIndex = '';
    }
  }
  
  /**
   * Update scroll position (for zoom anchoring)
   */
  updateScrollPosition(scrollX: number, scrollY?: number): void {
    if (this.taskScrollWrapper) {
      console.log('🎯 GanttRenderer: Applying scroll position', { scrollX, scrollY });
      
      // Use requestAnimationFrame to sync with browser paint cycle
      requestAnimationFrame(() => {
        if (this.taskScrollWrapper) {
          this.taskScrollWrapper.scrollLeft = Math.max(0, scrollX);
          if (scrollY !== undefined) {
            this.taskScrollWrapper.scrollTop = Math.max(0, scrollY);
          }
          
          // Force synchronous layout to ensure scroll is applied
          // This prevents the next zoom event from reading stale values
          const _ = this.taskScrollWrapper.scrollLeft;
        }
      });
    }
  }
  
  /**
   * Clean up and destroy
   */
  destroy(): void {
    console.log('GanttRenderer: Destroying');
    
    // Clean up event manager
    if (this.eventManager) {
      this.eventManager.destroy();
    }
    
    // Clear all content
    this.clearAllContent();
    
    // Reset timeline cache
    this.lastTimelineType = null;
    this.timelineInner = null;
    
    // Clear container
    this.container.innerHTML = '';
    
    console.log('GanttRenderer: Destroyed');
  }
}