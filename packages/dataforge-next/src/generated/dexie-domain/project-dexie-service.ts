// Generated Dexie domain service for Project
import { db } from '../dexie-schema.js';
import type { Project } from '../client-entities.js';

export interface ProjectUpdateInput {
  clientId?: any;
  name?: any;
  description?: any;
  status?: any;
  owner?: any;
  tasks?: any;
  tagSets?: any;
  statusSets?: any;
}

export class ProjectDexieService {
  async create(data: Partial<Project>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: Project = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as Project;
    
    await db.projects.add(record);
    return id;
  }

  async findById(id: string): Promise<Project | undefined> {
    return await db.projects.get(id);
  }

  async findAll(): Promise<Project[]> {
    return await db.projects.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: ProjectUpdateInput): Promise<void> {
    await db.projects.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.projects.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.projects.clear();
  }
}

export const projectDexieService = new ProjectDexieService();
