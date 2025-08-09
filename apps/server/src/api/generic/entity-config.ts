/**
 * Entity Configuration for Generic API
 * 
 * Maps entity names to their Drizzle tables and optional business methods
 */

import {
  tasks,
  projects, 
  users,
  comments,
  tags,
  status_definitions,
  status_sets,
  tag_sets
} from '@repo/dataforge/drizzle-schema';
import type { GenericApiConfig } from './GenericApiFactory';

/**
 * Generated business methods would go here
 * TODO: Generate these from MikroORM entities in dataforge-next
 */
const taskBusinessMethods = {
  // Example of what could be generated:
  // transitionStatus: async (params: { taskId: string, newStatus: string }, drizzleService) => {
  //   // Complex business logic for status transitions
  // },
  // bulkAssign: async (params: { taskIds: string[], assigneeId: string }, drizzleService) => {
  //   // Bulk assignment logic
  // }
};

const projectBusinessMethods = {
  // addMember: async (params: { projectId: string, userId: string, role: string }, drizzleService) => {
  //   // Add project member with validation
  // },
  // getProjectStats: async (params: { projectId: string }, drizzleService) => {
  //   // Calculate project statistics
  // }
};

/**
 * Main entity configuration
 * Maps entity names to their Drizzle tables and business methods
 */
export const entityConfig: GenericApiConfig = {
  entities: {
    // Core domain entities
    tasks: {
      name: 'tasks',
      table: tasks,
      businessMethods: taskBusinessMethods
    },
    projects: {
      name: 'projects', 
      table: projects,
      businessMethods: projectBusinessMethods
    },
    users: {
      name: 'users',
      table: users,
      // No custom business methods yet - just CRUD
    },
    comments: {
      name: 'comments',
      table: comments,
    },
    
    // Configuration entities
    tags: {
      name: 'tags',
      table: tags,
    },
    tagSets: {
      name: 'tagSets',
      table: tag_sets,
    },
    statusDefinitions: {
      name: 'statusDefinitions', 
      table: status_definitions,
    },
    statusSets: {
      name: 'statusSets',
      table: status_sets,
    }
  }
};

/**
 * Helper to get entity names for validation
 */
export const supportedEntities = Object.keys(entityConfig.entities);

/**
 * Helper to check if entity is supported
 */
export function isEntitySupported(entityName: string): boolean {
  return supportedEntities.includes(entityName);
}