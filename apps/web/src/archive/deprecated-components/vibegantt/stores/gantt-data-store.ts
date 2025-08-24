import { fromStore } from '@xstate/store';
import { db } from '../../../../db/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import type { GanttTask, TaskDependency, Resource, ResourceAllocation } from '../types';

// ====================================
// TYPES
// ====================================

export interface TaskChange {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  data: GanttTask;
  changedFields?: string[];
}

export interface DependencyChange {
  id: string;
  operation: 'insert' | 'update' | 'delete';
  data: TaskDependency;
}

export interface GanttStoreContext {
  projectId: string | null;
  
  // Raw data
  tasks: Record<string, GanttTask>;
  dependencies: Record<string, TaskDependency>;
  resources: Record<string, Resource>;
  allocations: Record<string, ResourceAllocation>;
  
  // Resolved relationships
  assigneeMap: Record<string, { id: string; name: string; email: string }>; // user.id -> user data
  parentTaskMap: Record<string, GanttTask>; // task.id -> parent task
  
  // Computed data
  taskHierarchy: Map<string, string[]>; // parentId -> childIds
  dependencyGraph: Map<string, { predecessors: string[]; successors: string[] }>;
  criticalPath: Set<string>;
  
  // View state
  expandedTasks: Set<string>;
  selectedTasks: Set<string>;
  visibleDateRange: { start: Date; end: Date };
  
  // Metadata
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number;
}

// ====================================
// EVENTS
// ====================================

export type GanttStoreEvent = 
  | { type: 'TASKS_LOADED'; tasks: any[]; assignees: any[]; parentTasks: any[] }
  | { type: 'TASK_CHANGED'; change: TaskChange }
  | { type: 'TASKS_CHANGED'; changes: TaskChange[] }
  | { type: 'DEPENDENCIES_LOADED'; dependencies: TaskDependency[] }
  | { type: 'DEPENDENCIES_CHANGED'; changes: DependencyChange[] }
  | { type: 'RESOURCES_LOADED'; resources: Resource[] }
  | { type: 'ALLOCATIONS_LOADED'; allocations: ResourceAllocation[] }
  | { type: 'SET_PROJECT_ID'; projectId: string | null }
  | { type: 'SET_LOADING'; loading: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'TOGGLE_TASK_EXPANDED'; taskId: string }
  | { type: 'SET_SELECTED_TASKS'; taskIds: string[] }
  | { type: 'SET_VISIBLE_DATE_RANGE'; range: { start: Date; end: Date } }
  | { type: 'UPDATE_VIEW_CONFIG'; viewConfig: any; timelineLayout?: any }
  | { type: 'COMPUTE_CRITICAL_PATH' };

// ====================================
// HELPERS
// ====================================

/**
 * Check if task content has changed (excluding timestamps)
 */
function hasTaskContentChanged(oldTask: GanttTask, newTask: GanttTask): boolean {
  if (!oldTask || !newTask) return true;
  
  const ignoredFields = ['updatedAt', 'syncedAt', 'createdAt'];
  const oldKeys = Object.keys(oldTask).filter(k => !ignoredFields.includes(k));
  const newKeys = Object.keys(newTask).filter(k => !ignoredFields.includes(k));
  
  if (oldKeys.length !== newKeys.length) return true;
  
  for (const key of oldKeys) {
    // Special handling for dates
    if (key.includes('Date') && oldTask[key] && newTask[key]) {
      const oldTime = new Date(oldTask[key]).getTime();
      const newTime = new Date(newTask[key]).getTime();
      if (oldTime !== newTime) return true;
    } else if (oldTask[key] !== newTask[key]) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get list of changed fields
 */
function getChangedFields(oldTask: GanttTask, newTask: GanttTask): string[] {
  const changedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldTask), ...Object.keys(newTask)]);
  
  for (const key of allKeys) {
    if (key !== 'updatedAt' && key !== 'syncedAt') {
      if (key.includes('Date') && oldTask[key] && newTask[key]) {
        const oldTime = new Date(oldTask[key]).getTime();
        const newTime = new Date(newTask[key]).getTime();
        if (oldTime !== newTime) changedFields.push(key);
      } else if (oldTask[key] !== newTask[key]) {
        changedFields.push(key);
      }
    }
  }
  
  return changedFields;
}

