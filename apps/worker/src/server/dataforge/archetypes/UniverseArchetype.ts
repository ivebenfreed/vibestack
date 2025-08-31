/**
 * Universe Archetype
 * 
 * Defines the structure, defaults, and behavior for universe-type entities.
 * Universe represents a user's personal life operating system container.
 * Each user has exactly one universe that contains their personal worlds.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface UniverseFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  owner_id: string; // Required - enforces singleton per user
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class UniverseArchetype {
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
      type: 'longtext', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    owner_id: { 
      type: 'user_reference', 
      required: true, 
      syncable: true,
      serverOnly: false
    }
  } as const;

  /**
   * Archetype metadata
   */
  static readonly metadata = {
    name: 'universe',
    displayName: 'Universe',
    description: 'Personal life operating system container for each user',
    icon: 'globe',
    defaultStatus: undefined, // No status field for universe
    supportsSoftDelete: true,
    supportsVersioning: false,
    supportsAttachments: false,
    supportsComments: false,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Universe is strictly personal - only the owner can access
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'personal',
    allowsMultipleContainers: false, // One universe per user
    inheritsFromParent: false,
    defaultContainerType: 'universe',
    accessScope: 'personal',
    
    // Read access: Only the universe owner
    readAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Universe owner can read their own universe' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Only the universe owner
    writeAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Universe owner can edit their own universe' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Only the universe owner (but should rarely be used)
    deleteAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Universe owner can delete their own universe' }
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