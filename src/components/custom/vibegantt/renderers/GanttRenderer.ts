// GanttRenderer - Follows VibeGrid's SimplePassiveRenderer pattern
import { observe } from '@legendapp/state';
import { GanttEventManager } from '../managers/GanttEventManager';
import { createGanttInteraction$ } from '../stores/gantt-interaction';

export interface GanttRendererOptions {
  container: HTMLElement;
  ganttCore$: any;
  enableDragAndDrop?: boolean;
  enableDependencies?: boolean;
  enableZoom?: boolean;
  onTaskUpdate?: (taskId: string, updates: any) => void;
  onTaskCreate?: (task: any) => void;
  onTaskDelete?: (taskId: string) => void;
  onDependencyCreate?: (dependency: any) => void;
  onDependencyDelete?: (dependencyId: string) => void;
}

export class GanttRenderer {
  private container: HTMLElement;
  private ganttCore$: any;
  private ganttInteraction$: any;
  private eventManager: GanttEventManager | null = null;
  private options: GanttRendererOptions;
  private disposers: (() => void)[] = [];

  constructor(options: GanttRendererOptions) {
    this.container = options.container;
    this.ganttCore$ = options.ganttCore$;
    this.options = options;

    // Create interaction state (like VibeGrid's tableInteraction$)
    this.ganttInteraction$ = createGanttInteraction$(this.ganttCore$);

    this.initialize();
  }

  private initialize() {
    // Set up event management
    this.eventManager = new GanttEventManager({
      container: this.container,
      ganttCore$: this.ganttCore$,
      ganttInteraction$: this.ganttInteraction$
    });

    // Set up reactive rendering (observe observable changes)
    this.setupReactiveRendering();

    // Set up event callbacks
    this.setupEventCallbacks();
  }

  private setupReactiveRendering() {
    // Reactive rendering when state changes (VibeGrid pattern)
    const renderDisposer = observe(() => {
      // Re-render when core data changes
      const tasks = this.ganttCore$.tasks.get();
      const dependencies = this.ganttCore$.dependencies.get();
      const taskPositions = this.ganttCore$.taskPositions.get();
      const dependencyPaths = this.ganttCore$.dependencyPaths.get();
      const viewState = this.ganttCore$.viewState.get();

      // Trigger re-render
      this.render();
    });

    this.disposers.push(renderDisposer);

    // Reactive selection updates
    const selectionDisposer = observe(() => {
      const selectedTaskId = this.ganttInteraction$.selectedTaskId.get();
      const selectedDependencyId = this.ganttInteraction$.selectedDependencyId.get();

      this.updateSelectionVisuals();
    });

    this.disposers.push(selectionDisposer);
  }

  private setupEventCallbacks() {
    // Connect interaction events to prop callbacks
    if (this.options.onTaskUpdate) {
      const taskUpdateDisposer = this.ganttInteraction$.selectedTaskId.onChange((taskId) => {
        if (taskId) {
          const task = this.ganttInteraction$.getSelectedTask();
          if (task) {
            this.options.onTaskUpdate?.(taskId, task);
          }
        }
      });
      this.disposers.push(taskUpdateDisposer);
    }

    // More event callbacks can be added here
  }

  private render() {
    // Trigger React re-render by updating a reactive value
    // In practice, this would be handled by the React component's useSelector hooks
    // This is just the infrastructure for the modular pattern
  }

  private updateSelectionVisuals() {
    // Update visual state of selected elements
    const selectedTaskId = this.ganttInteraction$.selectedTaskId.get();
    const selectedDependencyId = this.ganttInteraction$.selectedDependencyId.get();

    // Update task selection visuals
    this.container.querySelectorAll('.vibegantt-task-bar').forEach((element, index) => {
      const tasks = this.ganttCore$.tasks.get();
      const taskId = tasks[index]?.id;

      if (taskId === selectedTaskId) {
        element.classList.add('ring-2', 'ring-primary');
      } else {
        element.classList.remove('ring-2', 'ring-primary');
      }
    });

    // Update dependency selection visuals
    this.container.querySelectorAll('.vibegantt-dependency-line').forEach((element, index) => {
      const dependencies = this.ganttCore$.dependencies.get();
      const dependencyId = dependencies[index]?.id;

      if (dependencyId === selectedDependencyId) {
        element.setAttribute('stroke-width', '3');
        element.setAttribute('stroke', 'oklch(var(--primary))');
      } else {
        element.setAttribute('stroke-width', '2');
        element.setAttribute('stroke', 'oklch(var(--muted-foreground))');
      }
    });
  }

  // Public API (like VibeGrid's renderer API)
  public getGanttInteraction$() {
    return this.ganttInteraction$;
  }

  public selectTask(taskId: string, isMulti: boolean = false) {
    this.ganttInteraction$.selectTask(taskId, isMulti);
  }

  public selectDependency(dependencyId: string, isMulti: boolean = false) {
    this.ganttInteraction$.selectDependency(dependencyId, isMulti);
  }

  public clearSelection() {
    this.ganttInteraction$.clearSelection();
  }

  // Cleanup
  destroy() {
    if (this.eventManager) {
      this.eventManager.destroy();
      this.eventManager = null;
    }

    // Dispose of all reactive subscriptions
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
  }
}