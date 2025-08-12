// Generated entities from MikroORM metadata

// ============================================
// Entity Interfaces
// ============================================

export interface User {
  id: any;
  createdAt: any;
  updatedAt: any;
  name: any;
  email?: any;
  emailVerified: any;
  image?: any;
  isSuperAdmin: any;
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

export interface LocalChanges {
  id: any;
  createdAt: any;
  updatedAt: any;
  table: any;
  recordId: any;
  operation: any;
  data: any;
  lsn?: any;
  clientSequence?: any;
  processedSync: any;
  sendAttempts: any;
  lastSendAttempt?: any;
  lastError?: any;
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

// ============================================
// Entity Classes
// ============================================

export class User implements User {}
export class task_tags implements task_tags {}
export class Task implements Task {}
export class TagSet implements TagSet {}
export class Tag implements Tag {}
export class StatusSet implements StatusSet {}
export class StatusDefinition implements StatusDefinition {}
export class project_tag_sets implements project_tag_sets {}
export class project_status_sets implements project_status_sets {}
export class Project implements Project {}
export class LocalChanges implements LocalChanges {}
export class EntityDependency implements EntityDependency {}
export class Comment implements Comment {}

// ============================================
// Table Name Mapping
// ============================================

export const tableNames = {
  User: 'users',
  task_tags: 'task_tags',
  Task: 'tasks',
  TagSet: 'tag_set',
  Tag: 'tag',
  StatusSet: 'status_set',
  StatusDefinition: 'status_definition',
  project_tag_sets: 'project_tag_sets',
  project_status_sets: 'project_status_sets',
  Project: 'projects',
  LocalChanges: 'local_changes',
  EntityDependency: 'entity_dependencies',
  Comment: 'comments',
} as const;

export type TableName = keyof typeof tableNames;
export type EntityType = User | task_tags | Task | TagSet | Tag | StatusSet | StatusDefinition | project_tag_sets | project_status_sets | Project | LocalChanges | EntityDependency | Comment;

// ============================================
// Domain Tables Configuration
// ============================================

export const CLIENT_DOMAIN_TABLES = [
  "comments",
  "entity_dependencies",
  "project_status_sets",
  "project_tag_sets",
  "projects",
  "status_definition",
  "status_set",
  "tag",
  "tag_set",
  "task_tags",
  "tasks",
  "users"
];

export const CLIENT_DOMAIN_TABLE_HIERARCHY = {
  "verifications": [],
  "users": [],
  "task_tags": [],
  "tasks": [
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
  "sessions": [],
  "project_tag_sets": [],
  "project_status_sets": [],
  "projects": [
    "project_tag_sets",
    "project_status_sets"
  ],
  "local_changes": [],
  "entity_dependencies": [],
  "comments": [],
  "change_history": [],
  "accounts": []
};

export const CLIENT_RELATIONSHIP_CONFIGS = {
  "users": {
    "account": {
      "target": "accounts"
    },
    "assignedTasks": {
      "target": "tasks"
    },
    "comments": {
      "target": "comments"
    },
    "ownedProjects": {
      "target": "projects"
    }
  },
  "tasks": {
    "project": {
      "target": "projects"
    },
    "assignee": {
      "target": "users"
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
      "target": "projects",
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
      "target": "tasks",
      "through": "task_tags"
    }
  },
  "status_set": {
    "statuses": {
      "target": "status_definition"
    },
    "projects": {
      "target": "projects",
      "through": "project_status_sets"
    }
  },
  "status_definition": {
    "statusSet": {
      "target": "status_set"
    }
  },
  "sessions": {
    "account": {
      "target": "accounts"
    }
  },
  "projects": {
    "owner": {
      "target": "users"
    },
    "tasks": {
      "target": "tasks"
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
      "target": "tasks"
    },
    "author": {
      "target": "users"
    }
  },
  "accounts": {
    "users": {
      "target": "users"
    },
    "sessions": {
      "target": "sessions"
    }
  }
};

export const CLIENT_JUNCTION_TABLE_MAPPING = {
  "task_tags": {
    "source": "tasks",
    "target": "tag"
  },
  "project_tag_sets": {
    "source": "projects",
    "target": "tag_set"
  },
  "project_status_sets": {
    "source": "projects",
    "target": "status_set"
  }
};

export function getEntityRelationships(entityName: string): any {
  return CLIENT_RELATIONSHIP_CONFIGS[entityName as keyof typeof CLIENT_RELATIONSHIP_CONFIGS] || {};
}

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
