import type { 
  GanttTask, 
  TaskDependency
} from '../../types';
import type { CoordinateMapping } from '../../stores/gantt-data-store';
import { GanttEventDelegationManager } from '../../systems/GanttEventDelegationManager';
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/vibegantt/renderers/core/GanttRenderer.ts');

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
  private machineEventHandler?: (event: any) => void; // Direct machine event handler
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
  private currentTasks: Record<string, GanttTask> = {};
  private currentDependencies: Record<string, TaskDependency> = {};
  private selectedTaskIds = new Set<string>();
  private selectedDependencyId: string | null = null;
  private pendingDayWidth: number | null = null;
  
  constructor(container: HTMLElement, eventHandler: (event: any) => void, machineEventHandler?: (event: any) => void) {
    this.container = container;
    this.eventHandler = eventHandler;
    this.machineEventHandler = machineEventHandler;
    
    log.info('GanttRenderer: Created with container', { 
      container: this.container.className,
      bounds: this.container.getBoundingClientRect()
    });
  }
  
  initialize(): void {
    log.info('GanttRenderer: Initializing');
    
    this.createContainerStructure();
    this.measureContainer();
    this.initializeRenderers();
    this.setupEventDelegation();
    this.setupScrollSync();
    
    log.info('GanttRenderer: Initialization complete');
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
    
    // Create dependency container (DOM-based instead of SVG)
    this.dependencyContainer = document.createElement('div');
    this.dependencyContainer.className = 'vibegantt-dependencies';
    this.dependencyContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
      z-index: 1;
    `;
    
    // Assemble structure
    timelineScrollWrapper.appendChild(this.timelineContainer);
    chartContainer.appendChild(timelineScrollWrapper);
    
    taskScrollWrapper.appendChild(this.taskContainer);
    // Add dependency container first so it's behind tasks
    this.taskContainer.appendChild(this.dependencyContainer);
    chartContainer.appendChild(taskScrollWrapper);
    
    this.container.appendChild(this.taskListContainer);
    this.container.appendChild(chartContainer);
    
    // Store references to scroll wrappers
    this.timelineScrollWrapper = timelineScrollWrapper;
    this.taskScrollWrapper = taskScrollWrapper;
    
    // Sync horizontal scrolling between timeline and tasks
    taskScrollWrapper.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      timelineScrollWrapper.scrollLeft = target.scrollLeft;
      
      // Send scroll event to machine to update viewport state
      if (this.machineEventHandler) {
        this.machineEventHandler({
          type: 'SCROLL',
          scrollX: target.scrollLeft,
          scrollY: target.scrollTop,
        });
      }
    });
    
    // Sync scrolling between task list and chart
    this.setupScrollSync();
  }
  
  private measureContainer(): void {
    const bounds = this.container.getBoundingClientRect();
    this.containerWidth = bounds.width;
    this.containerHeight = bounds.height;
    
    log.info('GanttRenderer: Container measured', {
      width: this.containerWidth,
      height: this.containerHeight
    });
  }
  
  private initializeRenderers(): void {
    log.info('GanttRenderer: Initializing renderers');
    
    // No longer need sub-renderers with coordinate-based approach
    // All rendering is done directly in renderFromCoordinates
    
    log.info('GanttRenderer: Renderers initialized');
  }
  
  private setupEventDelegation(): void {
    // Create a hybrid event handler that routes events appropriately
    const hybridEventHandler = (event: any) => {
      log.info('GanttRenderer: Routing event:', event.type);
      
      // Route zoom events directly to machine, other events through renderer
      if (event.type === 'ZOOM_REQUEST' && this.machineEventHandler) {
        log.info('GanttRenderer: Routing ZOOM_REQUEST directly to machine');
        this.machineEventHandler(event);
      } else {
        log.info('GanttRenderer: Routing event through renderer forwarding');
        this.eventHandler(event);
      }
    };
    
    this.eventManager = new GanttEventDelegationManager(
      this.container,
      hybridEventHandler,
      'day', // Initial zoom level
      1.0    // Initial zoom factor
    );
    
    log.info('GanttRenderer: Event delegation setup complete with hybrid routing');
  }
  
  private setupScrollSync(): void {
    const taskListBody = this.taskListContainer.querySelector('.vibegantt-task-list-body') as HTMLElement;
    
    // Sync vertical scrolling between task list and chart  
    // Note: horizontal scroll and machine events are handled in the main scroll listener above
    taskListBody.addEventListener('scroll', (e) => {
      const target = e.target as HTMLElement;
      this.taskScrollWrapper.scrollTop = target.scrollTop;
      
      // Send scroll event to machine to update viewport state  
      if (this.machineEventHandler) {
        this.machineEventHandler({
          type: 'SCROLL',
          scrollX: this.taskScrollWrapper.scrollLeft,
          scrollY: target.scrollTop,
        });
      }
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
    log.info('GanttRenderer: Rendering from coordinates', {
      taskCount: params.coordinateMapping.tasks.length,
      segmentCount: params.coordinateMapping.timeline.segments.length,
      totalWidth: params.coordinateMapping.timeline.totalWidth,
      dependencyCount: Object.keys(params.dependencies).length,
      dependencyIds: Object.keys(params.dependencies)
    });
    
    const { coordinateMapping, tasks, dependencies } = params;
    this.currentCoordinates = coordinateMapping;
    this.currentTasks = tasks;
    this.currentDependencies = dependencies;
    
    // Apply any pending dayWidth update
    if (this.pendingDayWidth !== null) {
      log.info('GanttRenderer: Applying pending dayWidth update:', this.pendingDayWidth);
      const pendingWidth = this.pendingDayWidth;
      this.pendingDayWidth = null; // Clear the pending update
      
      // Apply the dayWidth update now that we have coordinates
      setTimeout(() => {
        this.updateTimelineLayout(pendingWidth);
      }, 0);
      return; // Don't render with old coordinates
    }
    
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
    // Clear existing timeline
    this.timelineContainer.innerHTML = '';
    
    // Create timeline inner container
    const timelineInner = document.createElement('div');
    timelineInner.style.cssText = `
      position: relative;
      height: 100%;
      width: ${segments[segments.length - 1]?.xPosition + segments[segments.length - 1]?.width || 0}px;
    `;
    
    // Determine the display mode based on segment labels (set by coordinate mapper based on zoom)
    const hasMonthLabels = segments.some(s => s.isMonth);
    const hasWeekLabels = segments.some(s => s.isWeek);
    
    // Create header row (shows months/years)
    const headerRow = document.createElement('div');
    headerRow.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 30px;
      width: 100%;
      overflow: hidden;
      border-bottom: 1px solid #e5e7eb;
    `;
    
    // Create main row (shows days/weeks/months based on zoom)
    const mainRow = document.createElement('div');
    mainRow.style.cssText = `
      position: absolute;
      top: 30px;
      left: 0;
      height: 30px;
      width: 100%;
      overflow: hidden;
    `;
    
    // Track current period for header grouping
    let currentHeaderPeriod = '';
    let headerStartX = 0;
    const headerLabels: Array<{ start: number; end: number; label: string }> = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      
      // Determine header period based on display mode
      let headerPeriod = '';
      if (hasMonthLabels) {
        // When showing months, group by year
        headerPeriod = segment.date.getFullYear().toString();
      } else if (hasWeekLabels) {
        // When showing weeks, group by month  
        headerPeriod = segment.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      } else {
        // When showing days, group by month
        headerPeriod = segment.date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      }
      
      // Track header changes
      if (headerPeriod !== currentHeaderPeriod) {
        if (currentHeaderPeriod !== '') {
          // Save previous header region
          headerLabels.push({
            start: headerStartX,
            end: segment.xPosition,
            label: currentHeaderPeriod
          });
        }
        currentHeaderPeriod = headerPeriod;
        headerStartX = segment.xPosition;
      }
      
      // Create main segment (only if it has a label)
      if (segment.label) {
        // For segments that start before the visible area, adjust their position
        // but still render them if they're at least partially visible
        const isVisible = segment.xPosition + segment.width > -50; // Allow some buffer for labels
        
        if (isVisible) {
          const mainSegment = document.createElement('div');
          mainSegment.className = 'vibegantt-timeline-segment vibegantt-timeline-label';
          
          // Calculate appropriate width for week and month labels
          let segmentWidth = segment.width;
          if (segment.isWeek && hasWeekLabels) {
            // Week labels should span 7 days
            segmentWidth = segment.width * 7;
          } else if (segment.isMonth && hasMonthLabels) {
            // Month labels - find the next month label to determine width
            const currentIndex = i;
            let nextMonthIndex = segments.findIndex((s, idx) => idx > currentIndex && s.isMonth);
            if (nextMonthIndex === -1) {
              // Last month - use remaining width
              nextMonthIndex = segments.length - 1;
            }
            if (nextMonthIndex > currentIndex) {
              segmentWidth = segments[nextMonthIndex].xPosition - segment.xPosition;
            }
          }
          
          // Don't clip segments at the edge - let them render naturally
          // The container overflow will handle actual clipping
          mainSegment.style.cssText = `
            position: absolute;
            left: ${segment.xPosition}px;
            width: ${segmentWidth}px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${hasMonthLabels ? '12px' : '11px'};
            color: ${segment.isMonth || segment.isWeek ? '#374151' : '#6b7280'};
            font-weight: ${segment.isMonth || segment.isWeek ? '500' : '400'};
            border-right: 1px solid #e5e7eb;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            ${(!hasMonthLabels && !hasWeekLabels && (segment.date.getDay() === 0 || segment.date.getDay() === 6)) ? 'background: #f9fafb;' : ''}
          `;
          
          mainSegment.textContent = segment.label;
          mainRow.appendChild(mainSegment);
        }
      }
    }
    
    // Add final header label
    if (segments.length > 0 && currentHeaderPeriod !== '') {
      const lastSegment = segments[segments.length - 1];
      headerLabels.push({
        start: headerStartX,
        end: lastSegment.xPosition + lastSegment.width,
        label: currentHeaderPeriod
      });
    }
    
    // Render header labels
    headerLabels.forEach(header => {
      // Only render headers that are at least partially visible
      if (header.end > 0) {
        const headerLabel = document.createElement('div');
        headerLabel.className = 'vibegantt-timeline-header-label';
        
        // Adjust position and width if header starts before viewport
        const adjustedStart = Math.max(0, header.start);
        const adjustedWidth = header.start < 0 
          ? header.end - adjustedStart  // Adjust width if cut off at start
          : header.end - header.start;
        
        headerLabel.style.cssText = `
          position: absolute;
          left: ${adjustedStart}px;
          width: ${adjustedWidth}px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: #374151;
          border-right: 1px solid #e5e7eb;
          overflow: hidden;
          text-overflow: ellipsis;
        `;
        
        // Only show label if there's enough width to display it
        if (adjustedWidth > 30) {
          headerLabel.textContent = header.label;
        }
        
        headerRow.appendChild(headerLabel);
      }
    });
    
    timelineInner.appendChild(headerRow);
    timelineInner.appendChild(mainRow);
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
      top: ${coordinates.yPosition + 10}px;
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
      overflow: visible;
      text-overflow: ellipsis;
      white-space: nowrap;
      transition: transform 0.1s ease;
      z-index: 10;
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
    
    // Add dependency creation connectors (2 attachment points: start and finish)
    const leftConnector = document.createElement('div');
    leftConnector.className = 'vibegantt-task-connector vibegantt-task-connector-left';
    leftConnector.dataset.taskId = task.id;
    leftConnector.dataset.connectorType = 'start';
    leftConnector.style.cssText = `
      position: absolute;
      left: -10px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #10b981;
      border: 2px solid white;
      cursor: crosshair;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 20;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;
    
    const rightConnector = document.createElement('div');
    rightConnector.className = 'vibegantt-task-connector vibegantt-task-connector-right';
    rightConnector.dataset.taskId = task.id;
    rightConnector.dataset.connectorType = 'finish';
    rightConnector.style.cssText = `
      position: absolute;
      right: -10px;
      top: 50%;
      transform: translateY(-50%);
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #ef4444;
      border: 2px solid white;
      cursor: crosshair;
      opacity: 0;
      transition: opacity 0.2s ease;
      z-index: 20;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;
    
    
    // Show connectors on task hover
    taskEl.addEventListener('mouseenter', () => {
      leftConnector.style.opacity = '1';
      rightConnector.style.opacity = '1';
    });
    
    taskEl.addEventListener('mouseleave', () => {
      if (!leftConnector.classList.contains('dragging')) {
        leftConnector.style.opacity = '0';
      }
      if (!rightConnector.classList.contains('dragging')) {
        rightConnector.style.opacity = '0';
      }
    });
    
    taskEl.appendChild(leftHandle);
    taskEl.appendChild(rightHandle);
    taskEl.appendChild(leftConnector);
    taskEl.appendChild(rightConnector);
    // taskEl.appendChild(linkHandle); // DISABLED
    
    // Hover effects should be handled by CSS or the event delegation manager
    
    this.taskContainer.appendChild(taskEl);
  }
  
  private renderTaskListItem(task: GanttTask, coordinates: CoordinateMapping['tasks'][0], container: HTMLElement): void {
    const taskItem = document.createElement('div');
    taskItem.className = 'vibegantt-task-list-item';
    taskItem.dataset.taskId = task.id;
    taskItem.style.cssText = `
      height: 48px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid #e5e7eb;
      cursor: pointer;
      transition: background-color 0.1s ease;
      position: relative;
      ${this.selectedTaskIds.has(task.id) ? 'background: #eff6ff;' : ''}
    `;
    
    // Hover and click events handled by event delegation manager
    
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
   * Render dependencies from coordinates using DOM elements
   */
  private renderDependenciesFromCoordinates(
    coordinateMapping: CoordinateMapping,
    dependencies: Record<string, TaskDependency>
  ): void {
    log.info('GanttRenderer: renderDependenciesFromCoordinates called with', {
      dependencyCount: Object.keys(dependencies).length,
      dependencyIds: Object.keys(dependencies)
    });
    
    // Create an SVG container within the DOM dependency container
    const svgContainer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgContainer.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: visible;
    `;
    svgContainer.setAttribute('class', 'vibegantt-dependencies-svg');
    
    // Clear and add the SVG container
    this.dependencyContainer.innerHTML = '';
    this.dependencyContainer.appendChild(svgContainer);
    
    // Render each dependency
    for (const dep of Object.values(dependencies)) {
      const sourceCoord = coordinateMapping.tasks.find(t => t.taskId === dep.predecessorId);
      const targetCoord = coordinateMapping.tasks.find(t => t.taskId === dep.successorId);
      
      if (!sourceCoord || !targetCoord) continue;
      
      // Calculate connection points based on dependency type
      let sourceX: number, sourceY: number, targetX: number, targetY: number;
      
      // Calculate attachment points based on dependency type
      switch (dep.type) {
        case 'start-to-start':
          // Start (left) of source to start (left) of target
          sourceX = sourceCoord.xPosition;
          sourceY = sourceCoord.yPosition + 10 + sourceCoord.height / 2;
          targetX = targetCoord.xPosition;
          targetY = targetCoord.yPosition + 10 + targetCoord.height / 2;
          break;
          
        case 'finish-to-finish':
          // Finish (right) of source to finish (right) of target
          sourceX = sourceCoord.xPosition + sourceCoord.width;
          sourceY = sourceCoord.yPosition + 10 + sourceCoord.height / 2;
          targetX = targetCoord.xPosition + targetCoord.width;
          targetY = targetCoord.yPosition + 10 + targetCoord.height / 2;
          break;
          
        case 'start-to-finish':
          // Start (left) of source to finish (right) of target
          sourceX = sourceCoord.xPosition;
          sourceY = sourceCoord.yPosition + 10 + sourceCoord.height / 2;
          targetX = targetCoord.xPosition + targetCoord.width;
          targetY = targetCoord.yPosition + 10 + targetCoord.height / 2;
          break;
          
        case 'finish-to-start':
        default:
          // Finish (right) of source to start (left) of target (default)
          sourceX = sourceCoord.xPosition + sourceCoord.width;
          sourceY = sourceCoord.yPosition + 10 + sourceCoord.height / 2;
          targetX = targetCoord.xPosition;
          targetY = targetCoord.yPosition + 10 + targetCoord.height / 2;
          break;
      }
      
      // Create DOM-based dependency line using positioned divs
      const depGroup = document.createElement('div');
      depGroup.className = 'vibegantt-dependency-group';
      depGroup.dataset.testid = `dependency-${dep.id}`;
      depGroup.dataset.dependencyId = dep.id;
      depGroup.dataset.predecessorId = dep.predecessorId;
      depGroup.dataset.successorId = dep.successorId;
      depGroup.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
      `;
      
      // Calculate the bounding box for the dependency line
      const isBackward = targetX < sourceX;
      const offset = 20;
      
      log.info('GanttRenderer: Dependency routing', {
        dep: dep.id,
        type: dep.type,
        sourceX,
        targetX,
        isBackward,
        sourceName: dep.predecessorId,
        targetName: dep.successorId
      });
      
      let minX: number, maxX: number, minY: number, maxY: number, width: number, height: number;
      
      if (isBackward) {
        // For backward dependencies, bounding box includes the wrap-around
        minX = targetX - offset;
        maxX = sourceX + offset;
        minY = Math.min(sourceY, targetY);
        maxY = Math.max(sourceY, targetY);
        width = maxX - minX || 2;
        height = maxY - minY || 2;
      } else {
        // For forward dependencies, simple bounding box
        minX = Math.min(sourceX, targetX);
        maxX = Math.max(sourceX, targetX);
        minY = Math.min(sourceY, targetY);
        maxY = Math.max(sourceY, targetY);
        width = maxX - minX || 2;
        height = maxY - minY || 2;
      }
      
      // Use the already calculated values
      const lines: HTMLElement[] = [];
      
      // Choose line color based on dependency type for visual clarity
      let lineColor = '#6b7280'; // Default gray
      switch (dep.type) {
        case 'start-to-start':
          lineColor = '#10b981'; // Green (matches start connectors)
          break;
        case 'finish-to-finish':
          lineColor = '#ef4444'; // Red (matches finish connectors)
          break;
        case 'start-to-finish':
          lineColor = '#8b5cf6'; // Purple (mixed type)
          break;
        case 'finish-to-start':
        default:
          lineColor = '#3b82f6'; // Blue (most common type)
          break;
      }
      
      // Reliable routing based on dependency type
      const gap = 20; // Gap for routing around
      
      // Determine routing strategy based on dependency type and positions
      const needsSpecialRouting = (
        dep.type === 'start-to-start' || 
        dep.type === 'finish-to-finish' ||
        (dep.type === 'finish-to-start' && targetX < sourceX) ||
        (dep.type === 'start-to-finish' && targetX < sourceX)
      );
      
      if (!needsSpecialRouting && targetX >= sourceX) {
        // SIMPLE FORWARD ROUTING: 3 segments (source → middle → target)
        const midX = sourceX + (targetX - sourceX) / 2;
        
        // Line 1: Horizontal from source to midpoint
        const line1 = document.createElement('div');
        line1.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
        line1.dataset.dependencyId = dep.id;
        line1.style.cssText = `
          position: absolute;
          left: ${sourceX}px;
          top: ${sourceY - 1}px;
          width: ${midX - sourceX}px;
          height: 2px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 2: Vertical connector
        const line2 = document.createElement('div');
        line2.className = 'vibegantt-dependency vibegantt-dependency-vertical';
        line2.dataset.dependencyId = dep.id;
        const verticalTop = Math.min(sourceY, targetY);
        const verticalHeight = Math.abs(targetY - sourceY) || 2;
        line2.style.cssText = `
          position: absolute;
          left: ${midX - 1}px;
          top: ${verticalTop - 1}px;
          width: 2px;
          height: ${verticalHeight + 2}px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 3: Horizontal to target
        const line3 = document.createElement('div');
        line3.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
        line3.dataset.dependencyId = dep.id;
        line3.style.cssText = `
          position: absolute;
          left: ${midX}px;
          top: ${targetY - 1}px;
          width: ${targetX - midX}px;
          height: 2px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        lines.push(line1, line2, line3);
        depGroup.appendChild(line1);
        depGroup.appendChild(line2);
        depGroup.appendChild(line3);
        
      } else {
        // SPECIAL ROUTING: For backward dependencies, SS, FF, and SF
        
        if (dep.type === 'start-to-start') {
          // START-TO-START: Route around left side with right angles
          const leftExtent = Math.min(sourceX, targetX) - gap;
          const bridgeY = (sourceY + targetY) / 2;
          
          // Line 1: Horizontal left from source start
          const line1 = document.createElement('div');
          line1.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
          line1.dataset.dependencyId = dep.id;
          line1.style.cssText = `
            position: absolute;
            left: ${leftExtent}px;
            top: ${sourceY - 1}px;
            width: ${sourceX - leftExtent}px;
            height: 2px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          // Line 2: Vertical connector
          const line2 = document.createElement('div');
          line2.className = 'vibegantt-dependency vibegantt-dependency-vertical';
          line2.dataset.dependencyId = dep.id;
          const verticalTop = Math.min(sourceY, targetY);
          const verticalHeight = Math.abs(targetY - sourceY) || 2;
          line2.style.cssText = `
            position: absolute;
            left: ${leftExtent - 1}px;
            top: ${verticalTop - 1}px;
            width: 2px;
            height: ${verticalHeight + 2}px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          // Line 3: Horizontal to target start
          const line3 = document.createElement('div');
          line3.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
          line3.dataset.dependencyId = dep.id;
          line3.style.cssText = `
            position: absolute;
            left: ${leftExtent}px;
            top: ${targetY - 1}px;
            width: ${targetX - leftExtent}px;
            height: 2px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          lines.push(line1, line2, line3);
          depGroup.appendChild(line1);
          depGroup.appendChild(line2);
          depGroup.appendChild(line3);
          
        } else if (dep.type === 'finish-to-finish') {
          // FINISH-TO-FINISH: Route around right side with right angles
          const rightExtent = Math.max(sourceX, targetX) + gap;
          const bridgeY = (sourceY + targetY) / 2;
          
          // Line 1: Horizontal right from source finish
          const line1 = document.createElement('div');
          line1.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
          line1.dataset.dependencyId = dep.id;
          line1.style.cssText = `
            position: absolute;
            left: ${sourceX}px;
            top: ${sourceY - 1}px;
            width: ${rightExtent - sourceX}px;
            height: 2px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          // Line 2: Vertical connector
          const line2 = document.createElement('div');
          line2.className = 'vibegantt-dependency vibegantt-dependency-vertical';
          line2.dataset.dependencyId = dep.id;
          const verticalTop = Math.min(sourceY, targetY);
          const verticalHeight = Math.abs(targetY - sourceY) || 2;
          line2.style.cssText = `
            position: absolute;
            left: ${rightExtent - 1}px;
            top: ${verticalTop - 1}px;
            width: 2px;
            height: ${verticalHeight + 2}px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          // Line 3: Horizontal to target finish
          const line3 = document.createElement('div');
          line3.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
          line3.dataset.dependencyId = dep.id;
          line3.style.cssText = `
            position: absolute;
            left: ${targetX}px;
            top: ${targetY - 1}px;
            width: ${rightExtent - targetX}px;
            height: 2px;
            background-color: ${lineColor};
            pointer-events: auto;
            cursor: pointer;
          `;
          
          lines.push(line1, line2, line3);
          depGroup.appendChild(line1);
          depGroup.appendChild(line2);
          depGroup.appendChild(line3);
          
        } else {
          // BACKWARD DEPENDENCY (FS or SF): 5 segments forming continuous flow
          // Pattern: source → right → down/up → across → down/up → target
          
          const sourceRightX = sourceX + gap;  // First turn point
          const targetLeftX = targetX - gap;   // Second turn point
          
          // Use the midpoint between the two task levels for the bridge
          const bridgeY = (sourceY + targetY) / 2;
        
        // Line 1: Horizontal right from source bar
        const line1 = document.createElement('div');
        line1.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
        line1.dataset.dependencyId = dep.id;
        line1.style.cssText = `
          position: absolute;
          left: ${sourceX}px;
          top: ${sourceY - 1}px;
          width: ${gap}px;
          height: 2px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 2: Vertical from source level to bridge level
        const line2 = document.createElement('div');
        line2.className = 'vibegantt-dependency vibegantt-dependency-vertical';
        line2.dataset.dependencyId = dep.id;
        const vertical2Top = Math.min(sourceY, bridgeY);
        const vertical2Height = Math.abs(bridgeY - sourceY);
        line2.style.cssText = `
          position: absolute;
          left: ${sourceRightX - 1}px;
          top: ${vertical2Top - 1}px;
          width: 2px;
          height: ${vertical2Height + 2}px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 3: Horizontal bridge across the gap at bridge level
        const line3 = document.createElement('div');
        line3.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
        line3.dataset.dependencyId = dep.id;
        line3.style.cssText = `
          position: absolute;
          left: ${targetLeftX}px;
          top: ${bridgeY - 1}px;
          width: ${sourceRightX - targetLeftX}px;
          height: 2px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 4: Vertical from bridge level to target level
        const line4 = document.createElement('div');
        line4.className = 'vibegantt-dependency vibegantt-dependency-vertical';
        line4.dataset.dependencyId = dep.id;
        const vertical4Top = Math.min(bridgeY, targetY);
        const vertical4Height = Math.abs(targetY - bridgeY);
        line4.style.cssText = `
          position: absolute;
          left: ${targetLeftX - 1}px;
          top: ${vertical4Top - 1}px;
          width: 2px;
          height: ${vertical4Height + 2}px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        // Line 5: Horizontal left to target bar
        const line5 = document.createElement('div');
        line5.className = 'vibegantt-dependency vibegantt-dependency-horizontal';
        line5.dataset.dependencyId = dep.id;
        line5.style.cssText = `
          position: absolute;
          left: ${targetLeftX}px;
          top: ${targetY - 1}px;
          width: ${gap}px;
          height: 2px;
          background-color: ${lineColor};
          pointer-events: auto;
          cursor: pointer;
        `;
        
        lines.push(line1, line2, line3, line4, line5);
        depGroup.appendChild(line1);
        depGroup.appendChild(line2);
        depGroup.appendChild(line3);
        depGroup.appendChild(line4);
        depGroup.appendChild(line5);
        }
      }
      
      // Calculate midpoint for controls positioning
      const midX = sourceX + (targetX - sourceX) / 2;
      
      // Create hit area overlay for easier interaction
      const hitArea = document.createElement('div');
      hitArea.className = 'vibegantt-dependency-hitarea';
      hitArea.dataset.dependencyId = dep.id;
      hitArea.style.cssText = `
        position: absolute;
        left: ${minX - 5}px;
        top: ${minY - 5}px;
        width: ${width + 10}px;
        height: ${height + 10}px;
        pointer-events: auto;
        cursor: pointer;
        z-index: 1;
      `;
      
      // Add hover effect - brighten the line color on hover
      const hoverColor = lineColor === '#6b7280' ? '#3b82f6' : lineColor; // Keep same color or use blue for gray
      const handleMouseEnter = () => {
        if (!depGroup.classList.contains('selected')) {
          lines.forEach(line => {
            line.style.backgroundColor = hoverColor;
            line.style.height = line.classList.contains('vibegantt-dependency-vertical') ? line.style.height : '3px';
            line.style.width = line.classList.contains('vibegantt-dependency-horizontal') ? line.style.width : '3px';
          });
        }
      };
      
      const handleMouseLeave = () => {
        if (!depGroup.classList.contains('selected')) {
          lines.forEach(line => {
            line.style.backgroundColor = lineColor;
            line.style.height = line.classList.contains('vibegantt-dependency-vertical') ? line.style.height : '2px';
            line.style.width = line.classList.contains('vibegantt-dependency-horizontal') ? line.style.width : '2px';
          });
        }
      };
      
      hitArea.addEventListener('mouseenter', handleMouseEnter);
      hitArea.addEventListener('mouseleave', handleMouseLeave);
      
      // Add elements to group
      depGroup.appendChild(hitArea);
      // Lines are already appended in the conditional blocks above
      
      // Apply selected state if this dependency is selected
      if (this.selectedDependencyId === dep.id) {
        depGroup.classList.add('selected');
        lines.forEach(line => {
          line.style.backgroundColor = hoverColor;
          line.style.height = line.classList.contains('vibegantt-dependency-vertical') ? line.style.height : '3px';
          line.style.width = line.classList.contains('vibegantt-dependency-horizontal') ? line.style.width : '3px';
        });
        // Show controls after a short delay to ensure DOM is ready
        const midX = sourceX + (targetX - sourceX) / 2;
        setTimeout(() => {
          this.showDependencyControls(depGroup, dep.id, midX, (sourceY + targetY) / 2);
        }, 10);
      }
      
      this.dependencyContainer.appendChild(depGroup);
    }
  }
  
  
  /**
   * Show dependency controls (delete button, handles)
   */
  private showDependencyControls(depGroup: HTMLElement, dependencyId: string, x: number, y: number): void {
    // Remove any existing controls
    this.dependencyContainer.querySelectorAll('.dependency-controls').forEach(el => el.remove());
    
    // Create controls container
    const controls = document.createElement('div');
    controls.className = 'dependency-controls';
    controls.style.cssText = `
      position: absolute;
      left: ${x - 20}px;
      top: ${y - 20}px;
      width: 40px;
      height: 40px;
      z-index: 1000;
      pointer-events: auto;
    `;
    
    // Create delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-button';
    deleteBtn.dataset.testid = `delete-btn-${dependencyId}`;
    deleteBtn.dataset.dependencyId = dependencyId;
    deleteBtn.style.cssText = `
      position: absolute;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: #ef4444;
      border: 2px solid white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      transition: transform 0.1s ease;
    `;
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
        <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
        <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
      </svg>
    `;
    
    // Add hover effect
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.transform = 'scale(1.1)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.transform = 'scale(1)';
    });
    
    // Click handler is in GanttEventDelegationManager - no need for duplicate here
    
    controls.appendChild(deleteBtn);
    
    // Append controls to container
    this.dependencyContainer.appendChild(controls);
    
    // Hide controls when clicking elsewhere
    setTimeout(() => {
      const hideControls = (e: MouseEvent) => {
        const target = e.target as Element;
        // Check if clicking on any dependency-related elements
        const isClickingDependency = target.closest('.dependency-controls') || 
                                   target.closest('.vibegantt-dependency-group') ||
                                   target.closest('.vibegantt-dependency') ||
                                   target.closest('.vibegantt-dependency-hitarea') ||
                                   target.closest('.delete-button');
                                   
        if (!isClickingDependency) {
          controls.remove();
          depGroup.classList.remove('selected');
          
          // Reset dependency line styles
          const lines = depGroup.querySelectorAll('.vibegantt-dependency');
          lines.forEach(line => {
            const el = line as HTMLElement;
            el.style.backgroundColor = '#6b7280';
            if (el.classList.contains('vibegantt-dependency-horizontal')) {
              el.style.height = '2px';
            } else if (el.classList.contains('vibegantt-dependency-vertical')) {
              el.style.width = '2px';
            }
          });
          
          // Clear selected dependency state
          this.selectedDependencyId = null;
          document.removeEventListener('click', hideControls, true);
        }
      };
      // Use capture phase to get the event before it bubbles
      document.addEventListener('click', hideControls, true);
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
   * Update scroll position
   */
  updateScroll(scrollX: number, scrollY: number): void {
    // Update the timeline scroll wrapper
    if (this.timelineScrollWrapper) {
      this.timelineScrollWrapper.scrollLeft = scrollX;
    }
    
    // Update the task scroll wrapper
    if (this.taskScrollWrapper) {
      this.taskScrollWrapper.scrollLeft = scrollX;
      this.taskScrollWrapper.scrollTop = scrollY;
    }
  }

  /**
   * Apply proper time scale zoom with date-based anchoring
   */
  applyTimeScaleZoom(dayWidth: number, anchorX: number, anchorDate?: Date): void {
    log.info(`Time scale zoom: dayWidth=${dayWidth}px, anchorX=${anchorX}`, anchorDate ? `, anchorDate=${anchorDate.toISOString()}` : '');
    
    // This method is now handled by coordinate recalculation in the store
    // No CSS transforms needed - content will be re-rendered with new scale
    log.info('Time scale zoom will be handled by coordinate recalculation and re-render');
    
    // TODO: Implement date-based viewport anchoring
    // Calculate which date should remain under the mouse cursor
    // and adjust scroll position after re-render
  }
  
  /**
   * Update dependency selection
   */
  updateDependencySelection(dependencyId: string | null): void {
    log.info('GanttRenderer: updateDependencySelection called with:', dependencyId);
    
    // Store the selection
    this.selectedDependencyId = dependencyId;
    
    // Update visual state if dependency exists in current DOM
    if (dependencyId) {
      log.info('GanttRenderer: Looking for dependency group with ID:', dependencyId);
      const depGroup = this.dependencyContainer.querySelector(`.vibegantt-dependency-group[data-dependency-id="${dependencyId}"]`) as HTMLElement;
      log.info('GanttRenderer: Found dependency group:', depGroup);
      
      if (depGroup) {
        log.info('GanttRenderer: Applying visual selection to dependency group');
        
        // Clear other selections
        this.dependencyContainer.querySelectorAll('.selected').forEach(el => {
          el.classList.remove('selected');
          const lines = el.querySelectorAll('.vibegantt-dependency');
          lines.forEach(line => {
            const lineEl = line as HTMLElement;
            lineEl.style.backgroundColor = '#6b7280';
            if (lineEl.classList.contains('vibegantt-dependency-horizontal')) {
              lineEl.style.height = '2px';
            } else if (lineEl.classList.contains('vibegantt-dependency-vertical')) {
              lineEl.style.width = '2px';
            }
          });
        });
        
        // Select this dependency
        depGroup.classList.add('selected');
        const lines = depGroup.querySelectorAll('.vibegantt-dependency');
        const hitArea = depGroup.querySelector('.vibegantt-dependency-hitarea') as HTMLElement;
        log.info('GanttRenderer: Found dependency lines:', lines.length);
        
        lines.forEach(line => {
          const lineEl = line as HTMLElement;
          log.info('GanttRenderer: Setting line to selected style');
          lineEl.style.backgroundColor = '#3b82f6';
          if (lineEl.classList.contains('vibegantt-dependency-horizontal')) {
            lineEl.style.height = '3px';
          } else if (lineEl.classList.contains('vibegantt-dependency-vertical')) {
            lineEl.style.width = '3px';
          }
          // Keep pointer events enabled so clicks don't fall through
          lineEl.style.pointerEvents = 'auto';
        });
        
        if (hitArea) {
          // Keep hit area active so clicks don't fall through to task container
          hitArea.style.pointerEvents = 'auto';
        }
        
        // Show controls
        const sourceCoord = this.currentCoordinates?.tasks.find(t => 
          t.taskId === depGroup.dataset.predecessorId
        );
        const targetCoord = this.currentCoordinates?.tasks.find(t => 
          t.taskId === depGroup.dataset.successorId
        );
        
        log.info('GanttRenderer: Source/target coords:', { sourceCoord, targetCoord });
        
        if (sourceCoord && targetCoord) {
          const midX = (sourceCoord.xPosition + sourceCoord.width + targetCoord.xPosition) / 2;
          const midY = (sourceCoord.yPosition + targetCoord.yPosition + sourceCoord.height) / 2;
          log.info('GanttRenderer: Showing dependency controls at:', { midX, midY });
          this.showDependencyControls(depGroup, dependencyId, midX, midY);
        }
      }
    } else {
      // Clear all dependency selections
      this.dependencyContainer.querySelectorAll('.selected').forEach(el => {
        el.classList.remove('selected');
        const lines = el.querySelectorAll('.vibegantt-dependency');
        const hitAreaEl = el.querySelector('.vibegantt-dependency-hitarea') as HTMLElement;
        
        lines.forEach(line => {
          const lineEl = line as HTMLElement;
          lineEl.style.backgroundColor = '#6b7280';
          if (lineEl.classList.contains('vibegantt-dependency-horizontal')) {
            lineEl.style.height = '2px';
          } else if (lineEl.classList.contains('vibegantt-dependency-vertical')) {
            lineEl.style.width = '2px';
          }
          // Keep pointer events enabled
          lineEl.style.pointerEvents = 'auto';
        });
        
        if (hitAreaEl) {
          hitAreaEl.style.pointerEvents = 'auto';
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
    
    log.info('GanttRenderer: Resized', { width, height });
    
    // Container will scroll to show full timeline
    // No need to update internal dimensions as they're coordinate-based
  }
  
  /**
   * Start dependency creation from a task
   */
  private startDependencyCreation(sourceTaskId: string, event: MouseEvent): void {
    log.info('GanttRenderer: Starting dependency creation from task', sourceTaskId);
    
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
          log.info('GanttRenderer: Creating dependency to task', targetTaskId);
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
   * Update timeline layout with new day width (for zoom operations)
   * Uses coordinate recalculation for consistency but optimized for performance
   */
  updateTimelineLayout(dayWidth: number): void {
    log.info(`GanttRenderer: Updating timeline layout with dayWidth=${dayWidth}px`);
    
    if (!this.currentCoordinates || !this.currentCoordinates.timeline || !this.currentCoordinates.tasks) {
      log.warn('GanttRenderer: Cannot update timeline layout - no coordinate data available yet');
      this.handleCoordinateUnavailable(dayWidth);
      return;
    }
    
    // Calculate new coordinates based on dayWidth ratio
    const oldDayWidth = this.currentCoordinates.timeline.dayWidth;
    const scaleRatio = dayWidth / oldDayWidth;
    
    // Update timeline segments with new width calculations  
    const segments = this.currentCoordinates.timeline.segments.map(segment => ({
      ...segment,
      xPosition: segment.xPosition * scaleRatio,
      width: segment.width * scaleRatio
    }));
    
    // Update tasks with new width calculations
    const tasks = this.currentCoordinates.tasks.map(task => ({
      ...task,
      xPosition: task.xPosition * scaleRatio,
      width: task.width * scaleRatio
    }));
    
    // Create updated coordinate mapping with proper timeline layout
    const updatedMapping = {
      ...this.currentCoordinates,
      timeline: {
        ...this.currentCoordinates.timeline,
        dayWidth: dayWidth,
        segments,
        totalWidth: this.currentCoordinates.timeline.totalWidth * scaleRatio
      },
      tasks,
      version: Date.now() // Force refresh
    };
    
    // Update internal coordinates first
    this.currentCoordinates = updatedMapping;
    
    log.info(`GanttRenderer: Coordinate-based timeline update: ${oldDayWidth}px/day → ${dayWidth}px/day (${scaleRatio.toFixed(3)}x)`);
    
    // Re-render everything with new coordinates for consistency
    this.renderFromCoordinates({
      coordinateMapping: updatedMapping,
      tasks: this.currentTasks,
      dependencies: this.currentDependencies
    });
  }
  
  // Removed problematic CSS transform methods that caused dependency line disconnections
  
  /**
   * Handle coordinate updates that require full re-rendering
   */
  private handleCoordinateUnavailable(dayWidth: number): void {
    log.warn('GanttRenderer: Cannot update timeline layout - no coordinate data available yet');
    log.warn('GanttRenderer: Available properties:', Object.keys(this.currentCoordinates || {}));
      
    // Store the dayWidth for when coordinates become available
    this.pendingDayWidth = dayWidth;
    log.info('GanttRenderer: Stored pending dayWidth for when coordinates become available:', dayWidth);
  }

  /**
   * Clean up and destroy
   */
  destroy(): void {
    log.info('GanttRenderer: Destroying');
    
    // Clean up event manager
    if (this.eventManager) {
      this.eventManager.destroy();
    }
    
    // Clear all content
    this.clearAllContent();
    
    // Clear container
    this.container.innerHTML = '';
    
    log.info('GanttRenderer: Destroyed');
  }
}