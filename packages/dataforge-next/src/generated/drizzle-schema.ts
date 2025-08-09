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

export const verificationTable = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expires_at: text('expires_at').notNull()
});

export const userTable = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  is_super_admin: boolean('is_super_admin').default(false).notNull(),
  accounts_id: text('accounts_id')
});

export const task_tagsTable = pgTable('task_tags', {
  tasks_id: text('tasks_id'),
  tags_id: text('tags_id')
});

export const taskTable = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  title: text('title').notNull(),
  description: text('description'),
  legacy_status: text('legacy_status'),
  priority: text('priority').notNull(),
  due_date: text('due_date'),
  start_date: text('start_date'),
  completed_at: text('completed_at'),
  time_range: text('time_range'),
  estimated_duration: text('estimated_duration'),
  legacy_tags: text('legacy_tags'),
  project_id: text('project_id'),
  assignee_id: text('assignee_id'),
  parents_id: text('parents_id')
});

export const tagsetTable = pgTable('tag_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category'),
  is_system: boolean('is_system').default(false).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  default_color: text('default_color').notNull(),
  display_order: integer('display_order').default(0).notNull(),
  is_exclusive: boolean('is_exclusive').default(false).notNull(),
  max_tags: integer('max_tags'),
  metadata: text('metadata').notNull()
}, (table) => ({
  idx_tag_sets_displayOrder: index('idx_tag_sets_displayOrder').on(table.display_order),
}));

export const tagTable = pgTable('tags', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(),
  icon: text('icon'),
  variant: text('variant').notNull(),
  sort_order: integer('sort_order').default(0).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  usage_count: integer('usage_count').default(0).notNull(),
  last_used_at: text('last_used_at'),
  metadata: text('metadata').notNull(),
  tag_set_id: text('tag_set_id').notNull(),
  parent_id: text('parent_id')
}, (table) => ({
  idx_tags_tagSet_sortOrder: index('idx_tags_tagSet_sortOrder').on(table.tag_set_id, table.sort_order),
  idx_tags_slug: index('idx_tags_slug').on(table.slug),
}));

export const syncmetadataTable = pgTable('sync_metadata', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  table_name: text('table_name').notNull(),
  last_synced_version: text('last_synced_version').notNull(),
  last_synced_at: timestamp('last_synced_at', { mode: 'date' })
});

export const statussetTable = pgTable('status_sets', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  description: text('description'),
  entity_type: text('entity_type').notNull(),
  is_default: boolean('is_default').default(false).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  is_system: boolean('is_system').default(false).notNull(),
  workflow: text('workflow').notNull(),
  metadata: text('metadata').notNull()
}, (table) => ({
  idx_status_sets_entityType: index('idx_status_sets_entityType').on(table.entity_type),
}));

export const statusdefinitionTable = pgTable('status_definitions', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  label: text('label').notNull(),
  color: text('color').notNull(),
  icon: text('icon'),
  variant: text('variant'),
  sort_order: integer('sort_order').notNull(),
  is_default: boolean('is_default').default(false).notNull(),
  is_final: boolean('is_final').default(false).notNull(),
  is_active: boolean('is_active').default(true).notNull(),
  allowed_transitions: text('allowed_transitions'),
  auto_transition_days: integer('auto_transition_days'),
  metadata: text('metadata').notNull(),
  status_set_id: text('status_set_id').notNull()
}, (table) => ({
  idx_status_definitions_name: index('idx_status_definitions_name').on(table.name),
  idx_status_definitions_statusSet_sortOrder: index('idx_status_definitions_statusSet_sortOrder').on(table.status_set_id, table.sort_order),
}));

export const sessionTable = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  session_token: text('session_token').notNull(),
  expires_at: timestamp('expires_at', { mode: 'date' }).notNull(),
  accounts_id: text('accounts_id').notNull()
});

export const project_tag_setsTable = pgTable('project_tag_sets', {
  projects_id: text('projects_id'),
  tag_sets_id: text('tag_sets_id')
});

export const project_status_setsTable = pgTable('project_status_sets', {
  projects_id: text('projects_id'),
  status_sets_id: text('status_sets_id')
});

export const projectTable = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  owner_id: text('owner_id')
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
  idx_local_changes_tableName_recordId: index('idx_local_changes_tableName_recordId').on(table.table_name, table.record_id),
}));

export const entitydependencyTable = pgTable('entity_dependencies', {
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
  idx_entity_dependencies_toTable_toId: index('idx_entity_dependencies_toTable_toId').on(table.to_table, table.to_id),
  idx_entity_dependencies_fromTable_fromId: index('idx_entity_dependencies_fromTable_fromId').on(table.from_table, table.from_id),
}));

export const commentTable = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  content: text('content').notNull(),
  tasks_id: text('tasks_id').notNull(),
  authors_id: text('authors_id')
});

