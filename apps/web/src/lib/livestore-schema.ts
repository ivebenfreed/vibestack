/**
 * LiveStore Schema Definition - v0.3.1 API
 * Defines events and state tables for organization-aware multi-tenant system
 */

import { Events, State } from '@livestore/livestore';

// Define organization-aware events
export const events = {
  // Task events
  taskCreated: Events.synced<{
    id: string;
    organizationId: string;
    title: string;
    description?: string;
    status: string;
    projectId?: string;
    assignedUserId?: string;
    priority: 'low' | 'medium' | 'high';
    createdAt: Date;
    updatedAt: Date;
  }>('task_created'),

  taskUpdated: Events.synced<{
    id: string;
    organizationId: string;
    updates: Record<string, any>;
    updatedAt: Date;
  }>('task_updated'),

  taskDeleted: Events.synced<{
    id: string;
    organizationId: string;
    deletedAt: Date;
  }>('task_deleted'),

  // Project events
  projectCreated: Events.synced<{
    id: string;
    organizationId: string;
    name: string;
    description?: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>('project_created'),

  projectUpdated: Events.synced<{
    id: string;
    organizationId: string;
    updates: Record<string, any>;
    updatedAt: Date;
  }>('project_updated'),

  projectDeleted: Events.synced<{
    id: string;
    organizationId: string;
    deletedAt: Date;
  }>('project_deleted'),

  // User events
  userCreated: Events.synced<{
    id: string;
    organizationId: string;
    email: string;
    name: string;
    role: string;
    createdAt: Date;
    updatedAt: Date;
  }>('user_created'),

  userUpdated: Events.synced<{
    id: string;
    organizationId: string;
    updates: Record<string, any>;
    updatedAt: Date;
  }>('user_updated'),

  userDeleted: Events.synced<{
    id: string;
    organizationId: string;
    deletedAt: Date;
  }>('user_deleted'),
};

// Define state tables using SQLite adapter
export const tables = {
  tasks: State.SQLite.table('tasks', {
    id: 'TEXT PRIMARY KEY',
    organizationId: 'TEXT NOT NULL',
    title: 'TEXT NOT NULL',
    description: 'TEXT',
    status: 'TEXT NOT NULL DEFAULT "pending"',
    projectId: 'TEXT',
    assignedUserId: 'TEXT',
    priority: 'TEXT NOT NULL DEFAULT "medium"',
    createdAt: 'TEXT NOT NULL',
    updatedAt: 'TEXT NOT NULL',
    deletedAt: 'TEXT'
  }),

  projects: State.SQLite.table('projects', {
    id: 'TEXT PRIMARY KEY',
    organizationId: 'TEXT NOT NULL',
    name: 'TEXT NOT NULL',
    description: 'TEXT',
    status: 'TEXT NOT NULL DEFAULT "active"',
    createdAt: 'TEXT NOT NULL',
    updatedAt: 'TEXT NOT NULL',
    deletedAt: 'TEXT'
  }),

  users: State.SQLite.table('users', {
    id: 'TEXT PRIMARY KEY',
    organizationId: 'TEXT NOT NULL',
    email: 'TEXT NOT NULL UNIQUE',
    name: 'TEXT NOT NULL',
    role: 'TEXT NOT NULL DEFAULT "member"',
    createdAt: 'TEXT NOT NULL',
    updatedAt: 'TEXT NOT NULL',
    deletedAt: 'TEXT'
  }),
};

// UI State (local only, not synced)
export const uiState = State.local({
  selectedOrganizationId: null as string | null,
  currentView: 'dashboard' as 'dashboard' | 'projects' | 'tasks',
  filter: 'all' as 'all' | 'active' | 'completed',
});

// Export schema for store creation
export const schema = {
  events,
  tables,
  uiState
};

export type LiveStoreSchema = typeof schema;
export type Events = typeof events;
export type Tables = typeof tables;
export type UIState = typeof uiState;