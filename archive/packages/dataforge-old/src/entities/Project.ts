import { Entity, Property, ManyToOne, OneToMany, ManyToMany, Collection } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Task } from './Task.js';
import { User } from './User.js';
import { TagSet } from './TagSet.js';
import { StatusSet } from './StatusSet.js';

@Entity()
export class Project extends BaseDomainEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', default: 'active' })
  status!: string;

  @ManyToOne(() => User, { nullable: true, fieldName: 'owner_id' })
  owner?: User;

  @OneToMany(() => Task, 'project')
  tasks = new Collection<Task>(this);

  @ManyToMany(() => TagSet, 'projects', { 
    owner: true, 
    pivotTable: 'project_tag_sets',
    joinColumn: 'project_id',
    inverseJoinColumn: 'tag_set_id'
  })
  tagSets = new Collection<TagSet>(this);

  @ManyToMany(() => StatusSet, 'projects', { 
    owner: true, 
    pivotTable: 'project_status_sets',
    joinColumn: 'project_id',
    inverseJoinColumn: 'status_set_id'
  })
  statusSets = new Collection<StatusSet>(this);
}