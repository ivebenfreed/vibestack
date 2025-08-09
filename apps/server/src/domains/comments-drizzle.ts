import { getDb, sql, eq, and, gte, desc, asc, isNull } from '../lib/drizzle.js';
import { comments, users, tasks, projects } from '@repo/dataforge/drizzle-schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Type definitions
export type Comment = InferSelectModel<typeof comments>;
export type NewComment = InferInsertModel<typeof comments>;

// Get database instance

export const commentsDomain = {
  // Basic CRUD operations
  async findAll() {
    const db = getDb();
    return await db.select().from(comments);
  },
  
  async findById(id: string) {
    const db = getDb();
    const result = await db.select().from(comments).where(eq(comments.id, id));
    return result[0] || null;
  },
  
  async create(data: NewComment) {
    const db = getDb();
    const result = await db.insert(comments).values(data).returning();
    return result[0];
  },
  
  async update(id: string, data: Partial<NewComment>) {
    const db = getDb();
    const result = await db.update(comments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return result[0] || null;
  },
  
  async delete(id: string) {
    const db = getDb();
    const result = await db.delete(comments).where(eq(comments.id, id)).returning();
    return result.length > 0;
  },
  
  // With relations
  async findWithRelations(id: string) {
    const db = getDb();
    const result = await db.select({
      comment: comments,
      author: users,
      task: tasks,
      project: projects,
      parent: comments,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .leftJoin(tasks, eq(comments.taskId, tasks.id))
    .leftJoin(projects, eq(comments.projectId, projects.id))
    .leftJoin(comments, eq(comments.parentId, comments.id))
    .where(eq(comments.id, id));
    
    return result[0] || null;
  },
  
  // Query methods
  async findByTask(taskId: string) {
    const db = getDb();
    return await db.select({
      comment: comments,
      author: users,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(desc(comments.createdAt));
  },
  
  async findByProject(projectId: string) {
    const db = getDb();
    return await db.select({
      comment: comments,
      author: users,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.projectId, projectId))
    .orderBy(desc(comments.createdAt));
  },
  
  async findByAuthor(authorId: string) {
    const db = getDb();
    return await db.select().from(comments)
      .where(eq(comments.authorId, authorId))
      .orderBy(desc(comments.createdAt));
  },
  
  async findReplies(parentId: string) {
    const db = getDb();
    return await db.select({
      comment: comments,
      author: users,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.parentId, parentId))
    .orderBy(asc(comments.createdAt));
  },
  
  async findRootComments(entityType: 'task' | 'project', entityId: string) {
    const db = getDb();
    const condition = entityType === 'task' 
      ? eq(comments.taskId, entityId)
      : eq(comments.projectId, entityId);
    
    return await db.select({
      comment: comments,
      author: users,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(and(
      condition,
      isNull(comments.parentId)
    ))
    .orderBy(desc(comments.createdAt));
  },
  
  // CRDT operations
  async upsertIfNewer(data: NewComment & { id: string }) {
    const db = getDb();
    const result = await db.insert(comments)
      .values(data)
      .onConflictDoUpdate({
        target: comments.id,
        set: data,
        where: sql`${comments.updatedAt} < ${data.updatedAt}`
      })
      .returning();
    return result[0];
  },
  
  // Sync operations
  async getChangesSince(timestamp: Date) {
    const db = getDb();
    return await db.select().from(comments)
      .where(gte(comments.updatedAt, timestamp))
      .orderBy(asc(comments.updatedAt));
  },
  
  // Bulk operations
  async bulkCreate(items: NewComment[]) {
    const db = getDb();
    if (items.length === 0) return [];
    const result = await db.insert(comments).values(items).returning();
    return result;
  },
  
  async bulkDelete(ids: string[]) {
    const db = getDb();
    if (ids.length === 0) return 0;
    const result = await db.delete(comments)
      .where(sql`${comments.id} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`);
    return result.rowCount || 0;
  },
  
  // System operations (clear clientId)
  async systemUpdate(id: string, data: Partial<NewComment>) {
    const db = getDb();
    return await this.update(id, { ...data, clientId: null });
  },
  
  async systemCreate(data: NewComment) {
    const db = getDb();
    return await this.create({ ...data, clientId: null });
  },
};