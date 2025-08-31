import type { GanttEvent, TimeScale } from '../types';
import { RENDER_CONFIG } from '../constants';
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/vibegantt/systems/GanttEventDelegationManager.ts');

type EventHandler = (event: MouseEvent | KeyboardEvent | WheelEvent) => void;
type GanttEventCallback = (event: GanttEvent) => void;

interface DragState {
  type: 'task-move' | 'task-resize' | 'timeline-pan' | 'dependency-create' | 'dependency-drag' | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  element?: HTMLElement;
  data?: any;
}

/**
 * Event Delegation Manager with Proper Isolation
 * 
 * Following VibeGridDex pattern:
 * - Pure event transformation without state manipulation
 * - Type-safe event emission
 * - Clean separation of concerns
 */
export class GanttEventDelegationManager {
  private container: HTMLElement;
  private sendEvent: GanttEventCallback;
  private dragState: DragState = {
    type: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  };
  
  // Abort controller for cleanup
  private abortController = new AbortController();
  
  constructor(container: HTMLElement, sendEvent: GanttEventCallback, zoomLevel?: TimeScale, zoomFactor?: number) {
    this.container = container;
    this.sendEvent = sendEvent;
    
    // Bind event handlers
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleClick = this.handleClick.bind(this);
    this.handleDoubleClick = this.handleDoubleClick.bind(this);
    this.handleWheel = this.handleWheel.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleContextMenu = this.handleContextMenu.bind(this);
    
    // Initialize event listeners
    this.attachEventListeners();
  }
  
  private attachEventListeners(): void {
    const signal = this.abortController.signal;
    
    // Mouse events with proper cleanup support
    this.container.addEventListener('mousedown', this.handleMouseDown, { signal });
    this.container.addEventListener('mousemove', this.handleMouseMove, { signal });
    this.container.addEventListener('mouseup', this.handleMouseUp, { signal });
    this.container.addEventListener('click', this.handleClick, { signal, capture: true }); // Use capture to handle before bubbling
    this.container.addEventListener('dblclick', this.handleDoubleClick, { signal });
    this.container.addEventListener('wheel', this.handleWheel, { passive: false, signal });
    this.container.addEventListener('contextmenu', this.handleContextMenu, { signal });
    
    // Keyboard events (on document for global shortcuts)
    document.addEventListener('keydown', this.handleKeyDown, { signal });
    
    // Global mouse events for drag operations
    document.addEventListener('mousemove', this.handleGlobalMouseMove, { signal });
    document.addEventListener('mouseup', this.handleGlobalMouseUp, { signal });
  }
  
  private handleMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    log.info('GanttEventDelegationManager: mousedown', {
      target: target.tagName,
      className: target.className,
      closest: {
        deleteButton: !!target.closest('.delete-button'),
        dependency: !!target.closest('.vibegantt-dependency'),
        controls: !!target.closest('.dependency-controls')
      }
    });
    
