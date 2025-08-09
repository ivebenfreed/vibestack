// Generated Dexie schema from MikroORM entities
import Dexie, { type Table } from 'dexie';
import type * as Entities from './client-entities.js';

export interface DexieSchema extends Dexie {
  user: Table<Entities.User>;
  task: Table<Entities.Task>;
  sync_metadata: Table<Entities.SyncMetadata>;
  project: Table<Entities.Project>;
  local_changes: Table<Entities.LocalChanges>;
  entity_dependency: Table<Entities.EntityDependency>;
  comment: Table<Entities.Comment>;
}

class VibeStackDatabase extends Dexie implements DexieSchema {
  user!: Table<Entities.User>;
  task!: Table<Entities.Task>;
  sync_metadata!: Table<Entities.SyncMetadata>;
  project!: Table<Entities.Project>;
  local_changes!: Table<Entities.LocalChanges>;
  entity_dependency!: Table<Entities.EntityDependency>;
  comment!: Table<Entities.Comment>;

  constructor() {
    super('VibeStackDB');
    
    this.version(1).stores({
      user: '++id, &email',
      task: '++id, clientId, version, deleted, createdAt, updatedAt',
      sync_metadata: '++id',
      project: '++id, clientId, version, deleted, createdAt, updatedAt',
      local_changes: '++id, [tableName+recordId]',
      entity_dependency: '++id, [toTable+toId], [fromTable+fromId]',
      comment: '++id, clientId, version, deleted, createdAt, updatedAt',
    });
  }
}

export const db = new VibeStackDatabase();

// Helper function to clear all data
export async function clearDatabase() {
  const tables = [
    'user',
    'task',
    'sync_metadata',
    'project',
    'local_changes',
    'entity_dependency',
    'comment',
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
  'user',
  'task',
  'sync_metadata',
  'project',
  'local_changes',
  'entity_dependency',
  'comment',
] as const;

export type DexieTableName = typeof dexieTableNames[number];
