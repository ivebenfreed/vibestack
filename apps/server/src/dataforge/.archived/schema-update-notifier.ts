/**
 * Schema Update Notifier
 * 
 * Integrates with EntityManager to notify clients of schema changes.
 * Triggers real-time schema updates through the sync system.
 */

import { schemaSyncHandler } from '../../sync/schema-sync-handler';
import type { 
  SchemaChangeType,
  EntityChange,
  FieldChange
} from '@repo/sync-types';
import type { OrgEntityDefinition, EntityConfig } from '../json-schema/org-entity-schema';

/**
 * Schema Update Notifier
 * Watches entity manager operations and triggers sync notifications
 */
export class SchemaUpdateNotifier {
  constructor(private enabled = true) {
    console.log(`🔔 Schema update notifier ${this.enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Notify clients that a new entity was created
   */
  async notifyEntityCreated(
    orgId: string,
    entityName: string,
    definition: OrgEntityDefinition,
    config: EntityConfig
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying entity created: ${orgId}/${entityName}`);

    const entityChange: EntityChange = {
      entityName,
      changeType: 'entity_created',
      tableName: definition.tableName,
      newDefinition: this.sanitizeDefinitionForClient(definition),
      fieldChanges: this.getFieldChangesForNewEntity(definition)
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'entity_created',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that an entity was updated
   */
  async notifyEntityUpdated(
    orgId: string,
    entityName: string,
    oldDefinition: OrgEntityDefinition,
    newDefinition: OrgEntityDefinition,
    config: EntityConfig
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying entity updated: ${orgId}/${entityName}`);

    const fieldChanges = this.compareFieldDefinitions(
      oldDefinition.customFields,
      newDefinition.customFields
    );

    const entityChange: EntityChange = {
      entityName,
      changeType: 'entity_updated',
      tableName: newDefinition.tableName,
      oldDefinition: this.sanitizeDefinitionForClient(oldDefinition),
      newDefinition: this.sanitizeDefinitionForClient(newDefinition),
      fieldChanges
    };

    const changeType = this.determineChangeType(fieldChanges);

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      changeType,
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that an entity was deleted
   */
  async notifyEntityDeleted(
    orgId: string,
    entityName: string,
    definition: OrgEntityDefinition
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying entity deleted: ${orgId}/${entityName}`);

    const entityChange: EntityChange = {
      entityName,
      changeType: 'entity_deleted',
      tableName: definition.tableName,
      oldDefinition: this.sanitizeDefinitionForClient(definition)
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'entity_deleted',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that a field was added
   */
  async notifyFieldAdded(
    orgId: string,
    entityName: string,
    fieldName: string,
    fieldDefinition: any,
    tableName: string
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying field added: ${orgId}/${entityName}.${fieldName}`);

    const fieldChange: FieldChange = {
      fieldName,
      changeType: 'added',
      newDefinition: this.sanitizeFieldForClient(fieldDefinition)
    };

    const entityChange: EntityChange = {
      entityName,
      changeType: 'field_added',
      tableName,
      fieldChanges: [fieldChange]
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'field_added',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that a field was updated
   */
  async notifyFieldUpdated(
    orgId: string,
    entityName: string,
    fieldName: string,
    oldDefinition: any,
    newDefinition: any,
    tableName: string
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying field updated: ${orgId}/${entityName}.${fieldName}`);

    const fieldChange: FieldChange = {
      fieldName,
      changeType: 'updated',
      oldDefinition: this.sanitizeFieldForClient(oldDefinition),
      newDefinition: this.sanitizeFieldForClient(newDefinition)
    };

    const entityChange: EntityChange = {
      entityName,
      changeType: 'field_updated',
      tableName,
      fieldChanges: [fieldChange]
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'field_updated',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that a field was deleted
   */
  async notifyFieldDeleted(
    orgId: string,
    entityName: string,
    fieldName: string,
    oldDefinition: any,
    tableName: string
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying field deleted: ${orgId}/${entityName}.${fieldName}`);

    const fieldChange: FieldChange = {
      fieldName,
      changeType: 'deleted',
      oldDefinition: this.sanitizeFieldForClient(oldDefinition)
    };

    const entityChange: EntityChange = {
      entityName,
      changeType: 'field_deleted',
      tableName,
      fieldChanges: [fieldChange]
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'field_deleted',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that validation rules were updated
   */
  async notifyValidationUpdated(
    orgId: string,
    entityName: string,
    oldRules: any,
    newRules: any,
    tableName: string
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying validation updated: ${orgId}/${entityName}`);

    const entityChange: EntityChange = {
      entityName,
      changeType: 'validation_updated',
      tableName,
      oldDefinition: { validationRules: oldRules },
      newDefinition: { validationRules: newRules }
    };

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'validation_updated',
      [entityChange],
      this.generateVersion()
    );
  }

  /**
   * Notify clients that a migration was applied
   */
  async notifyMigrationApplied(
    orgId: string,
    migrationId: string,
    affectedEntities: string[],
    migrationDetails: any
  ): Promise<void> {
    if (!this.enabled) return;

    console.log(`🔔 Notifying migration applied: ${orgId}/${migrationId}`);

    const entityChanges: EntityChange[] = affectedEntities.map(entityName => ({
      entityName,
      changeType: 'migration_applied',
      tableName: `${orgId}_${entityName.toLowerCase()}s`
    }));

    await schemaSyncHandler.notifySchemaUpdate(
      orgId,
      'migration_applied',
      entityChanges,
      this.generateVersion(),
      migrationId
    );
  }

  /**
   * Notify clients of migration progress
   */
  async notifyMigrationProgress(
    orgId: string,
    migrationId: string,
    status: 'started' | 'in_progress' | 'completed' | 'failed',
    progress?: { current: number; total: number; description: string },
    error?: string
  ): Promise<void> {
    if (!this.enabled) return;

    await schemaSyncHandler.notifyMigrationProgress(
      orgId,
      migrationId,
      status,
      progress,
      error
    );
  }

  // Private helper methods

  /**
   * Sanitize entity definition for client (remove server-only fields)
   */
  private sanitizeDefinitionForClient(definition: OrgEntityDefinition): any {
    const sanitized = { ...definition };
    
    // Filter out server-only fields
    const syncableFields: Record<string, any> = {};
    for (const [fieldName, fieldDef] of Object.entries(definition.customFields)) {
      if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
        syncableFields[fieldName] = this.sanitizeFieldForClient(fieldDef);
      }
    }
    
    sanitized.customFields = syncableFields;
    return sanitized;
  }

  /**
   * Sanitize field definition for client
   */
  private sanitizeFieldForClient(fieldDef: any): any {
    const sanitized = { ...fieldDef };
    
    // Remove server-only properties
    delete sanitized.serverOnly;
    delete sanitized.internalNotes;
    
    return sanitized;
  }

  /**
   * Get field changes for new entity
   */
  private getFieldChangesForNewEntity(definition: OrgEntityDefinition): FieldChange[] {
    const fieldChanges: FieldChange[] = [];
    
    for (const [fieldName, fieldDef] of Object.entries(definition.customFields)) {
      if (fieldDef.syncable !== false && !fieldDef.serverOnly) {
        fieldChanges.push({
          fieldName,
          changeType: 'added',
          newDefinition: this.sanitizeFieldForClient(fieldDef)
        });
      }
    }
    
    return fieldChanges;
  }

  /**
   * Compare field definitions to detect changes
   */
  private compareFieldDefinitions(
    oldFields: Record<string, any>,
    newFields: Record<string, any>
  ): FieldChange[] {
    const changes: FieldChange[] = [];
    
    // Check for added and updated fields
    for (const [fieldName, newDef] of Object.entries(newFields)) {
      const oldDef = oldFields[fieldName];
      
      if (!oldDef) {
        // Field added
        if (newDef.syncable !== false && !newDef.serverOnly) {
          changes.push({
            fieldName,
            changeType: 'added',
            newDefinition: this.sanitizeFieldForClient(newDef)
          });
        }
      } else if (this.hasFieldChanged(oldDef, newDef)) {
        // Field updated
        if (newDef.syncable !== false && !newDef.serverOnly) {
          changes.push({
            fieldName,
            changeType: 'updated',
            oldDefinition: this.sanitizeFieldForClient(oldDef),
            newDefinition: this.sanitizeFieldForClient(newDef)
          });
        }
      }
    }
    
    // Check for deleted fields
    for (const [fieldName, oldDef] of Object.entries(oldFields)) {
      if (!newFields[fieldName]) {
        // Field deleted
        if (oldDef.syncable !== false && !oldDef.serverOnly) {
          changes.push({
            fieldName,
            changeType: 'deleted',
            oldDefinition: this.sanitizeFieldForClient(oldDef)
          });
        }
      }
    }
    
    return changes;
  }

  /**
   * Check if field definition has changed
   */
  private hasFieldChanged(oldDef: any, newDef: any): boolean {
    // Compare key properties that affect client
    const keys = ['type', 'required', 'syncable', 'enum', 'validation'];
    
    for (const key of keys) {
      if (JSON.stringify(oldDef[key]) !== JSON.stringify(newDef[key])) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Determine the primary change type from field changes
   */
  private determineChangeType(fieldChanges: FieldChange[]): SchemaChangeType {
    if (fieldChanges.some(c => c.changeType === 'deleted')) {
      return 'field_deleted';
    }
    if (fieldChanges.some(c => c.changeType === 'added')) {
      return 'field_added';
    }
    if (fieldChanges.some(c => c.changeType === 'updated')) {
      return 'field_updated';
    }
    return 'entity_updated';
  }

  /**
   * Generate schema version
   */
  private generateVersion(): string {
    const timestamp = Date.now();
    return `v${Math.floor(timestamp / 1000)}.${timestamp % 1000}`;
  }

  /**
   * Enable/disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    console.log(`🔔 Schema update notifier ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const schemaUpdateNotifier = new SchemaUpdateNotifier();