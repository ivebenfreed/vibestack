// Generated sync metadata from MikroORM entities
// This file is used by the generic sync engine

export interface TableSyncMetadata {
  tableName: string;
  className: string;
  category: 'domain' | 'system' | 'auth';
  features: {
    hasClientId: boolean;
    hasVersion: boolean;
    hasSoftDelete: boolean;
    hasCreatedBy: boolean;
    hasUpdatedBy: boolean;
  };
  columns: {
    id: string;
    clientId: string | null;
    version: string | null;
    deleted: string | null;
    createdAt: string;
    updatedAt: string;
  };
  updateableColumns: string[];
  foreignKeys: Array<{
    property: string;
    targetEntity: string;
    columnName: string;
  }>;
  indexes: Array<{
    properties: string[];
    unique: boolean;
  }>;
  conflictResolution: string;
  syncable: boolean;
  trackChanges: boolean;
}

export const syncMetadata: Record<string, TableSyncMetadata> = {
  "Verification": {
    "tableName": "verifications",
    "className": "Verification",
    "category": "auth",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "identifier",
      "value",
      "expiresAt"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "User": {
    "tableName": "users",
    "className": "User",
    "category": "system",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "name",
      "email",
      "emailVerified",
      "image",
      "isSuperAdmin",
      "account"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "Task": {
    "tableName": "tasks",
    "className": "Task",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "title",
      "description",
      "legacyStatus",
      "priority",
      "dueDate",
      "startDate",
      "completedAt",
      "timeRange",
      "estimatedDuration",
      "legacyTags",
      "project",
      "assignee",
      "tags"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "TagSet": {
    "tableName": "tag_sets",
    "className": "TagSet",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "name",
      "description",
      "category",
      "isSystem",
      "isActive",
      "defaultColor",
      "displayOrder",
      "isExclusive",
      "maxTags",
      "metadata"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "displayOrder"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "Tag": {
    "tableName": "tags",
    "className": "Tag",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "name",
      "slug",
      "color",
      "icon",
      "variant",
      "sortOrder",
      "isActive",
      "usageCount",
      "lastUsedAt",
      "metadata",
      "tagSet",
      "parent"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "tagSet",
          "sortOrder"
        ],
        "unique": false
      },
      {
        "properties": [
          "slug"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "StatusSet": {
    "tableName": "status_sets",
    "className": "StatusSet",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "name",
      "description",
      "entityType",
      "isDefault",
      "isActive",
      "isSystem",
      "workflow",
      "metadata"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "entityType"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "StatusDefinition": {
    "tableName": "status_definitions",
    "className": "StatusDefinition",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "name",
      "label",
      "color",
      "icon",
      "variant",
      "sortOrder",
      "isDefault",
      "isFinal",
      "isActive",
      "allowedTransitions",
      "autoTransitionDays",
      "metadata",
      "statusSet"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "name"
        ],
        "unique": false
      },
      {
        "properties": [
          "statusSet",
          "sortOrder"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "Session": {
    "tableName": "sessions",
    "className": "Session",
    "category": "auth",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "sessionToken",
      "expiresAt",
      "account"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "Project": {
    "tableName": "projects",
    "className": "Project",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "name",
      "description",
      "status",
      "owner",
      "tagSets",
      "statusSets"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "LocalChanges": {
    "tableName": "local_changes",
    "className": "LocalChanges",
    "category": "system",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "table",
      "recordId",
      "operation",
      "data",
      "lsn",
      "clientSequence",
      "processedSync",
      "sendAttempts",
      "lastSendAttempt",
      "lastError"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "table",
          "recordId"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "EntityDependency": {
    "tableName": "entity_dependencies",
    "className": "EntityDependency",
    "category": "system",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "fromTable",
      "fromId",
      "toTable",
      "toId",
      "dependencyType",
      "metadata"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "toTable",
          "toId"
        ],
        "unique": false
      },
      {
        "properties": [
          "fromTable",
          "fromId"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "Comment": {
    "tableName": "comments",
    "className": "Comment",
    "category": "domain",
    "features": {
      "hasClientId": true,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": "client_id",
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "clientId",
      "content",
      "task",
      "author"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "client_id",
    "syncable": true,
    "trackChanges": true
  },
  "ChangeHistory": {
    "tableName": "change_history",
    "className": "ChangeHistory",
    "category": "system",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "lsn",
      "tableName",
      "operation",
      "data",
      "timestamp"
    ],
    "foreignKeys": [],
    "indexes": [
      {
        "properties": [
          "tableName",
          "timestamp"
        ],
        "unique": false
      },
      {
        "properties": [
          "lsn"
        ],
        "unique": false
      }
    ],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  },
  "Account": {
    "tableName": "accounts",
    "className": "Account",
    "category": "auth",
    "features": {
      "hasClientId": false,
      "hasVersion": false,
      "hasSoftDelete": false,
      "hasCreatedBy": false,
      "hasUpdatedBy": false
    },
    "columns": {
      "id": "id",
      "clientId": null,
      "version": null,
      "deleted": null,
      "createdAt": "created_at",
      "updatedAt": "updated_at"
    },
    "updateableColumns": [
      "updatedAt",
      "providerId",
      "providerAccountId",
      "refreshToken",
      "accessToken",
      "expiresAt",
      "tokenType",
      "scope",
      "idToken",
      "sessionState"
    ],
    "foreignKeys": [],
    "indexes": [],
    "conflictResolution": "id",
    "syncable": false,
    "trackChanges": false
  }
};

export interface JunctionTable {
  tableName: string;
  className: string;
  columns: Array<{ name: string; type: string }>;
  indexes: any[];
}

export const junctionTables: JunctionTable[] = [
  {
    "tableName": "task_tags",
    "className": "task_tags",
    "columns": [
      {
        "name": "task_id",
        "type": "Task"
      },
      {
        "name": "tag_id",
        "type": "Tag"
      }
    ],
    "indexes": []
  },
  {
    "tableName": "project_tag_sets",
    "className": "project_tag_sets",
    "columns": [
      {
        "name": "project_id",
        "type": "Project"
      },
      {
        "name": "tag_set_id",
        "type": "TagSet"
      }
    ],
    "indexes": []
  },
  {
    "tableName": "project_status_sets",
    "className": "project_status_sets",
    "columns": [
      {
        "name": "project_id",
        "type": "Project"
      },
      {
        "name": "status_set_id",
        "type": "StatusSet"
      }
    ],
    "indexes": []
  }
];

// Helper functions for sync engine
export function getTableMetadata(entityName: string): TableSyncMetadata | undefined {
  return syncMetadata[entityName];
}

export function getTableByName(tableName: string): TableSyncMetadata | undefined {
  return Object.values(syncMetadata).find(m => m.tableName === tableName);
}

export function getSyncableTables(): TableSyncMetadata[] {
  return Object.values(syncMetadata).filter(m => m.syncable);
}

export function getDomainTables(): string[] {
  return Object.values(syncMetadata)
    .filter(m => m.category === 'domain')
    .map(m => m.tableName);
}

export function getSystemTables(): string[] {
  return Object.values(syncMetadata)
    .filter(m => m.category === 'system')
    .map(m => m.tableName);
}

export function hasClientId(tableName: string): boolean {
  const meta = getTableByName(tableName);
  return meta?.features.hasClientId || false;
}

export function hasSoftDelete(tableName: string): boolean {
  const meta = getTableByName(tableName);
  return meta?.features.hasSoftDelete || false;
}

// Type-safe table name lookup
export type EntityClassName = 'Verification' | 'User' | 'Task' | 'TagSet' | 'Tag' | 'StatusSet' | 'StatusDefinition' | 'Session' | 'Project' | 'LocalChanges' | 'EntityDependency' | 'Comment' | 'ChangeHistory' | 'Account';
export type TableName = 'verifications' | 'users' | 'tasks' | 'tag_sets' | 'tags' | 'status_sets' | 'status_definitions' | 'sessions' | 'projects' | 'local_changes' | 'entity_dependencies' | 'comments' | 'change_history' | 'accounts';

export const entityClassNames = ["Verification","User","Task","TagSet","Tag","StatusSet","StatusDefinition","Session","Project","LocalChanges","EntityDependency","Comment","ChangeHistory","Account"] as const;
export const tableNames = ["verifications","users","tasks","tag_sets","tags","status_sets","status_definitions","sessions","projects","local_changes","entity_dependencies","comments","change_history","accounts"] as const;

// Export domain and junction tables for sync
export const DOMAIN_TABLES = ["tasks","tag_sets","tags","status_sets","status_definitions","projects","comments"] as const;
export const JUNCTION_TABLE_NAMES = ["task_tags","project_tag_sets","project_status_sets"] as const;
export const TRACKED_TABLES = [...DOMAIN_TABLES, ...JUNCTION_TABLE_NAMES] as const;

// Table hierarchy for ordered sync
export const TABLE_HIERARCHY = {
  "tag_sets": [],
  "tags": [],
  "status_sets": [],
  "status_definitions": [],
  "projects": [],
  "tasks": [],
  "comments": [],
  "task_tags": ["tasks", "tags"],
  "project_tag_sets": ["projects", "tag_sets"],
  "project_status_sets": ["projects", "status_sets"]
} as const;

/**
 * Orders tables based on their dependencies.
 * Tables with no dependencies come first, then tables that depend on them.
 */
export function getOrderedTables(tables: readonly string[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  
  function visit(table: string) {
    if (visited.has(table)) return;
    
    // Get dependencies for this table
    const deps = TABLE_HIERARCHY[table as keyof typeof TABLE_HIERARCHY] || [];
    
    // Visit dependencies first
    for (const dep of deps) {
      if (tables.includes(dep)) {
        visit(dep);
      }
    }
    
    // Then add this table
    visited.add(table);
    result.push(table);
  }
  
  // Visit all tables
  for (const table of tables) {
    visit(table);
  }
  
  return result;
}

// Export ordered tracked tables for initial sync
export const ORDERED_TRACKED_TABLES = getOrderedTables(TRACKED_TABLES);
