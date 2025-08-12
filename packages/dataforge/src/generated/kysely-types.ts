// Generated Kysely database types from MikroORM entities
// This replaces the need for Drizzle schema in queries

import type { ColumnType, Generated, Selectable, Insertable, Updateable } from 'kysely';

// ============================================
// Table Types
// ============================================

export interface VerificationTable {
  id: Generated<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  identifier: string;
  value: string;
  expiresAt: Date;
}

export interface UserTable {
  id: Generated<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  name: string;
  email: string | null;
  email_verified: ColumnType<boolean, boolean | undefined, boolean>;
  image: string | null;
  is_super_admin: ColumnType<boolean, boolean | undefined, boolean>;
  role: ColumnType<string, string | undefined, string>;
}

export interface TaskTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  title: string;
  description: string | null;
  legacy_status: string | null;
  priority: ColumnType<string, string | undefined, string>;
  due_date: string | null;
  start_date: string | null;
  completed_at: string | null;
  time_range: string | null;
  estimated_duration: string | null;
  legacy_tags: string | null;
  project_id: string | null | null;
  assignee_id: string | null | null;
}

export interface TagSetTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  name: string;
  description: string | null;
  category: string | null;
  is_system: ColumnType<boolean, boolean | undefined, boolean>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  default_color: ColumnType<string, string | undefined, string>;
  display_order: ColumnType<number, number | undefined, number>;
  is_exclusive: ColumnType<boolean, boolean | undefined, boolean>;
  max_tags: number | null;
  metadata: ColumnType<string, string | undefined, string>;
}

export interface TagTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  name: string;
  slug: string;
  color: string;
  icon: string | null;
  variant: ColumnType<string, string | undefined, string>;
  sort_order: ColumnType<number, number | undefined, number>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  usage_count: ColumnType<number, number | undefined, number>;
  last_used_at: string | null;
  metadata: ColumnType<string, string | undefined, string>;
  tag_set_id: string | null;
  parent_id: string | null | null;
}

export interface StatusSetTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  name: string;
  description: string | null;
  entity_type: string;
  is_default: ColumnType<boolean, boolean | undefined, boolean>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  is_system: ColumnType<boolean, boolean | undefined, boolean>;
  workflow: ColumnType<string, string | undefined, string>;
  metadata: ColumnType<string, string | undefined, string>;
}

export interface StatusDefinitionTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  name: string;
  label: string;
  color: string;
  icon: string | null;
  variant: string | null;
  sort_order: number;
  is_default: ColumnType<boolean, boolean | undefined, boolean>;
  is_final: ColumnType<boolean, boolean | undefined, boolean>;
  is_active: ColumnType<boolean, boolean | undefined, boolean>;
  allowed_transitions: string | null;
  auto_transition_days: number | null;
  metadata: ColumnType<string, string | undefined, string>;
  status_set_id: string | null;
}

export interface SessionTable {
  id: Generated<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  userId: string | null;
  token: string;
  expiresAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface ProjectTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  name: string;
  description: string | null;
  status: ColumnType<string, string | undefined, string>;
  owner_id: string | null | null;
}

export interface EntityDependencyTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  from_table: string;
  from_id: string;
  to_table: string;
  to_id: string;
  dependency_type: string;
  metadata: string | null;
}

export interface CommentTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  client_id: string | null;
  content: string;
  task_id: string | null;
  author_id: string | null | null;
}

export interface ChangeHistoryTable {
  id: Generated<string>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
  lsn: string;
  table_name: string;
  operation: string;
  data: string | null;
  timestamp: string;
}

export interface AccountTable {
  id: Generated<string>;
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
  userId: string | null;
  providerId: string;
  accountId: string;
  password: string | null;
  refreshToken: string | null;
  accessToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  tokenType: string | null;
  scope: string | null;
  idToken: string | null;
  sessionState: string | null;
}

export interface tasktagsTable {
  task_id: string;
  tag_id: string;
}

export interface projecttagsetsTable {
  project_id: string;
  tag_set_id: string;
}

export interface projectstatussetsTable {
  project_id: string;
  status_set_id: string;
}

// ============================================
// Database Interface
// ============================================

