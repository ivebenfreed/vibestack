/**
 * Worker-compatible entity generation
 * Generates client and server entity exports without file system dependencies
 */

import { WorkerMetadataFilter } from '../utils/worker-metadata-filter.js';
import { METADATA_KEYS } from '../utils/context.js';

interface GeneratedEntityExports {
  clientEntities: string;
  serverEntities: string;
}

export function generateEntityExports(): GeneratedEntityExports {
  const filter = new WorkerMetadataFilter();
  
  // Get all entities
  const allEntities = filter.getAllEntities();
  
  // Separate client and server entities
  const clientEntities = allEntities.filter(entity => !filter.isServerOnly(entity.target));
  const serverEntities = allEntities.filter(entity => !filter.isClientOnly(entity.target));
  
  // Generate client entities file
  const clientImports = clientEntities
    .map(entity => `export type { ${entity.target.name} } from '../entities/${entity.target.name}.js';`)
    .join('\n');
  
  const clientDomainTables = clientEntities
    .filter(entity => filter.isDomainTable(entity.target))
    .map(entity => `'${entity.target.name.toLowerCase()}'`)
    .join(',\n  ');
  
  const clientSystemTables = clientEntities
    .filter(entity => !filter.isDomainTable(entity.target))
    .map(entity => `'${entity.target.name.toLowerCase()}'`)
    .join(',\n  ');
  
  // Get junction tables
  const junctionTables = filter.getJunctionTables()
    .map(jt => `'${jt.name}'`)
    .join(',\n  ');
  
  const clientEntitiesContent = `/**
 * Auto-generated client entity exports
 * Generated at: ${new Date().toISOString()}
 * 
 * This file is auto-generated. Do not edit manually.
 * Run generation scripts to regenerate.
 */

${clientImports}

// Client domain tables (synced entities)
export const CLIENT_DOMAIN_TABLES = [
  ${clientDomainTables}
] as const;

// Client system tables (local-only entities)  
export const CLIENT_SYSTEM_TABLES = [
  ${clientSystemTables}
] as const;

// Junction tables for many-to-many relationships
export const CLIENT_JUNCTION_TABLES = [
  ${junctionTables}
] as const;

export type ClientDomainTable = typeof CLIENT_DOMAIN_TABLES[number];
export type ClientSystemTable = typeof CLIENT_SYSTEM_TABLES[number];
export type ClientJunctionTable = typeof CLIENT_JUNCTION_TABLES[number];
export type ClientTable = ClientDomainTable | ClientSystemTable | ClientJunctionTable;
`;

  // Generate server entities file
  const serverImports = serverEntities
    .map(entity => `export type { ${entity.target.name} } from '../entities/${entity.target.name}.js';`)
    .join('\n');
  
  const serverDomainTables = serverEntities
    .filter(entity => filter.isDomainTable(entity.target))
    .map(entity => `'${entity.target.name.toLowerCase()}'`)
    .join(',\n  ');
  
  const serverSystemTables = serverEntities
    .filter(entity => !filter.isDomainTable(entity.target))
    .map(entity => `'${entity.target.name.toLowerCase()}'`)
    .join(',\n  ');
  
  const serverEntitiesContent = `/**
 * Auto-generated server entity exports
 * Generated at: ${new Date().toISOString()}
 * 
 * This file is auto-generated. Do not edit manually.
 * Run generation scripts to regenerate.
 */

${serverImports}

// Server domain tables (business entities)
export const SERVER_DOMAIN_TABLES = [
  ${serverDomainTables}
] as const;

// Server system tables (infrastructure entities)
export const SERVER_SYSTEM_TABLES = [
  ${serverSystemTables}
] as const;

// Junction tables for many-to-many relationships  
export const SERVER_JUNCTION_TABLES = [
  ${junctionTables}
] as const;

export type ServerDomainTable = typeof SERVER_DOMAIN_TABLES[number];
export type ServerSystemTable = typeof SERVER_SYSTEM_TABLES[number];
export type ServerJunctionTable = typeof SERVER_JUNCTION_TABLES[number];
export type ServerTable = ServerDomainTable | ServerSystemTable | ServerJunctionTable;
`;

  return {
    clientEntities: clientEntitiesContent,
    serverEntities: serverEntitiesContent
  };
}

// Export stats for debugging
export function getEntityStats() {
  const filter = new WorkerMetadataFilter();
  const allEntities = filter.getAllEntities();
  
  return {
    total: allEntities.length,
    client: allEntities.filter(e => !filter.isServerOnly(e.target)).length,
    server: allEntities.filter(e => !filter.isClientOnly(e.target)).length,
    domain: allEntities.filter(e => filter.isDomainTable(e.target)).length,
    system: allEntities.filter(e => !filter.isDomainTable(e.target)).length,
    junctionTables: filter.getJunctionTables().length,
    entityNames: allEntities.map(e => e.target.name)
  };
}