/**
 * Build task hierarchy from parent-child relationships
 */
function buildTaskHierarchy(tasks: Record<string, GanttTask>): Map<string, string[]> {
  const hierarchy = new Map<string, string[]>();
  
  // Initialize with null for root tasks
  hierarchy.set('root', []);
  
  Object.values(tasks).forEach(task => {
    const parentId = task.parentId || 'root';
    const children = hierarchy.get(parentId) || [];
    children.push(task.id);
    hierarchy.set(parentId, children);
  });
  
  return hierarchy;
}

/**
 * Build dependency graph for quick lookups
 */
function buildDependencyGraph(
  dependencies: Record<string, TaskDependency>
): Map<string, { predecessors: string[]; successors: string[] }> {
  const graph = new Map();
  
  Object.values(dependencies).forEach(dep => {
    // Update source task (has successors)
    const sourceNode = graph.get(dep.sourceTaskId) || { predecessors: [], successors: [] };
    sourceNode.successors.push(dep.targetTaskId);
    graph.set(dep.sourceTaskId, sourceNode);
    
    // Update target task (has predecessors)
    const targetNode = graph.get(dep.targetTaskId) || { predecessors: [], successors: [] };
    targetNode.predecessors.push(dep.sourceTaskId);
    graph.set(dep.targetTaskId, targetNode);
  });
  
  return graph;
}

/**
 * Calculate critical path using longest path algorithm
 */
function calculateCriticalPath(
  tasks: Record<string, GanttTask>,
  graph: Map<string, { predecessors: string[]; successors: string[] }>
): Set<string> {
  // Simplified critical path - in real implementation would use proper CPM algorithm
  const criticalTasks = new Set<string>();
  
  // Find tasks with no predecessors (start nodes)
  const startTasks = Object.values(tasks).filter(task => {
    const node = graph.get(task.id);
    return !node || node.predecessors.length === 0;
  });
  
  // For now, just mark tasks with high priority as critical
  // Real implementation would calculate longest path through network
  Object.values(tasks).forEach(task => {
    if (task.priority === 'critical' || task.priority === 'high') {
      criticalTasks.add(task.id);
    }
  });
  
  return criticalTasks;
}

// ====================================
// STORE LOGIC
// ====================================

/**
 * Create XState Store logic for gantt data with atomic updates
 */
