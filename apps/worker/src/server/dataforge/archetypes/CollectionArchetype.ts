/**
 * Collection Archetype
 * 
 * Defines the structure, defaults, and behavior for collection-type entities.
 * Collections represent groups and collections of related items.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface CollectionFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  collection_type: string;
  items?: any; // JSON array of item references
  owner_id?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class CollectionArchetype {
  /**
   * Field definitions with proper defaults
   */
  static readonly fields = {
    name: { 
      type: 'text', 
      required: true, 
      syncable: true,
      serverOnly: false
    },
    description: { 
      type: 'text', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    collection_type: { 
      type: 'text', 
      required: true, 
      syncable: true,
      serverOnly: false
    },
    items: { 
      type: 'json', 
      required: false, 
      syncable: true,
      serverOnly: false,
      defaultValue: []
    },
    owner_id: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    created_by: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    }
  } as const;

  /**
   * Archetype metadata
   */
  static readonly metadata = {
    name: 'collection',
    displayName: 'Collection',
    description: 'Groups and collections of related items',
    icon: 'layers',
    defaultStatus: undefined, // Collections don't have status by default
    supportsSoftDelete: true,
    supportsVersioning: true,
    supportsAttachments: false,
    supportsComments: false,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Collections use workspace-based access - creator plus collaborators
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'workspace-based',
    allowsMultipleContainers: true,
    inheritsFromParent: false,
    defaultContainerType: 'collection_workspace',
    accessScope: 'collection_collaboration',
    
    // Read access: Owner, collaborators, and admins
    readAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Collection owner can read' },
        { roles: ['member', 'manager', 'admin'], result: 'allow', description: 'Members can read collections they have access to' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all collections' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Owner and admins
    writeAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Collection owner can edit' },
        { roles: ['admin'], result: 'allow', description: 'Admins can edit all collections' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Owner and admins
    deleteAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Collection owner can delete' },
        { roles: ['admin'], result: 'allow', description: 'Admins can delete all collections' }
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