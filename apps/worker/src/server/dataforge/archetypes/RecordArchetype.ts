/**
 * Record Archetype
 * 
 * Defines the structure, defaults, and behavior for record-type entities.
 * Records represent structured data entities for business objects.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';
import { FieldSetManager } from '../services/FieldSetManager';

export interface RecordFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived' | 'draft';
  data?: any; // JSON data
  parent_record_id?: string;
  owner_id?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class RecordArchetype {
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
    status: FieldSetManager.convertFieldToFieldSet('status', 'record'),
    data: { 
      type: 'json', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    parent_record_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
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
    name: 'record',
    displayName: 'Record',
    description: 'Structured data entities for business objects',
    icon: 'database',
    defaultStatus: 'active',
    supportsSoftDelete: true,
    supportsVersioning: true,
    supportsAttachments: true,
    supportsComments: false,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Records use org-wide access with role-based restrictions
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'org-wide',
    allowsMultipleContainers: true, // Records can span multiple teams
    inheritsFromParent: false,
    defaultContainerType: 'department',
    accessScope: 'functional_team',
    
    // Read access: All org members can read records
    readAccess: AccessPatterns.ORG_READ,
    
    // Write access: Members and above can modify records
    writeAccess: AccessPatterns.MEMBER_WRITE,
    
    // Delete access: Admin-only for data safety
    deleteAccess: AccessPatterns.ADMIN_DELETE
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