    // Check if clicking on task connector (for creating new dependencies)
    const taskConnector = target.closest('.vibegantt-task-connector') as HTMLElement;
    if (taskConnector) {
      const taskId = taskConnector.dataset.taskId;
      const connectorType = taskConnector.dataset.connectorType as 'start' | 'finish';
      if (taskId && connectorType) {
        log.info('GanttEventDelegationManager: Task connector mousedown', { taskId, connectorType });
        this.startDependencyCreation(taskId, connectorType, event);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    
    // Check if clicking on dependency connection handle (for reassigning)
    const connectionHandle = target.closest('.connection-handle') as HTMLElement;
    if (connectionHandle) {
      const dependencyId = connectionHandle.dataset.dependencyId;
      const handleType = connectionHandle.dataset.handleType as 'start' | 'end';
      if (dependencyId && handleType) {
        log.info('GanttEventDelegationManager: Dependency handle mousedown', { 
          dependencyId, 
          handleType 
        });
        this.startDependencyDrag(dependencyId, handleType, event);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    
    // Check if clicking on a task
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      if (!taskId) return;
      
      // Check if clicking on resize handle
      if (target.classList.contains('vibegantt-resize-handle')) {
        const handle = target.classList.contains('vibegantt-resize-handle-left') ? 'start' : 'end';
        this.startTaskResize(taskId, handle, event);
      } else {
        // Start task drag
        this.startTaskDrag(taskId, event);
      }
      return;
    }
    
    // Check if clicking on timeline
    if (target.closest('.vibegantt-timeline')) {
      // Start timeline pan with middle mouse or shift+click
      if (event.button === 1 || event.shiftKey) {
        this.startTimelinePan(event);
        event.preventDefault();
      }
      return;
    }
    
    // Check if clicking on dependency delete button
    const deleteButton = target.closest('.delete-button') as HTMLElement;
    if (deleteButton) {
      log.info('GanttEventDelegationManager: Delete button found in mousedown', {
        deleteButton,
        target,
        dataset: deleteButton.dataset
      });
      const dependencyId = deleteButton.dataset.dependencyId;
      if (dependencyId) {
        log.info('GanttEventDelegationManager: Dependency delete button clicked', { dependencyId });
        
        // Remove visual elements immediately for responsive UI
        const depGroup = document.querySelector(`.vibegantt-dependency-group[data-dependency-id="${dependencyId}"]`);
        const controls = deleteButton.closest('.dependency-controls');
        if (depGroup) depGroup.remove();
        if (controls) controls.remove();
        
        this.sendEvent({
          type: 'DEPENDENCY_DELETE',
          dependencyId
        });
        event.stopPropagation();
        event.preventDefault();
      } else {
        log.error('GanttEventDelegationManager: Delete button has no dependencyId!');
      }
      return;
    }
    
    // Check if clicking on dependency line or hit area
    const dependencyElement = target.closest('.vibegantt-dependency') as HTMLElement;
    const dependencyHitArea = target.closest('.vibegantt-dependency-hitarea') as HTMLElement;
    const dependencyGroup = target.closest('.vibegantt-dependency-group') as HTMLElement;
    
    // Get the actual dependency element from any of these
    const clickedDependency = dependencyElement || dependencyHitArea || (dependencyGroup ? dependencyGroup.querySelector('.vibegantt-dependency') : null);
    const dependencyId = dependencyElement?.dataset.dependencyId || 
                        dependencyHitArea?.dataset.dependencyId || 
                        dependencyGroup?.dataset.dependencyId;
    
    if (clickedDependency && dependencyId) {
      // Check if this dependency is already selected (has controls showing)
      const hasControls = document.querySelector('.dependency-controls') !== null;
      const isSelected = dependencyGroup?.classList.contains('selected');
      
      if (hasControls && isSelected) {
        log.info('GanttEventDelegationManager: Dependency already selected, ignoring click');
        event.stopPropagation();
        event.preventDefault();
        return; // Don't allow further interaction when controls are showing
      }
      
      log.info('GanttEventDelegationManager: Found dependency element', { 
        dependencyId, 
        element: clickedDependency,
        source: dependencyElement ? 'path' : (dependencyHitArea ? 'hitarea' : 'group')
      });
      log.info('GanttEventDelegationManager: Dependency clicked', { dependencyId });
      
      // Focus the container quietly to ensure keyboard events work
      this.container.focus({ preventScroll: true });
      
      this.sendEvent({
        type: 'DEPENDENCY_SELECT',
        dependencyId,
        multi: event.ctrlKey || event.metaKey
      });
      
      // Mark event as handled to prevent double processing
      (event as any)._ganttHandled = true;
      event.stopPropagation();
      event.stopImmediatePropagation(); // Stop any other handlers
      return;
    }
  }
  
  private handleMouseMove(event: MouseEvent): void {
    // Update current position
    if (this.dragState.type) {
      this.dragState.currentX = event.clientX;
      this.dragState.currentY = event.clientY;
      
      switch (this.dragState.type) {
        case 'task-move':
          this.updateTaskDrag(event);
          break;
        case 'task-resize':
          this.updateTaskResize(event);
          break;
        case 'timeline-pan':
          this.updateTimelinePan(event);
          break;
        case 'dependency-create':
          this.updateDependencyCreation(event);
          break;
        case 'dependency-drag':
          this.updateDependencyDrag(event);
          break;
      }
    }
  }
  
  private handleMouseUp(event: MouseEvent): void {
    if (this.dragState.type) {
      switch (this.dragState.type) {
        case 'task-move':
          this.endTaskDrag(event);
          break;
        case 'task-resize':
          this.endTaskResize(event);
          break;
        case 'timeline-pan':
          this.endTimelinePan(event);
          break;
        case 'dependency-create':
          this.endDependencyCreation(event);
          break;
        case 'dependency-drag':
          this.endDependencyDrag(event);
          break;
      }
      
      // Reset drag state
      this.dragState = {
        type: null,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
      };
    }
  }
  
  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Check if this event was already handled in mousedown
    if ((event as any)._ganttHandled) {
      log.info('GanttEventDelegationManager: Click already handled in mousedown, ignoring');
      return;
    }
    
    // If we're clicking on the dependencies container itself, check if it's from a child
    if (target.classList.contains('vibegantt-dependencies')) {
      // This is a bubbled event from a child element, ignore it
      log.info('GanttEventDelegationManager: Ignoring bubbled click on dependencies container');
      return;
    }
    
    log.info('GanttEventDelegationManager: Click event', {
      target: target.tagName,
      className: target.className,
      closestTask: target.closest('.vibegantt-task'),
      closestDependency: target.closest('.vibegantt-dependency'),
      closestDepGroup: target.closest('.vibegantt-dependency-group'),
      eventPhase: event.eventPhase, // 1=capture, 2=target, 3=bubble
      currentTarget: event.currentTarget === this.container ? 'container' : 'other'
    });
    
    // Task selection
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      log.info('GanttEventDelegationManager: Task element clicked', {
        taskId,
        element: taskElement
      });
      if (taskId) {
        this.sendEvent({
          type: 'SELECT_TASK',
          taskId,
          multi: event.ctrlKey || event.metaKey
        });
      }
      return; // Don't clear selection when clicking on tasks
    }
    
    // Check if clicking on a dependency or dependency UI element
    const dependencyElement = target.closest('.vibegantt-dependency') as HTMLElement;
    const dependencyHitarea = target.closest('.vibegantt-dependency-hitarea') as HTMLElement;
    const dependencyGroup = target.closest('.vibegantt-dependency-group') as HTMLElement;
    const deleteButton = target.closest('.delete-button') as HTMLElement;
    const connectionHandle = target.closest('.connection-handle') as HTMLElement;
    const dependencyControls = target.closest('.dependency-controls') as HTMLElement;
    const dependencySvg = target.closest('.vibegantt-dependencies') as HTMLElement;
    
    log.info('GanttEventDelegationManager: Dependency element checks', {
      dependencyElement: !!dependencyElement,
      dependencyHitarea: !!dependencyHitarea,
      dependencyGroup: !!dependencyGroup,
      deleteButton: !!deleteButton,
      connectionHandle: !!connectionHandle,
      dependencyControls: !!dependencyControls,
      shouldReturn: !!(dependencyElement || dependencyHitarea || dependencyGroup || deleteButton || connectionHandle || dependencyControls)
    });
    
    if (dependencyElement || dependencyHitarea || dependencyGroup || deleteButton || connectionHandle || dependencyControls) {
      log.info('GanttEventDelegationManager: Clicking on dependency element, not clearing selection');
      return; // Don't clear selection when clicking on dependency elements
    }
    
    // Don't clear selection if clicking within the dependencies container
    // unless it's a direct click on the container itself (not on child elements)
    if (dependencySvg && target !== dependencySvg) {
      return;
    }
    
    // Clear dependency selection when clicking on empty space
    log.info('GanttEventDelegationManager: Clicked empty space, clearing dependency selection');
    this.sendEvent({
      type: 'DEPENDENCY_SELECT',
      dependencyId: null,
      multi: false
    });
  }
  
