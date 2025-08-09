import { Entity, Property, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import type { Task } from './Task.js';
import type { User } from './User.js';

@Entity()
export class Project extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', default: 'active' })
  status!: string;

  @Property({ type: 'date', nullable: true })
  startDate?: Date;

  @Property({ type: 'date', nullable: true })
  endDate?: Date;

  @Property({ type: 'string', nullable: true })
  color?: string;

  @ManyToOne(() => 'User', { nullable: true })
  owner?: User;

  @OneToMany(() => 'Task', 'project')
  tasks = new Collection<Task>(this);
}