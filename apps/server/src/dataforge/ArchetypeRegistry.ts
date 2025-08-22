/**
 * ArchetypeRegistry - Central registry for all DataForge archetypes
 * 
 * This is the single source of truth for entity archetypes.
 * All entity creation must go through one of these 8 archetypes.
 */

import type { FieldDefinition } from './rules/json-rules-engine';

export type ArchetypeType = 
  | 'project' 
  | 'task' 
  | 'record' 
  | 'document' 
  | 'file' 
  | 'activity' 
  | 'discussion' 
  | 'collection';

export interface ArchetypeDefinition {
  name: ArchetypeType;
  displayName: string;
  description: string;
  icon: string;
  baseFields: FieldDefinition[];
  allowedCustomFields?: string[];
  defaultStatus?: string;
  supportsSoftDelete?: boolean;
  supportsVersioning?: boolean;
  supportsAttachments?: boolean;
  supportsComments?: boolean;
  supportsWorkflows?: boolean;
}

export class ArchetypeRegistry {
  private static readonly archetypes: Map<ArchetypeType, ArchetypeDefinition> = new Map([
    ['project', {
      name: 'project',
      displayName: 'Project',
      description: 'Manages projects, initiatives, and long-term efforts',
      icon: 'folder',
      baseFields: [
        { name: 'name', type: 'text', required: true, syncable: true },
        { name: 'description', type: 'longtext', required: false, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'start_date', type: 'date', required: false, syncable: true },
        { name: 'end_date', type: 'date', required: false, syncable: true },
        { name: 'owner_id', type: 'user_reference', required: false, syncable: true },
        { name: 'parent_project_id', type: 'entity_reference', required: false, syncable: true },
      ],
      defaultStatus: 'planning',
      supportsSoftDelete: true,
      supportsAttachments: true,
      supportsComments: true,
      supportsWorkflows: true
    }],
    ['task', {
      name: 'task',
      displayName: 'Task',
      description: 'Individual work items and action items',
      icon: 'check-square',
      baseFields: [
        { name: 'name', type: 'text', required: true, syncable: true },
        { name: 'description', type: 'longtext', required: false, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'priority', type: 'priority_option', required: false, syncable: true },
        { name: 'due_date', type: 'datetime', required: false, syncable: true },
        { name: 'assignee_id', type: 'user_reference', required: false, syncable: true },
        { name: 'project_id', type: 'entity_reference', required: false, syncable: true },
        { name: 'parent_task_id', type: 'entity_reference', required: false, syncable: true },
      ],
      defaultStatus: 'todo',
      supportsSoftDelete: true,
      supportsAttachments: true,
      supportsComments: true,
      supportsWorkflows: true
    }],
    ['record', {
      name: 'record',
      displayName: 'Record',
      description: 'Structured data entities for business objects',
      icon: 'database',
      baseFields: [
        { name: 'name', type: 'text', required: true, syncable: true },
        { name: 'description', type: 'text', required: false, syncable: true },
        { name: 'record_type', type: 'text', required: true, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'data', type: 'json', required: false, syncable: true },
        { name: 'parent_record_id', type: 'entity_reference', required: false, syncable: true },
        { name: 'owner_id', type: 'user_reference', required: false, syncable: true },
      ],
      defaultStatus: 'active',
      supportsSoftDelete: true,
      supportsVersioning: true,
      supportsAttachments: true
    }],
    ['document', {
      name: 'document',
      displayName: 'Document',
      description: 'Text documents, notes, and written content',
      icon: 'file-text',
      baseFields: [
        { name: 'title', type: 'text', required: true, syncable: true },
        { name: 'content', type: 'rich_text', required: false, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'category', type: 'category_option', required: false, syncable: true },
        { name: 'author_id', type: 'user_reference', required: false, syncable: true },
        { name: 'parent_document_id', type: 'entity_reference', required: false, syncable: true },
      ],
      defaultStatus: 'draft',
      supportsSoftDelete: true,
      supportsVersioning: true,
      supportsComments: true
    }],
    ['file', {
      name: 'file',
      displayName: 'File',
      description: 'File storage and asset management',
      icon: 'file',
      baseFields: [
        { name: 'name', type: 'text', required: true, syncable: true },
        { name: 'file_path', type: 'text', required: true, syncable: false, serverOnly: true },
        { name: 'mime_type', type: 'text', required: true, syncable: true },
        { name: 'size_bytes', type: 'integer', required: true, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'uploaded_by', type: 'user_reference', required: false, syncable: true },
      ],
      defaultStatus: 'active',
      supportsSoftDelete: true,
      supportsVersioning: true
    }],
    ['activity', {
      name: 'activity',
      displayName: 'Activity',
      description: 'Events, logs, and activity tracking',
      icon: 'activity',
      baseFields: [
        { name: 'activity_type', type: 'text', required: true, syncable: true },
        { name: 'description', type: 'text', required: false, syncable: true },
        { name: 'entity_type', type: 'text', required: false, syncable: true },
        { name: 'entity_id', type: 'text', required: false, syncable: true },
        { name: 'actor_id', type: 'user_reference', required: false, syncable: true },
        { name: 'metadata', type: 'json', required: false, syncable: true },
      ],
      supportsSoftDelete: false,
      supportsVersioning: false
    }],
    ['discussion', {
      name: 'discussion',
      displayName: 'Discussion',
      description: 'Conversations, threads, and collaborative discussions',
      icon: 'message-circle',
      baseFields: [
        { name: 'title', type: 'text', required: true, syncable: true },
        { name: 'content', type: 'rich_text', required: false, syncable: true },
        { name: 'status', type: 'status_option', required: true, syncable: true },
        { name: 'discussion_type', type: 'discussion_type_option', required: false, syncable: true },
        { name: 'author_id', type: 'user_reference', required: false, syncable: true },
        { name: 'parent_discussion_id', type: 'entity_reference', required: false, syncable: true },
      ],
      defaultStatus: 'open',
      supportsSoftDelete: true,
      supportsComments: true
    }],
    ['collection', {
      name: 'collection',
      displayName: 'Collection',
      description: 'Groups and collections of related items',
      icon: 'layers',
      baseFields: [
        { name: 'name', type: 'text', required: true, syncable: true },
        { name: 'description', type: 'text', required: false, syncable: true },
        { name: 'collection_type', type: 'text', required: true, syncable: true },
        { name: 'items', type: 'json', required: false, syncable: true },
        { name: 'owner_id', type: 'user_reference', required: false, syncable: true },
      ],
      supportsSoftDelete: true,
      supportsVersioning: true
    }]
  ]);

