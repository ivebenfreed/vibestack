/**
 * Organization Operations Durable Object (OrgOpsDO)
 * 
 * Consolidated per-organization DO that combines:
 * - Schema operations (from OrgSchemaDO)
 * - Admin operations (from OrgAdminDO) 
 * - Permission graph cache (NEW)
 * 
 * Single DO per organization for all operations with high-performance
 * permission validation for sync operations.
 */

import { Actor } from '@cloudflare/actors';
import type { OrgSchema, OrgEntityDefinition } from '../json-schema/org-entity-schema';
import type { EntityConfig } from '../rules/json-rules-engine';
import { FoundationEntityRegistry } from '../entities/foundation/index';
import type { FieldDefinition } from '../rules/json-rules-engine';
import { DynamicTableDiscovery } from '../../replication/dynamic-table-discovery';

// === Schema Operations Types (from OrgSchemaDO) ===
export interface ArchetypeRequest {
  orgId: string;
  archetype: string;
  tableName: string;
  fieldDefinitions: Record<string, FieldDefinition>;
}

export interface ArchetypeResponse {
  success: boolean;
  ddl?: string;
  errors?: string[];
}

// === Admin Operations Types (from OrgAdminDO) ===
export interface CachedMember {
  id: string;
  userId: string;
  role: 'admin' | 'member' | 'viewer';
  status: 'active' | 'suspended' | 'pending';
  joinedAt: string;
  lastActiveAt?: string;
  permissions?: string[];
}

export interface CachedOrganization {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  status: 'active' | 'suspended' | 'deleted';
  planType: 'free' | 'pro' | 'enterprise';
  settings: any;
  lastSyncAt: string;
}

export interface AccessControlCache {
  organization: CachedOrganization;
  members: Record<string, CachedMember>; // userId -> member
  lastSyncAt: string;
  version: number;
}

// === NEW: Permission Graph Types ===
export interface SyncPermissions {
  'entities:read': Set<string>;    // Set of entity names user can read
  'entities:write': Set<string>;   // Set of entity names user can write  
  'sync:subscribe': boolean;       // Can establish sync connection
  'sync:broadcast': boolean;       // Can trigger broadcasts to others
}

export interface UserPermissionNode {
  userId: string;
  organizationId: string;
  role: string;
  permissions: SyncPermissions;
  containerAccess: Map<string, string>; // containerId -> permission level
  lastUpdated: Date;
}

export interface PermissionGraphCache {
  permissionGraph: Map<string, UserPermissionNode>; // userId -> permissions
  entityAccessMatrix: Map<string, Set<string>>; // entityName -> userIds with access
  lastSync: Date;
  version: number;
}

// === Sync Operation Types ===
export interface SyncAccessRequest {
  userId: string;
  entityName: string;
  action: 'read' | 'write';
  userRole?: string;
}

export interface SyncAccessResult {
  hasAccess: boolean;
  reason?: string;
  permissions?: SyncPermissions;
}

export interface AuthorizedUsersRequest {
  entityName: string;
  action: 'read' | 'write';
}

export interface AuthorizedUsersResult {
  authorizedUsers: string[];
  entityName: string;
  action: string;
}

export class OrgOpsDO extends Actor<any> {
  private orgId: string = '';
  
  // In-memory caches for high-performance operations
  private accessControlCache: AccessControlCache | null = null;
  private permissionGraphCache: PermissionGraphCache | null = null;
  
