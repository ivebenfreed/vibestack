/**
 * Archetype Entity Manager
 * 
 * Extends EntityManager with Universal Archetype support for organization-specific entity creation.
 * Integrates archetype patterns with the existing multi-org DataForge infrastructure.
 */

import { EntityManager, type EntityManagerConfig } from './entity-manager';
import { FoundationEntityRegistry } from '../entities/foundation/index';
import type { FieldDefinition } from '../rules/json-rules-engine';
import type { OrgEntityDefinition } from '../json-schema/org-entity-schema';
import { ArchetypeMigrationService } from '../migration/archetype-migration-service';

export interface ArchetypeEntityData {
  archetype: string;
  tableName: string;
  customFields: Record<string, FieldDefinition>;
  orgId?: string;
}

export interface ArchetypeCreateResult {
  success: boolean;
  entityId?: string;
  migrationId?: string;
  tableName?: string;
  ddl?: string;
  errors?: string[];
  immediate?: boolean;
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

export class ArchetypeEntityManager extends EntityManager {
  private migrationService?: ArchetypeMigrationService;
  private useDeboucedMigrations = true; // DEFAULT TO DEBOUNCED FOR SEAMLESS SCHEMA CHANGES

  constructor(config: EntityManagerConfig) {
    super(config);
    
    // Auto-initialize debounced migrations for seamless background operation
    this.initializeBackgroundMigrations();
  }

  /**
   * Initialize background debounced migrations automatically
   */
  private async initializeBackgroundMigrations(): Promise<void> {
    try {
      if (this.config.env?.ORG_SCHEMA) {
        // Initialize with real DO binding - no mock needed
        this.migrationService = new ArchetypeMigrationService(this.kysely, this.config.env.ORG_SCHEMA);
        console.log('[ArchetypeEntityManager] Background debounced migrations initialized with real DOs');
      }
    } catch (error) {
      console.warn('[ArchetypeEntityManager] Failed to initialize background migrations:', error);
      this.useDeboucedMigrations = false; // Fallback to immediate mode
    }
  }

  /**
   * Enable debounced migration mode (Week 3 Day 1-2)
   * When enabled, schema changes are batched over 30 seconds
   */
  enableDebouncedMigrations(): void {
    if (this.config.env?.ORG_SCHEMA) {
      this.migrationService = new ArchetypeMigrationService(this.kysely, this.config.env.ORG_SCHEMA);
      this.useDeboucedMigrations = true;
      console.log('[ArchetypeEntityManager] Debounced migrations enabled with real DOs');
    } else {
      console.warn('[ArchetypeEntityManager] Cannot enable debounced migrations - ORG_SCHEMA binding not available');
    }
  }

  /**
   * Disable debounced migration mode (immediate schema changes)
   */
  disableDebouncedMigrations(): void {
    this.migrationService = undefined;
    this.useDeboucedMigrations = false;
    console.log('[ArchetypeEntityManager] Debounced migrations disabled - using immediate mode');
  }

