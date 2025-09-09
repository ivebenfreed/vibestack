/**
 * Task Archetype
 * 
 * Defines the structure, defaults, and behavior for task-type entities.
 * Tasks represent individual work items and action items.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';
import { FieldSetManager } from '../services/FieldSetManager';

export interface TaskFields {
  id: string;
  organization_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'not_started' | 'active' | 'done' | 'blocked';
  assignee_id?: string;
  due_date?: Date;
  parent_task_id?: string;
  project_id?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class TaskArchetype {
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
    description: { 
      type: 'longtext', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    priority: FieldSetManager.convertFieldToFieldSet('priority', 'task'),
    status: FieldSetManager.convertFieldToFieldSet('status', 'task'),
    assignee_id: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false,
      systemField: true  // 🔒 System-protected - required for task business logic
    },
    due_date: { 
      type: 'datetime', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    parent_task_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    project_id: { 
      type: 'entity_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    created_by: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false,
      systemField: true  // 🔒 System-protected - required for audit trail
    },
  } as const;

  /**
   * Archetype metadata
   */
  static readonly metadata = {
    name: 'task',
    displayName: 'Task',
    description: 'Individual work items and action items',
    icon: 'check-square',
    defaultStatus: 'not_started',
    supportsSoftDelete: true,
    supportsVersioning: false,
    supportsAttachments: true,
    supportsComments: true,
    supportsWorkflows: true
  } as const;

  /**
   * Container Permission Specification
   * Tasks use custom access - supports assignment-based + guest role with project-specific access
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'custom',
    allowsMultipleContainers: false,
    inheritsFromParent: true, // Can inherit from project
    defaultContainerType: 'project',
    accessScope: 'inherited',
    
    // Read access: Assignee, reporter, managers, or guest with project access
    readAccess: {
      rules: [
        // Standard assignment-based access
        { userMatch: 'assignee', result: 'allow', description: 'Task assignee can read' },
        { userMatch: 'reporter', result: 'allow', description: 'Task reporter can read' },
        { userMatch: 'creator', result: 'allow', description: 'Task creator can read' },
        { roles: ['manager', 'admin', 'owner'], result: 'allow', description: 'Managers+ can read all tasks' },
        
        // Custom guest access - can read tasks in projects they have access to
        { 
          roles: ['guest'], 
          condition: 'project_access_granted', 
          result: 'allow', 
          description: 'Guest can read tasks in assigned projects'
        }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Assignee, reporter, managers, or guest with project access
    writeAccess: {
      rules: [
        // Standard assignment-based access
        { userMatch: 'assignee', result: 'allow', description: 'Task assignee can edit' },
        { userMatch: 'reporter', result: 'allow', description: 'Task reporter can edit' },
        { roles: ['manager', 'admin', 'owner'], result: 'allow', description: 'Managers+ can edit all tasks' },
        
        // Custom guest access - can edit tasks in projects they have access to
        { 
          roles: ['guest'], 
          condition: 'project_access_granted', 
          result: 'allow', 
          description: 'Guest can edit tasks in assigned projects only'
        }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Managers and admins only (guests cannot delete)
    deleteAccess: {
      rules: [
        { roles: ['manager', 'admin', 'owner'], result: 'allow', description: 'Only managers+ can delete tasks' }
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