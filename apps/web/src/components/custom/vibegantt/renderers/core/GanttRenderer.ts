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
  private selectedDependencyId: string | null = null;
  
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
    // Clear timeline
    if (this.timelineContainer) {
      this.timelineContainer.innerHTML = '';
    }
    
    // Clear tasks (preserve SVG)
    const taskElements = this.taskContainer.querySelectorAll('.vibegantt-task');
    taskElements.forEach(el => el.remove());
    
    // Clear dependencies
    if (this.dependencyContainer) {
      this.dependencyContainer.innerHTML = '';
    }
  }
  
  /**
   * Render timeline segments from coordinates
   */
  private renderTimelineSegments(segments: CoordinateMapping['timeline']['segments']): void {
    // Create timeline inner container
    const timelineInner = document.createElement('div');
    timelineInner.style.cssText = `
      position: relative;
      height: 100%;
      display: flex;
      align-items: stretch;
    `;
    
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
    
    timelineInner.appendChild(monthRow);
    timelineInner.appendChild(dayRow);
    this.timelineContainer.appendChild(timelineInner);
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
    
    // Add dependency link handle - TEMPORARILY DISABLED per Issue #12
    // Dependencies don't work properly - need proper domain functions for CRUD with 4 types (FS, SS, FF, SF)
    // const linkHandle = document.createElement('div');
    // linkHandle.className = 'vibegantt-link-handle';
    // linkHandle.dataset.taskId = task.id;
    // linkHandle.style.cssText = `
    //   position: absolute;
    //   right: -12px;
    //   top: 50%;
    //   transform: translateY(-50%);
    //   width: 8px;
    //   height: 8px;
    //   background: #6b7280;
    //   border: 2px solid white;
    //   border-radius: 50%;
    //   cursor: crosshair;
    //   opacity: 0;
    //   transition: opacity 0.2s;
    //   z-index: 10;
    // `;
    
    // Add click handler for dependency creation
    // linkHandle.addEventListener('mousedown', (e) => {
    //   e.stopPropagation();
    //   e.preventDefault();
    //   this.startDependencyCreation(task.id, e);
    // });
    
    taskEl.appendChild(leftHandle);
    taskEl.appendChild(rightHandle);
    // taskEl.appendChild(linkHandle); // DISABLED
    
    // Show handles on hover
    taskEl.addEventListener('mouseenter', () => {
      leftHandle.style.opacity = '1';
      rightHandle.style.opacity = '1';
      // linkHandle.style.opacity = '1'; // DISABLED
    });
    
    taskEl.addEventListener('mouseleave', () => {
      leftHandle.style.opacity = '0';
      rightHandle.style.opacity = '0';
      // linkHandle.style.opacity = '0'; // DISABLED
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
    // Render each dependency without arrow markers
    for (const dep of Object.values(dependencies)) {
      const sourceCoord = coordinateMapping.tasks.find(t => t.taskId === dep.predecessorId);
      const targetCoord = coordinateMapping.tasks.find(t => t.taskId === dep.successorId);
      
      if (!sourceCoord || !targetCoord) continue;
      
      // Calculate connection points based on dependency type
      let sourceX: number, sourceY: number, targetX: number, targetY: number;
      
      // Default to finish-to-start positioning
      sourceX = sourceCoord.xPosition + sourceCoord.width;
      sourceY = sourceCoord.yPosition + sourceCoord.height / 2;
      targetX = targetCoord.xPosition;
      targetY = targetCoord.yPosition + targetCoord.height / 2;
      
      // Adjust based on dependency type if available
      if (dep.type === 'start-to-start') {
        sourceX = sourceCoord.xPosition;
        targetX = targetCoord.xPosition;
      } else if (dep.type === 'finish-to-finish') {
        sourceX = sourceCoord.xPosition + sourceCoord.width;
        targetX = targetCoord.xPosition + targetCoord.width;
      } else if (dep.type === 'start-to-finish') {
        sourceX = sourceCoord.xPosition;
        targetX = targetCoord.xPosition + targetCoord.width;
      }
      
      // Create group for dependency (line + interaction elements)
      const depGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      depGroup.setAttribute('class', 'vibegantt-dependency-group');
      depGroup.setAttribute('data-dependency-id', dep.id);
      depGroup.setAttribute('data-predecessor-id', dep.predecessorId);
      depGroup.setAttribute('data-successor-id', dep.successorId);
      
      // Create path
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'vibegantt-dependency');
      path.setAttribute('data-dependency-id', dep.id);
      
      // Simple L-shaped path
      const midX = sourceX + (targetX - sourceX) / 2;
      const d = `M ${sourceX} ${sourceY} L ${midX} ${sourceY} L ${midX} ${targetY} L ${targetX} ${targetY}`;
      
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#6b7280');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('pointer-events', 'visibleStroke');
      path.style.cursor = 'pointer';
      
      // Create invisible wider path for easier clicking
      const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      hitArea.setAttribute('d', d);
      hitArea.setAttribute('fill', 'none');
      hitArea.setAttribute('stroke', 'transparent');
      hitArea.setAttribute('stroke-width', '10');
      hitArea.setAttribute('pointer-events', 'visibleStroke');
      hitArea.style.cursor = 'pointer';
      hitArea.setAttribute('data-dependency-id', dep.id);
      
      // Add hover effect
      depGroup.addEventListener('mouseenter', () => {
        path.setAttribute('stroke', '#3b82f6');
        path.setAttribute('stroke-width', '3');
      });
      
      depGroup.addEventListener('mouseleave', () => {
        if (!depGroup.classList.contains('selected')) {
          path.setAttribute('stroke', '#6b7280');
          path.setAttribute('stroke-width', '2');
        }
      });
      
      // Add click handler for selection
      depGroup.addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Dependency clicked:', dep.id);
        
        // Store selection state
        this.selectedDependencyId = dep.id;
        
        // Remove previous selection
        this.dependencyContainer.querySelectorAll('.selected').forEach(el => {
          el.classList.remove('selected');
          const pathEl = el.querySelector('.vibegantt-dependency');
          if (pathEl) {
            pathEl.setAttribute('stroke', '#6b7280');
            pathEl.setAttribute('stroke-width', '2');
          }
        });
        
        // Select this dependency
        depGroup.classList.add('selected');
        path.setAttribute('stroke', '#3b82f6');
        path.setAttribute('stroke-width', '3');
        
        // Show delete button
        this.showDependencyControls(depGroup, dep.id, midX, (sourceY + targetY) / 2);
        
        // Send selection event - but don't trigger re-render
        this.eventHandler({
          type: 'DEPENDENCY_SELECT',
          dependencyId: dep.id,
          skipRender: true  // Add flag to prevent re-render
        });
      });
      
      // Add connection handles for reassignment (initially hidden)
      const startHandle = this.createConnectionHandle(sourceX, sourceY, 'start', dep.id);
      const endHandle = this.createConnectionHandle(targetX, targetY, 'end', dep.id);
      
      depGroup.appendChild(path);
      depGroup.appendChild(hitArea);
      depGroup.appendChild(startHandle);
      depGroup.appendChild(endHandle);
      
      // Apply selected state if this dependency is selected
      if (this.selectedDependencyId === dep.id) {
        depGroup.classList.add('selected');
        path.setAttribute('stroke', '#3b82f6');
        path.setAttribute('stroke-width', '3');
        // Show controls after a short delay to ensure DOM is ready
        setTimeout(() => {
          this.showDependencyControls(depGroup, dep.id, midX, (sourceY + targetY) / 2);
        }, 10);
      }
      
      this.dependencyContainer.appendChild(depGroup);
    }
  }
  
  /**
   * Create a connection handle for dependency reassignment
   */
  private createConnectionHandle(x: number, y: number, type: 'start' | 'end', dependencyId: string): SVGElement {
    const handle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    handle.setAttribute('class', 'connection-handle');
    handle.setAttribute('cx', x.toString());
    handle.setAttribute('cy', y.toString());
    handle.setAttribute('r', '6');
    handle.setAttribute('fill', '#3b82f6');
    handle.setAttribute('stroke', 'white');
    handle.setAttribute('stroke-width', '2');
    handle.setAttribute('data-dependency-id', dependencyId);
    handle.setAttribute('data-handle-type', type);
    handle.style.opacity = '0';
    handle.style.cursor = 'move';
    handle.style.transition = 'opacity 0.2s';
    handle.style.pointerEvents = 'all';
    
    // Add drag functionality
    handle.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      
      console.log('Starting dependency drag', { dependencyId, type });
      
      // Create visual feedback line
      const dragLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      dragLine.setAttribute('class', 'dependency-drag-line');
      dragLine.setAttribute('stroke', '#3b82f6');
      dragLine.setAttribute('stroke-width', '2');
      dragLine.setAttribute('stroke-dasharray', '5,5');
      dragLine.setAttribute('x1', x.toString());
      dragLine.setAttribute('y1', y.toString());
      dragLine.setAttribute('x2', x.toString());
      dragLine.setAttribute('y2', y.toString());
      
      this.dependencyContainer.appendChild(dragLine);
      
      const containerRect = this.taskContainer.getBoundingClientRect();
      
      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX - containerRect.left + this.taskContainer.scrollLeft;
        const currentY = moveEvent.clientY - containerRect.top + this.taskContainer.scrollTop;
        dragLine.setAttribute('x2', currentX.toString());
        dragLine.setAttribute('y2', currentY.toString());
        
        // Highlight target task on hover
        const targetElement = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const targetTask = targetElement?.closest('.vibegantt-task') as HTMLElement;
        
        // Remove previous highlights
        this.taskContainer.querySelectorAll('.dependency-target-highlight').forEach(el => {
          el.classList.remove('dependency-target-highlight');
          (el as HTMLElement).style.outline = '';
        });
        
        if (targetTask) {
          targetTask.classList.add('dependency-target-highlight');
          targetTask.style.outline = '2px solid #3b82f6';
        }
      };
      
      const handleMouseUp = async (upEvent: MouseEvent) => {
        // Find target task
        const targetElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const targetTask = targetElement?.closest('.vibegantt-task') as HTMLElement;
        
        if (targetTask) {
          const newTaskId = targetTask.dataset.taskId;
          if (newTaskId) {
            console.log('Reassigning dependency', { 
              dependencyId, 
              handleType: type === 'start' ? 'predecessor' : 'successor',
              newTaskId 
            });
            
            // Call domain service to reassign
            try {
              const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
              await entityDependencyService.reassignDependency(
                dependencyId,
                type === 'start' ? 'predecessor' : 'successor',
                newTaskId
              );
              
              // Trigger re-render
              this.eventHandler({
                type: 'DEPENDENCY_REASSIGN',
                dependencyId,
                handleType: type === 'start' ? 'predecessor' : 'successor',
                newTaskId
              });
            } catch (error) {
              console.error('Failed to reassign dependency:', error);
            }
          }
        }
        
        // Clean up
        dragLine.remove();
        this.taskContainer.querySelectorAll('.dependency-target-highlight').forEach(el => {
          el.classList.remove('dependency-target-highlight');
          (el as HTMLElement).style.outline = '';
        });
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });
    
    return handle;
  }
  
  /**
   * Show dependency controls (delete button, handles)
   */
  private showDependencyControls(depGroup: SVGElement, dependencyId: string, x: number, y: number): void {
    // Remove any existing controls
    this.dependencyContainer.querySelectorAll('.dependency-controls').forEach(el => el.remove());
    
    // Create controls group
    const controls = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    controls.setAttribute('class', 'dependency-controls');
    
    // Create delete button
    const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    deleteBtn.setAttribute('class', 'delete-button');
    deleteBtn.setAttribute('data-dependency-id', dependencyId);
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.setAttribute('transform', `translate(${x}, ${y})`);
    
    // Delete button background
    const deleteBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    deleteBg.setAttribute('r', '12');
    deleteBg.setAttribute('fill', '#ef4444');
    deleteBg.setAttribute('stroke', 'white');
    deleteBg.setAttribute('stroke-width', '2');
    
    // Delete button X icon
    const deleteIcon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    deleteIcon.setAttribute('d', 'M -5 -5 L 5 5 M 5 -5 L -5 5');
    deleteIcon.setAttribute('stroke', 'white');
    deleteIcon.setAttribute('stroke-width', '2');
    deleteIcon.setAttribute('stroke-linecap', 'round');
    deleteIcon.setAttribute('fill', 'none');
    
    deleteBtn.appendChild(deleteBg);
    deleteBtn.appendChild(deleteIcon);
    
    // Add click handler for delete
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      console.log('Delete dependency:', dependencyId);
      
      // Call domain service to delete
      try {
        const { entityDependencyService } = await import('/src/domain/entity-dependency-service.ts');
        await entityDependencyService.deleteUI(dependencyId);
        
        // Clear selected state if deleting selected dependency
        if (this.selectedDependencyId === dependencyId) {
          this.selectedDependencyId = null;
        }
        
        // Remove from DOM
        depGroup.remove();
        controls.remove();
        
        // Send delete event
        this.eventHandler({
          type: 'DEPENDENCY_DELETE',
          dependencyId
        });
      } catch (error) {
        console.error('Failed to delete dependency:', error);
      }
    });
    
    controls.appendChild(deleteBtn);
    
    // Show connection handles
    depGroup.querySelectorAll('.connection-handle').forEach(handle => {
      (handle as SVGElement).style.opacity = '1';
    });
    
    this.dependencyContainer.appendChild(controls);
    
    // Hide controls when clicking elsewhere
    setTimeout(() => {
      const hideControls = (e: MouseEvent) => {
        const target = e.target as Element;
        if (!target.closest('.dependency-controls') && !target.closest('.vibegantt-dependency-group')) {
          controls.remove();
          depGroup.classList.remove('selected');
          depGroup.querySelectorAll('.connection-handle').forEach(handle => {
            (handle as SVGElement).style.opacity = '0';
          });
          const pathEl = depGroup.querySelector('.vibegantt-dependency');
          if (pathEl) {
            pathEl.setAttribute('stroke', '#6b7280');
            pathEl.setAttribute('stroke-width', '2');
          }
          // Clear selected dependency state
          this.selectedDependencyId = null;
          document.removeEventListener('click', hideControls);
        }
      };
      document.addEventListener('click', hideControls);
    }, 100);
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
   * Update dependency selection
   */
  updateDependencySelection(dependencyId: string | null): void {
    // Store the selection
    this.selectedDependencyId = dependencyId;
    
    // Update visual state if dependency exists in current DOM
    if (dependencyId) {
      const depGroup = this.dependencyContainer.querySelector(`[data-dependency-id="${dependencyId}"]`)?.parentElement as SVGElement;
      if (depGroup) {
        // Clear other selections
        this.dependencyContainer.querySelectorAll('.selected').forEach(el => {
          el.classList.remove('selected');
          const pathEl = el.querySelector('.vibegantt-dependency');
          if (pathEl) {
            pathEl.setAttribute('stroke', '#6b7280');
            pathEl.setAttribute('stroke-width', '2');
          }
        });
        
        // Select this dependency
        depGroup.classList.add('selected');
        const path = depGroup.querySelector('.vibegantt-dependency');
        if (path) {
          path.setAttribute('stroke', '#3b82f6');
          path.setAttribute('stroke-width', '3');
        }
        
        // Show controls
        const sourceCoord = this.currentCoordinates?.tasks.find(t => 
          t.taskId === depGroup.dataset.predecessorId
        );
        const targetCoord = this.currentCoordinates?.tasks.find(t => 
          t.taskId === depGroup.dataset.successorId
        );
        
        if (sourceCoord && targetCoord) {
          const midX = (sourceCoord.xPosition + sourceCoord.width + targetCoord.xPosition) / 2;
          const midY = (sourceCoord.yPosition + targetCoord.yPosition + sourceCoord.height) / 2;
          this.showDependencyControls(depGroup, dependencyId, midX, midY);
        }
      }
    } else {
      // Clear all dependency selections
      this.dependencyContainer.querySelectorAll('.selected').forEach(el => {
        el.classList.remove('selected');
        const pathEl = el.querySelector('.vibegantt-dependency');
        if (pathEl) {
          pathEl.setAttribute('stroke', '#6b7280');
          pathEl.setAttribute('stroke-width', '2');
        }
      });
      
      // Remove any controls
      this.dependencyContainer.querySelectorAll('.dependency-controls').forEach(el => el.remove());
    }
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
    
    // Clear container
    this.container.innerHTML = '';
    
    console.log('GanttRenderer: Destroyed');
  }
}