// Generated Dexie domain service for User
import { db } from '../dexie-schema.js';
import type { User } from '../client-entities.js';

export interface UserUpdateInput {
  name?: any;
  email?: any;
  emailVerified?: any;
  image?: any;
  isSuperAdmin?: any;
  role?: any;
  accounts?: any;
  sessions?: any;
  assignedTasks?: any;
  comments?: any;
  ownedProjects?: any;
}

export class UserDexieService {
  async create(data: Partial<User>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: User = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as User;
    
    await db.user.add(record);
    return id;
  }

  async findById(id: string): Promise<User | undefined> {
    return await db.user.get(id);
  }

  async findAll(): Promise<User[]> {
    return await db.user.toArray();
  }

  async update(id: string, updates: UserUpdateInput): Promise<void> {
    await db.user.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.user.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.user.clear();
  }
}

export const userDexieService = new UserDexieService();
