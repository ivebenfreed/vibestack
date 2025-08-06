import type { GanttEvent, TimeScale } from '../types';
import { RENDER_CONFIG } from '../constants';

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
    this.container.addEventListener('click', this.handleClick, { signal });
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
    
    // Check if clicking on dependency connection handle (for reassigning)
    const connectionHandle = target.closest('.connection-handle') as SVGElement;
    if (connectionHandle) {
      const dependencyId = connectionHandle.dataset.dependencyId;
      const handleType = connectionHandle.dataset.handleType as 'start' | 'end';
      if (dependencyId && handleType) {
        console.log('GanttEventDelegationManager: Dependency handle mousedown', { 
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
    const deleteButton = target.closest('.delete-button') as SVGElement;
    if (deleteButton) {
      const dependencyId = deleteButton.dataset.dependencyId;
      if (dependencyId) {
        console.log('GanttEventDelegationManager: Dependency delete button clicked', { dependencyId });
        this.sendEvent({
          type: 'DEPENDENCY_DELETE',
          dependencyId
        });
        event.stopPropagation();
        event.preventDefault();
      }
      return;
    }
    
    // Check if clicking on dependency line
    const dependencyElement = target.closest('.vibegantt-dependency') as SVGElement;
    if (dependencyElement) {
      const dependencyId = dependencyElement.dataset.dependencyId;
      if (dependencyId) {
        console.log('GanttEventDelegationManager: Dependency clicked', { dependencyId });
        this.sendEvent({
          type: 'DEPENDENCY_SELECT',
          dependencyId,
          multi: event.ctrlKey || event.metaKey
        });
        event.stopPropagation();
      }
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
    console.log('GanttEventDelegationManager: Click event', {
      target: target.tagName,
      className: target.className,
      closestTask: target.closest('.vibegantt-task')
    });
    
    // Task selection
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      console.log('GanttEventDelegationManager: Task element clicked', {
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
    }
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
    // Only handle zoom functionality with Ctrl/Cmd + scroll
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      
      // For now, just prevent default - zoom handling needs to be implemented
      // in the machine/store layer
      console.log('Zoom requested:', event.deltaY > 0 ? 'out' : 'in');
    }
    // Let native scroll handle panning
  }
  
  private handleKeyDown(event: KeyboardEvent): void {
    // Only handle if Gantt is focused
    if (!this.container.contains(document.activeElement)) return;
    
    const key = event.key;
    const modifiers: string[] = [];
    if (event.ctrlKey) modifiers.push('Ctrl');
    if (event.shiftKey) modifiers.push('Shift');
    if (event.altKey) modifiers.push('Alt');
    if (event.metaKey) modifiers.push('Meta');
    
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
    console.log('GanttEventDelegationManager: startTaskDrag', {
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
    
    console.log('GanttEventDelegationManager: updateTaskDrag', {
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
    
    console.log('GanttEventDelegationManager: endTaskDrag', {
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
  
  // Dependency drag handlers
  private startDependencyDrag(dependencyId: string, handleType: 'start' | 'end', event: MouseEvent): void {
    console.log('GanttEventDelegationManager: startDependencyDrag', {
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
        console.log('GanttEventDelegationManager: endDependencyDrag - reassigning to task', {
          dependencyId: this.dragState.data.dependencyId,
          handleType: this.dragState.data.handleType,
          newTaskId
        });
        
        // Need to get the original predecessor and successor IDs
        // This would typically come from the dependency data
        this.sendEvent({
          type: 'DEPENDENCY_REASSIGN',
          dependencyId: this.dragState.data.dependencyId,
          handleType: this.dragState.data.handleType,
          newTaskId,
          originalPredecessorId: '', // Would need to track this
          originalSuccessorId: '' // Would need to track this
        });
      }
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