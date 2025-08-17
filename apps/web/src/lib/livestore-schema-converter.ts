/**
 * LiveStore Schema Converter
 * 
 * Converts our dynamic LiveStore schema format to actual LiveStore schema objects.
 */

import { Schema } from '@livestore/livestore';
import type { LiveStoreSchema } from './livestore-dynamic-schema';

/**
 * Convert our dynamic schema to LiveStore schema format
 */
export function convertToLiveStoreSchema(schema: LiveStoreSchema): any {
  const tables: Record<string, any> = {};
  
  for (const [tableName, tableDef] of Object.entries(schema)) {
    const columns: Record<string, any> = {};
    
    // Convert columns - using Schema for LiveStore
    for (const [columnName, columnDef] of Object.entries(tableDef.columns)) {
      switch (columnDef.type) {
        case 'text':
          columns[columnName] = Schema.String;
          break;
        case 'integer':
          columns[columnName] = Schema.Number;
          break;
        case 'real':
          columns[columnName] = Schema.Number;
          break;
        case 'blob':
          columns[columnName] = Schema.String; // Store as base64 string
          break;
        default:
          columns[columnName] = Schema.String;
      }
    }
    
    tables[tableName] = Schema.Struct(columns);
  }
  
  return Schema.Struct(tables);
}

/**
 * Convert our dynamic events to LiveStore events format
 */
export function convertToLiveStoreEvents(events: Record<string, any>): Record<string, any> {
  const liveStoreEvents: Record<string, any> = {};
  
  for (const [eventName, eventDef] of Object.entries(events)) {
    // Create schema for event data
    const schemaFields: Record<string, any> = {};
    
    for (const [fieldName, fieldType] of Object.entries(eventDef.data || {})) {
      switch (fieldType) {
        case 'string':
          schemaFields[fieldName] = Schema.String;
          break;
        case 'number':
          schemaFields[fieldName] = Schema.Number;
          break;
        case 'boolean':
          schemaFields[fieldName] = Schema.Boolean;
          break;
        case 'object':
          schemaFields[fieldName] = Schema.Any;
          break;
        default:
          schemaFields[fieldName] = Schema.String;
      }
    }
    
    liveStoreEvents[eventName] = Schema.Struct(schemaFields);
  }
  
  return liveStoreEvents;
}

/**
 * Create LiveStore store configuration for organization
 */
export function createOrgStoreConfig(
  orgId: string,
  schema: LiveStoreSchema,
  events: Record<string, any>
): { schema: any; events: any; databaseName: string } {
  return {
    schema: convertToLiveStoreSchema(schema),
    events: convertToLiveStoreEvents(events),
    databaseName: `vibestack-org-${orgId}`
  };
}