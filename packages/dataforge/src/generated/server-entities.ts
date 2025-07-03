// Generated server entities - DO NOT EDIT

import { EntitySchema } from 'typeorm';
import { BaseDomainEntity } from '../entities/BaseDomainEntity.js';
import { BaseSystemEntity } from '../entities/BaseSystemEntity.js';

// Enum Imports (dynamically generated)
import { ProjectStatus } from '../entities/Project.js';
import { TaskPriority, TaskStatus } from '../entities/Task.js';
import { UserRole } from '../entities/User.js';


// Enum Exports
export { ProjectStatus } from '../entities/Project.js';
export { TaskPriority, TaskStatus } from '../entities/Task.js';
export { UserRole } from '../entities/User.js';


// Generated Classes (for type checking and validation)
export class Account extends BaseSystemEntity {
  userId!: string;

  accountId!: string;

  providerId!: string;

  accessToken?: string;

  refreshToken?: string;

  idToken?: string;

  accessTokenExpiresAt?: Date;

  refreshTokenExpiresAt?: Date;

  scope?: string;

  password?: string;

  updatedAt!: Date;

  user!: User;

}

export class ChangeHistory extends BaseSystemEntity {
  lsn!: string;

  tableName!: string;

  operation!: string;

  data?: any;

  timestamp!: Date;

}

export class ClientMigration extends BaseSystemEntity {
  migrationName!: string;

  schemaVersion!: string;

  upQueries!: string[];

  downQueries!: string[];

  description?: string;

  timestamp!: number;

}

export class Comment extends BaseDomainEntity {
  content!: string;

  authorId?: string;

  parentId?: string;

  taskId?: string;

  projectId?: string;

  author?: User;

  parent?: Comment;

  task?: Task;

  project?: Project;

}

export class Project extends BaseDomainEntity {
  name!: string;

  description?: string;

  status!: ProjectStatus;

  ownerId?: string;

  owner?: User;

  members!: User[];

  tasks!: Task[];

}

export class Session extends BaseSystemEntity {
  userId!: string;

  token!: string;

  expiresAt!: Date;

  ipAddress?: string;

  userAgent?: string;

  updatedAt!: Date;

  user!: User;

}

export class Task extends BaseDomainEntity {
  title!: string;

  description?: string;

  status!: TaskStatus;

  priority!: TaskPriority;

  dueDate?: Date;

  startDate?: Date;

  completedAt?: Date;

  timeRange?: any;

  estimatedDuration?: any;

  tags!: string[];

  projectId?: string;

  assigneeId?: string;

  project?: Project;

  assignee?: User;

  dependencies!: Task[];

  tasksDependentOnThis!: Task[];

}

export class User extends BaseDomainEntity {
  name!: string;

  email!: string;

  emailVerified!: boolean;

  image?: string;

  role!: UserRole;

  tasks!: Task[];

  ownedProjects!: Project[];

  memberProjects!: Project[];

  sessions!: Session[];

  accounts!: Account[];

}

export class Verification extends BaseSystemEntity {
  identifier!: string;

  value!: string;

  expiresAt!: Date;

  updatedAt!: Date;

}


