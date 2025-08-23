/**
 * Dynamic Schema POC - Minimal implementation for testing
 * 
 * Uses existing LiveStore setup with Wide Corp test organization
 * to demonstrate basic dynamic schema update capabilities.
 */

import { liveStoreSchemaClient } from './livestore-schema-client';
import { orgSchemaClient } from './schema-client';
import type { OrgEntitySchema } from './schema-client';

// Wide Corp test organization
export const WIDE_CORP_ORG_ID = '01920000-1000-7000-8000-000000000001';

export interface SchemaChange {
  type: 'field_added' | 'field_removed' | 'field_type_changed' | 'entity_added' | 'entity_removed';
  entityName: string;
  fieldName?: string;
  newType?: string;
  oldType?: string;
  newFieldDefinition?: any;
  entityDefinition?: any;
}

export interface SchemaPOCResult {
  success: boolean;
  changes?: SchemaChange[];
  error?: string;
  duration?: number;
}

/**
 * Dynamic Schema POC Controller
 */
export class DynamicSchemaPOC {
  private currentSchema: OrgEntitySchema | null = null;
  private schemaChangeListeners: ((changes: SchemaChange[]) => void)[] = [];

  /**
   * Initialize POC with Wide Corp organization
   */
  async initialize(): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log('🚀 Starting Dynamic Schema POC with Wide Corp...');
      
