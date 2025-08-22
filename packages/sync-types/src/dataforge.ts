/**
 * DataForge Type Definitions
 * 
 * Core types for the DataForge archetype system.
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
  };
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

// ============================================================================
// Type Guards
// ============================================================================

export function isValidArchetype(value: any): value is ArchetypeType {
  return typeof value === 'string' && 
    ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'].includes(value);
}