/**
 * Organization Actor - High-performance org runtime with SQLite caching
 * 
 * Features:
 * - SQLite permission cache for zero-latency permission checks
 * - SQLite schema cache for instant schema validation
 * - WebSocket connections and table change notifications
 * - Gradual migration alongside existing SyncDO
 */

import type { Env } from '../types/env';
import { syncLogger } from '../middleware/logger';

const MODULE_NAME = 'OrganizationActor';

interface ClientConnection {
  socket: WebSocket;
  userId: string;
  clientId: string;
  connectedAt: number;
}

interface TableChangeNotification {
  tables: string[];
  lsn: string;
  organizationId: string;
  timestamp: number;
}

interface PermissionCacheEntry {
  userId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  granted: boolean;
  expiresAt: number;
  updatedAt: number;
}

interface SchemaCacheEntry {
  tableName: string;
  columnName: string;
  dataType: string;
  isNullable: boolean;
  constraints: string | null;
  relationships: string | null;
  schemaVersion: number;
  updatedAt: number;
}

interface RoleCacheEntry {
  userId: string;
  organizationId: string;
  role: string;
  permissions: string; // JSON array
  updatedAt: number;
}

export class OrganizationActor implements DurableObject {
  private state: DurableObjectState;
  private organizationId: string = '';
  private connections = new Map<string, ClientConnection>();
  private sqliteInitialized = false;
  private env: Env;
  
  // Debounced replication management
  private lastReplicationCall: number = 0;
  private replicationCallDebounceMs: number = 30000; // 30 seconds
  private pendingReplicationCall: ReturnType<typeof setTimeout> | null = null;
  
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    
    // Extract organization ID from the Durable Object ID
    this.organizationId = this.extractOrgIdFromActorId(state.id.toString());
    
    syncLogger.info('OrganizationActor initialized', {
      organizationId: this.organizationId,
      actorId: state.id.toString()
    }, MODULE_NAME);
    
