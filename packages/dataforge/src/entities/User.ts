import { Entity, Property, Unique, OneToMany, Collection } from '@mikro-orm/core';
import { BaseSystemEntity } from './BaseSystemEntity.js';
import { Account } from './Account.js';
import { Session } from './Session.js';
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

  @Property({ type: 'boolean', default: false, fieldName: 'email_verified' })
  emailVerified!: boolean;

  @Property({ type: 'string', nullable: true })
  image?: string;

  @Property({ type: 'boolean', default: false, fieldName: 'is_super_admin' })
  isSuperAdmin!: boolean;

  @OneToMany(() => Account, 'user')
  accounts = new Collection<Account>(this);
  
  @OneToMany(() => Session, 'user')
  sessions = new Collection<Session>(this);

  @OneToMany(() => Task, 'assignee')
  assignedTasks = new Collection<Task>(this);

  @OneToMany(() => Comment, 'author')
  comments = new Collection<Comment>(this);

  @OneToMany(() => Project, 'owner')
  ownedProjects = new Collection<Project>(this);
}