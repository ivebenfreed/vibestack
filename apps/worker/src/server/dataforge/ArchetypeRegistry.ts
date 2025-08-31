/**
 * ArchetypeRegistry - Updated to use individual archetype files
 * 
 * Imports from individual archetype files in /dataforge/archetypes/
 * for better organization and maintainability.
 */

import type { FieldDefinition } from './json-rules-engine';
import type { ContainerPermissionSpec } from './container-permissions';
import { ProjectArchetype } from './archetypes/ProjectArchetype';
import { TaskArchetype } from './archetypes/TaskArchetype';
import { RecordArchetype } from './archetypes/RecordArchetype';
import { DocumentArchetype } from './archetypes/DocumentArchetype';
import { FileArchetype } from './archetypes/FileArchetype';
import { ActivityArchetype } from './archetypes/ActivityArchetype';
import { DiscussionArchetype } from './archetypes/DiscussionArchetype';
import { CollectionArchetype } from './archetypes/CollectionArchetype';
import { UniverseArchetype } from './archetypes/UniverseArchetype';
import { WorldArchetype } from './archetypes/WorldArchetype';

export type ArchetypeType = 
  | 'universe'
  | 'world'
  | 'project' 
  | 'task' 
  | 'record' 
  | 'document' 
  | 'file' 
  | 'activity' 
  | 'discussion' 
  | 'collection';

export interface ArchetypeDefinition {
  name: ArchetypeType;
  displayName: string;
  description: string;
  icon: string;
  baseFields: FieldDefinition[];
  
  // NEW: Container Permission Specifications
  containerPermissions: ContainerPermissionSpec;
  
  allowedCustomFields?: string[];
  defaultStatus?: string;
  supportsSoftDelete?: boolean;
  supportsVersioning?: boolean;
  supportsAttachments?: boolean;
  supportsComments?: boolean;
  supportsWorkflows?: boolean;
}

export class ArchetypeRegistry {
  private static readonly archetypeClasses = {
    universe: UniverseArchetype,
    world: WorldArchetype,
    project: ProjectArchetype,
    task: TaskArchetype,
    record: RecordArchetype,
    document: DocumentArchetype,
    file: FileArchetype,
    activity: ActivityArchetype,
    discussion: DiscussionArchetype,
    collection: CollectionArchetype
  };

  static getArchetypeClass(type: ArchetypeType) {
    return this.archetypeClasses[type];
  }

  static getAllArchetypes(): ArchetypeDefinition[] {
    return Object.keys(this.archetypeClasses).map(type => {
      const ArchetypeClass = this.archetypeClasses[type as ArchetypeType];
      const metadata = ArchetypeClass.metadata || {};
      return {
        name: type as ArchetypeType,
        displayName: metadata.displayName || ArchetypeClass.displayName || type,
        description: metadata.description || ArchetypeClass.description || '',
        icon: metadata.icon || ArchetypeClass.icon || 'square',
        baseFields: Object.entries(ArchetypeClass.fields).map(([name, field]) => ({
          name,
          type: field.type,
          required: field.required || false,
          syncable: field.syncable !== false
        })),
        
        // NEW: Include container permissions
        containerPermissions: ArchetypeClass.containerPermissions,
        
        defaultStatus: metadata.defaultStatus || ArchetypeClass.defaultStatus,
        supportsSoftDelete: metadata.supportsSoftDelete || ArchetypeClass.supportsSoftDelete,
        supportsAttachments: metadata.supportsAttachments || ArchetypeClass.supportsAttachments,
        supportsComments: metadata.supportsComments || ArchetypeClass.supportsComments,
        supportsWorkflows: metadata.supportsWorkflows || ArchetypeClass.supportsWorkflows
      };
    });
  }

  static validateArchetype(name: string): name is ArchetypeType {
    return name in this.archetypeClasses;
  }

  static getArchetypeDefinition(type: ArchetypeType): ArchetypeDefinition | null {
    const ArchetypeClass = this.archetypeClasses[type];
    if (!ArchetypeClass) return null;

    const metadata = ArchetypeClass.metadata || {};
    return {
      name: type,
      displayName: metadata.displayName || ArchetypeClass.displayName || type,
      description: metadata.description || ArchetypeClass.description || '',
      icon: metadata.icon || ArchetypeClass.icon || 'square',
      baseFields: Object.entries(ArchetypeClass.fields).map(([name, field]) => ({
        name,
        type: field.type,
        required: field.required || false,
        syncable: field.syncable !== false
      })),
      containerPermissions: ArchetypeClass.containerPermissions,
      defaultStatus: metadata.defaultStatus || ArchetypeClass.defaultStatus,
      supportsSoftDelete: metadata.supportsSoftDelete || ArchetypeClass.supportsSoftDelete,
      supportsAttachments: metadata.supportsAttachments || ArchetypeClass.supportsAttachments,
      supportsComments: metadata.supportsComments || ArchetypeClass.supportsComments,
      supportsWorkflows: metadata.supportsWorkflows || ArchetypeClass.supportsWorkflows
    };
  }
}