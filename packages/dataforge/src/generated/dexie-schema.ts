// Generated Dexie schema from MikroORM entities
import Dexie, { type Table } from 'dexie';
import type * as Entities from './client-entities.js';

export interface DexieSchema extends Dexie {
  users: Table<Entities.User>;
  task_tags: Table<Entities.task_tags>;
  tasks: Table<Entities.Task>;
  tag_set: Table<Entities.TagSet>;
  tag: Table<Entities.Tag>;
  status_set: Table<Entities.StatusSet>;
  status_definition: Table<Entities.StatusDefinition>;
  project_tag_sets: Table<Entities.project_tag_sets>;
  project_status_sets: Table<Entities.project_status_sets>;
  projects: Table<Entities.Project>;
  local_changes: Table<Entities.LocalChanges>;
  entity_dependencies: Table<Entities.EntityDependency>;
  comments: Table<Entities.Comment>;
}

class VibeStackDatabase extends Dexie implements DexieSchema {
  users!: Table<Entities.User>;
  task_tags!: Table<Entities.task_tags>;
  tasks!: Table<Entities.Task>;
  tag_set!: Table<Entities.TagSet>;
  tag!: Table<Entities.Tag>;
  status_set!: Table<Entities.StatusSet>;
  status_definition!: Table<Entities.StatusDefinition>;
  project_tag_sets!: Table<Entities.project_tag_sets>;
  project_status_sets!: Table<Entities.project_status_sets>;
  projects!: Table<Entities.Project>;
  local_changes!: Table<Entities.LocalChanges>;
  entity_dependencies!: Table<Entities.EntityDependency>;
  comments!: Table<Entities.Comment>;

  constructor() {
    super('VibeStackDB');
    
    // Version 2 - Generated at 2025-08-10T12:49:51.431Z
    this.version(2).stores({
      users: '++id, &email',
      task_tags: '++Task_owner',
      tasks: '++id, clientId, version, deleted, createdAt, updatedAt',
      tag_sets: '++id, [displayOrder], clientId, version, deleted, createdAt, updatedAt',
      tags: '++id, &slug, [tagSet+sortOrder], [slug], clientId, version, deleted, createdAt, updatedAt',
      status_sets: '++id, [entityType], clientId, version, deleted, createdAt, updatedAt',
      status_definitions: '++id, [name], [statusSet+sortOrder], clientId, version, deleted, createdAt, updatedAt',
      project_tag_sets: '++Project_owner',
      project_status_sets: '++Project_owner',
      projects: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, [tableName+recordId], processedSync',
      entity_dependencies: '++id, [toTable+toId], [fromTable+fromId]',
      comments: '++id, clientId, version, deleted, createdAt, updatedAt',
      change_history: '++id, [tableName+timestamp], [lsn]',
    });

    // Version 3 - Generated at 2025-08-10T13:08:02.921Z
    this.version(3).stores({
      users: '++id, &email',
      task_tags: '++Task_owner',
      tasks: '++id, clientId, version, deleted, createdAt, updatedAt',
      tag_sets: '++id, [displayOrder], clientId, version, deleted, createdAt, updatedAt',
      tags: '++id, &slug, [tagSet+sortOrder], [slug], clientId, version, deleted, createdAt, updatedAt',
      status_sets: '++id, [entityType], clientId, version, deleted, createdAt, updatedAt',
      status_definitions: '++id, [name], [statusSet+sortOrder], clientId, version, deleted, createdAt, updatedAt',
      project_tag_sets: '++Project_owner',
      project_status_sets: '++Project_owner',
      projects: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, table, processed_sync, [table+recordId], processedSync',
      entity_dependencies: '++id, [toTable+toId], [fromTable+fromId]',
      comments: '++id, clientId, version, deleted, createdAt, updatedAt',
      change_history: '++id, [tableName+timestamp], [lsn]',
    });

    // Version 4 - Generated at 2025-08-10T13:34:22.336Z
    this.version(4).stores({
      users: '++id, &email',
      task_tags: '++Task_owner',
      tasks: '++id, clientId, version, deleted, createdAt, updatedAt',
      tag_sets: '++id, [displayOrder], clientId, version, deleted, createdAt, updatedAt',
      tags: '++id, &slug, [tagSet+sortOrder], [slug], clientId, version, deleted, createdAt, updatedAt',
      status_sets: '++id, [entityType], clientId, version, deleted, createdAt, updatedAt',
      status_definitions: '++id, [name], [statusSet+sortOrder], clientId, version, deleted, createdAt, updatedAt',
      project_tag_sets: '++Project_owner',
      project_status_sets: '++Project_owner',
      projects: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, table, processed_sync, [table+recordId], processedSync',
      entity_dependencies: '++id, [toTable+toId], [fromTable+fromId]',
      comments: '++id, clientId, version, deleted, createdAt, updatedAt',
    });

    // Version 5 - Generated at 2025-08-12T02:13:58.848Z
    this.version(5).stores({
      users: '++id, &email',
      task_tags: '++Task_owner',
      tasks: '++id, clientId, version, deleted, createdAt, updatedAt',
      tag_set: '++id, [displayOrder], clientId, version, deleted, createdAt, updatedAt',
      tag: '++id, &slug, [tagSet+sortOrder], [slug], clientId, version, deleted, createdAt, updatedAt',
      status_set: '++id, [entityType], clientId, version, deleted, createdAt, updatedAt',
      status_definition: '++id, [name], [statusSet+sortOrder], clientId, version, deleted, createdAt, updatedAt',
      project_tag_sets: '++Project_owner',
      project_status_sets: '++Project_owner',
      projects: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, table, processed_sync, [table+recordId], processedSync',
      entity_dependencies: '++id, [toTable+toId], [fromTable+fromId]',
      comments: '++id, clientId, version, deleted, createdAt, updatedAt',
    });

  }
}

