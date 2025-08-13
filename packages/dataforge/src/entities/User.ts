import { Entity, Property, Unique, OneToMany, Collection } from '@mikro-orm/core';
import { BaseAuthEntity } from './BaseAuthEntity.js';
import { Account } from './Account.js';
import { Session } from './Session.js';
import { Task } from './Task.js';
import { Comment } from './Comment.js';
import { Project } from './Project.js';

@Entity()
export class User extends BaseAuthEntity {
  @Property({ type: 'string' })
  name!: string;

  @Property({ type: 'string', nullable: true })
  @Unique()
  email?: string;

  @Property({ type: 'boolean', default: false })
  email_verified!: boolean;

  @Property({ type: 'string', nullable: true })
  image?: string;

  @Property({ type: 'boolean', default: false })
  is_super_admin!: boolean;
  
  @Property({ type: 'string', default: 'member' })
  role!: string;

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