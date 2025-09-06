/**
 * ReferenceResolver Service
 * 
 * Handles resolution of reference fields in entity records.
 * Extracted from EntityManager to improve modularity.
 */

import type { Kysely } from 'kysely';
import type { Database } from '@/server/db/schema';

export interface ReferenceResolverConfig {
  kysely: Kysely<Database>;
}

export class ReferenceResolver {
  constructor(private config: ReferenceResolverConfig) {}

  /**
   * Resolve reference fields in query results
   */
  async resolveReferences(orgId: string, entityName: string, results: any[]): Promise<any[]> {
    if (!results || results.length === 0) {
      return results;
    }

    try {
      // Get entity metadata to identify reference fields
      const entityMetadata = await this.getEntityMetadata(orgId, entityName);
      if (!entityMetadata || !entityMetadata.referenceFields) {
        return results;
      }

      // Build reference lookup maps
      const referenceMaps = await this.buildReferenceLookupMaps(orgId, entityMetadata.referenceFields);

      // Resolve references for each result
      const resolvedResults = results.map(record => {
        const resolvedRecord = { ...record };
        
        for (const [fieldName, fieldInfo] of Object.entries(entityMetadata.referenceFields)) {
          const fieldValue = record[fieldName];
          if (fieldValue && referenceMaps[fieldName]) {
            const resolvedValue = referenceMaps[fieldName][fieldValue];
            if (resolvedValue) {
              // Add resolved reference data
              resolvedRecord[`${fieldName}_resolved`] = resolvedValue;
            }
          }
        }

        return resolvedRecord;
      });

      return resolvedResults;
    } catch (error) {
      console.warn(`[ReferenceResolver] Failed to resolve references for ${entityName}:`, error);
      return results; // Return original results if resolution fails
    }
  }

  /**
   * Get entity metadata including reference field information
   */
  async getEntityMetadata(orgId: string, entityName: string): Promise<any> {
    try {
      // Get entity from entity_schemas table with business_metadata
      const entity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['business_metadata', 'archetype'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', entityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();

      if (!entity || !entity.business_metadata) {
        return null;
      }

      // Parse business metadata
      const metadata = typeof entity.business_metadata === 'string' 
        ? JSON.parse(entity.business_metadata)
        : entity.business_metadata;

      // Extract reference fields from field definitions
      const referenceFields: Record<string, any> = {};
      const fields = metadata.fields || [];
      
      for (const field of fields) {
        if (this.isReferenceField(field.type)) {
          referenceFields[field.name] = {
            type: field.type,
            archetype: entity.archetype,
            enum: field.enum
          };
        }
      }

      return {
        archetype: entity.archetype,
        referenceFields,
        metadata
      };
    } catch (error) {
      console.error(`[ReferenceResolver] Error getting entity metadata:`, error);
      return null;
    }
  }

  /**
   * Check if a field type is a reference field
   */
  isReferenceField(fieldType: string): boolean {
    return [
      'priority_option',
      'status_option', 
      'category_option',
      'discussion_type_option',
      'custom_option_reference',
      'user_reference',
      'entity_reference'
    ].includes(fieldType);
  }

  /**
   * Build lookup maps for all reference fields
   */
  private async buildReferenceLookupMaps(orgId: string, referenceFields: Record<string, any>): Promise<Record<string, Record<string, any>>> {
    const lookupMaps: Record<string, Record<string, any>> = {};

    for (const [fieldName, fieldInfo] of Object.entries(referenceFields)) {
      try {
        switch (fieldInfo.type) {
          case 'priority_option':
            lookupMaps[fieldName] = await this.getSystemOptionLookup('priority', fieldInfo.archetype);
            break;
          case 'status_option':
            lookupMaps[fieldName] = await this.getSystemOptionLookup('status', fieldInfo.archetype);
            break;
          case 'category_option':
            lookupMaps[fieldName] = await this.getSystemOptionLookup('category', fieldInfo.archetype);
            break;
          case 'discussion_type_option':
            lookupMaps[fieldName] = await this.getSystemOptionLookup('discussion_type', fieldInfo.archetype);
            break;
          case 'custom_option_reference':
            lookupMaps[fieldName] = await this.getCustomOptionLookup(orgId, fieldName);
            break;
          // TODO: Implement user_reference and entity_reference resolution
        }
      } catch (error) {
        console.warn(`[ReferenceResolver] Failed to build lookup map for ${fieldName}:`, error);
      }
    }

    return lookupMaps;
  }

  /**
   * Get system option lookup map (value -> {label, color, etc})
   */
  private async getSystemOptionLookup(optionType: string, archetype: string): Promise<Record<string, any>> {
    try {
      const options = await this.config.kysely
        .selectFrom('system_option_sets')
        .innerJoin('system_options', 'system_option_sets.id', 'system_options.option_set_id')
        .select([
          'system_options.value',
          'system_options.label', 
          'system_options.color',
          'system_options.icon',
          'system_options.description',
          'system_options.metadata'
        ])
        .where('system_option_sets.option_set_type', '=', optionType)
        .where('system_option_sets.archetype', '=', archetype)
        .where('system_option_sets.is_active', '=', true)
        .where('system_options.is_active', '=', true)
        .execute();

      const lookup: Record<string, any> = {};
      for (const option of options) {
        lookup[option.value] = {
          value: option.value,
          label: option.label,
          color: option.color,
          icon: option.icon,
          description: option.description,
          metadata: option.metadata
        };
      }

      return lookup;
    } catch (error) {
      console.error(`[ReferenceResolver] Error getting system option lookup for ${optionType}:`, error);
      return {};
    }
  }

  /**
   * Get custom option lookup map for organization
   */
  private async getCustomOptionLookup(orgId: string, fieldName: string): Promise<Record<string, any>> {
    try {
      const options = await this.config.kysely
        .selectFrom('custom_option_sets')
        .innerJoin('custom_options', 'custom_option_sets.id', 'custom_options.option_set_id')
        .select([
          'custom_options.value',
          'custom_options.label',
          'custom_options.color', 
          'custom_options.icon',
          'custom_options.description',
          'custom_options.metadata'
        ])
        .where('custom_option_sets.org_id', '=', orgId)
        .where('custom_option_sets.name', '=', fieldName) // Assuming field name matches option set name
        .where('custom_option_sets.is_active', '=', true)
        .where('custom_options.is_active', '=', true)
        .execute();

      const lookup: Record<string, any> = {};
      for (const option of options) {
        lookup[option.value] = {
          value: option.value,
          label: option.label,
          color: option.color,
          icon: option.icon,
          description: option.description,
          metadata: option.metadata
        };
      }

      return lookup;
    } catch (error) {
      console.error(`[ReferenceResolver] Error getting custom option lookup for ${fieldName}:`, error);
      return {};
    }
  }
}