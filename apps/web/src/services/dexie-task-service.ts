/**
 * Example Task Service using Dexie
 * 
 * This demonstrates how to use the auto-generated Dexie schema from DataForge
 * for local data management while maintaining sync compatibility.
 */

import { db, type TableName } from '@repo/dataforge/dexie-schema';
import type { Task, Tag } from '@repo/dataforge/client-entities';
import type { TableChange, RelationshipUpdate } from '@repo/sync-types';

/**
 * Task service using Dexie for local storage
 */
export const dexieTaskService = {
  /**
   * Get a task by ID
   */
  async get(id: string): Promise<Task | undefined> {
    return await db.tasks.get(id);
  },

  /**
   * Get all tasks
   */
  async getAll(): Promise<Task[]> {
    return await db.tasks.toArray();
  },

  /**
   * Get tasks by project
   */
  async getByProject(projectId: string): Promise<Task[]> {
    return await db.tasks.where('projectId').equals(projectId).toArray();
  },

  /**
   * Get tasks with all relationships loaded
   */
  async getWithRelations(id: string): Promise<Task & {
    assignee?: any;
    project?: any;
    status?: any;
    tags: Tag[];
    dependencies: Task[];
  } | undefined> {
    const task = await db.tasks.get(id);
    if (!task) return undefined;

    // Load relationships in parallel
    const [assignee, project, status, tags, dependencies] = await Promise.all([
      task.assigneeId ? db.users.get(task.assigneeId) : undefined,
      task.projectId ? db.projects.get(task.projectId) : undefined,
      task.statusId ? db.statusDefinitions.get(task.statusId) : undefined,
      this.loadTags(id),
      this.loadDependencies(id)
    ]);

    return {
      ...task,
      assignee,
      project,
      status,
      tags,
      dependencies
    };
  },

  /**
   * Save a task
   */
  async save(task: Task): Promise<void> {
    await db.tasks.put(task);
  },

  /**
   * Save a task with its relationships
   */
  async saveWithRelations(
    task: Task,
    tagIds?: string[],
    dependencyIds?: string[]
  ): Promise<void> {
    await db.transaction('rw', db.tasks, db.taskTags, db.taskDependencies, async () => {
      // Save the main entity
      await db.tasks.put(task);

      // Update tags if provided
      if (tagIds !== undefined) {
        await db.taskTags.where('taskId').equals(task.id).delete();
        if (tagIds.length > 0) {
          await db.taskTags.bulkAdd(
            tagIds.map(tagId => ({ taskId: task.id, tagId }))
          );
        }
      }

      // Update dependencies if provided
      if (dependencyIds !== undefined) {
        await db.taskDependencies.where('dependentTaskId').equals(task.id).delete();
        if (dependencyIds.length > 0) {
          await db.taskDependencies.bulkAdd(
            dependencyIds.map(depId => ({
              dependentTaskId: task.id,
              dependencyTaskId: depId
            }))
          );
        }
      }
    });
  },

  /**
   * Delete a task
   */
  async delete(id: string): Promise<void> {
    await db.transaction('rw', db.tasks, db.taskTags, db.taskDependencies, async () => {
      // Delete the task
      await db.tasks.delete(id);
      
      // Clean up relationships
      await db.taskTags.where('taskId').equals(id).delete();
      await db.taskDependencies.where('dependentTaskId').equals(id).delete();
      await db.taskDependencies.where('dependencyTaskId').equals(id).delete();
    });
  },

  /**
   * Load tags for a task
   */
  async loadTags(taskId: string): Promise<Tag[]> {
    const junctions = await db.taskTags.where('taskId').equals(taskId).toArray();
    const tagIds = junctions.map(j => j.tagId);
    const tags = await db.tags.bulkGet(tagIds);
    return tags.filter((tag): tag is Tag => tag !== undefined);
  },

  /**
   * Load dependencies for a task
   */
  async loadDependencies(taskId: string): Promise<Task[]> {
    const junctions = await db.taskDependencies
      .where('dependentTaskId')
      .equals(taskId)
      .toArray();
    const depIds = junctions.map(j => j.dependencyTaskId);
    const tasks = await db.tasks.bulkGet(depIds);
    return tasks.filter((task): task is Task => task !== undefined);
  },

  /**
   * Apply an incoming change from sync
   */
  async applyChange(change: TableChange): Promise<void> {
    const { operation, data, relationshipUpdates } = change;

    if (operation === 'delete') {
      await this.delete(data.id as string);
    } else {
      // Insert or update
      await db.tasks.put(data as Task);

      // Handle relationship updates if present
      if (relationshipUpdates) {
        for (const update of relationshipUpdates) {
          await this.applyRelationshipUpdate(data.id as string, update);
        }
      }
    }
  },

  /**
   * Apply a relationship update
   */
  async applyRelationshipUpdate(
    taskId: string,
    update: RelationshipUpdate
  ): Promise<void> {
    if (update.relationName === 'tags') {
      switch (update.operation) {
        case 'set':
          // Replace all tags
          await db.taskTags.where('taskId').equals(taskId).delete();
          if (update.targetIds.length > 0) {
            await db.taskTags.bulkAdd(
              update.targetIds.map(tagId => ({ taskId, tagId }))
            );
          }
          break;

        case 'add':
          // Add new tags
          await db.taskTags.bulkAdd(
            update.targetIds.map(tagId => ({ taskId, tagId }))
          );
          break;

        case 'remove':
          // Remove specific tags
          for (const tagId of update.targetIds) {
            await db.taskTags
              .where('[taskId+tagId]')
              .equals([taskId, tagId])
              .delete();
          }
          break;
      }
    } else if (update.relationName === 'dependencies') {
      // Similar logic for dependencies
      switch (update.operation) {
        case 'set':
          await db.taskDependencies.where('dependentTaskId').equals(taskId).delete();
          if (update.targetIds.length > 0) {
            await db.taskDependencies.bulkAdd(
              update.targetIds.map(depId => ({
                dependentTaskId: taskId,
                dependencyTaskId: depId
              }))
            );
          }
          break;

        case 'add':
          await db.taskDependencies.bulkAdd(
            update.targetIds.map(depId => ({
              dependentTaskId: taskId,
              dependencyTaskId: depId
            }))
          );
          break;

        case 'remove':
          for (const depId of update.targetIds) {
            await db.taskDependencies
              .where('[dependentTaskId+dependencyTaskId]')
              .equals([taskId, depId])
              .delete();
          }
          break;
      }
    }
  }
};

