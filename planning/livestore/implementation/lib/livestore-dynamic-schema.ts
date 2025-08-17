/**
 * Dynamic LiveStore Schema Generator
 * 
 * Transforms organization-specific entity schemas into LiveStore-compatible schemas.
 * Integrates with existing dynamic schema system from organization POC.
 */

import type { OrgEntitySchema, EntityDefinition, FieldDefinition } from './schema-client';

// LiveStore schema types (simplified based on documentation)
export interface LiveStoreColumn {
  type: 'text' | 'integer' | 'real' | 'blob';
  primaryKey?: boolean;
  notNull?: boolean;
  default?: any;
}

export interface LiveStoreTable {
  columns: Record<string, LiveStoreColumn>;
  indexes?: string[][];
}

export interface LiveStoreSchema {
  [tableName: string]: LiveStoreTable;
}

export interface LiveStoreEvent {
  type: string;
  data: Record<string, any>;
}

/**
 * Dynamic LiveStore Schema Generator
 * Converts organization schemas to LiveStore format
 */
export class LiveStoreDynamicSchemaGenerator {
  /**
   * Generate LiveStore schema from organization schema
   */
  generateSchema(orgSchema: OrgEntitySchema): LiveStoreSchema {
    const liveStoreSchema: LiveStoreSchema = {};

    // Add base system tables that every org needs
    liveStoreSchema.local_changes = this.createLocalChangesTable();
    liveStoreSchema.sync_metadata = this.createSyncMetadataTable();

    // Generate tables for each organization entity
    for (const [entityName, entityDef] of Object.entries(orgSchema.entities)) {
      const tableName = entityDef.tableName;
      liveStoreSchema[tableName] = this.createEntityTable(entityName, entityDef, orgSchema.orgId);
    }

    return liveStoreSchema;
  }

  /**
   * Generate LiveStore events from organization schema
   */
  generateEvents(orgSchema: OrgEntitySchema): Record<string, any> {
    const events: Record<string, any> = {};

    for (const [entityName, entityDef] of Object.entries(orgSchema.entities)) {
      const archetype = this.mapExtendsToArchetype(entityDef.extends);
      
      // Create CRUD events for each entity
      events[`${entityName}Created`] = this.createEntityCreatedEvent(entityName, entityDef, orgSchema.orgId);
      events[`${entityName}Updated`] = this.createEntityUpdatedEvent(entityName, entityDef, orgSchema.orgId);
      events[`${entityName}Deleted`] = this.createEntityDeletedEvent(entityName, entityDef, orgSchema.orgId);

      // Create archetype-specific events
      if (archetype === 'Project') {
        events[`${entityName}StatusChanged`] = this.createProjectStatusEvent(entityName, entityDef);
      } else if (archetype === 'Task') {
        events[`${entityName}Assigned`] = this.createTaskAssignedEvent(entityName, entityDef);
        events[`${entityName}Completed`] = this.createTaskCompletedEvent(entityName, entityDef);
      }
    }

    return events;
  }

  /**
   * Create base entity table with organization isolation
   */
  private createEntityTable(entityName: string, entityDef: EntityDefinition, orgId: string): LiveStoreTable {
    const columns: Record<string, LiveStoreColumn> = {
      // Base entity fields (every entity has these)
      id: { type: 'text', primaryKey: true, notNull: true },
      organization_id: { type: 'text', notNull: true, default: orgId },
      created_at: { type: 'text', notNull: true },
      updated_at: { type: 'text', notNull: true },
      created_by: { type: 'text', notNull: true },
      updated_by: { type: 'text' },
      deleted_at: { type: 'text' },
      client_id: { type: 'text' },
      
      // Base archetype fields
      ...this.getBaseArchetypeFields(entityDef.extends),
      
      // Custom organization fields
      ...this.mapCustomFieldsToColumns(entityDef.syncableFields)
    };

    const indexes = [
      ['organization_id'],
      ['organization_id', 'created_at'],
      ['organization_id', 'updated_at'],
      // Add archetype-specific indexes
      ...this.getArchetypeIndexes(entityDef.extends, entityDef.syncableFields)
    ];

    return { columns, indexes };
  }

