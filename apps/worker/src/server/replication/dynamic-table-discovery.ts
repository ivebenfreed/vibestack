/**
 * Dynamic Table Discovery for Multi-Organization Replication
 * 
 * Replaces build-time constants with runtime discovery of trackable tables.
 * Supports organization-specific tables created dynamically through OrganizationActor.
 */

import { replicationLogger } from '../middleware/logger';
import type { Kysely } from 'kysely';
import type { Database } from '@repo/dataforge/kysely-types';

const MODULE_NAME = 'dynamic-table-discovery';

// Base system tables (always tracked)
const BASE_TRACKED_TABLES = [
  'users',
  'organization', 
  'organization_member',
  'session',
  'account',
  'verification',
  'entity_schemas'  // Track schema changes for real-time UI updates
];

// System tables (never tracked)
const SYSTEM_TABLES = [
  'change_history',
  'sync_statistics', 
  'system_logs',
  'replication_slot_status',
  'pg_*',
  'information_schema*'
];

interface TrackableTableInfo {
  tableName: string;
  organizationId?: string;
  entityName?: string;
  isBaseTable: boolean;
  isOrgSpecific: boolean;
}

export class DynamicTableDiscovery {
  private static readonly KV_PREFIX = 'trackable_tables:';
  private static readonly KV_EXPIRY = 5 * 60; // 5 minutes in seconds

  constructor(
    private db: Kysely<Database>,
    private env: any
  ) {}

  /**
   * Get all trackable tables (base + org-specific) from KV cache
   */
  async getTrackableTables(): Promise<string[]> {
    const tables = await this.getTrackableTablesFromKV();
    return tables.map(t => t.tableName);
  }

  /**
   * Get trackable tables for a specific organization
   */
  async getOrgTrackableTables(organizationId: string): Promise<string[]> {
    const tables = await this.getTrackableTablesFromKV();
    
    return tables
      .filter(t => 
        t.isBaseTable || // Always include base tables
        (t.isOrgSpecific && t.organizationId === organizationId) // Include org-specific tables
      )
      .map(t => t.tableName);
  }

