/**
 * Relationship Field Handler
 * 
 * Manages the transformation of reference fields (user_reference, entity_reference)
 * into proper many-to-many relationships using per-org relationship tables.
 * 
 * Instead of storing foreign keys as columns, relationships are stored in
 * the org_xxx_relationships table with rich metadata support.
 */

import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export interface RelationshipFieldDefinition {
  name: string;
  type: 'user_reference' | 'entity_reference';
  relationshipType?: string;  // e.g., 'assigned_to', 'owned_by', 'belongs_to'
  targetEntityType?: string;  // For entity_reference, specify target type
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  properties?: Record<string, any>;  // Default properties for the relationship
}

export class RelationshipFieldHandler {
  /**
   * Check if a field type is a relationship field
   */
  static isRelationshipField(fieldType: string): boolean {
    return fieldType === 'user_reference' || 
           fieldType === 'entity_reference' ||
           fieldType === 'custom_user_reference' ||
           fieldType === 'custom_entity_reference';
  }

  /**
   * Convert a reference field definition to relationship metadata
   */
  static convertToRelationshipMetadata(
    fieldName: string,
    fieldType: string,
    entityName: string,
    fieldDefinition?: any
  ): RelationshipFieldDefinition {
    // For custom relationship fields, use the configured relationship type and target
    let relationshipType: string;
    let targetEntityType: string;
    
    if (fieldDefinition && (fieldType === 'custom_user_reference' || fieldType === 'custom_entity_reference')) {
      relationshipType = fieldDefinition.relationshipType || this.inferRelationshipType(fieldName, fieldType);
      targetEntityType = fieldDefinition.targetEntityType || this.inferTargetEntityType(fieldName, fieldType);
    } else {
      // For archetype reference fields, infer from field name
      relationshipType = this.inferRelationshipType(fieldName, fieldType);
      targetEntityType = this.inferTargetEntityType(fieldName, fieldType);
    }
    
    const cardinality = this.inferCardinality(fieldName, relationshipType);

    return {
      name: fieldName,
      type: fieldType as 'user_reference' | 'entity_reference' | 'custom_user_reference' | 'custom_entity_reference',
      relationshipType,
      targetEntityType,
      cardinality,
      properties: this.getDefaultProperties(relationshipType)
    };
  }

  /**
   * Infer relationship type from field name
   */
  private static inferRelationshipType(fieldName: string, fieldType: string): string {
    // Common patterns
    const patterns: Record<string, string> = {
      'assignee_id': 'assigned_to',
      'owner_id': 'owned_by',
      'author_id': 'authored_by',
      'created_by': 'created_by',
      'updated_by': 'updated_by',
      'uploaded_by': 'uploaded_by',
      'actor_id': 'performed_by',
      'parent_task_id': 'subtask_of',
      'parent_document_id': 'child_of',
      'parent_record_id': 'child_of',
      'parent_discussion_id': 'reply_to',
      'project_id': 'belongs_to',
      'manager_id': 'managed_by',
      'reporter_id': 'reported_by',
      'depends_on_id': 'depends_on',
      'dependency_id': 'depends_on',
      'predecessor_id': 'depends_on',
      'successor_id': 'successor_of',
      'approver_id': 'requires_approval_from',
      'approval_request_id': 'requires_approval_from',
      'approved_by_id': 'approved_by'
    };

    return patterns[fieldName] || 'relates_to';
  }

  /**
   * Infer target entity type from field name
   */
  private static inferTargetEntityType(fieldName: string, fieldType: string): string {
    if (fieldType === 'user_reference' || fieldType === 'custom_user_reference') {
      return 'User';
    }

    // Entity reference patterns
    const patterns: Record<string, string> = {
      'parent_task_id': 'Task',
      'parent_document_id': 'Document',
      'parent_record_id': 'Record',
      'parent_discussion_id': 'Discussion',
      'parent_project_id': 'Project',
      'project_id': 'Project',
      'task_id': 'Task',
      'document_id': 'Document',
      'invoice_id': 'Invoice',
      'file_id': 'File'
    };

    if (patterns[fieldName]) {
      return patterns[fieldName];
    }

    // Try to infer from field name
    if (fieldName.endsWith('_id')) {
      const entityName = fieldName.replace(/_id$/, '').replace(/^parent_/, '');
      return entityName.charAt(0).toUpperCase() + entityName.slice(1);
    }

    return 'Unknown';
  }

