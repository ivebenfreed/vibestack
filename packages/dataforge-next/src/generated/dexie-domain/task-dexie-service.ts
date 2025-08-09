// Generated Dexie domain service for Task
import { db } from '../dexie-schema.js';
import type { Task } from '../client-entities.js';

export interface TaskUpdateInput {
  version?: any;
  deleted?: any;
  clientId?: any;
  createdBy?: any;
  updatedBy?: any;
  title?: any;
  description?: any;
  status?: any;
  priority?: any;
  dueDate?: any;
  startDate?: any;
  estimatedHours?: any;
  actualHours?: any;
  completionPercentage?: any;
  tags?: any;
  project?: any;
  assignee?: any;
  parent?: any;
  subtasks?: any;
  comments?: any;
}

export class TaskDexieService {
  async create(data: Partial<Task>): Promise<string> {
    const id = crypto.randomUUID();
    const now = new Date();
    
    const record: Task = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
      version: 0,
      deleted: false,
      clientId: crypto.randomUUID(),
    } as Task;
    
    await db.task.add(record);
    return id;
  }

  async findById(id: string): Promise<Task | undefined> {
    return await db.task.get(id);
  }

  async findAll(): Promise<Task[]> {
    return await db.task.where('deleted').equals(0).toArray();
  }

  async update(id: string, updates: TaskUpdateInput): Promise<void> {
    await db.task.update(id, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  async delete(id: string): Promise<void> {
    // Soft delete for domain entities
    await db.task.update(id, {
      deleted: true,
      updatedAt: new Date(),
    });
  }

  async deleteAll(): Promise<void> {
    await db.task.clear();
  }
}

export const taskDexieService = new TaskDexieService();
