/**
 * File Archetype
 * 
 * Defines the structure, defaults, and behavior for file-type entities.
 * Files represent file storage and asset management.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface FileFields {
  id: string;
  organization_id: string;
  name: string;
  file_path: string; // Server-only field
  mime_type: string;
  size_bytes: number;
  status: 'active' | 'processing' | 'archived' | 'deleted';
  uploaded_by?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class FileArchetype {
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
    file_path: { 
      type: 'text', 
      required: true, 
      syncable: false,
      serverOnly: true
    },
    mime_type: { 
      type: 'text', 
      required: true, 
      syncable: true,
      serverOnly: false
    },
    size_bytes: { 
      type: 'integer', 
      required: true, 
      syncable: true,
      serverOnly: false
    },
    status: { 
      type: 'status_option', 
      required: true, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'active',
      enum: ['active', 'processing', 'archived', 'deleted']
    },
    uploaded_by: { 
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
    name: 'file',
    displayName: 'File',
    description: 'File storage and asset management',
    icon: 'file',
    defaultStatus: 'active',
    supportsSoftDelete: true,
    supportsVersioning: true,
    supportsAttachments: false,
    supportsComments: false,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Files use attachment-based access - uploader plus members who can access parent entities
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'attachment-based',
    allowsMultipleContainers: true,
    inheritsFromParent: true,
    defaultContainerType: 'file_attachment',
    accessScope: 'parent_entity_access',
    
    // Read access: Uploader, members with parent access, admins
    readAccess: {
      rules: [
        { userMatch: 'uploader', result: 'allow', description: 'File uploader can always read' },
        { roles: ['member', 'manager', 'admin'], result: 'allow', description: 'Members can read files if they have parent access' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all files' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Uploader and admins only (files are typically immutable after upload)
    writeAccess: {
      rules: [
        { userMatch: 'uploader', result: 'allow', description: 'File uploader can modify metadata' },
        { roles: ['admin'], result: 'allow', description: 'Admins can edit all files' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Uploader and admins
    deleteAccess: {
      rules: [
        { userMatch: 'uploader', result: 'allow', description: 'File uploader can delete' },
        { roles: ['admin'], result: 'allow', description: 'Admins can delete all files' }
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