      // 1. Load current Wide Corp schema from PostgreSQL-native Universal Archetype API
      const schemaResponse = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/schema`);
      const schemaData = await schemaResponse.json();
      
      console.log('🔍 PostgreSQL schema response:', schemaData);
      
      if (!schemaData.success || !schemaData.schema) {
        throw new Error(`Failed to load schema: ${schemaData.error || 'No schema data'}`);
      }
      
      // Use the schema directly from PostgreSQL (no longer need Durable Object bridge)
      this.currentSchema = schemaData.schema;
      
      console.log(`✅ Loaded ${Object.keys(this.currentSchema.entities).length} entities from PostgreSQL:`, 
                  Object.keys(this.currentSchema.entities));
      
      // 2. Initialize LiveStore for Wide Corp
      const instance = await liveStoreSchemaClient.initializeLiveStore(
        WIDE_CORP_ORG_ID, 
        'poc-client-' + Date.now()
      );
      
      if (!instance) {
        throw new Error('Failed to initialize LiveStore for Wide Corp');
      }
      
      console.log('✅ POC initialized successfully with Wide Corp');
      console.log(`📊 Current schema has ${Object.keys(this.currentSchema.entities).length} entities`);
      
      return {
        success: true,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ POC initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test adding a new field to an existing entity
   */
  async testAddField(entityName: string, fieldName: string, fieldType: string): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing add field: ${entityName}.${fieldName} (${fieldType})`);
      
      if (!this.currentSchema) {
        throw new Error('POC not initialized - call initialize() first');
      }
      
      // Check if entity exists
      if (!this.currentSchema.entities[entityName]) {
        throw new Error(`Entity ${entityName} not found in schema`);
      }
      
      // Create modified schema
      const modifiedSchema = JSON.parse(JSON.stringify(this.currentSchema));
      
      // Add new field to entity
      modifiedSchema.entities[entityName].syncableFields[fieldName] = {
        type: fieldType,
        required: false,
        syncable: true,
        description: `POC test field added at ${new Date().toISOString()}`
      };
      
      // Simulate schema change detection
      const changes: SchemaChange[] = [{
        type: 'field_added',
        entityName,
        fieldName,
        newFieldDefinition: {
          type: fieldType,
          required: false,
          syncable: true
        }
      }];
      
      // Apply schema change
      await this.applySchemaChange(modifiedSchema, changes);
      
      console.log(`✅ Successfully added field ${entityName}.${fieldName}`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Add field test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test removing a field from an entity
   */
  async testRemoveField(entityName: string, fieldName: string): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing remove field: ${entityName}.${fieldName}`);
      
      if (!this.currentSchema) {
        throw new Error('POC not initialized');
      }
      
      // Check if field exists
      if (!this.currentSchema.entities[entityName]?.syncableFields?.[fieldName]) {
        throw new Error(`Field ${fieldName} not found in entity ${entityName}`);
      }
      
      // Create modified schema
      const modifiedSchema = JSON.parse(JSON.stringify(this.currentSchema));
      
      // Remove field from entity
      delete modifiedSchema.entities[entityName].syncableFields[fieldName];
      
      const changes: SchemaChange[] = [{
        type: 'field_removed',
        entityName,
        fieldName
      }];
      
      // Apply schema change
      await this.applySchemaChange(modifiedSchema, changes);
      
      console.log(`✅ Successfully removed field ${entityName}.${fieldName}`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Remove field test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test changing a field type
   */
  async testChangeFieldType(entityName: string, fieldName: string, newType: string): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing change field type: ${entityName}.${fieldName} → ${newType}`);
      
      if (!this.currentSchema) {
        throw new Error('POC not initialized');
      }
      
      // Check if field exists
      const currentField = this.currentSchema.entities[entityName]?.syncableFields?.[fieldName];
      if (!currentField) {
        throw new Error(`Field ${fieldName} not found in entity ${entityName}`);
      }
      
      const oldType = currentField.type;
      
      // Create modified schema
      const modifiedSchema = JSON.parse(JSON.stringify(this.currentSchema));
      
      // Change field type
      modifiedSchema.entities[entityName].syncableFields[fieldName].type = newType;
      
      const changes: SchemaChange[] = [{
        type: 'field_type_changed',
        entityName,
        fieldName,
        oldType,
        newType
      }];
      
      // Apply schema change
      await this.applySchemaChange(modifiedSchema, changes);
      
      console.log(`✅ Successfully changed field type ${entityName}.${fieldName}: ${oldType} → ${newType}`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Change field type test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Apply schema change and update LiveStore and Legend State
   */
  private async applySchemaChange(newSchema: OrgEntitySchema, changes: SchemaChange[]): Promise<void> {
    console.log('🔄 Applying schema change to LiveStore and Legend State...');
    
    try {
      // 1. Update schema in memory
      this.currentSchema = newSchema;
      
      // 2. Clear caches to force reload
      orgSchemaClient.clearCache(WIDE_CORP_ORG_ID);
      
      // 3. Use hot-swap for faster updates (POC feature)
      const hotSwapSuccess = await liveStoreSchemaClient.hotSwapSchema(WIDE_CORP_ORG_ID, newSchema);
      
      if (!hotSwapSuccess) {
        console.log('🔄 Hot-swap failed, falling back to full refresh');
        await liveStoreSchemaClient.refreshOrgSchema(WIDE_CORP_ORG_ID);
      }
      
      // 4. Notify Legend State of schema changes
      if (typeof window !== 'undefined') {
        // Import dynamically to avoid SSR issues
        // Note: handleSchemaChangeNotification was removed with legend-state-org-store cleanup
        console.log('Schema change notification (handler removed during cleanup):', notification);
        
        for (const change of changes) {
          handleSchemaChangeNotification({
            orgId: WIDE_CORP_ORG_ID,
            entityName: change.entityName,
            operation: change.type === 'entity_added' ? 'create' :
                      change.type === 'entity_removed' ? 'delete' :
                      'update'
          });
        }
      }
      
      // 5. Notify listeners
      this.notifySchemaChangeListeners(changes);
      
      console.log(`✅ Schema change applied successfully (${hotSwapSuccess ? 'hot-swap' : 'full refresh'})`);
      
    } catch (error) {
      console.error('❌ Failed to apply schema change:', error);
      throw error;
    }
  }

  /**
   * Subscribe to schema changes
   */
  onSchemaChange(listener: (changes: SchemaChange[]) => void): () => void {
    this.schemaChangeListeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      const index = this.schemaChangeListeners.indexOf(listener);
      if (index > -1) {
        this.schemaChangeListeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all schema change listeners
   */
  private notifySchemaChangeListeners(changes: SchemaChange[]): void {
    for (const listener of this.schemaChangeListeners) {
      try {
        listener(changes);
      } catch (error) {
        console.error('Schema change listener error:', error);
      }
    }
  }

  /**
   * Get current schema
   */
  getCurrentSchema(): OrgEntitySchema | null {
    return this.currentSchema;
  }

  /**
   * Get available entities for testing
   */
  getAvailableEntities(): string[] {
    if (!this.currentSchema) return [];
    return Object.keys(this.currentSchema.entities);
  }

  /**
   * Get available fields for an entity
   */
  getEntityFields(entityName: string): Record<string, any> {
    if (!this.currentSchema || !this.currentSchema.entities[entityName]) {
      return {};
    }
    return this.currentSchema.entities[entityName].syncableFields || {};
  }

  /**
   * Test adding a new entity to the organization schema
   */
  async testAddEntity(entityName: string, extends_: string = 'base_projects', fields: Record<string, any> = {}): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing add entity: ${entityName} (extends: ${extends_})`);
      
      if (!this.currentSchema) {
        throw new Error('POC not initialized - call initialize() first');
      }
      
      // Check if entity already exists
      if (this.currentSchema.entities[entityName]) {
        throw new Error(`Entity ${entityName} already exists in schema`);
      }
      
      // Create modified schema with new entity
      const modifiedSchema = JSON.parse(JSON.stringify(this.currentSchema));
      
      // Add new entity definition
      const newEntityDef = {
        extends: extends_,
        tableName: `org_${WIDE_CORP_ORG_ID}_${entityName.toLowerCase()}s`,
        syncableFields: {
          // Default fields for the entity type
          description: { type: 'string', required: false, syncable: true },
          status: { type: 'string', required: false, syncable: true, enum: ['active', 'inactive', 'pending'] },
          // Custom fields provided
          ...fields
        }
      };
      
      modifiedSchema.entities[entityName] = newEntityDef;
      
      // Simulate schema change detection
      const changes: SchemaChange[] = [{
        type: 'entity_added',
        entityName,
        entityDefinition: newEntityDef
      }];
      
      // Apply schema change
      await this.applySchemaChange(modifiedSchema, changes);
      
      console.log(`✅ Successfully added entity ${entityName}`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Add entity test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }


  /**
   * Test creating an entity using DataForge API (real server-side creation)
   */
  async testCreateEntityViaAPI(entityName: string, archetype: string = 'project', customFields: Record<string, any> = {}): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing create entity via API: ${entityName} (archetype: ${archetype})`);
      
      const tableName = `org_${WIDE_CORP_ORG_ID}_${entityName.toLowerCase()}s`;
      
      // Call Universal Archetype API to create the entity
      const response = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/entities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          entityName,
          definition: {
            archetype,
            fields: Object.entries(customFields).map(([name, config]: [string, any]) => ({
              name,
              type: config.type === 'string' ? 'text' : config.type,
              required: config.required || false,
              syncable: true
            })),
            syncable: true
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Entity creation failed: ${result.error || 'Unknown error'}`);
      }
      
      // Refresh schema to pick up the new entity
      await this.refreshCurrentSchema();
      
      const changes: SchemaChange[] = [{
        type: 'entity_added',
        entityName,
        entityDefinition: {
          archetype,
          tableName,
          customFields
        }
      }];
      
      // Notify listeners about the schema change
      this.notifySchemaChangeListeners(changes);
      
      console.log(`✅ Successfully created entity ${entityName} via API`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Create entity via API failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Refresh current schema from server
   */
  async refreshCurrentSchema(): Promise<void> {
    console.log('🔄 Refreshing schema from PostgreSQL...');
    
    // Load fresh schema directly from PostgreSQL
    const schemaResponse = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/schema`);
    const schemaData = await schemaResponse.json();
    
    if (schemaData.success && schemaData.schema) {
      this.currentSchema = schemaData.schema;
      console.log(`✅ Schema refreshed from PostgreSQL: ${Object.keys(schemaData.schema.entities).length} entities`);
      console.log(`✅ Entities:`, Object.keys(schemaData.schema.entities));
      
      // Clear any client-side caches
      orgSchemaClient.clearCache(WIDE_CORP_ORG_ID);
      
      // Trigger hot-swap to update LiveStore
      try {
        await liveStoreSchemaClient.hotSwapSchema(WIDE_CORP_ORG_ID, schemaData.schema);
        console.log('✅ LiveStore schema hot-swapped successfully');
      } catch (error) {
        console.warn('⚠️ Hot-swap failed, schema updated in memory only:', error);
      }
    } else {
      console.error('❌ Failed to refresh schema from PostgreSQL:', schemaData);
    }
  }

  /**
   * Test deleting an entity via DataForge API (real server-side deletion)
   */
  async testDeleteEntityViaAPI(entityName: string): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing delete entity via API: ${entityName}`);
      
      // Call Universal Archetype API to delete the entity
      const response = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/entities/${entityName}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(`Entity deletion failed: ${result.error || 'Unknown error'}`);
      }
      
      // Refresh schema to remove the deleted entity
      await this.refreshCurrentSchema();
      
      const changes: SchemaChange[] = [{
        type: 'entity_removed',
        entityName,
        entityDefinition: {
          tableName: result.tableName
        }
      }];
      
      // Notify listeners about the schema change
      this.notifySchemaChangeListeners(changes);
      
      console.log(`✅ Successfully deleted entity ${entityName} via API`);
      
      return {
        success: true,
        changes,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Delete entity via API failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test saving data to an entity via API
   */
  async testSaveDataViaAPI(entityName: string, testData: any): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing save data to ${entityName}:`, testData);
      
      const response = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/data/${entityName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testData)
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully saved data to ${entityName}:`, result);
      
      return {
        success: true,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Save data failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test querying data from an entity via API
   */
  async testQueryDataViaAPI(entityName: string, limit = 10): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing query data from ${entityName}`);
      
      const response = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/data/${entityName}?limit=${limit}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Successfully queried data from ${entityName}:`, result);
      
      return {
        success: true,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Query data failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Test validating data without saving
   */
  async testValidateDataViaAPI(entityName: string, testData: any): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Testing validate data for ${entityName}:`, testData);
      
      const response = await fetch(`/api/dataforge/orgs/${WIDE_CORP_ORG_ID}/validate/${entityName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(testData)
      });
      
      if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`✅ Validation result for ${entityName}:`, result);
      
      return {
        success: true,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Validate data failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Note: Migration testing methods removed - now using immediate execution
   * All table creation and schema registration happens immediately during entity creation
   * No debounced migrations needed with the new architecture
   */

  /**
   * Test all 8 universal archetypes
   */
  async testAllUniversalArchetypes(): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    const results: SchemaPOCResult[] = [];
    
    const archetypes = ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'];
    
    try {
      console.log(`🔄 Testing all ${archetypes.length} universal archetypes`);
      
      for (const archetype of archetypes) {
        const entityName = `Test${archetype.charAt(0).toUpperCase() + archetype.slice(1)}`;
        
        // Create entity
        const createResult = await this.testCreateEntityViaAPI(entityName, archetype, {
          [`${archetype}Field`]: { type: 'string', required: false }
        });
        results.push(createResult);
        
        if (createResult.success) {
          // Save test data
          const testData = {
            name: `Test ${entityName}`,
            [`${archetype}Field`]: `Test value for ${archetype}`,
            status: 'active'
          };
          
          const saveResult = await this.testSaveDataViaAPI(entityName, testData);
          results.push(saveResult);
          
          // Query data
          const queryResult = await this.testQueryDataViaAPI(entityName, 5);
          results.push(queryResult);
          
          // Validate data
          const validateResult = await this.testValidateDataViaAPI(entityName, testData);
          results.push(validateResult);
        }
      }
      
      const allChanges = results.flatMap(r => r.changes || []);
      const allSuccessful = results.every(r => r.success);
      
      console.log(`✅ All archetypes test completed: ${results.length} operations, ${allSuccessful ? 'ALL PASSED' : 'SOME FAILED'}`);
      
      return {
        success: allSuccessful,
        changes: allChanges,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ All archetypes test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Comprehensive stress test of all operations
   */
  async runStressTest(): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    const results: SchemaPOCResult[] = [];
    
    try {
      console.log(`🧪 Running comprehensive stress test of all entity operations`);
      
      // 1. Initialize
      const initResult = await this.initialize();
      results.push(initResult);
      if (!initResult.success) throw new Error('Initialization failed');
      
      // 2. Test all archetypes
      const archetypesResult = await this.testAllUniversalArchetypes();
      results.push(archetypesResult);
      
      // 3. Migration system testing removed - now using immediate execution
      // All table creation and schema registration happens immediately
      
      // 4. Test field operations on existing entities
      const addFieldResult = await this.testAddField('Project', 'stressTestField', 'string');
      results.push(addFieldResult);
      
      const removeFieldResult = await this.testRemoveField('Project', 'stressTestField');
      results.push(removeFieldResult);
      
      // 5. Test entity cleanup
      const archetypes = ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'];
      for (const archetype of archetypes) {
        const entityName = `Test${archetype.charAt(0).toUpperCase() + archetype.slice(1)}`;
        const deleteResult = await this.testDeleteEntityViaAPI(entityName);
        results.push(deleteResult);
      }
      
      const allChanges = results.flatMap(r => r.changes || []);
      const allSuccessful = results.every(r => r.success);
      
      console.log(`✅ Stress test completed: ${results.length} operations, ${allSuccessful ? 'ALL PASSED' : 'SOME FAILED'}`);
      
      return {
        success: allSuccessful,
        changes: allChanges,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Stress test failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Run comprehensive test suite including entity creation
   */
  async runTestSuite(): Promise<SchemaPOCResult> {
    const startTime = Date.now();
    const results: SchemaPOCResult[] = [];
    
    try {
      console.log('🧪 Running Dynamic Schema POC Test Suite...');
      
      // 1. Initialize
      const initResult = await this.initialize();
      results.push(initResult);
      if (!initResult.success) throw new Error('Initialization failed');
      
      // 2. Test adding a field
      const addFieldResult = await this.testAddField('Project', 'pocTestField', 'string');
      results.push(addFieldResult);
      
      // 3. Test changing field type
      if (addFieldResult.success) {
        const changeResult = await this.testChangeFieldType('Project', 'pocTestField', 'number');
        results.push(changeResult);
      }
      
      // 4. Test removing field
      const removeFieldResult = await this.testRemoveField('Project', 'pocTestField');
      results.push(removeFieldResult);
      
      // 5. Test adding a new entity
      const addEntityResult = await this.testAddEntity('PocTestEntity', 'base_projects', {
        budget: { type: 'number', required: false, syncable: true },
        priority: { type: 'string', required: false, syncable: true, enum: ['low', 'medium', 'high'] }
      });
      results.push(addEntityResult);
      
      // 6. [REMOVED] Local-only entity removal to prevent dangerous sync issues
      
      // 7. Test creating entity via DataForge API (real server-side creation)
      const createViaAPIResult = await this.testCreateEntityViaAPI('ApiTestEntity', 'project', {
        testField: { type: 'string', required: false }
      });
      results.push(createViaAPIResult);
      
      const allChanges = results.flatMap(r => r.changes || []);
      const allSuccessful = results.every(r => r.success);
      
      console.log(`✅ Test suite completed: ${results.length} tests, ${allSuccessful ? 'ALL PASSED' : 'SOME FAILED'}`);
      
      return {
        success: allSuccessful,
        changes: allChanges,
        duration: Date.now() - startTime
      };
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      };
    }
  }
}

// Export singleton instance
export const dynamicSchemaPOC = new DynamicSchemaPOC();

// Helper functions for browser console testing
export const pocHelpers = {
  /**
   * Quick initialization
   */
  async init() {
    return await dynamicSchemaPOC.initialize();
  },
  
  /**
   * Add a test field
   */
  async addField(entityName = 'Project', fieldName = 'testField', fieldType = 'string') {
    return await dynamicSchemaPOC.testAddField(entityName, fieldName, fieldType);
  },
  
  /**
   * Remove a test field
   */
  async removeField(entityName = 'Project', fieldName = 'testField') {
    return await dynamicSchemaPOC.testRemoveField(entityName, fieldName);
  },

  /**
   * Add a test entity
   */
  async addEntity(entityName = 'TestEntity', extends_ = 'base_projects', fields = {}) {
    return await dynamicSchemaPOC.testAddEntity(entityName, extends_, fields);
  },
  

  /**
   * Create entity via API (real server-side creation)
   */
  async createEntityAPI(entityName = 'ApiEntity', archetype = 'project', customFields = {}) {
    return await dynamicSchemaPOC.testCreateEntityViaAPI(entityName, archetype, customFields);
  },
  
  /**
   * Run full test suite
   */
  async runTests() {
    return await dynamicSchemaPOC.runTestSuite();
  },
  
  /**
   * Get current schema info
   */
  getInfo() {
    const schema = dynamicSchemaPOC.getCurrentSchema();
    if (!schema) return 'POC not initialized';
    
    // Ensure entities is always an array for UI compatibility
    const entitiesArray = schema.entities ? Object.keys(schema.entities) : [];
    
    return {
      orgId: WIDE_CORP_ORG_ID,
      entities: entitiesArray,
      totalFields: Object.values(schema.entities || {}).reduce((sum, entity) => 
        sum + Object.keys(entity.syncableFields || {}).length, 0
      )
    };
  },
  
  /**
   * Force refresh schema and return updated info
   */
  async refreshSchema() {
    await dynamicSchemaPOC.refreshCurrentSchema();
    return this.getInfo();
  },
  
  /**
   * Delete entity via API (real server-side deletion)
   */
  async deleteEntityAPI(entityName) {
    return await dynamicSchemaPOC.testDeleteEntityViaAPI(entityName);
  },

  /**
   * Save test data to an entity
   */
  async saveDataAPI(entityName, testData) {
    return await dynamicSchemaPOC.testSaveDataViaAPI(entityName, testData);
  },

  /**
   * Query data from an entity
   */
  async queryDataAPI(entityName, limit = 10) {
    return await dynamicSchemaPOC.testQueryDataViaAPI(entityName, limit);
  },

  /**
   * Validate data without saving
   */
  async validateDataAPI(entityName, testData) {
    return await dynamicSchemaPOC.testValidateDataViaAPI(entityName, testData);
  },

  /**
   * Migration methods removed - now using immediate execution
   * All operations happen immediately without debouncing
   */

  /**
   * Test all 8 universal archetypes
   */
  async testAllArchetypes() {
    return await dynamicSchemaPOC.testAllUniversalArchetypes();
  },

  /**
   * Comprehensive stress test
   */
  async stressTest() {
    return await dynamicSchemaPOC.runStressTest();
  }
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).pocHelpers = pocHelpers;
  (window as any).dynamicSchemaPOC = dynamicSchemaPOC;
}