// GanttMouseController - Follows VibeGrid's MouseController pattern
import { calculateDateFromPosition, snapToTimeScale } from '../utils/calculations';

export class GanttMouseController {
  private container: HTMLElement;
  private ganttCore$: any;
  private ganttInteraction$: any;

  constructor(
    container: HTMLElement,
    ganttCore$: any,
    ganttInteraction$: any
  ) {
    this.container = container;
    this.ganttCore$ = ganttCore$;
    this.ganttInteraction$ = ganttInteraction$;
  }

  // Task interactions
  handleTaskClick = (taskId: string, event: MouseEvent) => {
    event.stopPropagation();
    const isMulti = event.ctrlKey || event.metaKey;
    this.ganttInteraction$.selectTask(taskId, isMulti);
  };

  handleTaskDoubleClick = (taskId: string, event: MouseEvent) => {
    event.stopPropagation();
    this.ganttInteraction$.startEdit(taskId, 'title');
  };

  handleTaskMouseDown = (taskId: string, event: MouseEvent) => {
    event.preventDefault();
    this.ganttInteraction$.startDrag(taskId, event.clientX, event.clientY);

    // Set up global mouse events for dragging (like VibeGrid)
    const handleMouseMove = (e: MouseEvent) => {
      this.ganttInteraction$.updateDrag(e.clientX, e.clientY);
    };

    const handleMouseUp = () => {
      this.ganttInteraction$.endDrag();
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Dependency interactions
  handleDependencyClick = (dependencyId: string, event: MouseEvent) => {
    event.stopPropagation();
    const isMulti = event.ctrlKey || event.metaKey;
    this.ganttInteraction$.selectDependency(dependencyId, isMulti);
  };

  // Timeline interactions
  handleTimelineClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

    // Check if click is on task or dependency
    if (target.closest('.vibegantt-task-bar')) {
      return; // Let task handler handle it
    }

    if (target.closest('.vibegantt-dependency-line')) {
      return; // Let dependency handler handle it
    }

    // Clear selection if clicking on empty timeline
    this.ganttInteraction$.clearSelection();
  };

  // Hover interactions
  handleTaskMouseEnter = (taskId: string) => {
    this.ganttInteraction$.setHover('task', taskId);
  };

  handleTaskMouseLeave = () => {
    this.ganttInteraction$.setHover('task', undefined);
  };

  handleDependencyMouseEnter = (dependencyId: string) => {
    this.ganttInteraction$.setHover('dependency', dependencyId);
  };

  handleDependencyMouseLeave = () => {
    this.ganttInteraction$.setHover('dependency', undefined);
  };

  // Zoom interactions
  handleWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();

      const zoomDirection = event.deltaY > 0 ? 'out' : 'in';
      const currentZoom = this.ganttCore$.viewState.zoomLevel.get();
      const factor = zoomDirection === 'in' ? 1.1 : 0.9;

      this.ganttCore$.operations.setZoom(currentZoom * factor);
    }
  };

  // Cleanup
  destroy() {
    // Remove any global event listeners if needed
  }
}