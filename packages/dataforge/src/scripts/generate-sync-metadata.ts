#!/usr/bin/env tsx
/**
 * Generate sync metadata from MikroORM entities
 * Creates a metadata file that the generic sync engine can use
 */

import { MikroORM } from '@mikro-orm/postgresql';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mikroOrmConfig from '../mikro-orm.config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function extractSyncMetadata() {
  const orm = await MikroORM.init({
    ...mikroOrmConfig,
    connect: false,
  });

  const metadata = orm.getMetadata();
  const syncMetadata: any = {};
  const junctionTables: any[] = [];

  for (const meta of Object.values(metadata.getAll())) {
    const tableName = meta.tableName;
    const className = meta.className;
    
    // Handle junction tables separately
    if (meta.pivotTable) {
      junctionTables.push({
        tableName,
        className,
        columns: Object.keys(meta.properties).map(p => ({
          name: meta.properties[p].fieldNames?.[0] || p,
          type: meta.properties[p].type
        })),
        indexes: meta.indexes || []
      });
      continue;
    }

    const properties = meta.properties;
    const hasClientId = properties.clientId !== undefined;
    const hasVersion = properties.version !== undefined;
    const hasDeleted = properties.deleted !== undefined;
    const hasCreatedBy = properties.createdBy !== undefined;
    
    // Determine entity category
    let category: 'domain' | 'system' | 'auth' = 'system';
    if (hasClientId) {
      category = 'domain';
    } else if (['Account', 'Session', 'Verification'].includes(className)) {
      category = 'auth';
    }

    // Get all column names for updates
    const updateableColumns = Object.keys(properties).filter(prop => {
      const p = properties[prop];
      return !p.primary && !['id', 'createdAt'].includes(prop) && p.fieldNames?.[0];
    });

    // Get foreign keys
    const foreignKeys = Object.entries(properties)
      .filter(([_, p]: [string, any]) => p.reference === 'm:1')
      .map(([name, p]: [string, any]) => ({
        property: name,
        targetEntity: p.type,
        columnName: p.fieldNames?.[0] || `${name}_id`
      }));

    // Get indexes
    const indexes = [];
    if (meta.indexes) {
      for (const index of meta.indexes) {
        indexes.push({
          properties: index.properties,
          unique: index.unique || false
        });
      }
    }

    syncMetadata[className] = {
      tableName,
      className,
      category,
      features: {
        hasClientId,
        hasVersion,
        hasSoftDelete: hasDeleted,
        hasCreatedBy,
        hasUpdatedBy: properties.updatedBy !== undefined,
      },
      columns: {
        id: properties.id?.fieldNames?.[0] || 'id',
        clientId: hasClientId ? 'client_id' : null,
        version: hasVersion ? 'version' : null,
        deleted: hasDeleted ? 'deleted' : null,
        createdAt: properties.createdAt?.fieldNames?.[0] || 'created_at',
        updatedAt: properties.updatedAt?.fieldNames?.[0] || 'updated_at',
      },
      updateableColumns,
      foreignKeys,
      indexes,
      conflictResolution: hasClientId ? 'client_id' : 'id',
      // Users table needs to sync even though it's a system table
      // All domain tables and selected system tables should sync
      syncable: category === 'domain' || meta.className === 'User',
      trackChanges: category === 'domain' || meta.className === 'User',
    };
  }

  await orm.close(true);
  return { entities: syncMetadata, junctionTables };
}

