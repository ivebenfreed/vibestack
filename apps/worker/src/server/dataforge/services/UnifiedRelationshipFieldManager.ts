/**
 * Unified Relationship Field Manager
 * 
 * Manages relationship fields using the same pattern as the options system:
 * - Auto-populates from archetype templates during entity creation
 * - Single unified API (no system/custom distinction)
 * - Deletion protection via validation guards only
 * - Organizations can add custom relationship fields
 */

import type { Kysely } from 'kysely';
import { RelationshipFieldHandler } from './RelationshipFieldHandler';
import { getRelationshipFieldConfig } from '../relationshipfields';

export interface UnifiedRelationshipField {
  id: string;
  org_id: string;
  entity_type: string;
  field_name: string;                    // 🔑 Original field name (for frontend convenience)
  field_type: 'user_reference' | 'entity_reference' | 'custom_user_reference' | 'custom_entity_reference';
  relationship_type: string;             // 'assigned_to', 'owned_by', etc.
  target_entity_type: string;           // 'User', 'Project', etc.
  cardinality: string;
  display_name: string;                  // Human-readable name for UI
  description?: string;
  ui_config: Record<string, any>;       // Icons, colors, etc.
  sort_order: number;
  is_active: boolean;
  system_protected: boolean;             // 🔒 Deletion protection flag
  validation_rules: Record<string, any>; // Validation and behavior rules
  default_behavior: Record<string, any>; // Default values and auto-assignment
  created_at: Date;
  updated_at: Date;
}

export class UnifiedRelationshipFieldManager {
  
  /**
   * Ensure organization has relationship fields from archetype templates
   * (Called during entity creation - same pattern as ArchetypeOptionsManager)
   */
  static async ensureArchetypeRelationshipFields(
    kysely: Kysely<any>, 
    orgId: string, 
    entityName: string,
    archetype: string
  ): Promise<void> {
    console.log(`[UnifiedRelationshipFields] Ensuring ${archetype} relationship fields for org ${orgId}`);
    
    // Get archetype class and extract relationship fields
    const ArchetypeRegistry = await import('../archetypes/ArchetypeRegistry');
    const archetypeClass = ArchetypeRegistry.default.get(archetype);
    
    if (!archetypeClass) {
      console.warn(`[UnifiedRelationshipFields] Unknown archetype: ${archetype}`);
      return;
    }
    
    const relationshipFields = Object.entries(archetypeClass.fields)
      .filter(([_, fieldDef]) => RelationshipFieldHandler.isRelationshipField(fieldDef.type));
      
    console.log(`[UnifiedRelationshipFields] Found ${relationshipFields.length} relationship fields for ${archetype}`);
    
    // Process each relationship field from archetype
    for (const [fieldName, fieldDef] of relationshipFields) {
      await this.ensureRelationshipField(kysely, orgId, entityName, fieldName, fieldDef);
    }
  }

  /**
   * Ensure a specific relationship field exists (create if missing)
   */
  private static async ensureRelationshipField(
    kysely: Kysely<any>,
    orgId: string, 
    entityName: string,
    fieldName: string,
    fieldDef: any
  ): Promise<void> {
    // Check if field already exists
    const existing = await kysely
      .selectFrom('dataforge_relationship_fields')
      .select('id')
      .where('org_id', '=', orgId)
      .where('entity_type', '=', entityName)
      .where('field_name', '=', fieldName)
      .execute();
      
    if (existing.length > 0) {
      console.log(`[UnifiedRelationshipFields] Relationship field ${fieldName} already exists for ${entityName}`);
      return; // Already exists
    }

    // Infer relationship metadata using existing logic
    const relationshipMetadata = RelationshipFieldHandler.convertToRelationshipMetadata(
      fieldName,
      fieldDef.type,
      entityName
    );

    // Create relationship field record with validation rules
    await kysely
      .insertInto('dataforge_relationship_fields')
      .values({
        org_id: orgId,
        entity_type: entityName,
        field_name: fieldName,                          // 🔑 Keep original field name
        field_type: fieldDef.type,
        relationship_type: relationshipMetadata.relationshipType || 'relates_to',
        target_entity_type: relationshipMetadata.targetEntityType || 'Unknown',
        cardinality: relationshipMetadata.cardinality || 'many-to-many',
        display_name: this.formatDisplayName(fieldName),
        description: `${relationshipMetadata.relationshipType} relationship from ${entityName}`,
        ui_config: this.getDefaultUIConfig(relationshipMetadata.relationshipType || 'relates_to'),
        validation_rules: this.getValidationRules(fieldName, relationshipMetadata.relationshipType || 'relates_to'),
        default_behavior: this.getDefaultBehavior(fieldName, relationshipMetadata.relationshipType || 'relates_to'),
        sort_order: this.getDefaultSortOrder(fieldName),
        is_active: true,
        system_protected: fieldDef.systemField || false, // 🔒 Copy system protection flag
        created_at: new Date(),
        updated_at: new Date()
      })
      .execute();
      
    console.log(`[UnifiedRelationshipFields] Created relationship field ${fieldName} for ${entityName}`);
  }

