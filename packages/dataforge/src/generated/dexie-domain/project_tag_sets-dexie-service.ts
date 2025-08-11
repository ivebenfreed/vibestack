// Generated Dexie domain service for project_tag_sets
import { db } from '../dexie-schema.js';
import type { project_tag_sets } from '../client-entities.js';

export interface project_tag_setsUpdateInput {
  Project_owner?: any;
  TagSet_inverse?: any;
}

export class project_tag_setsDexieService {
  async create(data: Partial<project_tag_sets>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: project_tag_sets = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as project_tag_sets;
    
    await db.project_tag_sets.add(record);
    return id;
  }

  async findById(id: string): Promise<project_tag_sets | undefined> {
    return await db.project_tag_sets.get(id);
  }

  async findAll(): Promise<project_tag_sets[]> {
    return await db.project_tag_sets.toArray();
  }

  async update(id: string, updates: project_tag_setsUpdateInput): Promise<void> {
    await db.project_tag_sets.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.project_tag_sets.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.project_tag_sets.clear();
  }
}

export const project_tag_setsDexieService = new project_tag_setsDexieService();
