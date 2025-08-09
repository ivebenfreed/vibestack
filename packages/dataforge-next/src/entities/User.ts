import { Entity, Property, Unique, ManyToOne, OneToMany, Collection } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { Account } from './Account.js';
import { Task } from './Task.js';
import { Comment } from './Comment.js';
import { Project } from './Project.js';

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

  @ManyToOne(() => Account, { nullable: true })
  account?: Account;

  @OneToMany(() => Task, 'assignee')
  assignedTasks = new Collection<Task>(this);

  @OneToMany(() => Comment, 'author')
  comments = new Collection<Comment>(this);

  @OneToMany(() => Project, 'owner')
  ownedProjects = new Collection<Project>(this);
}