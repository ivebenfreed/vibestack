/**
 * Local Dexie Schema - Replacement for @repo/dataforge/dexie-schema
 * 
 * This provides basic database structure for the web app to prevent import errors.
 * This is a minimal implementation to get the app running.
 */

import Dexie, { Table } from 'dexie';

// Basic entity interfaces
export interface Task {
  id: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee_id?: string;
  project_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  organization_id?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  owner_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  organization_id?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface Comment {
  id: string;
  content: string;
  author_id: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface EntityDependency {
  id: string;
  parent_entity_type: string;
  parent_entity_id: string;
  child_entity_type: string;
  child_entity_id: string;
  dependency_type: string;
  created_at: string;
  organization_id?: string;
}

export interface LocalChanges {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  lsn: string;
  clientSequence: string;
  clientId: string;
  updatedAt: Date;
  processedSync: number;
  sendAttempts?: number;
  lastSendAttempt?: Date;
  lastError?: string;
}

export interface StatusDefinition {
  id: string;
  name: string;
  color?: string;
  entity_type: string;
  sort_order?: number;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface TagSet {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

export interface StatusSet {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  organization_id?: string;
}

// Dexie Database Class
class VibeStackDatabase extends Dexie {
  // Entity tables
  tasks!: Table<Task>;
  projects!: Table<Project>;
  users!: Table<User>;
  comments!: Table<Comment>;
  entity_dependencies!: Table<EntityDependency>;
  
  // System tables
  local_changes!: Table<LocalChanges>;
  status_definitions!: Table<StatusDefinition>;
  tags!: Table<Tag>;
  tag_sets!: Table<TagSet>;
  status_sets!: Table<StatusSet>;

  constructor() {
    super('VibeStackDB');
    
    // Version 1 - Original schema
    this.version(1).stores({
      // Entity tables
      tasks: '++id, title, status, priority, assignee_id, project_id, due_date, created_at, updated_at, organization_id',
      projects: '++id, name, status, owner_id, created_at, updated_at, organization_id',
      users: '++id, name, email, role, created_at, updated_at, organization_id',
      comments: '++id, content, author_id, entity_type, entity_id, created_at, updated_at, organization_id',
      entity_dependencies: '++id, parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, dependency_type, created_at, organization_id',
      
      // System tables - old schema
      local_changes: '++id, table_name, entity_id, operation, created_at, synced, organization_id',
      status_definitions: '++id, name, entity_type, sort_order, created_at, updated_at, organization_id',
      tags: '++id, name, created_at, updated_at, organization_id',
      tag_sets: '++id, name, created_at, updated_at, organization_id',
      status_sets: '++id, name, created_at, updated_at, organization_id',
    });
    
    // Version 2 - Updated LocalChanges schema for proper sync support
    this.version(2).stores({
      // Entity tables
      tasks: '++id, title, status, priority, assignee_id, project_id, due_date, created_at, updated_at, organization_id',
      projects: '++id, name, status, owner_id, created_at, updated_at, organization_id',
      users: '++id, name, email, role, created_at, updated_at, organization_id',
      comments: '++id, content, author_id, entity_type, entity_id, created_at, updated_at, organization_id',
      entity_dependencies: '++id, parent_entity_type, parent_entity_id, child_entity_type, child_entity_id, dependency_type, created_at, organization_id',
      
      // System tables - updated schema
      local_changes: '++id, table, operation, processedSync, clientSequence, clientId, updatedAt, lsn',
      status_definitions: '++id, name, entity_type, sort_order, created_at, updated_at, organization_id',
      tags: '++id, name, created_at, updated_at, organization_id',
      tag_sets: '++id, name, created_at, updated_at, organization_id',
      status_sets: '++id, name, created_at, updated_at, organization_id',
    });
  }
}

// Create and export the database instance
export const db = new VibeStackDatabase();

// Export individual tables for convenience
export const {
  tasks,
  projects,
  users,
  comments,
  entity_dependencies,
  local_changes,
  status_definitions,
  tags,
  tag_sets,
  status_sets
} = db;

// Default export
export default db;

// Re-export constants from client-entities for compatibility
export { 
  CLIENT_DOMAIN_TABLES, 
  ENTITY_TABLES, 
  JUNCTION_TABLES, 
  SYSTEM_TABLES,
  CLIENT_DOMAIN_TABLE_HIERARCHY,
  CLIENT_JUNCTION_TABLE_MAPPING,
  CLIENT_JUNCTION_TABLES
} from './client-entities';

// Additional constants that may be needed
export const DEXIE_TO_DB_TABLE_MAP = {
  tasks: 'tasks',
  projects: 'projects',
  users: 'users',
  comments: 'comments',
  entity_dependencies: 'entity_dependencies',
  local_changes: 'local_changes',
  status_definitions: 'status_definitions',
  tags: 'tags',
  tag_sets: 'tag_sets',
  status_sets: 'status_sets'
} as const;