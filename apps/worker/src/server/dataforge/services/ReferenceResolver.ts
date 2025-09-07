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
          case 'user_reference':
            lookupMaps[fieldName] = await this.getUserLookup(orgId);
            break;
          case 'entity_reference':
            const targetEntity = this.inferTargetEntity(fieldName, fieldInfo.archetype);
            if (targetEntity) {
              lookupMaps[fieldName] = await this.getEntityLookup(orgId, targetEntity);
            }
            break;
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

  /**
   * Get user lookup map for user references
   */
  private async getUserLookup(orgId: string): Promise<Record<string, any>> {
    try {
      // Get all users in the organization
      const users = await this.config.kysely
        .selectFrom('"user"')
        .innerJoin('organization_members', 'user.id', 'organization_members.user_id')
        .select([
          '"user".id',
          '"user".name',
          '"user".email',
          '"user".image',
          'organization_members.role'
        ])
        .where('organization_members.organization_id', '=', orgId)
        .execute();

      const lookup: Record<string, any> = {};
      for (const user of users) {
        lookup[user.id] = {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
          displayName: user.name || user.email
        };
      }

      return lookup;
    } catch (error) {
      console.error(`[ReferenceResolver] Error getting user lookup:`, error);
      return {};
    }
  }

  /**
   * Get entity lookup map for entity references
   */
  private async getEntityLookup(orgId: string, targetEntityName: string): Promise<Record<string, any>> {
    try {
      // Find the target entity table
      const targetEntity = await this.config.kysely
        .selectFrom('entity_schemas')
        .select(['table_name', 'archetype'])
        .where('org_id', '=', orgId)
        .where('entity_name', '=', targetEntityName)
        .where('deleted', '!=', true)
        .executeTakeFirst();
        
      if (!targetEntity) {
        console.warn(`[ReferenceResolver] Target entity not found: ${targetEntityName}`);
        return {};
      }

      // Query records from the target entity table
      // Use common fields that most entities should have
      const records = await this.config.kysely
        .selectFrom(targetEntity.table_name as any)
        .select(['id', 'name', 'title', 'status', 'created_at', 'updated_at'])
        .limit(1000) // Reasonable limit for lookup maps
        .execute();

      const lookup: Record<string, any> = {};
      for (const record of records) {
        lookup[record.id] = {
          id: record.id,
          name: record.name || record.title || `${targetEntity.archetype} ${record.id.slice(0, 8)}`,
          status: record.status,
          archetype: targetEntity.archetype,
          created_at: record.created_at,
          updated_at: record.updated_at
        };
      }

      return lookup;
    } catch (error) {
      console.error(`[ReferenceResolver] Error getting entity lookup for ${targetEntityName}:`, error);
      return {};
    }
  }

  /**
   * Infer target entity from field name using naming conventions
   */
  private inferTargetEntity(fieldName: string, archetype?: string): string | null {
    // Handle self-references first (parent relationships)
    if (fieldName.startsWith('parent_') && archetype) {
      // parent_task_id in task entity -> Task
      return archetype.charAt(0).toUpperCase() + archetype.slice(1);
    }
    
    // Handle specific patterns
    if (fieldName === 'project_id') return 'Project';
    if (fieldName === 'task_id') return 'Task';
    if (fieldName === 'document_id') return 'Document';
    if (fieldName === 'file_id') return 'File';
    if (fieldName === 'discussion_id') return 'Discussion';
    if (fieldName === 'collection_id') return 'Collection';
    if (fieldName === 'record_id') return 'Record';
    if (fieldName === 'activity_id') return 'Activity';
    
    // Generic pattern: remove _id suffix and capitalize
    if (fieldName.endsWith('_id')) {
      const baseName = fieldName.replace(/_id$/, '');
      return baseName.charAt(0).toUpperCase() + baseName.slice(1);
    }
    
    return null;
  }
}