// Entity Schemas (for TypeORM metadata)
// Schema for Account
export const AccountSchema = new EntitySchema<Account>({
    target: Account, // Link to generated class
    name: 'Account', 
    tableName: 'accounts',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'userId': {
            name: 'user_id', // Explicit DB Name
            type: 'uuid', // Use helper
        },
        'accountId': {
            name: 'account_id', // Explicit DB Name
            type: 'text', // Use helper
        },
        'providerId': {
            name: 'provider_id', // Explicit DB Name
            type: 'text', // Use helper
        },
        'accessToken': {
            name: 'access_token', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'refreshToken': {
            name: 'refresh_token', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'idToken': {
            name: 'id_token', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'accessTokenExpiresAt': {
            name: 'access_token_expires_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'refreshTokenExpiresAt': {
            name: 'refresh_token_expires_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'scope': {
            name: 'scope', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'password': {
            name: 'password', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'updatedAt': {
            name: 'updated_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            updateDate: true
        }
    },
    relations: {
        'user': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'user_id' }
        }
    },
});

// Schema for ChangeHistory
export const ChangeHistorySchema = new EntitySchema<ChangeHistory>({
    target: ChangeHistory, // Link to generated class
    name: 'ChangeHistory', 
    tableName: 'change_history',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'lsn': {
            name: 'lsn', // Explicit DB Name
            type: 'text', // Use helper
        },
        'tableName': {
            name: 'table_name', // Explicit DB Name
            type: 'text', // Use helper
        },
        'operation': {
            name: 'operation', // Explicit DB Name
            type: 'text', // Use helper
        },
        'data': {
            name: 'data', // Explicit DB Name
            type: 'jsonb', // Use helper
            nullable: true
        },
        'timestamp': {
            name: 'timestamp', // Explicit DB Name
            type: 'timestamptz', // Use helper
            createDate: true,
            default: undefined
        }
    },
    relations: {
    },
});

// Schema for ClientMigration
export const ClientMigrationSchema = new EntitySchema<ClientMigration>({
    target: ClientMigration, // Link to generated class
    name: 'ClientMigration', 
    tableName: 'client_migration',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'migrationName': {
            name: 'migration_name', // Explicit DB Name
            type: 'text', // Use helper
        },
        'schemaVersion': {
            name: 'schema_version', // Explicit DB Name
            type: 'text', // Use helper
        },
        'upQueries': {
            name: 'up_queries', // Explicit DB Name
            type: 'text', // Use helper
            array: true
        },
        'downQueries': {
            name: 'down_queries', // Explicit DB Name
            type: 'text', // Use helper
            array: true
        },
        'description': {
            name: 'description', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'timestamp': {
            name: 'timestamp', // Explicit DB Name
            type: 'bigint', // Use helper
        }
    },
    relations: {
    },
});

// Schema for Comment
export const CommentSchema = new EntitySchema<Comment>({
    target: Comment, // Link to generated class
    name: 'Comment', 
    tableName: 'comments',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'content': {
            name: 'content', // Explicit DB Name
            type: 'text', // Use helper
        },
        'authorId': {
            name: 'author_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        },
        'parentId': {
            name: 'parent_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        },
        'taskId': {
            name: 'task_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        },
        'projectId': {
            name: 'project_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        }
    },
    relations: {
        'author': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'author_id' },
            nullable: true
        },
        'parent': {
            target: 'Comment', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'parent_id' },
            nullable: true
        },
        'task': {
            target: 'Task', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'task_id' },
            nullable: true
        },
        'project': {
            target: 'Project', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'project_id' },
            nullable: true
        }
    },
});

// Schema for Project
export const ProjectSchema = new EntitySchema<Project>({
    target: Project, // Link to generated class
    name: 'Project', 
    tableName: 'projects',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'name': {
            name: 'name', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 100
        },
        'description': {
            name: 'description', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'status': {
            name: 'status', // Explicit DB Name
            type: 'enum', // Use helper
            default: "active",
            enum: ProjectStatus, // Use name from decorator
        },
        'ownerId': {
            name: 'owner_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        }
    },
    relations: {
        'owner': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'ownedProjects',
            joinColumn: { name: 'owner_id' },
            nullable: true
        },
        'members': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'memberProjects',
            joinTable: {
                name: 'project_members',
                joinColumns: [{ name: 'project_id', referencedColumnName: 'id' }],
                inverseJoinColumns: [{ name: 'user_id', referencedColumnName: 'id' }],
            }
        },
        'tasks': {
            target: 'Task', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'project'
        }
    },
});

// Schema for Session
export const SessionSchema = new EntitySchema<Session>({
    target: Session, // Link to generated class
    name: 'Session', 
    tableName: 'sessions',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'userId': {
            name: 'user_id', // Explicit DB Name
            type: 'uuid', // Use helper
        },
        'token': {
            name: 'token', // Explicit DB Name
            type: 'text', // Use helper
            unique: true
        },
        'expiresAt': {
            name: 'expires_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
        },
        'ipAddress': {
            name: 'ip_address', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'userAgent': {
            name: 'user_agent', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'updatedAt': {
            name: 'updated_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            updateDate: true
        }
    },
    relations: {
        'user': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-one',
            joinColumn: { name: 'user_id' }
        }
    },
});

