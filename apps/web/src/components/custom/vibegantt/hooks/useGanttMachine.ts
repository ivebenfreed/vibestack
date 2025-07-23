import { useMachine } from '@xstate/react';
import { ganttMachine } from '../machines/gantt-machine';
import type { GanttTask, TaskDependency, GanttViewConfig } from '../types';
import { useCallback } from 'react';

interface UseGanttMachineOptions {
  initialTasks?: GanttTask[];
  initialDependencies?: TaskDependency[];
  viewConfig?: Partial<GanttViewConfig>;
  onTaskUpdate?: (task: GanttTask) => void;
  onTaskCreate?: (task: Partial<GanttTask>) => void;
  onTaskDelete?: (taskId: string) => void;
  onDependencyCreate?: (dependency: Partial<TaskDependency>) => void;
  onDependencyDelete?: (dependencyId: string) => void;
}

export function useGanttMachine({
  initialTasks = [],
  initialDependencies = [],
  viewConfig = {},
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onDependencyCreate,
  onDependencyDelete,
}: UseGanttMachineOptions) {
  const [state, send, actor] = useMachine(ganttMachine, {
    input: {
      initialTasks,
      initialDependencies,
      viewConfig,
    },
  });
  
  // Task operations
  const selectTask = useCallback((taskId: string, multi = false) => {
    send({ type: 'TASK_SELECT', taskId, multi });
  }, [send]);
  
  const updateTask = useCallback((taskId: string, updates: Partial<GanttTask>) => {
    send({ type: 'UPDATE_TASK', taskId, updates });
    if (onTaskUpdate) {
      const task = state.context.tasks.get(taskId);
      if (task) {
        onTaskUpdate({ ...task, ...updates });
      }
    }
  }, [send, state.context.tasks, onTaskUpdate]);
  
  const deleteTask = useCallback((taskId: string) => {
    send({ type: 'DELETE_TASK', taskId });
    if (onTaskDelete) {
      onTaskDelete(taskId);
    }
  }, [send, onTaskDelete]);
  
  // Dependency operations
  const createDependency = useCallback((sourceTaskId: string, targetTaskId: string) => {
    send({ type: 'DEPENDENCY_CREATE_START', sourceTaskId });
    send({ type: 'DEPENDENCY_CREATE_END', targetTaskId });
  }, [send]);
  
  const deleteDependency = useCallback((dependencyId: string) => {
    send({ type: 'DEPENDENCY_DELETE', dependencyId });
    if (onDependencyDelete) {
      onDependencyDelete(dependencyId);
    }
  }, [send, onDependencyDelete]);
  
  // View operations
  const setZoomLevel = useCallback((level: GanttViewConfig['zoomLevel']) => {
    send({ type: 'ZOOM', level });
  }, [send]);
  
  const pan = useCallback((deltaX: number, deltaY: number) => {
    send({ type: 'PAN', deltaX, deltaY });
  }, [send]);
  
  const updateViewConfig = useCallback((config: Partial<GanttViewConfig>) => {
    send({ type: 'VIEW_CONFIG_UPDATE', config });
  }, [send]);
  
  // Keyboard shortcuts
  const handleKeyboardShortcut = useCallback((key: string, modifiers: string[]) => {
    send({ type: 'KEYBOARD_SHORTCUT', key, modifiers });
  }, [send]);
  
  return {
    state: state.context,
    isReady: state.matches('ready'),
    
    // Task operations
    selectTask,
    updateTask,
    deleteTask,
    
    // Dependency operations
    createDependency,
    deleteDependency,
    
    // View operations
    setZoomLevel,
    pan,
    updateViewConfig,
    
    // Other
    handleKeyboardShortcut,
    send,
    actor,
  };
}