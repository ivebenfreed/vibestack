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
  createdTasks: any;
  comments: any;
  createdProjects: any;
}

export interface Task {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deleted: boolean;
  clientId: string;
  createdBy?: any;
  updatedBy?: any;
  title: string;
  description?: string;
  status: string;
  priority: string;
  dueDate?: any;
  startDate?: any;
  estimatedHours: number;
  actualHours: number;
  completionPercentage: number;
  tags?: any;
  project?: any;
  assignee?: any;
  parent?: any;
  subtasks: any;
  comments: any;
}

export interface SyncMetadata {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  tableName: string;
  lastSyncedVersion: any;
  lastSyncedAt?: Date;
}

export interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  sessionToken: string;
  expiresAt: Date;
  account: any;
}

export interface Project {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  deleted: boolean;
  clientId: string;
  createdBy?: any;
  updatedBy?: any;
  name: string;
  description?: string;
  status: string;
  startDate?: any;
  endDate?: any;
  color?: string;
  owner?: any;
  tasks: any;
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
  version: number;
  deleted: boolean;
  clientId: string;
  createdBy?: any;
  updatedBy?: any;
  content: string;
  task: any;
  author?: any;
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
  User: 'user',
  Task: 'task',
  SyncMetadata: 'sync_metadata',
  Session: 'session',
  Project: 'project',
  LocalChanges: 'local_changes',
  EntityDependency: 'entity_dependency',
  Comment: 'comment',
  Account: 'account',
} as const;

export type TableName = keyof typeof tableNames;
export type EntityType = User | Task | SyncMetadata | Session | Project | LocalChanges | EntityDependency | Comment | Account;