/**
 * Generic function to apply incoming changes to any table
 */
export async function applyIncomingChange(change: TableChange): Promise<void> {
  const { table, operation, data, relationshipUpdates } = change;

  // Get the correct Dexie table
  const dexieTable = db.table(table as TableName);
  if (!dexieTable) {
    console.error(`Unknown table: ${table}`);
    return;
  }

  if (operation === 'delete') {
    await dexieTable.delete(data.id);
  } else {
    // Insert or update - data is already in TypeORM entity format
    await dexieTable.put(data);
  }

  // Handle relationship updates if present
  if (relationshipUpdates && relationshipUpdates.length > 0) {
    await applyRelationshipUpdates(table as TableName, data.id as string, relationshipUpdates);
  }
}

/**
 * Apply relationship updates for any entity
 */
async function applyRelationshipUpdates(
  tableName: TableName,
  entityId: string,
  updates: RelationshipUpdate[]
): Promise<void> {
  for (const update of updates) {
    // Map table + relation to junction table
    const junctionTableName = getJunctionTableName(tableName, update.relationName);
    if (!junctionTableName) continue;

    const junctionTable = db.table(junctionTableName);
    const entityField = getEntityField(tableName);
    const targetField = getTargetField(update.relationName);

    switch (update.operation) {
      case 'set':
        // Replace all relationships
        await junctionTable.where(entityField).equals(entityId).delete();
        if (update.targetIds.length > 0) {
          await junctionTable.bulkAdd(
            update.targetIds.map(targetId => ({
              [entityField]: entityId,
              [targetField]: targetId
            }))
          );
        }
        break;

      case 'add':
        // Add new relationships
        await junctionTable.bulkAdd(
          update.targetIds.map(targetId => ({
            [entityField]: entityId,
            [targetField]: targetId
          }))
        );
        break;

      case 'remove':
        // Remove specific relationships
        for (const targetId of update.targetIds) {
          await junctionTable
            .where(`[${entityField}+${targetField}]`)
            .equals([entityId, targetId])
            .delete();
        }
        break;
    }
  }
}

// Helper functions for relationship mapping
function getJunctionTableName(tableName: TableName, relationName: string): TableName | null {
  const mapping: Record<string, TableName> = {
    'tasks.tags': 'task_tags',
    'tasks.dependencies': 'task_dependencies',
    'projects.members': 'project_members',
    'projects.statusSets': 'project_status_sets',
    'projects.tagSets': 'project_tag_sets'
  };
  
  return mapping[`${tableName}.${relationName}`] || null;
}

function getEntityField(tableName: TableName): string {
  // Convert plural table name to singular field name
  const singular = tableName.endsWith('ies') 
    ? tableName.slice(0, -3) + 'y'
    : tableName.endsWith('es')
    ? tableName.slice(0, -2)
    : tableName.endsWith('s')
    ? tableName.slice(0, -1)
    : tableName;
  
  return singular + 'Id';
}

function getTargetField(relationName: string): string {
  // Convert relation name to field name
  const singular = relationName.endsWith('ies')
    ? relationName.slice(0, -3) + 'y'
    : relationName.endsWith('es')
    ? relationName.slice(0, -2)
    : relationName.endsWith('s')
    ? relationName.slice(0, -1)
    : relationName;
    
  return singular + 'Id';
}