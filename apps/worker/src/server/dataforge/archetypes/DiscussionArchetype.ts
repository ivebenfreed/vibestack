/**
 * Discussion Archetype
 * 
 * Defines the structure, defaults, and behavior for discussion-type entities.
 * Discussions represent conversations, threads, and collaborative discussions.
 */

import type { ContainerPermissionSpec } from '../container-permissions';
import { AccessPatterns } from '../container-permissions';
// Removed: import { FieldSetManager } from '../services/FieldSetManager';

export interface DiscussionFields {
  id: string;
  organization_id: string;
  title: string;
  content?: string; // Rich text content
  status: 'open' | 'closed' | 'archived' | 'resolved';
  discussion_type?: 'question' | 'announcement' | 'feedback' | 'general';
  author_id?: string;
  parent_discussion_id?: string;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export class DiscussionArchetype {
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
    status: { 
      type: 'status', 
      required: true, 
      syncable: true,
      serverOnly: false,
      systemField: true,  // 🔒 System-protected - required for discussion workflow logic
      defaultValue: 'open'
      // enum removed - now uses status sets
    },
    discussion_type: { 
      type: 'discussion_type_option', 
      required: false, 
      syncable: true,
      serverOnly: false,
      defaultValue: 'general',
      enum: ['question', 'announcement', 'feedback', 'general']
    },
    author_id: { 
      type: 'user_reference', 
      required: false, 
      syncable: true,
      serverOnly: false
    },
    parent_discussion_id: { 
      type: 'entity_reference', 
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
    name: 'discussion',
    displayName: 'Discussion',
    description: 'Conversations, threads, and collaborative discussions',
    icon: 'message-circle',
    defaultStatus: 'open',
    supportsSoftDelete: true,
    supportsVersioning: false,
    supportsAttachments: false,
    supportsComments: true,
    supportsWorkflows: false
  } as const;

  /**
   * Container Permission Specification
   * Discussions use org-wide collaborative access - all members can participate
   */
  static readonly containerPermissions: ContainerPermissionSpec = {
    model: 'org-wide',
    allowsMultipleContainers: false,
    inheritsFromParent: false,
    defaultContainerType: 'discussion_thread',
    accessScope: 'org_discussions',
    
    // Read access: All members can read discussions (collaborative)
    readAccess: {
      rules: [
        { roles: ['member', 'manager', 'admin'], result: 'allow', description: 'All members can read discussions' },
        { roles: ['admin'], result: 'allow', description: 'Admins can read all discussions' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Write access: Author can edit their own discussion, admins can edit all
    writeAccess: {
      rules: [
        { userMatch: 'author', result: 'allow', description: 'Discussion author can edit' },
        { roles: ['admin'], result: 'allow', description: 'Admins can edit all discussions' }
      ],
      defaultPolicy: 'deny'
    },
    
    // Delete access: Author and admins
    deleteAccess: {
      rules: [
        { userMatch: 'author', result: 'allow', description: 'Discussion author can delete' },
        { roles: ['admin'], result: 'allow', description: 'Admins can delete all discussions' }
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