// Generated LiveStore entity interfaces
// Client-side entities only (server-only entities filtered out)

// Project (project)
export interface LiveStoreProject {
  /** Unique project identifier */
  id: string;
  /** Organization this project belongs to */
  organizationId: string;
  /** Project name */
  name: string;
  /** Project description */
  description?: text;
  /** Current project status */
  status: string;
  /** Project owner ID */
  ownerId?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  owner?: LiveStoreUser;
  tasks?: LiveStoreTask[];
  organization?: LiveStoreOrganization;
}

// Task (task)
export interface LiveStoreTask {
  /** Unique task identifier */
  id: string;
  /** Organization this task belongs to */
  organizationId: string;
  /** Project this task belongs to */
  projectId?: string;
  /** Task title */
  title: string;
  /** Task description */
  description?: text;
  /** Current task status */
  status: string;
  /** Task priority */
  priority: string;
  /** Assigned user ID */
  assigneeId?: string;
  /** Task due date */
  dueDate?: Date;
  /** Estimated duration in minutes */
  estimatedDuration?: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  project?: LiveStoreProject;
  assignee?: LiveStoreUser;
  comments?: LiveStoreComment[];
  organization?: LiveStoreOrganization;
}

// User (user)
export interface LiveStoreUser {
  /** Unique user identifier */
  id: string;
  /** User email address */
  /** @sensitive */
  email: string;
  /** User display name */
  name: string;
  /** User avatar image URL */
  image?: string;
  /** User role */
  role: string;
  /** Whether email is verified */
  emailVerified: boolean;
  /** Whether user is super admin */
  isSuperAdmin: boolean;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  assignedTasks?: LiveStoreTask[];
  ownedProjects?: LiveStoreProject[];
  comments?: LiveStoreComment[];
}

// Organization (organization)
export interface LiveStoreOrganization {
  /** Unique organization identifier */
  id: string;
  /** Organization name */
  name: string;
  /** Organization URL slug */
  slug: string;
  /** Organization description */
  description?: text;
  /** Organization tier */
  tier: string;
  /** Organization settings */
  settings?: any;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  projects?: LiveStoreProject[];
  tasks?: LiveStoreTask[];
}

