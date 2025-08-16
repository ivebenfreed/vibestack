/**
 * Client Entities - Replacement for @repo/dataforge/client-entities
 * 
 * Basic entity definitions for client-side use
 */

// Re-export types from dexie-schema
export type {
  Task,
  Project, 
  User,
  Comment,
  EntityDependency,
  LocalChanges,
  StatusDefinition,
  Tag,
  TagSet,
  StatusSet
} from './dexie-schema';

// Entity type constants
export const ENTITY_TYPES = {
  TASK: 'task',
  PROJECT: 'project',
  USER: 'user',
  COMMENT: 'comment',
  ENTITY_DEPENDENCY: 'entity_dependency',
  STATUS_DEFINITION: 'status_definition',
  TAG: 'tag',
  TAG_SET: 'tag_set',
  STATUS_SET: 'status_set',
} as const;

// Entity table names
export const TABLE_NAMES = {
  TASKS: 'tasks',
  PROJECTS: 'projects',
  USERS: 'users',
  COMMENTS: 'comments',
  ENTITY_DEPENDENCIES: 'entity_dependencies',
  LOCAL_CHANGES: 'local_changes',
  STATUS_DEFINITIONS: 'status_definitions',
  TAGS: 'tags',
  TAG_SETS: 'tag_sets',
  STATUS_SETS: 'status_sets',
} as const;

// Operation types for sync
export const OPERATION_TYPES = {
  INSERT: 'insert',
  UPDATE: 'update', 
  DELETE: 'delete',
} as const;

// Status types
export const STATUS_TYPES = {
  TODO: 'todo',
  IN_PROGRESS: 'in_progress',
  DONE: 'done',
  BLOCKED: 'blocked',
} as const;

// Priority types
export const PRIORITY_TYPES = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const;

// Domain table lists for sync and storage operations
export const CLIENT_DOMAIN_TABLES = [
  'tasks',
  'projects', 
  'users',
  'comments',
  'entity_dependencies',
  'status_definitions',
  'tags',
  'tag_sets',
  'status_sets'
] as const;

export const ENTITY_TABLES = CLIENT_DOMAIN_TABLES;
export const JUNCTION_TABLES: string[] = [];
export const SYSTEM_TABLES = ['local_changes'] as const;

// Table hierarchy for dependency resolution
export const CLIENT_DOMAIN_TABLE_HIERARCHY = {
  users: 0,
  status_definitions: 1,
  tags: 1,
  tag_sets: 1,
  status_sets: 1,
  projects: 2,
  tasks: 3,
  comments: 4,
  entity_dependencies: 4
} as const;

// Junction table mapping (empty for now)
export const CLIENT_JUNCTION_TABLE_MAPPING = {} as const;

// Junction tables list (empty for now)
export const CLIENT_JUNCTION_TABLES: string[] = [];

// Additional type definitions for domain services
export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'blocked';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

// Input types for domain operations
export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee_id?: string;
  project_id?: string;
  due_date?: string;
  organization_id?: string;
}

export interface UpdateTaskInput extends Partial<CreateTaskInput> {
  id: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  owner_id?: string;
  organization_id?: string;
}

export interface UpdateProjectInput extends Partial<CreateProjectInput> {
  id: string;
}

export interface CreateUserInput {
  name: string;
  email: string;
  role?: string;
  organization_id?: string;
}

export interface UpdateUserInput extends Partial<CreateUserInput> {
  id: string;
}

// Additional type definitions for all domain services
export enum ProjectStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive', 
  COMPLETED = 'completed',
  ARCHIVED = 'archived'
}

export interface CreateCommentInput {
  content: string;
  author_id: string;
  entity_type: string;
  entity_id: string;
  organization_id?: string;
}

export interface UpdateCommentInput extends Partial<CreateCommentInput> {
  id: string;
}

export interface CreateStatusDefinitionInput {
  name: string;
  color?: string;
  entity_type: string;
  sort_order?: number;
  organization_id?: string;
}

export interface UpdateStatusDefinitionInput extends Partial<CreateStatusDefinitionInput> {
  id: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
  organization_id?: string;
}

export interface UpdateTagInput extends Partial<CreateTagInput> {
  id: string;
}

export interface CreateTagSetInput {
  name: string;
  description?: string;
  organization_id?: string;
}

export interface UpdateTagSetInput extends Partial<CreateTagSetInput> {
  id: string;
}

export interface CreateStatusSetInput {
  name: string;
  description?: string;
  organization_id?: string;
}

export interface UpdateStatusSetInput extends Partial<CreateStatusSetInput> {
  id: string;
}

// Relationship context types for domain services
export interface StatusDefinitionRelationshipContext {
  entityType?: string;
}

export interface TagRelationshipContext {
  tagSetId?: string;
}