function generateTypeScriptFile(data: any): string {
  const { entities, junctionTables } = data;
  
  return `// Generated sync metadata from MikroORM entities
// This file is used by the generic sync engine

export interface TableSyncMetadata {
  tableName: string;
  className: string;
  category: 'domain' | 'system' | 'auth';
  features: {
    hasClientId: boolean;
    hasVersion: boolean;
    hasSoftDelete: boolean;
    hasCreatedBy: boolean;
    hasUpdatedBy: boolean;
  };
  columns: {
    id: string;
    clientId: string | null;
    version: string | null;
    deleted: string | null;
    createdAt: string;
    updatedAt: string;
  };
  updateableColumns: string[];
  foreignKeys: Array<{
    property: string;
    targetEntity: string;
    columnName: string;
  }>;
  indexes: Array<{
    properties: string[];
    unique: boolean;
  }>;
  conflictResolution: string;
  syncable: boolean;
  trackChanges: boolean;
}

export const syncMetadata: Record<string, TableSyncMetadata> = ${JSON.stringify(entities, null, 2)};

export interface JunctionTable {
  tableName: string;
  className: string;
  columns: Array<{ name: string; type: string }>;
  indexes: any[];
}

export const junctionTables: JunctionTable[] = ${JSON.stringify(junctionTables, null, 2)};

// Helper functions for sync engine
export function getTableMetadata(entityName: string): TableSyncMetadata | undefined {
  return syncMetadata[entityName];
}

export function getTableByName(tableName: string): TableSyncMetadata | undefined {
  return Object.values(syncMetadata).find(m => m.tableName === tableName);
}

export function getSyncableTables(): TableSyncMetadata[] {
  return Object.values(syncMetadata).filter(m => m.syncable);
}

export function getDomainTables(): string[] {
  return Object.values(syncMetadata)
    .filter(m => m.category === 'domain')
    .map(m => m.tableName);
}

export function getSystemTables(): string[] {
  return Object.values(syncMetadata)
    .filter(m => m.category === 'system')
    .map(m => m.tableName);
}

export function hasClientId(tableName: string): boolean {
  const meta = getTableByName(tableName);
  return meta?.features.hasClientId || false;
}

export function hasSoftDelete(tableName: string): boolean {
  const meta = getTableByName(tableName);
  return meta?.features.hasSoftDelete || false;
}

// Type-safe table name lookup
export type EntityClassName = ${Object.keys(entities).map(k => `'${k}'`).join(' | ')};
export type TableName = ${Object.values(entities).map((m: any) => `'${m.tableName}'`).join(' | ')};

export const entityClassNames = ${JSON.stringify(Object.keys(entities))} as const;
export const tableNames = ${JSON.stringify(Object.values(entities).map((m: any) => m.tableName))} as const;

// Export tables for sync - automatically determined by syncable flag
export const SYNCABLE_ENTITY_TABLES = ${JSON.stringify(Object.values(entities).filter((m: any) => m.syncable).map((m: any) => m.tableName))} as const;
export const JUNCTION_TABLE_NAMES = ${JSON.stringify(junctionTables.map((j: any) => j.tableName))} as const;
export const TRACKED_TABLES = [...SYNCABLE_ENTITY_TABLES, ...JUNCTION_TABLE_NAMES] as const;

// Legacy exports for backward compatibility
export const DOMAIN_TABLES = ${JSON.stringify(Object.values(entities).filter((m: any) => m.category === 'domain').map((m: any) => m.tableName))} as const;

// Build table hierarchy automatically from metadata
const tableHierarchy: Record<string, string[]> = {};

// Add all syncable entity tables
${Object.values(entities).filter((m: any) => m.syncable).map((m: any) => `tableHierarchy["${m.tableName}"] = [];`).join('\n')}

// Add junction tables with their dependencies
${junctionTables.map((j: any) => {
  const deps = j.columns.map((c: any) => {
    // Convert junction column references to table names
    if (c.referencedTableName) return `"${c.referencedTableName}"`;
    // Fallback: derive table name from column name (e.g., task_id -> tasks)
    const tableName = c.name.replace(/_id$/, '') + 's';
    return `"${tableName}"`;
  }).filter(Boolean).join(', ');
  return `tableHierarchy["${j.tableName}"] = [${deps}];`;
}).join('\n')}

export const TABLE_HIERARCHY = tableHierarchy as const;

/**
 * Orders tables based on their dependencies.
 * Tables with no dependencies come first, then tables that depend on them.
 */
export function getOrderedTables(tables: readonly string[]): string[] {
  const visited = new Set<string>();
  const result: string[] = [];
  
  function visit(table: string) {
    if (visited.has(table)) return;
    
    // Get dependencies for this table
    const deps = TABLE_HIERARCHY[table as keyof typeof TABLE_HIERARCHY] || [];
    
    // Visit dependencies first
    for (const dep of deps) {
      if (tables.includes(dep)) {
        visit(dep);
      }
    }
    
    // Then add this table
    visited.add(table);
    result.push(table);
  }
  
  // Visit all tables
  for (const table of tables) {
    visit(table);
  }
  
  return result;
}

// Export ordered tracked tables for initial sync
export const ORDERED_TRACKED_TABLES = getOrderedTables(TRACKED_TABLES);
`;
}

async function main() {
  try {
    console.log('🔍 Extracting sync metadata from MikroORM entities...');
    
    const data = await extractSyncMetadata();
    const entityCount = Object.keys(data.entities).length;
    const junctionCount = data.junctionTables.length;
    
    console.log(`📦 Found ${entityCount} entities and ${junctionCount} junction tables`);
    
    const outputContent = generateTypeScriptFile(data);
    const outputPath = path.join(__dirname, '..', 'generated', 'sync-metadata.ts');
    
    await fs.writeFile(outputPath, outputContent, 'utf-8');
    
    console.log('✅ Generated sync-metadata.ts');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating sync metadata:', error);
    process.exit(1);
  }
}

main();