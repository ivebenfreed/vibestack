/**
 * Dynamic Entity Registry
 * 
 * Central registry that dynamically discovers all domain entities from DataForge
 * and provides utilities for working with them without hardcoding.
 */

import * as clientEntities from '@repo/dataforge/client-entities';
import { CLIENT_DOMAIN_TABLES } from '@repo/dataforge/client-entities';

// Cache for entity metadata
let _entityMetadata: Map<string, EntityMetadata> | null = null;
const _domainFiles: Map<string, string> | null = null;

export interface EntityMetadata {
  name: string;
  tableName: string;
  EntityClass: any;
  Schema: any;
}

/**
 * Get all domain entity metadata dynamically from DataForge exports
 */
export function getDomainEntityMetadata(): Map<string, EntityMetadata> {
  if (_entityMetadata) return _entityMetadata;
  
  _entityMetadata = new Map();
  
  // Get clean table names (without quotes)
  const cleanTables = CLIENT_DOMAIN_TABLES.map(table => table.replace(/"/g, ''));
  
  // Build metadata for each entity
  Object.entries(clientEntities).forEach(([key, value]) => {
    if (key.endsWith('Schema') && typeof value === 'object' && value !== null) {
      const schema = value as any;
      const tableName = schema.options?.tableName;
      
      // Only process domain tables
      if (tableName && cleanTables.includes(tableName)) {
        const entityName = key.replace('Schema', '');
        const EntityClass = (clientEntities as any)[entityName];
        
        if (EntityClass) {
          _entityMetadata!.set(entityName, {
            name: entityName,
            tableName,
            EntityClass,
            Schema: schema
          });
        }
      }
    }
  });
  
  return _entityMetadata;
}

/**
 * Get all domain entity names
 */
export function getDomainEntityNames(): string[] {
  return Array.from(getDomainEntityMetadata().keys());
}

/**
 * Get entity class by name
 */
export function getEntityClass(entityName: string): any {
  const metadata = getDomainEntityMetadata().get(entityName);
  return metadata?.EntityClass;
}

/**
 * Get table name for entity
 */
export function getTableNameForEntity(entityName: string): string | undefined {
  const metadata = getDomainEntityMetadata().get(entityName);
  return metadata?.tableName;
}

/**
 * Get entity name from table name
 */
export function getEntityNameFromTable(tableName: string): string | undefined {
  for (const [entityName, metadata] of getDomainEntityMetadata()) {
    if (metadata.tableName === tableName) {
      return entityName;
    }
  }
  return undefined;
}

/**
 * Map table names to entity classes (for compatibility)
 */
export function getTableToEntityMap(): Record<string, any> {
  const map: Record<string, any> = {};
  for (const [_, metadata] of getDomainEntityMetadata()) {
    map[metadata.tableName] = metadata.EntityClass;
  }
  return map;
}

/**
 * Get the domain file path for an entity (convention-based)
 */
export function getDomainFilePath(entityName: string): string {
  // Convert PascalCase to kebab-case
  const kebabCase = entityName
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .toLowerCase();
  return `@/domain/${kebabCase}`;
}

/**
 * Check if an entity has a domain file (by convention)
 */
export function hasDomainFile(entityName: string): boolean {
  // Known entities with domain files
  const entitiesWithDomainFiles = ['Task', 'TaskDependency', 'Project', 'User', 'Comment', 'StatusDefinition', 'StatusSet', 'Tag', 'TagSet'];
  return entitiesWithDomainFiles.includes(entityName);
}