    // Initialize SQLite database for caching
    this.initializeSQLiteCache();
  }
  
  /**
   * Initialize SQLite database with permission and schema cache tables
   */
  private initializeSQLiteCache(): void {
    if (this.sqliteInitialized) return;
    
    try {
      // Use Durable Object's SQLite storage (synchronous)
      this.state.storage.sql.exec(`
        -- Permission cache for zero-latency permission checks
        CREATE TABLE IF NOT EXISTS permission_cache (
          user_id TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          action TEXT NOT NULL,
          granted INTEGER NOT NULL, -- SQLite boolean as integer
          expires_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, resource_type, resource_id, action)
        );
        
        -- Schema cache for instant schema validation
        CREATE TABLE IF NOT EXISTS schema_cache (
          table_name TEXT NOT NULL,
          column_name TEXT NOT NULL,
          data_type TEXT NOT NULL,
          is_nullable INTEGER NOT NULL, -- SQLite boolean as integer
          constraints TEXT,
          relationships TEXT,
          schema_version INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (table_name, column_name)
        );
        
        -- Role cache for fast role lookups
        CREATE TABLE IF NOT EXISTS role_cache (
          user_id TEXT NOT NULL,
          organization_id TEXT NOT NULL,
          role TEXT NOT NULL,
          permissions TEXT NOT NULL, -- JSON array
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, organization_id)
        );
        
        -- Indexes for performance
        CREATE INDEX IF NOT EXISTS idx_permission_lookup 
        ON permission_cache(user_id, resource_type, action);
        
        CREATE INDEX IF NOT EXISTS idx_schema_table 
        ON schema_cache(table_name);
        
        CREATE INDEX IF NOT EXISTS idx_role_user 
        ON role_cache(user_id);
        
        CREATE INDEX IF NOT EXISTS idx_permission_expires 
        ON permission_cache(expires_at);
      `);
      
      this.sqliteInitialized = true;
      
      syncLogger.info('SQLite cache initialized successfully', {
        organizationId: this.organizationId
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to initialize SQLite cache', {
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Check permission using SQLite cache (zero-latency)
   */
  checkPermissionCached(
    userId: string, 
    resourceType: string, 
    resourceId: string, 
    action: string
  ): boolean {
    this.initializeSQLiteCache();
    
    try {
      const cursor = this.state.storage.sql.exec(`
        SELECT granted FROM permission_cache 
        WHERE user_id = ? AND resource_type = ? AND resource_id = ? AND action = ?
        AND expires_at > ?
      `, userId, resourceType, resourceId, action, Date.now());
      
      const result = cursor.one();
      
      if (result) {
        syncLogger.debug('Permission cache HIT', {
          userId: userId.substring(0, 8) + '...',
          resourceType,
          resourceId: resourceId.substring(0, 8) + '...',
          action,
          granted: !!result.granted
        }, MODULE_NAME);
        
        return !!result.granted;
      }
      
      syncLogger.debug('Permission cache MISS', {
        userId: userId.substring(0, 8) + '...',
        resourceType,
        resourceId: resourceId.substring(0, 8) + '...',
        action
      }, MODULE_NAME);
      
      return false; // Cache miss - caller should fetch from PostgreSQL and cache
      
    } catch (error) {
      syncLogger.error('Permission cache query failed', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return false; // Fall back to PostgreSQL on error
    }
  }
  
  /**
   * Cache permission result for future zero-latency lookups
   */
  cachePermission(
    userId: string,
    resourceType: string,
    resourceId: string,
    action: string,
    granted: boolean,
    ttlMs: number = 300000 // 5 minutes default
  ): void {
    this.initializeSQLiteCache();
    
    try {
      const expiresAt = Date.now() + ttlMs;
      const updatedAt = Date.now();
      
      this.state.storage.sql.exec(`
        INSERT OR REPLACE INTO permission_cache 
        (user_id, resource_type, resource_id, action, granted, expires_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, userId, resourceType, resourceId, action, granted ? 1 : 0, expiresAt, updatedAt);
      
      syncLogger.debug('Permission cached', {
        userId: userId.substring(0, 8) + '...',
        resourceType,
        resourceId: resourceId.substring(0, 8) + '...',
        action,
        granted,
        expiresAt
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to cache permission', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Get schema information from SQLite cache (instant)
   */
  getSchemaFromCache(tableName: string): SchemaCacheEntry[] {
    this.initializeSQLiteCache();
    
    try {
      const cursor = this.state.storage.sql.exec(`
        SELECT * FROM schema_cache 
        WHERE table_name = ?
        ORDER BY column_name
      `, tableName);
      
      const results = cursor.toArray();
      
      if (results.length > 0) {
        syncLogger.debug('Schema cache HIT', {
          tableName,
          columnCount: results.length
        }, MODULE_NAME);
        
        return results.map((row: any) => ({
          tableName: row.table_name as string,
          columnName: row.column_name as string,
          dataType: row.data_type as string,
          isNullable: !!row.is_nullable,
          constraints: row.constraints as string | null,
          relationships: row.relationships as string | null,
          schemaVersion: row.schema_version as number,
          updatedAt: row.updated_at as number
        }));
      }
      
      syncLogger.debug('Schema cache MISS', { tableName }, MODULE_NAME);
      return [];
      
    } catch (error) {
      syncLogger.error('Schema cache query failed', {
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return [];
    }
  }
  
  /**
   * Invalidate schema cache when schema changes occur
   */
  invalidateSchemaCache(): void {
    try {
      this.initializeSQLiteCache();
      
      // Clear all schema cache entries for this organization
      const orgPrefix = `org_${this.organizationId.replace(/-/g, '_')}_`;
      this.state.storage.sql.exec(`DELETE FROM schema_cache WHERE table_name LIKE ?`, `${orgPrefix}%`);
      
      syncLogger.info('Schema cache invalidated', {
        organizationId: this.organizationId,
        orgPrefix
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to invalidate schema cache', {
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Invalidate schema cache for a specific table (e.g., when entity is deleted)
   */
  invalidateTableSchema(tableName: string): void {
    try {
      this.initializeSQLiteCache();
      
      this.state.storage.sql.exec(`DELETE FROM schema_cache WHERE table_name = ?`, tableName);
      
      syncLogger.info('Table schema cache invalidated', {
        organizationId: this.organizationId,
        tableName
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to invalidate table schema cache', {
        organizationId: this.organizationId,
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Cache schema information for instant future lookups
   */
  cacheSchema(
    tableName: string,
    columns: Array<{
      columnName: string;
      dataType: string;
      isNullable: boolean;
      constraints?: string;
      relationships?: string;
    }>,
    schemaVersion: number = 1
  ): void {
    this.initializeSQLiteCache();
    
    try {
      const updatedAt = Date.now();
      
      // Clear existing schema for this table
      this.state.storage.sql.exec(`DELETE FROM schema_cache WHERE table_name = ?`, tableName);
      
      // Insert new schema
      for (const column of columns) {
        this.state.storage.sql.exec(`
          INSERT INTO schema_cache 
          (table_name, column_name, data_type, is_nullable, constraints, relationships, schema_version, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, 
          tableName,
          column.columnName,
          column.dataType,
          column.isNullable ? 1 : 0,
          column.constraints || null,
          column.relationships || null,
          schemaVersion,
          updatedAt
        );
      }
      
      syncLogger.info('Schema cached', {
        tableName,
        columnCount: columns.length,
        schemaVersion
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to cache schema', {
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Get user role from SQLite cache (zero-latency)
   */
  getRoleCached(userId: string, organizationId: string): RoleCacheEntry | null {
    this.initializeSQLiteCache();
    
    try {
      const cursor = this.state.storage.sql.exec(`
        SELECT * FROM role_cache 
        WHERE user_id = ? AND organization_id = ?
      `, userId, organizationId);
      
      const result = cursor.one();
      
      if (result) {
        syncLogger.debug('Role cache HIT', {
          userId: userId.substring(0, 8) + '...',
          organizationId,
          role: result.role
        }, MODULE_NAME);
        
        return {
          userId: result.user_id as string,
          organizationId: result.organization_id as string,
          role: result.role as string,
          permissions: result.permissions as string,
          updatedAt: result.updated_at as number
        };
      }
      
      syncLogger.debug('Role cache MISS', {
        userId: userId.substring(0, 8) + '...',
        organizationId
      }, MODULE_NAME);
      
      return null;
      
    } catch (error) {
      syncLogger.error('Role cache query failed', {
        userId: userId.substring(0, 8) + '...',
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return null;
    }
  }
  
  /**
   * Cache user role for future zero-latency lookups
   */
  cacheRole(
    userId: string,
    organizationId: string,
    role: string,
    permissions: string[]
  ): void {
    this.initializeSQLiteCache();
    
    try {
      const updatedAt = Date.now();
      const permissionsJson = JSON.stringify(permissions);
      
      this.state.storage.sql.exec(`
        INSERT OR REPLACE INTO role_cache 
        (user_id, organization_id, role, permissions, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `, userId, organizationId, role, permissionsJson, updatedAt);
      
      syncLogger.debug('Role cached', {
        userId: userId.substring(0, 8) + '...',
        organizationId,
        role,
        permissionCount: permissions.length
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to cache role', {
        userId: userId.substring(0, 8) + '...',
        organizationId,
        role,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Get all users with their roles for an organization (for admin operations)
   */
  getOrganizationRoles(organizationId: string): RoleCacheEntry[] {
    this.initializeSQLiteCache();
    
    try {
      const cursor = this.state.storage.sql.exec(`
        SELECT * FROM role_cache 
        WHERE organization_id = ?
        ORDER BY role, user_id
      `, organizationId);
      
      const results = cursor.toArray();
      
      return results.map((row: any) => ({
        userId: row.user_id as string,
        organizationId: row.organization_id as string,
        role: row.role as string,
        permissions: row.permissions as string,
        updatedAt: row.updated_at as number
      }));
      
    } catch (error) {
      syncLogger.error('Failed to get organization roles', {
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return [];
    }
  }
  
  /**
   * Remove user role from cache (when user leaves org or role changes)
   */
  invalidateRole(userId: string, organizationId: string): void {
    this.initializeSQLiteCache();
    
    try {
      this.state.storage.sql.exec(`DELETE FROM role_cache WHERE user_id = ? AND organization_id = ?`, userId, organizationId);
      
      syncLogger.info('Role cache invalidated', {
        userId: userId.substring(0, 8) + '...',
        organizationId
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to invalidate role cache', {
        userId: userId.substring(0, 8) + '...',
        organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }
  
  /**
   * Bulk cache roles for multiple users (for warming cache)
   */
  bulkCacheRoles(roles: Array<{
    userId: string;
    organizationId: string;
    role: string;
    permissions: string[];
  }>): number {
    this.initializeSQLiteCache();
    
    let successCount = 0;
    const updatedAt = Date.now();
    
    try {
      for (const roleData of roles) {
        try {
          const permissionsJson = JSON.stringify(roleData.permissions);
          
          this.state.storage.sql.exec(`
            INSERT OR REPLACE INTO role_cache 
            (user_id, organization_id, role, permissions, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `, 
            roleData.userId,
            roleData.organizationId,
            roleData.role,
            permissionsJson,
            updatedAt
          );
          
          successCount++;
          
        } catch (error) {
          syncLogger.warn('Failed to cache individual role', {
            userId: roleData.userId.substring(0, 8) + '...',
            organizationId: roleData.organizationId,
            role: roleData.role,
            error: error instanceof Error ? error.message : String(error)
          }, MODULE_NAME);
        }
      }
      
      syncLogger.info('Bulk role cache completed', {
        totalRoles: roles.length,
        successCount,
        failureCount: roles.length - successCount
      }, MODULE_NAME);
      
      return successCount;
      
    } catch (error) {
      syncLogger.error('Bulk role cache failed', {
        totalRoles: roles.length,
        successCount,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return successCount;
    }
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(): void {
    this.initializeSQLiteCache();
    
    try {
      const now = Date.now();
      
      const cursor = this.state.storage.sql.exec(`DELETE FROM permission_cache WHERE expires_at <= ?`, now);
      const result = cursor.meta;
      
      if (result.changes > 0) {
        syncLogger.info('Cleaned up expired permissions', {
          removedCount: result.changes,
          organizationId: this.organizationId
        }, MODULE_NAME);
      }
      
    } catch (error) {
      syncLogger.error('Failed to cleanup expired cache', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Handle incoming HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    try {
      if (path === '/websocket') {
        return await this.handleWebSocketUpgrade(request);
      }
      
      if (path === '/table-change-notification') {
        return await this.handleTableChangeNotification(request);
      }
      
      if (path === '/permission-check') {
        return await this.handlePermissionCheck(request);
      }
      
      if (path === '/cache-permission') {
        return await this.handleCachePermission(request);
      }
      
      if (path === '/schema-check') {
        return await this.handleSchemaCheck(request);
      }
      
      if (path === '/cache-schema') {
        return await this.handleCacheSchema(request);
      }
      
      if (path === '/invalidate-schema') {
        return await this.handleInvalidateSchema(request);
      }
      
      if (path === '/org-schema') {
        return await this.handleGetOrgSchema(request);
      }
      
      if (path === '/cache-org-schema') {
        return await this.handleCacheOrgSchema(request);
      }
      
      if (path === '/clear-org-schema-cache') {
        return await this.handleClearOrgSchemaCache(request);
      }
      
      if (path === '/role-check') {
        return await this.handleRoleCheck(request);
      }
      
      if (path === '/cache-role') {
        return await this.handleCacheRole(request);
      }
      
      if (path === '/invalidate-role') {
        return await this.handleInvalidateRole(request);
      }
      
      if (path === '/bulk-cache-roles') {
        return await this.handleBulkCacheRoles(request);
      }
      
      if (path === '/org-roles') {
        return await this.handleGetOrganizationRoles(request);
      }
      
      if (path === '/status') {
        return this.getStatus();
      }
      
      return new Response('Not Found', { status: 404 });
      
    } catch (error) {
      syncLogger.error('Request handling error', {
        path,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Internal Server Error', { status: 500 });
    }
  }
  
  /**
   * Handle permission check requests (GET /permission-check)
   */
  async handlePermissionCheck(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const resourceType = url.searchParams.get('resourceType');
    const resourceId = url.searchParams.get('resourceId');
    const action = url.searchParams.get('action');
    
    if (!userId || !resourceType || !resourceId || !action) {
      return new Response('Missing required parameters: userId, resourceType, resourceId, action', {
        status: 400
      });
    }
    
    const granted = this.checkPermissionCached(userId, resourceType, resourceId, action);
    
    return new Response(JSON.stringify({
      granted,
      cached: true,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Handle cache permission requests (POST /cache-permission)
   */
  async handleCachePermission(request: Request): Promise<Response> {
    try {
      const { userId, resourceType, resourceId, action, granted, ttlMs } = await request.json();
      
      if (!userId || !resourceType || !resourceId || !action || granted === undefined) {
        return new Response('Missing required fields: userId, resourceType, resourceId, action, granted', {
          status: 400
        });
      }
      
      this.cachePermission(userId, resourceType, resourceId, action, granted, ttlMs);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Permission cached successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle schema check requests (GET /schema-check)
   */
  async handleSchemaCheck(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const tableName = url.searchParams.get('tableName');
    
    if (!tableName) {
      return new Response('Missing required parameter: tableName', {
        status: 400
      });
    }
    
    const schema = this.getSchemaFromCache(tableName);
    
    return new Response(JSON.stringify({
      tableName,
      schema,
      cached: schema.length > 0,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Handle cache schema requests (POST /cache-schema)
   */
  async handleCacheSchema(request: Request): Promise<Response> {
    try {
      const { tableName, columns, schemaVersion } = await request.json();
      
      if (!tableName || !columns || !Array.isArray(columns)) {
        return new Response('Missing required fields: tableName, columns (array)', {
          status: 400
        });
      }
      
      this.cacheSchema(tableName, columns, schemaVersion);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Schema cached successfully',
        tableName,
        columnCount: columns.length
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle schema cache invalidation requests (POST /invalidate-schema)
   */
  async handleInvalidateSchema(request: Request): Promise<Response> {
    try {
      const body = await request.json().catch(() => ({}));
      const { tableName } = body;
      
      if (tableName) {
        // Invalidate specific table schema
        this.invalidateTableSchema(tableName);
        return new Response(JSON.stringify({
          success: true,
          message: `Schema cache invalidated for table: ${tableName}`,
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } else {
        // Invalidate all schema cache for this org
        this.invalidateSchemaCache();
        return new Response(JSON.stringify({
          success: true,
          message: 'All schema cache invalidated for organization',
          organizationId: this.organizationId,
          timestamp: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to invalidate schema cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle clear organization schema cache requests (DELETE /clear-org-schema-cache)
   */
  async handleClearOrgSchemaCache(request: Request): Promise<Response> {
    try {
      const orgIdFromHeader = request.headers.get('x-org-id');
      const orgIdToUse = orgIdFromHeader || this.organizationId;
      
      this.initializeSQLiteCache();
      
      // Clear the org_schema_cache table
      const cacheKey = `org_schema_${orgIdToUse}`;
      console.log(`[OrganizationActor] 🗑️ CLEARING org schema cache with key: ${cacheKey}`);
      
      const deleteResult = this.state.storage.sql.exec(`DELETE FROM org_schema_cache WHERE cache_key = ?`, cacheKey);
      const deletedCount = deleteResult.meta?.changes || 0;
      
      console.log(`[OrganizationActor] ✅ Cleared org schema cache - deleted ${deletedCount} entries`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Cleared organization schema cache`,
        organizationId: orgIdToUse,
        cacheKey,
        deletedEntries: deletedCount,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error(`[OrganizationActor] Error clearing org schema cache:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to clear organization schema cache',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle get organization schema requests (GET /org-schema)
   */
  async handleGetOrgSchema(request: Request): Promise<Response> {
    try {
      this.initializeSQLiteCache();
      
      // Create the table if it doesn't exist
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS org_schema_cache (
          cache_key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          cached_at INTEGER NOT NULL
        )
      `);
      
      // Extract the organization ID from the request URL or use a header to get the original org ID
      const url = new URL(request.url);
      const orgIdFromHeader = request.headers.get('x-org-id');
      const orgIdToUse = orgIdFromHeader || this.organizationId;
      
      // Check if we have cached org schema data
      const cacheKey = `org_schema_${orgIdToUse}`;
      console.log(`[OrganizationActor] 🔍 Looking for cache with key: ${cacheKey}, headerOrgId: ${orgIdFromHeader}, actorOrgId: ${this.organizationId}`);
      
      // First, let's see what's in the cache table
      const allCacheEntries = this.state.storage.sql.exec(`SELECT cache_key, LENGTH(data) as data_length, cached_at FROM org_schema_cache`);
      const allEntries = allCacheEntries.toArray() as any[];
      console.log(`[OrganizationActor] 📋 All cache entries:`, JSON.stringify(allEntries, null, 2));
      
      const cursor = this.state.storage.sql.exec(`
        SELECT data, cached_at
        FROM org_schema_cache 
        WHERE cache_key = ?
      `, cacheKey);
      
      const results = cursor.toArray() as any[];
      console.log(`[OrganizationActor] 🎯 Cache lookup results for key '${cacheKey}':`, results.length > 0 ? `Found ${results.length} entries` : 'No entries found');
      
      if (results.length > 0) {
        const result = results[0];
        const cachedData = JSON.parse(result.data);
        console.log(`[OrganizationActor] ✅ Returning cached org schema (${cachedData.length} entities)`);
        
        return new Response(JSON.stringify({
          success: true,
          cached: true,
          schema: cachedData,
          organizationId: orgIdToUse,
          timestamp: result.cached_at
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log(`[OrganizationActor] ❌ No cached org schema found`);
      
      return new Response(JSON.stringify({
        success: true,
        cached: false,
        schema: [],
        organizationId: orgIdToUse,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error(`[OrganizationActor] Error getting org schema:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to get organization schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle cache organization schema requests (POST /cache-org-schema)
   */
  async handleCacheOrgSchema(request: Request): Promise<Response> {
    try {
      const { organizationId, schema } = await request.json();
      
      // Log the organization ID comparison for debugging
      console.log(`[OrganizationActor] 🔍 Organization ID validation:`, {
        requestOrgId: organizationId,
        actorOrgId: this.organizationId,
        match: organizationId === this.organizationId
      });
      
      // Note: Don't validate organization ID match since this.organizationId may be hashed by Cloudflare
      // The important validation is that the request is coming through the correct actor instance
      
      if (!schema || !Array.isArray(schema)) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid schema data - must be an array'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      this.initializeSQLiteCache();
      
      // Store the raw schema data in a simple org-level cache
      // Use the organization ID from the request payload (not this.organizationId which may be hashed)
      const cacheKey = `org_schema_${organizationId}`;
      const now = Date.now();
      
      console.log(`[OrganizationActor] 💾 CACHE WRITE - About to cache schema with key: ${cacheKey}, requestOrgId: ${organizationId}, actorOrgId: ${this.organizationId}, entities: ${schema.length}`);
      
      // Create the table if it doesn't exist
      this.state.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS org_schema_cache (
          cache_key TEXT PRIMARY KEY,
          data TEXT NOT NULL,
          cached_at INTEGER NOT NULL
        )
      `);
      
      // Store the schema data
      this.state.storage.sql.exec(`
        INSERT OR REPLACE INTO org_schema_cache (cache_key, data, cached_at)
        VALUES (?, ?, ?)
      `, cacheKey, JSON.stringify(schema), now);
      
      // Verify the data was written
      const verifyInsert = this.state.storage.sql.exec(`SELECT cache_key, LENGTH(data) as data_length, cached_at FROM org_schema_cache WHERE cache_key = ?`, cacheKey);
      const verifyResult = verifyInsert.toArray() as any[];
      console.log(`[OrganizationActor] 🔍 CACHE WRITE VERIFICATION:`, JSON.stringify(verifyResult, null, 2));
      
      console.log(`[OrganizationActor] ✅ Cached org schema (${schema.length} entities)`);
      
      return new Response(JSON.stringify({
        success: true,
        message: `Cached schema for ${schema.length} entities`,
        organizationId: organizationId,
        cacheKey,
        timestamp: now
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to cache organization schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle role check requests (GET /role-check)
   */
  async handleRoleCheck(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const organizationId = url.searchParams.get('organizationId');
    
    if (!userId || !organizationId) {
      return new Response('Missing required parameters: userId, organizationId', {
        status: 400
      });
    }
    
    const role = this.getRoleCached(userId, organizationId);
    
    return new Response(JSON.stringify({
      role: role ? {
        userId: role.userId,
        organizationId: role.organizationId,
        role: role.role,
        permissions: JSON.parse(role.permissions),
        updatedAt: role.updatedAt
      } : null,
      cached: role !== null,
      timestamp: Date.now()
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Refresh role cache from database (triggered by WAL changes)
   */
  private async refreshRoleCacheFromDatabase(): Promise<void> {
    try {
      if (!this.env.DATABASE_URL) {
        syncLogger.warn('DATABASE_URL not available for cache refresh', {
          organizationId: this.organizationId
        }, MODULE_NAME);
        return;
      }

      // Use kysely to fetch fresh role data
      const { getKysely } = await import('../lib/kysely');
      const kysely = getKysely(this.env);
      
      const members = await kysely
        .selectFrom('organization_members as m')
        .innerJoin('user as u', 'u.id', 'm.user_id')
        .select([
          'm.user_id',
          'm.role',
          'u.email as user_email'
        ])
        .where('m.organization_id', '=', this.organizationId.replace(/_/g, '-'))
        .execute();
      
      // Bulk refresh all role caches
      const roles = members.map(member => ({
        userId: member.user_id,
        organizationId: this.organizationId.replace(/_/g, '-'),
        role: member.role,
        permissions: this.getRolePermissions(member.role)
      }));
      
      this.bulkCacheRoles(roles);
      
      syncLogger.info('Auto-refreshed role cache from database', {
        organizationId: this.organizationId,
        memberCount: members.length,
        refreshedRoles: members.map(m => ({ email: m.user_email, role: m.role }))
      }, MODULE_NAME);
      
    } catch (error) {
      syncLogger.error('Failed to refresh role cache from database', {
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Handle cache role requests (POST /cache-role)
   */
  async handleCacheRole(request: Request): Promise<Response> {
    try {
      const { userId, organizationId, role, permissions } = await request.json();
      
      if (!userId || !organizationId || !role || !Array.isArray(permissions)) {
        return new Response('Missing required fields: userId, organizationId, role, permissions (array)', {
          status: 400
        });
      }
      
      this.cacheRole(userId, organizationId, role, permissions);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Role cached successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle invalidate role requests (POST /invalidate-role)
   */
  async handleInvalidateRole(request: Request): Promise<Response> {
    try {
      const { userId, organizationId } = await request.json();
      
      if (!userId || !organizationId) {
        return new Response('Missing required fields: userId, organizationId', {
          status: 400
        });
      }
      
      this.invalidateRole(userId, organizationId);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Role cache invalidated successfully'
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle bulk cache roles requests (POST /bulk-cache-roles)
   */
  async handleBulkCacheRoles(request: Request): Promise<Response> {
    try {
      const { roles } = await request.json();
      
      if (!Array.isArray(roles)) {
        return new Response('Missing required field: roles (array)', {
          status: 400
        });
      }
      
      const successCount = this.bulkCacheRoles(roles);
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Bulk role cache completed',
        totalRoles: roles.length,
        successCount,
        failureCount: roles.length - successCount
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  /**
   * Handle get organization roles requests (GET /org-roles)
   */
  async handleGetOrganizationRoles(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get('organizationId');
    
    if (!organizationId) {
      return new Response('Missing required parameter: organizationId', {
        status: 400
      });
    }
    
    try {
      const roles = this.getOrganizationRoles(organizationId);
      
      // Parse permissions JSON for each role
      const parsedRoles = roles.map(role => ({
        userId: role.userId,
        organizationId: role.organizationId,
        role: role.role,
        permissions: JSON.parse(role.permissions),
        updatedAt: role.updatedAt
      }));
      
      return new Response(JSON.stringify({
        organizationId,
        roles: parsedRoles,
        count: parsedRoles.length,
        timestamp: Date.now()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Handle WebSocket upgrade requests from clients
   */
  async handleWebSocketUpgrade(request: Request): Promise<Response> {
    const userId = request.headers.get('x-user-id');
    const clientId = request.headers.get('x-client-id');
    const orgId = request.headers.get('x-org-id');
    
    if (!userId || !clientId || !orgId) {
      return new Response('Missing required headers: x-user-id, x-client-id, x-org-id', { 
        status: 400 
      });
    }
    
    if (orgId !== this.organizationId) {
      return new Response(`Organization mismatch: expected ${this.organizationId}, got ${orgId}`, {
        status: 403
      });
    }
    
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    
    // Accept the WebSocket connection  
    this.acceptWebSocket(server);
    
    // Store connection info
    this.connections.set(clientId, {
      socket: server,
      userId,
      clientId,
      connectedAt: Date.now()
    });
    
    syncLogger.info('Client connected to Organization Actor', {
      organizationId: this.organizationId,
      userId,
      clientId,
      totalConnections: this.connections.size
    }, MODULE_NAME);
    
    // Send welcome message
    const welcomeMessage = {
      type: 'org_actor_connected',
      organizationId: this.organizationId,
      message: 'Connected to Organization Actor',
      timestamp: Date.now()
    };
    
    try {
      server.send(JSON.stringify(welcomeMessage));
    } catch (error) {
      syncLogger.warn('Failed to send welcome message', {
        clientId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
    
    return new Response(null, { status: 101, webSocket: client });
  }
  
  /**
   * Handle table change notifications from WAL poller
   */
  async handleTableChangeNotification(request: Request): Promise<Response> {
    try {
      const notification: TableChangeNotification = await request.json();
      
      syncLogger.info('Received table change notification', {
        organizationId: this.organizationId,
        tables: notification.tables,
        lsn: notification.lsn,
        connectedClients: this.connections.size
      }, MODULE_NAME);
      
      // Skip organization ID validation for internal notifications
      // The Actor ID might be hashed by Cloudflare, so we trust the notification's organizationId
      syncLogger.debug('Organization Actor notification validation', {
        actorOrgId: this.organizationId,
        notificationOrgId: notification.organizationId,
        actorIdSource: 'extracted from Actor ID (may be hashed)',
        notificationSource: 'from WAL table name (authoritative)'
      }, MODULE_NAME);
      
      // Check if any role-related tables changed and trigger cache refresh
      const roleRelatedTables = ['organization_members', 'member', 'container_permission'];
      const hasRoleChanges = notification.tables.some(table => 
        roleRelatedTables.includes(table)
      );
      
      if (hasRoleChanges) {
        syncLogger.info('Role-related table changed, triggering cache refresh', {
          organizationId: this.organizationId,
          changedTables: notification.tables.filter(t => roleRelatedTables.includes(t))
        }, MODULE_NAME);
        
        // Trigger async cache refresh (don't wait for it)
        this.refreshRoleCacheFromDatabase().catch(error => {
          syncLogger.error('Auto cache refresh failed', {
            organizationId: this.organizationId,
            error: error.message
          }, MODULE_NAME);
        });
      }
      
      // Check if any schema-related tables changed and invalidate schema cache
      const schemaRelatedTables = ['entity_schemas', 'schema_metadata'];
      const hasSchemaChanges = notification.tables.some(table => 
        schemaRelatedTables.includes(table) ||
        table.startsWith(`org_${this.organizationId.replace(/-/g, '_')}_`) // Org-specific entity tables
      );
      
      if (hasSchemaChanges) {
        syncLogger.info('Schema-related table changed, invalidating schema cache', {
          organizationId: this.organizationId,
          changedTables: notification.tables.filter(t => 
            schemaRelatedTables.includes(t) || 
            t.startsWith(`org_${this.organizationId.replace(/-/g, '_')}_`)
          )
        }, MODULE_NAME);
        
        // Clear schema cache for this organization
        this.invalidateSchemaCache();
      }

      // Broadcast to all connected clients
      await this.broadcastTableChanges(notification);
      
      return new Response(JSON.stringify({ 
        success: true, 
        broadcastCount: this.connections.size,
        triggeredCacheRefresh: hasRoleChanges
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      syncLogger.error('Failed to handle table change notification', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      return new Response('Invalid notification format', { status: 400 });
    }
  }
  
  /**
   * Broadcast table changes to all connected clients
   */
  async broadcastTableChanges(notification: TableChangeNotification): Promise<void> {
    const message = {
      type: 'table_changed',
      tables: notification.tables,
      lsn: notification.lsn,
      organizationId: notification.organizationId,
      timestamp: notification.timestamp
    };
    
    const messageStr = JSON.stringify(message);
    let successCount = 0;
    let failureCount = 0;
    const deadConnections: string[] = [];
    
    for (const [clientId, connection] of this.connections) {
      try {
        if (connection.socket.readyState === WebSocket.READY_STATE_OPEN) {
          connection.socket.send(messageStr);
          successCount++;
        } else {
          // Mark for cleanup
          deadConnections.push(clientId);
        }
      } catch (error) {
        failureCount++;
        deadConnections.push(clientId);
        
        syncLogger.warn('Failed to send message to client', {
          clientId,
          userId: connection.userId,
          error: error instanceof Error ? error.message : String(error)
        }, MODULE_NAME);
      }
    }
    
    // Clean up dead connections
    for (const clientId of deadConnections) {
      this.connections.delete(clientId);
    }
    
    syncLogger.info('Broadcasted table changes', {
      organizationId: this.organizationId,
      tables: notification.tables,
      successCount,
      failureCount,
      cleanedUpConnections: deadConnections.length,
      activeConnections: this.connections.size
    }, MODULE_NAME);
  }
  
  /**
   * Handle WebSocket messages from clients
   */
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      const messageStr = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(messageStr);
      
      const connection = this.findConnectionBySocket(ws);
      if (!connection) {
        syncLogger.warn('Received message from unknown WebSocket connection', {}, MODULE_NAME);
        return;
      }
      
      syncLogger.debug('Received WebSocket message', {
        clientId: connection.clientId,
        messageType: data.type,
        organizationId: this.organizationId
      }, MODULE_NAME);
      
      // Handle different message types
      switch (data.type) {
        case 'ping':
          // Respond to ping with pong
          ws.send(JSON.stringify({
            type: 'pong',
            timestamp: Date.now()
          }));
          break;
          
        case 'clt_heartbeat':
          // Route heartbeat to WAL Replication DO and send response
          await this.handleClientHeartbeat(ws, data, connection);
          break;
          
        case 'heartbeat':
          // Legacy heartbeat support - acknowledge heartbeat
          ws.send(JSON.stringify({
            type: 'heartbeat_ack',
            timestamp: Date.now()
          }));
          break;
          
        default:
          syncLogger.debug('Unknown message type received', {
            type: data.type,
            clientId: connection.clientId
          }, MODULE_NAME);
      }
      
    } catch (error) {
      syncLogger.error('Error processing WebSocket message', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Handle client heartbeat messages with debounced WAL replication
   * Stage 1: Immediate client response
   * Stage 2: Debounced WAL Replication DO call
   */
  private async handleClientHeartbeat(ws: WebSocket, heartbeatData: any, connection: ClientConnection): Promise<void> {
    try {
      syncLogger.debug('Processing client heartbeat through Organization Actor', {
        clientId: connection.clientId,
        organizationId: this.organizationId,
        lsn: heartbeatData.lsn,
        state: heartbeatData.state,
        totalConnections: this.connections.size
      }, MODULE_NAME);

      // STAGE 1: Immediate response to client (no waiting)
      const response = {
        type: 'srv_heartbeat',
        clientId: connection.clientId,
        organizationId: this.organizationId,
        messageId: `hb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now()
      };

      ws.send(JSON.stringify(response));

      // STAGE 2: Debounced WAL replication activation
      this.ensureReplicationActiveDebounced();

      syncLogger.debug('Client heartbeat processed - immediate response sent, replication debounced', {
        clientId: connection.clientId,
        organizationId: this.organizationId,
        responseMessageId: response.messageId,
        replicationDebounceMs: this.replicationCallDebounceMs
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error processing client heartbeat', {
        clientId: connection.clientId,
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);

      // Still try to send a basic heartbeat response
      try {
        ws.send(JSON.stringify({
          type: 'srv_heartbeat',
          clientId: connection.clientId,
          messageId: `hb_err_${Date.now()}`,
          timestamp: Date.now(),
          error: 'Failed to process heartbeat'
        }));
      } catch (sendError) {
        syncLogger.error('Failed to send heartbeat error response', {
          clientId: connection.clientId,
          error: sendError instanceof Error ? sendError.message : String(sendError)
        }, MODULE_NAME);
      }
    }
  }

  /**
   * Debounced WAL replication activation
   * Only calls WAL Replication DO once per debounce period regardless of client heartbeat frequency
   */
  private ensureReplicationActiveDebounced(): void {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastReplicationCall;

    // If we called replication recently, just extend the debounce timer
    if (timeSinceLastCall < this.replicationCallDebounceMs) {
      // Clear any pending call and set a new one
      if (this.pendingReplicationCall) {
        clearTimeout(this.pendingReplicationCall);
      }

      const remainingTime = this.replicationCallDebounceMs - timeSinceLastCall;
      
      this.pendingReplicationCall = setTimeout(async () => {
        await this.ensureReplicationActive();
        this.pendingReplicationCall = null;
      }, remainingTime);

      syncLogger.debug('WAL replication call debounced', {
        organizationId: this.organizationId,
        timeSinceLastCall,
        remainingDebounceTime: remainingTime,
        totalConnections: this.connections.size
      }, MODULE_NAME);

      return;
    }

    // If enough time has passed, call immediately and update timestamp
    this.lastReplicationCall = now;
    
    // Clear any pending call since we're calling now
    if (this.pendingReplicationCall) {
      clearTimeout(this.pendingReplicationCall);
      this.pendingReplicationCall = null;
    }

    // Call replication asynchronously (don't block heartbeat response)
    this.ensureReplicationActive().catch(error => {
      syncLogger.error('Debounced replication activation failed', {
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    });

    syncLogger.info('WAL replication activated (debounced)', {
      organizationId: this.organizationId,
      timeSinceLastCall,
      debounceMs: this.replicationCallDebounceMs,
      totalConnections: this.connections.size
    }, MODULE_NAME);
  }

  /**
   * Ensure WAL replication is active by calling the WAL Replication DO
   */
  private async ensureReplicationActive(): Promise<void> {
    try {
      syncLogger.debug('Ensuring WAL replication is active', {
        organizationId: this.organizationId
      }, MODULE_NAME);
      
      // Get the ReplicationDO using the proper Durable Object pattern
      const replicationId = this.env.REPLICATION.idFromName('replication');
      const replicationStub = this.env.REPLICATION.get(replicationId);
      
      // Call the init endpoint directly on the ReplicationDO
      const response = await replicationStub.fetch('https://internal/api/replication/init');
      
      if (!response.ok) {
        const responseText = await response.text().catch(() => 'Unable to read response');
        syncLogger.error('Failed to ensure replication is active', {
          organizationId: this.organizationId,
          status: response.status,
          statusText: response.statusText,
          responseBody: responseText
        }, MODULE_NAME);
        throw new Error(`WAL replication activation failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      
      syncLogger.debug('WAL replication activation confirmed', {
        organizationId: this.organizationId,
        replicationActive: result.success || response.ok
      }, MODULE_NAME);

    } catch (error) {
      syncLogger.error('Error ensuring replication is active', {
        organizationId: this.organizationId,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      throw error;
    }
  }
  
  /**
   * Handle WebSocket closure
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const connection = this.findConnectionBySocket(ws);
    
    if (connection) {
      this.connections.delete(connection.clientId);
      
      syncLogger.info('Client disconnected from Organization Actor', {
        organizationId: this.organizationId,
        userId: connection.userId,
        clientId: connection.clientId,
        code,
        reason: reason || 'No reason provided',
        wasClean,
        remainingConnections: this.connections.size
      }, MODULE_NAME);
    } else {
      syncLogger.warn('WebSocket closed but connection not found', {
        code,
        reason,
        wasClean
      }, MODULE_NAME);
    }
  }
  
  /**
   * Handle WebSocket errors
   */
  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    const connection = this.findConnectionBySocket(ws);
    
    syncLogger.error('WebSocket error', {
      organizationId: this.organizationId,
      clientId: connection?.clientId || 'unknown',
      userId: connection?.userId || 'unknown',
      error: error.message,
      stack: error.stack
    }, MODULE_NAME);
    
    // Clean up the connection
    if (connection) {
      this.connections.delete(connection.clientId);
    }
  }
  
  /**
   * Get actor status
   */
  getStatus(): Response {
    const status = {
      organizationId: this.organizationId,
      activeConnections: this.connections.size,
      connections: Array.from(this.connections.values()).map(conn => ({
        clientId: conn.clientId,
        userId: conn.userId,
        connectedAt: conn.connectedAt,
        socketState: conn.socket.readyState
      })),
      uptime: Date.now() - (this.state.storage ? 0 : Date.now()), // Simplified uptime
      actorType: 'OrganizationActor'
    };
    
    return new Response(JSON.stringify(status, null, 2), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  /**
   * Find connection by WebSocket instance
   */
  private findConnectionBySocket(ws: WebSocket): ClientConnection | null {
    for (const connection of this.connections.values()) {
      if (connection.socket === ws) {
        return connection;
      }
    }
    return null;
  }
  
  /**
   * Extract organization ID from Actor ID
   */
  private extractOrgIdFromActorId(actorId: string): string {
    // Actor ID format: "org:{organizationId}"
    if (actorId.startsWith('org:')) {
      return actorId.substring(4);
    }
    
    // Fallback - use the full actor ID
    return actorId;
  }
}