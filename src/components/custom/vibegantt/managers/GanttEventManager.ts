// GanttEventManager - Follows VibeGrid's EventManager pattern
import { GanttMouseController } from '../controllers/GanttMouseController';

export interface GanttEventManagerOptions {
  container: HTMLElement;
  ganttCore$: any;
  ganttInteraction$: any;
}

export class GanttEventManager {
  private container: HTMLElement;
  private mouseController: GanttMouseController;
  private ganttCore$: any;
  private ganttInteraction$: any;

  constructor(options: GanttEventManagerOptions) {
    this.container = options.container;
    this.ganttCore$ = options.ganttCore$;
    this.ganttInteraction$ = options.ganttInteraction$;

    this.mouseController = new GanttMouseController(
      this.container,
      this.ganttCore$,
      this.ganttInteraction$
    );

    this.setupEventDelegation();
  }

  private setupEventDelegation() {
    // Single event listener with delegation (VibeGrid pattern)
    this.container.addEventListener('click', this.handleClick);
    this.container.addEventListener('mousedown', this.handleMouseDown);
    this.container.addEventListener('dblclick', this.handleDoubleClick);
    this.container.addEventListener('mouseenter', this.handleMouseEnter, true);
    this.container.addEventListener('mouseleave', this.handleMouseLeave, true);
    this.container.addEventListener('wheel', this.handleWheel, { passive: false });
  }

  private handleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Task click
    const taskBar = target.closest('.vibegantt-task-bar');
    if (taskBar) {
      const taskId = this.getTaskIdFromElement(taskBar as HTMLElement);
      if (taskId) {
        this.mouseController.handleTaskClick(taskId, event);
        return;
      }
    }

    // Dependency click
    const dependencyLine = target.closest('.vibegantt-dependency-line');
    if (dependencyLine) {
      const dependencyId = this.getDependencyIdFromElement(dependencyLine as HTMLElement);
      if (dependencyId) {
        this.mouseController.handleDependencyClick(dependencyId, event);
        return;
      }
    }

    // Timeline click (clear selection)
    if (target.closest('.vibegantt-timeline')) {
      this.mouseController.handleTimelineClick(event);
    }
  };

  private handleMouseDown = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Task drag start
    const taskBar = target.closest('.vibegantt-task-bar');
    if (taskBar) {
      const taskId = this.getTaskIdFromElement(taskBar as HTMLElement);
      if (taskId) {
        this.mouseController.handleTaskMouseDown(taskId, event);
        return;
      }
    }
  };

  private handleDoubleClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Task double click (edit)
    const taskBar = target.closest('.vibegantt-task-bar');
    if (taskBar) {
      const taskId = this.getTaskIdFromElement(taskBar as HTMLElement);
      if (taskId) {
        this.mouseController.handleTaskDoubleClick(taskId, event);
        return;
      }
    }
  };

  private handleMouseEnter = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Task hover
    if (target.classList.contains('vibegantt-task-bar')) {
      const taskId = this.getTaskIdFromElement(target);
      if (taskId) {
        this.mouseController.handleTaskMouseEnter(taskId);
      }
    }

    // Dependency hover
    if (target.classList.contains('vibegantt-dependency-line')) {
      const dependencyId = this.getDependencyIdFromElement(target);
      if (dependencyId) {
        this.mouseController.handleDependencyMouseEnter(dependencyId);
      }
    }
  };

  private handleMouseLeave = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Task hover end
    if (target.classList.contains('vibegantt-task-bar')) {
      this.mouseController.handleTaskMouseLeave();
    }

    // Dependency hover end
    if (target.classList.contains('vibegantt-dependency-line')) {
      this.mouseController.handleDependencyMouseLeave();
    }
  };

  private handleWheel = (event: WheelEvent) => {
    this.mouseController.handleWheel(event);
  };

  // Utility functions to extract IDs from DOM elements
  private getTaskIdFromElement(element: HTMLElement): string | null {
    // Use data attribute for reliable ID extraction
    return element.getAttribute('data-task-id') ||
           element.closest('[data-task-id]')?.getAttribute('data-task-id') ||
           null;
  }

  private getDependencyIdFromElement(element: HTMLElement): string | null {
    // Use data attribute for reliable ID extraction
    return element.getAttribute('data-dependency-id') ||
           element.closest('[data-dependency-id]')?.getAttribute('data-dependency-id') ||
           null;
  }

  // Cleanup
  destroy() {
    this.container.removeEventListener('click', this.handleClick);
    this.container.removeEventListener('mousedown', this.handleMouseDown);
    this.container.removeEventListener('dblclick', this.handleDoubleClick);
    this.container.removeEventListener('mouseenter', this.handleMouseEnter, true);
    this.container.removeEventListener('mouseleave', this.handleMouseLeave, true);
    this.container.removeEventListener('wheel', this.handleWheel);

    this.mouseController.destroy();
  }
}