export const changehistoryTable = pgTable('change_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  lsn: text('lsn').notNull(),
  table_name: text('table_name').notNull(),
  operation: text('operation').notNull(),
  data: text('data'),
  timestamp: text('timestamp').notNull()
}, (table) => ({
  idx_change_history_tableName_timestamp: index('idx_change_history_tableName_timestamp').on(table.table_name, table.timestamp),
  idx_change_history_lsn: index('idx_change_history_lsn').on(table.lsn),
}));

export const accountTable = pgTable('accounts', {
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
  session_state: text('session_state')
});

// ============================================
// Relations
// ============================================

export const userRelations = relations(userTable, ({ one, many }) => ({
  assignedTasks: many(taskTable),
  comments: many(commentTable),
  ownedProjects: many(projectTable),
}));

export const taskRelations = relations(taskTable, ({ one, many }) => ({
  subtasks: many(taskTable),
  comments: many(commentTable),
  tags: many(tagTable),
}));

export const tagsetRelations = relations(tagsetTable, ({ one, many }) => ({
  tags: many(tagTable),
  projects: many(projectTable),
}));

export const tagRelations = relations(tagTable, ({ one, many }) => ({
  children: many(tagTable),
  tasks: many(taskTable),
}));

export const statussetRelations = relations(statussetTable, ({ one, many }) => ({
  statuses: many(statusdefinitionTable),
  projects: many(projectTable),
}));

export const projectRelations = relations(projectTable, ({ one, many }) => ({
  tasks: many(taskTable),
  tagSets: many(tagsetTable),
  statusSets: many(statussetTable),
}));

export const accountRelations = relations(accountTable, ({ one, many }) => ({
  users: many(userTable),
  sessions: many(sessionTable),
}));

// ============================================
// Export Schema
// ============================================

export const schema = {
  verificationTable,
  userTable,
  userRelations,
  task_tagsTable,
  taskTable,
  taskRelations,
  tagsetTable,
  tagsetRelations,
  tagTable,
  tagRelations,
  syncmetadataTable,
  statussetTable,
  statussetRelations,
  statusdefinitionTable,
  sessionTable,
  project_tag_setsTable,
  project_status_setsTable,
  projectTable,
  projectRelations,
  localchangesTable,
  entitydependencyTable,
  commentTable,
  changehistoryTable,
  accountTable,
  accountRelations,
};

// ============================================
// Type Exports
// ============================================

export type Verification = typeof verificationTable.$inferSelect;
export type NewVerification = typeof verificationTable.$inferInsert;
export type User = typeof userTable.$inferSelect;
export type NewUser = typeof userTable.$inferInsert;
export type task_tags = typeof task_tagsTable.$inferSelect;
export type Newtask_tags = typeof task_tagsTable.$inferInsert;
export type Task = typeof taskTable.$inferSelect;
export type NewTask = typeof taskTable.$inferInsert;
export type TagSet = typeof tagsetTable.$inferSelect;
export type NewTagSet = typeof tagsetTable.$inferInsert;
export type Tag = typeof tagTable.$inferSelect;
export type NewTag = typeof tagTable.$inferInsert;
export type SyncMetadata = typeof syncmetadataTable.$inferSelect;
export type NewSyncMetadata = typeof syncmetadataTable.$inferInsert;
export type StatusSet = typeof statussetTable.$inferSelect;
export type NewStatusSet = typeof statussetTable.$inferInsert;
export type StatusDefinition = typeof statusdefinitionTable.$inferSelect;
export type NewStatusDefinition = typeof statusdefinitionTable.$inferInsert;
export type Session = typeof sessionTable.$inferSelect;
export type NewSession = typeof sessionTable.$inferInsert;
export type project_tag_sets = typeof project_tag_setsTable.$inferSelect;
export type Newproject_tag_sets = typeof project_tag_setsTable.$inferInsert;
export type project_status_sets = typeof project_status_setsTable.$inferSelect;
export type Newproject_status_sets = typeof project_status_setsTable.$inferInsert;
export type Project = typeof projectTable.$inferSelect;
export type NewProject = typeof projectTable.$inferInsert;
export type LocalChanges = typeof localchangesTable.$inferSelect;
export type NewLocalChanges = typeof localchangesTable.$inferInsert;
export type EntityDependency = typeof entitydependencyTable.$inferSelect;
export type NewEntityDependency = typeof entitydependencyTable.$inferInsert;
export type Comment = typeof commentTable.$inferSelect;
export type NewComment = typeof commentTable.$inferInsert;
export type ChangeHistory = typeof changehistoryTable.$inferSelect;
export type NewChangeHistory = typeof changehistoryTable.$inferInsert;
export type Account = typeof accountTable.$inferSelect;
export type NewAccount = typeof accountTable.$inferInsert;
