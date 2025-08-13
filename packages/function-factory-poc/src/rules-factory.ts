// Rules Factory - Secure alternative to Function Factory
// Manages entity configurations and rule-based validation without dynamic code execution

import type { Env } from './types.js';
import { JsonRulesEngine, type EntityConfig, type ValidationResult, type RuleSet } from './json-rules-engine.js';
import { getAllPrimitives } from './primitives.js';
import { D1DatabaseManager } from './d1-database-manager.js';
import { TypeGenerator } from './type-generator.js';

/**
 * Rules Factory - Secure replacement for Function Factory
 * Uses declarative rules instead of dynamic JavaScript execution
 */
export class RulesFactory {
  private rulesEngine: JsonRulesEngine;
  private env: Env;
  private databaseManager: D1DatabaseManager;
  private typeGenerator: TypeGenerator;

  constructor(env: Env) {
    this.env = env;
    this.rulesEngine = new JsonRulesEngine();
    this.databaseManager = new D1DatabaseManager(env);
    this.typeGenerator = new TypeGenerator();
  }

  /**
   * Deploy entity configuration with validation rules
   */
  async deployEntity(entityConfig: EntityConfig): Promise<any> {
    const primitive = this.getPrimitive(entityConfig.basePrimitive);
    if (!primitive) {
      throw new Error(`Unknown primitive: ${entityConfig.basePrimitive}`);
    }

    // Initialize D1 database first
    await this.databaseManager.initialize();

    // Create database table
    const table = await this.databaseManager.createOrgTable(entityConfig);
    
    // Generate TypeScript types
    const generatedTypes = this.typeGenerator.generateEntityTypes(entityConfig, table);

    const schema = {
      definition: entityConfig,
      primitive: primitive,
      tableName: table.name,
      table: table,
      generatedTypes: generatedTypes,
      createdAt: new Date().toISOString(),
      version: 1
    };

    // Store entity configuration in KV
    const configKey = `config:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_CONFIG.put(configKey, JSON.stringify(entityConfig));

    // Store schema information
    const schemaKey = `schema:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_SCHEMAS.put(schemaKey, JSON.stringify(schema));

    // Store table name mapping
    const tableKey = `table:${entityConfig.orgId}:${entityConfig.name}`;
    await this.env.ENTITY_CONFIG.put(tableKey, table.name);

    return schema;
  }

  /**
   * Execute validation operation using rules engine
   */
  async executeValidation(orgId: string, entityName: string, data: any): Promise<ValidationResult> {
    const config = await this.getEntityConfig(orgId, entityName);
    if (!config) {
      return { valid: false, errors: ['Entity configuration not found'] };
    }

    // Apply defaults first
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, config);

