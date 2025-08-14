import { Entity, Property, OneToMany, Collection, Unique } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { OrganizationMember } from './OrganizationMember.js';
import { DatabaseInstance } from './DatabaseInstance.js';

@Entity()
export class Organization extends BaseSystemEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string' })
  @Unique()
  slug!: string;

  @Property({ type: 'string', nullable: true })
  domain?: string;

  @Property({ type: 'json', nullable: true })
  settings?: any;

  @Property({ type: 'string', default: 'free' })
  planType!: string; // free, pro, enterprise

  @Property({ type: 'string', default: 'active' })
  status!: string; // active, suspended, cancelled

  @OneToMany(() => OrganizationMember, 'organization')
  members = new Collection<OrganizationMember>(this);

  @OneToMany(() => DatabaseInstance, 'organization')
  databases = new Collection<DatabaseInstance>(this);
}