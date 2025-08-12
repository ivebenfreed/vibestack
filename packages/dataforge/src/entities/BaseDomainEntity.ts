import { Property } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';

export abstract class BaseDomainEntity extends BaseSystemEntity {
  @Property({ type: 'uuid', nullable: true })
  clientId?: string;

  @Property({ type: 'string', fieldName: 'container_type' })
  containerType!: string; // project, department, workspace, user, system

  @Property({ type: 'uuid', fieldName: 'container_id' })
  containerId!: string;

  @Property({ type: 'string' })
  archetype!: string; // project, task, record, document, file, activity, discussion, collection

  // Computed properties (persist: false)
  get isProjectContainer(): boolean {
    return this.containerType === 'project';
  }

  get isDepartmentContainer(): boolean {
    return this.containerType === 'department';
  }

  get isUserContainer(): boolean {
    return this.containerType === 'user';
  }

  get isSystemContainer(): boolean {
    return this.containerType === 'system';
  }
}