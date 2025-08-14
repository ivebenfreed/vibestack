/**
 * BaseDomainEntity - Enhanced Domain Foundation Entity
 * 
 * Adapted from archived DataForge for server-only Kysely implementation.
 * Provides container access control, archetype classification, and client sync support.
 */

import { BaseSystemEntity, type BaseSystemEntityFields } from './BaseSystemEntity';

export interface BaseDomainEntityFields extends BaseSystemEntityFields {
  client_id?: string | null;
  container_type: string;
  container_id: string;
  archetype: string;
  status: string;
}

export abstract class BaseDomainEntity extends BaseSystemEntity {
  client_id?: string | null;
  container_type!: string; // project, department, workspace, user, system
  container_id!: string;
  archetype!: string; // project, task, record, document, file, activity, discussion, collection
  status!: string; // active, inactive, archived, deleted

  constructor(data?: Partial<BaseDomainEntityFields>) {
    super(data);
    if (data) {
      Object.assign(this, data);
    }
    
    // Set domain defaults if not provided
    if (!this.status) this.status = 'active';
  }

  /**
   * Get the enhanced Kysely schema including domain fields
   */
  static getKyselySchema() {
    return {
      ...super.getKyselySchema(),
      client_id: 'uuid',
      container_type: 'varchar(50)',
      container_id: 'uuid', 
      archetype: 'varchar(50)',
      status: 'varchar(50)'
    } as const;
  }

  /**
   * Get the SQL DDL for creating domain entity tables
   */
  static getDomainDDL(): string {
    return `
      ${BaseSystemEntity.getBaseDDL()},
      client_id UUID,
      container_type VARCHAR(50) NOT NULL,
      container_id UUID NOT NULL,
      archetype VARCHAR(50) NOT NULL,
      status VARCHAR(50) DEFAULT 'active' NOT NULL
    `;
  }