  private handleDoubleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Task editing
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      if (taskId) {
        // Could trigger inline editing
      }
    }
  }
  
  private handleWheel(event: WheelEvent): void {
    log.info('🖱️ Wheel event detected:', {
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      deltaY: event.deltaY
    });
    
    // Only handle zoom functionality with Ctrl/Cmd + scroll
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      
      // Send zoom request to the machine
      const direction = event.deltaY > 0 ? 'out' : 'in';
      log.info('🔍 Zoom requested:', direction);
      
      // Get mouse position relative to the timeline for anchoring
      const rect = this.container.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      
      log.info('📤 Sending ZOOM_REQUEST event to machine...');
      this.sendEvent({
        type: 'ZOOM_REQUEST',
        direction,
        anchorX: mouseX
      });
      log.info('✅ ZOOM_REQUEST event sent');
    } else {
      log.info('⏭️ Wheel without Ctrl/Cmd - letting native scroll handle');
    }
    // Let native scroll handle panning
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    // Only handle if Gantt container or any of its children is focused
    if (!this.container.contains(document.activeElement) && document.activeElement !== this.container) return;
    
    const key = event.key;
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.altKey) modifiers.push('Alt');
    if (event.metaKey) modifiers.push('Meta');
    
    log.info('GanttEventDelegationManager: Keyboard event', { key, modifiers });
    
    this.sendEvent({
      type: 'KEYBOARD_SHORTCUT',
      key,
      modifiers
    });
    
    // Prevent default for handled shortcuts
    if (event.key === 'Delete' || (event.ctrlKey && ['z', 'y', 'a'].includes(event.key))) {
      event.preventDefault();
    }
  }
  
  private handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    
    const target = event.target as HTMLElement;
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      // Could show context menu for task operations
    }
  }
  
  // Task drag handlers
  private startTaskDrag(taskId: string, event: MouseEvent): void {
    log.info('GanttEventDelegationManager: startTaskDrag', {
      taskId,
      startX: event.clientX,
      startY: event.clientY
    });
    
    this.dragState = {
      type: 'task-move',
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      data: { taskId }
    };
    
    this.sendEvent({
      type: 'TASK_DRAG_START',
      taskId,
      x: event.clientX,
      y: event.clientY
    });
    
    event.preventDefault();
  }
  
  private updateTaskDrag(event: MouseEvent): void {
    if (this.dragState.type !== 'task-move' || !this.dragState.data?.taskId) return;
    
    const deltaX = event.clientX - this.dragState.startX;
    
    log.info('GanttEventDelegationManager: updateTaskDrag', {
      currentX: event.clientX,
      startX: this.dragState.startX,
      deltaX: deltaX
    });
    
    this.sendEvent({
      type: 'TASK_DRAG_MOVE',
      taskId: this.dragState.data.taskId,
      x: event.clientX,
      y: event.clientY,
      deltaX: deltaX
    });
  }
  
  private endTaskDrag(event: MouseEvent): void {
    if (this.dragState.type !== 'task-move' || !this.dragState.data?.taskId) return;
    
    const deltaX = event.clientX - this.dragState.startX;
    
    log.info('GanttEventDelegationManager: endTaskDrag', {
      endX: event.clientX,
      startX: this.dragState.startX,
      deltaX: deltaX,
      taskId: this.dragState.data.taskId
    });
    
    // Calculate new dates based on delta
    // This will be handled by the machine with proper date calculations
    this.sendEvent({
      type: 'TASK_DRAG_END',
      taskId: this.dragState.data.taskId,
      deltaX: deltaX
    });
  }
  
  // Task resize handlers
  private startTaskResize(taskId: string, handle: 'start' | 'end', event: MouseEvent): void {
    this.dragState = {
      type: 'task-resize',
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      data: { taskId, handle }
    };
    
    this.sendEvent({
      type: 'TASK_RESIZE_START',
      taskId,
      handle,
      x: event.clientX
    });
    
    event.preventDefault();
    event.stopPropagation();
  }
  
  private updateTaskResize(event: MouseEvent): void {
    if (this.dragState.type !== 'task-resize' || !this.dragState.data) return;
    
    const deltaX = event.clientX - this.dragState.startX;
    
    this.sendEvent({
      type: 'TASK_RESIZE_MOVE',
      taskId: this.dragState.data.taskId,
      handle: this.dragState.data.handle,
      x: event.clientX,
      deltaX: deltaX
    });
  }
  
  private endTaskResize(event: MouseEvent): void {
    if (this.dragState.type !== 'task-resize' || !this.dragState.data) return;
    
    const deltaX = event.clientX - this.dragState.startX;
    
    this.sendEvent({
      type: 'TASK_RESIZE_END',
      taskId: this.dragState.data.taskId,
      handle: this.dragState.data.handle,
      deltaX: deltaX
    });
  }
  
  // Timeline pan handlers
  private startTimelinePan(event: MouseEvent): void {
    this.dragState = {
      type: 'timeline-pan',
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      data: {
        startScrollX: this.container.scrollLeft,
        startScrollY: this.container.scrollTop
      }
    };
    
    this.container.style.cursor = 'grabbing';
    event.preventDefault();
  }
  
  private updateTimelinePan(event: MouseEvent): void {
    if (this.dragState.type !== 'timeline-pan') return;
    
    const deltaX = event.clientX - this.dragState.startX;
    const deltaY = event.clientY - this.dragState.startY;
    
    this.sendEvent({
      type: 'PAN',
      deltaX,
      deltaY
    });
  }
  
  private endTimelinePan(event: MouseEvent): void {
    if (this.dragState.type !== 'timeline-pan') return;
    
    this.container.style.cursor = '';
  }
  
  // Global mouse handlers for drag operations
  private handleGlobalMouseMove = (event: MouseEvent): void => {
    if (this.dragState.type && this.dragState.type !== 'timeline-pan') {
      this.handleMouseMove(event);
    }
  };
  
  private handleGlobalMouseUp = (event: MouseEvent): void => {
    if (this.dragState.type) {
      this.handleMouseUp(event);
    }
  };
  
  // Dependency creation handlers
  private startDependencyCreation(sourceTaskId: string, connectorType: 'start' | 'finish', event: MouseEvent): void {
    log.info('GanttEventDelegationManager: startDependencyCreation', {
      sourceTaskId,
      connectorType,
      startX: event.clientX,
      startY: event.clientY
    });
    
    this.dragState = {
      type: 'dependency-create',
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      data: { sourceTaskId, connectorType }
    };
    
    // Mark the connector as dragging
    const connector = event.target as HTMLElement;
    connector.classList.add('dragging');
    
    this.sendEvent({
      type: 'DEPENDENCY_CREATE_START',
      sourceTaskId
    });
    
    // Create visual feedback
    this.createDependencyDragLine(event, connectorType);
  }
  
  // Dependency drag handlers
  private startDependencyDrag(dependencyId: string, handleType: 'start' | 'end', event: MouseEvent): void {
    log.info('GanttEventDelegationManager: startDependencyDrag', {
      dependencyId,
      handleType,
      startX: event.clientX,
      startY: event.clientY
    });
    
    this.dragState = {
      type: 'dependency-drag',
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
      data: { dependencyId, handleType }
    };
    
    this.sendEvent({
      type: 'DEPENDENCY_DRAG_START',
      dependencyId,
      handleType,
      x: event.clientX,
      y: event.clientY
    });
  }
  
  private updateDependencyDrag(event: MouseEvent): void {
    if (this.dragState.type !== 'dependency-drag' || !this.dragState.data) return;
    
    // Visual feedback could be handled here
    // For now, just track the position
    this.dragState.currentX = event.clientX;
    this.dragState.currentY = event.clientY;
  }
  
  private endDependencyDrag(event: MouseEvent): void {
    if (this.dragState.type !== 'dependency-drag' || !this.dragState.data) return;
    
    // Check if we're over a task
    const taskElement = document.elementFromPoint(event.clientX, event.clientY)?.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const newTaskId = taskElement.dataset.taskId;
      if (newTaskId) {
        log.info('GanttEventDelegationManager: endDependencyDrag - reassigning to task', {
          dependencyId: this.dragState.data.dependencyId,
          handleType: this.dragState.data.handleType,
          newTaskId
        });
        
        // Send reassign event with all necessary data
        this.sendEvent({
          type: 'DEPENDENCY_REASSIGN',
          dependencyId: this.dragState.data.dependencyId,
          handleType: this.dragState.data.handleType === 'start' ? 'predecessor' : 'successor',
          newTaskId
        });
      }
    }
  }
  
  private updateDependencyCreation(event: MouseEvent): void {
    if (this.dragState.type !== 'dependency-create') return;
    
    // Update drag line position
    this.updateDependencyDragLine(event);
    
    // Highlight target task on hover
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    const targetTask = targetElement?.closest('.vibegantt-task') as HTMLElement;
    
    // Remove previous highlights
    this.container.querySelectorAll('.dependency-target-highlight').forEach(el => {
      el.classList.remove('dependency-target-highlight');
    });
    
    if (targetTask && targetTask.dataset.taskId !== this.dragState.data?.sourceTaskId) {
      targetTask.classList.add('dependency-target-highlight');
      targetTask.style.outline = '2px solid #3b82f6';
    }
  }
  
  private endDependencyCreation(event: MouseEvent): void {
    if (this.dragState.type !== 'dependency-create' || !this.dragState.data) return;
    
    // Find what we're dropping on
    const targetElement = document.elementFromPoint(event.clientX, event.clientY);
    
    // Check if dropping on a task connector (for specific connection type)
    const targetConnector = targetElement?.closest('.vibegantt-task-connector') as HTMLElement;
    let targetTask: HTMLElement | null = null;
    let targetConnectorType: 'start' | 'finish' = 'start';
    
    if (targetConnector) {
      targetTask = targetConnector.closest('.vibegantt-task') as HTMLElement;
      targetConnectorType = targetConnector.dataset.connectorType as 'start' | 'finish' || 'start';
    } else {
      // If not on a connector, check if on a task (default to start)
      targetTask = targetElement?.closest('.vibegantt-task') as HTMLElement;
    }
    
    if (targetTask) {
      const targetTaskId = targetTask.dataset.taskId;
      const sourceTaskId = this.dragState.data.sourceTaskId;
      const sourceConnectorType = this.dragState.data.connectorType;
      
      if (targetTaskId && targetTaskId !== sourceTaskId) {
        // Determine dependency type based on connectors
        let dependencyType: 'finish-to-start' | 'start-to-start' | 'finish-to-finish' | 'start-to-finish';
        
        if (sourceConnectorType === 'finish' && targetConnectorType === 'start') {
          dependencyType = 'finish-to-start';
        } else if (sourceConnectorType === 'start' && targetConnectorType === 'start') {
          dependencyType = 'start-to-start';
        } else if (sourceConnectorType === 'finish' && targetConnectorType === 'finish') {
          dependencyType = 'finish-to-finish';
        } else {
          dependencyType = 'start-to-finish';
        }
        
        log.info('GanttEventDelegationManager: Creating dependency', {
          sourceTaskId,
          targetTaskId,
          dependencyType
        });
        
        // Pass dependency type in the event
        this.sendEvent({
          type: 'DEPENDENCY_CREATE_END',
          targetTaskId,
          dependencyType
        });
      }
    }
    
    // Clean up
    this.removeDependencyDragLine();
    this.container.querySelectorAll('.dependency-target-highlight').forEach(el => {
      el.classList.remove('dependency-target-highlight');
      (el as HTMLElement).style.outline = '';
    });
    
    // Remove dragging class from connector
    const connector = this.container.querySelector('.vibegantt-task-connector.dragging');
    if (connector) {
      connector.classList.remove('dragging');
    }
  }
  
  // Create visual feedback line for dependency creation
  private createDependencyDragLine(event: MouseEvent, connectorType: 'start' | 'finish'): void {
    // Create a DOM-based drag line with dotted style
    const dragLine = document.createElement('div');
    dragLine.className = 'vibegantt-dependency-drag-line';
    dragLine.style.cssText = `
      position: absolute;
      height: 3px;
      background-image: repeating-linear-gradient(
        to right,
        #3b82f6 0,
        #3b82f6 6px,
        transparent 6px,
        transparent 12px
      );
      transform-origin: left center;
      pointer-events: none;
      z-index: 100;
    `;
    
    // Store reference
    (this.dragState as any).dragLine = dragLine;
    
    // Add to task container for proper positioning
    const taskContainer = this.container.querySelector('.vibegantt-tasks');
    if (taskContainer) {
      taskContainer.appendChild(dragLine);
    }
    
    // Calculate correct starting position based on connector
    const connector = event.target as HTMLElement;
    const task = connector.closest('.vibegantt-task') as HTMLElement;
    if (task && taskContainer) {
      const taskRect = task.getBoundingClientRect();
      const containerRect = taskContainer.getBoundingClientRect();
      
      // Calculate position relative to task container
      let startX = taskRect.left - containerRect.left + taskContainer.scrollLeft;
      const startY = taskRect.top - containerRect.top + taskRect.height / 2 + taskContainer.scrollTop;
      
      // Adjust X based on connector type
      if (connectorType === 'finish') {
        startX += taskRect.width;
      }
      
      // Store the calculated position
      (this.dragState as any).lineStartX = startX;
      (this.dragState as any).lineStartY = startY;
    }
    
    // Initial position
    this.updateDependencyDragLine(event);
  }
  
  private updateDependencyDragLine(event: MouseEvent): void {
    const dragLine = (this.dragState as any)?.dragLine as HTMLElement;
    if (!dragLine) return;
    
    const taskContainer = this.container.querySelector('.vibegantt-tasks') as HTMLElement;
    if (!taskContainer) return;
    
    const containerRect = taskContainer.getBoundingClientRect();
    const startX = (this.dragState as any).lineStartX || 0;
    const startY = (this.dragState as any).lineStartY || 0;
    const currentX = event.clientX - containerRect.left + taskContainer.scrollLeft;
    const currentY = event.clientY - containerRect.top + taskContainer.scrollTop;
    
    // Calculate angle and length
    const deltaX = currentX - startX;
    const deltaY = currentY - startY;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
    
    dragLine.style.left = `${startX}px`;
    dragLine.style.top = `${startY}px`;
    dragLine.style.width = `${length}px`;
    dragLine.style.transform = `rotate(${angle}deg)`;
  }
  
  private removeDependencyDragLine(): void {
    const dragLine = (this.dragState as any)?.dragLine as HTMLElement;
    if (dragLine) {
      dragLine.remove();
    }
  }
  
  /**
   * Clean up all event listeners
   */
  destroy(): void {
    // Abort all event listeners at once
    this.abortController.abort();
  }
}