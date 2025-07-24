import { useState, useEffect, useCallback } from 'react';
import { useSelector } from '@xstate/store/react';
import { shallowEqual } from '@xstate/store';
import type { Task } from '@repo/dataforge/client-entities';
import { tasksAtom } from '@/domain/task';
import { domainServices } from '@/domain';

interface OptimisticTaskState {
  task: Task | null;
  isOptimistic: boolean;
  isPending: boolean;
  error: string | null;
}

/**
 * Hook for optimistic task updates with local state management
 * 
 * Usage:
 * ```tsx
 * const { task, updateTask, isOptimistic, isPending } = useOptimisticTask(taskId);
 * 
 * const handleFieldChange = (field: string, value: any) => {
 *   updateTask({ [field]: value });
 * };
 * ```
 */
export function useOptimisticTask(taskId: string | null) {
  // Get the current task from the atom
  const atomTask = useSelector(
    tasksAtom,
    (tasks) => taskId ? tasks[taskId] || null : null,
    shallowEqual
  );

  // Local optimistic state
  const [optimisticState, setOptimisticState] = useState<OptimisticTaskState>({
    task: null,
    isOptimistic: false,
    isPending: false,
    error: null
  });

  // Sync local state with atom state when atom updates
  useEffect(() => {
    if (atomTask) {
      setOptimisticState(prev => ({
        ...prev,
        task: atomTask,
        isOptimistic: false,
        error: null
      }));
    }
  }, [atomTask]);

  // Initialize local state if we have a task but no local state
  useEffect(() => {
    if (atomTask && !optimisticState.task) {
      setOptimisticState({
        task: atomTask,
        isOptimistic: false,
        isPending: false,
        error: null
      });
    }
  }, [atomTask, optimisticState.task]);

  const updateTask = useCallback(async (updates: Partial<Task>) => {
    if (!taskId || !optimisticState.task) return;

    // Immediate optimistic update
    const optimisticTask = {
      ...optimisticState.task,
      ...updates,
      updatedAt: new Date()
    };

    setOptimisticState(prev => ({
      ...prev,
      task: optimisticTask,
      isOptimistic: true,
      isPending: true,
      error: null
    }));

    try {
      // Update database using domain services
      await domainServices.task.updateUI(taskId, updates);
      
      // Keep optimistic state until live changes update the atom
      setOptimisticState(prev => ({
        ...prev,
        isPending: false
      }));
    } catch (error) {
      // Revert to atom state on error
      setOptimisticState(prev => ({
        ...prev,
        task: atomTask,
        isOptimistic: false,
        isPending: false,
        error: error instanceof Error ? error.message : 'Update failed'
      }));
    }
  }, [taskId, optimisticState.task, atomTask]);

  return {
    task: optimisticState.task,
    updateTask,
    isOptimistic: optimisticState.isOptimistic,
    isPending: optimisticState.isPending,
    error: optimisticState.error
  };
}

/**
 * Hook for optimistic task array updates
 * Useful for tables and lists where multiple tasks might be updated
 */
export function useOptimisticTasks(taskIds: string[] = []) {
  const atomTasks = useSelector(
    tasksAtom,
    (tasks) => taskIds.map(id => tasks[id]).filter(Boolean) as Task[],
    shallowEqual
  );

  const [optimisticTasks, setOptimisticTasks] = useState<Record<string, Task>>({});
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  // Sync optimistic tasks with atom updates
  useEffect(() => {
    setOptimisticTasks(prev => {
      const updated = { ...prev };
      
      // Remove optimistic tasks that have been updated in the atom
      for (const task of atomTasks) {
        if (updated[task.id] && !pendingUpdates.has(task.id)) {
          delete updated[task.id];
        }
      }
      
      return updated;
    });
  }, [atomTasks, pendingUpdates]);

  const updateTask = useCallback(async (taskId: string, updates: Partial<Task>) => {
    const atomTask = atomTasks.find(t => t.id === taskId);
    if (!atomTask) return;

    // Immediate optimistic update
    const optimisticTask = {
      ...atomTask,
      ...updates,
      updatedAt: new Date()
    };

    setOptimisticTasks(prev => ({
      ...prev,
      [taskId]: optimisticTask
    }));

    setPendingUpdates(prev => new Set([...prev, taskId]));

    try {
      // Update database using domain services
      await domainServices.task.updateUI(taskId, updates);
      
      // Remove from pending after successful update
      setPendingUpdates(prev => {
        const updated = new Set(prev);
        updated.delete(taskId);
        return updated;
      });
    } catch (error) {
      // Remove optimistic update on error
      setOptimisticTasks(prev => {
        const updated = { ...prev };
        delete updated[taskId];
        return updated;
      });
      
      setPendingUpdates(prev => {
        const updated = new Set(prev);
        updated.delete(taskId);
        return updated;
      });
      
      throw error;
    }
  }, [atomTasks]);

  // Merge atom tasks with optimistic updates
  const tasks = atomTasks.map(task => 
    optimisticTasks[task.id] || task
  );

  return {
    tasks,
    updateTask,
    getPendingStatus: (taskId: string) => pendingUpdates.has(taskId),
    getOptimisticStatus: (taskId: string) => Boolean(optimisticTasks[taskId])
  };
}