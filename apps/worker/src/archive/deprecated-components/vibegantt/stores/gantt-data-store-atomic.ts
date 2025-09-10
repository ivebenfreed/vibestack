import { fromStore } from '@xstate/store';
import { db } from '@repo/dataforge/dexie-schema';
import { liveQuery } from 'dexie';
import type { Subscription } from 'dexie';
import type { GanttTask, TaskDependency, Resource, ResourceAllocation } from '../types';
import { taskService } from '@/domain/task-service';
import { entityDependencyService } from '@/domain/entity-dependency-service';
import { calculateCoordinateMapping, type CoordinateMapping } from '../utils/coordinate-mapper';
import { log } from '@/logger';
const fileLog = log('archive/deprecated-components/vibegantt/stores/gantt-data-store-atomic.ts');

// ====================================
// MEMORY LIMITS
// ====================================

const MEMORY_LIMITS = {
  MAX_TASKS: 5000,        // Maximum tasks to keep in memory
  MAX_DEPENDENCIES: 10000, // Maximum dependencies
  DEFAULT_PAGE_SIZE: 500  // Default page size when pagination is needed
};

// ====================================
// ATOMIC STORE WITH EVENT-BASED MUTATIONS
// ====================================

export const createGanttStoreLogic = (projectId?: string, domainService?: any, initialDayWidth: number = 50) => {
  // Load persisted display state
  const persistedState = loadDisplayState(projectId || 'global');
  
  return fromStore({
    context: {
      projectId: projectId || null,
      
      // Raw data - fully resolved entities
      tasks: {} as Record<string, any>, // Task entities with resolved relationships
      dependencies: {} as Record<string, TaskDependency>,
      resources: {} as Record<string, Resource>,
      allocations: {} as Record<string, ResourceAllocation>,
      
      // Relationship lookups
      relationships: {
        users: {} as Record<string, any>,
        projects: {} as Record<string, any>,
        statusDefinitions: {} as Record<string, any>,
        tags: {} as Record<string, any>,
      },
      
      // Processed data for rendering
      taskTree: [] as any[], // Hierarchical task structure
      taskMap: new Map() as Map<string, any>, // Quick lookup
      dependencyMap: new Map() as Map<string, { predecessors: string[]; successors: string[] }>,
      criticalPath: new Set() as Set<string>,
      coordinateMapping: null as CoordinateMapping | null, // Pre-calculated positions
      
      // View state
      expandedTasks: new Set(persistedState?.expandedTasks || ['root']) as Set<string>,
      selectedTasks: new Set() as Set<string>,
      visibleDateRange: persistedState?.visibleDateRange || {
        start: new Date(),
        end: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
      },
      zoom: persistedState?.zoom || 'day' as 'hour' | 'day' | 'week' | 'month',
      zoomFactor: persistedState?.zoomFactor || 1.0,
      dayWidth: persistedState?.dayWidth || initialDayWidth, // Use initial dayWidth from machine
      showWeekends: persistedState?.showWeekends ?? true,
      showDependencies: persistedState?.showDependencies ?? true,
      
      // Metadata
      loading: true,
      error: null as string | null,
      lastUpdatedAt: 0,
      
      // Pagination state
      pagination: null as {
        enabled: boolean,
        currentPage: number,
        pageSize: number,
        totalTasks: number,
        totalPages: number,
      } | null
    },
    
    on: {
      // Event-based mutations for XState compatibility
      setInitialData: {
        tasks: (context, event: { tasks: Record<string, any>, relationships: any }) => {
          if (process.env.NODE_ENV === 'development') {
            fileLog.info('📊 GanttStore: Setting tasks', {
              taskCount: Object.keys(event.tasks).length,
              hasRelationships: !!event.relationships
            });
          }
          return event.tasks;
        },
        relationships: (context, event) => event.relationships || context.relationships,
        taskTree: (context, event) => {
          // Build hierarchical tree structure from flat tasks
          const tasks = Object.values(event.tasks);
          return buildTaskTree(tasks);
        },
        taskMap: (context, event) => {
          // Build quick lookup map
          const map = new Map();
          Object.values(event.tasks).forEach((task: any) => {
            map.set(task.id, task);
          });
          return map;
        },
        dependencyMap: (context) => {
          // Build dependency graph
          return buildDependencyMap(context.dependencies);
        },
        criticalPath: (context, event) => {
          // Calculate critical path
          return calculateCriticalPath(event.tasks, context.dependencies);
        },
        coordinateMapping: (context, event) => {
          // Calculate coordinate mapping for rendering
          const tasks = Object.values(event.tasks);
          const taskTree = buildTaskTree(tasks);
          
          return calculateCoordinateMapping({
            taskTree,
            expandedTasks: context.expandedTasks,
            visibleDateRange: context.visibleDateRange,
            zoom: context.zoom,
            dayWidth: context.dayWidth,
          });
        },
        loading: false,
        error: null,
        lastUpdatedAt: Date.now()
      },
      
      updateTask: {
        tasks: (context, event: { task: any }) => {
          if (process.env.NODE_ENV === 'development') {
            fileLog.info('📊 GanttStore: Updating task atomically', {
              taskId: event.task.id,
              title: event.task.title
            });
          }
          
          // Resolve task with current relationships
          const resolvedTask = resolveTaskRelationships(event.task, context.relationships);
          
          return {
            ...context.tasks,
            [event.task.id]: resolvedTask
          };
        },
        taskTree: (context, event) => {
          // Rebuild tree with updated task
          const tasks = Object.values({
            ...context.tasks,
            [event.task.id]: resolveTaskRelationships(event.task, context.relationships)
          });
          return buildTaskTree(tasks);
        },
        taskMap: (context, event) => {
          const map = new Map(context.taskMap);
          const resolvedTask = resolveTaskRelationships(event.task, context.relationships);
          map.set(event.task.id, resolvedTask);
          return map;
        },
        criticalPath: (context, event) => {
          // Recalculate if task dates changed
          const oldTask = context.tasks[event.task.id];
          if (oldTask?.plannedStartDate !== event.task.plannedStartDate ||
              oldTask?.plannedEndDate !== event.task.plannedEndDate ||
              oldTask?.duration !== event.task.duration) {
            return calculateCriticalPath(
              { ...context.tasks, [event.task.id]: event.task },
              context.dependencies
            );
          }
          return context.criticalPath;
        },
        coordinateMapping: (context, event) => {
          // Recalculate coordinate mapping with updated task
          const tasks = Object.values({
            ...context.tasks,
            [event.task.id]: resolveTaskRelationships(event.task, context.relationships)
          });
          const taskTree = buildTaskTree(tasks);
          
          return calculateCoordinateMapping({
            taskTree,
            expandedTasks: context.expandedTasks,
            visibleDateRange: context.visibleDateRange,
            zoom: context.zoom,
            dayWidth: context.dayWidth,
          });
        },
        lastUpdatedAt: Date.now()
      },
      
      updateRelationshipTable: {
        relationships: (context, event: { table: string, data: any[] }) => {
          if (process.env.NODE_ENV === 'development') {
            fileLog.info('📊 GanttStore: Updating relationship table', {
              table: event.table,
              dataCount: event.data.length
            });
          }
          
          // Update relationship lookup table
          const relationshipLookup: Record<string, any> = {};
          event.data.forEach((item: any) => {
            relationshipLookup[item.id] = item;
          });
          
          return {
            ...context.relationships,
            [event.table]: relationshipLookup
          };
        },
        tasks: (context, event) => {
          // Re-resolve affected tasks
          const updatedTasks = { ...context.tasks };
          let changedCount = 0;
          
          // Create updated relationships
          const relationshipLookup: Record<string, any> = {};
          event.data.forEach((item: any) => {
            relationshipLookup[item.id] = item;
          });
          
          const updatedRelationships = {
            ...context.relationships,
            [event.table]: relationshipLookup
          };
          
          // Re-resolve all tasks with new relationships
          Object.keys(updatedTasks).forEach(taskId => {
            const originalTask = updatedTasks[taskId];
            const newResolvedTask = resolveTaskRelationships(originalTask, updatedRelationships);
            
            // Check if resolution changed
            if (JSON.stringify(originalTask) !== JSON.stringify(newResolvedTask)) {
              changedCount++;
              updatedTasks[taskId] = newResolvedTask;
            }
          });
          
          if (process.env.NODE_ENV === 'development' && changedCount > 0) {
            fileLog.info('📊 GanttStore: Re-resolved tasks after relationship change', {
              table: event.table,
              changedTasks: changedCount
            });
          }
          
          return updatedTasks;
        },
        taskTree: (context, event) => {
          // Rebuild tree if relationships affected task display
          if (['users', 'projects', 'statusDefinitions'].includes(event.table)) {
            const relationshipLookup: Record<string, any> = {};
            event.data.forEach((item: any) => {
              relationshipLookup[item.id] = item;
            });
            
            const updatedRelationships = {
              ...context.relationships,
              [event.table]: relationshipLookup
            };
            
            // Re-resolve all tasks and rebuild tree
            const resolvedTasks = Object.entries(context.tasks).map(([id, task]) => 
              resolveTaskRelationships(task, updatedRelationships)
            );
            
            return buildTaskTree(resolvedTasks);
          }
          return context.taskTree;
        },
        lastUpdatedAt: Date.now()
      },
      
      updateDependencies: {
        dependencies: (context, event: { dependencies: TaskDependency[] }) => {
          const deps: Record<string, TaskDependency> = {};
          event.dependencies.forEach(dep => {
            deps[dep.id] = dep;
          });
          return deps;
        },
        dependencyMap: (context, event) => {
          const deps: Record<string, TaskDependency> = {};
          event.dependencies.forEach(dep => {
            deps[dep.id] = dep;
          });
          return buildDependencyMap(deps);
        },
        criticalPath: (context, event) => {
          const deps: Record<string, TaskDependency> = {};
          event.dependencies.forEach(dep => {
            deps[dep.id] = dep;
          });
          return calculateCriticalPath(context.tasks, deps);
        },
        lastUpdatedAt: Date.now()
      },
      
      deleteTask: {
        tasks: (context, event: { taskId: string }) => {
          if (process.env.NODE_ENV === 'development') {
            fileLog.info('📊 GanttStore: Deleting task', { taskId: event.taskId });
          }
          
          const { [event.taskId]: deleted, ...rest } = context.tasks;
          return rest;
        },
        taskTree: (context, event) => {
          const { [event.taskId]: deleted, ...rest } = context.tasks;
          return buildTaskTree(Object.values(rest));
        },
        taskMap: (context, event) => {
          const map = new Map(context.taskMap);
          map.delete(event.taskId);
          return map;
        },
        dependencies: (context, event) => {
          // Remove dependencies involving this task
          const filtered: Record<string, TaskDependency> = {};
          Object.entries(context.dependencies).forEach(([id, dep]) => {
            if (dep.predecessorId !== event.taskId && dep.successorId !== event.taskId) {
              filtered[id] = dep;
            }
          });
          return filtered;
        },
        dependencyMap: (context, event) => {
          // Rebuild dependency map without deleted task
          const filtered: Record<string, TaskDependency> = {};
          Object.entries(context.dependencies).forEach(([id, dep]) => {
            if (dep.predecessorId !== event.taskId && dep.successorId !== event.taskId) {
              filtered[id] = dep;
            }
          });
          return buildDependencyMap(filtered);
        },
        lastUpdatedAt: Date.now()
      },
      
      toggleTaskExpanded: {
        expandedTasks: (context, event: { taskId: string }) => {
          const expanded = new Set(context.expandedTasks);
          if (expanded.has(event.taskId)) {
            expanded.delete(event.taskId);
          } else {
            expanded.add(event.taskId);
          }
          
          // Persist expanded state
          saveDisplayState(context.projectId || 'global', {
            ...context,
            expandedTasks: Array.from(expanded)
          });
          
          return expanded;
        },
        coordinateMapping: (context, event) => {
          // Recalculate with updated expanded state
          const expanded = new Set(context.expandedTasks);
          if (expanded.has(event.taskId)) {
            expanded.delete(event.taskId);
          } else {
            expanded.add(event.taskId);
          }
          
          return calculateCoordinateMapping({
            taskTree: context.taskTree,
            expandedTasks: expanded,
            visibleDateRange: context.visibleDateRange,
            zoom: context.zoom,
            dayWidth: context.dayWidth,
          });
        }
      },
      
      setSelectedTasks: {
        selectedTasks: (context, event: { taskIds: string[] }) => new Set(event.taskIds)
      },
      
      setVisibleDateRange: {
        visibleDateRange: (context, event: { range: { start: Date; end: Date } }) => {
          // Persist view state
          saveDisplayState(context.projectId || 'global', {
            ...context,
            visibleDateRange: event.range
          });
          return event.range;
        },
        coordinateMapping: (context, event) => {
          // Recalculate with new date range
          return calculateCoordinateMapping({
            taskTree: context.taskTree,
            expandedTasks: context.expandedTasks,
            visibleDateRange: event.range,
            zoom: context.zoom,
            dayWidth: context.dayWidth,
          });
        }
      },
      
      setZoom: {
        zoom: (context, event: { zoom: 'hour' | 'day' | 'week' | 'month'; factor?: number }) => {
          // Persist zoom level
          saveDisplayState(context.projectId || 'global', {
            ...context,
            zoom: event.zoom,
            zoomFactor: event.factor || 1.0
          });
          return event.zoom;
        },
        zoomFactor: (context, event: { zoom: 'hour' | 'day' | 'week' | 'month'; factor?: number }) => {
          return event.factor || 1.0;
        },
        coordinateMapping: (context, event) => {
          // Recalculate with new zoom level and factor
          return calculateCoordinateMapping({
            taskTree: context.taskTree,
            expandedTasks: context.expandedTasks,
            visibleDateRange: context.visibleDateRange,
            zoom: event.zoom,
            zoomFactor: event.factor || 1.0,
            dayWidth: context.dayWidth
          });
        }
      },
      
      setShowWeekends: {
        showWeekends: (context, event: { show: boolean }) => {
          saveDisplayState(context.projectId || 'global', {
            ...context,
            showWeekends: event.show
          });
          return event.show;
        }
      },
      
      setShowDependencies: {
        showDependencies: (context, event: { show: boolean }) => {
          saveDisplayState(context.projectId || 'global', {
            ...context,
            showDependencies: event.show
          });
          return event.show;
        }
      },
      
      setDayWidth: {
        dayWidth: (context, event: { dayWidth: number }) => {
          fileLog.info('📐 GanttStore: setDayWidth handler - updating dayWidth', {
            oldDayWidth: context.dayWidth,
            newDayWidth: event.dayWidth,
            eventType: event.type || 'setDayWidth'
          });
          saveDisplayState(context.projectId || 'global', {
            ...context,
            dayWidth: event.dayWidth
          });
          return event.dayWidth;
        },
        coordinateMapping: (context, event) => {
          fileLog.info('📐 GanttStore: setDayWidth handler - recalculating coordinates', {
            eventDayWidth: event.dayWidth,
            contextDayWidth: context.dayWidth,
            zoom: context.zoom,
            taskCount: context.taskTree.length
          });
          // Recalculate coordinates with new day width
          return calculateCoordinateMapping({
            taskTree: context.taskTree,
            expandedTasks: context.expandedTasks,
            visibleDateRange: context.visibleDateRange,
            zoom: context.zoom,
            dayWidth: event.dayWidth,
          });
        }
      },
      
      setError: {
        error: (context, event: { error: string }) => event.error,
        loading: false
      },
      
      setLoading: {
        loading: (context, event: { loading: boolean }) => event.loading
      },
      
      setPagination: {
        pagination: (context, event: { pagination: typeof context.pagination }) => event.pagination
      }
    }
  });
};

