import { Entity, Property, ManyToOne, Unique } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { Organization } from './Organization.js';
import { User } from './User.js';

@Entity()
@Unique({ properties: ['organization', 'user'] })
export class OrganizationMember extends BaseSystemEntity {
  @ManyToOne(() => Organization, { fieldName: 'organization_id' })
  organization!: Organization;

  @ManyToOne(() => User, { fieldName: 'user_id' })
  user!: User;

  @Property({ type: 'string', default: 'member' })
  role!: string; // admin, member, viewer

  @Property({ type: 'string', default: 'active' })
  status!: string; // active, inactive, pending

  @Property({ type: 'timestamptz', nullable: true })
  invitedAt?: Date;

  @Property({ type: 'timestamptz', nullable: true })
  joinedAt?: Date;
}