export interface Database {
  verification: VerificationTable;
  user: UserTable;
  task: TaskTable;
  tag_set: TagSetTable;
  tag: TagTable;
  status_set: StatusSetTable;
  status_definition: StatusDefinitionTable;
  session: SessionTable;
  project: ProjectTable;
  entity_dependencies: EntityDependencyTable;
  comments: CommentTable;
  change_history: ChangeHistoryTable;
  account: AccountTable;
  task_tags: tasktagsTable;
  project_tag_sets: projecttagsetsTable;
  project_status_sets: projectstatussetsTable;
}

// ============================================
// Helper Types for CRUD Operations
// ============================================

export type Verification = Selectable<VerificationTable>;
export type NewVerification = Insertable<VerificationTable>;
export type VerificationUpdate = Updateable<VerificationTable>;

export type User = Selectable<UserTable>;
export type NewUser = Insertable<UserTable>;
export type UserUpdate = Updateable<UserTable>;

export type Task = Selectable<TaskTable>;
export type NewTask = Insertable<TaskTable>;
export type TaskUpdate = Updateable<TaskTable>;

export type TagSet = Selectable<TagSetTable>;
export type NewTagSet = Insertable<TagSetTable>;
export type TagSetUpdate = Updateable<TagSetTable>;

export type Tag = Selectable<TagTable>;
export type NewTag = Insertable<TagTable>;
export type TagUpdate = Updateable<TagTable>;

export type StatusSet = Selectable<StatusSetTable>;
export type NewStatusSet = Insertable<StatusSetTable>;
export type StatusSetUpdate = Updateable<StatusSetTable>;

export type StatusDefinition = Selectable<StatusDefinitionTable>;
export type NewStatusDefinition = Insertable<StatusDefinitionTable>;
export type StatusDefinitionUpdate = Updateable<StatusDefinitionTable>;

export type Session = Selectable<SessionTable>;
export type NewSession = Insertable<SessionTable>;
export type SessionUpdate = Updateable<SessionTable>;

export type Project = Selectable<ProjectTable>;
export type NewProject = Insertable<ProjectTable>;
export type ProjectUpdate = Updateable<ProjectTable>;

export type EntityDependency = Selectable<EntityDependencyTable>;
export type NewEntityDependency = Insertable<EntityDependencyTable>;
export type EntityDependencyUpdate = Updateable<EntityDependencyTable>;

export type Comment = Selectable<CommentTable>;
export type NewComment = Insertable<CommentTable>;
export type CommentUpdate = Updateable<CommentTable>;

export type ChangeHistory = Selectable<ChangeHistoryTable>;
export type NewChangeHistory = Insertable<ChangeHistoryTable>;
export type ChangeHistoryUpdate = Updateable<ChangeHistoryTable>;

export type Account = Selectable<AccountTable>;
export type NewAccount = Insertable<AccountTable>;
export type AccountUpdate = Updateable<AccountTable>;

export type task_tags = Selectable<tasktagsTable>;
export type Newtask_tags = Insertable<tasktagsTable>;
export type task_tagsUpdate = Updateable<tasktagsTable>;

export type project_tag_sets = Selectable<projecttagsetsTable>;
export type Newproject_tag_sets = Insertable<projecttagsetsTable>;
export type project_tag_setsUpdate = Updateable<projecttagsetsTable>;

export type project_status_sets = Selectable<projectstatussetsTable>;
export type Newproject_status_sets = Insertable<projectstatussetsTable>;
export type project_status_setsUpdate = Updateable<projectstatussetsTable>;

// ============================================
// Entity to Table Mapping
// ============================================

export const tableNames = {
  Verification: 'verification' as const,
  User: 'user' as const,
  Task: 'task' as const,
  TagSet: 'tag_set' as const,
  Tag: 'tag' as const,
  StatusSet: 'status_set' as const,
  StatusDefinition: 'status_definition' as const,
  Session: 'session' as const,
  Project: 'project' as const,
  EntityDependency: 'entity_dependencies' as const,
  Comment: 'comments' as const,
  ChangeHistory: 'change_history' as const,
  Account: 'account' as const,
  task_tags: 'task_tags' as const,
  project_tag_sets: 'project_tag_sets' as const,
  project_status_sets: 'project_status_sets' as const,
} as const;

export type TableName = keyof Database;
export type EntityName = keyof typeof tableNames;
