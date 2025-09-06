/**
 * Field Set Manager
 * 
 * Manages customizable field sets (status, priority, category, etc.) for archetypes.
 * Instead of hardcoding enum values, archetypes reference default sets that organizations
 * can customize.
 */

import type { Kysely } from 'kysely';

export interface FieldSetOption {
  value: string;
  label: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
}

export interface FieldSet {
  id: string;
  name: string;
  type: 'status' | 'priority' | 'category' | 'custom';
  archetype: string;
  options: FieldSetOption[];
  organization_id: string;
  is_system_default?: boolean;
}

export class FieldSetManager {
  /**
   * System default field sets for archetypes
   * These are used as templates when creating org-specific sets
   */
  static readonly DEFAULT_FIELD_SETS: Record<string, Record<string, FieldSet>> = {
    // Record archetype defaults
    record: {
      status: {
        id: 'default-record-status',
        name: 'Record Status',
        type: 'status',
        archetype: 'record',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'active', label: 'Active', color: '#10B981', order: 1, isDefault: true },
          { value: 'inactive', label: 'Inactive', color: '#6B7280', order: 2 },
          { value: 'archived', label: 'Archived', color: '#9CA3AF', order: 3 },
          { value: 'draft', label: 'Draft', color: '#F59E0B', order: 4 }
        ]
      }
    },
    
    // Project archetype defaults
    project: {
      status: {
        id: 'default-project-status',
        name: 'Project Status',
        type: 'status',
        archetype: 'project',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'planning', label: 'Planning', color: '#8B5CF6', order: 1, isDefault: true },
          { value: 'active', label: 'Active', color: '#10B981', order: 2 },
          { value: 'on_hold', label: 'On Hold', color: '#F59E0B', order: 3 },
          { value: 'completed', label: 'Completed', color: '#3B82F6', order: 4 },
          { value: 'cancelled', label: 'Cancelled', color: '#EF4444', order: 5 }
        ]
      },
      priority: {
        id: 'default-project-priority',
        name: 'Project Priority',
        type: 'priority',
        archetype: 'project',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'low', label: 'Low', color: '#10B981', order: 1 },
          { value: 'medium', label: 'Medium', color: '#F59E0B', order: 2, isDefault: true },
          { value: 'high', label: 'High', color: '#F97316', order: 3 },
          { value: 'critical', label: 'Critical', color: '#EF4444', order: 4 }
        ]
      }
    },
    
    // Task archetype defaults
    task: {
      status: {
        id: 'default-task-status',
        name: 'Task Status',
        type: 'status',
        archetype: 'task',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'todo', label: 'To Do', color: '#6B7280', order: 1, isDefault: true },
          { value: 'in_progress', label: 'In Progress', color: '#3B82F6', order: 2 },
          { value: 'review', label: 'Review', color: '#8B5CF6', order: 3 },
          { value: 'blocked', label: 'Blocked', color: '#EF4444', order: 4 },
          { value: 'completed', label: 'Completed', color: '#10B981', order: 5 },
          { value: 'cancelled', label: 'Cancelled', color: '#9CA3AF', order: 6 }
        ]
      },
      priority: {
        id: 'default-task-priority',
        name: 'Task Priority',
        type: 'priority',
        archetype: 'task',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'low', label: 'Low', color: '#10B981', order: 1 },
          { value: 'medium', label: 'Medium', color: '#F59E0B', order: 2, isDefault: true },
          { value: 'high', label: 'High', color: '#F97316', order: 3 },
          { value: 'critical', label: 'Critical', color: '#EF4444', order: 4 }
        ]
      }
    },
    
    // Document archetype defaults
    document: {
      status: {
        id: 'default-document-status',
        name: 'Document Status',
        type: 'status',
        archetype: 'document',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'draft', label: 'Draft', color: '#6B7280', order: 1, isDefault: true },
          { value: 'review', label: 'Review', color: '#8B5CF6', order: 2 },
          { value: 'published', label: 'Published', color: '#10B981', order: 3 },
          { value: 'archived', label: 'Archived', color: '#9CA3AF', order: 4 }
        ]
      }
    },
    
    // File archetype defaults
    file: {
      status: {
        id: 'default-file-status',
        name: 'File Status',
        type: 'status',
        archetype: 'file',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'active', label: 'Active', color: '#10B981', order: 1, isDefault: true },
          { value: 'processing', label: 'Processing', color: '#3B82F6', order: 2 },
          { value: 'archived', label: 'Archived', color: '#9CA3AF', order: 3 },
          { value: 'deleted', label: 'Deleted', color: '#EF4444', order: 4 }
        ]
      }
    },
    
    // Discussion archetype defaults
    discussion: {
      status: {
        id: 'default-discussion-status',
        name: 'Discussion Status',
        type: 'status',
        archetype: 'discussion',
        organization_id: 'system',
        is_system_default: true,
        options: [
          { value: 'open', label: 'Open', color: '#10B981', order: 1, isDefault: true },
          { value: 'closed', label: 'Closed', color: '#6B7280', order: 2 },
          { value: 'archived', label: 'Archived', color: '#9CA3AF', order: 3 },
          { value: 'resolved', label: 'Resolved', color: '#3B82F6', order: 4 }
        ]
      }
    }
  };

  /**
   * Get default field set for an archetype and field type
   */
  static getDefaultFieldSet(archetype: string, fieldType: string): FieldSet | null {
    return this.DEFAULT_FIELD_SETS[archetype]?.[fieldType] || null;
  }

  /**
   * Get default value for a field set
   */
  static getDefaultValue(fieldSet: FieldSet): string | undefined {
    const defaultOption = fieldSet.options.find(opt => opt.isDefault);
    return defaultOption?.value;
  }

  /**
   * Get enum values from a field set (for compatibility)
   */
  static getEnumValues(fieldSet: FieldSet): string[] {
    return fieldSet.options.map(opt => opt.value);
  }

  /**
   * Initialize organization field sets from system defaults
   */
  static async initializeOrgFieldSets(
    db: Kysely<any>,
    orgId: string,
    archetype: string
  ): Promise<void> {
    const defaultSets = this.DEFAULT_FIELD_SETS[archetype];
    if (!defaultSets) return;

    for (const [fieldType, fieldSet] of Object.entries(defaultSets)) {
      // Check if org already has this field set
      const existing = await db
        .selectFrom('status_sets')
        .where('organization_id', '=', orgId)
        .where('archetype', '=', archetype)
        .where('field_type', '=', fieldType)
        .selectAll()
        .executeTakeFirst();

      if (!existing) {
        // Create org-specific copy of default field set
        await db
          .insertInto('status_sets')
          .values({
            id: `${orgId}-${archetype}-${fieldType}`,
            name: fieldSet.name,
            organization_id: orgId,
            archetype,
            field_type: fieldType,
            options: JSON.stringify(fieldSet.options),
            created_at: new Date(),
            updated_at: new Date()
          })
          .execute();
      }
    }
  }

  /**
   * Get organization's field set or fall back to default
   */
  static async getOrgFieldSet(
    db: Kysely<any>,
    orgId: string,
    archetype: string,
    fieldType: string
  ): Promise<FieldSet | null> {
    // Try to get org-specific field set
    const orgSet = await db
      .selectFrom('status_sets')
      .where('organization_id', '=', orgId)
      .where('archetype', '=', archetype)
      .where('field_type', '=', fieldType)
      .selectAll()
      .executeTakeFirst();

    if (orgSet) {
      return {
        id: orgSet.id,
        name: orgSet.name,
        type: fieldType as any,
        archetype,
        organization_id: orgId,
        options: JSON.parse(orgSet.options as string)
      };
    }

    // Fall back to system default
    return this.getDefaultFieldSet(archetype, fieldType);
  }

  /**
   * Update organization's field set
   */
  static async updateOrgFieldSet(
    db: Kysely<any>,
    orgId: string,
    archetype: string,
    fieldType: string,
    options: FieldSetOption[]
  ): Promise<void> {
    await db
      .updateTable('status_sets')
      .set({
        options: JSON.stringify(options),
        updated_at: new Date()
      })
      .where('organization_id', '=', orgId)
      .where('archetype', '=', archetype)
      .where('field_type', '=', fieldType)
      .execute();
  }

  /**
   * Convert archetype field definition to use field set
   */
  static convertFieldToFieldSet(fieldType: string, archetype: string) {
    return {
      type: `${fieldType}_set`,
      fieldSetRef: `${archetype}-${fieldType}`,
      required: true,
      syncable: true,
      serverOnly: false,
      // Default value will be resolved from field set
      getDefaultValue: () => {
        const fieldSet = this.getDefaultFieldSet(archetype, fieldType);
        return fieldSet ? this.getDefaultValue(fieldSet) : undefined;
      },
      // Enum values will be resolved from field set
      getEnumValues: () => {
        const fieldSet = this.getDefaultFieldSet(archetype, fieldType);
        return fieldSet ? this.getEnumValues(fieldSet) : [];
      }
    };
  }
}