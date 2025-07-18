/**
 * React hooks for live queries using Dexie
 * 
 * These hooks provide reactive data fetching that automatically updates
 * when the underlying data changes, similar to PGLite live queries.
 */

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@repo/dataforge/dexie-schema';
import type { Task, Project, User, StatusDefinition, Tag } from '@repo/dataforge/client-entities';
import React from 'react';

/**
 * Hook to get live tasks with optional filtering
 */
export function useLiveTasks(filters?: {
  projectId?: string;
  assigneeId?: string;
  status?: string;
}) {
  return useLiveQuery(
    async () => {
      let query = db.tasks.toCollection();

      // Apply filters
      if (filters?.projectId) {
        query = db.tasks.where('projectId').equals(filters.projectId);
      } else if (filters?.assigneeId) {
        query = db.tasks.where('assigneeId').equals(filters.assigneeId);
      }

      let tasks = await query.toArray();

      // Additional filtering that can't be done with indexes
      if (filters?.status && !filters?.projectId && !filters?.assigneeId) {
        tasks = tasks.filter(t => t.statusId === filters.status);
      }

      return tasks;
    },
    [filters?.projectId, filters?.assigneeId, filters?.status]
  );
}

/**
 * Hook to get tasks with all their relationships loaded
 * This is more efficient than loading relationships individually
 */
export function useLiveTasksWithRelations(projectId?: string) {
  return useLiveQuery(
    async () => {
      // Get tasks
      const query = projectId
        ? db.tasks.where('projectId').equals(projectId)
        : db.tasks.toCollection();
      
      const tasks = await query.toArray();
      
      // Collect all unique foreign key IDs
      const userIds = new Set<string>();
      const projectIds = new Set<string>();
      const statusIds = new Set<string>();
      
      tasks.forEach(task => {
        if (task.assigneeId) userIds.add(task.assigneeId);
        if (task.projectId) projectIds.add(task.projectId);
        if (task.statusId) statusIds.add(task.statusId);
      });

      // Batch load all related entities
      const [users, projects, statuses] = await Promise.all([
        db.users.bulkGet(Array.from(userIds)),
        db.projects.bulkGet(Array.from(projectIds)),
        db.status_definitions.bulkGet(Array.from(statusIds))
      ]);

      // Create lookup maps
      const userMap = new Map<string, User>();
      const projectMap = new Map<string, Project>();
      const statusMap = new Map<string, StatusDefinition>();

      users.forEach(user => {
        if (user) userMap.set(user.id, user);
      });
      projects.forEach(project => {
        if (project) projectMap.set(project.id, project);
      });
      statuses.forEach(status => {
        if (status) statusMap.set(status.id, status);
      });

      // Load tags for all tasks
      const taskIds = tasks.map(t => t.id);
      const taskTags = await db.task_tags
        .where('taskId')
        .anyOf(taskIds)
        .toArray();

      // Group tags by task
      const taskTagsMap = new Map<string, string[]>();
      taskTags.forEach(tt => {
        const tags = taskTagsMap.get(tt.taskId) || [];
        tags.push(tt.tagId);
        taskTagsMap.set(tt.taskId, tags);
      });

      // Load all tags
      const allTagIds = new Set<string>();
      taskTags.forEach(tt => allTagIds.add(tt.tagId));
      const tags = await db.tags.bulkGet(Array.from(allTagIds));
      const tagMap = new Map<string, Tag>();
      tags.forEach(tag => {
        if (tag) tagMap.set(tag.id, tag);
      });

      // Enhance tasks with relationships
      return tasks.map(task => ({
        ...task,
        assignee: task.assigneeId ? userMap.get(task.assigneeId) : undefined,
        project: task.projectId ? projectMap.get(task.projectId) : undefined,
        status: task.statusId ? statusMap.get(task.statusId) : undefined,
        tags: (taskTagsMap.get(task.id) || [])
          .map(tagId => tagMap.get(tagId))
          .filter((tag): tag is Tag => tag !== undefined)
      }));
    },
    [projectId]
  );
}

/**
 * Hook to get a single task with live updates
 */
export function useLiveTask(taskId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!taskId) return undefined;
      return await db.tasks.get(taskId);
    },
    [taskId]
  );
}

/**
 * Hook to get task statistics
 */
export function useLiveTaskStats() {
  return useLiveQuery(async () => {
    const tasks = await db.tasks.toArray();
    
    const stats = {
      total: tasks.length,
      byStatus: new Map<string, number>(),
      byProject: new Map<string, number>(),
      byAssignee: new Map<string, number>(),
      overdue: 0,
      completed: 0
    };

    const now = new Date();

    tasks.forEach(task => {
      // By status
      if (task.statusId) {
        stats.byStatus.set(
          task.statusId,
          (stats.byStatus.get(task.statusId) || 0) + 1
        );
      }

      // By project
      if (task.projectId) {
        stats.byProject.set(
          task.projectId,
          (stats.byProject.get(task.projectId) || 0) + 1
        );
      }

      // By assignee
      if (task.assigneeId) {
        stats.byAssignee.set(
          task.assigneeId,
          (stats.byAssignee.get(task.assigneeId) || 0) + 1
        );
      }

      // Overdue
      if (task.dueDate && new Date(task.dueDate) < now && !task.completedAt) {
        stats.overdue++;
      }

      // Completed
      if (task.completedAt) {
        stats.completed++;
      }
    });

    return stats;
  });
}

/**
 * Hook for cross-tab live updates
 * This demonstrates Dexie's built-in cross-tab reactivity
 */
export function useLiveTaskCount() {
  return useLiveQuery(
    async () => {
      const count = await db.tasks.count();
      
      // This will automatically update across all tabs/windows
      // when tasks are added/removed in any tab
      return count;
    }
  );
}

/**
 * Hook to monitor sync status
 * This could be used to show sync indicators in the UI
 */
export function useDexieSyncStatus() {
  const [syncStatus, setSyncStatus] = React.useState<{
    isOnline: boolean;
    pendingChanges: number;
    lastSync: Date | null;
  }>({
    isOnline: navigator.onLine,
    pendingChanges: 0,
    lastSync: null
  });

  React.useEffect(() => {
    // Monitor online status
    const handleOnline = () => setSyncStatus(s => ({ ...s, isOnline: true }));
    const handleOffline = () => setSyncStatus(s => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return syncStatus;
}

/**
 * Hook to get all tags
 */
export function useLiveTags() {
  return useLiveQuery(
    async () => {
      return await db.tags.toArray();
    }
  );
}

/**
 * Hook to get all tag sets
 */
export function useLiveTagSets() {
  return useLiveQuery(
    async () => {
      return await db.tag_sets.toArray();
    }
  );
}

/**
 * Hook to get all status definitions
 */
export function useLiveStatusDefinitions() {
  return useLiveQuery(
    async () => {
      return await db.status_definitions.toArray();
    }
  );
}

/**
 * Hook to get all status sets
 */
export function useLiveStatusSets() {
  return useLiveQuery(
    async () => {
      return await db.status_sets.toArray();
    }
  );
}

/**
 * Hook to get tags for a specific task
 */
export function useLiveTaskTags(taskId: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!taskId) return [];
      
      const taskTags = await db.task_tags
        .where('taskId')
        .equals(taskId)
        .toArray();
      
      const tagIds = taskTags.map(tt => tt.tagId);
      const tags = await db.tags.bulkGet(tagIds);
      
      return tags.filter((tag): tag is Tag => tag !== undefined);
    },
    [taskId]
  );
}