// ====================================
// HELPER FUNCTIONS
// ====================================

/**
 * Build hierarchical task tree from flat task list
 */
function buildTaskTree(tasks: any[]): any[] {
  const taskMap = new Map<string, any>();
  const rootTasks: any[] = [];
  
  // First pass: create map
  tasks.forEach(task => {
    taskMap.set(task.id, { ...task, children: [] });
  });
  
  // Second pass: build hierarchy
  tasks.forEach(task => {
    const taskNode = taskMap.get(task.id)!;
    if (task.parentId) {
      const parent = taskMap.get(task.parentId);
      if (parent) {
        parent.children.push(taskNode);
      } else {
        rootTasks.push(taskNode);
      }
    } else {
      rootTasks.push(taskNode);
    }
  });
  
  // Sort tasks by start date and position
  const sortTasks = (tasks: any[]) => {
    tasks.sort((a, b) => {
      // First by position if available
      if (a.position !== undefined && b.position !== undefined) {
        return a.position - b.position;
      }
      // Then by start date
      const aStart = new Date(a.plannedStartDate || a.createdAt).getTime();
      const bStart = new Date(b.plannedStartDate || b.createdAt).getTime();
      if (aStart !== bStart) return aStart - bStart;
      // Finally by title
      return (a.title || '').localeCompare(b.title || '');
    });
    
    // Recursively sort children
    tasks.forEach(task => {
      if (task.children && task.children.length > 0) {
        sortTasks(task.children);
      }
    });
  };
  
  sortTasks(rootTasks);
  
  return rootTasks;
}

