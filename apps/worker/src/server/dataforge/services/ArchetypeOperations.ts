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
   * Validate data against archetype business logic
   */
  validateArchetypeData(
    archetype: string,
    data: Record<string, any>
  ): { valid: boolean; data: Record<string, any>; errors: string[] } {
    const errors: string[] = [];

    // Basic validation - ensure we have some data and no empty required fields
    if (!data || Object.keys(data).length === 0) {
      errors.push('Data cannot be empty');
    }

    // Ensure organization_id is present for multi-org isolation
    if (!data.organization_id) {
      errors.push('organization_id is required');
    }

    // Basic archetype-specific validation
    try {
      switch (archetype) {
        case 'record':
        case 'project':
        case 'task':
          // These archetypes typically require a name
          if (!data.name || data.name.trim() === '') {
            errors.push('name is required');
          }
          break;
        case 'document':
          // Documents might require content
          if (!data.content && !data.title) {
            errors.push('Document must have either content or title');
          }
          break;
        case 'file':
          // Files require a URL
          if (!data.file_url) {
            errors.push('file_url is required for file archetype');
          }
          break;
        case 'activity':
          // Activities require an action type
          if (!data.action_type) {
            errors.push('action_type is required for activity archetype');
          }
          break;
        case 'discussion':
          // Discussions require a title or initial message
          if (!data.title && !data.message) {
            errors.push('Discussion must have either title or message');
          }
          break;
        case 'collection':
          // Collections require a collection type
          if (!data.collection_type) {
            errors.push('collection_type is required for collection archetype');
          }
          break;
        default:
          // Generic validation for unknown archetypes
          console.log(`[ArchetypeOperations] No specific validation for archetype: ${archetype}`);
          break;
      }

      return {
        valid: errors.length === 0,
        data: { ...data }, // Return validated data
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
        name: { type: 'text', required: true },
        description: { type: 'text', required: false },
        status: { type: 'text', required: false },
        priority: { type: 'text', required: false },
        assignee: { type: 'text', required: false },
        due_date: { type: 'date', required: false }
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