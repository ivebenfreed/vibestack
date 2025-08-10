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

export const verifications = pgTable('verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expires_at: text('expires_at').notNull()
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  is_super_admin: boolean('is_super_admin').default(false).notNull(),
  accounts_id: uuid('accounts_id')
});

export const tasks = pgTable('tasks', {
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
  project_id: uuid('project_id'),
  assignee_id: uuid('assignee_id')
});

export const tag_sets = pgTable('tag_sets', {
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

export const tags = pgTable('tags', {
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
  tag_set_id: uuid('tag_set_id').notNull(),
  parent_id: uuid('parent_id')
}, (table) => ({
  idx_tags_tagSet_sortOrder: index('idx_tags_tagSet_sortOrder').on(table.tag_set_id, table.sort_order),
  idx_tags_slug: index('idx_tags_slug').on(table.slug),
}));

export const status_sets = pgTable('status_sets', {
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

export const status_definitions = pgTable('status_definitions', {
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
  status_set_id: uuid('status_set_id').notNull()
}, (table) => ({
  idx_status_definitions_name: index('idx_status_definitions_name').on(table.name),
  idx_status_definitions_statusSet_sortOrder: index('idx_status_definitions_statusSet_sortOrder').on(table.status_set_id, table.sort_order),
}));

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  session_token: text('session_token').notNull(),
  expires_at: timestamp('expires_at', { mode: 'date' }).notNull(),
  accounts_id: uuid('accounts_id').notNull()
});

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull(),
  owner_id: uuid('owner_id')
});

export const entity_dependencies = pgTable('entity_dependencies', {
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

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  client_id: uuid('client_id'),
  content: text('content').notNull(),
  task_id: uuid('task_id').notNull(),
  author_id: uuid('author_id')
});

export const change_history = pgTable('change_history', {
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

export const accounts = pgTable('accounts', {
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

export const task_tags = pgTable('task_tags', {
  task_id: uuid('task_id').notNull(),
  tag_id: uuid('tag_id').notNull()
});

export const project_tag_sets = pgTable('project_tag_sets', {
  project_id: uuid('project_id').notNull(),
  tag_set_id: uuid('tag_set_id').notNull()
});

export const project_status_sets = pgTable('project_status_sets', {
  project_id: uuid('project_id').notNull(),
  status_set_id: uuid('status_set_id').notNull()
});

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ one, many }) => ({
  account: one(accounts, {
    fields: [users.accounts_id],
    references: [accounts.id],
  }),
  assignedTasks: many(tasks),
  comments: many(comments),
  ownedProjects: many(projects),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.project_id],
    references: [projects.id],
  }),
  assignee: one(users, {
    fields: [tasks.assignee_id],
    references: [users.id],
  }),
  comments: many(comments),
  tags: many(tags),
}));

export const tagSetsRelations = relations(tag_sets, ({ one, many }) => ({
  tags: many(tags),
  projects: many(projects),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  tagSet: one(tag_sets, {
    fields: [tags.tag_set_id],
    references: [tag_sets.id],
  }),
  parent: one(tags, {
    fields: [tags.parent_id],
    references: [tags.id],
  }),
  children: many(tags),
  tasks: many(tasks),
}));

export const statusSetsRelations = relations(status_sets, ({ one, many }) => ({
  statuses: many(status_definitions),
  projects: many(projects),
}));

export const statusDefinitionsRelations = relations(status_definitions, ({ one, many }) => ({
  statusSet: one(status_sets, {
    fields: [status_definitions.status_set_id],
    references: [status_sets.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  account: one(accounts, {
    fields: [sessions.accounts_id],
    references: [accounts.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.owner_id],
    references: [users.id],
  }),
  tasks: many(tasks),
  tagSets: many(tag_sets),
  statusSets: many(status_sets),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(tasks, {
    fields: [comments.task_id],
    references: [tasks.id],
  }),
  author: one(users, {
    fields: [comments.author_id],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  users: many(users),
  sessions: many(sessions),
}));

// ============================================
// Export Schema
// ============================================

export const schema = {
  verifications,
  users,
  usersRelations,
  tasks,
  tasksRelations,
  tag_sets,
  tagSetsRelations,
  tags,
  tagsRelations,
  status_sets,
  statusSetsRelations,
  status_definitions,
  statusDefinitionsRelations,
  sessions,
  sessionsRelations,
  projects,
  projectsRelations,
  entity_dependencies,
  comments,
  commentsRelations,
  change_history,
  accounts,
  accountsRelations,
  task_tags,
  project_tag_sets,
  project_status_sets,
};

// ============================================
// Type Exports
// ============================================

export type Verification = typeof verifications.$inferSelect;
export type NewVerification = typeof verifications.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TagSet = typeof tag_sets.$inferSelect;
export type NewTagSet = typeof tag_sets.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type StatusSet = typeof status_sets.$inferSelect;
export type NewStatusSet = typeof status_sets.$inferInsert;
export type StatusDefinition = typeof status_definitions.$inferSelect;
export type NewStatusDefinition = typeof status_definitions.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type EntityDependency = typeof entity_dependencies.$inferSelect;
export type NewEntityDependency = typeof entity_dependencies.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type ChangeHistory = typeof change_history.$inferSelect;
export type NewChangeHistory = typeof change_history.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type task_tags = typeof task_tags.$inferSelect;
export type Newtask_tags = typeof task_tags.$inferInsert;
export type project_tag_sets = typeof project_tag_sets.$inferSelect;
export type Newproject_tag_sets = typeof project_tag_sets.$inferInsert;
export type project_status_sets = typeof project_status_sets.$inferSelect;
export type Newproject_status_sets = typeof project_status_sets.$inferInsert;
