// Generated Dexie domain service for project_status_sets
import { db } from '../dexie-schema.js';
import type { project_status_sets } from '../client-entities.js';

export interface project_status_setsUpdateInput {
  Project_owner?: any;
  StatusSet_inverse?: any;
}

export class project_status_setsDexieService {
  async create(data: Partial<project_status_sets>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: project_status_sets = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as project_status_sets;
    
    await db.project_status_sets.add(record);
    return id;
  }

  async findById(id: string): Promise<project_status_sets | undefined> {
    return await db.project_status_sets.get(id);
  }

  async findAll(): Promise<project_status_sets[]> {
    return await db.project_status_sets.toArray();
  }

  async update(id: string, updates: project_status_setsUpdateInput): Promise<void> {
    await db.project_status_sets.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.project_status_sets.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.project_status_sets.clear();
  }
}

export const project_status_setsDexieService = new project_status_setsDexieService();
