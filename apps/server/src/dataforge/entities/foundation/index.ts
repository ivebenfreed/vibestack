/**
 * Foundation Entities - Organized Structure
 * 
 * Foundation entities provide the hardcoded system infrastructure for the platform.
 * Business entities like "project" and "task" are created dynamically via JSON archetypes.
 */

// Import classes for FoundationEntityRegistry
import { User } from './core/User';
import { EntityRelationship } from './core/EntityRelationship';
import { ContainerPermission } from './access/ContainerPermission';
import { ProjectArchetype } from './archetypes/Project';
import { TaskArchetype } from './archetypes/Task';
import { Record } from './archetypes/RecordArchetype';
import { Document } from './archetypes/DocumentArchetype';
import { File } from './archetypes/FileArchetype';
import { Activity } from './archetypes/ActivityArchetype';
import { Discussion } from './archetypes/DiscussionArchetype';
import { Collection } from './archetypes/CollectionArchetype';

// Base entities
export * from '../base';

// Core entities (users, relationships)
export * from './core/User';
export * from './core/EntityRelationship';

// Access control entities
export * from './access/ContainerPermission';

// Universal systems (labels, options, etc.)
export * from './universal';

// Universal archetype patterns (templates for JSON entities)
export * from './archetypes/Project';
export * from './archetypes/Task';
export * from './archetypes/RecordArchetype';
export * from './archetypes/DocumentArchetype';
export * from './archetypes/FileArchetype';
export * from './archetypes/ActivityArchetype';
export * from './archetypes/DiscussionArchetype';
export * from './archetypes/CollectionArchetype';

// Type exports
export type { UserFields } from './core/User';
export type { EntityRelationshipFields } from './core/EntityRelationship';
export type { ContainerPermissionFields } from './access/ContainerPermission';
export type { ProjectFields } from './archetypes/Project';
export type { TaskFields } from './archetypes/Task';
export type { RecordFields } from './archetypes/RecordArchetype';
export type { DocumentFields } from './archetypes/DocumentArchetype';
export type { FileFields } from './archetypes/FileArchetype';
export type { ActivityFields } from './archetypes/ActivityArchetype';
export type { DiscussionFields } from './archetypes/DiscussionArchetype';
export type { CollectionFields } from './archetypes/CollectionArchetype';

// Utility exports
export { UserUtilities } from './core/User';
export { EntityRelationshipUtilities } from './core/EntityRelationship';
export { ContainerPermissionUtilities } from './access/ContainerPermission';
export { ProjectUtilities } from './archetypes/Project';
export { TaskUtilities } from './archetypes/Task';
export { RecordUtilities } from './archetypes/RecordArchetype';
export { DocumentUtilities } from './archetypes/DocumentArchetype';
export { FileUtilities } from './archetypes/FileArchetype';
export { ActivityUtilities } from './archetypes/ActivityArchetype';
export { DiscussionUtilities } from './archetypes/DiscussionArchetype';
export { CollectionUtilities } from './archetypes/CollectionArchetype';

/**
 * Foundation Entity Registry
 * Registry for hardcoded system entities only
 */
export class FoundationEntityRegistry {
  /**
   * Get hardcoded system entity classes
   */
  static getEntityClasses() {
    return {
      User,
      EntityRelationship,
      ContainerPermission,
      Project: ProjectArchetype,
      Task: TaskArchetype,
      Record: Record,
      Document: Document,
      File: File,
      Activity: Activity,
      Discussion: Discussion,
      Collection: Collection
    };
  }

  /**
   * Get Kysely schemas for system entities
   */
  static getKyselySchemas() {
    const entities = this.getEntityClasses();
    
    return {
      user: entities.User.getKyselySchema(),
      entity_relationship: entities.EntityRelationship.getKyselySchema(),
      container_permission: entities.ContainerPermission.getKyselySchema(),
      project: entities.Project.getKyselySchema(),
      task: entities.Task.getKyselySchema(),
      record: entities.Record.getKyselySchema(),
      document: entities.Document.getKyselySchema(),
      file: entities.File.getKyselySchema(),
      activity: entities.Activity.getKyselySchema(),
      discussion: entities.Discussion.getKyselySchema(),
      collection: entities.Collection.getKyselySchema()
    };
  }

