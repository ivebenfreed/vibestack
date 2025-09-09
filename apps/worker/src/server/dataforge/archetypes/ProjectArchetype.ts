/**
 * Project Archetype
 * 
 * Defines the structure, defaults, and behavior for project-type entities.
 * Projects represent initiatives, long-term efforts, and organized work.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';
import { FieldSetManager } from '../services/FieldSetManager';

export interface ProjectFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'not_started' | 'active' | 'paused' | 'done' | 'cancelled';
  start_date?: Date;
  end_date?: Date;
  owner_id?: string;
  budget?: number;
  progress_percentage?: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class ProjectArchetype {
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
    priority: FieldSetManager.convertFieldToFieldSet('priority', 'project'),
    status: FieldSetManager.convertFieldToFieldSet('status', 'project'),
    start_date: { 
      type: 'date', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    end_date: { 
      type: 'date', 
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
    budget: { 
      type: 'decimal', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    progress_percentage: { 
      type: 'integer', 
      required: false, 
      syncable: true,
      serverOnly: false,
      defaultValue: 0
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
    name: 'project',
    displayName: 'Project',
    description: 'Manages projects, initiatives, and long-term efforts',
    icon: 'folder',
    defaultStatus: 'not_started',
    supportsSoftDelete: true,
    supportsVersioning: false,
    supportsAttachments: true,
    supportsComments: true,
    supportsWorkflows: true
  } as const;

  /**
   * Container Permission Specification
   * Projects use team-based access - project members only
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'team-based',
    allowsMultipleContainers: false, // Projects have single team
    inheritsFromParent: false,
    defaultContainerType: 'project',
    accessScope: 'project_team',
    
    // Read access: Project owner, team members, or managers can read
    readAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Project owner can read' },
        { fieldChecks: { status: 'active' }, roles: ['member', 'manager', 'admin'], result: 'allow', description: 'Team can read active projects' },
        { fieldChecks: { status: 'planning' }, roles: ['manager', 'admin'], result: 'allow', description: 'Managers can read planning projects' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all projects' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Project owner or admins can modify
    writeAccess: {
      rules: [
        { userMatch: 'owner', result: 'allow', description: 'Project owner can edit' },
        { roles: ['admin'], result: 'allow', description: 'Admins can edit all projects' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Admin-only for projects
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