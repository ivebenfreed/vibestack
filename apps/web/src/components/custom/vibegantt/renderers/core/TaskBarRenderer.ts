import { TimeScaleEngine } from '../engines/TimeScaleEngine';
import type { GanttTask, TaskLayout } from '../../types';
import { GANTT_COLORS, RENDER_CONFIG } from '../../constants';
import { format } from 'date-fns';

interface TaskRenderOptions {
  showProgress: boolean;
  isSelected: boolean;
  isCritical: boolean;
}

export class TaskBarRenderer {
  private container: HTMLElement;
  private timeScaleEngine: TimeScaleEngine;
  private taskElements: Map<string, HTMLElement> = new Map();
  private isDestroyed: boolean = false;
  
  constructor(container: HTMLElement, timeScaleEngine: TimeScaleEngine) {
    this.container = container;
    this.timeScaleEngine = timeScaleEngine;
  }
  
  createTask(task: GanttTask, layout: TaskLayout, options: TaskRenderOptions): void {
    if (this.isDestroyed) return;
    
    // Create task element
    const taskElement = this.createTaskElement(task, layout, options);
    
    // Add to container and map
    this.container.appendChild(taskElement);
    this.taskElements.set(task.id, taskElement);
  }
  
  updateTask(task: GanttTask, layout: TaskLayout, options: TaskRenderOptions): void {
    if (this.isDestroyed) return;
    
    const existingElement = this.taskElements.get(task.id);
    if (existingElement) {
      // Update existing element
      this.updateTaskElement(existingElement, task, layout, options);
    } else {
      // Create new element
      this.createTask(task, layout, options);
    }
  }
  
  deleteTask(taskId: string): void {
    const element = this.taskElements.get(taskId);
    if (element) {
      element.remove();
      this.taskElements.delete(taskId);
    }
  }
  
  updateTaskSelection(taskId: string, isSelected: boolean): void {
    const element = this.taskElements.get(taskId);
    if (element) {
      if (isSelected) {
        element.classList.add('selected');
        element.style.boxShadow = `0 0 0 2px ${GANTT_COLORS.selection.border}`;
      } else {
        element.classList.remove('selected');
        element.style.boxShadow = 'none';
      }
    }
  }
  
  // Disable/enable resize handles globally when dependency is selected
  setResizeHandlesEnabled(enabled: boolean): void {
    this.taskElements.forEach(element => {
      const leftHandle = element.querySelector('.vibegantt-resize-handle-left') as HTMLElement;
      const rightHandle = element.querySelector('.vibegantt-resize-handle-right') as HTMLElement;
      
      if (leftHandle && rightHandle) {
        if (enabled) {
          leftHandle.style.pointerEvents = 'auto';
          leftHandle.style.cursor = 'ew-resize';
          rightHandle.style.pointerEvents = 'auto';
          rightHandle.style.cursor = 'ew-resize';
        } else {
          leftHandle.style.pointerEvents = 'none';
          leftHandle.style.cursor = 'default';
          rightHandle.style.pointerEvents = 'none';
          rightHandle.style.cursor = 'default';
        }
      }
    });
  }
  
  private createTaskElement(task: GanttTask, layout: TaskLayout, options: TaskRenderOptions): HTMLElement {
    const element = document.createElement('div');
    element.className = 'vibegantt-task';
    element.dataset.taskId = task.id;
    
    // Apply base styles
    const backgroundColor = this.getTaskColor(task, options);
    element.style.cssText = `
      position: absolute;
      left: ${layout.x}px;
      top: ${layout.y}px;
      width: ${layout.width}px;
      height: ${layout.height}px;
      background-color: ${backgroundColor};
      border-radius: ${RENDER_CONFIG.TASK_BORDER_RADIUS}px;
      cursor: pointer;
      user-select: none;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      overflow: hidden;
      display: flex;
      align-items: center;
      padding: 0 8px;
      ${options.isSelected ? `box-shadow: 0 0 0 2px ${GANTT_COLORS.selection.border};` : ''}
    `;
    
    // Add hover effect
    element.addEventListener('mouseenter', () => {
      if (!options.isSelected) {
        element.style.transform = 'translateY(-1px)';
        element.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      }
    });
    
    element.addEventListener('mouseleave', () => {
      if (!options.isSelected) {
        element.style.transform = '';
        element.style.boxShadow = '';
      }
    });
    
    // Add progress bar if enabled
    if (options.showProgress && task.progress > 0) {
      const progressBar = document.createElement('div');
      progressBar.className = 'vibegantt-task-progress';
      progressBar.style.cssText = `
        position: absolute;
        left: 0;
        bottom: 0;
        height: ${RENDER_CONFIG.PROGRESS_BAR_HEIGHT}px;
        width: ${task.progress}%;
        background-color: ${this.getProgressColor(task, options)};
        transition: width 0.3s ease;
      `;
      element.appendChild(progressBar);
    }
    
    // Add task label
    const label = document.createElement('div');
    label.className = 'vibegantt-task-label';
    label.style.cssText = `
      position: relative;
      color: white;
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      z-index: 1;
    `;
    label.textContent = task.name;
    element.appendChild(label);
    
    // Add resize handles
    if (!this.isDestroyed) {
      this.addResizeHandles(element);
    }
    
    return element;
  }
  
