// Generated Dexie domain service for LocalChanges
import { db } from '../dexie-schema.js';
import type { LocalChanges } from '../client-entities.js';

export interface LocalChangesUpdateInput {
  tableName?: any;
  recordId?: any;
  operationType?: any;
  data?: any;
  clientSequence?: any;
  loopProtection?: any;
}

export class LocalChangesDexieService {
  async create(data: Partial<LocalChanges>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: LocalChanges = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as LocalChanges;
    
    await db.local_changes.add(record);
    return id;
  }

  async findById(id: string): Promise<LocalChanges | undefined> {
    return await db.local_changes.get(id);
  }

  async findAll(): Promise<LocalChanges[]> {
    return await db.local_changes.toArray();
  }

  async update(id: string, updates: LocalChangesUpdateInput): Promise<void> {
    await db.local_changes.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.local_changes.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.local_changes.clear();
  }
}

export const localChangesDexieService = new LocalChangesDexieService();
