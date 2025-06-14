/**
 * Relationship Processing Module
 * 
 * Handles entity-specific relationship validation, dependency resolution,
 * and custom business logic using auto-generated configurations from @repo/dataforge.
 */

import { 
  CLIENT_RELATIONSHIP_CONFIGS,
  getEntityRelationships,
  hasRelationshipConfig,
  getJunctionRelationships,
  type RelationshipConfig
} from '@repo/dataforge/client-entities';

// Re-export the interface and generated configs for compatibility
export { type RelationshipConfig } from '@repo/dataforge/client-entities';
export const ENTITY_RELATIONSHIP_CONFIGS = CLIENT_RELATIONSHIP_CONFIGS;

/**
 * Generic relationship processor that uses auto-generated entity-specific configurations
 * This replaces hardcoded relationship handling with configuration-driven processing
 */
export class RelationshipProcessor {
  constructor(private repositories: Record<string, any>) {}
  
  /**
   * Process relationships for any entity using its auto-generated configuration
   */
  async processRelationships(
    entityName: string, 
    data: Record<string, any>, 
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
  ): Promise<Record<string, any>> {
    const config = getEntityRelationships(entityName);
    if (!config) {
      console.log(`[RelationshipProcessor] No relationship config found for entity '${entityName}' - proceeding without relationship processing`);
      return data; // No relationship config = no processing needed
    }
    
    let processedData = { ...data };
    
    // 1. Validate required references
    if (config.requiredReferences && config.requiredReferences.length > 0) {
      await this.validateRequiredReferences(config.requiredReferences, processedData, operation);
    }
    
    // 2. Handle self-references
    if (config.selfReferences && config.selfReferences.length > 0) {
      await this.validateSelfReferences(config.selfReferences, processedData, entityName);
    }
    
    // 3. Apply custom dependency resolution (if configured)
    // Note: Custom dependency resolvers are not auto-generated yet but can be added
    
    // 4. Run custom validators (if configured)
    if (config.customValidators && config.customValidators.length > 0) {
      for (const validator of config.customValidators) {
        await validator.validator(processedData, operation);
      }
    }
    
    console.log(`[RelationshipProcessor] Processed relationships for ${entityName}:`, {
      requiredReferences: config.requiredReferences?.length || 0,
      selfReferences: config.selfReferences?.length || 0,
      junctionRelationships: config.junctionRelationships?.length || 0,
      customValidators: config.customValidators?.length || 0
    });
    
    return processedData;
  }
  
  /**
   * Get relationship configuration for a specific entity
   */
  getRelationshipConfig(entityName: string): RelationshipConfig | undefined {
    return getEntityRelationships(entityName);
  }
  
  /**
   * Check if an entity has any relationship configurations
   */
  hasRelationshipConfig(entityName: string): boolean {
    return hasRelationshipConfig(entityName);
  }
  
  /**
   * Get all entities that have relationship configurations
   */
  getConfiguredEntities(): string[] {
    return Object.keys(CLIENT_RELATIONSHIP_CONFIGS);
  }

  /**
   * Get junction relationships for a specific entity
   */
  getJunctionRelationships(entityName: string) {
    return getJunctionRelationships(entityName);
  }
  
  /**
   * Validate required reference fields using auto-generated configuration
   */
  private async validateRequiredReferences(
    references: NonNullable<RelationshipConfig['requiredReferences']>, 
    data: Record<string, any>,
    operation: string
  ): Promise<void> {
    if (!references || operation === 'DELETE') return;
    
    for (const ref of references) {
      const value = data[ref.field];
      
      if (!ref.nullable && (!value || value === '')) {
        throw new Error(`${ref.field} is required for this operation`);
      }
      
      // Validate foreign key constraints if repository is available
      if (value && this.repositories[ref.targetEntity]) {
        try {
          const exists = await this.repositories[ref.targetEntity].findById(value);
          if (!exists) {
            throw new Error(`Referenced ${ref.targetEntity} with ID ${value} does not exist`);
          }
        } catch (error) {
          // Log warning but don't fail - let database handle constraint validation
          console.warn(`Could not validate reference ${ref.field} -> ${ref.targetEntity}:`, error);
        }
      }
    }
  }
  
  /**
   * Validate self-referential relationships using auto-generated configuration
   */
  private async validateSelfReferences(
    selfRefs: NonNullable<RelationshipConfig['selfReferences']>,
    data: Record<string, any>,
    entityName: string
  ): Promise<void> {
    if (!selfRefs) return;
    
    for (const selfRef of selfRefs) {
      const value = data[selfRef.field];
      
      if (value) {
        // Prevent self-referencing (entity referring to itself)
        if (value === data.id) {
          throw new Error(`${selfRef.field} cannot refer to itself`);
        }
        
        // Detect cycles if not allowed
        if (!selfRef.allowCycles) {
          await this.detectCycles(entityName, value, selfRef.field, data.id, selfRef.maxDepth);
        }
      }
    }
  }
  
  /**
   * Detect cycles in self-referential relationships
   */
  private async detectCycles(
    entityName: string, 
    parentId: string, 
    parentField: string, 
    currentId: string,
    maxDepth?: number,
    visited: Set<string> = new Set(),
    depth: number = 0
  ): Promise<void> {
    if (visited.has(parentId)) {
      throw new Error(`Circular reference detected in ${entityName}.${parentField}`);
    }
    
    if (maxDepth && depth >= maxDepth) {
      throw new Error(`Maximum depth (${maxDepth}) exceeded for ${entityName}.${parentField}`);
    }
    
    if (!this.repositories[entityName]) {
      return; // Can't validate without repository
    }
    
    visited.add(currentId);
    
    try {
      const parentEntity = await this.repositories[entityName].findById(parentId);
      if (parentEntity && parentEntity[parentField]) {
        await this.detectCycles(
          entityName, 
          parentEntity[parentField], 
          parentField, 
          parentId, 
          maxDepth,
          new Set(visited), // Pass copy of visited
          depth + 1
        );
      }
    } catch (error) {
      // Log warning but don't fail - this is a best-effort validation
      console.warn(`Could not validate cycle detection for ${entityName}:`, error);
    }
  }
} 