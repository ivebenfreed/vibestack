// Generated Dexie domain service for task_tags
import { db } from '../dexie-schema.js';
import type { task_tags } from '../client-entities.js';

export interface task_tagsUpdateInput {
  Task_owner?: any;
  Tag_inverse?: any;
}

export class TaskTagsDexieService {
  async create(data: Partial<task_tags>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: task_tags = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as task_tags;
    
    await db.task_tags.add(record);
    return id;
  }

  async findById(id: string): Promise<task_tags | undefined> {
    return await db.task_tags.get(id);
  }

  async findAll(): Promise<task_tags[]> {
    return await db.task_tags.toArray();
  }

  async update(id: string, updates: task_tagsUpdateInput): Promise<void> {
    await db.task_tags.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.task_tags.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.task_tags.clear();
  }
}

export const task_tagsDexieService = new TaskTagsDexieService();
