/**
 * ArchetypeOperations Service
 * 
 * Handles archetype-specific operations including schema creation,
 * metadata retrieval, and data validation.
 * Extracted from EntityManager to improve modularity.
 */

import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { FieldDefinition } from '../types';

export interface ArchetypeOperationsConfig {
  env?: {
    ORGANIZATION_ACTOR?: DurableObjectNamespace;
  };
}

export class ArchetypeOperations {
  constructor(private config: ArchetypeOperationsConfig) {}

  /**
   * Create archetype schema using OrganizationActor
   */
  async createArchetypeSchema(
    orgId: string,
    archetype: string,
    tableName: string,
    customFields: Record<string, FieldDefinition>
  ): Promise<{ success: boolean; ddl?: string; errors?: string[] }> {
    try {
      if (!this.config.env?.ORGANIZATION_ACTOR) {
        return {
          success: false,
          errors: ['OrganizationActor not available in environment']
        };
      }

      const doId = this.config.env.ORGANIZATION_ACTOR.idFromName(orgId);
      const doStub = this.config.env.ORGANIZATION_ACTOR.get(doId);

      const response = await doStub.fetch(new Request('http://localhost/create-archetype', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          archetype,
          tableName,
          fieldDefinitions: customFields
        })
      }));

      const result = await response.json();
      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Failed to create archetype schema: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get archetype metadata for an entity
   */
  async getArchetypeMetadata(
    orgId: string,
    tableName: string
  ): Promise<{ archetype: string; tableName: string; fieldDefinitions: Record<string, FieldDefinition> } | null> {
    try {
      if (!this.config.env?.ORGANIZATION_ACTOR) {
        return null;
      }

      const doId = this.config.env.ORGANIZATION_ACTOR.idFromName(orgId);
      const doStub = this.config.env.ORGANIZATION_ACTOR.get(doId);

      const response = await doStub.fetch(new Request(`http://localhost/archetype-entity/${tableName}`));
      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      if (!result.success) {
        return null;
      }

      return {
        archetype: result.entity.extends,
        tableName: result.entity.tableName,
        fieldDefinitions: result.entity.customFields
      };
    } catch (error) {
      console.error('[ArchetypeOperations] Failed to get archetype metadata:', error);
      return null;
    }
  }

  /**
   * Validate data against archetype business logic using the field validation system
   */
  async validateArchetypeData(
    archetype: string,
    data: Record<string, any>,
    orgId?: string
  ): Promise<{ valid: boolean; data: Record<string, any>; errors: string[] }> {
    console.log(`🔍 [ArchetypeOperations] validateArchetypeData called:`, { archetype, dataKeys: Object.keys(data), orgId });
    console.log(`🔍 [ArchetypeOperations] Full data:`, data);
    try {
      // Get archetype field definitions
      const archetypeFields = await this.getArchetypeFields(archetype);
      
      // Convert to FieldDefinition format for validation
      const fieldEntries = Object.entries(archetypeFields).map(([name, config]: [string, any]) => [
        name,
        {
          name,
          type: config.type || 'text',
          required: config.required || false,
          defaultValue: config.defaultValue,
          unique: config.unique || false,
          indexed: config.indexed || false,
          min: config.min,
          max: config.max,
          enum: config.enum,
          regex: config.regex
        }
      ]);

      // Use the field validation pipeline
      const { FieldValidationPipeline } = await import('../validation/FieldValidationPipeline');
      const pipeline = new FieldValidationPipeline();
      
      const validationResult = await pipeline.validate({
        data,
        fields: new Map(fieldEntries),
        orgId,
        archetype
      });

      // Convert validation result format
      const errors: string[] = [];
      
      if (!validationResult.isValid) {
        for (const error of validationResult.errors) {
          if (typeof error === 'string') {
            errors.push(error);
          } else if (error.message) {
            errors.push(`${error.field || 'Field'}: ${error.message}`);
          }
        }
      }

      // Basic required field validation (organization_id is system-critical)
      if (!data.organization_id && orgId) {
        data.organization_id = orgId; // Auto-set if provided
      }
      
      if (!data.organization_id) {
        errors.push('organization_id is required');
      }

      return {
        valid: errors.length === 0,
        data: validationResult.transformedData || data,
        errors
      };
    } catch (error) {
      return {
        valid: false,
        data: {},
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Get archetype field definitions
   */
  async getArchetypeFields(archetype: string): Promise<Record<string, any>> {
    // This would typically fetch from a registry or configuration
    // For now, returning a basic structure
    const baseFields: Record<string, any> = {
      id: { type: 'text', required: true },
      organization_id: { type: 'text', required: true },
      created_at: { type: 'timestamp', required: true },
      updated_at: { type: 'timestamp', required: true },
      created_by: { type: 'text', required: false }
    };

    const archetypeSpecificFields: Record<string, Record<string, any>> = {
      record: {
        name: { type: 'text', required: true },
        description: { type: 'text', required: false },
        status: { type: 'text', required: false }
      },
      project: {
        name: { type: 'text', required: true },
        description: { type: 'text', required: false },
        status: { type: 'text', required: false },
        start_date: { type: 'date', required: false },
        end_date: { type: 'date', required: false },
        progress: { type: 'number', required: false }
      },
      task: {
        title: { type: 'text', required: true },
        description: { type: 'text', required: false },
        status: { type: 'text', required: true },
        priority: { type: 'text', required: true },
        due_date: { type: 'date', required: false },
        start_date: { type: 'date', required: false },
        label: { type: 'text', required: false },
        tags: { type: 'jsonb', required: false }
      },
      document: {
        title: { type: 'text', required: true },
        content: { type: 'text', required: false },
        version: { type: 'number', required: false },
        document_type: { type: 'text', required: false }
      },
      file: {
        name: { type: 'text', required: true },
        file_url: { type: 'text', required: true },
        file_type: { type: 'text', required: false },
        file_size: { type: 'number', required: false },
        metadata: { type: 'jsonb', required: false }
      },
      activity: {
        action_type: { type: 'text', required: true },
        description: { type: 'text', required: false },
        actor_id: { type: 'text', required: false },
        target_id: { type: 'text', required: false },
        metadata: { type: 'jsonb', required: false }
      },
      discussion: {
        title: { type: 'text', required: true },
        message: { type: 'text', required: false },
        participants: { type: 'jsonb', required: false },
        status: { type: 'text', required: false }
      },
      collection: {
        name: { type: 'text', required: true },
        collection_type: { type: 'text', required: true },
        items: { type: 'jsonb', required: false },
        metadata: { type: 'jsonb', required: false }
      }
    };

    return {
      ...baseFields,
      ...(archetypeSpecificFields[archetype] || {})
    };
  }
}