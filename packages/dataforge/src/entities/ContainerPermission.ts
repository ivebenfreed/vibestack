import { Entity, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { User } from './User.js';

@Entity()
@Unique({ properties: ['userId', 'containerType', 'containerId'] })
export class ContainerPermission extends BaseDomainEntity {
  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @Property({ type: 'string', fieldName: 'permission_container_type' })
  permissionContainerType!: string; // project, department, workspace, user, system

  @Property({ type: 'uuid', fieldName: 'permission_container_id' })
  permissionContainerId!: string;

  @Property({ type: 'string', default: 'viewer' })
  role!: string; // admin, owner, member, viewer

  @Property({ type: 'timestamptz', nullable: true })
  grantedAt?: Date;

  @ManyToOne(() => User, { nullable: true, fieldName: 'granted_by_id' })
  grantedBy?: User;

  @Property({ type: 'timestamptz', nullable: true })
  expiresAt?: Date;

  @Property({ type: 'json', nullable: true })
  restrictions?: any; // Field-level or operation-specific restrictions
}