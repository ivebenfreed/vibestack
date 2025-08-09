// Generated Drizzle ORM schema from MikroORM entities
import { 
  pgTable, 
  uuid, 
  text, 
  timestamp, 
  boolean, 
  integer,
  bigint,
  varchar,
  jsonb,
  index,
  uniqueIndex,
  primaryKey
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Table Definitions
// ============================================

export const userTable = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  is_super_admin: boolean('is_super_admin').default(false).notNull(),
  account_id: text('account_id'),
  assignedTasks: text('assignedTasks').notNull(),
  createdTasks: text('createdTasks').notNull(),
  comments: text('comments').notNull(),
  createdProjects: text('createdProjects').notNull()
});

export const taskTable = pgTable('task', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  version: integer('version').default(0).notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  client_id: uuid('client_id').notNull(),
  created_by_id: text('created_by_id'),
  updated_by_id: text('updated_by_id'),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  due_date: text('due_date'),
  start_date: text('start_date'),
  estimated_hours: integer('estimated_hours').default(0).notNull(),
  actual_hours: integer('actual_hours').default(0).notNull(),
  completion_percentage: integer('completion_percentage').default(0).notNull(),
  tags: text('tags'),
  project_id: text('project_id'),
  assignee_id: text('assignee_id'),
  parent_id: text('parent_id'),
  subtasks: text('subtasks').notNull(),
  comments: text('comments').notNull()
});

export const syncmetadataTable = pgTable('sync_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  table_name: text('table_name').notNull(),
  last_synced_version: text('last_synced_version').notNull(),
  last_synced_at: timestamp('last_synced_at', { mode: 'date' })
});

export const sessionTable = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  session_token: text('session_token').notNull(),
  expires_at: timestamp('expires_at', { mode: 'date' }).notNull(),
  account_id: text('account_id').notNull()
});

export const projectTable = pgTable('project', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  version: integer('version').default(0).notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  client_id: uuid('client_id').notNull(),
  created_by_id: text('created_by_id'),
  updated_by_id: text('updated_by_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  start_date: text('start_date'),
  end_date: text('end_date'),
  color: text('color'),
  owner_id: text('owner_id'),
  tasks: text('tasks').notNull()
});

export const localchangesTable = pgTable('local_changes', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  table_name: text('table_name').notNull(),
  record_id: text('record_id').notNull(),
  operation_type: text('operation_type').notNull(),
  data: text('data').notNull(),
  client_sequence: text('client_sequence').notNull(),
  loop_protection: integer('loop_protection').default(0).notNull()
}, (table) => ({
  idx_local_changes_tableName_recordId: index('idx_local_changes_tableName_recordId').on(table.tableName, table.recordId),
}));

export const entitydependencyTable = pgTable('entity_dependency', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  from_table: text('from_table').notNull(),
  from_id: text('from_id').notNull(),
  to_table: text('to_table').notNull(),
  to_id: text('to_id').notNull(),
  dependency_type: text('dependency_type').notNull(),
  metadata: text('metadata')
}, (table) => ({
  idx_entity_dependency_toTable_toId: index('idx_entity_dependency_toTable_toId').on(table.toTable, table.toId),
  idx_entity_dependency_fromTable_fromId: index('idx_entity_dependency_fromTable_fromId').on(table.fromTable, table.fromId),
}));

export const commentTable = pgTable('comment', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  version: integer('version').default(0).notNull(),
  deleted: boolean('deleted').default(false).notNull(),
  client_id: uuid('client_id').notNull(),
  created_by_id: text('created_by_id'),
  updated_by_id: text('updated_by_id'),
  content: text('content').notNull(),
  task_id: text('task_id').notNull(),
  author_id: text('author_id')
});

export const accountTable = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  provider_id: text('provider_id').notNull(),
  provider_account_id: text('provider_account_id').notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: text('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
  users: text('users').notNull(),
  sessions: text('sessions').notNull()
});

// ============================================
// Relations
// ============================================

// ============================================
// Export Schema
// ============================================

export const schema = {
  userTable,
  taskTable,
  syncmetadataTable,
  sessionTable,
  projectTable,
  localchangesTable,
  entitydependencyTable,
  commentTable,
  accountTable,
};

// ============================================
// Type Exports
// ============================================

export type User = typeof userTable.$inferSelect;
export type NewUser = typeof userTable.$inferInsert;
export type Task = typeof taskTable.$inferSelect;
export type NewTask = typeof taskTable.$inferInsert;
export type SyncMetadata = typeof syncmetadataTable.$inferSelect;
export type NewSyncMetadata = typeof syncmetadataTable.$inferInsert;
export type Session = typeof sessionTable.$inferSelect;
export type NewSession = typeof sessionTable.$inferInsert;
export type Project = typeof projectTable.$inferSelect;
export type NewProject = typeof projectTable.$inferInsert;
export type LocalChanges = typeof localchangesTable.$inferSelect;
export type NewLocalChanges = typeof localchangesTable.$inferInsert;
export type EntityDependency = typeof entitydependencyTable.$inferSelect;
export type NewEntityDependency = typeof entitydependencyTable.$inferInsert;
export type Comment = typeof commentTable.$inferSelect;
export type NewComment = typeof commentTable.$inferInsert;
export type Account = typeof accountTable.$inferSelect;
export type NewAccount = typeof accountTable.$inferInsert;