  /**
   * Create entity from Universal Archetype pattern with organization isolation
   */
  async createArchetypeEntity(
    orgId: string,
    archetype: string,
    tableName: string,
    customFields: Record<string, FieldDefinition> = {}
  ): Promise<ArchetypeCreateResult> {
    try {
      // 1. Validate archetype exists
      if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
        return {
          success: false,
          errors: [`Invalid archetype: ${archetype}. Supported: ${FoundationEntityRegistry.getUniversalArchetypes().join(', ')}`]
        };
      }

      // 2. Get archetype pattern class
      const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
      if (!ArchetypeClass) {
        return {
          success: false,
          errors: [`Archetype pattern class not found for: ${archetype}`]
        };
      }

      // 3. Validate custom fields against archetype base fields
      const validation = this.validateArchetypeFields(ArchetypeClass, customFields);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 4. WEEK 3 DAY 1-2: Branch between immediate and debounced migration modes
      if (this.useDeboucedMigrations && this.migrationService) {
        // Use debounced migration system
        console.log(`[ArchetypeEntityManager] Scheduling debounced migration for ${archetype} entity: ${orgId}.${tableName}`);
        
        const migrationId = await this.migrationService.scheduleArchetypeSchemaChange(
          orgId,
          tableName,
          archetype,
          'create',
          customFields
        );

        return {
          success: true,
          tableName,
          migrationId,
          immediate: false,
          ddl: 'Scheduled for debounced execution'
        };
      } else {
        // Use immediate migration (existing behavior)
        console.log(`[ArchetypeEntityManager] Creating ${archetype} entity immediately: ${orgId}.${tableName}`);
        
        const schemaResult = await this.createArchetypeSchema(orgId, archetype, tableName, customFields);
        if (!schemaResult.success) {
          return {
            success: false,
            errors: schemaResult.errors || ['Failed to create archetype schema']
          };
        }

        // 5. Create entity definition for EntityManager
        const entityDefinition: OrgEntityDefinition = {
          tableName,
          extends: archetype,
          customFields,
          syncable: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // 6. Register entity with EntityManager for CRUD operations
        const entityResult = await this.createOrgEntity(orgId, tableName, entityDefinition);
        if (!entityResult.success) {
          return {
            success: false,
            errors: entityResult.errors || ['Failed to register entity with EntityManager']
          };
        }

        return {
          success: true,
          tableName,
          migrationId: entityResult.migrationId,
          ddl: schemaResult.ddl,
          immediate: entityResult.immediate
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create archetype entity: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Update existing archetype entity schema (Week 3 Day 3-4)
   * Supports field additions, modifications, and deletions with background migration
   */
  async updateArchetypeEntity(
    orgId: string,
    archetype: string,
    tableName: string,
    newCustomFields: Record<string, FieldDefinition>,
    oldCustomFields?: Record<string, FieldDefinition>
  ): Promise<ArchetypeCreateResult> {
    try {
      // 1. Validate archetype exists
      if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
        return {
          success: false,
          errors: [`Invalid archetype: ${archetype}. Supported: ${FoundationEntityRegistry.getUniversalArchetypes().join(', ')}`]
        };
      }

      // 2. Get current schema if oldCustomFields not provided
      if (!oldCustomFields) {
        const metadata = await this.getArchetypeMetadata(orgId, tableName);
        if (!metadata) {
          return {
            success: false,
            errors: [`Archetype entity ${tableName} not found for organization ${orgId}`]
          };
        }
        oldCustomFields = metadata.customFields || {};
      }

      // 3. Get archetype pattern class for validation
      const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
      if (!ArchetypeClass) {
        return {
          success: false,
          errors: [`Archetype pattern class not found for: ${archetype}`]
        };
      }

      // 4. Validate new custom fields against archetype base fields
      const validation = this.validateArchetypeFields(ArchetypeClass, newCustomFields);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 5. WEEK 3 DAY 3-4: Schema evolution with debounced migrations
      if (this.useDeboucedMigrations && this.migrationService) {
        // Use debounced migration system for schema evolution
        console.log(`[ArchetypeEntityManager] Scheduling schema evolution for ${archetype} entity: ${orgId}.${tableName}`);
        
        const migrationId = await this.migrationService.scheduleArchetypeSchemaChange(
          orgId,
          tableName,
          archetype,
          'update',
          newCustomFields,
          oldCustomFields
        );

        return {
          success: true,
          tableName,
          migrationId,
          immediate: false,
          ddl: 'Schema evolution scheduled for debounced execution'
        };
      } else {
        // Use immediate schema evolution
        console.log(`[ArchetypeEntityManager] Updating ${archetype} entity schema immediately: ${orgId}.${tableName}`);
        
        const evolutionResult = await this.executeSchemaEvolution(orgId, archetype, tableName, newCustomFields, oldCustomFields);
        if (!evolutionResult.success) {
          return {
            success: false,
            errors: evolutionResult.errors || ['Failed to evolve archetype schema']
          };
        }

        return {
          success: true,
          tableName,
          ddl: evolutionResult.ddl,
          immediate: true
        };
      }
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to update archetype entity: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Execute immediate schema evolution for archetype entity
   */
  private async executeSchemaEvolution(
    orgId: string,
    archetype: string,
    tableName: string,
    newFields: Record<string, FieldDefinition>,
    oldFields: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; errors?: string[] }> {
    try {
      const evolutionSteps: string[] = [];
      const fullTableName = `${orgId}_${tableName}`;

      // Analyze field changes
      const changes = this.analyzeFieldChanges(oldFields, newFields);
      
      console.log(`[Schema Evolution] ${archetype} entity ${fullTableName}:`);
      console.log(`  + ${changes.additions.length} fields to add`);
      console.log(`  ~ ${changes.modifications.length} fields to modify`);
      console.log(`  - ${changes.removals.length} fields to remove`);

      // 1. Add new fields
      for (const [fieldName, fieldDef] of Object.entries(changes.additions)) {
        const columnSql = this.generateColumnDefinition(fieldName, fieldDef);
        evolutionSteps.push(`ALTER TABLE "${fullTableName}" ADD COLUMN ${columnSql}`);
        console.log(`  + Adding field: ${fieldName} (${fieldDef.type})`);
      }

      // 2. Modify existing fields (type changes, constraint changes)
      for (const [fieldName, change] of Object.entries(changes.modifications)) {
        const { oldField, newField } = change;
        
        // Handle type changes
        if (oldField.type !== newField.type) {
          const newType = this.getPostgreSQLType(newField.type);
          evolutionSteps.push(`ALTER TABLE "${fullTableName}" ALTER COLUMN "${fieldName}" TYPE ${newType}`);
          console.log(`  ~ Changing field type: ${fieldName} (${oldField.type} → ${newField.type})`);
        }
        
        // Handle constraint changes (required/optional)
        if (oldField.required !== newField.required) {
          if (newField.required) {
            // Adding NOT NULL constraint - need to set default for existing rows
            evolutionSteps.push(`UPDATE "${fullTableName}" SET "${fieldName}" = '' WHERE "${fieldName}" IS NULL`);
            evolutionSteps.push(`ALTER TABLE "${fullTableName}" ALTER COLUMN "${fieldName}" SET NOT NULL`);
            console.log(`  ~ Making field required: ${fieldName}`);
          } else {
            evolutionSteps.push(`ALTER TABLE "${fullTableName}" ALTER COLUMN "${fieldName}" DROP NOT NULL`);
            console.log(`  ~ Making field optional: ${fieldName}`);
          }
        }
      }

      // 3. Remove fields (with data preservation warning)
      for (const fieldName of changes.removals) {
        console.log(`  ! WARNING: Removing field with potential data loss: ${fieldName}`);
        evolutionSteps.push(`ALTER TABLE "${fullTableName}" DROP COLUMN IF EXISTS "${fieldName}"`);
      }

      // 4. Execute all evolution steps
      for (const step of evolutionSteps) {
        await this.kysely.executeQuery({
          sql: step,
          parameters: []
        });
      }

      const ddl = evolutionSteps.join(';\n') + ';';
      return {
        success: true,
        ddl
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Schema evolution failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Analyze field changes between old and new field definitions
   */
  private analyzeFieldChanges(
    oldFields: Record<string, FieldDefinition>,
    newFields: Record<string, FieldDefinition>
  ) {
    const additions: Record<string, FieldDefinition> = {};
    const modifications: Record<string, { oldField: FieldDefinition; newField: FieldDefinition }> = {};
    const removals: string[] = [];

    // Find additions and modifications
    for (const [fieldName, newField] of Object.entries(newFields)) {
      const oldField = oldFields[fieldName];
      
      if (!oldField) {
        // New field
        additions[fieldName] = newField;
      } else if (this.hasFieldChanged(oldField, newField)) {
        // Modified field
        modifications[fieldName] = { oldField, newField };
      }
    }

    // Find removals
    for (const fieldName of Object.keys(oldFields)) {
      if (!(fieldName in newFields)) {
        removals.push(fieldName);
      }
    }

    return { additions, modifications, removals };
  }

  /**
   * Generate column definition SQL for a field
   */
  private generateColumnDefinition(fieldName: string, fieldDef: FieldDefinition): string {
    const type = this.getPostgreSQLType(fieldDef.type);
    const nullable = fieldDef.required ? 'NOT NULL' : 'NULL';
    return `"${fieldName}" ${type} ${nullable}`;
  }

  /**
   * Get PostgreSQL type for field type
   */
  private getPostgreSQLType(fieldType: string): string {
    switch (fieldType) {
      case 'text': return 'TEXT';
      case 'decimal': return 'NUMERIC';
      case 'boolean': return 'BOOLEAN';
      case 'json': return 'JSONB';
      case 'date': return 'TIMESTAMPTZ';
      case 'integer': return 'INTEGER';
      default: return 'TEXT';
    }
  }

  /**
   * Check if field definition has changed
   */
  private hasFieldChanged(oldField: FieldDefinition, newField: FieldDefinition): boolean {
    return oldField.type !== newField.type || 
           oldField.required !== newField.required;
  }

  /**
   * Get archetype entity metadata (for schema evolution)
   */
  private async getArchetypeMetadata(
    orgId: string, 
    tableName: string
  ): Promise<{ archetype: string; customFields: Record<string, FieldDefinition> } | null> {
    // This would typically query a metadata table or configuration
    // For now, return null to indicate metadata not found
    // In a full implementation, this would query the entity registry or metadata store
    console.log(`[ArchetypeEntityManager] Looking up metadata for ${orgId}.${tableName}`);
    return null;
  }

  /**
   * Save data to archetype entity with validation
   */
  async saveArchetypeEntityData(
    orgId: string,
    tableName: string,
    data: Record<string, any>
  ): Promise<{ success: boolean; data?: any; syncData?: any; errors?: string[] }> {
    try {
      // 1. Get archetype metadata
      const metadata = await this.getArchetypeMetadata(orgId, tableName);
      if (!metadata) {
        return {
          success: false,
          errors: [`Archetype entity ${tableName} not found for organization ${orgId}`]
        };
      }

      // 2. Validate data against archetype business logic
      const validation = this.validateArchetypeData(metadata.archetype, data);
      if (!validation.valid) {
        return {
          success: false,
          errors: validation.errors
        };
      }

      // 3. Use parent EntityManager to save data (it handles org isolation)
      return await this.saveEntityData(orgId, tableName, validation.data);
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to save archetype data: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Query archetype entity data with metadata
   */
  async queryArchetypeEntityData(
    orgId: string,
    tableName: string,
    filters: Record<string, any> = {},
    options: { syncableOnly?: boolean; includeMetadata?: boolean } = {}
  ): Promise<ArchetypeQueryResult> {
    try {
      // 1. Query data using parent EntityManager
      const queryResult = await this.queryEntityData(orgId, tableName, filters, options.syncableOnly);
      if (!queryResult.success) {
        return {
          success: false,
          errors: queryResult.errors
        };
      }

      // 2. Include archetype metadata if requested
      let metadata;
      if (options.includeMetadata) {
        const archetypeMetadata = await this.getArchetypeMetadata(orgId, tableName);
        if (archetypeMetadata) {
          metadata = {
            archetype: archetypeMetadata.archetype,
            tableName: archetypeMetadata.tableName,
            fieldDefinitions: archetypeMetadata.fieldDefinitions
          };
        }
      }

      return {
        success: true,
        data: queryResult.data,
        metadata
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to query archetype data: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * List all archetype entities for an organization
   */
  async listArchetypeEntities(orgId: string): Promise<{
    success: boolean;
    entities?: Array<{
      tableName: string;
      archetype: string;
      customFields: Record<string, FieldDefinition>;
      createdAt: string;
      updatedAt: string;
    }>;
    errors?: string[];
  }> {
    try {
      // Use OrgSchemaDO to list archetype entities
      if (!this.config.env?.ORG_SCHEMA) {
        return {
          success: false,
          errors: ['OrgSchemaDO not available in environment']
        };
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

      const response = await doStub.fetch(new Request('http://localhost/archetype-entities'));
      const result = await response.json();

      if (!result.success) {
        return {
          success: false,
          errors: ['Failed to retrieve archetype entities']
        };
      }

      // Transform entities to include only necessary information
      const entities = Object.entries(result.entities).map(([tableName, definition]: [string, any]) => ({
        tableName,
        archetype: definition.extends,
        customFields: definition.customFields,
        createdAt: definition.createdAt,
        updatedAt: definition.updatedAt
      }));

      return {
        success: true,
        entities
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to list archetype entities: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Delete archetype entity (table and schema)
   */
  async deleteArchetypeEntity(
    orgId: string,
    tableName: string,
    options: { dropTable?: boolean } = {}
  ): Promise<{ success: boolean; errors?: string[] }> {
    try {
      // 1. Remove from OrgSchemaDO
      if (this.config.env?.ORG_SCHEMA) {
        const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
        const doStub = this.config.env.ORG_SCHEMA.get(doId);

        const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${tableName}`, {
          method: 'DELETE'
        }));

        if (!response.ok) {
          return {
            success: false,
            errors: ['Failed to remove entity from organization schema']
          };
        }
      }

      // 2. Optionally drop table using migration system
      if (options.dropTable && this.config.migrationService) {
        await this.config.migrationService.scheduleSchemaChange(
          orgId,
          tableName,
          'delete'
        );
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to delete archetype entity: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Validate archetype fields against base pattern
   */
  private validateArchetypeFields(
    ArchetypeClass: any,
    customFields: Record<string, FieldDefinition>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for conflicts with base archetype fields
    const baseFields = ArchetypeClass.fields || {};
    for (const customFieldName of Object.keys(customFields)) {
      if (baseFields[customFieldName]) {
        errors.push(`Custom field '${customFieldName}' conflicts with base archetype field`);
      }
    }

    // Validate custom field types
    const supportedTypes = [
      'text', 'longtext', 'number', 'integer', 'decimal', 'boolean', 
      'date', 'datetime', 'json', 'priority_option', 'status_option', 
      'category_option', 'user_reference', 'entity_reference'
    ];

    for (const [fieldName, fieldDef] of Object.entries(customFields)) {
      if (!supportedTypes.includes(fieldDef.type)) {
        errors.push(`Unsupported field type '${fieldDef.type}' for field '${fieldName}'`);
      }

      if (fieldDef.required === undefined) {
        errors.push(`Field '${fieldName}' must specify required property`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Create archetype schema using OrgSchemaDO
   */
  private async createArchetypeSchema(
    orgId: string,
    archetype: string,
    tableName: string,
    customFields: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; errors?: string[] }> {
    try {
      if (!this.config.env?.ORG_SCHEMA) {
        return {
          success: false,
          errors: ['OrgSchemaDO not available in environment']
        };
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

      const response = await doStub.fetch(new Request('http://localhost/create-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          archetype,
          tableName,
          fieldDefinitions: customFields
        })
      }));

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create archetype schema: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get archetype metadata for an entity
   */
  private async getArchetypeMetadata(
    orgId: string,
    tableName: string
  ): Promise<{ archetype: string; tableName: string; fieldDefinitions: Record<string, FieldDefinition> } | null> {
    try {
      if (!this.config.env?.ORG_SCHEMA) {
        return null;
      }

      const doId = this.config.env.ORG_SCHEMA.idFromName(orgId);
      const doStub = this.config.env.ORG_SCHEMA.get(doId);

      const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${tableName}`));
      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (!result.success) {
        return null;
      }

      return {
        archetype: result.entity.extends,
        tableName: result.entity.tableName,
        fieldDefinitions: result.entity.customFields
      };
    } catch (error) {
      console.error('Failed to get archetype metadata:', error);
      return null;
    }
  }

  /**
   * Validate data against archetype business logic
   */
  private validateArchetypeData(
    archetype: string,
    data: Record<string, any>
  ): { valid: boolean; data: Record<string, any>; errors: string[] } {
    const errors: string[] = [];

    // Get archetype class for validation
    const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
    if (!ArchetypeClass) {
      return {
        valid: false,
        data: {},
        errors: [`Unknown archetype: ${archetype}`]
      };
    }

    // Apply archetype business logic validation
    try {
      const validationRules = ArchetypeClass.getValidationRules();
      
      // Basic validation rules
      if (validationRules.requiredFields) {
        for (const field of validationRules.requiredFields) {
          if (!data[field] && data[field] !== 0 && data[field] !== false) {
            errors.push(`Required field '${field}' is missing`);
          }
        }
      }

      // Apply archetype-specific validation
      if (validationRules.validate && typeof validationRules.validate === 'function') {
        const customValidation = validationRules.validate(data);
        if (!customValidation.valid) {
          errors.push(...customValidation.errors);
        }
      }

      return {
        valid: errors.length === 0,
        data: { ...data }, // Return validated data
        errors
      };
    } catch (error) {
      return {
        valid: false,
        data: {},
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  // ===== WEEK 3 DAY 1-2: DEBOUNCED MIGRATION MANAGEMENT METHODS =====

  /**
   * Get pending migrations for monitoring
   */
  getPendingMigrations() {
    return this.migrationService?.getPendingMigrations() || [];
  }

  /**
   * Get pending migrations for a specific organization
   */
  getPendingMigrationsForOrg(organizationId: string) {
    return this.migrationService?.getPendingMigrationsForOrg(organizationId) || [];
  }

  /**
   * Cancel a pending migration
   */
  cancelMigration(organizationId: string, entityName: string): boolean {
    return this.migrationService?.cancelMigration(organizationId, entityName) || false;
  }

  /**
   * Force process all pending migrations immediately (for testing)
   */
  async flushAllPendingMigrations(): Promise<void> {
    if (this.migrationService) {
      await this.migrationService.flushAllPendingMigrations();
    }
  }

  /**
   * Force process pending migrations for a specific organization
   */
  async flushPendingMigrationsForOrg(organizationId: string): Promise<void> {
    if (this.migrationService) {
      await this.migrationService.flushPendingMigrationsForOrg(organizationId);
    }
  }

  /**
   * Get migration statistics
   */
  getMigrationStats() {
    return this.migrationService?.getMigrationStats() || {
      totalPending: 0,
      byOrganization: {},
      byArchetype: {},
      byOperation: {}
    };
  }

  /**
   * Check if debounced migrations are enabled
   */
  isDebouncedMigrationsEnabled(): boolean {
    return this.useDeboucedMigrations && !!this.migrationService;
  }
}