  /**
   * Get all available archetypes
   */
  static getAllArchetypes(): ArchetypeDefinition[] {
    return Array.from(this.archetypes.values());
  }

  /**
   * Get archetype names only
   */
  static getArchetypeNames(): ArchetypeType[] {
    return Array.from(this.archetypes.keys());
  }

  /**
   * Get a specific archetype definition
   */
  static getArchetype(name: ArchetypeType): ArchetypeDefinition | undefined {
    return this.archetypes.get(name);
  }

  /**
   * Validate if an archetype exists
   */
  static validateArchetype(name: string): boolean {
    return this.archetypes.has(name as ArchetypeType);
  }

  /**
   * Get archetype with custom fields merged
   */
  static getArchetypeWithCustomFields(
    archetypeName: ArchetypeType,
    customFields: FieldDefinition[]
  ): { baseFields: FieldDefinition[]; customFields: FieldDefinition[]; allFields: FieldDefinition[] } {
    const archetype = this.getArchetype(archetypeName);
    if (!archetype) {
      throw new Error(`Invalid archetype: ${archetypeName}`);
    }

    const allFields = [...archetype.baseFields, ...customFields];
    
    return {
      baseFields: archetype.baseFields,
      customFields,
      allFields
    };
  }

  /**
   * Validate custom fields against archetype constraints
   */
  static validateCustomFields(
    archetypeName: ArchetypeType,
    customFields: FieldDefinition[]
  ): { valid: boolean; errors: string[] } {
    const archetype = this.getArchetype(archetypeName);
    if (!archetype) {
      return { valid: false, errors: [`Invalid archetype: ${archetypeName}`] };
    }

    const errors: string[] = [];
    const baseFieldNames = new Set(archetype.baseFields.map(f => f.name));

    for (const field of customFields) {
      // Check for conflicts with base fields
      if (baseFieldNames.has(field.name)) {
        errors.push(`Custom field '${field.name}' conflicts with base field`);
      }

      // Validate field type
      const validTypes = [
        'text', 'longtext', 'rich_text', 'number', 'decimal', 'integer',
        'boolean', 'date', 'datetime', 'email', 'url', 'json',
        'status_option', 'priority_option', 'category_option', 
        'discussion_type_option', 'user_reference', 'entity_reference'
      ];
      
      if (!validTypes.includes(field.type)) {
        errors.push(`Invalid field type '${field.type}' for field '${field.name}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create entity definition from archetype
   */
  static createEntityDefinition(
    orgId: string,
    entityName: string,
    archetypeName: ArchetypeType,
    customFields: FieldDefinition[] = []
  ) {
    const archetype = this.getArchetype(archetypeName);
    if (!archetype) {
      throw new Error(`Invalid archetype: ${archetypeName}`);
    }

    const validation = this.validateCustomFields(archetypeName, customFields);
    if (!validation.valid) {
      throw new Error(`Invalid custom fields: ${validation.errors.join(', ')}`);
    }

    return {
      orgId,
      entityName,
      archetype: archetypeName,
      tableName: `org_${orgId.replace(/-/g, '_')}_${entityName.toLowerCase()}s`,
      baseFields: archetype.baseFields,
      customFields,
      features: {
        softDelete: archetype.supportsSoftDelete ?? false,
        versioning: archetype.supportsVersioning ?? false,
        attachments: archetype.supportsAttachments ?? false,
        comments: archetype.supportsComments ?? false,
        workflows: archetype.supportsWorkflows ?? false
      },
      defaultStatus: archetype.defaultStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }
}