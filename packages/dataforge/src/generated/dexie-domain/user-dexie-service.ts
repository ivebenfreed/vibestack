// Generated Dexie domain service for User
import { db } from '../dexie-schema.js';
import type { User } from '../client-entities.js';

export interface UserUpdateInput {
  name?: any;
  email?: any;
  emailVerified?: any;
  image?: any;
  isSuperAdmin?: any;
  account?: any;
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
    
    await db.users.add(record);
    return id;
  }

  async findById(id: string): Promise<User | undefined> {
    return await db.users.get(id);
  }

  async findAll(): Promise<User[]> {
    return await db.users.toArray();
  }

  async update(id: string, updates: UserUpdateInput): Promise<void> {
    await db.users.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.users.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.users.clear();
  }
}

export const userDexieService = new UserDexieService();