  private updateTaskElement(
    element: HTMLElement,
    task: GanttTask,
    layout: TaskLayout,
    options: TaskRenderOptions
  ): void {
    // Update position and size
    element.style.left = `${layout.x}px`;
    element.style.top = `${layout.y}px`;
    element.style.width = `${layout.width}px`;
    element.style.height = `${layout.height}px`;
    
    // Update background color
    const backgroundColor = this.getTaskColor(task, options);
    element.style.backgroundColor = backgroundColor;
    
    // Update label
    const label = element.querySelector('.vibegantt-task-label') as HTMLElement;
    if (label) {
      label.textContent = task.name;
    }
    
    // Update progress bar
    const progressBar = element.querySelector('.vibegantt-task-progress') as HTMLElement;
    if (options.showProgress && task.progress > 0) {
      if (progressBar) {
        progressBar.style.width = `${task.progress}%`;
        progressBar.style.backgroundColor = this.getProgressColor(task, options);
      } else {
        // Create progress bar if it doesn't exist
        const newProgressBar = document.createElement('div');
        newProgressBar.className = 'vibegantt-task-progress';
        newProgressBar.style.cssText = `
          position: absolute;
          left: 0;
          bottom: 0;
          height: ${RENDER_CONFIG.PROGRESS_BAR_HEIGHT}px;
          width: ${task.progress}%;
          background-color: ${this.getProgressColor(task, options)};
          transition: width 0.3s ease;
        `;
        element.insertBefore(newProgressBar, element.firstChild);
      }
    } else if (progressBar) {
      progressBar.remove();
    }
  }
  
  private addResizeHandles(element: HTMLElement): void {
    // Left resize handle
    const leftHandle = document.createElement('div');
    leftHandle.className = 'vibegantt-resize-handle vibegantt-resize-handle-left';
    leftHandle.style.cssText = `
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: ${RENDER_CONFIG.RESIZE_HANDLE_WIDTH}px;
      cursor: ew-resize;
      background: transparent;
      z-index: 2;
    `;
    
    // Right resize handle
    const rightHandle = document.createElement('div');
    rightHandle.className = 'vibegantt-resize-handle vibegantt-resize-handle-right';
    rightHandle.style.cssText = `
      position: absolute;
      right: 0;
      top: 0;
      bottom: 0;
      width: ${RENDER_CONFIG.RESIZE_HANDLE_WIDTH}px;
      cursor: ew-resize;
      background: transparent;
      z-index: 2;
    `;
    
    // Show resize indicators on hover
    [leftHandle, rightHandle].forEach(handle => {
      handle.addEventListener('mouseenter', () => {
        handle.style.backgroundColor = 'rgba(255, 255, 255, 0.3)';
      });
      
      handle.addEventListener('mouseleave', () => {
        handle.style.backgroundColor = 'transparent';
      });
    });
    
    element.appendChild(leftHandle);
    element.appendChild(rightHandle);
  }
  
  private getTaskColor(task: GanttTask, options: TaskRenderOptions): string {
    if (task.color) {
      return task.color;
    }
    
    if (options.isCritical) {
      return GANTT_COLORS.priority.critical;
    }
    
    return GANTT_COLORS.priority[task.priority] || GANTT_COLORS.task.background;
  }
  
  private getProgressColor(task: GanttTask, options: TaskRenderOptions): string {
    if (options.isCritical) {
      return '#dc2626'; // Darker red for critical path
    }
    
    // Darken the task color for progress bar
    const baseColor = this.getTaskColor(task, options);
    return this.darkenColor(baseColor, 0.2);
  }
  
  private darkenColor(color: string, amount: number): string {
    // Simple color darkening function
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * amount));
    
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  }
  
  resize(width: number, height: number): void {
    // Container will handle overflow
    this.container.style.width = `${width}px`;
    this.container.style.minHeight = `${height}px`;
  }
  
  clear(): void {
    this.taskElements.forEach(element => element.remove());
    this.taskElements.clear();
  }
  
  destroy(): void {
    this.isDestroyed = true;
    this.clear();
  }
}