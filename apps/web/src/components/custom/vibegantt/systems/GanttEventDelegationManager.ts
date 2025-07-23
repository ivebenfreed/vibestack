import type { GanttEvent, GanttTask, TaskDependency } from '../types';
import { RENDER_CONFIG } from '../constants';

type EventHandler = (event: MouseEvent | KeyboardEvent | WheelEvent) => void;
type GanttEventCallback = (event: GanttEvent) => void;

interface DragState {
  type: 'task-move' | 'task-resize' | 'timeline-pan' | 'dependency-create' | null;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  element?: HTMLElement;
  data?: any;
}

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
  
  // Event listeners
  private listeners: Map<string, EventHandler> = new Map();
  
  constructor(container: HTMLElement, sendEvent: GanttEventCallback) {
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
    // Mouse events
    this.container.addEventListener('mousedown', this.handleMouseDown);
    this.container.addEventListener('mousemove', this.handleMouseMove);
    this.container.addEventListener('mouseup', this.handleMouseUp);
    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('dblclick', this.handleDoubleClick);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
    this.container.addEventListener('contextmenu', this.handleContextMenu);
    
    // Keyboard events (on document for global shortcuts)
    document.addEventListener('keydown', this.handleKeyDown);
    
    // Global mouse events for drag operations
    document.addEventListener('mousemove', this.handleGlobalMouseMove);
    document.addEventListener('mouseup', this.handleGlobalMouseUp);
  }
  
  private handleMouseDown(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
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
    
    // Check if clicking on dependency
    const dependencyElement = target.closest('.vibegantt-dependency') as SVGElement;
    if (dependencyElement) {
      const dependencyId = dependencyElement.dataset.dependencyId;
      if (dependencyId) {
        // Could implement dependency selection or deletion
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
    
    // Task selection
    const taskElement = target.closest('.vibegantt-task') as HTMLElement;
    if (taskElement) {
      const taskId = taskElement.dataset.taskId;
      if (taskId) {
        this.sendEvent({
          type: 'TASK_SELECT',
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
    // Zoom functionality with Ctrl/Cmd + scroll
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      
      const delta = event.deltaY > 0 ? -0.1 : 0.1;
      const currentZoom = 1; // Get from context
      const newZoom = Math.max(0.1, Math.min(10, currentZoom + delta));
      
      // Send zoom event
      // this.sendEvent({ type: 'ZOOM', level: newZoom });
    } else {
      // Regular scroll
      this.sendEvent({
        type: 'SCROLL',
        scrollX: this.container.scrollLeft,
        scrollY: this.container.scrollTop
      });
    }
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
    if (this.dragState.type !== 'task-move') return;
    
    this.sendEvent({
      type: 'TASK_DRAG_MOVE',
      x: event.clientX,
      y: event.clientY
    });
  }
  
  private endTaskDrag(event: MouseEvent): void {
    if (this.dragState.type !== 'task-move') return;
    
    this.sendEvent({
      type: 'TASK_DRAG_END'
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
    if (this.dragState.type !== 'task-resize') return;
    
    this.sendEvent({
      type: 'TASK_RESIZE_MOVE',
      x: event.clientX
    });
  }
  
  private endTaskResize(event: MouseEvent): void {
    if (this.dragState.type !== 'task-resize') return;
    
    this.sendEvent({
      type: 'TASK_RESIZE_END'
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
  
  // Cleanup
  destroy(): void {
    // Remove event listeners
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    this.container.removeEventListener('mousemove', this.handleMouseMove);
    this.container.removeEventListener('mouseup', this.handleMouseUp);
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('dblclick', this.handleDoubleClick);
    this.container.removeEventListener('wheel', this.handleWheel);
    this.container.removeEventListener('contextmenu', this.handleContextMenu);
    
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousemove', this.handleGlobalMouseMove);
    document.removeEventListener('mouseup', this.handleGlobalMouseUp);
    
    this.listeners.clear();
  }
}