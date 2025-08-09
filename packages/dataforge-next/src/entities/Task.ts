import { Entity, Property, ManyToOne, OneToMany, Collection, Check } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import type { Project } from './Project.js';
import type { User } from './User.js';
import type { Comment } from './Comment.js';

@Entity()
@Check({ expression: 'start_date IS NULL OR due_date IS NULL OR start_date <= due_date' })
export class Task extends BaseDomainEntity {
  @Property({ type: 'string' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', default: 'pending' })
  status!: string;

  @Property({ type: 'string', default: 'medium' })
  priority!: string;

  @Property({ type: 'date', nullable: true })
  dueDate?: Date;

  @Property({ type: 'date', nullable: true })
  startDate?: Date;

  @Property({ type: 'integer', default: 0 })
  estimatedHours!: number;

  @Property({ type: 'integer', default: 0 })
  actualHours!: number;

  @Property({ type: 'integer', default: 0 })
  completionPercentage!: number;

  @Property({ type: 'json', nullable: true })
  tags?: string[];

  @ManyToOne(() => 'Project', { nullable: true })
  project?: Project;

  @ManyToOne(() => 'User', { nullable: true })
  assignee?: User;

  @ManyToOne(() => 'Task', { nullable: true })
  parent?: Task;

  @OneToMany(() => 'Task', 'parent')
  subtasks = new Collection<Task>(this);

  @OneToMany(() => 'Comment', 'task')
  comments = new Collection<Comment>(this);
}