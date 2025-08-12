// Generated Dexie domain service for StatusDefinition
import { db } from '../dexie-schema.js';
import type { StatusDefinition } from '../client-entities.js';

export interface StatusDefinitionUpdateInput {
  clientId?: any;
  name?: any;
  label?: any;
  color?: any;
  icon?: any;
  variant?: any;
  sortOrder?: any;
  isDefault?: any;
  isFinal?: any;
  isActive?: any;
  allowedTransitions?: any;
  autoTransitionDays?: any;
  metadata?: any;
  statusSet?: any;
}

export class StatusDefinitionDexieService {
  async create(data: Partial<StatusDefinition>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: StatusDefinition = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as StatusDefinition;
    
    await db.status_definition.add(record);
    return id;
  }

  async findById(id: string): Promise<StatusDefinition | undefined> {
    return await db.status_definition.get(id);
  }

  async findAll(): Promise<StatusDefinition[]> {
    return await db.status_definition.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: StatusDefinitionUpdateInput): Promise<void> {
    await db.status_definition.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.status_definition.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.status_definition.clear();
  }
}

export const statusDefinitionDexieService = new StatusDefinitionDexieService();
