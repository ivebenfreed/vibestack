// Generated Dexie domain service for task_tag_entities
import { db } from '../dexie-schema.js';
import type { task_tag_entities } from '../client-entities.js';

export interface task_tag_entitiesUpdateInput {
  Task_owner?: any;
  Tag_inverse?: any;
}

export class task_tag_entitiesDexieService {
  async create(data: Partial<task_tag_entities>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: task_tag_entities = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as task_tag_entities;
    
    await db.task_tag_entities.add(record);
    return id;
  }

  async findById(id: string): Promise<task_tag_entities | undefined> {
    return await db.task_tag_entities.get(id);
  }

  async findAll(): Promise<task_tag_entities[]> {
    return await db.task_tag_entities.toArray();
  }

  async update(id: string, updates: task_tag_entitiesUpdateInput): Promise<void> {
    await db.task_tag_entities.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.task_tag_entities.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.task_tag_entities.clear();
  }
}

export const task_tag_entitiesDexieService = new task_tag_entitiesDexieService();
