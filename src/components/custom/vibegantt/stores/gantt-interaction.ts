import { observable, batch } from '@legendapp/state';
import type { GanttTask, TaskDependency } from '../types';

// Gantt interaction state - follows VibeGrid's tableInteraction$ pattern
export function createGanttInteraction$(ganttCore$: any) {
  const ganttInteraction$ = observable({
    // Selection state
    selectedTaskId: observable<string | undefined>(undefined),
    selectedDependencyId: observable<string | undefined>(undefined),
    hoveredTaskId: observable<string | undefined>(undefined),
    hoveredDependencyId: observable<string | undefined>(undefined),

    // Drag state
    isDragging: observable(false),
    dragTaskId: observable<string | undefined>(undefined),
    dragStartX: observable(0),
    dragStartY: observable(0),
    dragCurrentX: observable(0),
    dragCurrentY: observable(0),

    // Edit state
    editingTaskId: observable<string | undefined>(undefined),
    editingField: observable<string | undefined>(undefined),

    // Multi-selection state
    selectedTaskIds: observable<Set<string>>(new Set()),
    selectedDependencyIds: observable<Set<string>>(new Set()),

    // Operations (reactive mutations like VibeGrid)
    selectTask: (taskId: string | undefined, isMulti: boolean = false) => {
      batch(() => {
        if (isMulti && taskId) {
          const current = ganttInteraction$.selectedTaskIds.get();
          const newSelection = new Set(current);
          if (newSelection.has(taskId)) {
            newSelection.delete(taskId);
          } else {
            newSelection.add(taskId);
          }
          ganttInteraction$.selectedTaskIds.set(newSelection);
        } else {
          ganttInteraction$.selectedTaskId.set(taskId);
          ganttInteraction$.selectedTaskIds.set(taskId ? new Set([taskId]) : new Set());
        }

        // Clear other selections
        ganttInteraction$.selectedDependencyId.set(undefined);
        ganttInteraction$.selectedDependencyIds.set(new Set());
      });
    },

    selectDependency: (dependencyId: string | undefined, isMulti: boolean = false) => {
      batch(() => {
        if (isMulti && dependencyId) {
          const current = ganttInteraction$.selectedDependencyIds.get();
          const newSelection = new Set(current);
          if (newSelection.has(dependencyId)) {
            newSelection.delete(dependencyId);
          } else {
            newSelection.add(dependencyId);
          }
          ganttInteraction$.selectedDependencyIds.set(newSelection);
        } else {
          ganttInteraction$.selectedDependencyId.set(dependencyId);
          ganttInteraction$.selectedDependencyIds.set(dependencyId ? new Set([dependencyId]) : new Set());
        }

        // Clear other selections
        ganttInteraction$.selectedTaskId.set(undefined);
        ganttInteraction$.selectedTaskIds.set(new Set());
      });
    },

    clearSelection: () => {
      batch(() => {
        ganttInteraction$.selectedTaskId.set(undefined);
        ganttInteraction$.selectedDependencyId.set(undefined);
        ganttInteraction$.selectedTaskIds.set(new Set());
        ganttInteraction$.selectedDependencyIds.set(new Set());
        ganttInteraction$.hoveredTaskId.set(undefined);
        ganttInteraction$.hoveredDependencyId.set(undefined);
      });
    },

    setHover: (type: 'task' | 'dependency', id: string | undefined) => {
      if (type === 'task') {
        ganttInteraction$.hoveredTaskId.set(id);
        ganttInteraction$.hoveredDependencyId.set(undefined);
      } else {
        ganttInteraction$.hoveredDependencyId.set(id);
        ganttInteraction$.hoveredTaskId.set(undefined);
      }
    },

    // Drag operations (reactive like VibeGrid)
    startDrag: (taskId: string, startX: number, startY: number) => {
      batch(() => {
        ganttInteraction$.isDragging.set(true);
        ganttInteraction$.dragTaskId.set(taskId);
        ganttInteraction$.dragStartX.set(startX);
        ganttInteraction$.dragStartY.set(startY);
        ganttInteraction$.dragCurrentX.set(startX);
        ganttInteraction$.dragCurrentY.set(startY);
      });
    },

    updateDrag: (currentX: number, currentY: number) => {
      if (!ganttInteraction$.isDragging.get()) return;

      batch(() => {
        ganttInteraction$.dragCurrentX.set(currentX);
        ganttInteraction$.dragCurrentY.set(currentY);

        // Calculate and apply drag delta to task
        const deltaX = currentX - ganttInteraction$.dragStartX.get();
        const dragTaskId = ganttInteraction$.dragTaskId.get();

        if (dragTaskId) {
          ganttCore$.operations.updateTaskDrag(dragTaskId, deltaX);
        }
      });
    },

    endDrag: () => {
      const dragTaskId = ganttInteraction$.dragTaskId.get();

      if (dragTaskId) {
        // Commit the drag operation
        ganttCore$.operations.commitTaskDrag(dragTaskId);
      }

      batch(() => {
        ganttInteraction$.isDragging.set(false);
        ganttInteraction$.dragTaskId.set(undefined);
        ganttInteraction$.dragStartX.set(0);
        ganttInteraction$.dragStartY.set(0);
        ganttInteraction$.dragCurrentX.set(0);
        ganttInteraction$.dragCurrentY.set(0);
      });
    },

    // Edit operations
    startEdit: (taskId: string, field: string) => {
      batch(() => {
        ganttInteraction$.editingTaskId.set(taskId);
        ganttInteraction$.editingField.set(field);
      });
    },

    cancelEdit: () => {
      batch(() => {
        ganttInteraction$.editingTaskId.set(undefined);
        ganttInteraction$.editingField.set(undefined);
      });
    },

    // Utility functions
    getSelectedTask: (): GanttTask | undefined => {
      const taskId = ganttInteraction$.selectedTaskId.get();
      if (!taskId) return undefined;
      return ganttCore$.tasks.get().find((t: GanttTask) => t.id === taskId);
    },

    getSelectedDependency: (): TaskDependency | undefined => {
      const depId = ganttInteraction$.selectedDependencyId.get();
      if (!depId) return undefined;
      return ganttCore$.dependencies.get().find((d: TaskDependency) => d.id === depId);
    },

    getHoveredTask: (): GanttTask | undefined => {
      const taskId = ganttInteraction$.hoveredTaskId.get();
      if (!taskId) return undefined;
      return ganttCore$.tasks.get().find((t: GanttTask) => t.id === taskId);
    }
  });

  return ganttInteraction$;
}