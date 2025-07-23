/**
 * Relationship Discovery Utilities
 * 
 * Dynamically discovers relationship configurations from column definitions
 * to avoid hardcoding specific entity relationships
 */

import type { Column } from '../types';

export interface RelationshipConfig {
  fieldName: string;           // e.g., 'projectId', 'assigneeId'
  columnId: string;            // e.g., 'project', 'assignee'
  relationshipTable: string;   // e.g., 'projects', 'users'
  displayField: string;        // e.g., 'name', 'displayName'
  resolvedFieldName: string;   // e.g., '__resolved_project'
}

/**
 * Discovers all relationship configurations from column definitions
 */
export function discoverRelationships(columns: Column[]): RelationshipConfig[] {
  const relationships: RelationshipConfig[] = [];
  
  columns.forEach(column => {
    const cellType = column.cellType || column.type;
    
    // Check if this is a relationship column
    if (cellType?.startsWith('relationship') && column.relationshipTable) {
      const fieldName = column.field || column.id;
      
      relationships.push({
        fieldName,
        columnId: column.id,
        relationshipTable: column.relationshipTable,
        displayField: column.relationshipDisplayField || 'name',
        resolvedFieldName: `__resolved_${column.id}`
      });
    }
  });
  
  return relationships;
}

/**
 * Gets unique relationship tables from columns
 */
export function getUniqueRelationshipTables(columns: Column[]): string[] {
  const relationships = discoverRelationships(columns);
  const tables = new Set(relationships.map(r => r.relationshipTable));
  return Array.from(tables);
}

/**
 * Creates a map of field names to their relationship configs
 */
export function createRelationshipMap(columns: Column[]): Map<string, RelationshipConfig> {
  const relationships = discoverRelationships(columns);
  const map = new Map<string, RelationshipConfig>();
  
  relationships.forEach(config => {
    map.set(config.fieldName, config);
  });
  
  return map;
}

/**
 * Extracts relationship IDs from entities for a specific relationship
 */
export function extractRelationshipIds(
  entities: any[],
  relationshipConfig: RelationshipConfig
): Set<string> {
  const ids = new Set<string>();
  
  entities.forEach(entity => {
    const value = entity[relationshipConfig.fieldName];
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(id => ids.add(id));
      } else {
        ids.add(value);
      }
    }
  });
  
  return ids;
}

/**
 * Resolves entity relationships dynamically based on column configuration
 */
export function resolveEntityRelationships(
  entity: any,
  relationships: Map<string, any>,
  relationshipConfigs: RelationshipConfig[]
): any {
  const resolved = { ...entity };
  
  relationshipConfigs.forEach(config => {
    const relationshipId = entity[config.fieldName];
    if (relationshipId && relationships[config.relationshipTable]) {
      const relatedEntity = relationships[config.relationshipTable][relationshipId];
      if (relatedEntity) {
        resolved[config.resolvedFieldName] = 
          relatedEntity[config.displayField] || 
          relatedEntity.name || 
          relatedEntity.displayName || 
          relatedEntity.title || 
          relationshipId;
      } else {
        resolved[config.resolvedFieldName] = '';
      }
    } else {
      resolved[config.resolvedFieldName] = '';
    }
  });
  
  return resolved;
}