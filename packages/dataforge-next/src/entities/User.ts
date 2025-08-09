import { Entity, Property, Unique, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import type { Account } from './Account.js';
import type { Task } from './Task.js';
import type { Comment } from './Comment.js';
import type { Project } from './Project.js';

@Entity()
export class User extends BaseSystemEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string', nullable: true })
  @Unique()
  email?: string;

  @Property({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Property({ type: 'string', nullable: true })
  image?: string;

  @Property({ type: 'boolean', default: false })
  isSuperAdmin!: boolean;

  @ManyToOne(() => 'Account', { nullable: true })
  account?: Account;

  @OneToMany(() => 'Task', 'assignee')
  assignedTasks = new Collection<Task>(this);

  @OneToMany(() => 'Task', 'createdBy')
  createdTasks = new Collection<Task>(this);

  @OneToMany(() => 'Comment', 'createdBy')
  comments = new Collection<Comment>(this);

  @OneToMany(() => 'Project', 'createdBy')
  createdProjects = new Collection<Project>(this);
}