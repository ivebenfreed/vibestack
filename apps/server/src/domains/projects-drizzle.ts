import { getDb, sql, eq, and, gte, desc, asc } from '../lib/drizzle.js';
import { projects, users, tasks, project_members } from '@repo/dataforge/drizzle-schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

// Get database instance

export const projectsDomain = {
  // Basic CRUD operations
  async findAll() {
    const db = getDb();
    return await db.select().from(projects);
  },
  
  async findById(id: string) {
    const db = getDb();
    const result = await db.select().from(projects).where(eq(projects.id, id));
    return result[0] || null;
  },
  
  async create(data: NewProject) {
    const db = getDb();
    const result = await db.insert(projects).values(data).returning();
    return result[0];
  },
  
  async update(id: string, data: Partial<NewProject>) {
    const db = getDb();
    const result = await db.update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(projects.id, id))
      .returning();
    return result[0] || null;
  },
  
  async delete(id: string) {
    const db = getDb();
    const result = await db.delete(projects).where(eq(projects.id, id)).returning();
    return result.length > 0;
  },
  
  // With relations
  async findWithOwner(id: string) {
    const db = getDb();
    const result = await db.select({
      project: projects,
      owner: users,
    })
    .from(projects)
    .leftJoin(users, eq(projects.ownerId, users.id))
    .where(eq(projects.id, id));
    
    return result[0] || null;
  },
  
  async findWithTasks(id: string) {
    const db = getDb();
    const project = await this.findById(id);
    if (!project) return null;
    
    const projectTasks = await db.select().from(tasks)
      .where(eq(tasks.projectId, id))
      .orderBy(desc(tasks.createdAt));
    
    return { ...project, tasks: projectTasks };
  },
  
  // Query methods
  async findByOwner(ownerId: string) {
    const db = getDb();
    return await db.select().from(projects)
      .where(eq(projects.ownerId, ownerId))
      .orderBy(desc(projects.createdAt));
  },
  
  async findByStatus(status: string) {
    const db = getDb();
    return await db.select().from(projects)
      .where(eq(projects.status, status as any));
  },
  
  // CRDT operations
  async upsertIfNewer(data: NewProject & { id: string }) {
    const db = getDb();
    const result = await db.insert(projects)
      .values(data)
      .onConflictDoUpdate({
        target: projects.id,
        set: data,
        where: sql`${projects.updatedAt} < ${data.updatedAt}`
      })
      .returning();
    return result[0];
  },
  
  // Sync operations
  async getChangesSince(timestamp: Date) {
    const db = getDb();
    return await db.select().from(projects)
      .where(gte(projects.updatedAt, timestamp))
      .orderBy(asc(projects.updatedAt));
  },
  
  // Bulk operations
  async bulkCreate(items: NewProject[]) {
    const db = getDb();
    if (items.length === 0) return [];
    const result = await db.insert(projects).values(items).returning();
    return result;
  },
  
  async bulkUpdate(updates: Array<{ id: string; data: Partial<NewProject> }>) {
    const db = getDb();
    const results = [];
    for (const { id, data } of updates) {
      const updated = await this.update(id, data);
      if (updated) {
        results.push(updated);
      }
    }
    return results;
  },
  
  async bulkDelete(ids: string[]) {
    const db = getDb();
    if (ids.length === 0) return 0;
    const result = await db.delete(projects)
      .where(sql`${projects.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
    return result.rowCount || 0;
  },
  
  // System operations (clear clientId)
  async systemUpdate(id: string, data: Partial<NewProject>) {
    const db = getDb();
    return await this.update(id, { ...data, clientId: null });
  },
  
  async systemCreate(data: NewProject) {
    const db = getDb();
    return await this.create({ ...data, clientId: null });
  },
};