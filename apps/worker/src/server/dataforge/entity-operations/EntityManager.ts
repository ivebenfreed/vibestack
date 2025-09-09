/**
 * DataForge Entity Manager - Main Orchestrator
 * 
 * Main orchestrator that coordinates between specialized managers for entity operations.
 * This is the primary entry point that maintains the same public API while delegating
 * to specialized managers for better maintainability.
 */

import type { FieldDefinition } from '../json-rules-engine';
import type { OrgEntityDefinition } from '../org-entity-schema';
import { ComputedFieldEngine } from '../services/ComputedFieldEngine';
import { RollupEngine } from '../services/RollupEngine';

// Import specialized managers
import { RecordManager } from './RecordManager';
import { EntitySchemaManager } from './EntitySchemaManager';
import { FieldManager } from './FieldManager';
import { BulkOperationsManager } from './BulkOperationsManager';
import { ArchetypeManager } from './ArchetypeManager';
import { ComputedFieldsManager } from './ComputedFieldsManager';

export interface DataForgeEntityManagerConfig {
  kysely: any; // Kysely instance
  rulesEngine?: any; // JsonRulesEngine instance  
  env?: any; // Cloudflare environment
}

export interface ArchetypeEntityData {
  archetype: string;
  tableName: string;
  customFields: Record<string, FieldDefinition>;
  orgId?: string;
}

export interface ArchetypeCreateResult {
  success: boolean;
  entityId?: string;
  tableName?: string;
  ddl?: string;
  errors?: string[];
}

export interface ArchetypeQueryResult {
  success: boolean;
  data?: any[];
  metadata?: {
    archetype: string;
    tableName: string;
    fieldDefinitions: Record<string, FieldDefinition>;
  };
  errors?: string[];
}

export class DataForgeEntityManager {
  private config: DataForgeEntityManagerConfig;
  private configCache = new Map<string, OrgEntityDefinition>();
  
  // Specialized managers
  private recordManager: RecordManager;
  private schemaManager: EntitySchemaManager;
  private fieldManager: FieldManager;
  private bulkManager: BulkOperationsManager;
  private archetypeManager: ArchetypeManager;
  private computedManager: ComputedFieldsManager;

  constructor(config: DataForgeEntityManagerConfig) {
    this.config = config;
    
    // Initialize specialized managers with shared config
    this.recordManager = new RecordManager(config, this.configCache);
    this.schemaManager = new EntitySchemaManager(config, this.configCache);
    this.fieldManager = new FieldManager(config, this.configCache);
    this.bulkManager = new BulkOperationsManager(config, this.configCache);
    this.archetypeManager = new ArchetypeManager(config, this.configCache);
    this.computedManager = new ComputedFieldsManager(config, this.configCache);
  }

  // =============================================================================
  // Core Utility Methods
  // =============================================================================

  getKysely() {
    return this.config.kysely;
  }

  async getEntityConfig(orgId: string, entityName: string): Promise<any> {
    return this.schemaManager.getEntityConfig(orgId, entityName);
  }

  // =============================================================================
  // Record Operations - Delegate to RecordManager
  // =============================================================================

  async createRecord(orgId: string, entityName: string, data: any, userId?: string): Promise<any> {
    return this.recordManager.createRecord(orgId, entityName, data, userId);
  }

  async updateRecord(orgId: string, entityName: string, recordId: string, updates: any): Promise<any> {
    return this.recordManager.updateRecord(orgId, entityName, recordId, updates);
  }

  async deleteRecord(orgId: string, entityName: string, recordId: string, permanent: boolean = false): Promise<any> {
    return this.recordManager.deleteRecord(orgId, entityName, recordId, permanent);
  }

  async getRecord(orgId: string, entityName: string, recordId: string): Promise<any> {
    return this.recordManager.getRecord(orgId, entityName, recordId);
  }

  async queryRecords(orgId: string, entityName: string, options: any = {}): Promise<any> {
    return this.recordManager.queryRecords(orgId, entityName, options);
  }

  async saveEntityData(orgId: string, entityName: string, data: Record<string, any>): Promise<any> {
    return this.recordManager.saveEntityData(orgId, entityName, data);
  }

  async getEntityDetails(orgId: string, entityName: string): Promise<any> {
    return this.recordManager.getEntityDetails(orgId, entityName);
  }

  // =============================================================================
  // Schema Operations - Delegate to EntitySchemaManager
  // =============================================================================