  /**
   * Get domain-specific indexes for performance
   */
  static getDomainIndexes(tableName: string): string[] {
    return [
      ...BaseSystemEntity.getBaseIndexes(tableName),
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_container ON ${tableName}(container_type, container_id);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_archetype ON ${tableName}(archetype);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_status ON ${tableName}(status);`,
      `CREATE INDEX IF NOT EXISTS idx_${tableName}_client_id ON ${tableName}(client_id);`
    ];
  }

  // Container Type Helpers
  get isProjectContainer(): boolean {
    return this.container_type === 'project';
  }

  get isDepartmentContainer(): boolean {
    return this.container_type === 'department';
  }

  get isWorkspaceContainer(): boolean {
    return this.container_type === 'workspace';
  }

  get isUserContainer(): boolean {
    return this.container_type === 'user';
  }

  get isSystemContainer(): boolean {
    return this.container_type === 'system';
  }

  // Archetype Helpers
  get isProjectArchetype(): boolean {
    return this.archetype === 'project';
  }

  get isTaskArchetype(): boolean {
    return this.archetype === 'task';
  }

  get isRecordArchetype(): boolean {
    return this.archetype === 'record';
  }

  get isDocumentArchetype(): boolean {
    return this.archetype === 'document';
  }

  get isFileArchetype(): boolean {
    return this.archetype === 'file';
  }

  get isActivityArchetype(): boolean {
    return this.archetype === 'activity';
  }

  get isDiscussionArchetype(): boolean {
    return this.archetype === 'discussion';
  }

  get isCollectionArchetype(): boolean {
    return this.archetype === 'collection';
  }

  // Status Helpers
  get isActive(): boolean {
    return this.status === 'active';
  }

  get isInactive(): boolean {
    return this.status === 'inactive';
  }

  get isArchived(): boolean {
    return this.status === 'archived';
  }

  get isDeleted(): boolean {
    return this.status === 'deleted';
  }

  /**
   * Check if this entity belongs to a specific container
   */
  belongsToContainer(containerType: string, containerId: string): boolean {
    return this.container_type === containerType && this.container_id === containerId;
  }

  /**
   * Check if this entity matches a specific archetype
   */
  isArchetypeType(archetype: string): boolean {
    return this.archetype === archetype;
  }

  /**
   * Get container hierarchy information
   */
  getContainerInfo(): {
    type: string;
    id: string;
    isProject: boolean;
    isDepartment: boolean;
    isWorkspace: boolean;
    isUser: boolean;
    isSystem: boolean;
  } {
    return {
      type: this.container_type,
      id: this.container_id,
      isProject: this.isProjectContainer,
      isDepartment: this.isDepartmentContainer,
      isWorkspace: this.isWorkspaceContainer,
      isUser: this.isUserContainer,
      isSystem: this.isSystemContainer
    };
  }

  /**
   * Get archetype classification information
   */
  getArchetypeInfo(): {
    type: string;
    isProject: boolean;
    isTask: boolean;
    isRecord: boolean;
    isDocument: boolean;
    isFile: boolean;
    isActivity: boolean;
    isDiscussion: boolean;
    isCollection: boolean;
  } {
    return {
      type: this.archetype,
      isProject: this.isProjectArchetype,
      isTask: this.isTaskArchetype,
      isRecord: this.isRecordArchetype,
      isDocument: this.isDocumentArchetype,
      isFile: this.isFileArchetype,
      isActivity: this.isActivityArchetype,
      isDiscussion: this.isDiscussionArchetype,
      isCollection: this.isCollectionArchetype
    };
  }

  /**
   * Prepare data for database insertion with domain fields
   */
  prepareForInsert(createdBy?: string): BaseDomainEntityFields {
    const baseFields = super.prepareForInsert(createdBy);
    return {
      ...baseFields,
      client_id: this.client_id || null,
      container_type: this.container_type,
      container_id: this.container_id,
      archetype: this.archetype,
      status: this.status || 'active'
    };
  }

  /**
   * Prepare data for database update with domain fields
   */
  prepareForUpdate(): Partial<BaseDomainEntityFields> {
    const baseFields = super.prepareForUpdate();
    return {
      ...baseFields,
      status: this.status
    };
  }

  /**
   * Convert to JSON
   */
  toJSON(): BaseDomainEntityFields {
    const baseFields = super.toJSON();
    return {
      ...baseFields,
      client_id: this.client_id || null,
      container_type: this.container_type,
      container_id: this.container_id,
      archetype: this.archetype,
      status: this.status
    };
  }

  /**
   * Convert to syncable format (exclude server-only fields)
   */
  toSyncableFields(): Omit<BaseDomainEntityFields, 'created_by_id'> {
    const baseFields = super.toSyncableFields();
    return {
      ...baseFields,
      client_id: this.client_id || null,
      container_type: this.container_type,
      container_id: this.container_id,
      archetype: this.archetype,
      status: this.status
    };
  }

  /**
   * Apply status change with validation
   */
  changeStatus(newStatus: string, changedBy?: string): boolean {
    const validStatuses = ['active', 'inactive', 'archived', 'deleted'];
    if (!validStatuses.includes(newStatus)) {
      return false;
    }

    // Business logic for status transitions
    if (this.status === 'deleted' && newStatus !== 'deleted') {
      return false; // Cannot restore deleted entities
    }

    if (this.status === 'archived' && newStatus === 'active') {
      // Allow restoring archived entities
    }

    this.status = newStatus;
    return true;
  }

  /**
   * Soft delete the entity
   */
  softDelete(deletedBy?: string): void {
    this.changeStatus('deleted', deletedBy);
  }

  /**
   * Archive the entity
   */
  archive(archivedBy?: string): void {
    this.changeStatus('archived', archivedBy);
  }

  /**
   * Activate the entity
   */
  activate(activatedBy?: string): void {
    this.changeStatus('active', activatedBy);
  }
}

/**
 * Container Assignment Utility
 * Provides automatic container assignment based on entity type and business rules
 */
export class ContainerAssignment {
  /**
   * Determine appropriate container for an entity based on archetype
   */
  static determineContainer(archetype: string, parentEntity?: BaseDomainEntity): {
    containerType: string;
    containerId: string;
  } {
    switch (archetype) {
      case 'project':
        return { containerType: 'workspace', containerId: parentEntity?.container_id || 'default' };
      
      case 'task':
        if (parentEntity?.isProjectArchetype) {
          return { containerType: 'project', containerId: parentEntity.id };
        }
        return { containerType: 'workspace', containerId: 'default' };
      
      case 'record':
      case 'document':
        return { containerType: parentEntity?.container_type || 'project', containerId: parentEntity?.container_id || 'default' };
      
      case 'file':
        return { containerType: parentEntity?.container_type || 'project', containerId: parentEntity?.container_id || 'default' };
      
      case 'activity':
        return { containerType: 'system', containerId: 'activity-log' };
      
      case 'discussion':
        return { containerType: parentEntity?.container_type || 'workspace', containerId: parentEntity?.container_id || 'default' };
      
      case 'collection':
        return { containerType: 'workspace', containerId: 'collections' };
      
      default:
        return { containerType: 'workspace', containerId: 'default' };
    }
  }

  /**
   * Validate container assignment rules
   */
  static validateContainer(archetype: string, containerType: string, containerId: string): boolean {
    // Business rules for valid container assignments
    switch (archetype) {
      case 'task':
        return ['project', 'workspace'].includes(containerType);
      
      case 'activity':
        return containerType === 'system';
      
      case 'project':
        return ['workspace', 'department'].includes(containerType);
      
      default:
        return ['project', 'workspace', 'department', 'user', 'system'].includes(containerType);
    }
  }
}