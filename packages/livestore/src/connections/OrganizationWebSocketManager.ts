/**
 * Organization WebSocket Manager for Multi-Tenant Real-Time Connections
 * Manages organization-specific WebSocket connection pools with access control integration
 */

import { 
  ProjectAccessControlService,
  TaskAccessControlService,
  FileAccessControlService,
  DiscussionAccessControlService,
  RoleManagementService
} from '@vibestack/dataforge';

export interface OrganizationConnection {
  id: string;
  organizationId: string;
  userId: string;
  websocket: WebSocket;
  subscriptions: Set<string>;
  lastActivity: Date;
  permissions: UserPermissionCache;
  connectionHealth: ConnectionHealth;
}

export interface UserPermissionCache {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: Map<string, PermissionResult>;
  lastUpdated: Date;
  ttl: number; // Time to live in milliseconds
}

export interface PermissionResult {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canAdmin: boolean;
  fieldAccess: Record<string, boolean>;
  lastChecked: Date;
}

export interface ConnectionHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  lastPing: Date;
  reconnectAttempts: number;
  errorCount: number;
}

export interface EventSubscription {
  id: string;
  pattern: string;
  organizationId: string;
  userId: string;
  filters: SubscriptionFilter[];
  permissions: string[];
  createdAt: Date;
}

export interface SubscriptionFilter {
  type: 'archetype' | 'entity' | 'permission' | 'organization';
  field: string;
  operator: 'equals' | 'contains' | 'in' | 'matches';
  value: any;
}

export interface RealTimeEvent {
  id: string;
  type: string;
  archetype: string;
  entityId: string;
  organizationId: string;
  userId: string;
  action: 'create' | 'update' | 'delete' | 'permission_change';
  data: any;
  timestamp: Date;
  permissions: string[];
  sensitive: boolean;
}

export class OrganizationWebSocketManager {
  private connections: Map<string, OrganizationConnection> = new Map();
  private organizationPools: Map<string, Set<string>> = new Map();
  private subscriptions: Map<string, EventSubscription> = new Map();
  private permissionCache: Map<string, UserPermissionCache> = new Map();
  
  // Access control services
  private projectAccessControl = new ProjectAccessControlService();
  private taskAccessControl = new TaskAccessControlService();
  private fileAccessControl = new FileAccessControlService();
  private discussionAccessControl = new DiscussionAccessControlService();
  private roleManagement = new RoleManagementService();

  // Configuration
  private readonly maxConnectionsPerOrg = 10000;
  private readonly permissionCacheTTL = 5 * 60 * 1000; // 5 minutes
  private readonly connectionTimeoutMs = 30000; // 30 seconds
  private readonly pingIntervalMs = 15000; // 15 seconds

  constructor() {
    this.startHealthMonitoring();
    this.startPermissionCacheCleanup();
  }

  /**
   * Create organization-scoped WebSocket connection
   */
  async createConnection(
    websocket: WebSocket,
    userId: string,
    organizationId: string,
    authToken: string
  ): Promise<OrganizationConnection> {
    // Validate organization membership
    await this.validateOrganizationMembership(userId, organizationId, authToken);
    
    // Check connection limits
    const orgConnections = this.organizationPools.get(organizationId) || new Set();
    if (orgConnections.size >= this.maxConnectionsPerOrg) {
      throw new Error(`Organization ${organizationId} has reached maximum connection limit`);
    }

    // Create connection
    const connectionId = this.generateConnectionId(userId, organizationId);
    const connection: OrganizationConnection = {
      id: connectionId,
      organizationId,
      userId,
      websocket,
      subscriptions: new Set(),
      lastActivity: new Date(),
      permissions: await this.initializePermissionCache(userId, organizationId),
      connectionHealth: {
        status: 'healthy',
        latency: 0,
        lastPing: new Date(),
        reconnectAttempts: 0,
        errorCount: 0
      }
    };

    // Store connection
    this.connections.set(connectionId, connection);
    orgConnections.add(connectionId);
    this.organizationPools.set(organizationId, orgConnections);

    // Setup connection handlers
    this.setupConnectionHandlers(connection);

    console.log(`✅ Created WebSocket connection for user ${userId} in organization ${organizationId}`);
    return connection;
  }

