import { Entity, Property, ManyToOne, OneToMany, ManyToMany, Collection, Check } from '@mikro-orm/core';
import { BaseDomainEntity } from './BaseDomainEntity.js';
import { Project } from './Project.js';
import { User } from './User.js';
import { Comment } from './Comment.js';
import { Tag } from './Tag.js';

@Entity()
@Check({ expression: 'start_date IS NULL OR due_date IS NULL OR start_date <= due_date' })
export class Task extends BaseDomainEntity {
  @Property({ type: 'string' })
  title!: string;

  @Property({ type: 'text', nullable: true })
  description?: string;

  @Property({ type: 'string', nullable: true, columnType: 'tasks_legacy_status_enum', fieldName: 'legacy_status' })
  legacyStatus?: string;

  @Property({ type: 'string', default: 'medium', columnType: 'tasks_priority_enum' })
  priority!: string;

  @Property({ type: 'date', nullable: true, fieldName: 'due_date' })
  dueDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'start_date' })
  startDate?: Date;

  @Property({ type: 'date', nullable: true, fieldName: 'completed_at' })
  completedAt?: Date;

  @Property({ type: 'string', nullable: true, columnType: 'tsrange', fieldName: 'time_range' })
  timeRange?: string;

  @Property({ type: 'string', nullable: true, columnType: 'interval', fieldName: 'estimated_duration' })
  estimatedDuration?: string;

  @Property({ type: 'array', nullable: true, fieldName: 'legacy_tags' })
  legacyTags?: string[];

  @ManyToOne(() => Project, { nullable: true, fieldName: 'project_id' })
  project?: Project;

  @ManyToOne(() => User, { nullable: true, fieldName: 'assignee_id' })
  assignee?: User;

  @OneToMany(() => Comment, 'task')
  comments = new Collection<Comment>(this);

  @ManyToMany(() => Tag, 'tasks', { 
    owner: true, 
    pivotTable: 'task_tags',
    joinColumn: 'task_id',
    inverseJoinColumn: 'tag_id'
  })
  tags = new Collection<Tag>(this);
}