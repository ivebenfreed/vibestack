// Generated Dexie domain service for Tag
import { db } from '../dexie-schema.js';
import type { Tag } from '../client-entities.js';

export interface TagUpdateInput {
  clientId?: any;
  name?: any;
  slug?: any;
  color?: any;
  icon?: any;
  variant?: any;
  sortOrder?: any;
  isActive?: any;
  usageCount?: any;
  lastUsedAt?: any;
  metadata?: any;
  tagSet?: any;
  parent?: any;
  children?: any;
  tasks?: any;
}

export class TagDexieService {
  async create(data: Partial<Tag>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: Tag = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as Tag;
    
    await db.tags.add(record);
    return id;
  }

  async findById(id: string): Promise<Tag | undefined> {
    return await db.tags.get(id);
  }

  async findAll(): Promise<Tag[]> {
    return await db.tags.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: TagUpdateInput): Promise<void> {
    await db.tags.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.tags.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.tags.clear();
  }
}

export const tagDexieService = new TagDexieService();