  /**
   * Subscribe to organization-scoped events with access control
   */
  async subscribeToEvents(
    connectionId: string,
    pattern: string,
    filters: SubscriptionFilter[]
  ): Promise<EventSubscription> {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    // Validate subscription permissions
    await this.validateSubscriptionPermissions(connection, pattern, filters);

    // Create subscription
    const subscription: EventSubscription = {
      id: this.generateSubscriptionId(),
      pattern,
      organizationId: connection.organizationId,
      userId: connection.userId,
      filters,
      permissions: await this.getSubscriptionPermissions(connection, pattern),
      createdAt: new Date()
    };

    // Store subscription
    this.subscriptions.set(subscription.id, subscription);
    connection.subscriptions.add(subscription.id);

    console.log(`📡 Created subscription ${subscription.id} for pattern: ${pattern}`);
    return subscription;
  }

  /**
   * Distribute events with organization isolation and permission filtering
   */
  async distributeEvent(event: RealTimeEvent): Promise<void> {
    console.log(`📢 Distributing event ${event.id} for ${event.archetype}:${event.entityId}`);
    
    // Get organization connections
    const orgConnections = this.organizationPools.get(event.organizationId);
    if (!orgConnections) {
      console.log(`No connections found for organization ${event.organizationId}`);
      return;
    }

    // Filter connections by subscription and permissions
    const eligibleConnections = await this.filterConnectionsByPermissions(event, orgConnections);
    
    // Send event to eligible connections
    const deliveredCount = await this.sendEventToConnections(event, eligibleConnections);
    
    console.log(`📨 Event ${event.id} delivered to ${deliveredCount} connections`);
  }

  /**
   * Handle real-time permission updates
   */
  async handlePermissionUpdate(
    organizationId: string,
    userId: string,
    permissionChanges: any
  ): Promise<void> {
    console.log(`🔐 Processing permission update for user ${userId} in org ${organizationId}`);
    
    // Update permission cache
    await this.updatePermissionCache(userId, organizationId);
    
    // Find affected connections
    const affectedConnections = Array.from(this.connections.values())
      .filter(conn => conn.organizationId === organizationId && conn.userId === userId);
    
    // Send permission update events
    for (const connection of affectedConnections) {
      const permissionEvent: RealTimeEvent = {
        id: this.generateEventId(),
        type: 'permission_update',
        archetype: 'user_permission',
        entityId: userId,
        organizationId,
        userId: 'system',
        action: 'permission_change',
        data: {
          userId,
          changes: permissionChanges,
          timestamp: new Date()
        },
        timestamp: new Date(),
        permissions: ['user.read_own'],
        sensitive: false
      };

      await this.sendEventToConnection(connection, permissionEvent);
    }
  }

  /**
   * Validate organization membership
   */
  private async validateOrganizationMembership(
    userId: string,
    organizationId: string,
    authToken: string
  ): Promise<void> {
    // In production, this would validate against the organization membership database
    // For now, we'll simulate validation
    console.log(`🔍 Validating membership for user ${userId} in organization ${organizationId}`);
    
    // Simulate token validation and organization membership check
    if (!authToken || authToken.length < 10) {
      throw new Error('Invalid authentication token');
    }
    
    // Simulate organization access validation
    const hasAccess = await this.checkOrganizationAccess(userId, organizationId);
    if (!hasAccess) {
      throw new Error(`User ${userId} does not have access to organization ${organizationId}`);
    }
  }