  /**
   * Get all relationship fields for an entity (single unified API)
   */
  static async getRelationshipFields(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string
  ): Promise<UnifiedRelationshipField[]> {
    const fields = await kysely
      .selectFrom('dataforge_relationship_fields')
      .selectAll()
      .where('org_id', '=', orgId)
      .where('entity_type', '=', entityType)
      .where('is_active', '=', true)
      .orderBy('sort_order')
      .execute();
      
    return fields.map(field => ({
      ...field,
      ui_config: typeof field.ui_config === 'string' 
        ? JSON.parse(field.ui_config) 
        : field.ui_config || {}
    }));
  }

  /**
   * Add custom relationship field
   */
  static async addCustomRelationshipField(
    kysely: Kysely<any>,
    orgId: string,
    fieldData: {
      entityType: string;
      fieldName: string;
      fieldType: string;
      relationshipType: string;
      targetEntityType: string;
      displayName?: string;
      description?: string;
    }
  ): Promise<{ success: boolean; fieldId?: string; error?: string }> {
    try {
      // Check for duplicate field names
      const existing = await kysely
        .selectFrom('dataforge_relationship_fields')
        .select('id')
        .where('org_id', '=', orgId)
        .where('entity_type', '=', fieldData.entityType)
        .where('field_name', '=', fieldData.fieldName)
        .execute();

      if (existing.length > 0) {
        return {
          success: false,
          error: `Relationship field '${fieldData.fieldName}' already exists for ${fieldData.entityType}`
        };
      }

      // Create custom relationship field
      const result = await kysely
        .insertInto('dataforge_relationship_fields')
        .values({
          org_id: orgId,
          entity_type: fieldData.entityType,
          field_name: fieldData.fieldName,
          field_type: fieldData.fieldType,
          relationship_type: fieldData.relationshipType,
          target_entity_type: fieldData.targetEntityType,
          cardinality: 'many-to-many', // Default for custom fields
          display_name: fieldData.displayName || this.formatDisplayName(fieldData.fieldName),
          description: fieldData.description || `Custom ${fieldData.relationshipType} relationship`,
          ui_config: this.getDefaultUIConfig(fieldData.relationshipType),
          sort_order: 999, // Custom fields sort after system fields
          is_active: true,
          system_protected: false, // Custom fields are never system protected
          created_at: new Date(),
          updated_at: new Date()
        })
        .returning('id')
        .execute();

      console.log(`[UnifiedRelationshipFields] Created custom relationship field ${fieldData.fieldName} for ${fieldData.entityType}`);
      return { success: true, fieldId: result[0].id };
    } catch (error) {
      console.error('[UnifiedRelationshipFields] Error creating custom relationship field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Update relationship field (with system protection validation)
   */
  static async updateRelationshipField(
    kysely: Kysely<any>,
    orgId: string,
    fieldId: string,
    updates: Partial<{
      display_name: string;
      description: string;
      ui_config: Record<string, any>;
      sort_order: number;
      is_active: boolean;
    }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get current field
      const field = await kysely
        .selectFrom('dataforge_relationship_fields')
        .select(['field_name', 'system_protected', 'entity_type'])
        .where('id', '=', fieldId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (!field) {
        return { success: false, error: 'Relationship field not found' };
      }

      // 🔒 System protection validation
      if (field.system_protected && updates.is_active === false) {
        return {
          success: false,
          error: `Cannot disable system relationship field '${field.field_name}' - it's required for ${field.entity_type} business logic`
        };
      }

      // Apply updates
      await kysely
        .updateTable('dataforge_relationship_fields')
        .set({
          ...updates,
          updated_at: new Date()
        })
        .where('id', '=', fieldId)
        .where('org_id', '=', orgId)
        .execute();

      return { success: true };
    } catch (error) {
      console.error('[UnifiedRelationshipFields] Error updating relationship field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get available relationship templates for custom relationships
   */
  static getAvailableRelationshipTemplates(): Array<{
    relationshipType: string;
    displayName: string;
    description: string;
    cardinality: string;
    category: string;
    useCase: string;
    icon: string;
    color: string;
  }> {
    return [
      // Basic Relationship Templates
      {
        relationshipType: 'relates_to_one',
        displayName: 'Relates To One',
        description: 'Many entities can relate to one target (many-to-one)',
        cardinality: 'many-to-one',
        category: 'Basic',
        useCase: 'Examples: Tasks → Milestone, Documents → Category, Employees → Department',
        icon: 'arrow-right',
        color: '#6B7280'
      },
      {
        relationshipType: 'relates_to_many',
        displayName: 'Related To Many',
        description: 'Entities can relate to multiple targets (many-to-many)',
        cardinality: 'many-to-many',
        category: 'Basic',
        useCase: 'Examples: Tasks ↔ Tags, Projects ↔ Teams, Documents ↔ Categories',
        icon: 'link-2',
        color: '#64748B'
      },
      {
        relationshipType: 'has_one',
        displayName: 'Has One',
        description: 'Exclusive one-to-one relationship',
        cardinality: 'one-to-one',
        category: 'Basic',
        useCase: 'Examples: User ↔ Profile, Project ↔ Budget, Document ↔ Primary Version',
        icon: 'minus',
        color: '#10B981'
      },
      {
        relationshipType: 'has_many',
        displayName: 'Contains Many',
        description: 'One entity owns/contains many others (one-to-many)',
        cardinality: 'one-to-many',
        category: 'Basic',
        useCase: 'Examples: Project → Tasks, Department → Employees, Category → Documents',
        icon: 'list',
        color: '#8B5CF6'
      },
      
      // Rollup/Aggregation Templates
      {
        relationshipType: 'rollup_count_related',
        displayName: 'Count Related',
        description: 'Count of related entities (auto-calculated)',
        cardinality: 'computed',
        category: 'Rollup',
        useCase: 'Examples: Task count, Team member count, Document count',
        icon: 'hash',
        color: '#3B82F6'
      },
      {
        relationshipType: 'rollup_sum_related',
        displayName: 'Sum Related',
        description: 'Sum of numeric values from related entities (auto-calculated)',
        cardinality: 'computed',
        category: 'Rollup',
        useCase: 'Examples: Total budget, Total hours, Total revenue',
        icon: 'calculator',
        color: '#F59E0B'
      },
      {
        relationshipType: 'rollup_list_related',
        displayName: 'List Related',
        description: 'List of values from related entities (auto-generated)',
        cardinality: 'computed',
        category: 'Rollup',
        useCase: 'Examples: Tag list, Team names, Status list',
        icon: 'list-ul',
        color: '#8B5CF6'
      },
      {
        relationshipType: 'rollup_average_related',
        displayName: 'Average Related',
        description: 'Average of numeric values from related entities (auto-calculated)',
        cardinality: 'computed',
        category: 'Rollup',
        useCase: 'Examples: Average score, Average completion time, Average rating',
        icon: 'trending-up',
        color: '#10B981'
      },
      
      // Advanced Display Templates
      {
        relationshipType: 'display_related_field',
        displayName: 'Display Field',
        description: 'Shows specific field values from related entities',
        cardinality: 'display',
        category: 'Display',
        useCase: 'Examples: Show assignee name, Show project title, Show status',
        icon: 'external-link',
        color: '#6366F1'
      },
      {
        relationshipType: 'related_status_indicator',
        displayName: 'Status Indicator',
        description: 'Visual status indicators from related entities',
        cardinality: 'status_display',
        category: 'Display',
        useCase: 'Examples: Task status badges, Approval states, Progress indicators',
        icon: 'activity',
        color: '#F59E0B'
      },
      {
        relationshipType: 'smart_reference_display',
        displayName: 'Smart Reference',
        description: 'Intelligent display with contextual information and navigation',
        cardinality: 'smart_display',
        category: 'Display',
        useCase: 'Examples: "John Doe (CEO)", "Project Alpha - 75%", Click-through navigation',
        icon: 'zap',
        color: '#8B5CF6'
      },
      {
        relationshipType: 'timeline_related',
        displayName: 'Timeline',
        description: 'Chronological timeline of related entity activity',
        cardinality: 'timeline_display',
        category: 'Display',
        useCase: 'Examples: Recent activity, Project milestones, Approval history',
        icon: 'clock',
        color: '#059669'
      }
    ];
  }

  /**
   * Delete relationship field (with system protection validation)
   */
  static async deleteRelationshipField(
    kysely: Kysely<any>,
    orgId: string,
    fieldId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const field = await kysely
        .selectFrom('dataforge_relationship_fields')
        .select(['field_name', 'system_protected', 'entity_type'])
        .where('id', '=', fieldId)
        .where('org_id', '=', orgId)
        .executeTakeFirst();

      if (!field) {
        return { success: false, error: 'Relationship field not found' };
      }

      // 🔒 System protection guard (same pattern as options)
      if (field.system_protected) {
        return {
          success: false,
          error: `Cannot delete system relationship field '${field.field_name}' - it's required for ${field.entity_type} business logic`
        };
      }

      // Soft delete (set inactive) for non-system fields
      await kysely
        .updateTable('dataforge_relationship_fields')
        .set({ 
          is_active: false,
          updated_at: new Date()
        })
        .where('id', '=', fieldId)
        .where('org_id', '=', orgId)
        .execute();

      console.log(`[UnifiedRelationshipFields] Deleted relationship field ${field.field_name} for ${field.entity_type}`);
      return { success: true };
    } catch (error) {
      console.error('[UnifiedRelationshipFields] Error deleting relationship field:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Helper methods

  private static formatDisplayName(fieldName: string): string {
    return fieldName
      .replace(/_id$/, '')                    // Remove _id suffix
      .replace(/_/g, ' ')                     // Replace underscores with spaces
      .replace(/\b\w/g, c => c.toUpperCase()) // Title case
      .trim();
  }

  private static getDefaultUIConfig(relationshipType: string): Record<string, any> {
    const configs: Record<string, any> = {
      'assigned_to': { icon: 'user-check', color: '#3B82F6' },
      'owned_by': { icon: 'crown', color: '#FBBF24' },
      'created_by': { icon: 'user-plus', color: '#10B981' },
      'belongs_to': { icon: 'folder', color: '#6B7280' },
      'subtask_of': { icon: 'git-branch', color: '#8B5CF6' },
      'reviewed_by': { icon: 'eye', color: '#EC4899' },
      'managed_by': { icon: 'users', color: '#06B6D4' }
    };
    
    return configs[relationshipType] || { icon: 'link-2', color: '#64748B' };
  }

  private static getDefaultSortOrder(fieldName: string): number {
    // System fields get predictable sort orders
    const systemSortOrders: Record<string, number> = {
      'assignee_id': 1,
      'owner_id': 1,
      'created_by': 90,
      'parent_task_id': 10,
      'project_id': 20
    };
    
    return systemSortOrders[fieldName] || 50;
  }

  private static getValidationRules(fieldName: string, relationshipType: string): Record<string, any> {
    // Define validation rules based on relationship semantics
    const validationRules: Record<string, Record<string, any>> = {
      // Owner relationships - can only be one, can switch ownership
      'owned_by': {
        max_relationships: 1,
        can_change: true,
        required: false,
        unique_per_entity: true,
        validation_message: 'Each entity can have only one owner'
      },
      
      // Assignment relationships - can be multiple assignees, can change
      'assigned_to': {
        max_relationships: null, // unlimited
        can_change: true,
        required: false,
        unique_per_entity: false,
        validation_message: 'Multiple assignees allowed'
      },
      
      // Creator relationships - cannot change, auto-set
      'created_by': {
        max_relationships: 1,
        can_change: false, // 🔒 Cannot switch creator
        required: true,
        unique_per_entity: true,
        immutable: true,
        validation_message: 'Creator cannot be changed after creation'
      },
      
      // Parent relationships - single parent, can change
      'subtask_of': {
        max_relationships: 1,
        can_change: true,
        required: false,
        unique_per_entity: true,
        prevent_circular: true,
        validation_message: 'Task can have only one parent'
      },
      
      // Project membership - can belong to multiple projects
      'belongs_to': {
        max_relationships: null,
        can_change: true,
        required: false,
        unique_per_entity: false,
        validation_message: 'Can belong to multiple projects'
      },
      
      // Management relationships - single manager
      'managed_by': {
        max_relationships: 1,
        can_change: true,
        required: false,
        unique_per_entity: true,
        validation_message: 'Each entity can have only one manager'
      },
      
      // Review relationships - can have multiple reviewers
      'reviewed_by': {
        max_relationships: null,
        can_change: true,
        required: false,
        unique_per_entity: false,
        validation_message: 'Multiple reviewers allowed'
      }
    };

    // Return specific rules or defaults
    return validationRules[relationshipType] || {
      max_relationships: null,
      can_change: true,
      required: false,
      unique_per_entity: false,
      validation_message: 'Standard relationship validation'
    };
  }

  private static getDefaultBehavior(fieldName: string, relationshipType: string): Record<string, any> {
    // Define default behaviors for different relationship types
    const defaultBehaviors: Record<string, Record<string, any>> = {
      // Creator is auto-assigned to current user
      'created_by': {
        auto_assign_creator: true,
        default_value: 'current_user',
        set_on_creation: true,
        inherit_from_parent: false,
        ui_behavior: 'hidden' // Don't show in forms - auto-populated
      },
      
      // Owner defaults to creator but can be changed
      'owned_by': {
        auto_assign_creator: false,
        default_value: 'current_user',
        set_on_creation: true,
        inherit_from_parent: false,
        ui_behavior: 'optional' // Show in forms with current user default
      },
      
      // Assignee has no default - must be explicitly set
      'assigned_to': {
        auto_assign_creator: false,
        default_value: null,
        set_on_creation: false,
        inherit_from_parent: false,
        ui_behavior: 'required_select' // Show dropdown, no default
      },
      
      // Parent task can be inherited from URL context
      'subtask_of': {
        auto_assign_creator: false,
        default_value: null,
        set_on_creation: false,
        inherit_from_parent: true, // Can inherit from context
        ui_behavior: 'contextual' // Show if creating from parent context
      },
      
      // Project membership can be inherited from context
      'belongs_to': {
        auto_assign_creator: false,
        default_value: null,
        set_on_creation: false,
        inherit_from_parent: true,
        ui_behavior: 'contextual'
      },
      
      // Manager has no default
      'managed_by': {
        auto_assign_creator: false,
        default_value: null,
        set_on_creation: false,
        inherit_from_parent: false,
        ui_behavior: 'optional'
      }
    };

    // Return specific behavior or defaults
    return defaultBehaviors[relationshipType] || {
      auto_assign_creator: false,
      default_value: null,
      set_on_creation: false,
      inherit_from_parent: false,
      ui_behavior: 'optional'
    };
  }
}