  /**
   * Get DDL statements for system entities
   */
  static getDDLStatements(): string[] {
    const entities = this.getEntityClasses();
    
    return [
      entities.User.getUserDDL(),
      entities.EntityRelationship.getEntityRelationshipDDL(),
      entities.ContainerPermission.getContainerPermissionDDL(),
      entities.Project.getProjectDDL(),
      entities.Task.getTaskDDL(),
      entities.Record.getRecordDDL(),
      entities.Document.getDocumentDDL(),
      entities.File.getFileDDL(),
      entities.Activity.getActivityDDL(),
      entities.Discussion.getDiscussionDDL(),
      entities.Collection.getCollectionDDL()
    ];
  }

  /**
   * Get index statements for system entities
   */
  static getIndexStatements(): string[] {
    const entities = this.getEntityClasses();
    
    return [
      ...entities.User.getUserIndexes(),
      ...entities.EntityRelationship.getEntityRelationshipIndexes(),
      ...entities.ContainerPermission.getContainerPermissionIndexes(),
      ...entities.Project.getProjectIndexes(),
      ...entities.Task.getTaskIndexes(),
      ...entities.Record.getRecordIndexes(),
      ...entities.Document.getDocumentIndexes(),
      ...entities.File.getFileIndexes(),
      ...entities.Activity.getActivityIndexes(),
      ...entities.Discussion.getDiscussionIndexes(),
      ...entities.Collection.getCollectionIndexes()
    ];
  }

  /**
   * Universal archetype patterns (for JSON entity creation)
   */
  static getUniversalArchetypes(): string[] {
    return ['project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'];
  }

  /**
   * Supported relationship types
   */
  static getSupportedRelationshipTypes(): string[] {
    return [
      'depends_on', 'blocks', 'blocked_by', 'relates_to', 'references', 
      'referenced_by', 'contains', 'contained_by', 'parent_of', 'child_of',
      'duplicates', 'duplicated_by', 'follows', 'preceded_by'
    ];
  }

  /**
   * Validate archetype pattern
   */
  static isValidArchetypePattern(archetype: string): boolean {
    return this.getUniversalArchetypes().includes(archetype);
  }

  /**
   * Validate relationship type
   */
  static isValidRelationshipType(type: string): boolean {
    return this.getSupportedRelationshipTypes().includes(type);
  }

  /**
   * Get archetype pattern class (for JSON entity templates)
   */
  static getArchetypePatternClass(archetype: string) {
    const entities = this.getEntityClasses();
    
    switch (archetype) {
      case 'project': return entities.Project;
      case 'task': return entities.Task;
      case 'record': return entities.Record;
      case 'document': return entities.Document;
      case 'file': return entities.File;
      case 'activity': return entities.Activity;
      case 'discussion': return entities.Discussion;
      case 'collection': return entities.Collection;
      default: return null;
    }
  }
}

/**
 * Foundation Integration Utilities
 */
export class FoundationIntegrationUtilities {
  /**
   * Get foundation entity metrics
   */
  static getEntityMetrics(entities: any[]): any {
    const metrics = {
      total: entities.length,
      byType: {} as Record<string, number>,
      byStatus: {} as Record<string, number>,
      byContainer: {} as Record<string, number>
    };

    entities.forEach(entity => {
      // Count by entity type
      const type = entity.constructor.name || 'unknown';
      metrics.byType[type] = (metrics.byType[type] || 0) + 1;

      // Count by status
      if (entity.status) {
        metrics.byStatus[entity.status] = (metrics.byStatus[entity.status] || 0) + 1;
      }

      // Count by container
      if (entity.container_type) {
        const containerKey = `${entity.container_type}:${entity.container_id}`;
        metrics.byContainer[containerKey] = (metrics.byContainer[containerKey] || 0) + 1;
      }
    });

    return metrics;
  }

  /**
   * Convert foundation entity to public API format
   */
  static toPublicFormat(entity: any): any {
    if (entity.constructor.name === 'User') {
      const { UserUtilities } = require('./core/User');
      return UserUtilities.toPublicData(entity);
    }
    
    // Fallback to basic toJSON
    return entity.toJSON ? entity.toJSON() : entity;
  }
}

export default FoundationEntityRegistry;