export const createGanttStoreLogic = (projectId?: string) => {
  return fromStore<GanttStoreContext, GanttStoreEvent>({
    context: {
      projectId: projectId || null,
      tasks: {},
      dependencies: {},
      resources: {},
      allocations: {},
      assigneeMap: {},
      parentTaskMap: {},
      taskHierarchy: new Map(),
      dependencyGraph: new Map(),
      criticalPath: new Set(),
      expandedTasks: new Set(['root']), // Root is always expanded
      selectedTasks: new Set(),
      visibleDateRange: {
        start: new Date(),
        end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      },
      loading: true,
      error: null,
      lastUpdatedAt: 0
    },
    on: {
      TASKS_LOADED: (context, event) => {
        console.log('📊 GanttStore: Tasks loaded', {
          count: event.tasks.length,
          projectId: context.projectId
        });
        
        const tasks: Record<string, GanttTask> = {};
        const assigneeMap: Record<string, any> = {};
        const parentTaskMap: Record<string, GanttTask> = {};
        
        // Process tasks
        event.tasks.forEach(task => {
          tasks[task.id] = task;
        });
        
        // Process assignees
        event.assignees.forEach(user => {
          assigneeMap[user.id] = {
            id: user.id,
            name: user.name || user.email,
            email: user.email
          };
        });
        
        // Process parent tasks (could be same as tasks)
        event.parentTasks.forEach(task => {
          parentTaskMap[task.id] = task;
        });
        
        // Build computed data
        const taskHierarchy = buildTaskHierarchy(tasks);
        const dependencyGraph = buildDependencyGraph(context.dependencies);
        const criticalPath = calculateCriticalPath(tasks, dependencyGraph);
        
        return {
          ...context,
          tasks,
          assigneeMap,
          parentTaskMap,
          taskHierarchy,
          dependencyGraph,
          criticalPath,
          loading: false,
          error: null,
          lastUpdatedAt: Date.now()
        };
      },
      
      TASK_CHANGED: (context, event) => {
        const { change } = event;
        const { id, operation, data } = change;
        
        console.log('📊 GanttStore: Task changed', {
          id,
          operation,
          changedFields: change.changedFields
        });
        
        let newTasks = context.tasks;
        
        if (operation === 'delete') {
          const { [id]: removed, ...rest } = context.tasks;
          newTasks = rest;
        } else {
          // Only update if content actually changed
          const oldTask = context.tasks[id];
          if (!oldTask || hasTaskContentChanged(oldTask, data)) {
            newTasks = {
              ...context.tasks,
              [id]: data
            };
          } else {
            return context; // No change needed
          }
        }
        
        // Rebuild computed data
        const taskHierarchy = buildTaskHierarchy(newTasks);
        const dependencyGraph = buildDependencyGraph(context.dependencies);
        const criticalPath = calculateCriticalPath(newTasks, dependencyGraph);
        
        return {
          ...context,
          tasks: newTasks,
          taskHierarchy,
          dependencyGraph,
          criticalPath,
          lastUpdatedAt: Date.now()
        };
      },
      
      DEPENDENCIES_LOADED: (context, event) => {
        console.log('📊 GanttStore: Dependencies loaded', {
          count: event.dependencies.length
        });
        
        const dependencies: Record<string, TaskDependency> = {};
        event.dependencies.forEach(dep => {
          dependencies[dep.id] = dep;
        });
        
        const dependencyGraph = buildDependencyGraph(dependencies);
        const criticalPath = calculateCriticalPath(context.tasks, dependencyGraph);
        
        return {
          ...context,
          dependencies,
          dependencyGraph,
          criticalPath,
          lastUpdatedAt: Date.now()
        };
      },
      
      RESOURCES_LOADED: (context, event) => {
        console.log('📊 GanttStore: Resources loaded', {
          count: event.resources.length
        });
        
        const resources: Record<string, Resource> = {};
        event.resources.forEach(resource => {
          resources[resource.id] = resource;
        });
        
        return {
          ...context,
          resources,
          lastUpdatedAt: Date.now()
        };
      },
      
      TOGGLE_TASK_EXPANDED: (context, event) => {
        const expandedTasks = new Set(context.expandedTasks);
        
        if (expandedTasks.has(event.taskId)) {
          expandedTasks.delete(event.taskId);
        } else {
          expandedTasks.add(event.taskId);
        }
        
        return {
          ...context,
          expandedTasks
        };
      },
      
      SET_SELECTED_TASKS: (context, event) => {
        return {
          ...context,
          selectedTasks: new Set(event.taskIds)
        };
      },
      
      SET_VISIBLE_DATE_RANGE: (context, event) => {
        return {
          ...context,
          visibleDateRange: event.range
        };
      },
      
      SET_LOADING: (context, event) => {
        return {
          ...context,
          loading: event.loading
        };
      },
      
      SET_ERROR: (context, event) => {
        return {
          ...context,
          error: event.error,
          loading: false
        };
      },
      
      UPDATE_VIEW_CONFIG: (context, event) => {
        console.log('📊 GanttStore: View config updated for coordinate recalculation', {
          dayWidth: event.timelineLayout?.dayWidth,
          zoomFactor: event.viewConfig?.zoomFactor
        });
        
        // Trigger coordinate recalculation by updating lastUpdatedAt
        // This will cause dependent computations to re-run
        return {
          ...context,
          lastUpdatedAt: Date.now()
        };
      }
    }
  });
};

// ====================================
// SUBSCRIPTION SETUP
// ====================================

/**
 * Load initial data and set up live subscriptions
 */
