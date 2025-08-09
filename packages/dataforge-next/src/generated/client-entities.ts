// Generated client entities from MikroORM metadata

// ============================================
// Enums (as const assertions)
// ============================================

export const TaskStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed'
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const ProjectStatus = {
  ACTIVE: 'active',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold'
} as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

// ============================================
// Entity Interfaces
// ============================================

export interface Verification {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  identifier: string;
  value: string;
  expiresAt: any;
}

export interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  email?: string;
  emailVerified: boolean;
  image?: string;
  isSuperAdmin: boolean;
  account?: any;
  assignedTasks: any;
  comments: any;
  ownedProjects: any;
}

export interface task_tags {
  Task_owner: any;
  Tag_inverse: any;
}

export interface Task {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  title: string;
  description?: string;
  legacyStatus?: string;
  priority: string;
  dueDate?: any;
  startDate?: any;
  completedAt?: any;
  timeRange?: string;
  estimatedDuration?: any;
  legacyTags?: any;
  project?: any;
  assignee?: any;
  parent?: any;
  subtasks: any;
  comments: any;
  tags: any;
}

export interface TagSet {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  name: string;
  description?: string;
  category?: string;
  isSystem: boolean;
  isActive: boolean;
  defaultColor: string;
  displayOrder: number;
  isExclusive: boolean;
  maxTags?: number;
  metadata: any;
  tags: any;
  projects: any;
}

export interface Tag {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  name: string;
  slug: string;
  color: string;
  icon?: string;
  variant: string;
  sortOrder: number;
  isActive: boolean;
  usageCount: number;
  lastUsedAt?: any;
  metadata: any;
  tagSet: any;
  parent?: any;
  children: any;
  tasks: any;
}

export interface SyncMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  tableName: string;
  lastSyncedVersion: any;
  lastSyncedAt?: Date;
}

export interface StatusSet {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  name: string;
  description?: string;
  entityType: string;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
  workflow: any;
  metadata: any;
  statuses: any;
  projects: any;
}

export interface StatusDefinition {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  name: string;
  label: string;
  color: string;
  icon?: string;
  variant?: string;
  sortOrder: number;
  isDefault: boolean;
  isFinal: boolean;
  isActive: boolean;
  allowedTransitions?: any;
  autoTransitionDays?: number;
  metadata: any;
  statusSet: any;
}

export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  sessionToken: string;
  expiresAt: Date;
  account: any;
}

export interface project_tag_sets {
  Project_owner: any;
  TagSet_inverse: any;
}

export interface project_status_sets {
  Project_owner: any;
  StatusSet_inverse: any;
}

export interface Project {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  name: string;
  description?: string;
  status: string;
  owner?: any;
  tasks: any;
  tagSets: any;
  statusSets: any;
}

export interface LocalChanges {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  tableName: string;
  recordId: string;
  operationType: string;
  data: any;
  clientSequence: any;
  loopProtection: number;
}

export interface EntityDependency {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  fromTable: string;
  fromId: string;
  toTable: string;
  toId: string;
  dependencyType: string;
  metadata?: any;
}

export interface Comment {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  clientId?: string;
  content: string;
  task: any;
  author?: any;
}

export interface ChangeHistory {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  lsn: string;
  tableName: string;
  operation: string;
  data?: any;
  timestamp: any;
}

export interface Account {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  providerId: string;
  providerAccountId: string;
  refreshToken?: string;
  accessToken?: string;
  expiresAt?: any;
  tokenType?: string;
  scope?: string;
  idToken?: string;
  sessionState?: string;
  users: any;
  sessions: any;
}

export const tableNames = {
  Verification: 'verifications',
  User: 'users',
  task_tags: 'task_tags',
  Task: 'tasks',
  TagSet: 'tag_sets',
  Tag: 'tags',
  SyncMetadata: 'sync_metadata',
  StatusSet: 'status_sets',
  StatusDefinition: 'status_definitions',
  Session: 'sessions',
  project_tag_sets: 'project_tag_sets',
  project_status_sets: 'project_status_sets',
  Project: 'projects',
  LocalChanges: 'local_changes',
  EntityDependency: 'entity_dependencies',
  Comment: 'comments',
  ChangeHistory: 'change_history',
  Account: 'accounts',
} as const;

export type TableName = keyof typeof tableNames;
export type EntityType = Verification | User | task_tags | Task | TagSet | Tag | SyncMetadata | StatusSet | StatusDefinition | Session | project_tag_sets | project_status_sets | Project | LocalChanges | EntityDependency | Comment | ChangeHistory | Account;
