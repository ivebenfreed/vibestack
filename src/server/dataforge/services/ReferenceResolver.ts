/**
 * ReferenceResolver Service
 * 
 * Handles resolution of reference fields in entity records.
 * Extracted from EntityManager to improve modularity.
 */

import type { Kysely } from 'kysely';
import type { Database } from '@/server/db/schema';

export interface ReferenceResolverConfig {
  kysely: any; // EntityManager with withKysely method
}

export class ReferenceResolver {
  // Cache lookup maps to avoid expensive repeated queries
  private lookupCache = new Map<string, Record<string, any>>();
  private cacheTimestamps = new Map<string, number>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private entityManager: any;

  constructor(private config: ReferenceResolverConfig) {
    this.entityManager = config.kysely;
  }

  /**
   * Resolve reference fields in query results
   */
  async resolveReferences(orgId: string, entityName: string, results: any[]): Promise<any[]> {
    console.log(`🚨 [ReferenceResolver] resolveReferences called for ${entityName} with ${results?.length || 0} results - THIS SHOULD BE DISABLED!`);
    
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
      // NOTE: _resolved field pattern is deprecated as of September 2025
      // The new relationship system handles reference resolution differently
      // For now, return original results without adding _resolved fields
      // to prevent Legend State sync conflicts
      const resolvedResults = results.map(record => {
        // Simply return the original record without adding _resolved fields
        return { ...record };
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
      const entity = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('entity_schemas')
          .select(['business_metadata', 'archetype'])
          .where('org_id', '=', orgId)
          .where('entity_name', '=', entityName)
          .where('deleted', '!=', true)
          .executeTakeFirst();
      });

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
   * Build lookup maps for all reference fields (with caching)
   */
  private async buildReferenceLookupMaps(orgId: string, referenceFields: Record<string, any>): Promise<Record<string, Record<string, any>>> {
    const lookupMaps: Record<string, Record<string, any>> = {};

    for (const [fieldName, fieldInfo] of Object.entries(referenceFields)) {
      try {
        // Check cache first
        const cacheKey = `${orgId}:${fieldName}:${fieldInfo.type}`;
        const cached = this.getCachedLookup(cacheKey);
        if (cached) {
          lookupMaps[fieldName] = cached;
          continue;
        }

        let lookup: Record<string, any> = {};

        switch (fieldInfo.type) {
          case 'priority_option':
            lookup = await this.getSystemOptionLookup('priority', fieldInfo.archetype);
            break;
          case 'status_option':
            lookup = await this.getSystemOptionLookup('status', fieldInfo.archetype);
            break;
          case 'category_option':
            lookup = await this.getSystemOptionLookup('category', fieldInfo.archetype);
            break;
          case 'discussion_type_option':
            lookup = await this.getSystemOptionLookup('discussion_type', fieldInfo.archetype);
            break;
          case 'custom_option_reference':
            lookup = await this.getCustomOptionLookup(orgId, fieldName);
            break;
          case 'user_reference':
            lookup = await this.getUserLookup(orgId);
            break;
          case 'entity_reference':
            const targetEntity = this.inferTargetEntity(fieldName, fieldInfo.archetype);
            if (targetEntity) {
              lookup = await this.getEntityLookup(orgId, targetEntity);
            }
            break;
        }

        // Cache the result
        this.setCachedLookup(cacheKey, lookup);
        lookupMaps[fieldName] = lookup;

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
      const options = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
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
      });

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
      const options = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
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
      });

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
      const users = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('user')
          .innerJoin('organization_members', 'user.id', 'organization_members.user_id')
          .select([
            'user.id',
            'user.name',
            'user.email',
            'user.image',
            'organization_members.role'
          ])
          .where('organization_members.organization_id', '=', orgId)
          .execute();
      });

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
      const targetEntity = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('entity_schemas')
          .select(['table_name', 'archetype'])
          .where('org_id', '=', orgId)
          .where('entity_name', '=', targetEntityName)
          .where('deleted', '!=', true)
          .executeTakeFirst();
      });
        
      if (!targetEntity) {
        console.warn(`[ReferenceResolver] Target entity not found: ${targetEntityName}`);
        return {};
      }

      // Get actual table columns using information_schema
      const tableColumns = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom('information_schema.columns' as any)
          .select(['column_name'])
          .where('table_name', '=', targetEntity.table_name)
          .where('table_schema', '=', 'public')
          .execute();
      });

      const availableColumns = tableColumns.map((col: any) => col.column_name);
      
      // Always include base fields if they exist
      let selectFields = ['id', 'created_at', 'updated_at'].filter(field => 
        availableColumns.includes(field)
      );
      
      // Determine best display field from available columns
      let displayField = 'id'; // fallback
      
      if (availableColumns.includes('title')) {
        selectFields.push('title');
        displayField = 'title';
      } else if (availableColumns.includes('name')) {
        selectFields.push('name');
        displayField = 'name';
      }
      
      // Add status if available
      if (availableColumns.includes('status')) {
        selectFields.push('status');
      }

      // Query records with only columns that actually exist
      const fullRecords = await this.entityManager.withKysely(async (kysely) => {
        return await kysely
          .selectFrom(targetEntity.table_name as any)
          .select(selectFields as any)
          .limit(1000)
          .execute();
      });

      const lookup: Record<string, any> = {};
      for (const record of fullRecords) {
        const displayName = record[displayField] || 
                           `${targetEntity.archetype} ${record.id.slice(0, 8)}`;
        
        lookup[record.id] = {
          id: record.id,
          name: displayName,
          status: record.status || undefined,
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

  /**
   * Cache management methods
   */
  private getCachedLookup(cacheKey: string): Record<string, any> | null {
    const timestamp = this.cacheTimestamps.get(cacheKey);
    if (!timestamp || Date.now() - timestamp > this.CACHE_TTL_MS) {
      // Cache expired
      this.lookupCache.delete(cacheKey);
      this.cacheTimestamps.delete(cacheKey);
      return null;
    }
    return this.lookupCache.get(cacheKey) || null;
  }

  private setCachedLookup(cacheKey: string, lookup: Record<string, any>): void {
    this.lookupCache.set(cacheKey, lookup);
    this.cacheTimestamps.set(cacheKey, Date.now());
  }

  /**
   * Clear cache (useful for testing or when reference data changes)
   */
  public clearCache(): void {
    this.lookupCache.clear();
    this.cacheTimestamps.clear();
  }
}