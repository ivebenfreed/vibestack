/**
 * World Archetype
 * 
 * Defines the structure, defaults, and behavior for world-type entities.
 * Worlds represent major life areas or business domains that contain projects.
 * Can be personal (linked to a Universe) or organizational (within business context).
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';

export interface WorldFields {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  universe_id?: string; // If set, this is a personal world; if null, it's organizational
  state: 'exploring' | 'developing' | 'active' | 'paused' | 'archived';
  world_type: 'personal' | 'business' | 'client' | 'department' | 'project_domain';
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class WorldArchetype {
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
    universe_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    state: { 
      type: 'status_option', 
      required: true, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'exploring',
      enum: ['exploring', 'developing', 'active', 'paused', 'archived']
    },
    world_type: { 
      type: 'category_option', 
      required: true, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'personal',
      enum: ['personal', 'business', 'client', 'department', 'project_domain']
    },
    priority: { 
      type: 'priority_option', 
      required: true, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'medium',
      enum: ['low', 'medium', 'high', 'critical']
    }
  } as const;

  /**
   * Archetype metadata
   */
  static readonly metadata = {
    name: 'world',
    displayName: 'World',
    description: 'Life areas or business domains containing related projects',
    icon: 'map',
    defaultStatus: 'exploring',
    supportsSoftDelete: true,
    supportsVersioning: false,
    supportsAttachments: true,
    supportsComments: true,
    supportsWorkflows: true
  } as const;

  /**
   * Container Permission Specification
   * Worlds can be personal (universe owner only) or organizational (team-based)
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'hybrid', // Personal or team-based depending on universe_id
    allowsMultipleContainers: false,
    inheritsFromParent: false,
    defaultContainerType: 'world',
    accessScope: 'world_context',
    
    // Read access: Depends on whether it's personal or organizational
    readAccess: {
      rules: [
        // Personal worlds: only universe owner can read
        { fieldChecks: { universe_id: 'not_null' }, userMatch: 'universe_owner', result: 'allow', description: 'Universe owner can read personal worlds' },
        
        // Organizational worlds: team members can read active worlds  
        { fieldChecks: { universe_id: 'null', state: 'active' }, roles: ['member', 'manager', 'admin', 'owner'], result: 'allow', description: 'Team can read active org worlds' },
        { fieldChecks: { universe_id: 'null', state: 'developing' }, roles: ['manager', 'admin', 'owner'], result: 'allow', description: 'Managers can read developing org worlds' },
        { fieldChecks: { universe_id: 'null' }, roles: ['admin', 'owner'], result: 'allow', description: 'Admins and owners can read all org worlds' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Stricter - only owners/managers
    writeAccess: {
      rules: [
        // Personal worlds: only universe owner
        { fieldChecks: { universe_id: 'not_null' }, userMatch: 'universe_owner', result: 'allow', description: 'Universe owner can edit personal worlds' },
        
        // Organizational worlds: managers, admins, and owners
        { fieldChecks: { universe_id: 'null' }, roles: ['manager', 'admin', 'owner'], result: 'allow', description: 'Managers/admins/owners can edit org worlds' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Admin-only for org worlds, universe owner for personal
    deleteAccess: {
      rules: [
        { fieldChecks: { universe_id: 'not_null' }, userMatch: 'universe_owner', result: 'allow', description: 'Universe owner can delete personal worlds' },
        { fieldChecks: { universe_id: 'null' }, roles: ['admin', 'owner'], result: 'allow', description: 'Admins and owners can delete org worlds' }
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