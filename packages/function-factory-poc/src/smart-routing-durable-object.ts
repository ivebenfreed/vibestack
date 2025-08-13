// Smart Routing Durable Object - Intelligent routing based on usage patterns
import { DurableObject } from "cloudflare:workers";
import type { Env, OrganizationConfig, DurableObjectStats } from './types.js';

interface RoutingDecision {
  route: 'entity-level' | 'org-level' | 'shared';
  objectId: string;
  reason: string;
  confidence: number;
}

interface UsageStats {
  requestsPerMinute: number;
  dataSize: string;
  entitiesCount: number;
  peakLoad: number;
  lastActivity: string;
}

/**
 * SmartRoutingDurableObject - Intelligent routing and auto-scaling
 * Analyzes usage patterns to determine optimal isolation levels
 */
export class SmartRoutingDurableObject extends DurableObject {
  private storage: DurableObjectStorage;
  private env: Env;
  private orgUsageStats: Map<string, UsageStats> = new Map();
  private entityUsageStats: Map<string, UsageStats> = new Map();

  constructor(env: Env, ctx: DurableObjectState) {
    super(env, ctx);
    this.storage = ctx.storage;
    this.env = env;
  }

  /**
   * Handle HTTP requests to this Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route request to optimal isolation level
      if (path === '/route' && request.method === 'POST') {
        const routeRequest = await request.json();
        return this.handleRoute(routeRequest);
      }

      // Update usage statistics
      if (path === '/update-stats' && request.method === 'POST') {
        const statsUpdate = await request.json();
        return this.handleUpdateStats(statsUpdate);
      }

      // Get routing recommendations
      if (path === '/recommendations' && request.method === 'GET') {
        return this.handleGetRecommendations();
      }

      // Get usage analytics
      if (path === '/analytics' && request.method === 'GET') {
        return this.handleGetAnalytics();
      }

      // Auto-scale organizations
      if (path === '/auto-scale' && request.method === 'POST') {
        const scaleRequest = await request.json();
        return this.handleAutoScale(scaleRequest);
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      console.error('SmartRoutingDurableObject error:', error);
      return new Response(JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'smart-routing'
      }), { status: 500, headers: { 'Content-Type': 'application/json' }});
    }
  }

  /**
   * Route request to optimal isolation level
   */
  private async handleRoute(routeRequest: {
    orgId: string;
    entityName: string;
    operation: string;
    data: any;
    config?: OrganizationConfig;
  }): Promise<Response> {
    const { orgId, entityName, operation, data, config } = routeRequest;
    
    // Get current usage stats
    const orgUsage = await this.getOrgUsageStats(orgId);
    const entityUsage = await this.getEntityUsageStats(orgId, entityName);
    
    // Make routing decision
    const decision = await this.makeRoutingDecision(orgId, entityName, orgUsage, entityUsage, config);
    
    // Execute the route
    const result = await this.executeRoute(decision, orgId, entityName, operation, data);

    return new Response(JSON.stringify({
      success: true,
      decision,
      result,
      approach: 'smart-routing'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Make intelligent routing decision based on usage patterns
   */
  private async makeRoutingDecision(
    orgId: string, 
    entityName: string, 
    orgUsage: UsageStats, 
    entityUsage: UsageStats,
    config?: OrganizationConfig
  ): Promise<RoutingDecision> {
    
    // Check explicit configuration first
    if (config?.isolationLevel && config.isolationLevel !== 'auto') {
      return {
        route: config.isolationLevel as any,
        objectId: this.generateObjectId(config.isolationLevel as any, orgId, entityName),
        reason: `Explicitly configured: ${config.isolationLevel}`,
        confidence: 1.0
      };
    }

    // Smart routing logic based on usage patterns
    let score = 0;
    let reasons: string[] = [];

    // High request volume → entity-level isolation
    if (entityUsage.requestsPerMinute > 100) {
      score += 40;
      reasons.push(`High traffic: ${entityUsage.requestsPerMinute} req/min`);
    }

    // Large data size → entity-level isolation  
    if (this.parseSizeToMB(entityUsage.dataSize) > 10) {
      score += 30;
      reasons.push(`Large dataset: ${entityUsage.dataSize}`);
    }

    // Many entities in org → org-level grouping
    if (orgUsage.entitiesCount > 10 && entityUsage.requestsPerMinute < 50) {
      score -= 20;
      reasons.push(`Many entities (${orgUsage.entitiesCount}), moderate traffic`);
    }

    // Peak load considerations
    if (entityUsage.peakLoad > 200) {
      score += 25;
      reasons.push(`High peak load: ${entityUsage.peakLoad} req/min`);
    }

    // Low activity → shared resources
    if (entityUsage.requestsPerMinute < 5 && orgUsage.entitiesCount < 5) {
      score -= 30;
      reasons.push(`Low activity: ${entityUsage.requestsPerMinute} req/min`);
    }

    // Determine route based on score
    let route: RoutingDecision['route'];
    let confidence: number;

    if (score >= 50) {
      route = 'entity-level';
      confidence = Math.min(score / 100, 1.0);
    } else if (score >= 10) {
      route = 'org-level';  
      confidence = 0.7;
    } else {
      route = 'shared';
      confidence = 0.6;
    }

    return {
      route,
      objectId: this.generateObjectId(route, orgId, entityName),
      reason: reasons.join('; '),
      confidence
    };
  }

  /**
   * Execute routing decision
   */
  private async executeRoute(
    decision: RoutingDecision,
    orgId: string,
    entityName: string,
    operation: string,
    data: any
  ): Promise<any> {
    const env = this.env;

    try {
      switch (decision.route) {
        case 'entity-level':
          // Route to dedicated EntityDurableObject
          const entityId = env.ENTITY_OBJECTS.idFromName(decision.objectId);
          const entityStub = env.ENTITY_OBJECTS.get(entityId);
          const entityResponse = await entityStub.fetch(`https://dummy-host/${operation}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          return await entityResponse.json();

        case 'org-level':
          // Route to OrganizationDurableObject
          const orgId_obj = env.ORG_OBJECTS.idFromName(orgId);
          const orgStub = env.ORG_OBJECTS.get(orgId_obj);
          const orgResponse = await orgStub.fetch(`https://dummy-host/entity/${entityName}/${operation}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
          });
          return await orgResponse.json();

        case 'shared':
          // Handle in current router object or delegate to main worker
          return {
            success: true,
            message: 'Handled in shared context',
            isolationLevel: 'shared'
          };

        default:
          throw new Error(`Unknown routing decision: ${decision.route}`);
      }
    } catch (error) {
      console.error(`Routing execution failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Routing failed',
        decision
      };
    }
  }

  /**
   * Update usage statistics
   */
  private async handleUpdateStats(statsUpdate: {
    orgId: string;
    entityName?: string;
    stats: Partial<UsageStats>;
  }): Promise<Response> {
    const { orgId, entityName, stats } = statsUpdate;

    if (entityName) {
      // Update entity-specific stats
      const entityKey = `${orgId}:${entityName}`;
      const currentStats = this.entityUsageStats.get(entityKey) || this.getDefaultUsageStats();
      const updatedStats = { ...currentStats, ...stats, lastActivity: new Date().toISOString() };
      
      this.entityUsageStats.set(entityKey, updatedStats);
      await this.storage.put(`entity-stats:${entityKey}`, updatedStats);
    }

    // Update org-level stats
    const currentOrgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
    const updatedOrgStats = { ...currentOrgStats, ...stats, lastActivity: new Date().toISOString() };
    
    this.orgUsageStats.set(orgId, updatedOrgStats);
    await this.storage.put(`org-stats:${orgId}`, updatedOrgStats);

    return new Response(JSON.stringify({
      success: true,
      orgId,
      entityName,
      message: 'Usage statistics updated',
      approach: 'smart-routing'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get routing recommendations for all organizations
   */
  private async handleGetRecommendations(): Promise<Response> {
    const recommendations: Record<string, RoutingDecision> = {};
    
    // Load stats from storage
    await this.loadStatsFromStorage();
    
    // Generate recommendations for each org/entity combination
    for (const [entityKey, entityStats] of this.entityUsageStats.entries()) {
      const [orgId, entityName] = entityKey.split(':');
      const orgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
      
      const decision = await this.makeRoutingDecision(orgId, entityName, orgStats, entityStats);
      recommendations[entityKey] = decision;
    }

    return new Response(JSON.stringify({
      success: true,
      recommendations,
      totalEntities: Object.keys(recommendations).length,
      approach: 'smart-routing'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get usage analytics
   */
  private async handleGetAnalytics(): Promise<Response> {
    await this.loadStatsFromStorage();

    const analytics = {
      totalOrganizations: this.orgUsageStats.size,
      totalEntities: this.entityUsageStats.size,
      highTrafficEntities: Array.from(this.entityUsageStats.entries())
        .filter(([_, stats]) => stats.requestsPerMinute > 50)
        .length,
      orgStats: Object.fromEntries(this.orgUsageStats),
      entityStats: Object.fromEntries(this.entityUsageStats),
      recommendations: {
        entityLevel: 0,
        orgLevel: 0,
        shared: 0
      }
    };

    // Count recommendation types
    for (const [entityKey, entityStats] of this.entityUsageStats.entries()) {
      const [orgId, entityName] = entityKey.split(':');
      const orgStats = this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
      const decision = await this.makeRoutingDecision(orgId, entityName, orgStats, entityStats);
      
      analytics.recommendations[decision.route === 'entity-level' ? 'entityLevel' : 
                                  decision.route === 'org-level' ? 'orgLevel' : 'shared']++;
    }

    return new Response(JSON.stringify({
      success: true,
      analytics,
      approach: 'smart-routing'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Handle auto-scaling requests
   */
  private async handleAutoScale(scaleRequest: {
    orgId: string;
    entityName?: string;
    trigger: 'scale-up' | 'scale-down';
    threshold?: number;
  }): Promise<Response> {
    const { orgId, entityName, trigger, threshold } = scaleRequest;

    // TODO: Implement auto-scaling logic
    // This would spawn/destroy additional Durable Object instances
    
    console.log(`🚀 Auto-scale ${trigger} triggered for ${orgId}${entityName ? ':' + entityName : ''}`);

    return new Response(JSON.stringify({
      success: true,
      orgId,
      entityName,
      trigger,
      message: 'Auto-scaling logic pending implementation',
      approach: 'smart-routing'
    }), { headers: { 'Content-Type': 'application/json' }});
  }

  /**
   * Get organization usage statistics
   */
  private async getOrgUsageStats(orgId: string): Promise<UsageStats> {
    if (!this.orgUsageStats.has(orgId)) {
      const stored = await this.storage.get(`org-stats:${orgId}`) as UsageStats;
      if (stored) {
        this.orgUsageStats.set(orgId, stored);
        return stored;
      }
    }
    return this.orgUsageStats.get(orgId) || this.getDefaultUsageStats();
  }

  /**
   * Get entity usage statistics
   */
  private async getEntityUsageStats(orgId: string, entityName: string): Promise<UsageStats> {
    const entityKey = `${orgId}:${entityName}`;
    if (!this.entityUsageStats.has(entityKey)) {
      const stored = await this.storage.get(`entity-stats:${entityKey}`) as UsageStats;
      if (stored) {
        this.entityUsageStats.set(entityKey, stored);
        return stored;
      }
    }
    return this.entityUsageStats.get(entityKey) || this.getDefaultUsageStats();
  }

  /**
   * Load statistics from persistent storage
   */
  private async loadStatsFromStorage(): Promise<void> {
    const allStats = await this.storage.list();
    
    for (const [key, value] of allStats.entries()) {
      if (key.startsWith('org-stats:')) {
        const orgId = key.replace('org-stats:', '');
        this.orgUsageStats.set(orgId, value as UsageStats);
      } else if (key.startsWith('entity-stats:')) {
        const entityKey = key.replace('entity-stats:', '');
        this.entityUsageStats.set(entityKey, value as UsageStats);
      }
    }
  }

  /**
   * Generate object ID based on routing decision
   */
  private generateObjectId(route: string, orgId: string, entityName: string): string {
    switch (route) {
      case 'entity-level':
        return `${orgId}:${entityName}`;
      case 'org-level':
        return orgId;
      case 'shared':
        return 'shared-router';
      default:
        return `${orgId}:${entityName}`;
    }
  }

  /**
   * Parse data size string to megabytes
   */
  private parseSizeToMB(sizeStr: string): number {
    if (!sizeStr) return 0;
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 0;
    
    const value = parseFloat(match[1]);
    const unit = match[2].toUpperCase();
    
    switch (unit) {
      case 'B': return value / (1024 * 1024);
      case 'KB': return value / 1024;
      case 'MB': return value;
      case 'GB': return value * 1024;
      default: return 0;
    }
  }

  /**
   * Get default usage statistics
   */
  private getDefaultUsageStats(): UsageStats {
    return {
      requestsPerMinute: 0,
      dataSize: '0MB',
      entitiesCount: 0,
      peakLoad: 0,
      lastActivity: new Date().toISOString()
    };
  }
}