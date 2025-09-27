import { observable, computed, batch } from '@legendapp/state';
import { mockData$ } from './mock-data';
import type {
  TimeScale,
  DateRange,
  GanttViewState,
  TaskPosition,
  DependencyPath,
  GanttTask,
  TaskDependency
} from '../types';
import {
  calculateTimelineWidth,
  calculateAllTaskPositions,
  calculateAllDependencyPaths,
  generateTimeMarkers,
  calculateDateFromPosition,
  snapToTimeScale,
  GANTT_CONSTANTS
} from '../utils/calculations';

// Default date range to match our 2025 mock data
function getDefaultDateRange(): DateRange {
  const start = new Date(2025, 0, 1); // Jan 1, 2025
  const end = new Date(2025, 3, 30);   // Apr 30, 2025
  return { start, end };
}

export function createVibeGanttCore$(tableId: string) {
  // Core observable state
  const ganttCore$ = observable({
    // Data (connected to mock data)
    tasks: computed(() => mockData$.tasks.get()),
    dependencies: computed(() => mockData$.dependencies.get()),

    // View state
    viewState: observable<GanttViewState>({
      zoomLevel: 1.0,
      timeScale: 'day',
      dateRange: getDefaultDateRange(),
      scrollLeft: 0,
      scrollTop: 0,
      selectedTaskId: undefined,
      selectedDependencyId: undefined,
      hoveredTaskId: undefined,
      isDragging: false,
      dragTaskId: undefined
    }),

    // Computed layout properties
    timelineWidth: computed(() => {
      const viewState = ganttCore$.viewState.get();
      return calculateTimelineWidth(
        viewState.dateRange,
        viewState.timeScale,
        viewState.zoomLevel
      );
    }),

    timelineHeight: computed(() => {
      const tasks = ganttCore$.tasks.get();
      return Math.max(400, tasks.length * GANTT_CONSTANTS.ROW_HEIGHT + 60);
    }),

    taskPositions: computed(() => {
      const tasks = ganttCore$.tasks.get();
      const viewState = ganttCore$.viewState.get();
      return calculateAllTaskPositions(
        tasks,
        viewState.dateRange,
        viewState.timeScale,
        viewState.zoomLevel
      );
    }),

    dependencyPaths: computed(() => {
      const dependencies = ganttCore$.dependencies.get();
      const taskPositions = ganttCore$.taskPositions.get();
      return calculateAllDependencyPaths(dependencies, taskPositions);
    }),

    timeMarkers: computed(() => {
      const viewState = ganttCore$.viewState.get();
      return generateTimeMarkers(
        viewState.dateRange,
        viewState.timeScale,
        viewState.zoomLevel
      );
    }),

    visibleTasks: computed(() => {
      const tasks = ganttCore$.tasks.get();
      const viewState = ganttCore$.viewState.get();

      // Filter tasks that are visible in current date range
      return tasks.filter(task => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.dueDate);
        const { start, end } = viewState.dateRange;

        return (taskStart >= start && taskStart <= end) ||
               (taskEnd >= start && taskEnd <= end) ||
               (taskStart <= start && taskEnd >= end);
      });
    }),

    // Operations
    operations: {
      // View operations
      setZoom: (level: number) => {
        const clampedLevel = Math.max(0.1, Math.min(5.0, level));
        ganttCore$.viewState.zoomLevel.set(clampedLevel);
      },

      setTimeScale: (scale: TimeScale) => {
        ganttCore$.viewState.timeScale.set(scale);
      },

      setDateRange: (range: DateRange) => {
        ganttCore$.viewState.dateRange.set(range);
      },

      panToDate: (date: Date) => {
        const currentRange = ganttCore$.viewState.dateRange.get();
        const duration = currentRange.end.getTime() - currentRange.start.getTime();
        const halfDuration = duration / 2;

        const newStart = new Date(date.getTime() - halfDuration);
        const newEnd = new Date(date.getTime() + halfDuration);

        ganttCore$.viewState.dateRange.set({ start: newStart, end: newEnd });
      },

      zoomToFit: () => {
        const tasks = ganttCore$.tasks.get();
        if (tasks.length === 0) return;

        const dates = tasks.flatMap(task => [
          new Date(task.startDate),
          new Date(task.dueDate)
        ]);

        const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
        const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

        // Add padding
        const padding = (maxDate.getTime() - minDate.getTime()) * 0.1;
        const start = new Date(minDate.getTime() - padding);
        const end = new Date(maxDate.getTime() + padding);

        batch(() => {
          ganttCore$.viewState.dateRange.set({ start, end });
          ganttCore$.viewState.zoomLevel.set(1.0);
        });
      },

      // Scroll operations
      setScroll: (scrollLeft: number, scrollTop: number) => {
        batch(() => {
          ganttCore$.viewState.scrollLeft.set(scrollLeft);
          ganttCore$.viewState.scrollTop.set(scrollTop);
        });
      },

      // Selection operations
      selectTask: (taskId: string | undefined) => {
        batch(() => {
          ganttCore$.viewState.selectedTaskId.set(taskId);
          ganttCore$.viewState.selectedDependencyId.set(undefined);
        });
      },

      selectDependency: (dependencyId: string | undefined) => {
        batch(() => {
          ganttCore$.viewState.selectedDependencyId.set(dependencyId);
          ganttCore$.viewState.selectedTaskId.set(undefined);
        });
      },

      setHoveredTask: (taskId: string | undefined) => {
        ganttCore$.viewState.hoveredTaskId.set(taskId);
      },

      clearSelection: () => {
        batch(() => {
          ganttCore$.viewState.selectedTaskId.set(undefined);
          ganttCore$.viewState.selectedDependencyId.set(undefined);
          ganttCore$.viewState.hoveredTaskId.set(undefined);
        });
      },

      // Drag operations
      startDrag: (taskId: string) => {
        batch(() => {
          ganttCore$.viewState.isDragging.set(true);
          ganttCore$.viewState.dragTaskId.set(taskId);
        });
      },

      updateDrag: (deltaX: number) => {
        const dragTaskId = ganttCore$.viewState.dragTaskId.get();
        if (!dragTaskId) return;

        const viewState = ganttCore$.viewState.get();
        const task = ganttCore$.tasks.get().find(t => t.id === dragTaskId);
        if (!task) return;

        // Calculate new start date from delta
        const currentStart = new Date(task.startDate);
        const currentEnd = new Date(task.dueDate);
        const duration = currentEnd.getTime() - currentStart.getTime();

        const newStartPosition = calculateDateFromPosition(
          deltaX,
          { start: currentStart, end: currentStart },
          viewState.timeScale,
          viewState.zoomLevel
        );

        const snappedStart = snapToTimeScale(
          new Date(currentStart.getTime() + newStartPosition.getTime() - currentStart.getTime()),
          viewState.timeScale
        );

        const snappedEnd = new Date(snappedStart.getTime() + duration);

        // Update task through mock data
        mockData$.updateTask(dragTaskId, {
          startDate: snappedStart.toISOString(),
          dueDate: snappedEnd.toISOString()
        });
      },

      endDrag: () => {
        batch(() => {
          ganttCore$.viewState.isDragging.set(false);
          ganttCore$.viewState.dragTaskId.set(undefined);
        });
      },

      // Task operations (delegated to mock data)
      createTask: (task: Partial<GanttTask>) => {
        return mockData$.addTask(task);
      },

      updateTask: (taskId: string, updates: Partial<GanttTask>) => {
        return mockData$.updateTask(taskId, updates);
      },

      deleteTask: (taskId: string) => {
        // Clear selection if deleting selected task
        if (ganttCore$.viewState.selectedTaskId.get() === taskId) {
          ganttCore$.operations.clearSelection();
        }
        return mockData$.deleteTask(taskId);
      },

      // Dependency operations
      createDependency: (dependency: Omit<TaskDependency, 'id'>) => {
        return mockData$.addDependency(dependency);
      },

      deleteDependency: (dependencyId: string) => {
        // Clear selection if deleting selected dependency
        if (ganttCore$.viewState.selectedDependencyId.get() === dependencyId) {
          ganttCore$.operations.clearSelection();
        }
        return mockData$.deleteDependency(dependencyId);
      },

      // Utility operations
      getTaskAtPosition: (x: number, y: number): GanttTask | undefined => {
        const rowIndex = Math.floor(y / GANTT_CONSTANTS.ROW_HEIGHT);
        const tasks = ganttCore$.visibleTasks.get();
        const taskPositions = ganttCore$.taskPositions.get();

        const taskPos = taskPositions[rowIndex];
        if (!taskPos) return undefined;

        if (x >= taskPos.x && x <= taskPos.x + taskPos.width) {
          return tasks.find(t => t.id === taskPos.taskId);
        }

        return undefined;
      },

      getDependencyAtPosition: (x: number, y: number): TaskDependency | undefined => {
        const dependencies = ganttCore$.dependencies.get();
        const dependencyPaths = ganttCore$.dependencyPaths.get();

        // Simple hit testing for dependency lines
        // In a real implementation, you'd use more sophisticated path hit testing
        for (const path of dependencyPaths) {
          const dependency = dependencies.find(d => d.id === path.id);
          if (dependency) {
            // Simplified hit test - check if point is near any dependency
            // This would need proper SVG path hit testing in production
            return dependency;
          }
        }

        return undefined;
      },

      // Data management
      resetToMockData: () => {
        mockData$.generateSampleProject();
        ganttCore$.operations.clearSelection();
        ganttCore$.operations.zoomToFit();
      },

      clearAllData: () => {
        mockData$.clearAll();
        ganttCore$.operations.clearSelection();
      }
    }
  });

  return ganttCore$;
}