// Generated Dexie domain service for ChangeHistory
import { db } from '../dexie-schema.js';
import type { ChangeHistory } from '../client-entities.js';

export interface ChangeHistoryUpdateInput {
  lsn?: any;
  tableName?: any;
  operation?: any;
  data?: any;
  timestamp?: any;
}

export class ChangeHistoryDexieService {
  async create(data: Partial<ChangeHistory>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: ChangeHistory = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as ChangeHistory;
    
    await db.change_history.add(record);
    return id;
  }

  async findById(id: string): Promise<ChangeHistory | undefined> {
    return await db.change_history.get(id);
  }

  async findAll(): Promise<ChangeHistory[]> {
    return await db.change_history.toArray();
  }

  async update(id: string, updates: ChangeHistoryUpdateInput): Promise<void> {
    await db.change_history.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.change_history.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.change_history.clear();
  }
}

export const changeHistoryDexieService = new ChangeHistoryDexieService();
