// Organization Durable Object - Per-org persistent state and entity management
import { DurableObject } from "cloudflare:workers";
import type { Env, OrganizationConfig, DurableObjectStats, ValidationResult } from './types.js';
import type { EntityConfig } from './json-rules-engine.js';
import { JsonRulesEngine } from './json-rules-engine.js';

/**
 * OrganizationDurableObject - One instance per organization
 * Provides persistent storage, entity management, and isolation
 */
export class OrganizationDurableObject extends DurableObject {
  private orgId: string;
  private config: OrganizationConfig;
  private entities: Map<string, EntityConfig> = new Map();
  private storage: DurableObjectStorage;
  private env: Env;
  private rulesEngine: JsonRulesEngine;
  private stats: {
    requestCount: number;
    lastRequestTime: number;
    createdAt: string;
  };

  constructor(env: Env, ctx: DurableObjectState) {
    super(env, ctx);
    this.storage = ctx.storage;
    this.env = env;
    this.rulesEngine = new JsonRulesEngine();
    this.stats = {
      requestCount: 0,
      lastRequestTime: Date.now(),
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    this.stats.requestCount++;
    this.stats.lastRequestTime = Date.now();

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Initialize organization
      if (path === '/initialize' && request.method === 'POST') {
        const config = await request.json() as OrganizationConfig;
        return this.handleInitialize(config);
      }

      // Deploy entity to this organization
      if (path === '/deploy-entity' && request.method === 'POST') {
        const entityConfig = await request.json() as EntityConfig;
        return this.handleDeployEntity(entityConfig);
      }

      // Execute entity operations
      if (path.startsWith('/entity/') && request.method === 'POST') {
        const pathParts = path.split('/');
        const entityName = pathParts[2];
        const operation = pathParts[3];
        const data = await request.json();
        return this.handleEntityOperation(entityName, operation, data);
      }

      // Get organization stats
      if (path === '/stats' && request.method === 'GET') {
        return this.handleGetStats();
      }

      // List entities in this organization
      if (path === '/entities' && request.method === 'GET') {
        return this.handleListEntities();
      }

      // Get entity records with pagination
      if (path.startsWith('/entity/') && path.includes('/records') && request.method === 'GET') {
        const entityName = path.split('/')[2];
        const searchParams = url.searchParams;
        return this.handleGetRecords(entityName, searchParams);
      }

      // Broadcast to connected WebSocket clients
      if (path === '/broadcast' && request.method === 'POST') {
        const message = await request.json();
        return this.handleBroadcast(message);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('OrganizationDurableObject error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        objectId: this.orgId
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }
  }

  /**
   * Initialize the organization with configuration
   */
  private async handleInitialize(config: OrganizationConfig): Promise<Response> {
    this.orgId = config.orgId;
    this.config = config;

    // Store organization configuration
    await this.storage.put('org-config', config);
    await this.storage.put('org-metadata', {
      createdAt: new Date().toISOString(),
      version: 1,
      entityCount: 0,
      totalRecords: 0
    });

    console.log(`🏢 OrganizationDurableObject initialized: ${this.orgId}`);

    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      isolationLevel: config.isolationLevel,
      message: 'Organization initialized successfully'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Deploy an entity to this organization
   */
  private async handleDeployEntity(entityConfig: EntityConfig): Promise<Response> {
    const entityName = entityConfig.name;
    
    // Store entity configuration in persistent storage
    await this.storage.put(`entity:${entityName}`, entityConfig);
    this.entities.set(entityName, entityConfig);

    // Update organization metadata
    const metadata = await this.storage.get('org-metadata') || { entityCount: 0 };
    metadata.entityCount++;
    metadata.lastUpdated = new Date().toISOString();
    await this.storage.put('org-metadata', metadata);

    // Check if this entity should spawn its own Durable Object
    if (this.config?.isolationLevel === 'entity-level') {
      await this.spawnEntityDurableObject(entityConfig);
    }

    console.log(`📦 Entity deployed to OrganizationDurableObject[${this.orgId}]: ${entityName}`);

    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entityName,
      isolationLevel: this.config?.isolationLevel || 'org-level',
      message: 'Entity deployed successfully'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Execute entity operations (validate, save, query)
   */
  private async handleEntityOperation(entityName: string, operation: string, data: any): Promise<Response> {
    const entityConfig = await this.storage.get(`entity:${entityName}`) as EntityConfig;
    if (!entityConfig) {
      return new Response(JSON.stringify({
        success: false,
        error: `Entity '${entityName}' not found in organization '${this.orgId}'`
      }), { status: 404, headers: { 'Content-Type': 'application/json' }});
    }

    let result: ValidationResult;

    switch (operation) {
      case 'validate':
        result = await this.validateData(entityConfig, data);
        break;
      case 'save':
        result = await this.saveData(entityConfig, data);
        break;
      case 'query':
        result = await this.queryData(entityConfig, data);
        break;
      default:
        return new Response(JSON.stringify({
          success: false,
          error: `Unknown operation: ${operation}`
        }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    const responseStatus = result.valid ? 200 : 400;
    return new Response(JSON.stringify({
      success: result.valid,
      ...result,
      orgId: this.orgId,
      entityName,
      approach: 'durable-objects',
      isolationLevel: this.config?.isolationLevel
    }), { status: responseStatus, headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Validate data against entity rules
   */
  private async validateData(entityConfig: EntityConfig, data: any): Promise<ValidationResult> {
    // Apply defaults first
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, entityConfig);

    // Validate field types and constraints
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, entityConfig);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // Validate custom business rules
    if (entityConfig.validationRules && entityConfig.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, entityConfig.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }

    return { valid: true, errors: [], data: dataWithDefaults };
  }

  /**
   * Save data with persistent storage
   */
  private async saveData(entityConfig: EntityConfig, data: any): Promise<ValidationResult> {
    // Validate first
    const validation = await this.validateData(entityConfig, data);
    if (!validation.valid || !validation.data) {
      return validation;
    }

    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...validation.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orgId: this.orgId,
      entityType: entityConfig.name
    };

    // Atomic save with metadata update
    await this.storage.transaction(async (txn) => {
      // Save the record
      await txn.put(`record:${entityConfig.name}:${recordId}`, record);
      
      // Update entity statistics
      const entityStats = await txn.get(`stats:${entityConfig.name}`) || { recordCount: 0 };
      entityStats.recordCount++;
      entityStats.lastUpdated = new Date().toISOString();
      await txn.put(`stats:${entityConfig.name}`, entityStats);
      
      // Update organization metadata
      const orgMetadata = await txn.get('org-metadata') || { totalRecords: 0 };
      orgMetadata.totalRecords++;
      orgMetadata.lastUpdated = new Date().toISOString();
      await txn.put('org-metadata', orgMetadata);
    });

    console.log(`💾 Record saved in OrganizationDurableObject[${this.orgId}]: ${entityConfig.name}:${recordId}`);

    return { valid: true, errors: [], data: record };
  }

  /**
   * Query data with filters and pagination
   */
  private async queryData(entityConfig: EntityConfig, filters: any = {}): Promise<ValidationResult> {
    const prefix = `record:${entityConfig.name}:`;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Get records with pagination
    const allRecords = await this.storage.list({ 
      prefix,
      limit: limit + offset 
    });

    // Apply filters and pagination
    const filteredRecords = Array.from(allRecords.values())
      .filter(record => this.matchesFilters(record, filters))
      .slice(offset, offset + limit);

    return {
      valid: true,
      errors: [],
      data: {
        records: filteredRecords,
        total: filteredRecords.length,
        hasMore: allRecords.size === (limit + offset),
        orgId: this.orgId,
        entityName: entityConfig.name
      }
    };
  }

  /**
   * Get records for an entity with pagination
   */
  private async handleGetRecords(entityName: string, searchParams: URLSearchParams): Promise<Response> {
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    const prefix = `record:${entityName}:`;
    const records = await this.storage.list({ prefix, limit, offset });

    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entityName,
      records: Array.from(records.values()),
      count: records.size,
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get organization and entity statistics
   */
  private async handleGetStats(): Promise<Response> {
    const orgMetadata = await this.storage.get('org-metadata') || {};
    const storageList = await this.storage.list();
    
    // Get entity-specific stats
    const entityStats: Record<string, any> = {};
    for (const [key, value] of storageList.entries()) {
      if (key.startsWith('stats:')) {
        const entityName = key.replace('stats:', '');
        entityStats[entityName] = value;
      }
    }

    const stats: DurableObjectStats = {
      objectId: this.orgId,
      orgId: this.orgId,
      recordCount: orgMetadata.totalRecords || 0,
      storageKeys: storageList.size,
      lastActivity: new Date(this.stats.lastRequestTime).toISOString(),
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: 0 // Would need request timing to calculate
    };

    return new Response(JSON.stringify({
      success: true,
      stats,
      entityStats,
      metadata: orgMetadata,
      approach: 'durable-objects',
      isolationLevel: this.config?.isolationLevel
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * List all entities in this organization
   */
  private async handleListEntities(): Promise<Response> {
    const entityList = await this.storage.list({ prefix: 'entity:' });
    const entities = Array.from(entityList.entries()).map(([key, config]) => ({
      name: key.replace('entity:', ''),
      config
    }));

    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      entities,
      count: entities.length,
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Broadcast message (placeholder for WebSocket support)
   */
  private async handleBroadcast(message: any): Promise<Response> {
    // TODO: Implement WebSocket broadcasting
    console.log(`📢 Broadcast in OrganizationDurableObject[${this.orgId}]:`, message);
    
    return new Response(JSON.stringify({
      success: true,
      orgId: this.orgId,
      message: 'Broadcast sent (WebSocket support pending)',
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Spawn dedicated EntityDurableObject for entity-level isolation
   */
  private async spawnEntityDurableObject(entityConfig: EntityConfig): Promise<void> {
    try {
      const entityObjectId = `${this.orgId}:${entityConfig.name}`;
      const entityId = this.env.ENTITY_OBJECTS.idFromName(entityObjectId);
      const entityStub = this.env.ENTITY_OBJECTS.get(entityId);
      
      await entityStub.fetch('https://dummy-host/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...entityConfig,
          parentOrgId: this.orgId
        })
      });

      console.log(`🚀 Spawned EntityDurableObject: ${entityObjectId}`);
    } catch (error) {
      console.error(`Failed to spawn EntityDurableObject:`, error);
    }
  }

  /**
   * Helper method to check if record matches filters
   */
  private matchesFilters(record: any, filters: any): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'limit' || key === 'offset') continue;
      
      if (record[key] !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    const now = Date.now();
    const minuteAgo = now - 60000;
    // Simplified calculation - in production would track timestamped requests
    return this.stats.lastRequestTime > minuteAgo ? this.stats.requestCount : 0;
  }
}