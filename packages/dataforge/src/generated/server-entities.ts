// Generated entities from MikroORM metadata

// ============================================
// Entity Interfaces
// ============================================

export interface Verification {
  id: any;
  createdAt: any;
  updatedAt: any;
  identifier: any;
  value: any;
  expiresAt: any;
}

export interface User {
  id: any;
  createdAt: any;
  updatedAt: any;
  name: any;
  email?: any;
  emailVerified: any;
  image?: any;
  isSuperAdmin: any;
  role: any;
  accounts: any;
  sessions: any;
  assignedTasks: any;
  comments: any;
  ownedProjects: any;
}

export interface task_tags {
  Task_owner: any;
  Tag_inverse: any;
}

export interface Task {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  title: any;
  description?: any;
  legacyStatus?: any;
  priority: any;
  dueDate?: any;
  startDate?: any;
  completedAt?: any;
  timeRange?: any;
  estimatedDuration?: any;
  legacyTags?: any;
  project?: any;
  assignee?: any;
  comments: any;
  tags: any;
}

export interface TagSet {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  name: any;
  description?: any;
  category?: any;
  isSystem: any;
  isActive: any;
  defaultColor: any;
  displayOrder: any;
  isExclusive: any;
  maxTags?: any;
  metadata: any;
  tags: any;
  projects: any;
}

export interface Tag {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  name: any;
  slug: any;
  color: any;
  icon?: any;
  variant: any;
  sortOrder: any;
  isActive: any;
  usageCount: any;
  lastUsedAt?: any;
  metadata: any;
  tagSet: any;
  parent?: any;
  children: any;
  tasks: any;
}

export interface StatusSet {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  name: any;
  description?: any;
  entityType: any;
  isDefault: any;
  isActive: any;
  isSystem: any;
  workflow: any;
  metadata: any;
  statuses: any;
  projects: any;
}

export interface StatusDefinition {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  name: any;
  label: any;
  color: any;
  icon?: any;
  variant?: any;
  sortOrder: any;
  isDefault: any;
  isFinal: any;
  isActive: any;
  allowedTransitions?: any;
  autoTransitionDays?: any;
  metadata: any;
  statusSet: any;
}

export interface Session {
  id: any;
  createdAt: any;
  updatedAt: any;
  user: any;
  token: any;
  expiresAt: any;
  ipAddress?: any;
  userAgent?: any;
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
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  name: any;
  description?: any;
  status: any;
  owner?: any;
  tasks: any;
  tagSets: any;
  statusSets: any;
}

export interface EntityDependency {
  id: any;
  createdAt: any;
  updatedAt: any;
  fromTable: any;
  fromId: any;
  toTable: any;
  toId: any;
  dependencyType: any;
  metadata?: any;
}

export interface Comment {
  id: any;
  createdAt: any;
  updatedAt: any;
  clientId?: any;
  content: any;
  task: any;
  author?: any;
}

export interface ChangeHistory {
  id: any;
  createdAt: any;
  updatedAt: any;
  lsn: any;
  tableName: any;
  operation: any;
  data?: any;
  timestamp: any;
}

export interface Account {
  id: any;
  createdAt: any;
  updatedAt: any;
  user: any;
  providerId: any;
  accountId: any;
  password?: any;
  refreshToken?: any;
  accessToken?: any;
  accessTokenExpiresAt?: any;
  refreshTokenExpiresAt?: any;
  tokenType?: any;
  scope?: any;
  idToken?: any;
  sessionState?: any;
}

// ============================================
// Entity Classes
// ============================================

export class Verification implements Verification {}
export class User implements User {}
export class task_tags implements task_tags {}
export class Task implements Task {}
export class TagSet implements TagSet {}
export class Tag implements Tag {}
export class StatusSet implements StatusSet {}
export class StatusDefinition implements StatusDefinition {}
export class Session implements Session {}
export class project_tag_sets implements project_tag_sets {}
export class project_status_sets implements project_status_sets {}
export class Project implements Project {}
export class EntityDependency implements EntityDependency {}
export class Comment implements Comment {}
export class ChangeHistory implements ChangeHistory {}
export class Account implements Account {}

// ============================================
// Table Name Mapping
// ============================================

export const tableNames = {
  Verification: 'verification',
  User: 'user',
  task_tags: 'task_tags',
  Task: 'task',
  TagSet: 'tag_set',
  Tag: 'tag',
  StatusSet: 'status_set',
  StatusDefinition: 'status_definition',
  Session: 'session',
  project_tag_sets: 'project_tag_sets',
  project_status_sets: 'project_status_sets',
  Project: 'project',
  EntityDependency: 'entity_dependencies',
  Comment: 'comments',
  ChangeHistory: 'change_history',
  Account: 'account',
} as const;