  /**
   * Get base fields for each archetype
   */
  private getBaseArchetypeFields(extendsValue: string): Record<string, LiveStoreColumn> {
    switch (extendsValue) {
      case 'base_projects':
        return {
          name: { type: 'text', notNull: true },
          description: { type: 'text' },
          status: { type: 'text', default: 'active' },
          priority: { type: 'text', default: 'medium' },
          start_date: { type: 'text' },
          end_date: { type: 'text' },
          owner_id: { type: 'text', notNull: true },
          // Container access fields
          container_id: { type: 'text', notNull: true },
          container_type: { type: 'text', notNull: true, default: 'project' }
        };

      case 'base_tasks':
        return {
          title: { type: 'text', notNull: true },
          description: { type: 'text' },
          status: { type: 'text', default: 'todo' },
          priority: { type: 'text', default: 'medium' },
          assignee_id: { type: 'text' },
          project_id: { type: 'text' },
          due_date: { type: 'text' },
          completed_at: { type: 'text' },
          // Inherit container from project
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_events':
        return {
          title: { type: 'text', notNull: true },
          description: { type: 'text' },
          start_time: { type: 'text', notNull: true },
          end_time: { type: 'text' },
          location: { type: 'text' },
          organizer_id: { type: 'text', notNull: true },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_contacts':
        return {
          name: { type: 'text', notNull: true },
          email: { type: 'text' },
          phone: { type: 'text' },
          company: { type: 'text' },
          role: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_records':
        return {
          title: { type: 'text', notNull: true },
          content: { type: 'text' },
          category: { type: 'text' },
          tags: { type: 'text' }, // JSON array as text
          parent_record_id: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_documents':
        return {
          title: { type: 'text', notNull: true },
          content: { type: 'text' },
          format: { type: 'text', default: 'markdown' },
          version: { type: 'text', default: '1.0.0' },
          parent_id: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_files':
        return {
          filename: { type: 'text', notNull: true },
          file_size: { type: 'integer' },
          mime_type: { type: 'text' },
          storage_path: { type: 'text', notNull: true },
          checksum: { type: 'text' },
          parent_entity_type: { type: 'text' },
          parent_entity_id: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_activities':
        return {
          type: { type: 'text', notNull: true },
          actor_id: { type: 'text', notNull: true },
          action: { type: 'text', notNull: true },
          entity_type: { type: 'text' },
          entity_id: { type: 'text' },
          metadata: { type: 'text' }, // JSON as text
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_discussions':
        return {
          title: { type: 'text', notNull: true },
          content: { type: 'text' },
          parent_entity_type: { type: 'text' },
          parent_entity_id: { type: 'text' },
          thread_id: { type: 'text' },
          reply_to_id: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      case 'base_collections':
        return {
          name: { type: 'text', notNull: true },
          description: { type: 'text' },
          type: { type: 'text', notNull: true },
          metadata: { type: 'text' }, // JSON as text
          parent_collection_id: { type: 'text' },
          container_id: { type: 'text' },
          container_type: { type: 'text' }
        };

      default:
        return {};
    }
  }

  /**
   * Map organization custom fields to LiveStore columns
   */
  private mapCustomFieldsToColumns(customFields: Record<string, FieldDefinition>): Record<string, LiveStoreColumn> {
    const columns: Record<string, LiveStoreColumn> = {};

    // Handle undefined or null customFields
    if (!customFields) {
      return columns;
    }

    for (const [fieldName, fieldDef] of Object.entries(customFields)) {
      // Skip non-syncable fields
      if (fieldDef.syncable === false) continue;

      columns[fieldName] = {
        type: this.mapFieldTypeToSQLiteType(fieldDef.type),
        notNull: fieldDef.required || false
      };
    }

    return columns;
  }

  /**
   * Map organization field types to SQLite types
   */
  private mapFieldTypeToSQLiteType(fieldType: string): 'text' | 'integer' | 'real' | 'blob' {
    switch (fieldType) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
      case 'enum':
      case 'date':
        return 'text';
      case 'number':
        return 'real';
      case 'integer':
        return 'integer';
      case 'boolean':
        return 'integer'; // SQLite stores booleans as integers
      case 'json':
      case 'array':
        return 'text'; // Store as JSON string
      case 'blob':
        return 'blob';
      default:
        return 'text';
    }
  }

  /**
   * Get archetype-specific indexes
   */
  private getArchetypeIndexes(extendsValue: string, customFields: Record<string, FieldDefinition>): string[][] {
    const indexes: string[][] = [];

    switch (extendsValue) {
      case 'base_projects':
        indexes.push(['organization_id', 'status']);
        indexes.push(['organization_id', 'owner_id']);
        indexes.push(['organization_id', 'priority']);
        indexes.push(['container_id']);
        break;

      case 'base_tasks':
        indexes.push(['organization_id', 'project_id']);
        indexes.push(['organization_id', 'assignee_id']);
        indexes.push(['organization_id', 'status']);
        indexes.push(['organization_id', 'due_date']);
        indexes.push(['container_id']);
        break;

      case 'base_events':
        indexes.push(['organization_id', 'start_time']);
        indexes.push(['organization_id', 'organizer_id']);
        indexes.push(['container_id']);
        break;

      case 'base_contacts':
        indexes.push(['organization_id', 'email']);
        indexes.push(['organization_id', 'company']);
        indexes.push(['container_id']);
        break;

      case 'base_records':
        indexes.push(['organization_id', 'category']);
        indexes.push(['organization_id', 'parent_record_id']);
        indexes.push(['container_id']);
        break;
    }

    // Add indexes for enum fields
    for (const [fieldName, fieldDef] of Object.entries(customFields)) {
      if (fieldDef.type === 'enum' && fieldDef.syncable !== false) {
        indexes.push(['organization_id', fieldName]);
      }
    }

    return indexes;
  }

  /**
   * Create local changes tracking table
   */
  private createLocalChangesTable(): LiveStoreTable {
    return {
      columns: {
        id: { type: 'text', primaryKey: true, notNull: true },
        table_name: { type: 'text', notNull: true },
        entity_id: { type: 'text', notNull: true },
        operation: { type: 'text', notNull: true },
        changes: { type: 'text' }, // JSON as text
        created_at: { type: 'text', notNull: true },
        synced: { type: 'integer', default: 0 }, // Boolean as integer
        organization_id: { type: 'text', notNull: true },
        client_id: { type: 'text' }
      },
      indexes: [
        ['organization_id', 'synced'],
        ['table_name', 'entity_id'],
        ['created_at']
      ]
    };
  }

  /**
   * Create sync metadata table
   */
  private createSyncMetadataTable(): LiveStoreTable {
    return {
      columns: {
        id: { type: 'text', primaryKey: true, notNull: true },
        key: { type: 'text', notNull: true },
        value: { type: 'text' },
        organization_id: { type: 'text', notNull: true },
        updated_at: { type: 'text', notNull: true }
      },
      indexes: [
        ['organization_id', 'key']
      ]
    };
  }

  /**
   * Create entity creation event
   */
  private createEntityCreatedEvent(entityName: string, entityDef: EntityDefinition, orgId: string): any {
    return {
      type: `${entityName}Created`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        createdBy: 'string',
        createdAt: 'string',
        // Include all syncable fields as potential event data
        ...this.getEventFieldsFromEntity(entityDef.syncableFields)
      }
    };
  }

  /**
   * Create entity update event
   */
  private createEntityUpdatedEvent(entityName: string, entityDef: EntityDefinition, orgId: string): any {
    return {
      type: `${entityName}Updated`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        updatedBy: 'string',
        updatedAt: 'string',
        changes: 'object', // Record of changed fields
        previousValues: 'object' // Record of previous values
      }
    };
  }

  /**
   * Create entity deletion event
   */
  private createEntityDeletedEvent(entityName: string, entityDef: EntityDefinition, orgId: string): any {
    return {
      type: `${entityName}Deleted`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        deletedBy: 'string',
        deletedAt: 'string'
      }
    };
  }

  /**
   * Create project-specific status change event
   */
  private createProjectStatusEvent(entityName: string, entityDef: EntityDefinition): any {
    return {
      type: `${entityName}StatusChanged`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        previousStatus: 'string',
        newStatus: 'string',
        changedBy: 'string',
        changedAt: 'string',
        reason: 'string'
      }
    };
  }

  /**
   * Create task assignment event
   */
  private createTaskAssignedEvent(entityName: string, entityDef: EntityDefinition): any {
    return {
      type: `${entityName}Assigned`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        assigneeId: 'string',
        assignedBy: 'string',
        assignedAt: 'string',
        previousAssigneeId: 'string'
      }
    };
  }

  /**
   * Create task completion event
   */
  private createTaskCompletedEvent(entityName: string, entityDef: EntityDefinition): any {
    return {
      type: `${entityName}Completed`,
      data: {
        entityId: 'string',
        organizationId: 'string',
        completedBy: 'string',
        completedAt: 'string',
        previousStatus: 'string'
      }
    };
  }

  /**
   * Map extends field to archetype
   */
  private mapExtendsToArchetype(extendsValue: string): string {
    switch (extendsValue) {
      case 'base_projects': return 'Project';
      case 'base_tasks': return 'Task';
      case 'base_events': return 'Event';
      case 'base_contacts': return 'Contact';
      case 'base_records': return 'Record';
      case 'base_documents': return 'Document';
      case 'base_files': return 'File';
      case 'base_activities': return 'Activity';
      case 'base_discussions': return 'Discussion';
      case 'base_collections': return 'Collection';
      default: return 'Unknown';
    }
  }

  /**
   * Get event field types from entity definition
   */
  private getEventFieldsFromEntity(syncableFields: Record<string, FieldDefinition>): Record<string, string> {
    const eventFields: Record<string, string> = {};

    for (const [fieldName, fieldDef] of Object.entries(syncableFields)) {
      if (fieldDef.syncable !== false) {
        eventFields[fieldName] = this.mapFieldTypeToEventType(fieldDef.type);
      }
    }

    return eventFields;
  }

  /**
   * Map field type to event data type
   */
  private mapFieldTypeToEventType(fieldType: string): string {
    switch (fieldType) {
      case 'string':
      case 'text':
      case 'email':
      case 'url':
      case 'enum':
      case 'date':
        return 'string';
      case 'number':
      case 'integer':
        return 'number';
      case 'boolean':
        return 'boolean';
      case 'json':
      case 'array':
        return 'object';
      default:
        return 'string';
    }
  }
}

/**
 * LiveStore Schema Manager
 * Coordinates between organization schemas and LiveStore instances
 */
export class LiveStoreSchemaManager {
  private schemaGenerator = new LiveStoreDynamicSchemaGenerator();
  private liveStoreSchemas = new Map<string, LiveStoreSchema>();
  private liveStoreEvents = new Map<string, Record<string, any>>();

  /**
   * Load and cache LiveStore schema for organization
   */
  async loadOrgLiveStoreSchema(orgId: string, orgSchema: OrgEntitySchema): Promise<{
    schema: LiveStoreSchema;
    events: Record<string, any>;
  }> {
    // Check if already cached
    const cachedSchema = this.liveStoreSchemas.get(orgId);
    const cachedEvents = this.liveStoreEvents.get(orgId);

    if (cachedSchema && cachedEvents) {
      return { schema: cachedSchema, events: cachedEvents };
    }

    // Generate new schema and events
    const schema = this.schemaGenerator.generateSchema(orgSchema);
    const events = this.schemaGenerator.generateEvents(orgSchema);

    // Cache them
    this.liveStoreSchemas.set(orgId, schema);
    this.liveStoreEvents.set(orgId, events);

    return { schema, events };
  }

  /**
   * Clear cache for organization
   */
  clearOrgCache(orgId: string): void {
    this.liveStoreSchemas.delete(orgId);
    this.liveStoreEvents.delete(orgId);
  }

  /**
   * Clear all caches
   */
  clearAllCaches(): void {
    this.liveStoreSchemas.clear();
    this.liveStoreEvents.clear();
  }

  /**
   * Get table name for entity
   */
  getTableName(orgId: string, entityName: string): string {
    // Follow same pattern as organization POC
    const cleanOrgId = orgId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const cleanEntityName = entityName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    return `${cleanOrgId}_${cleanEntityName}s`;
  }

  /**
   * Validate LiveStore schema
   */
  validateSchema(schema: LiveStoreSchema): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [tableName, tableDef] of Object.entries(schema)) {
      // Validate table has required columns
      if (!tableDef.columns.id) {
        errors.push(`Table ${tableName} missing required 'id' column`);
      }

      if (!tableDef.columns.organization_id) {
        errors.push(`Table ${tableName} missing required 'organization_id' column`);
      }

      // Validate column types
      for (const [columnName, columnDef] of Object.entries(tableDef.columns)) {
        if (!['text', 'integer', 'real', 'blob'].includes(columnDef.type)) {
          errors.push(`Table ${tableName}, column ${columnName}: invalid type '${columnDef.type}'`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// Singleton instance
export const liveStoreSchemaManager = new LiveStoreSchemaManager();