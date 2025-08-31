/**
 * Document Archetype
 * 
 * Defines the structure, defaults, and behavior for document-type entities.
 * Documents represent text documents, notes, and written content.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface DocumentFields {
  id: string;
  organization_id: string;
  title: string;
  content?: string; // Rich text content
  world_id?: string; // Optional reference to containing world (for lore/canon)
  status: 'draft' | 'review' | 'published' | 'archived';
  category?: string;
  author_id?: string;
  parent_document_id?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class DocumentArchetype {
  /**
   * Field definitions with proper defaults
   */
  static readonly fields = {
    title: { 
      type: 'text', 
      required: true, 
      syncable: true,
      serverOnly: false
    },
    content: { 
      type: 'rich_text', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    world_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    status: { 
      type: 'status_option', 
      required: true, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'draft',
      enum: ['draft', 'review', 'published', 'archived']
    },
    category: { 
      type: 'category_option', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    author_id: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    parent_document_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    }
  } as const;

  /**
   * Archetype metadata
   */
  static readonly metadata = {
    name: 'document',
    displayName: 'Document',
    description: 'Text documents, notes, and written content',
    icon: 'file-text',
    defaultStatus: 'draft',
    supportsSoftDelete: true,
    supportsVersioning: true,
    supportsAttachments: false,
    supportsComments: true,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Documents use owner-only access - only creator can edit, others can read if published
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'owner-only',
    allowsMultipleContainers: false,
    inheritsFromParent: false,
    defaultContainerType: 'document',
    accessScope: 'document_ownership',
    
    // Read access: Owner always, others only if published
    readAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Document owner can always read' },
        { fieldChecks: { status: 'published' }, roles: ['member', 'manager', 'admin'], result: 'allow', description: 'Anyone can read published documents' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all documents' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Owner and admins only
    writeAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Document owner can edit' },
        { roles: ['admin'], result: 'allow', description: 'Admins can edit all documents' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Owner and admins
    deleteAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Document owner can delete' },
        { roles: ['admin'], result: 'allow', description: 'Admins can delete all documents' }
      ],
      defaultPolicy: 'deny'
    }
  };

  /**
   * Get field definitions as array format for unified pipeline
   */
  static getFieldsArray() {
    return Object.entries(this.fields).map(([name, definition]) => ({
      name,
      ...definition
    }));
  }

  /**
   * Get field definition by name
   */
  static getField(fieldName: string) {
    return this.fields[fieldName as keyof typeof this.fields];
  }

  /**
   * Get all required field names
   */
  static getRequiredFields() {
    return Object.entries(this.fields)
      .filter(([_, def]) => def.required)
      .map(([name]) => name);
  }

  /**
   * Get all syncable field names  
   */
  static getSyncableFields() {
    return Object.entries(this.fields)
      .filter(([_, def]) => def.syncable && !def.serverOnly)
      .map(([name]) => name);
  }

  /**
   * Get field defaults for new entities
   */
  static getFieldDefaults() {
    const defaults: Record<string, any> = {};
    Object.entries(this.fields).forEach(([name, def]) => {
      if ('defaultValue' in def && def.defaultValue !== undefined) {
        defaults[name] = def.defaultValue;
      }
    });
    return defaults;
  }
}