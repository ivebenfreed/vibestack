import { getDb, sql, eq, and, gte, desc, asc } from '../lib/drizzle.js';
import { tasks, projects, users, status_definitions } from '@repo/dataforge/drizzle-schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Task = InferSelectModel<typeof tasks>;
export type NewTask = InferInsertModel<typeof tasks>;

export const createTasksDomain = (databaseUrl: string) => {
  const db = getDb(databaseUrl);
  
  return {
    // Basic CRUD operations
    async findAll() {
      return await db.select().from(tasks);
    },
    
    async findById(id: string) {
      const result = await db.select().from(tasks).where(eq(tasks.id, id));
      return result[0] || null;
    },
    
    async create(data: NewTask) {
      const result = await db.insert(tasks).values(data).returning();
      return result[0];
    },
    
    async update(id: string, data: Partial<NewTask>) {
      const result = await db.update(tasks)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(tasks.id, id))
        .returning();
      return result[0] || null;
    },
    
    async delete(id: string) {
      const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
      return result.length > 0;
    },
    
    // With relations
    async findWithRelations(id: string) {
      const result = await db.select({
        task: tasks,
        project: projects,
        assignee: users,
        status: status_definitions,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(users, eq(tasks.assigneeId, users.id))
      .leftJoin(status_definitions, eq(tasks.statusId, status_definitions.id))
      .where(eq(tasks.id, id));
      
      return result[0] || null;
    },
    
    // Query methods
    async findByProject(projectId: string) {
      return await db.select().from(tasks)
        .where(eq(tasks.projectId, projectId))
        .orderBy(desc(tasks.createdAt));
    },
    
    async findByAssignee(assigneeId: string) {
      return await db.select().from(tasks)
        .where(eq(tasks.assigneeId, assigneeId))
        .orderBy(desc(tasks.dueDate));
    },
    
    async findByStatus(statusId: string) {
      return await db.select().from(tasks)
        .where(eq(tasks.statusId, statusId));
    },
    
    // CRDT operations
    async upsertIfNewer(data: NewTask & { id: string }) {
      const result = await db.insert(tasks)
        .values(data)
        .onConflictDoUpdate({
          target: tasks.id,
          set: data,
          where: sql`${tasks.updatedAt} < ${data.updatedAt}`
        })
        .returning();
      return result[0];
    },
    
    // Sync operations
    async getChangesSince(timestamp: Date) {
      return await db.select().from(tasks)
        .where(gte(tasks.updatedAt, timestamp))
        .orderBy(asc(tasks.updatedAt));
    },
    
    // System operations (no clientId)
    async systemCreate(data: Omit<NewTask, 'clientId'>) {
      const cleanData = { ...data, clientId: null } as NewTask;
      const result = await db.insert(tasks).values(cleanData).returning();
      return result[0];
    },
    
    async systemUpdate(id: string, data: Partial<Omit<NewTask, 'clientId'>>) {
      const cleanData = { ...data, clientId: null, updatedAt: new Date() };
      const result = await db.update(tasks)
        .set(cleanData)
        .where(eq(tasks.id, id))
        .returning();
      return result[0] || null;
    },
    
    // Batch operations
    async insertOrUpdateIfNewer(data: NewTask) {
      const result = await db.insert(tasks)
        .values(data)
        .onConflictDoUpdate({
          target: tasks.id,
          set: data,
          where: sql`${tasks.updatedAt} < ${data.updatedAt}`
        })
        .returning();
      return result[0];
    }
  };
};