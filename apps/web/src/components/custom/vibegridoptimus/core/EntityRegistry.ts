/**
 * EntityRegistry - Type-safe entity name to type mapping for VibeGridOptimus
 * 
 * This replaces the complex generic system with a simple declarative approach
 */

import type { Project, Task, User, Comment } from '@repo/dataforge/client-entities'

/**
 * Registry of all available entities
 */
export interface EntityRegistry {
  Project: Project
  Task: Task
  User: User
  Comment: Comment
}

/**
 * Entity names as a union type
 */
export type EntityName = keyof EntityRegistry

/**
 * Get entity type from entity name
 */
export type EntityType<T extends EntityName> = EntityRegistry[T]

/**
 * Type guard to check if a string is a valid entity name
 */
export function isValidEntityName(name: string): name is EntityName {
  return ['Project', 'Task', 'User', 'Comment'].includes(name)
}

/**
 * Get all entity names
 */
export function getAllEntityNames(): EntityName[] {
  return ['Project', 'Task', 'User', 'Comment']
}

/**
 * Entity metadata for runtime configuration
 */
export const ENTITY_METADATA: Record<EntityName, {
  displayName: string
  pluralName: string
  defaultSort?: string
  searchableFields?: string[]
}> = {
  Project: {
    displayName: 'Project',
    pluralName: 'Projects',
    defaultSort: 'name',
    searchableFields: ['name', 'description']
  },
  Task: {
    displayName: 'Task',
    pluralName: 'Tasks',
    defaultSort: 'createdAt',
    searchableFields: ['title', 'description']
  },
  User: {
    displayName: 'User',
    pluralName: 'Users',
    defaultSort: 'name',
    searchableFields: ['name', 'email']
  },
  Comment: {
    displayName: 'Comment',
    pluralName: 'Comments',
    defaultSort: 'createdAt',
    searchableFields: ['content']
  }
}