/**
 * Build dependency map for quick lookups
 */
function buildDependencyMap(
  dependencies: Record<string, TaskDependency>
): Map<string, { predecessors: string[]; successors: string[] }> {
  const map = new Map();
  
  Object.values(dependencies).forEach(dep => {
    // Update predecessor task (has successors)
    const predecessorNode = map.get(dep.predecessorId) || { predecessors: [], successors: [] };
    predecessorNode.successors.push(dep.successorId);
    map.set(dep.predecessorId, predecessorNode);
    
    // Update successor task (has predecessors)
    const successorNode = map.get(dep.successorId) || { predecessors: [], successors: [] };
    successorNode.predecessors.push(dep.predecessorId);
    map.set(dep.successorId, successorNode);
  });
  
  return map;
}

/**
 * Calculate critical path using CPM algorithm
 */
function calculateCriticalPath(
  tasks: Record<string, any>,
  dependencies: Record<string, TaskDependency>
): Set<string> {
  const criticalTasks = new Set<string>();
  
  // Build dependency graph
  const depMap = buildDependencyMap(dependencies);
  
  // Calculate early start/finish and late start/finish for each task
  const taskData = new Map<string, {
    earlyStart: number;
    earlyFinish: number;
    lateStart: number;
    lateFinish: number;
    slack: number;
  }>();
  
  // Helper to get task duration in days
  const getTaskDuration = (task: any): number => {
    if (task.duration) return task.duration;
    if (task.plannedStartDate && task.plannedEndDate) {
      const start = new Date(task.plannedStartDate).getTime();
      const end = new Date(task.plannedEndDate).getTime();
      return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    return 1; // Default to 1 day
  };
  
  // Forward pass: calculate early start/finish
  const calculateEarlyTimes = (taskId: string, visited = new Set<string>()): void => {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    
    const task = tasks[taskId];
    if (!task) return;
    
    const duration = getTaskDuration(task);
    const depNode = depMap.get(taskId);
    
    let earlyStart = 0;
    if (depNode && depNode.predecessors.length > 0) {
      // Calculate based on predecessors
      depNode.predecessors.forEach(predId => {
        calculateEarlyTimes(predId, visited);
        const predData = taskData.get(predId);
        if (predData) {
          earlyStart = Math.max(earlyStart, predData.earlyFinish);
        }
      });
    }
    
    taskData.set(taskId, {
      earlyStart,
      earlyFinish: earlyStart + duration,
      lateStart: 0,
      lateFinish: 0,
      slack: 0
    });
  };
  
  // Calculate early times for all tasks
  Object.keys(tasks).forEach(taskId => calculateEarlyTimes(taskId));
  
  // Find project end time
  let projectEnd = 0;
  taskData.forEach(data => {
    projectEnd = Math.max(projectEnd, data.earlyFinish);
  });
  
  // Backward pass: calculate late start/finish
  const calculateLateTimes = (taskId: string, visited = new Set<string>()): void => {
    if (visited.has(taskId)) return;
    visited.add(taskId);
    
    const data = taskData.get(taskId);
    if (!data) return;
    
    const depNode = depMap.get(taskId);
    const duration = getTaskDuration(tasks[taskId]);
    
    let lateFinish = projectEnd;
    if (depNode && depNode.successors.length > 0) {
      // Calculate based on successors
      lateFinish = Infinity;
      depNode.successors.forEach(succId => {
        calculateLateTimes(succId, visited);
        const succData = taskData.get(succId);
        if (succData) {
          lateFinish = Math.min(lateFinish, succData.lateStart);
        }
      });
    }
    
    data.lateFinish = lateFinish;
    data.lateStart = lateFinish - duration;
    data.slack = data.lateStart - data.earlyStart;
  };
  
  // Calculate late times for all tasks
  const lateVisited = new Set<string>();
  Object.keys(tasks).forEach(taskId => calculateLateTimes(taskId, lateVisited));
  
  // Identify critical tasks (slack = 0)
  taskData.forEach((data, taskId) => {
    if (data.slack === 0) {
      criticalTasks.add(taskId);
    }
  });
  
  // Also mark high priority tasks as critical
  Object.values(tasks).forEach(task => {
    if (task.priority === 'critical' || task.priority === 'high') {
      criticalTasks.add(task.id);
    }
  });
  
  return criticalTasks;
}

/**
 * Resolve task relationships (assignee, project, status, tags)
 */
function resolveTaskRelationships(task: any, relationships: any): any {
  const resolved = { ...task };
  
  // Resolve assignee
  if (task.assigneeId && relationships.users?.[task.assigneeId]) {
    const user = relationships.users[task.assigneeId];
    resolved.assigneeName = user.name || user.displayName || user.email;
    resolved.assigneeEmail = user.email;
    resolved.assigneeAvatar = user.avatarUrl;
  }
  
  // Resolve project
  if (task.projectId && relationships.projects?.[task.projectId]) {
    const project = relationships.projects[task.projectId];
    resolved.projectName = project.name;
    resolved.projectColor = project.color;
  }
  
  // Resolve status
  if (task.statusId && relationships.statusDefinitions?.[task.statusId]) {
    const status = relationships.statusDefinitions[task.statusId];
    resolved.statusName = status.name;
    resolved.statusColor = status.color;
    resolved.statusType = status.type;
  }
  
  // Resolve tags (many-to-many)
  if (task.tags && Array.isArray(task.tags) && relationships.tags) {
    resolved.resolvedTags = task.tags
      .map((tagId: string) => relationships.tags[tagId])
      .filter(Boolean)
      .map((tag: any) => ({
        id: tag.id,
        name: tag.name,
        color: tag.color
      }));
  }
  
  return resolved;
}

// ====================================
// INITIAL DATA LOADER
// ====================================

export async function loadInitialGanttData(projectId?: string, domainService?: any) {
  fileLog.info('📊 GanttStore: Loading initial data from IndexedDB', { projectId, domainService });
  
  try {
    // Build query for tasks
    let taskQuery = db.tasks.toCollection();
    if (projectId) {
      taskQuery = db.tasks.where('projectId').equals(projectId);
    }
    
    // Check if we need pagination
    const totalCount = await taskQuery.count();
    const needsPagination = totalCount > MEMORY_LIMITS.MAX_TASKS;
    
    let tasks: any[];
    let paginationInfo = null;
  
    if (needsPagination) {
      // Load first page only
      const pageSize = MEMORY_LIMITS.DEFAULT_PAGE_SIZE;
      tasks = await taskQuery.limit(pageSize).toArray();
      
      paginationInfo = {
        enabled: true,
        currentPage: 0,
        pageSize,
        totalTasks: totalCount,
        totalPages: Math.ceil(totalCount / pageSize)
      };
      
      if (process.env.NODE_ENV === 'development') {
        fileLog.info('📊 GanttStore: Pagination enabled', paginationInfo);
      }
    } else {
      // Load all tasks
      tasks = await taskQuery.toArray();
    }
  
    // Get unique IDs for relationships
    const assigneeIds = [...new Set(tasks.map(t => t.assigneeId).filter(Boolean))];
    const projectIds = [...new Set(tasks.map(t => t.projectId).filter(Boolean))];
    const statusIds = [...new Set(tasks.map(t => t.statusId).filter(Boolean))];
    const parentIds = [...new Set(tasks.map(t => t.parentId).filter(Boolean))];
  
    // Extract tag IDs from junction table
    const taskIds = tasks.map(t => t.id);
    const taskTags = await db.taskTags.where('taskId').anyOf(taskIds).toArray();
    const tagIds = [...new Set(taskTags.map(tt => tt.tagId))];
    
    // Process junction data
    const tagsByTask: Record<string, string[]> = {};
    taskTags.forEach(tt => {
      if (!tagsByTask[tt.taskId]) {
        tagsByTask[tt.taskId] = [];
      }
      tagsByTask[tt.taskId].push(tt.tagId);
    });
  
    // Log before querying dependencies
    fileLog.info('📊 GanttStore: Querying dependencies for task IDs:', taskIds.slice(0, 5), '...');
    
    // Load all relationships in parallel with error handling
    let users = [], projects = [], statusDefs = [], tags = [], dependencies = [];
  
  try {
    [users, projects, statusDefs, tags, dependencies] = await Promise.all([
      assigneeIds.length > 0 ? db.users.where('id').anyOf(assigneeIds).toArray() : [],
      projectIds.length > 0 ? db.projects.where('id').anyOf(projectIds).toArray() : [],
      statusIds.length > 0 ? db.statusDefinitions.where('id').anyOf(statusIds).toArray() : [],
      tagIds.length > 0 ? db.tags.where('id').anyOf(tagIds).toArray() : [],
      taskIds.length > 0 ? entityDependencyService.getTaskDependencies(taskIds) : []
    ]);
  } catch (error) {
    fileLog.error('📊 GanttStore: Error loading relationships from database:', error);
    // Continue with empty arrays - better than crashing
    fileLog.info('📊 GanttStore: Continuing with empty relationship data');
  }
  
  // Log dependency query results
  fileLog.info('📊 GanttStore: Raw dependency query result:', {
    totalFound: dependencies.length,
    firstFew: dependencies.slice(0, 3)
  });
  
  // Build relationship lookups
  const relationships = {
    users: Object.fromEntries(users.map(u => [u.id, u])),
    projects: Object.fromEntries(projects.map(p => [p.id, p])),
    statusDefinitions: Object.fromEntries(statusDefs.map(s => [s.id, s])),
    tags: Object.fromEntries(tags.map(t => [t.id, t]))
  };
  
  // Add tags to tasks and resolve all relationships
  const resolvedTasks: Record<string, any> = {};
  tasks.forEach(task => {
    const taskWithTags = {
      ...task,
      tags: tagsByTask[task.id] || []
    };
    const resolved = resolveTaskRelationships(taskWithTags, relationships);
    resolvedTasks[task.id] = resolved;
  });
  
  // Use dependencies directly in EntityDependency format
  const dependencyMap: Record<string, TaskDependency> = {};
  dependencies.forEach(dep => {
    dependencyMap[dep.id] = {
      id: dep.id,
      entityType: 'Task' as const,
      predecessorId: dep.predecessorId,
      successorId: dep.successorId,
      type: dep.type || 'finish-to-start',
      lagDays: dep.lagDays || 0,
      metadata: dep.metadata,
      description: dep.description
    };
  });
  
  fileLog.info('📊 GanttStore: Initial data loaded', {
    taskCount: Object.keys(resolvedTasks).length,
    dependencyCount: Object.keys(dependencyMap).length,
    relationshipTables: Object.keys(relationships),
    paginationEnabled: needsPagination,
    sampleTasks: Object.values(resolvedTasks).slice(0, 3).map(t => ({ id: t.id, title: t.title }))
  });
  
  // Log task details for debugging
  fileLog.info('📊 GanttStore: Task details for project', projectId);
  Object.values(resolvedTasks).forEach(task => {
    fileLog.info(`  Task: ${task.id} - ${task.title} (project: ${task.projectId})`);
  });
  
  // Log dependency details
  fileLog.info('📊 GanttStore: Dependencies found:', dependencies.length);
  if (dependencies.length > 0) {
    dependencies.forEach(dep => {
      fileLog.info(`  Dep: ${dep.id} - ${dep.predecessorId} -> ${dep.successorId} (type: ${dep.type})`);
    });
  } else {
    fileLog.info('  No dependencies found for tasks in this project');
    fileLog.info('  Task IDs:', taskIds);
  }
  
  return {
    tasks: resolvedTasks,
    dependencies: dependencyMap,
    relationships,
    pagination: paginationInfo
  };
  
  } catch (error) {
    fileLog.error('📊 GanttStore: Critical error loading initial data:', error);
    // Return minimal valid data structure to prevent crashes
    return {
      tasks: {},
      dependencies: {},
      relationships: {
        users: {},
        projects: {},
        statusDefinitions: {},
        tags: {}
      },
      pagination: null
    };
  }
}

// ====================================
// GRANULAR SUBSCRIPTIONS
// ====================================

export function setupGranularGanttSubscriptions(
  storeActor: any,
  projectId?: string,
  domainService?: any
): () => void {
  const subscriptions: Subscription[] = [];
  let initialLoadComplete = false;
  
  // Check if pagination is enabled
  const snapshot = storeActor.getSnapshot();
  if (snapshot?.context?.pagination?.enabled) {
    fileLog.info('📊 GanttStore: Skipping subscriptions - pagination mode');
    return () => {};
  }
  
  fileLog.info('📊 GanttStore: Setting up granular subscriptions', { projectId, domainService });
  
  // Track previous state for change detection
  let previousTasks: Record<string, any> = {};
  let previousDependencies: Record<string, TaskDependency> = {};
  const previousRelationships: Record<string, Record<string, any>> = {};
  
  // Mark as ready after initial load
  setTimeout(() => {
    const snapshot = storeActor.getSnapshot();
    if (snapshot?.context) {
      previousTasks = { ...snapshot.context.tasks };
      previousDependencies = { ...snapshot.context.dependencies };
      Object.keys(snapshot.context.relationships).forEach(table => {
        previousRelationships[table] = { ...snapshot.context.relationships[table] };
      });
    }
    initialLoadComplete = true;
    fileLog.info('📊 GanttStore: Initial load complete, enabling live updates');
  }, 100);
  
  // Subscribe to task changes
  const taskSub = liveQuery(async () => {
    let query = db.tasks.toCollection();
    if (projectId) {
      query = db.tasks.where('projectId').equals(projectId);
    }
    
    const tasks = await query.toArray();
    
    // Get tags from junction table
    const taskIds = tasks.map(t => t.id);
    const taskTags = await db.taskTags.where('taskId').anyOf(taskIds).toArray();
    
    // Process junction data
    const tagsByTask: Record<string, string[]> = {};
    taskTags.forEach(tt => {
      if (!tagsByTask[tt.taskId]) {
        tagsByTask[tt.taskId] = [];
      }
      tagsByTask[tt.taskId].push(tt.tagId);
    });
    
    // Add tags to tasks
    return tasks.map(task => ({
      ...task,
      tags: tagsByTask[task.id] || []
    }));
  }).subscribe({
    next: (tasks) => {
      if (!initialLoadComplete) return;
      
      const storeSnapshot = storeActor.getSnapshot();
      const currentRelationships = storeSnapshot?.context?.relationships || {};
      
      // Resolve and detect changes
      const currentTaskMap: Record<string, any> = {};
      tasks.forEach(task => {
        const resolved = resolveTaskRelationships(task, currentRelationships);
        currentTaskMap[task.id] = resolved;
      });
      
      // Detect changes
      const changedIds: string[] = [];
      const addedIds: string[] = [];
      const deletedIds: string[] = [];
      
      // Check for additions and modifications
      Object.entries(currentTaskMap).forEach(([taskId, resolved]) => {
        const previous = previousTasks[taskId];
        if (!previous) {
          addedIds.push(taskId);
          storeActor.send({ type: 'updateTask', task: resolved });
        } else if (JSON.stringify(previous) !== JSON.stringify(resolved)) {
          changedIds.push(taskId);
          storeActor.send({ type: 'updateTask', task: resolved });
        }
      });
      
      // Check for deletions
      Object.keys(previousTasks).forEach(taskId => {
        if (!currentTaskMap[taskId]) {
          deletedIds.push(taskId);
          storeActor.send({ type: 'deleteTask', taskId });
        }
      });
      
      if (addedIds.length > 0 || changedIds.length > 0 || deletedIds.length > 0) {
        fileLog.info('📊 GanttStore: Task updates detected', {
          added: addedIds.length,
          changed: changedIds.length,
          deleted: deletedIds.length
        });
      }
      
      previousTasks = currentTaskMap;
    },
    error: (error) => {
      fileLog.error('❌ GanttStore: Task subscription error', error);
      storeActor.send({ type: 'setError', error: error.message });
    }
  });
  
  subscriptions.push(taskSub);
  
  // Subscribe to dependency changes
  const depSub = liveQuery(async () => {
    let dependencies = await db.entityDependencies // Use camelCase for Dexie v11+
      .where('entityType')
      .equals('Task')
      .toArray();
    
    if (projectId) {
      const projectTasks = await db.tasks.where('projectId').equals(projectId).toArray();
      const projectTaskIds = new Set(projectTasks.map(t => t.id));
      
      dependencies = dependencies.filter(dep => 
        projectTaskIds.has(dep.predecessorId) || projectTaskIds.has(dep.successorId)
      );
    }
    
    return dependencies;
  }).subscribe({
    next: (dependencies) => {
      if (!initialLoadComplete) return;
      
      // Use dependencies directly in EntityDependency format
      const depMap: Record<string, TaskDependency> = {};
      dependencies.forEach(dep => {
        depMap[dep.id] = {
          id: dep.id,
          entityType: 'Task' as const,
          predecessorId: dep.predecessorId,
          successorId: dep.successorId,
          type: dep.type || 'finish-to-start',
          lagDays: dep.lagDays || 0,
          metadata: dep.metadata,
          description: dep.description
        };
      });
      
      // Detect changes
      if (JSON.stringify(previousDependencies) !== JSON.stringify(depMap)) {
        fileLog.info('📊 GanttStore: Dependencies updated', {
          count: Object.keys(depMap).length
        });
        storeActor.send({ 
          type: 'updateDependencies', 
          dependencies: Object.values(depMap) 
        });
        previousDependencies = depMap;
      }
    },
    error: (error) => {
      fileLog.error('❌ GanttStore: Dependency subscription error', error);
    }
  });
  
  subscriptions.push(depSub);
  
  // Subscribe to relationship tables
  const relationshipTables = [
    { table: 'users', key: 'users' },
    { table: 'projects', key: 'projects' },
    { table: 'status_definitions', key: 'statusDefinitions' },
    { table: 'tags', key: 'tags' }
  ];
  
  relationshipTables.forEach(({ table, key }) => {
    const sub = liveQuery(() => db[table].toArray()).subscribe({
      next: (data) => {
        if (!initialLoadComplete) return;
        
        // Check for changes
        const currentMap: Record<string, any> = {};
        data.forEach((item: any) => {
          currentMap[item.id] = item;
        });
        
        const previousMap = previousRelationships[key] || {};
        if (JSON.stringify(previousMap) !== JSON.stringify(currentMap)) {
          fileLog.info('📊 GanttStore: Relationship updated', { table, count: data.length });
          storeActor.send({ type: 'updateRelationshipTable', table: key, data });
          previousRelationships[key] = currentMap;
        }
      }
    });
    
    subscriptions.push(sub);
  });
  
  // Return cleanup function
  return () => {
    fileLog.info('📊 GanttStore: Cleaning up subscriptions');
    subscriptions.forEach(sub => sub.unsubscribe());
  };
}

// ====================================
// PERSISTENCE HELPERS
// ====================================

const STORAGE_KEY_PREFIX = 'vibegantt_display_';

export function saveDisplayState(projectId: string, state: any) {
  try {
    const key = `${STORAGE_KEY_PREFIX}${projectId}`;
    const displayState = {
      expandedTasks: Array.from(state.expandedTasks || []),
      visibleDateRange: state.visibleDateRange,
      zoom: state.zoom,
      showWeekends: state.showWeekends,
      showDependencies: state.showDependencies,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem(key, JSON.stringify(displayState));
  } catch (error) {
    fileLog.error('Failed to save gantt display state:', error);
  }
}

export function loadDisplayState(projectId: string): any | null {
  try {
    const key = `${STORAGE_KEY_PREFIX}${projectId}`;
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    fileLog.error('Failed to load gantt display state:', error);
  }
  return null;
}

// ====================================
// FACTORY FUNCTION
// ====================================

export function createGanttStoreActor(projectId?: string, domainService?: any, initialDayWidth: number = 50) {
  if (process.env.NODE_ENV === 'development') {
    fileLog.info('📊 GanttStore: Creating atomic store logic', { projectId });
  }
  
  return createGanttStoreLogic(projectId, domainService, initialDayWidth);
}