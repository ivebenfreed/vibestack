/**
 * Client-Side Access Control Integration
 * Integrates frontend applications with the multi-tenant LiveStore access control system
 */

export interface AccessControlClientConfig {
  apiBaseUrl: string;
  websocketUrl: string;
  organizationId: string;
  userId: string;
  authToken: string;
  enableRealTimePermissions: boolean;
  enableOfflineMode: boolean;
  cacheTTLMs: number;
  reconnectAttempts: number;
  reconnectDelayMs: number;
}

export interface ClientPermission {
  resource: string;
  action: string;
  granted: boolean;
  conditions?: PermissionCondition[];
  expiresAt?: Date;
  lastChecked: Date;
}

export interface PermissionCondition {
  field: string;
  operator: string;
  value: any;
  description: string;
}

export interface UserContext {
  userId: string;
  organizationId: string;
  roles: string[];
  permissions: Set<string>;
  profile: UserProfile;
  settings: UserSettings;
  lastUpdated: Date;
}

export interface UserProfile {
  name: string;
  email: string;
  avatar?: string;
  department?: string;
  title?: string;
  timezone: string;
  locale: string;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    email: boolean;
    desktop: boolean;
    mobile: boolean;
    frequency: 'immediate' | 'digest' | 'off';
  };
  privacy: {
    showOnlineStatus: boolean;
    allowMentions: boolean;
  };
}

export interface PermissionUpdateEvent {
  type: 'permission_update';
  userId: string;
  organizationId: string;
  changes: {
    added: string[];
    removed: string[];
    modified: Array<{ permission: string; oldValue: any; newValue: any; }>;
  };
  effectiveAt: Date;
  reason: string;
}

export interface AccessControlEvent {
  id: string;
  type: 'permission_change' | 'role_change' | 'context_update' | 'access_denied';
  payload: any;
  timestamp: Date;
}

export interface OfflinePermissionCache {
  permissions: Map<string, ClientPermission>;
  context: UserContext;
  lastSync: Date;
  version: number;
}

export type PermissionCheckResult = {
  granted: boolean;
  reason?: string;
  conditions?: PermissionCondition[];
  cached: boolean;
  checkedAt: Date;
};

export type AccessControlEventHandler = (event: AccessControlEvent) => void;

export class AccessControlClient {
  private config: AccessControlClientConfig;
  private userContext: UserContext | null = null;
  private permissionCache: Map<string, ClientPermission> = new Map();
  private websocket: WebSocket | null = null;
  private eventHandlers: Map<string, AccessControlEventHandler[]> = new Map();
  private connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' = 'disconnected';
  private reconnectAttempts = 0;
  private offlineCache: OfflinePermissionCache | null = null;
  private pendingPermissionChecks: Map<string, Promise<PermissionCheckResult>> = new Map();
  
  constructor(config: AccessControlClientConfig) {
    this.config = config;
    this.initializeOfflineCache();
  }

  /**
   * Initialize the client and establish connection
   */
  async initialize(): Promise<void> {
    console.log(`🔐 Initializing AccessControlClient for user ${this.config.userId} in org ${this.config.organizationId}`);

    try {
      // Load user context
      await this.loadUserContext();
      
      // Connect to real-time system if enabled
      if (this.config.enableRealTimePermissions) {
        await this.connectWebSocket();
      }

      // Preload common permissions
      await this.preloadCommonPermissions();

      console.log(`✅ AccessControlClient initialized successfully`);

    } catch (error) {
      console.error(`❌ Failed to initialize AccessControlClient:`, error);
      
      // Fall back to offline mode if available
      if (this.config.enableOfflineMode && this.offlineCache) {
        console.log(`📴 Falling back to offline mode`);
        this.loadFromOfflineCache();
      } else {
        throw error;
      }
    }
  }

  /**
   * Check if user has permission for specific resource and action
   */
  async hasPermission(resource: string, action: string): Promise<PermissionCheckResult> {
    const cacheKey = `${resource}:${action}`;
    const startTime = Date.now();

    // Check if permission check is already in progress
    const pending = this.pendingPermissionChecks.get(cacheKey);
    if (pending) {
      return await pending;
    }

    // Create permission check promise
    const checkPromise = this.performPermissionCheck(resource, action);
    this.pendingPermissionChecks.set(cacheKey, checkPromise);

    try {
      const result = await checkPromise;
      console.log(`🔍 Permission check for ${resource}:${action} - ${result.granted ? 'GRANTED' : 'DENIED'} (${Date.now() - startTime}ms)`);
      return result;
    } finally {
      this.pendingPermissionChecks.delete(cacheKey);
    }
  }

