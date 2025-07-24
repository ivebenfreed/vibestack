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

  parent?: Promise<Comment>;

  task?: Task;

  project?: Project;

}

export class JWKS extends BaseSystemEntity {
  publicKey!: string;

  privateKey!: string;

}

export class Project extends BaseDomainEntity {
  name!: string;

  description?: string;

  status!: ProjectStatus;

  ownerId?: string;

  owner?: User;

  members!: User[];

  tasks!: Task[];

  statusSets!: StatusSet[];

  tagSets!: TagSet[];

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

export class StatusDefinition extends BaseDomainEntity {
  statusSetId!: string;

  name!: string;

  label!: string;

  color!: string;

  icon?: string;

  variant?: string;

  sortOrder!: number;

  isDefault!: boolean;

  isFinal!: boolean;

  isActive!: boolean;

  allowedTransitions?: string[];

  autoTransitionDays?: number;

  metadata!: any;

  statusSet!: StatusSet;

  tasks!: Task[];

}

export class StatusSet extends BaseDomainEntity {
  name!: string;

  entityType!: string;

  description?: string;

  isSystem!: boolean;

  isActive!: boolean;

  defaultColor?: string;

  displayOrder!: number;

  metadata!: any;

  statuses!: StatusDefinition[];

  projects!: Project[];

}

export class Tag extends BaseDomainEntity {
  tagSetId!: string;

  name!: string;

  slug!: string;

  color!: string;

  icon?: string;

  variant!: string;

  sortOrder!: number;

  parentId?: string;

  isActive!: boolean;

  usageCount!: number;

  lastUsedAt?: Date;

  metadata!: any;

  tagSet!: TagSet;

  parent?: Promise<Tag>;

  children!: Promise<Tag[]>;

  tasks!: Task[];

}

export class TagSet extends BaseDomainEntity {
  name!: string;

  description?: string;

  category?: string;

  isSystem!: boolean;

  isActive!: boolean;

  defaultColor!: string;

  displayOrder!: number;

  isExclusive!: boolean;

  maxTags?: number;

  metadata!: any;

  tags!: Tag[];

  projects!: Project[];

}

export class Task extends BaseDomainEntity {
  title!: string;

  description?: string;

  legacyStatus?: TaskStatus;

  statusId?: string;

  priority!: TaskPriority;

  dueDate?: Date;

  startDate?: Date;

  completedAt?: Date;

  timeRange?: any;

  estimatedDuration?: any;

  legacyTags?: string[];

  projectId?: string;

  assigneeId?: string;

  status!: StatusDefinition;

  tags!: Tag[];

  project?: Project;

  assignee?: User;

  dependencies!: Promise<Task[]>;

