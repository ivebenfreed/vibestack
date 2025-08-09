// Generated Dexie domain service for SyncMetadata
import { db } from '../dexie-schema.js';
import type { SyncMetadata } from '../client-entities.js';

export interface SyncMetadataUpdateInput {
  tableName?: any;
  lastSyncedVersion?: any;
  lastSyncedAt?: any;
}

export class SyncMetadataDexieService {
  async create(data: Partial<SyncMetadata>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: SyncMetadata = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as SyncMetadata;
    
    await db.sync_metadata.add(record);
    return id;
  }

  async findById(id: string): Promise<SyncMetadata | undefined> {
    return await db.sync_metadata.get(id);
  }

  async findAll(): Promise<SyncMetadata[]> {
    return await db.sync_metadata.toArray();
  }

  async update(id: string, updates: SyncMetadataUpdateInput): Promise<void> {
    await db.sync_metadata.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    await db.sync_metadata.delete(id);
  }

  async deleteAll(): Promise<void> {
    await db.sync_metadata.clear();
  }
}

export const syncMetadataDexieService = new SyncMetadataDexieService();
