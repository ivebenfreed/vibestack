// Generated Dexie domain service for TagSet
import { db } from '../dexie-schema.js';
import type { TagSet } from '../client-entities.js';

export interface TagSetUpdateInput {
  clientId?: any;
  name?: any;
  description?: any;
  category?: any;
  isSystem?: any;
  isActive?: any;
  defaultColor?: any;
  displayOrder?: any;
  isExclusive?: any;
  maxTags?: any;
  metadata?: any;
  tags?: any;
  projects?: any;
}

export class TagsetDexieService {
  async create(data: Partial<TagSet>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: TagSet = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as TagSet;
    
    await db.tag_sets.add(record);
    return id;
  }

  async findById(id: string): Promise<TagSet | undefined> {
    return await db.tag_sets.get(id);
  }

  async findAll(): Promise<TagSet[]> {
    return await db.tag_sets.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: TagSetUpdateInput): Promise<void> {
    await db.tag_sets.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.tag_sets.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.tag_sets.clear();
  }
}

export const tagsetDexieService = new TagsetDexieService();
