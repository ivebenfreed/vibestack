/**
 * DataForge Type Definitions
 * 
 * Centralized TypeScript types for the DataForge archetype system.
 * All entities must extend one of the 8 core archetypes.
 */

// ============================================================================
// Core Archetype Types
// ============================================================================

export type ArchetypeType = 
  | 'project' 
  | 'task' 
  | 'record' 
  | 'document' 
  | 'file' 
  | 'activity' 
  | 'discussion' 
  | 'collection';

export interface ArchetypeConfig {
  value: ArchetypeType;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export const ARCHETYPE_CONFIGS: Record<ArchetypeType, ArchetypeConfig> = {
  project: {
    value: 'project',
    label: 'Project',
    icon: '📁',
    description: 'Manages projects and initiatives',
    color: 'blue'
  },
  task: {
    value: 'task',
    label: 'Task',
    icon: '✅',
    description: 'Individual work items and actions',
    color: 'green'
  },
  record: {
    value: 'record',
    label: 'Record',
    icon: '💾',
    description: 'Structured data entities',
    color: 'purple'
  },
  document: {
    value: 'document',
    label: 'Document',
    icon: '📄',
    description: 'Text documents and notes',
    color: 'yellow'
  },
  file: {
    value: 'file',
    label: 'File',
    icon: '📎',
    description: 'File storage and assets',
    color: 'orange'
  },
  activity: {
    value: 'activity',
    label: 'Activity',
    icon: '⚡',
    description: 'Events and activity tracking',
    color: 'red'
  },
  discussion: {
    value: 'discussion',
    label: 'Discussion',
    icon: '💬',
    description: 'Conversations and threads',
    color: 'pink'
  },
  collection: {
    value: 'collection',
    label: 'Collection',
    icon: '📚',
    description: 'Groups of related items',
    color: 'indigo'
  }
};

// ============================================================================
// Base Entity Types
// ============================================================================

export interface BaseEntity {
  id: string;
  organization_id: string;
  created_by_id?: string;
  created_at: Date;
  updated_at: Date;
}

// ============================================================================
// Archetype-Specific Entity Types
// ============================================================================

export interface ProjectEntity extends BaseEntity {
  name: string;
  description?: string;
  status: string;
  start_date?: Date;
  end_date?: Date;
  owner_id?: string;
  parent_project_id?: string;
}

export interface TaskEntity extends BaseEntity {
  name: string;
  description?: string;
  status: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  due_date?: Date;
  assignee_id?: string;
  project_id?: string;
  parent_task_id?: string;
}

export interface RecordEntity extends BaseEntity {
  name: string;
  description?: string;
  record_type: string;
  status: string;
  data?: Record<string, any>;
  parent_record_id?: string;
  owner_id?: string;
}

export interface DocumentEntity extends BaseEntity {
  title: string;
  content?: string;
  status: string;
  category?: string;
  author_id?: string;
  parent_document_id?: string;
}

export interface FileEntity extends BaseEntity {
  name: string;
  file_path: string;
  mime_type: string;
  size_bytes: number;
  status: string;
  uploaded_by?: string;
}

export interface ActivityEntity extends BaseEntity {
  activity_type: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  metadata?: Record<string, any>;
}

export interface DiscussionEntity extends BaseEntity {
  title: string;
  content?: string;
  status: string;
  discussion_type?: string;
  author_id?: string;
  parent_discussion_id?: string;
}

export interface CollectionEntity extends BaseEntity {
  name: string;
  description?: string;
  collection_type: string;
  items?: any[];
  owner_id?: string;
}

// ============================================================================
// Field Definition Types
// ============================================================================

export type FieldType = 
  | 'text'
  | 'longtext'
  | 'rich_text'
  | 'number'
  | 'decimal'
  | 'integer'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'email'
  | 'url'
  | 'json'
  | 'status_option'
  | 'priority_option'
  | 'category_option'
  | 'discussion_type_option'
  | 'user_reference'
  | 'entity_reference';

export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  syncable?: boolean;
  serverOnly?: boolean;
  defaultValue?: any;
  enum?: string[];
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateEntityRequest {
  entityName: string;
  archetype: ArchetypeType;
  customFields?: FieldDefinition[];
}

export interface CreateEntityResponse {
  success: boolean;
  entity: {
    orgId: string;
    entityName: string;
    archetype: ArchetypeType;
    tableName: string;
    fields: FieldDefinition[];
    createdBy: {
      userId: string;
      userEmail?: string;
      userRole?: string;
    };
  };
  tableCreated: boolean;
}

export interface ListEntitiesResponse {
  success: boolean;
  data: {
    entities: Array<{
      entityName: string;
      tableName: string;
      archetype: ArchetypeType;
      fieldCount: number;
      createdAt: Date;
      updatedAt: Date;
      syncable: boolean;
    }>;
    total: number;
  };
}

export interface ArchetypeDefinition {
  name: ArchetypeType;
  displayName: string;
  description: string;
  icon: string;
  baseFields: FieldDefinition[];
  defaultStatus?: string;
  supportsSoftDelete?: boolean;
  supportsVersioning?: boolean;
  supportsAttachments?: boolean;
  supportsComments?: boolean;
  supportsWorkflows?: boolean;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isValidArchetype(value: any): value is ArchetypeType {
  return typeof value === 'string' && 
    ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'].includes(value);
}

export function isProjectEntity(entity: BaseEntity & { archetype?: string }): entity is ProjectEntity {
  return entity.archetype === 'project';
}

export function isTaskEntity(entity: BaseEntity & { archetype?: string }): entity is TaskEntity {
  return entity.archetype === 'task';
}

export function isRecordEntity(entity: BaseEntity & { archetype?: string }): entity is RecordEntity {
  return entity.archetype === 'record';
}

export function isDocumentEntity(entity: BaseEntity & { archetype?: string }): entity is DocumentEntity {
  return entity.archetype === 'document';
}

export function isFileEntity(entity: BaseEntity & { archetype?: string }): entity is FileEntity {
  return entity.archetype === 'file';
}

export function isActivityEntity(entity: BaseEntity & { archetype?: string }): entity is ActivityEntity {
  return entity.archetype === 'activity';
}

export function isDiscussionEntity(entity: BaseEntity & { archetype?: string }): entity is DiscussionEntity {
  return entity.archetype === 'discussion';
}

export function isCollectionEntity(entity: BaseEntity & { archetype?: string }): entity is CollectionEntity {
  return entity.archetype === 'collection';
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getArchetypeConfig(archetype: ArchetypeType): ArchetypeConfig {
  return ARCHETYPE_CONFIGS[archetype];
}

export function getArchetypeIcon(archetype: ArchetypeType): string {
  return ARCHETYPE_CONFIGS[archetype]?.icon || '📦';
}

export function getArchetypeLabel(archetype: ArchetypeType): string {
  return ARCHETYPE_CONFIGS[archetype]?.label || 'Unknown';
}

export function getArchetypeColor(archetype: ArchetypeType): string {
  return ARCHETYPE_CONFIGS[archetype]?.color || 'gray';
}