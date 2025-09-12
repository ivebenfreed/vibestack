/**
 * Kysely Entity Configuration
 * 
 * Maps entity names to their table names and optional business methods
 */

// TODO: Replace with server-only types when DataForge is moved
// import type { TableName } from '@repo/dataforge/kysely-types';
type TableName = string;
import type { KyselyEntityConfig } from './KyselyGenericApiAdapter';

// Entity-specific business logic methods can be defined here
const taskMethods = {
  // Example custom methods:
  // transitionStatus: async (params: { taskId: string, newStatus: string }, db) => {
  //   // Custom business logic for status transitions
  // },
  // bulkAssign: async (params: { taskIds: string[], assigneeId: string }, db) => {
  //   // Bulk assignment logic
  // }
};

const projectMethods = {
  // addMembers: async (params: { projectId: string, userIds: string[] }, db) => {
  //   // Add multiple members to project
  // }
};

// Map of entity names to their configurations
export const kyselyEntityConfigs: Record<string, KyselyEntityConfig> = {
  // Core entities
  task: {
    tableName: 'tasks' as TableName,
    entityMethods: taskMethods,
  },
  project: {
    tableName: 'projects' as TableName,
    entityMethods: projectMethods,
  },
  user: {
    tableName: 'users' as TableName,
    entityMethods: {},
  },
  comment: {
    tableName: 'comments' as TableName,
    entityMethods: {},
  },
  
  // Tag system
  tag: {
    tableName: 'tag' as TableName,
    entityMethods: {},
  },
  tagSet: {
    tableName: 'tag_set' as TableName,
    entityMethods: {},
  },
  
  // Status system
  statusSet: {
    tableName: 'status_set' as TableName,
    entityMethods: {},
  },
  statusDefinition: {
    tableName: 'status_definition' as TableName,
    entityMethods: {},
  },
  
  // System entities
  entityDependency: {
    tableName: 'entity_dependencies' as TableName,
    entityMethods: {},
  },
  
  // Junction tables (if needed for direct access)
  taskTag: {
    tableName: 'task_tags' as TableName,
    entityMethods: {},
  },
  projectTagSet: {
    tableName: 'project_tag_sets' as TableName,
    entityMethods: {},
  },
  projectStatusSet: {
    tableName: 'project_status_sets' as TableName,
    entityMethods: {},
  },
};

/**
 * Get entity config by name
 */
export function getKyselyEntityConfig(entityName: string): KyselyEntityConfig | undefined {
  return kyselyEntityConfigs[entityName];
}

/**
 * Check if entity exists
 */
export function isValidEntity(entityName: string): boolean {
  return entityName in kyselyEntityConfigs;
}