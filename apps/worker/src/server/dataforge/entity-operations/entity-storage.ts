/**
 * Entity storage helper functions
 */

import type { Kysely } from 'kysely';

/**
 * Store entity definition in entity_schemas table
 */
export async function storeEntityDefinition(
  kysely: Kysely<any>,
  orgId: string,
  entityName: string,
  definition: any,
  tableName: string
): Promise<void> {
  // Store complete field information in entity_schemas using business_metadata
  await kysely
    .insertInto('entity_schemas')
    .values({
      org_id: orgId,
      entity_name: entityName,
      archetype: definition.archetype,
      table_name: tableName,
      business_metadata: definition, // Store full definition in business_metadata JSONB column
      deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .execute();
}

/**
 * Get entity definition from entity_schemas table
 */
export async function getEntityDefinition(
  kysely: Kysely<any>,
  orgId: string,
  entityName: string
): Promise<any | null> {
  // Import EntityNameUtils for consistent name normalization
  const { EntityNameUtils } = await import('@/lib/entity-name-utils');
  
  // Normalize entity name to PascalCase for database lookup
  const normalizedEntityName = EntityNameUtils.toPascalCase(entityName);
  
  const result = await kysely
    .selectFrom('entity_schemas')
    .select(['business_metadata', 'archetype', 'table_name'])
    .where('org_id', '=', orgId)
    .where('entity_name', '=', normalizedEntityName)
    .where('deleted', '=', false)
    .executeTakeFirst();
    
  if (!result || !result.business_metadata) {
    return null;
  }
  
  try {
    const definition = result.business_metadata;
      
    return {
      ...definition,
      tableName: result.table_name,
      archetype: result.archetype
    };
  } catch (error) {
    console.error('Failed to parse entity definition:', error);
    return null;
  }
}