// Schema for Task
export const TaskSchema = new EntitySchema<Task>({
    target: Task, // Link to generated class
    name: 'Task', 
    tableName: 'tasks',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'title': {
            name: 'title', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 100
        },
        'description': {
            name: 'description', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'status': {
            name: 'status', // Explicit DB Name
            type: 'enum', // Use helper
            default: "open",
            enum: TaskStatus, // Use name from decorator
        },
        'priority': {
            name: 'priority', // Explicit DB Name
            type: 'enum', // Use helper
            default: "medium",
            enum: TaskPriority, // Use name from decorator
        },
        'dueDate': {
            name: 'due_date', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'startDate': {
            name: 'start_date', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'completedAt': {
            name: 'completed_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'timeRange': {
            name: 'time_range', // Explicit DB Name
            type: 'tsrange', // Use helper
            nullable: true
        },
        'estimatedDuration': {
            name: 'estimated_duration', // Explicit DB Name
            type: 'interval', // Use helper
            nullable: true
        },
        'tags': {
            name: 'tags', // Explicit DB Name
            type: 'text', // Use helper
            default: [],
            array: true
        },
        'projectId': {
            name: 'project_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        },
        'assigneeId': {
            name: 'assignee_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        }
    },
    relations: {
        'project': {
            target: 'Project', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'tasks',
            joinColumn: { name: 'project_id' },
            nullable: true
        },
        'assignee': {
            target: 'User', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'tasks',
            joinColumn: { name: 'assignee_id' },
            nullable: true
        },
        'dependencies': {
            target: 'Task', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'tasksDependentOnThis',
            joinTable: {
                name: 'task_dependencies',
                joinColumns: [{ name: 'dependent_task_id', referencedColumnName: 'id' }],
                inverseJoinColumns: [{ name: 'dependency_task_id', referencedColumnName: 'id' }],
            }
        },
        'tasksDependentOnThis': {
            target: 'Task', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'dependencies'
        }
    },
});

// Schema for User
export const UserSchema = new EntitySchema<User>({
    target: User, // Link to generated class
    name: 'User', 
    tableName: 'users',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'name': {
            name: 'name', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 100
        },
        'email': {
            name: 'email', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 255,
            unique: true
        },
        'emailVerified': {
            name: 'email_verified', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'image': {
            name: 'image', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 255
        },
        'role': {
            name: 'role', // Explicit DB Name
            type: 'enum', // Use helper
            default: "member",
            enum: UserRole, // Use name from decorator
        }
    },
    relations: {
        'tasks': {
            target: 'Task', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'assignee'
        },
        'ownedProjects': {
            target: 'Project', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'owner'
        },
        'memberProjects': {
            target: 'Project', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'members'
        },
        'sessions': {
            target: 'Session', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'user'
        },
        'accounts': {
            target: 'Account', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'user'
        }
    },
});

// Schema for Verification
export const VerificationSchema = new EntitySchema<Verification>({
    target: Verification, // Link to generated class
    name: 'Verification', 
    tableName: 'verifications',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'identifier': {
            name: 'identifier', // Explicit DB Name
            type: 'text', // Use helper
        },
        'value': {
            name: 'value', // Explicit DB Name
            type: 'text', // Use helper
        },
        'expiresAt': {
            name: 'expires_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
        },
        'updatedAt': {
            name: 'updated_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            updateDate: true
        }
    },
    relations: {
    },
});


// Exports
// Export entity class array for TypeORM
export const serverEntities = [
  AccountSchema,
  ChangeHistorySchema,
  ClientMigrationSchema,
  CommentSchema,
  ProjectSchema,
  SessionSchema,
  TaskSchema,
  UserSchema,
  VerificationSchema,
];

// domain tables for server context
export const SERVER_DOMAIN_TABLES = [
  '"comments"',
  '"projects"',
  '"tasks"',
  '"users"',
];


/**
 * Provides entity dependency levels for 'SERVER_DOMAIN' tables, useful for ordered operations like seeding or data processing.
 * Key: Entity Class Name, Value: Level (0 = no dependencies/root, 1+ = depends on other tables).
 * Calculated based on many-to-one relationships.
 */
export const SERVER_DOMAIN_TABLE_HIERARCHY = {
  '"users"': 0,
  '"projects"': 1,
  '"tasks"': 2,
  '"comments"': 3,
} as const;

// system tables for server context
export const SERVER_SYSTEM_TABLES = [
  '"accounts"',
  '"change_history"',
  '"client_migration"',
  '"sessions"',
  '"verifications"',
];

// utility tables for server context
export const SERVER_UTILITY_TABLES = [
];

// Junction tables for server context
export const SERVER_JUNCTION_TABLES = [
  '"project_members"',
  '"task_dependencies"',
];

// Combined entity and junction tables for replication tracking
export const SERVER_TRACKED_TABLES = [
  '"comments"',
  '"projects"',
  '"tasks"',
  '"users"',
  '"project_members"',
  '"task_dependencies"',
];

// Junction table mapping for relationship transformation
export const SERVER_JUNCTION_TABLE_MAPPING = {
  "project_members": {
    sourceEntity: 'Project',
    sourceTable: '"projects"',
    sourceColumn: 'project_id',
    targetEntity: 'User',
    targetColumn: 'user_id',
    relationName: 'members'
  },
  "task_dependencies": {
    sourceEntity: 'Task',
    sourceTable: '"tasks"',
    sourceColumn: 'dependent_task_id',
    targetEntity: 'Task',
    targetColumn: 'dependency_task_id',
    relationName: 'dependencies'
  },
} as const;

// Auto-generated relationship configurations
// This provides configuration-driven relationship handling for entities
export interface RelationshipConfig {
  requiredReferences?: Array<{
    field: string;
    targetEntity: string;
    nullable?: boolean;
  }>;
  selfReferences?: Array<{
    field: string;
    allowCycles?: boolean;
    maxDepth?: number;
  }>;
  junctionRelationships?: Array<{
    junctionTable: string;
    relationName: string;
    sourceColumn: string;
    targetColumn: string;
    targetEntity: string;
  }>;
  customValidators?: Array<{
    name: string;
    validator: (data: Record<string, any>, operation: string) => void | Promise<void>;
  }>;
}

export const SERVER_RELATIONSHIP_CONFIGS: Record<string, RelationshipConfig> = {
  'accounts': {
    requiredReferences: [
      {
        field: 'userId',
        targetEntity: 'users',
      },
    ],
    customValidators: [],
  },
  'comments': {
    requiredReferences: [
      {
        field: 'authorId',
        targetEntity: 'users',
        nullable: true,
      },
      {
        field: 'taskId',
        targetEntity: 'tasks',
        nullable: true,
      },
      {
        field: 'projectId',
        targetEntity: 'projects',
        nullable: true,
      },
    ],
    selfReferences: [
      {
        field: 'parentId',
        allowCycles: false,
        maxDepth: 5,
      },
    ],
    customValidators: [],
  },
  'projects': {
    requiredReferences: [
      {
        field: 'ownerId',
        targetEntity: 'users',
        nullable: true,
      },
    ],
    junctionRelationships: [
      {
        junctionTable: 'project_members',
        relationName: 'members',
        sourceColumn: 'project_id',
        targetColumn: 'user_id',
        targetEntity: 'users',
      },
    ],
    customValidators: [],
  },
  'sessions': {
    requiredReferences: [
      {
        field: 'userId',
        targetEntity: 'users',
      },
    ],
    customValidators: [],
  },
  'tasks': {
    requiredReferences: [
      {
        field: 'projectId',
        targetEntity: 'projects',
        nullable: true,
      },
      {
        field: 'assigneeId',
        targetEntity: 'users',
        nullable: true,
      },
    ],
    junctionRelationships: [
      {
        junctionTable: 'task_dependencies',
        relationName: 'dependencies',
        sourceColumn: 'dependent_task_id',
        targetColumn: 'dependency_task_id',
        targetEntity: 'tasks',
      },
    ],
    customValidators: [],
  },
  'users': {
    customValidators: [],
  },
} as const;

// Helper functions for relationship processing
export function getEntityRelationships(entityName: string): RelationshipConfig | undefined {
  return SERVER_RELATIONSHIP_CONFIGS[entityName];
}

export function hasRelationshipConfig(entityName: string): boolean {
  return entityName in SERVER_RELATIONSHIP_CONFIGS;
}

export function getJunctionRelationships(entityName: string): Array<{
  junctionTable: string;
  relationName: string;
  sourceColumn: string;
  targetColumn: string;
  targetEntity: string;
}> {
  const config = SERVER_RELATIONSHIP_CONFIGS[entityName];
  return config?.junctionRelationships || [];
}