  tasksDependentOnThis!: Promise<Task[]>;

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

// Schema for JWKS
export const JWKSSchema = new EntitySchema<JWKS>({
    target: JWKS, // Link to generated class
    name: 'JWKS', 
    tableName: 'jwks',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        'publicKey': {
            name: 'publicKey', // Explicit DB Name
            type: 'text', // Use helper
        },
        'privateKey': {
            name: 'privateKey', // Explicit DB Name
            type: 'text', // Use helper
        }
    },
    relations: {
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
        },
        'statusSets': {
            target: 'StatusSet', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'projects',
            joinTable: {
                name: 'project_status_sets',
                joinColumns: [{ name: 'project_id', referencedColumnName: 'id' }],
                inverseJoinColumns: [{ name: 'status_set_id', referencedColumnName: 'id' }],
            }
        },
        'tagSets': {
            target: 'TagSet', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'projects',
            joinTable: {
                name: 'project_tag_sets',
                joinColumns: [{ name: 'project_id', referencedColumnName: 'id' }],
                inverseJoinColumns: [{ name: 'tag_set_id', referencedColumnName: 'id' }],
            }
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

// Schema for StatusDefinition
export const StatusDefinitionSchema = new EntitySchema<StatusDefinition>({
    target: StatusDefinition, // Link to generated class
    name: 'StatusDefinition', 
    tableName: 'status_definitions',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'statusSetId': {
            name: 'status_set_id', // Explicit DB Name
            type: 'uuid', // Use helper
        },
        'name': {
            name: 'name', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 50
        },
        'label': {
            name: 'label', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 100
        },
        'color': {
            name: 'color', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 7
        },
        'icon': {
            name: 'icon', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 50
        },
        'variant': {
            name: 'variant', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 20
        },
        'sortOrder': {
            name: 'sort_order', // Explicit DB Name
            type: 'int', // Use helper
        },
        'isDefault': {
            name: 'is_default', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'isFinal': {
            name: 'is_final', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'isActive': {
            name: 'is_active', // Explicit DB Name
            type: 'boolean', // Use helper
            default: true
        },
        'allowedTransitions': {
            name: 'allowed_transitions', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true,
            array: true
        },
        'autoTransitionDays': {
            name: 'auto_transition_days', // Explicit DB Name
            type: 'int', // Use helper
            nullable: true
        },
        'metadata': {
            name: 'metadata', // Explicit DB Name
            type: 'jsonb', // Use helper
            default: {}
        }
    },
    relations: {
        'statusSet': {
            target: 'StatusSet', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'statuses',
            joinColumn: { name: 'status_set_id' }
        },
        'tasks': {
            target: 'Task', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'status'
        }
    },
});

// Schema for StatusSet
export const StatusSetSchema = new EntitySchema<StatusSet>({
    target: StatusSet, // Link to generated class
    name: 'StatusSet', 
    tableName: 'status_sets',
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
        'entityType': {
            name: 'entityType', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 50
        },
        'description': {
            name: 'description', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true
        },
        'isSystem': {
            name: 'isSystem', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'isActive': {
            name: 'isActive', // Explicit DB Name
            type: 'boolean', // Use helper
            default: true
        },
        'defaultColor': {
            name: 'default_color', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 7
        },
        'displayOrder': {
            name: 'display_order', // Explicit DB Name
            type: 'int', // Use helper
            default: 0
        },
        'metadata': {
            name: 'metadata', // Explicit DB Name
            type: 'jsonb', // Use helper
            default: {}
        }
    },
    relations: {
        'statuses': {
            target: 'StatusDefinition', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'statusSet'
        },
        'projects': {
            target: 'Project', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'statusSets'
        }
    },
});

// Schema for Tag
export const TagSchema = new EntitySchema<Tag>({
    target: Tag, // Link to generated class
    name: 'Tag', 
    tableName: 'tags',
    columns: {
        id: { name: 'id', type: 'uuid', primary: true, generated: 'uuid' },
        createdAt: { name: 'created_at', type: 'timestamptz', createDate: true },
        updatedAt: { name: 'updated_at', type: 'timestamptz', updateDate: true },
        clientId: { name: 'client_id', type: 'uuid', nullable: true },
        'tagSetId': {
            name: 'tag_set_id', // Explicit DB Name
            type: 'uuid', // Use helper
        },
        'name': {
            name: 'name', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 50
        },
        'slug': {
            name: 'slug', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 50,
            unique: true
        },
        'color': {
            name: 'color', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 7
        },
        'icon': {
            name: 'icon', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 50
        },
        'variant': {
            name: 'variant', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 20,
            default: "solid"
        },
        'sortOrder': {
            name: 'sort_order', // Explicit DB Name
            type: 'int', // Use helper
            default: 0
        },
        'parentId': {
            name: 'parent_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
        },
        'isActive': {
            name: 'is_active', // Explicit DB Name
            type: 'boolean', // Use helper
            default: true
        },
        'usageCount': {
            name: 'usage_count', // Explicit DB Name
            type: 'int', // Use helper
            default: 0
        },
        'lastUsedAt': {
            name: 'last_used_at', // Explicit DB Name
            type: 'timestamptz', // Use helper
            nullable: true
        },
        'metadata': {
            name: 'metadata', // Explicit DB Name
            type: 'jsonb', // Use helper
            default: {}
        }
    },
    relations: {
        'tagSet': {
            target: 'TagSet', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'tags',
            joinColumn: { name: 'tag_set_id' }
        },
        'parent': {
            target: 'Tag', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'children',
            joinColumn: { name: 'parent_id' },
            nullable: true
        },
        'children': {
            target: 'Tag', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'parent'
        },
        'tasks': {
            target: 'Task', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'tags'
        }
    },
});

// Schema for TagSet
export const TagSetSchema = new EntitySchema<TagSet>({
    target: TagSet, // Link to generated class
    name: 'TagSet', 
    tableName: 'tag_sets',
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
        'category': {
            name: 'category', // Explicit DB Name
            type: 'varchar', // Use helper
            nullable: true,
            length: 50
        },
        'isSystem': {
            name: 'is_system', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'isActive': {
            name: 'is_active', // Explicit DB Name
            type: 'boolean', // Use helper
            default: true
        },
        'defaultColor': {
            name: 'default_color', // Explicit DB Name
            type: 'varchar', // Use helper
            length: 7,
            default: "#94a3b8"
        },
        'displayOrder': {
            name: 'display_order', // Explicit DB Name
            type: 'int', // Use helper
            default: 0
        },
        'isExclusive': {
            name: 'is_exclusive', // Explicit DB Name
            type: 'boolean', // Use helper
            default: false
        },
        'maxTags': {
            name: 'max_tags', // Explicit DB Name
            type: 'int', // Use helper
            nullable: true
        },
        'metadata': {
            name: 'metadata', // Explicit DB Name
            type: 'jsonb', // Use helper
            default: {}
        }
    },
    relations: {
        'tags': {
            target: 'Tag', // Target Entity Name (String)
            type: 'one-to-many',
            inverseSide: 'tagSet'
        },
        'projects': {
            target: 'Project', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'tagSets'
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
        'legacyStatus': {
            name: 'legacy_status', // Explicit DB Name
            type: 'enum', // Use helper
            nullable: true,
            default: "open",
            enum: TaskStatus, // Use name from decorator
        },
        'statusId': {
            name: 'status_id', // Explicit DB Name
            type: 'uuid', // Use helper
            nullable: true
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
        'legacyTags': {
            name: 'legacy_tags', // Explicit DB Name
            type: 'text', // Use helper
            nullable: true,
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
        'status': {
            target: 'StatusDefinition', // Target Entity Name (String)
            type: 'many-to-one',
            inverseSide: 'tasks',
            joinColumn: { name: 'status_id' }
        },
        'tags': {
            target: 'Tag', // Target Entity Name (String)
            type: 'many-to-many',
            inverseSide: 'tasks',
            joinTable: {
                name: 'task_tags',
                joinColumns: [{ name: 'task_id', referencedColumnName: 'id' }],
                inverseJoinColumns: [{ name: 'tag_id', referencedColumnName: 'id' }],
            }
        },
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
  JWKSSchema,
  ProjectSchema,
  SessionSchema,
  StatusDefinitionSchema,
  StatusSetSchema,
  TagSchema,
  TagSetSchema,
  TaskSchema,
  UserSchema,
  VerificationSchema,
];

// domain tables for server context
export const SERVER_DOMAIN_TABLES = [
  '"comments"',
  '"projects"',
  '"status_definitions"',
  '"status_sets"',
  '"tags"',
  '"tag_sets"',
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
  '"status_sets"': 0,
  '"status_definitions"': 1,
  '"projects"': 1,
  '"tasks"': 2,
  '"comments"': 3,
  '"tag_sets"': 0,
  '"tags"': 1,
} as const;

// system tables for server context
export const SERVER_SYSTEM_TABLES = [
  '"accounts"',
  '"change_history"',
  '"client_migration"',
  '"jwks"',
  '"sessions"',
  '"verifications"',
];

// utility tables for server context
export const SERVER_UTILITY_TABLES = [
];

// Junction tables for server context
export const SERVER_JUNCTION_TABLES = [
  '"project_members"',
  '"project_status_sets"',
  '"project_tag_sets"',
  '"task_dependencies"',
  '"task_tags"',
];

// Combined entity and junction tables for replication tracking
export const SERVER_TRACKED_TABLES = [
  '"comments"',
  '"projects"',
  '"status_definitions"',
  '"status_sets"',
  '"tags"',
  '"tag_sets"',
  '"tasks"',
  '"users"',
  '"project_members"',
  '"project_status_sets"',
  '"project_tag_sets"',
  '"task_dependencies"',
  '"task_tags"',
];

// Junction table mapping for relationship transformation
export const SERVER_JUNCTION_TABLE_MAPPING = {
  "project_members": {
    sourceEntity: 'Project',
    sourceTable: '"projects"',
    sourceColumn: 'projectId',
    targetEntity: 'User',
    targetColumn: 'userId',
    relationName: 'members'
  },
  "project_status_sets": {
    sourceEntity: 'Project',
    sourceTable: '"projects"',
    sourceColumn: 'projectId',
    targetEntity: 'StatusSet',
    targetColumn: 'statusSetId',
    relationName: 'statusSets'
  },
  "project_tag_sets": {
    sourceEntity: 'Project',
    sourceTable: '"projects"',
    sourceColumn: 'projectId',
    targetEntity: 'TagSet',
    targetColumn: 'tagSetId',
    relationName: 'tagSets'
  },
  "task_tags": {
    sourceEntity: 'Task',
    sourceTable: '"tasks"',
    sourceColumn: 'taskId',
    targetEntity: 'Tag',
    targetColumn: 'tagId',
    relationName: 'tags'
  },
  "task_dependencies": {
    sourceEntity: 'Task',
    sourceTable: '"tasks"',
    sourceColumn: 'dependentTaskId',
    targetEntity: 'Task',
    targetColumn: 'dependencyTaskId',
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
        sourceColumn: 'projectId',
        targetColumn: 'userId',
        targetEntity: 'users',
      },
      {
        junctionTable: 'project_status_sets',
        relationName: 'statusSets',
        sourceColumn: 'projectId',
        targetColumn: 'statusSetId',
        targetEntity: 'statussets',
      },
      {
        junctionTable: 'project_tag_sets',
        relationName: 'tagSets',
        sourceColumn: 'projectId',
        targetColumn: 'tagSetId',
        targetEntity: 'tagsets',
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
  'statusdefinitions': {
    requiredReferences: [
      {
        field: 'statusSetId',
        targetEntity: 'statussets',
      },
    ],
    customValidators: [],
  },
  'statussets': {
    customValidators: [],
  },
  'tags': {
    requiredReferences: [
      {
        field: 'tagSetId',
        targetEntity: 'tagsets',
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
  'tagsets': {
    customValidators: [],
  },
  'tasks': {
    requiredReferences: [
      {
        field: 'statusId',
        targetEntity: 'statusdefinitions',
      },
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
        junctionTable: 'task_tags',
        relationName: 'tags',
        sourceColumn: 'taskId',
        targetColumn: 'tagId',
        targetEntity: 'tags',
      },
      {
        junctionTable: 'task_dependencies',
        relationName: 'dependencies',
        sourceColumn: 'dependentTaskId',
        targetColumn: 'dependencyTaskId',
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

