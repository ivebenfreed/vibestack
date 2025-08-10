// Generated Dexie domain service for EntityDependency
import { db } from '../dexie-schema.js';
import type { EntityDependency } from '../client-entities.js';

export interface EntityDependencyUpdateInput {
  fromTable?: any;
  fromId?: any;
  toTable?: any;
  toId?: any;
  dependencyType?: any;
  metadata?: any;
}

export class EntitydependencyDexieService {
  async create(data: Partial<EntityDependency>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: EntityDependency = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as EntityDependency;
    
    await db.entity_dependencies.add(record);
    return id;
  }

  async findById(id: string): Promise<EntityDependency | undefined> {
    return await db.entity_dependencies.get(id);
  }

  async findAll(): Promise<EntityDependency[]> {
    return await db.entity_dependencies.toArray();
  }

  async update(id: string, updates: EntityDependencyUpdateInput): Promise<void> {
    await db.entity_dependencies.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.entity_dependencies.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.entity_dependencies.clear();
  }
}

export const entitydependencyDexieService = new EntitydependencyDexieService();