    // Validate field types and constraints
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, config);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // Validate custom business rules
    if (config.validationRules && config.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, config.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }

    return { valid: true, errors: [], data: dataWithDefaults };
  }

  /**
   * Execute save operation with validation and data transformation
   */
  async executeSave(orgId: string, entityName: string, data: any): Promise<ValidationResult> {
    // First validate the data
    const validation = await this.executeValidation(orgId, entityName, data);
    if (!validation.valid || !validation.data) {
      return validation;
    }

    const config = await this.getEntityConfig(orgId, entityName);
    if (!config) {
      return { valid: false, errors: ['Entity configuration not found'] };
    }

    // Generate proper save data structure
    const saveData = this.rulesEngine.generateSaveData(validation.data, config);

    // Validate workflow transitions if applicable
    if (data.status && data._currentStatus) {
      const workflowValidation = this.rulesEngine.validateWorkflowTransition(
        data._currentStatus, 
        data.status, 
        config
      );
      if (!workflowValidation.valid) {
        return workflowValidation;
      }
    }

    return { valid: true, errors: [], data: saveData };
  }

  /**
   * Execute query operation (returns query configuration)
   */
  async executeQuery(orgId: string, entityName: string, filters: any = {}): Promise<ValidationResult> {
    const config = await this.getEntityConfig(orgId, entityName);
    if (!config) {
      return { valid: false, errors: ['Entity configuration not found'] };
    }

    const primitive = this.getPrimitive(config.basePrimitive);
    const queryConfig = {
      table: `${orgId}_${entityName.toLowerCase()}s`,
      filters: filters,
      coreFields: Object.keys(primitive?.coreFields || {}),
      customFields: Object.keys(config.customFields || {}),
      allowedFilters: this.generateAllowedFilters(config)
    };

    return { valid: true, errors: [], data: queryConfig };
  }

  /**
   * Get entity configuration from KV storage
   */
  async getEntityConfig(orgId: string, entityName: string): Promise<EntityConfig | null> {
    const configKey = `config:${orgId}:${entityName}`;
    const configJson = await this.env.ENTITY_CONFIG.get(configKey);
    
    if (!configJson) {
      return null;
    }

    try {
      return JSON.parse(configJson) as EntityConfig;
    } catch {
      return null;
    }
  }

  /**
   * Get entity schema from KV storage
   */
  async getEntitySchema(orgId: string, entityName: string): Promise<any> {
    const schemaKey = `schema:${orgId}:${entityName}`;
    const schemaJson = await this.env.ENTITY_SCHEMAS.get(schemaKey);
    
    if (!schemaJson) {
      return null;
    }

    try {
      return JSON.parse(schemaJson);
    } catch {
      return null;
    }
  }

  /**
   * List all entities for an organization
   */
  async listOrgEntities(orgId: string): Promise<string[]> {
    const prefix = `config:${orgId}:`;
    const list = await this.env.ENTITY_CONFIG.list({ prefix });
    return list.keys
      .map(key => key.name.replace(prefix, ''))
      .filter(name => !name.startsWith('table:')); // Exclude table mappings
  }

  /**
   * List all stored configurations for debugging
   */
  async debugConfigurations(): Promise<any> {
    const configList = await this.env.ENTITY_CONFIG.list();
    const schemasList = await this.env.ENTITY_SCHEMAS.list();

    return {
      configurations: configList.keys.map(k => k.name),
      schemas: schemasList.keys.map(k => k.name),
      total: configList.keys.length + schemasList.keys.length
    };
  }

  /**
   * Get specific configuration for debugging
   */
  async getConfiguration(key: string): Promise<any> {
    const config = await this.env.ENTITY_CONFIG.get(key);
    const schema = await this.env.ENTITY_SCHEMAS.get(key);
    
    return {
      key,
      config: config ? JSON.parse(config) : null,
      schema: schema ? JSON.parse(schema) : null
    };
  }

  /**
   * Add custom field to existing entity
   */
  async addCustomField(orgId: string, entityName: string, fieldName: string, fieldConfig: any): Promise<any> {
    // Add field to database
    const migration = await this.databaseManager.addCustomField(orgId, entityName, fieldName, fieldConfig);
    
    // Update entity configuration
    const config = await this.getEntityConfig(orgId, entityName);
    if (config) {
      config.customFields[fieldName] = fieldConfig;
      
      // Update configuration in KV
      const configKey = `config:${orgId}:${entityName}`;
      await this.env.ENTITY_CONFIG.put(configKey, JSON.stringify(config));
      
      // Regenerate types
      const table = this.databaseManager.getOrgTables(orgId).find(t => t.entityName === entityName);
      if (table) {
        const generatedTypes = this.typeGenerator.generateEntityTypes(config, table);
        return { migration, generatedTypes };
      }
    }
    
    return { migration };
  }

  /**
   * Get database schema report
   */
  async getDatabaseReport(): Promise<any> {
    return await this.databaseManager.generateSchemaReport();
  }

  /**
   * Get type generation report
   */
  getTypeGenerationReport(): any {
    return this.typeGenerator.generateReport();
  }

  /**
   * Get comprehensive multi-org report
   */
  async getMultiOrgReport(): Promise<any> {
    const databaseReport = await this.getDatabaseReport();
    const typeReport = this.getTypeGenerationReport();
    const configReport = this.getConfigurationReport();
    
    return {
      summary: {
        totalOrganizations: databaseReport.summary.totalOrganizations,
        totalTables: databaseReport.summary.totalTables,
        actualTablesInD1: databaseReport.summary.actualTablesInD1,
        totalMigrations: databaseReport.summary.totalMigrations,
        completedMigrations: databaseReport.summary.completedMigrations,
        totalGeneratedTypes: typeReport.totalTypes,
        totalConfigurations: configReport.totalConfigurations
      },
      database: databaseReport,
      types: typeReport,
      configurations: configReport,
      generatedAt: new Date().toISOString()
    };
  }

  /**
   * Get configuration report
   */
  private getConfigurationReport(): any {
    // This would normally pull from KV, but for POC we'll simulate
    const organizations = ['acme-corp', 'techflow-solutions', 'startup-inc'];
    const entities = ['SoftwareProject', 'MarketingCampaign', 'UserStory', 'BugReport'];
    
    return {
      totalConfigurations: organizations.length * 2, // Simulate 2 entities per org
      organizations: organizations.map(orgId => ({
        orgId,
        entities: entities.slice(0, 2), // Each org has 2 entities
        lastUpdated: new Date().toISOString()
      }))
    };
  }

  /**
   * Get primitive definition
   */
  private getPrimitive(primitiveName: string): any {
    const primitives = getAllPrimitives();
    return primitives.find(p => p.name === primitiveName);
  }

  /**
   * Generate allowed query filters based on entity configuration
   */
  private generateAllowedFilters(config: EntityConfig): string[] {
    const primitive = this.getPrimitive(config.basePrimitive);
    const coreFields = Object.keys(primitive?.coreFields || {});
    const customFields = Object.keys(config.customFields || {});
    
    return [...coreFields, ...customFields];
  }
}