export async function loadGanttData(
  storeActor: any,
  projectId?: string
): Promise<() => void> {
  const subscriptions: Subscription[] = [];
  
  try {
    // Load tasks with relationships
    const tasksObservable = liveQuery(async () => {
      let query = db.tasks.toCollection();
      
      if (projectId) {
        query = db.tasks.where('projectId').equals(projectId);
      }
      
      const tasks = await query.toArray();
      
      // Get unique assignee IDs and parent IDs
      const assigneeIds = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))];
      const parentIds = [...new Set(tasks.map(t => t.parentId).filter(Boolean))];
      
      // Batch load relationships
      const [assignees, parentTasks] = await Promise.all([
        assigneeIds.length > 0 ? db.users.where('id').anyOf(assigneeIds).toArray() : [],
        parentIds.length > 0 ? db.tasks.where('id').anyOf(parentIds).toArray() : []
      ]);
      
      // Transform to GanttTask format
      const ganttTasks = tasks.map(task => ({
        id: task.id,
        name: task.title || 'Untitled Task',
        plannedStartDate: task.plannedStartDate || task.createdAt,
        plannedEndDate: task.plannedEndDate || task.dueDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        actualStartDate: task.actualStartDate,
        actualEndDate: task.actualEndDate,
        progress: task.progress || 0,
        assigneeId: task.assigneeId,
        parentId: task.parentId,
        color: task.color,
        priority: task.priority || 'medium',
        constraints: task.constraints,
        customFields: task.customFields,
      } as GanttTask));
      
      return { tasks: ganttTasks, assignees, parentTasks };
    });
    
    const tasksSub = tasksObservable.subscribe({
      next: (data) => {
        storeActor.send({
          type: 'TASKS_LOADED',
          tasks: data.tasks,
          assignees: data.assignees,
          parentTasks: data.parentTasks
        });
      },
      error: (error) => {
        console.error('Error loading tasks:', error);
        storeActor.send({ type: 'SET_ERROR', error: error.message });
      }
    });
    
    subscriptions.push(tasksSub);
    
    // Load dependencies
    const depsObservable = liveQuery(async () => {
      let dependencies = await db.taskDependencies.toArray();
      
      if (projectId) {
        const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray();
        const projectTaskIds = new Set(projectTasks.map(t => t.id));
        
        dependencies = dependencies.filter(dep => 
          projectTaskIds.has(dep.dependentTaskId) || projectTaskIds.has(dep.dependencyTaskId)
        );
      }
      
      return dependencies.map(dep => ({
        id: `${dep.dependentTaskId}-${dep.dependencyTaskId}`,
        sourceTaskId: dep.dependencyTaskId,
        targetTaskId: dep.dependentTaskId,
        type: 'finish-to-start' as const,
        lag: 0
      } as TaskDependency));
    });
    
    const depsSub = depsObservable.subscribe({
      next: (dependencies) => {
        storeActor.send({
          type: 'DEPENDENCIES_LOADED',
          dependencies
        });
      },
      error: (error) => {
        console.error('Error loading dependencies:', error);
        storeActor.send({ type: 'SET_ERROR', error: error.message });
      }
    });
    
    subscriptions.push(depsSub);
    
    // Load resources (users)
    const resourcesObservable = liveQuery(async () => {
      const users = await db.users.toArray();
      
      return users.map(user => ({
        id: user.id,
        name: user.name || user.email,
        type: 'person' as const,
        availability: 8,
        cost: user.hourlyRate
      } as Resource));
    });
    
    const resourcesSub = resourcesObservable.subscribe({
      next: (resources) => {
        storeActor.send({
          type: 'RESOURCES_LOADED',
          resources
        });
      },
      error: (error) => {
        console.error('Error loading resources:', error);
        storeActor.send({ type: 'SET_ERROR', error: error.message });
      }
    });
    
    subscriptions.push(resourcesSub);
    
  } catch (error) {
    console.error('Error setting up subscriptions:', error);
    storeActor.send({ type: 'SET_ERROR', error: error.message });
  }
  
  // Return cleanup function
  return () => {
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}