  async createEntity(
    orgId: string,
    entityName: string, 
    archetype: string,
    customFields: FieldDefinition[] = [],
    options: any = {}
  ): Promise<any> {
    return this.schemaManager.createEntity(orgId, entityName, archetype, customFields, options);
  }

  async deleteEntity(orgId: string, entityName: string): Promise<any> {
    return this.schemaManager.deleteEntity(orgId, entityName);
  }

  async restoreEntity(orgId: string, entityName: string): Promise<any> {
    return this.schemaManager.restoreEntity(orgId, entityName);
  }

  async permanentDeleteEntity(orgId: string, entityName: string): Promise<any> {
    return this.schemaManager.permanentDeleteEntity(orgId, entityName);
  }

  async listTrash(orgId: string): Promise<any> {
    return this.schemaManager.listTrash(orgId);
  }

  async getSchema(orgId: string): Promise<any> {
    return this.schemaManager.getSchema(orgId);
  }

  async listEntities(orgId: string): Promise<any> {
    return this.schemaManager.listEntities(orgId);
  }

  // =============================================================================
  // Field Operations - Delegate to FieldManager
  // =============================================================================

  async addFields(orgId: string, entityName: string, fields: any[]): Promise<any> {
    return this.fieldManager.addFields(orgId, entityName, fields);
  }

  async removeField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    return this.fieldManager.removeField(orgId, entityName, fieldName);
  }

  async softDeleteField(orgId: string, entityName: string, fieldName: string, userId?: string): Promise<any> {
    return this.fieldManager.softDeleteField(orgId, entityName, fieldName, userId);
  }

  async restoreField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    return this.fieldManager.restoreField(orgId, entityName, fieldName);
  }

  async permanentDeleteField(orgId: string, entityName: string, fieldName: string): Promise<any> {
    return this.fieldManager.permanentDeleteField(orgId, entityName, fieldName);
  }

  async listFieldTrash(orgId: string, entityName: string): Promise<any> {
    return this.fieldManager.listFieldTrash(orgId, entityName);
  }

  // =============================================================================
  // Bulk Operations - Delegate to BulkOperationsManager
  // =============================================================================

  async bulkCreateRecords(
    orgId: string, 
    entityName: string, 
    records: any[], 
    options: any = {}
  ): Promise<any> {
    return this.bulkManager.bulkCreateRecords(orgId, entityName, records, options);
  }

  async bulkUpdateRecords(
    orgId: string, 
    entityName: string, 
    updates: any[], 
    options: any = {}
  ): Promise<any> {
    return this.bulkManager.bulkUpdateRecords(orgId, entityName, updates, options);
  }

  async bulkDeleteRecords(
    orgId: string, 
    entityName: string, 
    recordIds: string[], 
    options: any = {}
  ): Promise<any> {
    return this.bulkManager.bulkDeleteRecords(orgId, entityName, recordIds, options);
  }

  // =============================================================================
  // Archetype Operations - Delegate to ArchetypeManager
  // =============================================================================

  async saveArchetypeEntityData(
    archetype: string,
    tableName: string,
    data: Record<string, any>
  ): Promise<ArchetypeCreateResult> {
    return this.archetypeManager.saveArchetypeEntityData(archetype, tableName, data);
  }

  async queryArchetypeEntityData(
    archetype: string,
    tableName: string,
    options: any = {}
  ): Promise<ArchetypeQueryResult> {
    return this.archetypeManager.queryArchetypeEntityData(archetype, tableName, options);
  }

  async listArchetypeEntities(orgId: string): Promise<{
    success: boolean;
    entities?: any[];
    errors?: string[];
  }> {
    return this.archetypeManager.listArchetypeEntities(orgId);
  }

  async deleteArchetypeEntity(
    orgId: string,
    entityName: string,
    permanent: boolean = false
  ): Promise<any> {
    return this.archetypeManager.deleteArchetypeEntity(orgId, entityName, permanent);
  }

  // =============================================================================
  // Computed Fields - Delegate to ComputedFieldsManager
  // =============================================================================

  async refreshComputedFields(orgId: string, entityName: string, entityId: string): Promise<void> {
    return this.computedManager.refreshComputedFields(orgId, entityName, entityId);
  }

  async onFieldChange(orgId: string, entityType: string, entityId: string, changedField: string, newValue: any): Promise<void> {
    return this.computedManager.onFieldChange(orgId, entityType, entityId, changedField, newValue);
  }

  getComputedFieldEngine(): ComputedFieldEngine {
    return this.computedManager.getComputedFieldEngine();
  }

  getRollupEngine(): RollupEngine {
    return this.computedManager.getRollupEngine();
  }
}