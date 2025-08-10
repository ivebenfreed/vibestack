// Generated Dexie domain service for StatusSet
import { db } from '../dexie-schema.js';
import type { StatusSet } from '../client-entities.js';

export interface StatusSetUpdateInput {
  clientId?: any;
  name?: any;
  description?: any;
  entityType?: any;
  isDefault?: any;
  isActive?: any;
  isSystem?: any;
  workflow?: any;
  metadata?: any;
  statuses?: any;
  projects?: any;
}

export class StatussetDexieService {
  async create(data: Partial<StatusSet>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: StatusSet = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as StatusSet;
    
    await db.status_sets.add(record);
    return id;
  }

  async findById(id: string): Promise<StatusSet | undefined> {
    return await db.status_sets.get(id);
  }

  async findAll(): Promise<StatusSet[]> {
    return await db.status_sets.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: StatusSetUpdateInput): Promise<void> {
    await db.status_sets.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.status_sets.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.status_sets.clear();
  }
}

export const statussetDexieService = new StatussetDexieService();
