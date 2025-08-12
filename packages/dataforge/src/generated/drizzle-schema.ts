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

export const verification = pgTable('verification', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expires_at: text('expires_at').notNull()
});

export const user = pgTable('user', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  name: text('name').notNull(),
  email: text('email').unique(),
  email_verified: boolean('email_verified').default(false).notNull(),
  image: text('image'),
  is_super_admin: boolean('is_super_admin').default(false).notNull()
});

export const task = pgTable('task', {
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

export const tag_set = pgTable('tag_set', {
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
  idx_tag_set_displayOrder: index('idx_tag_set_displayOrder').on(table.display_order),
}));

export const tag = pgTable('tag', {
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
  idx_tag_tagSet_sortOrder: index('idx_tag_tagSet_sortOrder').on(table.tag_set_id, table.sort_order),
  idx_tag_slug: index('idx_tag_slug').on(table.slug),
}));

export const status_set = pgTable('status_set', {
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
  idx_status_set_entityType: index('idx_status_set_entityType').on(table.entity_type),
}));

export const status_definition = pgTable('status_definition', {
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
  idx_status_definition_name: index('idx_status_definition_name').on(table.name),
  idx_status_definition_statusSet_sortOrder: index('idx_status_definition_statusSet_sortOrder').on(table.status_set_id, table.sort_order),
}));

export const session = pgTable('session', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  user_id: uuid('user_id').notNull(),
  session_token: text('session_token').notNull(),
  expires_at: timestamp('expires_at', { mode: 'date' }).notNull(),
  ip_address: text('ip_address'),
  user_agent: text('user_agent')
});

export const project = pgTable('project', {
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

export const account = pgTable('account', {
  id: uuid('id').primaryKey().defaultRandom(),
  created_at: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
  user_id: uuid('user_id').notNull(),
  provider_id: text('provider_id').notNull(),
  provider_account_id: text('provider_account_id').notNull(),
  password: text('password'),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: text('expires_at'),
  token_type: text('token_type'),
  scope: text('scope'),
  id_token: text('id_token'),
  session_state: text('session_state'),
  access_token_expires_at: timestamp('access_token_expires_at', { mode: 'date' }),
  refresh_token_expires_at: timestamp('refresh_token_expires_at', { mode: 'date' })
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

export const userRelations = relations(user, ({ one, many }) => ({
  accounts: many(account),
  sessions: many(session),
  assignedTasks: many(task),
  comments: many(comments),
  ownedProjects: many(project),
}));

export const taskRelations = relations(task, ({ one, many }) => ({
  project: one(project, {
    fields: [task.project_id],
    references: [project.id],
  }),
  assignee: one(user, {
    fields: [task.assignee_id],
    references: [user.id],
  }),
  comments: many(comments),
  tags: many(tag),
}));

export const tagSetRelations = relations(tag_set, ({ one, many }) => ({
  tags: many(tag),
  projects: many(project),
}));

export const tagRelations = relations(tag, ({ one, many }) => ({
  tagSet: one(tag_set, {
    fields: [tag.tag_set_id],
    references: [tag_set.id],
  }),
  parent: one(tag, {
    fields: [tag.parent_id],
    references: [tag.id],
  }),
  children: many(tag),
  tasks: many(task),
}));

export const statusSetRelations = relations(status_set, ({ one, many }) => ({
  statuses: many(status_definition),
  projects: many(project),
}));

export const statusDefinitionRelations = relations(status_definition, ({ one, many }) => ({
  statusSet: one(status_set, {
    fields: [status_definition.status_set_id],
    references: [status_set.id],
  }),
}));

export const sessionRelations = relations(session, ({ one, many }) => ({
  user: one(user, {
    fields: [session.user_id],
    references: [user.id],
  }),
}));

export const projectRelations = relations(project, ({ one, many }) => ({
  owner: one(user, {
    fields: [project.owner_id],
    references: [user.id],
  }),
  tasks: many(task),
  tagSets: many(tag_set),
  statusSets: many(status_set),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  task: one(task, {
    fields: [comments.task_id],
    references: [task.id],
  }),
  author: one(user, {
    fields: [comments.author_id],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one, many }) => ({
  user: one(user, {
    fields: [account.user_id],
    references: [user.id],
  }),
}));

// ============================================
// Export Schema
// ============================================

export const schema = {
  verification,
  user,
  userRelations,
  task,
  taskRelations,
  tag_set,
  tagSetRelations,
  tag,
  tagRelations,
  status_set,
  statusSetRelations,
  status_definition,
  statusDefinitionRelations,
  session,
  sessionRelations,
  project,
  projectRelations,
  entity_dependencies,
  comments,
  commentsRelations,
  change_history,
  account,
  accountRelations,
  task_tags,
  project_tag_sets,
  project_status_sets,
};

// ============================================
// Type Exports
// ============================================

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
export type Task = typeof task.$inferSelect;
export type NewTask = typeof task.$inferInsert;
export type TagSet = typeof tag_set.$inferSelect;
export type NewTagSet = typeof tag_set.$inferInsert;
export type Tag = typeof tag.$inferSelect;
export type NewTag = typeof tag.$inferInsert;
export type StatusSet = typeof status_set.$inferSelect;
export type NewStatusSet = typeof status_set.$inferInsert;
export type StatusDefinition = typeof status_definition.$inferSelect;
export type NewStatusDefinition = typeof status_definition.$inferInsert;
export type Session = typeof session.$inferSelect;
export type NewSession = typeof session.$inferInsert;
export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type EntityDependency = typeof entity_dependencies.$inferSelect;
export type NewEntityDependency = typeof entity_dependencies.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type ChangeHistory = typeof change_history.$inferSelect;
export type NewChangeHistory = typeof change_history.$inferInsert;
export type Account = typeof account.$inferSelect;
export type NewAccount = typeof account.$inferInsert;
export type task_tags = typeof task_tags.$inferSelect;
export type Newtask_tags = typeof task_tags.$inferInsert;
export type project_tag_sets = typeof project_tag_sets.$inferSelect;
export type Newproject_tag_sets = typeof project_tag_sets.$inferInsert;
export type project_status_sets = typeof project_status_sets.$inferSelect;
export type Newproject_status_sets = typeof project_status_sets.$inferInsert;
