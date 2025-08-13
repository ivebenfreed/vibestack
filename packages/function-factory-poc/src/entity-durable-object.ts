// Entity Durable Object - Ultra-isolated per-entity persistent state
import { DurableObject } from "cloudflare:workers";
import type { Env, DurableObjectStats, ValidationResult } from './types.js';
import type { EntityConfig } from './json-rules-engine.js';
import { JsonRulesEngine } from './json-rules-engine.js';

/**
 * EntityDurableObject - One instance per high-traffic entity
 * Provides maximum isolation and dedicated resources
 */
export class EntityDurableObject extends DurableObject {
  private orgId: string;
  private entityName: string;
  private config: EntityConfig;
  private storage: DurableObjectStorage;
  private env: Env;
  private rulesEngine: JsonRulesEngine;
  private stats: {
    requestCount: number;
    lastRequestTime: number;
    createdAt: string;
    recordCount: number;
  };

  constructor(env: Env, ctx: DurableObjectState) {
    super(env, ctx);
    this.storage = ctx.storage;
    this.env = env;
    this.rulesEngine = new JsonRulesEngine();
    this.stats = {
      requestCount: 0,
      lastRequestTime: Date.now(),
      createdAt: new Date().toISOString(),
      recordCount: 0
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
      // Initialize entity
      if (path === '/initialize' && request.method === 'POST') {
        const config = await request.json() as EntityConfig & { parentOrgId?: string };
        return this.handleInitialize(config);
      }

      // Validate data
      if (path === '/validate' && request.method === 'POST') {
        const data = await request.json();
        return this.handleValidate(data);
      }

      // Save data
      if (path === '/save' && request.method === 'POST') {
        const data = await request.json();
        return this.handleSave(data);
      }

      // Query data
      if (path === '/query' && request.method === 'GET') {
        const searchParams = url.searchParams;
        return this.handleQuery(searchParams);
      }

      // Get entity stats
      if (path === '/stats' && request.method === 'GET') {
        return this.handleGetStats();
      }

      // Get all records
      if (path === '/records' && request.method === 'GET') {
        const searchParams = url.searchParams;
        return this.handleGetRecords(searchParams);
      }

      // Real-time operations (WebSocket upgrade)
      if (path === '/ws' && request.headers.get('Upgrade') === 'websocket') {
        return this.handleWebSocket(request);
      }

      // Broadcast message to connected clients
      if (path === '/broadcast' && request.method === 'POST') {
        const message = await request.json();
        return this.handleBroadcast(message);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('EntityDurableObject error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        objectId: `${this.orgId}:${this.entityName}`,
        isolationLevel: 'entity-level'
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }
  }

  /**
   * Initialize the entity with configuration
   */
  private async handleInitialize(config: EntityConfig & { parentOrgId?: string }): Promise<Response> {
    this.orgId = config.parentOrgId || config.orgId;
    this.entityName = config.name;
    this.config = config;

    // Store entity configuration and metadata
    await this.storage.put('config', config);
    await this.storage.put('metadata', {
      createdAt: new Date().toISOString(),
      version: 1,
      recordCount: 0,
      lastUpdated: new Date().toISOString()
    });

    // Initialize custom indexes if needed
    await this.initializeIndexes();

    console.log(`🎯 EntityDurableObject initialized: ${this.orgId}:${this.entityName}`);

    return new Response(JSON.stringify({
      success: true,
      objectId: `${this.orgId}:${this.entityName}`,
      orgId: this.orgId,
      entityName: this.entityName,
      isolationLevel: 'entity-level',
      message: 'Entity Durable Object initialized successfully'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Validate data against entity rules
   */
  private async handleValidate(data: any): Promise<Response> {
    const validation = await this.validateData(data);

    return new Response(JSON.stringify({
      success: validation.valid,
      ...validation,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: 'entity-level',
      approach: 'durable-objects'
    }), { 
      status: validation.valid ? 200 : 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Save data with ultra-isolated persistent storage
   */
  private async handleSave(data: any): Promise<Response> {
    // Validation first
    const validation = await this.validateData(data);
    if (!validation.valid || !validation.data) {
      return new Response(JSON.stringify({
        success: false,
        ...validation,
        objectId: `${this.orgId}:${this.entityName}`,
        isolationLevel: 'entity-level'
      }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    // Generate record
    const recordId = crypto.randomUUID();
    const record = {
      id: recordId,
      ...validation.data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      orgId: this.orgId,
      entityType: this.entityName
    };

    // Atomic save with metadata and index updates
    await this.storage.transaction(async (txn) => {
      // Save the record
      await txn.put(`record:${recordId}`, record);
      
      // Update metadata
      const metadata = await txn.get('metadata') || { recordCount: 0 };
      metadata.recordCount++;
      metadata.lastUpdated = new Date().toISOString();
      await txn.put('metadata', metadata);
      
      // Update custom indexes for efficient querying
      await this.updateCustomIndexes(txn, record);
    });

    this.stats.recordCount++;

    console.log(`💎 Record saved in EntityDurableObject[${this.orgId}:${this.entityName}]: ${recordId}`);

    return new Response(JSON.stringify({
      success: true,
      data: record,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: 'entity-level',
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Query data with advanced filtering and pagination
   */
  private async handleQuery(searchParams: URLSearchParams): Promise<Response> {
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    // Build filters from query parameters
    const filters: Record<string, any> = {};
    for (const [key, value] of searchParams.entries()) {
      if (key !== 'limit' && key !== 'offset') {
        filters[key] = value;
      }
    }

    // Get records with efficient pagination
    const allRecords = await this.storage.list({ 
      prefix: 'record:',
      limit: limit + offset 
    });
    
    // Apply filters and pagination
    const filteredRecords = Array.from(allRecords.values())
      .filter(record => this.matchesFilters(record, filters))
      .slice(offset, offset + limit);

    return new Response(JSON.stringify({
      success: true,
      data: {
        records: filteredRecords,
        total: filteredRecords.length,
        hasMore: allRecords.size === (limit + offset),
        filters: filters
      },
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: 'entity-level',
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get all records (for small datasets)
   */
  private async handleGetRecords(searchParams: URLSearchParams): Promise<Response> {
    const limit = parseInt(searchParams.get('limit') || '50');
    const records = await this.storage.list({ prefix: 'record:', limit });

    return new Response(JSON.stringify({
      success: true,
      records: Array.from(records.values()),
      count: records.size,
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: 'entity-level',
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get detailed entity statistics
   */
  private async handleGetStats(): Promise<Response> {
    const metadata = await this.storage.get('metadata') || {};
    const storageList = await this.storage.list();

    const stats: DurableObjectStats = {
      objectId: `${this.orgId}:${this.entityName}`,
      orgId: this.orgId,
      entityName: this.entityName,
      recordCount: metadata.recordCount || 0,
      storageKeys: storageList.size,
      lastActivity: new Date(this.stats.lastRequestTime).toISOString(),
      requestsPerMinute: this.calculateRequestsPerMinute(),
      averageResponseTime: 0 // Would track with request timing
    };

    return new Response(JSON.stringify({
      success: true,
      stats,
      metadata,
      config: this.config,
      isolationLevel: 'entity-level',
      approach: 'durable-objects'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Handle WebSocket connections for real-time updates
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    // TODO: Implement WebSocket support for real-time entity updates
    const upgradeHeader = request.headers.get('Upgrade');
    
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected Upgrade: websocket', { status: 426 });
    }

    // For now, return a placeholder response
    // In full implementation, this would establish WebSocket connection
    return new Response(JSON.stringify({
      success: true,
      message: 'WebSocket support pending implementation',
      objectId: `${this.orgId}:${this.entityName}`,
      isolationLevel: 'entity-level'
    }), { 
      status: 200, // Would be 101 for actual WebSocket upgrade
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Broadcast to connected WebSocket clients
   */
  private async handleBroadcast(message: any): Promise<Response> {
    // TODO: Implement real-time broadcasting
    console.log(`📡 Broadcast in EntityDurableObject[${this.orgId}:${this.entityName}]:`, message);
    
    return new Response(JSON.stringify({
      success: true,
      objectId: `${this.orgId}:${this.entityName}`,
      message: 'Broadcast sent (WebSocket implementation pending)',
      isolationLevel: 'entity-level'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Validate data using rules engine
   */
  private async validateData(data: any): Promise<ValidationResult> {
    if (!this.config) {
      return { valid: false, errors: ['Entity not properly initialized'] };
    }

    // Apply defaults first
    const dataWithDefaults = this.rulesEngine.applyDefaults(data, this.config);

    // Validate field types and constraints
    const typeValidation = this.rulesEngine.validateFieldTypes(dataWithDefaults, this.config);
    if (!typeValidation.valid) {
      return typeValidation;
    }

    // Validate custom business rules
    if (this.config.validationRules && this.config.validationRules.rules.length > 0) {
      const rulesValidation = this.rulesEngine.validateRules(dataWithDefaults, this.config.validationRules);
      if (!rulesValidation.valid) {
        return rulesValidation;
      }
    }

    return { valid: true, errors: [], data: dataWithDefaults };
  }

  /**
   * Initialize custom indexes for efficient querying
   */
  private async initializeIndexes(): Promise<void> {
    if (!this.config.customFields) return;

    const indexes = [];
    for (const [fieldName, fieldConfig] of Object.entries(this.config.customFields)) {
      if ((fieldConfig as any).indexed) {
        indexes.push(fieldName);
      }
    }

    if (indexes.length > 0) {
      await this.storage.put('indexes', indexes);
      console.log(`📊 Initialized indexes for EntityDurableObject[${this.orgId}:${this.entityName}]:`, indexes);
    }
  }

  /**
   * Update custom indexes when records are saved
   */
  private async updateCustomIndexes(txn: any, record: any): Promise<void> {
    const indexes = await txn.get('indexes') || [];
    
    for (const indexField of indexes) {
      if (record[indexField] !== undefined) {
        const indexKey = `index:${indexField}:${record[indexField]}`;
        const currentRecords = await txn.get(indexKey) || [];
        currentRecords.push(record.id);
        await txn.put(indexKey, currentRecords);
      }
    }
  }

  /**
   * Helper method to check if record matches filters
   */
  private matchesFilters(record: any, filters: any): boolean {
    for (const [key, value] of Object.entries(filters)) {
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