  /**
   * Perform the actual permission check
   */
  private async performPermissionCheck(resource: string, action: string): Promise<PermissionCheckResult> {
    const cacheKey = `${resource}:${action}`;
    
    // Check cache first
    const cached = this.permissionCache.get(cacheKey);
    if (cached && this.isPermissionCacheFresh(cached)) {
      return {
        granted: cached.granted,
        conditions: cached.conditions,
        cached: true,
        checkedAt: cached.lastChecked
      };
    }

    // Check if user context is available
    if (!this.userContext) {
      return {
        granted: false,
        reason: 'User context not available',
        cached: false,
        checkedAt: new Date()
      };
    }

    try {
      // Check against user permissions
      const permission = `${resource}.${action}`;
      
      // Check direct permission
      if (this.userContext.permissions.has(permission)) {
        const result = this.createPermissionResult(true, [], false);
        this.cachePermissionResult(cacheKey, result);
        return result;
      }

      // Check wildcard permissions
      if (this.userContext.permissions.has('*') || this.userContext.permissions.has(`${resource}.*`)) {
        const result = this.createPermissionResult(true, [], false);
        this.cachePermissionResult(cacheKey, result);
        return result;
      }

      // Check pattern-based permissions
      for (const userPermission of this.userContext.permissions) {
        if (this.matchesPermissionPattern(permission, userPermission)) {
          const result = this.createPermissionResult(true, [], false);
          this.cachePermissionResult(cacheKey, result);
          return result;
        }
      }

      // If connected, verify with server
      if (this.connectionState === 'connected' && this.websocket) {
        return await this.verifyPermissionWithServer(resource, action);
      }

      // Permission denied
      const result = this.createPermissionResult(false, [], false, 'Permission not found');
      this.cachePermissionResult(cacheKey, result);
      return result;

    } catch (error) {
      console.error(`Error checking permission ${resource}:${action}:`, error);
      
      // Return cached result if available, even if stale
      if (cached) {
        return {
          granted: cached.granted,
          reason: 'Using stale cache due to error',
          conditions: cached.conditions,
          cached: true,
          checkedAt: cached.lastChecked
        };
      }

      return {
        granted: false,
        reason: `Error checking permission: ${error}`,
        cached: false,
        checkedAt: new Date()
      };
    }
  }

  /**
   * Verify permission with server
   */
  private async verifyPermissionWithServer(resource: string, action: string): Promise<PermissionCheckResult> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId();
      const timeoutId = setTimeout(() => {
        reject(new Error('Permission check timeout'));
      }, 5000);