export type TableName = keyof typeof tableNames;
export type EntityType = Verification | User | task_tags | Task | TagSet | Tag | StatusSet | StatusDefinition | Session | project_tag_sets | project_status_sets | Project | EntityDependency | Comment | ChangeHistory | Account;

// ============================================
// Domain Tables Configuration
// ============================================

export const SERVER_DOMAIN_TABLES = [
  "account",
  "comments",
  "entity_dependencies",
  "project",
  "project_status_sets",
  "project_tag_sets",
  "session",
  "status_definition",
  "status_set",
  "tag",
  "tag_set",
  "task",
  "task_tags",
  "user",
  "verification"
];

export const SERVER_DOMAIN_TABLE_HIERARCHY = {
  "verification": [],
  "user": [],
  "task_tags": [],
  "task": [
    "task_tags"
  ],
  "tag_set": [
    "project_tag_sets"
  ],
  "tag": [
    "task_tags"
  ],
  "status_set": [
    "project_status_sets"
  ],
  "status_definition": [],
  "session": [],
  "project_tag_sets": [],
  "project_status_sets": [],
  "project": [
    "project_tag_sets",
    "project_status_sets"
  ],
  "local_changes": [],
  "entity_dependencies": [],
  "comments": [],
  "change_history": [],
  "account": []
};

export const SERVER_RELATIONSHIP_CONFIGS = {
  "user": {
    "accounts": {
      "target": "account"
    },
    "sessions": {
      "target": "session"
    },
    "assignedTasks": {
      "target": "task"
    },
    "comments": {
      "target": "comments"
    },
    "ownedProjects": {
      "target": "project"
    }
  },
  "task": {
    "project": {
      "target": "project"
    },
    "assignee": {
      "target": "user"
    },
    "comments": {
      "target": "comments"
    },
    "tags": {
      "target": "tag",
      "through": "task_tags"
    }
  },
  "tag_set": {
    "tags": {
      "target": "tag"
    },
    "projects": {
      "target": "project",
      "through": "project_tag_sets"
    }
  },
  "tag": {
    "tagSet": {
      "target": "tag_set"
    },
    "parent": {
      "target": "tag"
    },
    "children": {
      "target": "tag"
    },
    "tasks": {
      "target": "task",
      "through": "task_tags"
    }
  },
  "status_set": {
    "statuses": {
      "target": "status_definition"
    },
    "projects": {
      "target": "project",
      "through": "project_status_sets"
    }
  },
  "status_definition": {
    "statusSet": {
      "target": "status_set"
    }
  },
  "session": {
    "user": {
      "target": "user"
    }
  },
  "project": {
    "owner": {
      "target": "user"
    },
    "tasks": {
      "target": "task"
    },
    "tagSets": {
      "target": "tag_set",
      "through": "project_tag_sets"
    },
    "statusSets": {
      "target": "status_set",
      "through": "project_status_sets"
    }
  },
  "comments": {
    "task": {
      "target": "task"
    },
    "author": {
      "target": "user"
    }
  },
  "account": {
    "user": {
      "target": "user"
    }
  }
};

export const SERVER_TRACKED_TABLES = SERVER_DOMAIN_TABLES;

export const SERVER_JUNCTION_TABLE_MAPPING = {
  "task_tags": {
    "source": "task",
    "target": "tag"
  },
  "project_tag_sets": {
    "source": "project",
    "target": "tag_set"
  },
  "project_status_sets": {
    "source": "project",
    "target": "status_set"
  }
};

// Placeholder enums for backward compatibility
// TODO: Extract these from entity definitions or remove deprecated usage
export const TaskStatus = {
  OPEN: 'open',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;
export type TaskStatus = typeof TaskStatus[keyof typeof TaskStatus];

export const TaskPriority = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
} as const;
export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export const ProjectStatus = {
  ACTIVE: 'active',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  ON_HOLD: 'on_hold',
} as const;
export type ProjectStatus = typeof ProjectStatus[keyof typeof ProjectStatus];

export const UserRole = {
  USER: 'user',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;
export type UserRole = typeof UserRole[keyof typeof UserRole];

export const DependencyType = {
  FINISH_TO_START: 'finish-to-start',
  START_TO_START: 'start-to-start',
  FINISH_TO_FINISH: 'finish-to-finish',
  START_TO_FINISH: 'start-to-finish',
} as const;
export type DependencyType = typeof DependencyType[keyof typeof DependencyType];

export class ClientMigration {}
