// Generated Dexie domain service for Comment
import { db } from '../dexie-schema.js';
import type { Comment } from '../client-entities.js';

export interface CommentUpdateInput {
  clientId?: any;
  content?: any;
  task?: any;
  author?: any;
}

export class CommentDexieService {
  async create(data: Partial<Comment>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: Comment = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as Comment;
    
    await db.comments.add(record);
    return id;
  }

  async findById(id: string): Promise<Comment | undefined> {
    return await db.comments.get(id);
  }

  async findAll(): Promise<Comment[]> {
    return await db.comments.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: CommentUpdateInput): Promise<void> {
    await db.comments.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.comments.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.comments.clear();
  }
}

export const commentDexieService = new CommentDexieService();