      // Listen for response
      const responseHandler = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'permission_response' && data.requestId === requestId) {
            clearTimeout(timeoutId);
            this.websocket?.removeEventListener('message', responseHandler);
            
            const result = {
              granted: data.granted,
              conditions: data.conditions,
              cached: false,
              checkedAt: new Date()
            };
            
            // Cache the result
            this.cachePermissionResult(`${resource}:${action}`, result);
            resolve(result);
          }
        } catch (error) {
          // Ignore invalid messages
        }
      };

      this.websocket?.addEventListener('message', responseHandler);

      // Send permission check request
      this.websocket?.send(JSON.stringify({
        type: 'permission_check',
        requestId,
        resource,
        action,
        userId: this.config.userId,
        organizationId: this.config.organizationId
      }));
    });
  }

  /**
   * Check multiple permissions at once
   */
  async hasPermissions(permissions: Array<{ resource: string; action: string; }>): Promise<Record<string, PermissionCheckResult>> {
    const results: Record<string, PermissionCheckResult> = {};
    
    // Execute all permission checks in parallel
    const checks = permissions.map(async perm => {
      const key = `${perm.resource}:${perm.action}`;
      results[key] = await this.hasPermission(perm.resource, perm.action);
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * Get current user context
   */
  getUserContext(): UserContext | null {
    return this.userContext;
  }

  /**
   * Update user settings
   */
  async updateUserSettings(settings: Partial<UserSettings>): Promise<void> {
    if (!this.userContext) {
      throw new Error('User context not available');
    }

    try {
      // Update locally
      Object.assign(this.userContext.settings, settings);
      this.userContext.lastUpdated = new Date();

      // Send update to server if connected
      if (this.connectionState === 'connected' && this.websocket) {
        this.websocket.send(JSON.stringify({
          type: 'update_user_settings',
          userId: this.config.userId,
          organizationId: this.config.organizationId,
          settings
        }));
      }

      // Update offline cache
      this.updateOfflineCache();

      console.log(`⚙️ Updated user settings`);

    } catch (error) {
      console.error('Failed to update user settings:', error);
      throw error;
    }
  }

  /**
   * Subscribe to access control events
   */
  addEventListener(eventType: string, handler: AccessControlEventHandler): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * Unsubscribe from access control events
   */
  removeEventListener(eventType: string, handler: AccessControlEventHandler): void {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Clear permission cache
   */
  clearPermissionCache(): void {
    this.permissionCache.clear();
    console.log(`🧹 Cleared permission cache`);
  }

  /**
   * Refresh user context and permissions
   */
  async refresh(): Promise<void> {
    console.log(`🔄 Refreshing access control client`);
    
    this.clearPermissionCache();
    await this.loadUserContext();
    
    if (this.config.enableRealTimePermissions && this.connectionState !== 'connected') {
      await this.connectWebSocket();
    }
  }

  /**
   * Disconnect and cleanup
   */
  disconnect(): void {
    console.log(`🔌 Disconnecting AccessControlClient`);
    
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
    
    this.connectionState = 'disconnected';
    this.clearPermissionCache();
  }

  /**
   * Load user context from API
   */
  private async loadUserContext(): Promise<void> {
    try {
      // In production, this would make an API call
      // For now, create mock user context
      this.userContext = {
        userId: this.config.userId,
        organizationId: this.config.organizationId,
        roles: ['member'],
        permissions: new Set([
          'project.read',
          'project.write',
          'task.read',
          'task.write',
          'file.read',
          'discussion.read'
        ]),
        profile: {
          name: 'Test User',
          email: 'test@example.com',
          timezone: 'UTC',
          locale: 'en-US'
        },
        settings: {
          theme: 'light',
          notifications: {
            email: true,
            desktop: true,
            mobile: true,
            frequency: 'immediate'
          },
          privacy: {
            showOnlineStatus: true,
            allowMentions: true
          }
        },
        lastUpdated: new Date()
      };

      console.log(`👤 Loaded user context for ${this.userContext.profile.name}`);
      this.updateOfflineCache();

    } catch (error) {
      console.error('Failed to load user context:', error);
      throw error;
    }
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private async connectWebSocket(): Promise<void> {
    if (this.connectionState === 'connecting' || this.connectionState === 'connected') {
      return;
    }

    this.connectionState = 'connecting';
    console.log(`🔗 Connecting to WebSocket at ${this.config.websocketUrl}`);

    try {
      this.websocket = new WebSocket(this.config.websocketUrl);
      
      this.websocket.onopen = () => {
        console.log(`✅ WebSocket connected`);
        this.connectionState = 'connected';
        this.reconnectAttempts = 0;

        // Send authentication
        this.websocket?.send(JSON.stringify({
          type: 'authenticate',
          userId: this.config.userId,
          organizationId: this.config.organizationId,
          authToken: this.config.authToken
        }));
      };

      this.websocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };

      this.websocket.onclose = () => {
        console.log(`🔌 WebSocket disconnected`);
        this.connectionState = 'disconnected';
        this.websocket = null;
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.config.reconnectAttempts) {
          this.scheduleReconnect();
        }
      };

      this.websocket.onerror = (error) => {
        console.error(`❌ WebSocket error:`, error);
      };

    } catch (error) {
      this.connectionState = 'disconnected';
      throw error;
    }
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleWebSocketMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'permission_update':
          this.handlePermissionUpdate(data);
          break;
        case 'context_update':
          this.handleContextUpdate(data);
          break;
        case 'access_denied':
          this.handleAccessDenied(data);
          break;
        default:
          // Ignore unknown message types
          break;
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  /**
   * Handle permission update from server
   */
  private handlePermissionUpdate(data: PermissionUpdateEvent): void {
    console.log(`🔐 Received permission update for user ${data.userId}`);
    
    if (data.userId === this.config.userId && this.userContext) {
      // Update permissions
      data.changes.added.forEach(perm => this.userContext!.permissions.add(perm));
      data.changes.removed.forEach(perm => this.userContext!.permissions.delete(perm));
      
      // Clear affected cache entries
      this.clearAffectedCache(data.changes.added.concat(data.changes.removed));
      
      // Update context timestamp
      this.userContext.lastUpdated = new Date();
      this.updateOfflineCache();
      
      // Emit event
      this.emitEvent({
        id: this.generateRequestId(),
        type: 'permission_change',
        payload: data,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle context update from server
   */
  private handleContextUpdate(data: any): void {
    console.log(`📝 Received context update`);
    
    if (this.userContext) {
      // Update relevant context fields
      if (data.profile) {
        Object.assign(this.userContext.profile, data.profile);
      }
      if (data.settings) {
        Object.assign(this.userContext.settings, data.settings);
      }
      
      this.userContext.lastUpdated = new Date();
      this.updateOfflineCache();
      
      // Emit event
      this.emitEvent({
        id: this.generateRequestId(),
        type: 'context_update',
        payload: data,
        timestamp: new Date()
      });
    }
  }

  /**
   * Handle access denied event
   */
  private handleAccessDenied(data: any): void {
    console.warn(`🚫 Access denied: ${data.reason}`);
    
    // Emit event
    this.emitEvent({
      id: this.generateRequestId(),
      type: 'access_denied',
      payload: data,
      timestamp: new Date()
    });
  }

  /**
   * Schedule WebSocket reconnection
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    this.connectionState = 'reconnecting';
    
    const delay = Math.min(this.config.reconnectDelayMs * Math.pow(2, this.reconnectAttempts - 1), 30000);
    console.log(`🔄 Scheduling reconnection attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      this.connectWebSocket().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  /**
   * Preload common permissions
   */
  private async preloadCommonPermissions(): Promise<void> {
    const commonPermissions = [
      { resource: 'project', action: 'read' },
      { resource: 'project', action: 'write' },
      { resource: 'task', action: 'read' },
      { resource: 'task', action: 'write' },
      { resource: 'file', action: 'read' },
      { resource: 'discussion', action: 'read' }
    ];

    const checks = commonPermissions.map(perm => 
      this.hasPermission(perm.resource, perm.action)
    );

    await Promise.all(checks);
    console.log(`📋 Preloaded ${commonPermissions.length} common permissions`);
  }

  /**
   * Initialize offline cache
   */
  private initializeOfflineCache(): void {
    if (!this.config.enableOfflineMode) return;

    try {
      const cached = localStorage.getItem(`access_control_cache_${this.config.userId}`);
      if (cached) {
        const data = JSON.parse(cached);
        this.offlineCache = {
          permissions: new Map(data.permissions),
          context: data.context,
          lastSync: new Date(data.lastSync),
          version: data.version || 1
        };
        console.log(`📦 Loaded offline cache with ${this.offlineCache.permissions.size} permissions`);
      }
    } catch (error) {
      console.error('Failed to load offline cache:', error);
    }
  }

  /**
   * Update offline cache
   */
  private updateOfflineCache(): void {
    if (!this.config.enableOfflineMode || !this.userContext) return;

    try {
      const cacheData = {
        permissions: Array.from(this.permissionCache.entries()),
        context: this.userContext,
        lastSync: new Date(),
        version: 1
      };

      localStorage.setItem(
        `access_control_cache_${this.config.userId}`,
        JSON.stringify(cacheData)
      );
    } catch (error) {
      console.error('Failed to update offline cache:', error);
    }
  }

  /**
   * Load from offline cache
   */
  private loadFromOfflineCache(): void {
    if (!this.offlineCache) return;

    this.userContext = this.offlineCache.context;
    this.permissionCache = this.offlineCache.permissions;
    console.log(`📴 Loaded from offline cache (${this.permissionCache.size} permissions)`);
  }

  // Helper methods
  private createPermissionResult(
    granted: boolean, 
    conditions: PermissionCondition[], 
    cached: boolean, 
    reason?: string
  ): PermissionCheckResult {
    return {
      granted,
      conditions,
      cached,
      checkedAt: new Date(),
      reason
    };
  }

  private cachePermissionResult(cacheKey: string, result: PermissionCheckResult): void {
    this.permissionCache.set(cacheKey, {
      resource: cacheKey.split(':')[0],
      action: cacheKey.split(':')[1],
      granted: result.granted,
      conditions: result.conditions,
      lastChecked: result.checkedAt
    });
  }

  private isPermissionCacheFresh(permission: ClientPermission): boolean {
    return Date.now() - permission.lastChecked.getTime() < this.config.cacheTTLMs;
  }

  private matchesPermissionPattern(permission: string, pattern: string): boolean {
    if (pattern === '*') return true;
    
    const regex = pattern.replace(/\*/g, '.*');
    return new RegExp(`^${regex}$`).test(permission);
  }

  private clearAffectedCache(permissions: string[]): void {
    for (const [cacheKey] of this.permissionCache.entries()) {
      for (const permission of permissions) {
        if (cacheKey.startsWith(permission.replace('.*', ''))) {
          this.permissionCache.delete(cacheKey);
          break;
        }
      }
    }
  }

  private emitEvent(event: AccessControlEvent): void {
    const handlers = this.eventHandlers.get(event.type) || [];
    handlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('Error in event handler:', error);
      }
    });
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default AccessControlClient;