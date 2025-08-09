import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import type { Task } from './Task.js';
import type { User } from './User.js';

@Entity()
export class Comment extends BaseDomainEntity {
  @Property({ type: 'text' })
  content!: string;

  @ManyToOne(() => 'Task')
  task!: Task;

  @ManyToOne(() => 'User', { nullable: true })
  author?: User;
}