  /**
   * Check if a table should be tracked by replication (optimized KV lookup)
   */
  async isTrackableTable(tableName: string): Promise<boolean> {
    try {
      // Fast path: Check KV for specific table
      const kvKey = `${DynamicTableDiscovery.KV_PREFIX}table:${tableName}`;
      const isTrackable = await this.env.CLIENT_REGISTRY.get(kvKey);
      
      if (isTrackable !== null) {
        return isTrackable === 'true';
      }

      // Slow path: Get all tables and cache result
      const tables = await this.getTrackableTables();
      const trackable = tables.includes(tableName);
      
      // Cache the result for future lookups
      await this.env.CLIENT_REGISTRY.put(kvKey, trackable ? 'true' : 'false', {
        expirationTtl: DynamicTableDiscovery.KV_EXPIRY
      });
      
      return trackable;
    } catch (error) {
      replicationLogger.error('Failed KV table lookup', {
        tableName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Fallback to heuristics
      return this.isTrackableByPattern(tableName);
    }
  }

  /**
   * Get trackable tables from KV cache or discover from database
   */
  private async getTrackableTablesFromKV(): Promise<TrackableTableInfo[]> {
    try {
      // Try to get from KV cache first
      const kvKey = `${DynamicTableDiscovery.KV_PREFIX}all_tables`;
      const cachedData = await this.env.CLIENT_REGISTRY.get(kvKey);
      
      if (cachedData) {
        const tables: TrackableTableInfo[] = JSON.parse(cachedData);
        replicationLogger.debug('Retrieved trackable tables from KV cache', {
          tableCount: tables.length
        }, MODULE_NAME);
        return tables;
      }

      // Cache miss - discover from database
      return await this.discoverAndCacheTrackableTables();
    } catch (error) {
      replicationLogger.error('Failed to get trackable tables from KV', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Fallback to direct database discovery
      return await this.discoverTrackableTablesFromDB();
    }
  }

  /**
   * Discover trackable tables from database and cache in KV
   */
  private async discoverAndCacheTrackableTables(): Promise<TrackableTableInfo[]> {
    const tables = await this.discoverTrackableTablesFromDB();
    
    try {
      // Cache in KV for future lookups
      const kvKey = `${DynamicTableDiscovery.KV_PREFIX}all_tables`;
      await this.env.CLIENT_REGISTRY.put(kvKey, JSON.stringify(tables), {
        expirationTtl: DynamicTableDiscovery.KV_EXPIRY
      });
      
      replicationLogger.info('Cached trackable tables in KV', {
        tableCount: tables.length
      }, MODULE_NAME);
    } catch (kvError) {
      replicationLogger.warn('Failed to cache tables in KV', {
        error: kvError instanceof Error ? kvError.message : String(kvError)
      }, MODULE_NAME);
    }
    
    return tables;
  }

  /**
   * Dynamically discover all trackable tables from database
   */
  private async discoverTrackableTablesFromDB(): Promise<TrackableTableInfo[]> {

    try {
      replicationLogger.info('Starting dynamic table discovery', {}, MODULE_NAME);

      const discoveredTables: TrackableTableInfo[] = [];

      // 1. Add base tracked tables
      for (const tableName of BASE_TRACKED_TABLES) {
        discoveredTables.push({
          tableName,
          isBaseTable: true,
          isOrgSpecific: false
        });
      }

      // 2. Discover organization-specific tables from database
      const orgTables = await this.discoverOrgTables();
      discoveredTables.push(...orgTables);

      // 3. Cache results
      this.cachedTables = discoveredTables;
      this.lastDiscovery = new Date();

      replicationLogger.info('Dynamic table discovery completed', {
        totalTables: discoveredTables.length,
        baseTables: discoveredTables.filter(t => t.isBaseTable).length,
        orgTables: discoveredTables.filter(t => t.isOrgSpecific).length,
        tableNames: discoveredTables.map(t => t.tableName).join(', ')
      }, MODULE_NAME);

      return discoveredTables;

    } catch (error) {
      replicationLogger.error('Failed to discover trackable tables', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      
      // Return cached tables or base tables as fallback
      return this.cachedTables.length > 0 
        ? this.cachedTables 
        : BASE_TRACKED_TABLES.map(tableName => ({
            tableName,
            isBaseTable: true,
            isOrgSpecific: false
          }));
    }
  }

  /**
   * Discover organization-specific tables from database schema
   */
  private async discoverOrgTables(): Promise<TrackableTableInfo[]> {
    try {
      // Query information_schema to find org-prefixed tables
      const orgTablesQuery = `
        SELECT table_name, table_schema
        FROM information_schema.tables 
        WHERE table_schema = 'public'
          AND table_type = 'BASE TABLE'
          AND table_name ~ '^org_[a-fA-F0-9\\-]+_[a-zA-Z_][a-zA-Z0-9_]*$'
          AND table_name NOT LIKE '%_backup'
          AND table_name NOT LIKE '%_temp'
        ORDER BY table_name
      `;

      const result = await this.db.executeQuery({
        sql: orgTablesQuery,
        parameters: []
      });

      const orgTables: TrackableTableInfo[] = [];

      for (const row of result.rows) {
        const tableName = row.table_name as string;
        
        // Extract organization ID and entity name from table name
        // Format: org_{organizationId}_{entityName}
        const match = tableName.match(/^org_([a-fA-F0-9\-]+)_(.+)$/);
        if (match) {
          const [, organizationId, entityName] = match;
          
          // Skip system/internal tables
          if (this.isSystemTable(tableName)) {
            continue;
          }

          orgTables.push({
            tableName,
            organizationId,
            entityName,
            isBaseTable: false,
            isOrgSpecific: true
          });
        }
      }

      replicationLogger.debug('Discovered organization tables', {
        count: orgTables.length,
        tables: orgTables.map(t => `${t.tableName} (org: ${t.organizationId}, entity: ${t.entityName})`).join(', ')
      }, MODULE_NAME);

      return orgTables;

    } catch (error) {
      replicationLogger.error('Failed to discover organization tables', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
      return [];
    }
  }

  /**
   * Check if a table is a system table that should not be tracked
   */
  private isSystemTable(tableName: string): boolean {
    return SYSTEM_TABLES.some(pattern => {
      if (pattern.endsWith('*')) {
        return tableName.startsWith(pattern.slice(0, -1));
      }
      return tableName === pattern;
    });
  }

  /**
   * Pattern-based fallback for table tracking (when KV/DB unavailable)
   */
  private isTrackableByPattern(tableName: string): boolean {
    const normalizedTableName = tableName.replace(/"/g, '');
    
    // System tables - never track
    const systemTables = ['change_history', 'sync_statistics', 'system_logs', 'replication_slot_status'];
    if (systemTables.includes(normalizedTableName) || normalizedTableName.startsWith('pg_')) {
      return false;
    }
    
    // Base tables - always track
    if (BASE_TRACKED_TABLES.includes(normalizedTableName)) {
      return true;
    }
    
    // Organization-specific tables - track if matches pattern
    return normalizedTableName.match(/^org_[a-fA-F0-9\-]+_[a-zA-Z_][a-zA-Z0-9_]*$/) !== null;
  }

  /**
   * Register a new organization table in KV (called when OrganizationActor creates new entities)
   */
  async registerOrgTable(tableName: string, organizationId: string, entityName: string): Promise<void> {
    try {
      // Add to individual table cache
      const tableKvKey = `${DynamicTableDiscovery.KV_PREFIX}table:${tableName}`;
      await this.env.CLIENT_REGISTRY.put(tableKvKey, 'true', {
        expirationTtl: DynamicTableDiscovery.KV_EXPIRY
      });

      // Invalidate the full tables cache to force refresh
      const allTablesKey = `${DynamicTableDiscovery.KV_PREFIX}all_tables`;
      await this.env.CLIENT_REGISTRY.delete(allTablesKey);

      replicationLogger.info('Registered new organization table', {
        tableName,
        organizationId,
        entityName
      }, MODULE_NAME);
    } catch (error) {
      replicationLogger.error('Failed to register organization table', {
        tableName,
        organizationId,
        entityName,
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Invalidate KV cache (force rediscovery on next call)
   */
  async invalidateCache(): Promise<void> {
    try {
      const allTablesKey = `${DynamicTableDiscovery.KV_PREFIX}all_tables`;
      await this.env.CLIENT_REGISTRY.delete(allTablesKey);
      replicationLogger.info('Table discovery KV cache invalidated', {}, MODULE_NAME);
    } catch (error) {
      replicationLogger.warn('Failed to invalidate table discovery cache', {
        error: error instanceof Error ? error.message : String(error)
      }, MODULE_NAME);
    }
  }

  /**
   * Get discovery statistics
   */
  getDiscoveryStats(): {
    totalTables: number;
    baseTables: number;
    orgTables: number;
    lastDiscovery: string | null;
    cacheAge: number;
  } {
    const cacheAge = this.lastDiscovery ? Date.now() - this.lastDiscovery.getTime() : 0;

    return {
      totalTables: this.cachedTables.length,
      baseTables: this.cachedTables.filter(t => t.isBaseTable).length,
      orgTables: this.cachedTables.filter(t => t.isOrgSpecific).length,
      lastDiscovery: this.lastDiscovery?.toISOString() || null,
      cacheAge
    };
  }
}