/**
 * Activity Archetype
 * 
 * Defines the structure, defaults, and behavior for activity-type entities.
 * Activities represent events, logs, and activity tracking.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface ActivityFields {
  id: string;
  organization_id: string;
  activity_type: string;
  description?: string;
  entity_type?: string;
  entity_id?: string;
  actor_id?: string;
  metadata?: any; // JSON metadata
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class ActivityArchetype {
  /**
   * Field definitions with proper defaults
   */
  static readonly fields = {
    activity_type: { 
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
    entity_type: { 
      type: 'text', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    entity_id: { 
      type: 'text', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    actor_id: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    metadata: { 
      type: 'json', 
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
    name: 'activity',
    displayName: 'Activity',
    description: 'Events, logs, and activity tracking',
    icon: 'activity',
    defaultStatus: undefined, // Activities don't have status by default
    supportsSoftDelete: false,
    supportsVersioning: false,
    supportsAttachments: false,
    supportsComments: false,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Activities use org-wide read-only access - logged automatically by system
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'org-wide',
    allowsMultipleContainers: false,
    inheritsFromParent: false,
    defaultContainerType: 'activity_log',
    accessScope: 'org_activity_tracking',
    
    // Read access: All members can read activity logs
    readAccess: {
      rules: [
        { roles: ['member', 'manager', 'admin'], result: 'allow', description: 'Members can read activity logs' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all activities' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: System only (activities are typically created by system)
    writeAccess: {
      rules: [
        { roles: ['admin'], result: 'allow', description: 'Admins can modify activities if needed' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Admin only (activities are audit logs)
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