  constructor(ctx: any, env: any) {
    super(ctx, env);
    
    // Extract org ID from DO name
    this.orgId = ctx.id?.toString() || 'unknown';
    
    // Consolidated storage schema
    this.storage.migrations = [
      {
        idMonotonicInc: 1,
        description: 'Create consolidated org operations storage',
        sql: `
          -- Schema operations storage (from OrgSchemaDO)
          CREATE TABLE IF NOT EXISTS entity_configs (
            entity_name TEXT PRIMARY KEY,
            config TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS org_schema (
            id INTEGER PRIMARY KEY DEFAULT 1,
            schema_data TEXT NOT NULL,
            version TEXT DEFAULT '1.0.0',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          -- Admin operations storage (from OrgAdminDO)
          CREATE TABLE IF NOT EXISTS access_cache (
            id INTEGER PRIMARY KEY DEFAULT 1,
            organization_data TEXT NOT NULL,
            members_data TEXT NOT NULL,
            last_sync_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            version INTEGER DEFAULT 1
          );
          
          -- NEW: Permission graph storage
          CREATE TABLE IF NOT EXISTS permission_graph (
            user_id TEXT PRIMARY KEY,
            permission_data TEXT NOT NULL,
            role TEXT NOT NULL,
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
          
          CREATE TABLE IF NOT EXISTS entity_access_matrix (
            entity_name TEXT PRIMARY KEY,
            authorized_users TEXT NOT NULL, -- JSON array of user IDs
            last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      }
    ];
  }

  /**
   * Initialize storage and load caches
   */
  private async ensureInitialized(): Promise<void> {
    try {
      // Check if tables exist and create them if needed
      await this.storage.sql`SELECT 1 FROM org_schema LIMIT 1`;
    } catch (error) {
      // Tables don't exist, run migrations
      console.log(`[OrgOpsDO] Initializing storage for org: ${this.orgId}`);
      // Actor framework will handle migrations automatically
    }

    // Load caches if not already loaded
    if (!this.accessControlCache) {
      await this.loadAccessControlCache();
    }
    
    if (!this.permissionGraphCache) {
      await this.loadPermissionGraphCache();
    }
  }

  // ===== SCHEMA OPERATIONS (from OrgSchemaDO) =====

  /**
   * Create archetype entity schema (from OrgSchemaDO)
   */
  async createArchetype(request: ArchetypeRequest): Promise<ArchetypeResponse> {
    await this.ensureInitialized();
    
    try {
      const { orgId, archetype, tableName, fieldDefinitions } = request;
      
      // Validate archetype
      if (!FoundationEntityRegistry.isValidArchetypePattern(archetype)) {
        return {
          success: false,
          errors: [`Invalid archetype: ${archetype}`]
        };
      }

      // Get archetype pattern class for DDL generation
      const ArchetypeClass = FoundationEntityRegistry.getArchetypePatternClass(archetype);
      if (!ArchetypeClass) {
        return {
          success: false,
          errors: [`Archetype pattern class not found: ${archetype}`]
        };
      }

      // Generate DDL for PostgreSQL
      const fullTableName = `${orgId}_${tableName}`;
      const ddlStatements: string[] = [];

      // Create main table with base archetype fields
      const baseFields = (ArchetypeClass as any).fields || {};
      let createTableSQL = `CREATE TABLE IF NOT EXISTS "${fullTableName}" (\n`;
      
      const allColumns: string[] = [];
      
      // Add base archetype columns
      if (baseFields) {
        for (const [fieldName, fieldDef] of Object.entries(baseFields)) {
          const columnSQL = this.generateColumnSQL(fieldName, fieldDef as FieldDefinition);
          allColumns.push(`  ${columnSQL}`);
        }
      }
      
      // Add custom fields
      for (const [fieldName, fieldDef] of Object.entries(fieldDefinitions)) {
        const columnSQL = this.generateColumnSQL(fieldName, fieldDef);
        allColumns.push(`  ${columnSQL}`);
      }
      
      createTableSQL += allColumns.join(',\n');
      createTableSQL += '\n);';
      
      ddlStatements.push(createTableSQL);

      // Store entity configuration
      const entityConfig: OrgEntityDefinition = {
        tableName,
        extends: archetype as any,
        customFields: fieldDefinitions,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.storage.sql`
        INSERT OR REPLACE INTO entity_configs (entity_name, config, updated_at)
        VALUES (${tableName}, ${JSON.stringify(entityConfig)}, CURRENT_TIMESTAMP)
      `;

      // Update org schema
      await this.updateOrgSchema(tableName, entityConfig);

      // Register the new table with dynamic table discovery
      try {
        const tableDiscovery = new DynamicTableDiscovery(null as any, this.env); // DB not needed for registration
        await tableDiscovery.registerOrgTable(fullTableName, orgId, tableName);
      } catch (error) {
        console.warn(`[OrgOpsDO] Failed to register table with discovery:`, error);
        // Don't fail the whole operation for this
      }

      console.log(`[OrgOpsDO] Created archetype: ${archetype} -> ${fullTableName}`);

      return {
        success: true,
        ddl: ddlStatements.join(';\n') + ';'
      };

    } catch (error) {
      console.error(`[OrgOpsDO] Failed to create archetype:`, error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  /**
   * Clear temporary schema data after successful migration
   */
  async clearTempSchemaForEntity(entityName: string): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      // Remove entity config from temporary storage
      await this.storage.sql`DELETE FROM entity_configs WHERE entity_name = ${entityName}`;
      
      // Remove entity from org schema if it exists
      const orgSchemaResult = await this.storage.sql`SELECT schema_data FROM org_schema WHERE id = 1`;
      
      if (orgSchemaResult.length > 0) {
        const orgSchema = JSON.parse(orgSchemaResult[0].schema_data as string);
        
        if (orgSchema.entities && orgSchema.entities[entityName]) {
          delete orgSchema.entities[entityName];
          orgSchema.updatedAt = new Date().toISOString();
          
          await this.storage.sql`
            UPDATE org_schema 
            SET schema_data = ${JSON.stringify(orgSchema)},
                updated_at = CURRENT_TIMESTAMP 
            WHERE id = 1
          `;
        }
      }
      
      console.log(`[OrgOpsDO] Cleared temp schema data for entity: ${entityName}`);
      return { success: true };
    } catch (error) {
      console.error(`[OrgOpsDO] Failed to clear temp schema for ${entityName}:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to clear temp schema' 
      };
    }
  }

  // ===== ADMIN OPERATIONS (from OrgAdminDO) =====

  /**
   * Check user access with cached lookup (from OrgAdminDO)
   */
  async checkAccess(userId: string): Promise<{
    hasAccess: boolean;
    member?: CachedMember;
    permissions?: string[];
    needsSync?: boolean;
  }> {
    await this.ensureInitialized();
    
    if (!this.accessControlCache) {
      return { hasAccess: false, needsSync: true };
    }

    const member = this.accessControlCache.members[userId];
    
    if (!member) {
      return { hasAccess: false, needsSync: true };
    }

    // Check if cache is stale (older than 5 minutes)
    const cacheAge = Date.now() - new Date(this.accessControlCache.lastSyncAt).getTime();
    const needsSync = cacheAge > 5 * 60 * 1000; // 5 minutes

    return {
      hasAccess: member.status === 'active',
      member,
      permissions: member.permissions,
      needsSync
    };
  }

  /**
   * Sync access control data from PostgreSQL (from OrgAdminDO)
   */
  async syncAccessControl(orgData: {
    organization: CachedOrganization;
    members: CachedMember[];
  }): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      // Convert members array to userId -> member map
      const membersMap: Record<string, CachedMember> = {};
      for (const member of orgData.members) {
        membersMap[member.userId] = member;
      }

      const accessCache: AccessControlCache = {
        organization: orgData.organization,
        members: membersMap,
        lastSyncAt: new Date().toISOString(),
        version: (this.accessControlCache?.version || 0) + 1
      };

      // Store in database
      await this.storage.sql`
        INSERT OR REPLACE INTO access_cache 
        (organization_data, members_data, last_sync_at, version)
        VALUES (
          ${JSON.stringify(orgData.organization)},
          ${JSON.stringify(membersMap)},
          CURRENT_TIMESTAMP,
          ${accessCache.version}
        )
      `;

      // Update in-memory cache
      this.accessControlCache = accessCache;

      // Sync permission graph when access control changes
      await this.syncPermissionGraph();

      console.log(`[OrgOpsDO] Access control synced for org ${this.orgId}: ${orgData.members.length} members`);

      return { success: true };
    } catch (error) {
      console.error(`[OrgOpsDO] Failed to sync access control:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Sync failed' 
      };
    }
  }

  // ===== NEW: PERMISSION GRAPH OPERATIONS =====

  /**
   * Validate sync access with fast permission lookup
   */
  async validateSyncAccess(request: SyncAccessRequest): Promise<SyncAccessResult> {
    await this.ensureInitialized();
    
    try {
      const { userId, entityName, action, userRole } = request;

      // Check if user has access to organization first
      const accessCheck = await this.checkAccess(userId);
      if (!accessCheck.hasAccess) {
        return {
          hasAccess: false,
          reason: 'User does not have access to organization'
        };
      }

      // Use permission graph for fast entity-level validation
      if (this.permissionGraphCache?.permissionGraph.has(userId)) {
        const userPermissions = this.permissionGraphCache.permissionGraph.get(userId)!;
        
        const entitySet = action === 'read' 
          ? userPermissions.permissions['entities:read']
          : userPermissions.permissions['entities:write'];

        const hasAccess = entitySet.has(entityName) || entitySet.has('*'); // '*' for admin access

        return {
          hasAccess,
          permissions: userPermissions.permissions,
          reason: hasAccess ? undefined : `No ${action} access to entity: ${entityName}`
        };
      }

      // Fallback to role-based access if permission graph not available
      const role = userRole || accessCheck.member?.role || 'viewer';
      const hasAccess = this.validateRoleBasedAccess(role, action);

      return {
        hasAccess,
        reason: hasAccess ? undefined : `Role '${role}' does not permit ${action} access`
      };

    } catch (error) {
      console.error(`[OrgOpsDO] Failed to validate sync access:`, error);
      return {
        hasAccess: false,
        reason: `Access validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get authorized users for entity broadcasting
   */
  async getAuthorizedUsers(request: AuthorizedUsersRequest): Promise<AuthorizedUsersResult> {
    await this.ensureInitialized();
    
    try {
      const { entityName, action } = request;

      // Use cached entity access matrix for fast lookup
      if (this.permissionGraphCache?.entityAccessMatrix.has(entityName)) {
        const authorizedUserSet = this.permissionGraphCache.entityAccessMatrix.get(entityName)!;
        
        // Filter by action if needed (for now, return all - future enhancement)
        const authorizedUsers = Array.from(authorizedUserSet);

        return {
          authorizedUsers,
          entityName,
          action
        };
      }

      // Fallback: return all active members (less efficient but safe)
      const allAuthorizedUsers: string[] = [];
      if (this.accessControlCache) {
        for (const [userId, member] of Object.entries(this.accessControlCache.members)) {
          if (member.status === 'active') {
            // Basic role-based filtering
            if (action === 'read' || member.role === 'admin' || member.role === 'member') {
              allAuthorizedUsers.push(userId);
            }
          }
        }
      }

      return {
        authorizedUsers: allAuthorizedUsers,
        entityName: request.entityName,
        action: request.action
      };

    } catch (error) {
      console.error(`[OrgOpsDO] Failed to get authorized users:`, error);
      return {
        authorizedUsers: [],
        entityName: request.entityName,
        action: request.action
      };
    }
  }

  /**
   * Sync permission graph from container permissions
   */
  async syncPermissionGraph(): Promise<{ success: boolean; error?: string }> {
    await this.ensureInitialized();
    
    try {
      if (!this.accessControlCache) {
        return { success: false, error: 'Access control cache not available' };
      }

      const permissionGraph = new Map<string, UserPermissionNode>();
      const entityAccessMatrix = new Map<string, Set<string>>();

      // Build permission graph for each member
      for (const [userId, member] of Object.entries(this.accessControlCache.members)) {
        if (member.status !== 'active') continue;

        // Create user permission node
        const userPermissions: SyncPermissions = {
          'entities:read': new Set(),
          'entities:write': new Set(),
          'sync:subscribe': true, // All active members can subscribe
          'sync:broadcast': member.role === 'admin' || member.role === 'member'
        };

        // Role-based entity access (simplified - future: integrate with ContainerPermission)
        switch (member.role) {
          case 'admin':
            userPermissions['entities:read'].add('*'); // Admin can read all
            userPermissions['entities:write'].add('*'); // Admin can write all
            break;
          case 'member':
            // Members can read/write most entities (future: container-based filtering)
            userPermissions['entities:read'].add('*');
            userPermissions['entities:write'].add('*');
            break;
          case 'viewer':
            // Viewers can only read (future: container-based filtering)
            userPermissions['entities:read'].add('*');
            break;
        }

        const permissionNode: UserPermissionNode = {
          userId,
          organizationId: this.orgId,
          role: member.role,
          permissions: userPermissions,
          containerAccess: new Map(), // Future: populate from ContainerPermission
          lastUpdated: new Date()
        };

        permissionGraph.set(userId, permissionNode);

        // Build entity access matrix (reverse lookup)
        const readEntities = Array.from(userPermissions['entities:read']);
        const writeEntities = Array.from(userPermissions['entities:write']);
        
        for (const entityName of [...readEntities, ...writeEntities]) {
          if (!entityAccessMatrix.has(entityName)) {
            entityAccessMatrix.set(entityName, new Set());
          }
          entityAccessMatrix.get(entityName)!.add(userId);
        }
      }

      // Update permission graph cache
      this.permissionGraphCache = {
        permissionGraph,
        entityAccessMatrix,
        lastSync: new Date(),
        version: (this.permissionGraphCache?.version || 0) + 1
      };

      // Persist permission graph to storage
      await this.persistPermissionGraph();

      console.log(`[OrgOpsDO] Permission graph synced for org ${this.orgId}: ${permissionGraph.size} users, ${entityAccessMatrix.size} entities`);

      return { success: true };
    } catch (error) {
      console.error(`[OrgOpsDO] Failed to sync permission graph:`, error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Permission graph sync failed' 
      };
    }
  }

  // ===== HTTP ENDPOINT HANDLERS =====

  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();
    
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Schema operations endpoints
      if (path === '/create-archetype' && request.method === 'POST') {
        const requestData = await request.json();
        const result = await this.createArchetype(requestData);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path.startsWith('/clear-temp-schema/') && request.method === 'DELETE') {
        const entityName = path.split('/clear-temp-schema/')[1];
        const result = await this.clearTempSchemaForEntity(entityName);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Admin operations endpoints  
      if (path.startsWith('/access/') && request.method === 'GET') {
        const userId = path.split('/access/')[1];
        const result = await this.checkAccess(userId);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path === '/sync' && request.method === 'POST') {
        const syncData = await request.json();
        const result = await this.syncAccessControl(syncData);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // NEW: Permission graph endpoints
      if (path === '/validate-sync-access' && request.method === 'POST') {
        const requestData = await request.json();
        const result = await this.validateSyncAccess(requestData);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path === '/authorized-users' && request.method === 'POST') {
        const requestData = await request.json();
        const result = await this.getAuthorizedUsers(requestData);
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (path === '/sync-permissions' && request.method === 'POST') {
        const result = await this.syncPermissionGraph();
        return new Response(JSON.stringify(result), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response('Not found', { status: 404 });

    } catch (error) {
      console.error(`[OrgOpsDO] Request handler error:`, error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // ===== PRIVATE HELPER METHODS =====

  private generateColumnSQL(fieldName: string, fieldDef: FieldDefinition): string {
    let sqlType = '';
    
    switch (fieldDef.type) {
      case 'text':
      case 'longtext':
        sqlType = 'TEXT';
        break;
      case 'number':
      case 'decimal':
        sqlType = 'NUMERIC';
        break;
      case 'integer':
        sqlType = 'INTEGER';
        break;
      case 'boolean':
        sqlType = 'BOOLEAN';
        break;
      case 'date':
      case 'datetime':
        sqlType = 'TIMESTAMPTZ';
        break;
      case 'json':
        sqlType = 'JSONB';
        break;
      default:
        sqlType = 'TEXT';
    }
    
    const nullable = fieldDef.required ? 'NOT NULL' : 'NULL';
    return `"${fieldName}" ${sqlType} ${nullable}`;
  }

  private async updateOrgSchema(entityName: string, config: OrgEntityDefinition): Promise<void> {
    // Get existing schema or create new one
    const existingResult = await this.storage.sql`SELECT schema_data FROM org_schema WHERE id = 1`;
    
    let orgSchema: OrgSchema;
    
    if (existingResult.length > 0) {
      orgSchema = JSON.parse(existingResult[0].schema_data as string);
    } else {
      orgSchema = {
        orgId: this.orgId,
        version: '1.0.0',
        entities: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
    
    // Update schema with new entity
    orgSchema.entities[entityName] = config;
    orgSchema.updatedAt = new Date().toISOString();
    
    // Save updated schema
    await this.storage.sql`
      INSERT OR REPLACE INTO org_schema (id, schema_data, updated_at)
      VALUES (1, ${JSON.stringify(orgSchema)}, CURRENT_TIMESTAMP)
    `;
  }

  private async loadAccessControlCache(): Promise<void> {
    try {
      const result = await this.storage.sql`
        SELECT organization_data, members_data, last_sync_at, version 
        FROM access_cache 
        WHERE id = 1
      `;
      
      if (result.length > 0) {
        const row = result[0];
        this.accessControlCache = {
          organization: JSON.parse(row.organization_data as string),
          members: JSON.parse(row.members_data as string),
          lastSyncAt: row.last_sync_at as string,
          version: row.version as number
        };
        
        console.log(`[OrgOpsDO] Loaded access control cache for org ${this.orgId}`);
      }
    } catch (error) {
      console.log(`[OrgOpsDO] No existing access control cache for org ${this.orgId}`);
    }
  }

  private async loadPermissionGraphCache(): Promise<void> {
    try {
      const graphResult = await this.storage.sql`SELECT user_id, permission_data FROM permission_graph`;
      const matrixResult = await this.storage.sql`SELECT entity_name, authorized_users FROM entity_access_matrix`;
      
      if (graphResult.length > 0) {
        const permissionGraph = new Map<string, UserPermissionNode>();
        const entityAccessMatrix = new Map<string, Set<string>>();
        
        // Load permission graph
        for (const row of graphResult) {
          const permissionData = JSON.parse(row.permission_data as string);
          // Convert serialized Sets back to actual Sets
          permissionData.permissions['entities:read'] = new Set(permissionData.permissions['entities:read']);
          permissionData.permissions['entities:write'] = new Set(permissionData.permissions['entities:write']);
          permissionGraph.set(row.user_id as string, permissionData);
        }
        
        // Load entity access matrix
        for (const row of matrixResult) {
          const authorizedUsers = JSON.parse(row.authorized_users as string);
          entityAccessMatrix.set(row.entity_name as string, new Set(authorizedUsers));
        }
        
        this.permissionGraphCache = {
          permissionGraph,
          entityAccessMatrix,
          lastSync: new Date(),
          version: 1
        };
        
        console.log(`[OrgOpsDO] Loaded permission graph cache for org ${this.orgId}: ${permissionGraph.size} users`);
      }
    } catch (error) {
      console.log(`[OrgOpsDO] No existing permission graph cache for org ${this.orgId}`);
    }
  }

  private async persistPermissionGraph(): Promise<void> {
    if (!this.permissionGraphCache) return;
    
    // Clear existing data
    await this.storage.sql`DELETE FROM permission_graph`;
    await this.storage.sql`DELETE FROM entity_access_matrix`;
    
    // Persist permission graph
    for (const [userId, permissionNode] of Array.from(this.permissionGraphCache.permissionGraph.entries())) {
      // Convert Sets to arrays for serialization
      const serializableNode = {
        ...permissionNode,
        permissions: {
          ...permissionNode.permissions,
          'entities:read': Array.from(permissionNode.permissions['entities:read']),
          'entities:write': Array.from(permissionNode.permissions['entities:write'])
        }
      };
      
      await this.storage.sql`
        INSERT INTO permission_graph (user_id, permission_data, role, last_updated)
        VALUES (${userId}, ${JSON.stringify(serializableNode)}, ${permissionNode.role}, CURRENT_TIMESTAMP)
      `;
    }
    
    // Persist entity access matrix
    for (const [entityName, userSet] of Array.from(this.permissionGraphCache.entityAccessMatrix.entries())) {
      await this.storage.sql`
        INSERT INTO entity_access_matrix (entity_name, authorized_users, last_updated)
        VALUES (${entityName}, ${JSON.stringify(Array.from(userSet))}, CURRENT_TIMESTAMP)
      `;
    }
  }

  private validateRoleBasedAccess(role: string, action: 'read' | 'write'): boolean {
    switch (role) {
      case 'admin':
        return true; // Admin can read/write everything
      case 'member':
        return true; // Members can read/write (refined by container permissions)
      case 'viewer':
        return action === 'read'; // Viewers can only read
      default:
        return false;
    }
  }
}