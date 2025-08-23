/**
 * Archetype Service
 * 
 * Handles archetype discovery and management for DataForge entities.
 */

export interface ArchetypeInfo {
  name: string;
  displayName: string;
  description: string;
  icon: string;
  baseFieldCount: number;
  features: {
    softDelete: boolean;
    versioning: boolean;
    attachments: boolean;
    comments: boolean;
    workflows: boolean;
  };
}

export interface ArchetypeDetails extends ArchetypeInfo {
  baseFields: any[];
  tableSuffix: string;
  supportedOperations: string[];
}

export interface ArchetypeListResult {
  success: boolean;
  data?: {
    archetypes: ArchetypeInfo[];
    total: number;
  };
  error?: string;
}

export interface ArchetypeDetailsResult {
  success: boolean;
  data?: ArchetypeDetails;
  error?: string;
}

export class ArchetypeService {
  /**
   * Get all available archetypes
   */
  async getAllArchetypes(): Promise<ArchetypeListResult> {
    try {
      const { ArchetypeRegistry } = await import('../ArchetypeRegistry');
      
      const archetypes = ArchetypeRegistry.getAllArchetypes();
      
      return {
        success: true,
        data: {
          archetypes: archetypes.map(arch => ({
            name: arch.name,
            displayName: arch.displayName,
            description: arch.description,
            icon: arch.icon,
            baseFieldCount: arch.baseFields.length,
            features: {
              softDelete: arch.supportsSoftDelete ?? false,
              versioning: arch.supportsVersioning ?? false,
              attachments: arch.supportsAttachments ?? false,
              comments: arch.supportsComments ?? false,
              workflows: arch.supportsWorkflows ?? false
            }
          })),
          total: archetypes.length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get archetypes: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get specific archetype details
   */
  async getArchetypeDetails(archetypeName: string): Promise<ArchetypeDetailsResult> {
    try {
      const { ArchetypeRegistry } = await import('../ArchetypeRegistry');
      
      const archetype = ArchetypeRegistry.getArchetype(archetypeName as any);
      
      if (!archetype) {
        return {
          success: false,
          error: `Archetype '${archetypeName}' not found`
        };
      }
      
      return {
        success: true,
        data: {
          name: archetype.name,
          displayName: archetype.displayName,
          description: archetype.description,
          icon: archetype.icon,
          baseFieldCount: archetype.baseFields.length,
          features: {
            softDelete: archetype.supportsSoftDelete ?? false,
            versioning: archetype.supportsVersioning ?? false,
            attachments: archetype.supportsAttachments ?? false,
            comments: archetype.supportsComments ?? false,
            workflows: archetype.supportsWorkflows ?? false
          },
          baseFields: archetype.baseFields.map(field => ({
            name: field.name,
            type: field.type,
            required: field.required ?? false,
            description: field.description ?? ''
          })),
          tableSuffix: archetype.tableSuffix || `${archetype.name.toLowerCase()}s`,
          supportedOperations: [
            'create', 'read', 'update', 
            ...(archetype.supportsSoftDelete ? ['soft-delete'] : ['delete']),
            'bulk-create', 'bulk-update', 'bulk-delete',
            'query', 'filter', 'sort', 'paginate'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get archetype details: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}