  /**
   * Infer cardinality from relationship type
   */
  private static inferCardinality(fieldName: string, relationshipType: string): 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many' {
    // Most relationships in the system should be many-to-many for flexibility
    const manyToMany = [
      'assigned_to',
      'member_of',
      'watching',
      'tagged_with',
      'references',
      'relates_to'
    ];

    const manyToOne = [
      'owned_by',
      'created_by',
      'authored_by',
      'uploaded_by',
      'subtask_of',
      'child_of',
      'belongs_to',
      'managed_by',
      'reported_by'
    ];

    const oneToMany = [
      'owns',
      'manages',
      'has_subtasks',
      'has_children'
    ];

    if (manyToMany.includes(relationshipType)) {
      return 'many-to-many';
    } else if (manyToOne.includes(relationshipType)) {
      return 'many-to-one';
    } else if (oneToMany.includes(relationshipType)) {
      return 'one-to-many';
    }

    // Default to many-to-many for maximum flexibility
    return 'many-to-many';
  }

  /**
   * Get default properties for a relationship type
   */
  private static getDefaultProperties(relationshipType: string): Record<string, any> {
    const defaults: Record<string, Record<string, any>> = {
      'assigned_to': {
        role: 'assignee',
        effort_percentage: 100
      },
      'owned_by': {
        role: 'owner',
        transfer_date: null
      },
      'member_of': {
        role: 'member',
        joined_date: new Date().toISOString()
      },
      'watching': {
        notifications_enabled: true,
        watch_reason: 'manual'
      },
      'blocks': {
        severity: 'medium',
        reason: null
      }
    };

    return defaults[relationshipType] || {};
  }

  /**
   * Create relationship record when a reference field is set
   */
  static async createRelationship(
    kysely: Kysely<any>,
    orgId: string,
    sourceEntityType: string,
    sourceEntityId: string,
    relationshipDef: RelationshipFieldDefinition,
    targetEntityId: string,
    userId: string,
    additionalProperties?: Record<string, any>
  ): Promise<void> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    // Check if relationship table exists
    const tableExists = await this.checkRelationshipTableExists(kysely, relationshipTable);
    if (!tableExists) {
      await this.createRelationshipTable(kysely, orgId);
    }

    // Merge default properties with additional properties
    const properties = {
      ...relationshipDef.properties,
      ...additionalProperties
    };

    // Insert relationship record - use simple INSERT without UPSERT for now
    // Since we have a partial unique index with WHERE clause, ON CONFLICT with column matching doesn't work
    try {
      await kysely
        .insertInto(relationshipTable)
        .values({
          source_entity_type: sourceEntityType,
          source_entity_id: sourceEntityId,
          relationship_type: relationshipDef.relationshipType,
          target_entity_type: relationshipDef.targetEntityType,
          target_entity_id: targetEntityId,
          properties: JSON.stringify(properties),
          created_by: userId,
          created_at: new Date(),
          valid_from: new Date()
        })
        .execute();
    } catch (error: any) {
      // If it's a unique constraint violation, update the existing record
      if (error.code === '23505') { // PostgreSQL unique violation error code
        await kysely
          .updateTable(relationshipTable)
          .set({
            properties: JSON.stringify(properties),
            updated_by: userId,
            updated_at: new Date()
          })
          .where('source_entity_type', '=', sourceEntityType)
          .where('source_entity_id', '=', sourceEntityId)
          .where('relationship_type', '=', relationshipDef.relationshipType)
          .where('target_entity_type', '=', relationshipDef.targetEntityType)
          .where('target_entity_id', '=', targetEntityId)
          .where('valid_until', 'is', null)
          .execute();
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if relationship table exists for organization
   */
  private static async checkRelationshipTableExists(kysely: Kysely<any>, tableName: string): Promise<boolean> {
    try {
      const result = await sql<{ exists: boolean }>`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = ${tableName}
        )
      `.execute(kysely);
      
      return result.rows[0]?.exists || false;
    } catch {
      return false;
    }
  }

  /**
   * Create relationship table for organization if it doesn't exist
   */
  private static async createRelationshipTable(kysely: Kysely<any>, orgId: string): Promise<void> {
    const tableName = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    // Use raw SQL to avoid Kysely template issues with complex table names
    await sql`
      CREATE TABLE IF NOT EXISTS ${sql.raw(tableName)} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_entity_type VARCHAR(100) NOT NULL,
        source_entity_id UUID NOT NULL,
        relationship_type VARCHAR(100) NOT NULL,
        relationship_subtype VARCHAR(100),
        target_entity_type VARCHAR(100) NOT NULL,
        target_entity_id UUID NOT NULL,
        properties JSONB DEFAULT '{}',
        valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        valid_until TIMESTAMP,
        created_by UUID NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_by UUID,
        updated_at TIMESTAMP
      )
    `.execute(kysely);

    // Create unique constraint for active relationships using partial unique index
    const uniqueIndexName = `unique_${tableName}_active`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS ${sql.raw(uniqueIndexName)}
      ON ${sql.raw(tableName)}(source_entity_type, source_entity_id, relationship_type, target_entity_type, target_entity_id) 
      WHERE valid_until IS NULL`.execute(kysely);

    // Create indexes
    const sourceIndexName = `idx_${tableName}_source`;
    await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(sourceIndexName)}
      ON ${sql.raw(tableName)}(source_entity_type, source_entity_id) 
      WHERE valid_until IS NULL`.execute(kysely);
      
    const targetIndexName = `idx_${tableName}_target`;
    await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(targetIndexName)}
      ON ${sql.raw(tableName)}(target_entity_type, target_entity_id) 
      WHERE valid_until IS NULL`.execute(kysely);
      
    const typeIndexName = `idx_${tableName}_type`;
    await sql`CREATE INDEX IF NOT EXISTS ${sql.raw(typeIndexName)}
      ON ${sql.raw(tableName)}(relationship_type) 
      WHERE valid_until IS NULL`.execute(kysely);
  }

  /**
   * Get relationships for an entity
   */
  static async getRelationships(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    entityId: string,
    relationshipType?: string
  ): Promise<any[]> {
    const relationshipTable = `org_${orgId.replace(/-/g, '_')}_relationships`;
    
    let query = kysely
      .selectFrom(relationshipTable)
      .selectAll()
      .where((eb) => eb.or([
        eb.and([
          eb('source_entity_type', '=', entityType),
          eb('source_entity_id', '=', entityId)
        ]),
        eb.and([
          eb('target_entity_type', '=', entityType),
          eb('target_entity_id', '=', entityId)
        ])
      ]))
      .where('valid_until', 'is', null);

    if (relationshipType) {
      query = query.where('relationship_type', '=', relationshipType);
    }

    return await query.execute();
  }

  /**
   * Store relationship field configuration in dataforge_relationship_fields
   */
  static async storeRelationshipFieldConfig(
    kysely: Kysely<any>,
    orgId: string,
    entityType: string,
    relationshipDef: RelationshipFieldDefinition
  ): Promise<void> {
    await kysely
      .insertInto('dataforge_relationship_fields')
      .values({
        org_id: orgId,
        entity_type: entityType,
        field_name: relationshipDef.name,
        relationship_type: relationshipDef.relationshipType,
        target_entity_type: relationshipDef.targetEntityType,
        cardinality: relationshipDef.cardinality,
        display_format: `{{source}} ${relationshipDef.relationshipType} {{target}}`,
        ui_config: JSON.stringify({
          icon: this.getRelationshipIcon(relationshipDef.relationshipType),
          color: this.getRelationshipColor(relationshipDef.relationshipType),
          showInGrid: true,
          showInDetail: true
        }),
        created_at: new Date()
      })
      .onConflict((oc) => oc
        .columns(['org_id', 'entity_type', 'field_name'])
        .doUpdateSet({
          relationship_type: relationshipDef.relationshipType,
          target_entity_type: relationshipDef.targetEntityType,
          cardinality: relationshipDef.cardinality,
          updated_at: new Date()
        })
      )
      .execute();
  }

  /**
   * Get icon for relationship type
   */
  private static getRelationshipIcon(relationshipType: string): string {
    const icons: Record<string, string> = {
      'assigned_to': 'user-check',
      'owned_by': 'crown',
      'authored_by': 'edit',
      'member_of': 'users',
      'blocks': 'ban',
      'watching': 'eye',
      'references': 'link',
      'belongs_to': 'folder',
      'subtask_of': 'git-branch'
    };
    return icons[relationshipType] || 'link-2';
  }

  /**
   * Get color for relationship type
   */
  private static getRelationshipColor(relationshipType: string): string {
    const colors: Record<string, string> = {
      'assigned_to': '#3B82F6',
      'owned_by': '#FBBF24',
      'authored_by': '#EC4899',
      'member_of': '#10B981',
      'blocks': '#EF4444',
      'watching': '#A78BFA',
      'references': '#06B6D4',
      'belongs_to': '#6B7280',
      'subtask_of': '#8B5CF6'
    };
    return colors[relationshipType] || '#64748B';
  }
}