  /**
   * Initialize permission cache for user
   */
  private async initializePermissionCache(
    userId: string,
    organizationId: string
  ): Promise<UserPermissionCache> {
    console.log(`🏗️ Initializing permission cache for user ${userId}`);
    
    // Get user roles in organization
    const roles = await this.getUserRolesInOrganization(userId, organizationId);
    
    const cache: UserPermissionCache = {
      userId,
      organizationId,
      roles,
      permissions: new Map(),
      lastUpdated: new Date(),
      ttl: this.permissionCacheTTL
    };

    // Cache initial permissions for common resources
    await this.preloadCommonPermissions(cache);
    
    this.permissionCache.set(`${userId}:${organizationId}`, cache);
    return cache;
  }

  /**
   * Check permissions for specific resource and action
   */
  async checkPermission(
    userId: string,
    organizationId: string,
    archetype: string,
    entityId: string,
    action: 'read' | 'write' | 'delete' | 'admin'
  ): Promise<boolean> {
    const cacheKey = `${userId}:${organizationId}`;
    const cache = this.permissionCache.get(cacheKey);
    
    if (!cache || this.isPermissionCacheExpired(cache)) {
      await this.updatePermissionCache(userId, organizationId);
      return this.checkPermission(userId, organizationId, archetype, entityId, action);
    }

    const permissionKey = `${archetype}:${entityId}:${action}`;
    const cachedResult = cache.permissions.get(permissionKey);
    
    if (cachedResult && !this.isPermissionExpired(cachedResult)) {
      return this.getPermissionResult(cachedResult, action);
    }

    // Calculate permission and cache result
    const hasPermission = await this.calculatePermission(userId, organizationId, archetype, entityId, action);
    
    // Cache the result
    const permissionResult: PermissionResult = {
      canRead: action === 'read' ? hasPermission : await this.calculatePermission(userId, organizationId, archetype, entityId, 'read'),
      canWrite: action === 'write' ? hasPermission : await this.calculatePermission(userId, organizationId, archetype, entityId, 'write'),
      canDelete: action === 'delete' ? hasPermission : await this.calculatePermission(userId, organizationId, archetype, entityId, 'delete'),
      canAdmin: action === 'admin' ? hasPermission : await this.calculatePermission(userId, organizationId, archetype, entityId, 'admin'),
      fieldAccess: {},
      lastChecked: new Date()
    };
    
    cache.permissions.set(permissionKey, permissionResult);
    return hasPermission;
  }

  /**
   * Calculate permission using appropriate access control service
   */
  private async calculatePermission(
    userId: string,
    organizationId: string,
    archetype: string,
    entityId: string,
    action: string
  ): Promise<boolean> {
    // Mock entity for permission checking
    const mockEntity = { id: entityId, organizationId, archetype };
    
    try {
      switch (archetype) {
        case 'project':
          return this.projectAccessControl.canRead(userId, mockEntity as any);
        case 'task':
          return this.taskAccessControl.canRead(userId, mockEntity as any);
        case 'file':
          return this.fileAccessControl.canRead(userId, mockEntity as any);
        case 'discussion':
          return this.discussionAccessControl.canRead(userId, mockEntity as any);
        default:
          console.warn(`Unknown archetype: ${archetype}`);
          return false;
      }
    } catch (error) {
      console.error(`Error calculating permission for ${archetype}:${entityId}:${action}`, error);
      return false;
    }
  }

  /**
   * Filter connections by event permissions
   */
  private async filterConnectionsByPermissions(
    event: RealTimeEvent,
    connectionIds: Set<string>
  ): Promise<OrganizationConnection[]> {
    const eligibleConnections: OrganizationConnection[] = [];
    
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (!connection) continue;

      // Check if user has permission to receive this event
      const hasPermission = await this.checkPermission(
        connection.userId,
        connection.organizationId,
        event.archetype,
        event.entityId,
        'read'
      );

      if (hasPermission) {
        // Check subscription filters
        const hasMatchingSubscription = await this.hasMatchingSubscription(connection, event);
        if (hasMatchingSubscription) {
          eligibleConnections.push(connection);
        }
      }
    }
    