export const db = new VibeStackDatabase();

// Helper function to clear all data
export async function clearDatabase() {
  const tables = [
    'users',
    'task_tags',
    'tasks',
    'tag_set',
    'tag',
    'status_set',
    'status_definition',
    'project_tag_sets',
    'project_status_sets',
    'projects',
    'local_changes',
    'entity_dependencies',
    'comments',
  ];
  
  for (const tableName of tables) {
    await db.table(tableName).clear();
  }
}

// Helper function to get table by name
export function getTable(tableName: string): Table<any> | undefined {
  return (db as any)[tableName];
}

// Export table names for reference
export const dexieTableNames = [
  'users',
  'task_tags',
  'tasks',
  'tag_set',
  'tag',
  'status_set',
  'status_definition',
  'project_tag_sets',
  'project_status_sets',
  'projects',
  'local_changes',
  'entity_dependencies',
  'comments',
] as const;

export type DexieTableName = typeof dexieTableNames[number];

// Re-export commonly used constants from client-entities
export { 
  CLIENT_DOMAIN_TABLES,
  CLIENT_DOMAIN_TABLE_HIERARCHY,
  CLIENT_JUNCTION_TABLE_MAPPING 
} from './client-entities.js';

// Dynamically generated table lists based on actual metadata
export const ENTITY_TABLES = [
  'users',
  'task_tags',
  'tasks',
  'tag_set',
  'tag',
  'status_set',
  'status_definition',
  'project_tag_sets',
  'project_status_sets',
  'projects',
  'local_changes',
  'entity_dependencies',
  'comments'
] as const;

// System tables (client-side system tables like local_changes)
export const SYSTEM_TABLES = [
  'local_changes'
] as const;

// Domain tables (non-system entity tables)
export const DOMAIN_TABLES = [
  'users',
  'task_tags',
  'tasks',
  'tag_set',
  'tag',
  'status_set',
  'status_definition',
  'project_tag_sets',
  'project_status_sets',
  'projects',
  'entity_dependencies',
  'comments'
] as const;

// Junction tables (many-to-many relationships)
export const JUNCTION_TABLES = [

] as const;

// Mapping from Dexie table names to database table names
export const DEXIE_TO_DB_TABLE_MAP = {
  users: 'users',
  task_tags: 'task_tags',
  tasks: 'tasks',
  tag_set: 'tag_set',
  tag: 'tag',
  status_set: 'status_set',
  status_definition: 'status_definition',
  project_tag_sets: 'project_tag_sets',
  project_status_sets: 'project_status_sets',
  projects: 'projects',
  local_changes: 'local_changes',
  entity_dependencies: 'entity_dependencies',
  comments: 'comments'
} as const;
