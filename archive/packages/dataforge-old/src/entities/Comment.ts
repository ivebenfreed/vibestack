import { Entity, Property, ManyToOne } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Task } from './Task.js';
import { User } from './User.js';

@Entity()
export class Comment extends BaseDomainEntity {
  @Property({ type: 'text' })
  content!: string;

  @ManyToOne(() => Task, { fieldName: 'task_id' })
  task!: Task;

  @ManyToOne(() => User, { nullable: true, fieldName: 'author_id' })
  author?: User;
}