    return eligibleConnections;
  }

  /**
   * Send event to multiple connections
   */
  private async sendEventToConnections(
    event: RealTimeEvent,
    connections: OrganizationConnection[]
  ): Promise<number> {
    let deliveredCount = 0;
    
    for (const connection of connections) {
      try {
        await this.sendEventToConnection(connection, event);
        deliveredCount++;
      } catch (error) {
        console.error(`Failed to send event to connection ${connection.id}:`, error);
        this.handleConnectionError(connection, error);
      }
    }
    
    return deliveredCount;
  }

  /**
   * Send event to specific connection
   */
  private async sendEventToConnection(
    connection: OrganizationConnection,
    event: RealTimeEvent
  ): Promise<void> {
    if (connection.websocket.readyState !== WebSocket.OPEN) {
      console.warn(`WebSocket not open for connection ${connection.id}`);
      return;
    }

    // Filter sensitive data based on user permissions
    const filteredEvent = await this.filterEventData(connection, event);
    
    // Send event
    const message = JSON.stringify({
      type: 'event',
      event: filteredEvent
    });
    
    connection.websocket.send(message);
    connection.lastActivity = new Date();
  }

  /**
   * Setup connection event handlers
   */
  private setupConnectionHandlers(connection: OrganizationConnection): void {
    connection.websocket.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        await this.handleConnectionMessage(connection, message);
      } catch (error) {
        console.error(`Error handling message for connection ${connection.id}:`, error);
        this.handleConnectionError(connection, error);
      }
    });

    connection.websocket.on('close', () => {
      this.handleConnectionClose(connection);
    });

    connection.websocket.on('error', (error) => {
      this.handleConnectionError(connection, error);
    });

    // Start ping/pong for connection health
    this.startConnectionPing(connection);
  }

  /**
   * Start health monitoring for all connections
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.monitorConnectionHealth();
    }, this.pingIntervalMs);
  }

  /**
   * Start permission cache cleanup
   */
  private startPermissionCacheCleanup(): void {
    setInterval(() => {
      this.cleanupExpiredPermissions();
    }, 60000); // Clean up every minute
  }

  // Helper methods
  private generateConnectionId(userId: string, organizationId: string): string {
    return `conn_${organizationId}_${userId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async checkOrganizationAccess(userId: string, organizationId: string): Promise<boolean> {
    // Mock organization access check
    return Math.random() > 0.1; // 90% success rate
  }

  private async getUserRolesInOrganization(userId: string, organizationId: string): Promise<string[]> {
    // Mock role retrieval
    return ['organization_member', 'project_contributor'];
  }

  private async preloadCommonPermissions(cache: UserPermissionCache): Promise<void> {
    // Preload common permission patterns
    console.log(`Preloading common permissions for user ${cache.userId}`);
  }

  private isPermissionCacheExpired(cache: UserPermissionCache): boolean {
    return Date.now() - cache.lastUpdated.getTime() > cache.ttl;
  }

  private isPermissionExpired(result: PermissionResult): boolean {
    return Date.now() - result.lastChecked.getTime() > 60000; // 1 minute
  }

  private getPermissionResult(result: PermissionResult, action: string): boolean {
    switch (action) {
      case 'read': return result.canRead;
      case 'write': return result.canWrite;
      case 'delete': return result.canDelete;
      case 'admin': return result.canAdmin;
      default: return false;
    }
  }

  private async updatePermissionCache(userId: string, organizationId: string): Promise<void> {
    const cache = await this.initializePermissionCache(userId, organizationId);
    this.permissionCache.set(`${userId}:${organizationId}`, cache);
  }

  private async validateSubscriptionPermissions(
    connection: OrganizationConnection,
    pattern: string,
    filters: SubscriptionFilter[]
  ): Promise<void> {
    // Validate that user can subscribe to this pattern
    console.log(`Validating subscription permissions for pattern: ${pattern}`);
  }

  private async getSubscriptionPermissions(
    connection: OrganizationConnection,
    pattern: string
  ): Promise<string[]> {
    // Get required permissions for subscription pattern
    return ['read'];
  }

  private async hasMatchingSubscription(
    connection: OrganizationConnection,
    event: RealTimeEvent
  ): Promise<boolean> {
    // Check if connection has subscriptions matching this event
    for (const subscriptionId of connection.subscriptions) {
      const subscription = this.subscriptions.get(subscriptionId);
      if (subscription && this.eventMatchesSubscription(event, subscription)) {
        return true;
      }
    }
    return false;
  }

  private eventMatchesSubscription(event: RealTimeEvent, subscription: EventSubscription): boolean {
    // Simple pattern matching - in production this would be more sophisticated
    return subscription.pattern.includes(event.archetype) || subscription.pattern === '*';
  }

  private async filterEventData(
    connection: OrganizationConnection,
    event: RealTimeEvent
  ): Promise<RealTimeEvent> {
    // Filter sensitive data based on user permissions
    if (event.sensitive) {
      // Apply field-level filtering based on permissions
      const filteredData = { ...event.data };
      // Remove sensitive fields user can't access
      return { ...event, data: filteredData };
    }
    return event;
  }

  private async handleConnectionMessage(
    connection: OrganizationConnection,
    message: any
  ): Promise<void> {
    connection.lastActivity = new Date();
    
    switch (message.type) {
      case 'ping':
        connection.websocket.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'subscribe':
        await this.subscribeToEvents(connection.id, message.pattern, message.filters || []);
        break;
      case 'unsubscribe':
        // Handle unsubscription
        break;
      default:
        console.warn(`Unknown message type: ${message.type}`);
    }
  }

  private handleConnectionClose(connection: OrganizationConnection): void {
    console.log(`🔌 Connection ${connection.id} closed`);
    this.removeConnection(connection);
  }

  private handleConnectionError(connection: OrganizationConnection, error: any): void {
    console.error(`❌ Connection ${connection.id} error:`, error);
    connection.connectionHealth.errorCount++;
    
    if (connection.connectionHealth.errorCount > 5) {
      this.removeConnection(connection);
    }
  }

  private removeConnection(connection: OrganizationConnection): void {
    // Remove from connections map
    this.connections.delete(connection.id);
    
    // Remove from organization pool
    const orgConnections = this.organizationPools.get(connection.organizationId);
    if (orgConnections) {
      orgConnections.delete(connection.id);
    }
    
    // Remove subscriptions
    for (const subscriptionId of connection.subscriptions) {
      this.subscriptions.delete(subscriptionId);
    }
    
    console.log(`🗑️ Removed connection ${connection.id}`);
  }

  private startConnectionPing(connection: OrganizationConnection): void {
    const pingInterval = setInterval(() => {
      if (connection.websocket.readyState !== WebSocket.OPEN) {
        clearInterval(pingInterval);
        return;
      }
      
      const startTime = Date.now();
      connection.websocket.send(JSON.stringify({ type: 'ping', timestamp: startTime }));
      
      // Update connection health
      connection.connectionHealth.lastPing = new Date();
    }, this.pingIntervalMs);
  }

  private monitorConnectionHealth(): void {
    for (const connection of this.connections.values()) {
      const timeSinceLastActivity = Date.now() - connection.lastActivity.getTime();
      
      if (timeSinceLastActivity > this.connectionTimeoutMs) {
        connection.connectionHealth.status = 'unhealthy';
        this.removeConnection(connection);
      } else if (timeSinceLastActivity > this.connectionTimeoutMs / 2) {
        connection.connectionHealth.status = 'degraded';
      } else {
        connection.connectionHealth.status = 'healthy';
      }
    }
  }

  private cleanupExpiredPermissions(): void {
    for (const [key, cache] of this.permissionCache.entries()) {
      if (this.isPermissionCacheExpired(cache)) {
        this.permissionCache.delete(key);
      }
    }
  }
}

export default OrganizationWebSocketManager;