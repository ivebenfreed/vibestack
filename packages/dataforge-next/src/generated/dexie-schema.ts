// Generated Dexie schema from MikroORM entities
import Dexie, { type Table } from 'dexie';
import type * as Entities from './client-entities.js';

export interface DexieSchema extends Dexie {
  users: Table<Entities.User>;
  task_tags: Table<Entities.task_tags>;
  tasks: Table<Entities.Task>;
  tag_sets: Table<Entities.TagSet>;
  tags: Table<Entities.Tag>;
  sync_metadata: Table<Entities.SyncMetadata>;
  status_sets: Table<Entities.StatusSet>;
  status_definitions: Table<Entities.StatusDefinition>;
  project_tag_sets: Table<Entities.project_tag_sets>;
  project_status_sets: Table<Entities.project_status_sets>;
  projects: Table<Entities.Project>;
  local_changes: Table<Entities.LocalChanges>;
  entity_dependencies: Table<Entities.EntityDependency>;
  comments: Table<Entities.Comment>;
  change_history: Table<Entities.ChangeHistory>;
}

class VibeStackDatabase extends Dexie implements DexieSchema {
  users!: Table<Entities.User>;
  task_tags!: Table<Entities.task_tags>;
  tasks!: Table<Entities.Task>;
  tag_sets!: Table<Entities.TagSet>;
  tags!: Table<Entities.Tag>;
  sync_metadata!: Table<Entities.SyncMetadata>;
  status_sets!: Table<Entities.StatusSet>;
  status_definitions!: Table<Entities.StatusDefinition>;
  project_tag_sets!: Table<Entities.project_tag_sets>;
  project_status_sets!: Table<Entities.project_status_sets>;
  projects!: Table<Entities.Project>;
  local_changes!: Table<Entities.LocalChanges>;
  entity_dependencies!: Table<Entities.EntityDependency>;
  comments!: Table<Entities.Comment>;
  change_history!: Table<Entities.ChangeHistory>;

  constructor() {
    super('VibeStackDB');
    
    this.version(1).stores({
      users: '++id, &email',
      task_tags: '++Task_owner',
      tasks: '++id, clientId, version, deleted, createdAt, updatedAt',
      tag_sets: '++id, [displayOrder], clientId, version, deleted, createdAt, updatedAt',
      tags: '++id, &slug, [tagSet+sortOrder], [slug], clientId, version, deleted, createdAt, updatedAt',
      sync_metadata: '++id',
      status_sets: '++id, [entityType], clientId, version, deleted, createdAt, updatedAt',
      status_definitions: '++id, [name], [statusSet+sortOrder], clientId, version, deleted, createdAt, updatedAt',
      project_tag_sets: '++Project_owner',
      project_status_sets: '++Project_owner',
      projects: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, [tableName+recordId]',
      entity_dependencies: '++id, [toTable+toId], [fromTable+fromId]',
      comments: '++id, clientId, version, deleted, createdAt, updatedAt',
      change_history: '++id, [tableName+timestamp], [lsn]',
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
    'tag_sets',
    'tags',
    'sync_metadata',
    'status_sets',
    'status_definitions',
    'project_tag_sets',
    'project_status_sets',
    'projects',
    'local_changes',
    'entity_dependencies',
    'comments',
    'change_history',
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
  'tag_sets',
  'tags',
  'sync_metadata',
  'status_sets',
  'status_definitions',
  'project_tag_sets',
  'project_status_sets',
  'projects',
  'local_changes',
  'entity_dependencies',
  'comments',
  'change_history',
] as const;

export type DexieTableName = typeof dexieTableNames[number];