/**
 * Sample entity configurations for testing
 */
export const SAMPLE_CONFIGS = {
  SoftwareProject: {
    name: 'SoftwareProject',
    orgId: 'acme-corp',
    basePrimitive: 'Project',
    customFields: {
      budget: { type: 'number', required: true, min: 1000 },
      technology: { type: 'enum', required: true, enum: ['React', 'Vue', 'Angular', 'Svelte'] },
      repository_url: { type: 'url', required: false },
      team_lead_email: { type: 'email', required: true }
    },
    validationRules: {
      rules: [
        { field: 'budget', operator: 'greater_than_equal', value: 5000, message: 'Budget must be at least $5,000 for software projects' },
        { field: 'name', operator: 'min_length', value: 3, message: 'Project name must be at least 3 characters' },
        { field: 'repository_url', operator: 'starts_with', value: 'https://github.com/', message: 'Repository must be a GitHub URL' }
      ],
      operator: 'and'
    },
    workflows: {
      draft: ['active', 'cancelled'],
      active: ['on_hold', 'completed'],
      on_hold: ['active', 'cancelled'],
      completed: [],
      cancelled: []
    },
    defaultValues: {
      status: 'draft',
      technology: 'React'
    }
  } as EntityConfig,

  MarketingCampaign: {
    name: 'MarketingCampaign',
    orgId: 'acme-corp',
    basePrimitive: 'Project',
    customFields: {
      target_audience: { type: 'string', required: true, minLength: 10 },
      budget: { type: 'number', required: true, min: 100 },
      platform: { type: 'enum', required: true, enum: ['Facebook', 'Google', 'LinkedIn', 'Twitter', 'Instagram'] },
      conversion_goal: { type: 'string', required: false }
    },
    validationRules: {
      rules: [
        { field: 'target_audience', operator: 'min_length', value: 20, message: 'Target audience description must be at least 20 characters' },
        { field: 'budget', operator: 'greater_than', value: 500, message: 'Marketing campaigns require minimum $500 budget' },
        { field: 'name', operator: 'contains', value: 'Campaign', message: 'Campaign name must contain the word "Campaign"' }
      ],
      operator: 'and'
    },
    workflows: {
      draft: ['active', 'cancelled'],
      active: ['paused', 'completed'],
      paused: ['active', 'cancelled'],
      completed: [],
      cancelled: []
    },
    defaultValues: {
      status: 'draft',
      platform: 'Facebook'
    }
  } as EntityConfig
};