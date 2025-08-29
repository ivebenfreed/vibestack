import { useEffect, useRef, useCallback } from 'react';
import { createActor } from 'xstate';
import { useSelector } from '@xstate/react';
import { 
  createGanttStoreActor, 
  loadInitialGanttData, 
  setupGranularGanttSubscriptions 
} from '../stores/gantt-data-store-atomic';

/**
 * Hook to manage Gantt data loading and subscriptions
 * Follows the VibeGridDex pattern of pre-loading and resolving all data
 */
export function useGanttData(projectId?: string) {
  const storeActorRef = useRef<any>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  
  // Initialize store actor
  if (!storeActorRef.current) {
    console.log('📊 useGanttData: Creating store actor');
    const storeLogic = createGanttStoreActor(projectId);
    storeActorRef.current = createActor(storeLogic);
    storeActorRef.current.start();
  }
  
  // Selectors for different parts of the state
  const tasks = useSelector(storeActorRef.current, state => state.context.tasks);
  const taskTree = useSelector(storeActorRef.current, state => state.context.taskTree);
  const taskMap = useSelector(storeActorRef.current, state => state.context.taskMap);
  const dependencies = useSelector(storeActorRef.current, state => state.context.dependencies);
  const dependencyMap = useSelector(storeActorRef.current, state => state.context.dependencyMap);
  const criticalPath = useSelector(storeActorRef.current, state => state.context.criticalPath);
  const relationships = useSelector(storeActorRef.current, state => state.context.relationships);
  const loading = useSelector(storeActorRef.current, state => state.context.loading);
  const error = useSelector(storeActorRef.current, state => state.context.error);
  const expandedTasks = useSelector(storeActorRef.current, state => state.context.expandedTasks);
  const selectedTasks = useSelector(storeActorRef.current, state => state.context.selectedTasks);
  const visibleDateRange = useSelector(storeActorRef.current, state => state.context.visibleDateRange);
  const zoom = useSelector(storeActorRef.current, state => state.context.zoom);
  const showWeekends = useSelector(storeActorRef.current, state => state.context.showWeekends);
  const showDependencies = useSelector(storeActorRef.current, state => state.context.showDependencies);
  const pagination = useSelector(storeActorRef.current, state => state.context.pagination);
  
  // Load initial data
  useEffect(() => {
    let mounted = true;
    
    const loadData = async () => {
      try {
        console.log('📊 useGanttData: Loading initial data', { projectId });
        
        // Load all data including relationships
        const { tasks, dependencies, relationships, pagination } = await loadInitialGanttData(projectId);
        
        if (!mounted) return;
        
        // Send initial data to store
        storeActorRef.current.send({
          type: 'setInitialData',
          tasks,
          relationships
        });
        
        // Set dependencies
        storeActorRef.current.send({
          type: 'updateDependencies',
          dependencies: Object.values(dependencies)
        });
        
        // Set pagination if needed
        if (pagination) {
          storeActorRef.current.send({
            type: 'setPagination',
            pagination
          });
        }
        
        // Set up subscriptions (only if not paginated)
        if (!pagination?.enabled) {
          cleanupRef.current = setupGranularGanttSubscriptions(storeActorRef.current, projectId);
        }
        
      } catch (error) {
        console.error('❌ useGanttData: Error loading initial data', error);
        if (mounted) {
          storeActorRef.current.send({
            type: 'setError',
            error: error instanceof Error ? error.message : 'Failed to load data'
          });
        }
      }
    };
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, [projectId]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
      if (storeActorRef.current) {
        storeActorRef.current.stop();
      }
    };
  }, []);
  
  // Action callbacks
  const toggleTaskExpanded = useCallback((taskId: string) => {
    storeActorRef.current.send({ type: 'toggleTaskExpanded', taskId });
  }, []);
  
  const setSelectedTasks = useCallback((taskIds: string[]) => {
    storeActorRef.current.send({ type: 'setSelectedTasks', taskIds });
  }, []);
  
  const setVisibleDateRange = useCallback((range: { start: Date; end: Date }) => {
    storeActorRef.current.send({ type: 'setVisibleDateRange', range });
  }, []);
  
  const setZoom = useCallback((zoom: 'hour' | 'day' | 'week' | 'month') => {
    storeActorRef.current.send({ type: 'setZoom', zoom });
  }, []);
  
  const setShowWeekends = useCallback((show: boolean) => {
    storeActorRef.current.send({ type: 'setShowWeekends', show });
  }, []);
  
  const setShowDependencies = useCallback((show: boolean) => {
    storeActorRef.current.send({ type: 'setShowDependencies', show });
  }, []);
  
  // Get visible tasks based on expanded state
  const getVisibleTasks = useCallback(() => {
    const visible: any[] = [];
    
    const addVisibleTasks = (tasks: any[], level = 0) => {
      tasks.forEach(task => {
        visible.push({ ...task, level });
        
        if (task.children && task.children.length > 0 && expandedTasks.has(task.id)) {
          addVisibleTasks(task.children, level + 1);
        }
      });
    };
    
    addVisibleTasks(taskTree);
    
    return visible;
  }, [taskTree, expandedTasks]);
  
  // Get task by ID
  const getTaskById = useCallback((taskId: string) => {
    return taskMap.get(taskId);
  }, [taskMap]);
  
  // Get task dependencies
  const getTaskDependencies = useCallback((taskId: string) => {
    return dependencyMap.get(taskId) || { predecessors: [], successors: [] };
  }, [dependencyMap]);
  
  // Check if task is on critical path
  const isTaskCritical = useCallback((taskId: string) => {
    return criticalPath.has(taskId);
  }, [criticalPath]);
  
  return {
    // State
    tasks,
    taskTree,
    taskMap,
    dependencies,
    dependencyMap,
    criticalPath,
    relationships,
    loading,
    error,
    expandedTasks,
    selectedTasks,
    visibleDateRange,
    zoom,
    showWeekends,
    showDependencies,
    pagination,
    
    // Actions
    toggleTaskExpanded,
    setSelectedTasks,
    setVisibleDateRange,
    setZoom,
    setShowWeekends,
    setShowDependencies,
    
    // Helpers
    getVisibleTasks,
    getTaskById,
    getTaskDependencies,
    isTaskCritical,
    
    // Direct store access (for advanced use)
    storeActor: storeActorRef.current
  };
}