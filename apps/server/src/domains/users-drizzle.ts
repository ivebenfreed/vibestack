import { getDb, sql, eq, and, gte, desc, asc } from '../lib/drizzle.js';
import { users, tasks, projects, comments, sessions, accounts } from '@repo/dataforge/drizzle-schema';
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';

// Type definitions
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

// Get database instance

export const usersDomain = {
  // Read-only operations (Better Auth handles user management)
  async findAll() {
    const db = getDb();
    return await db.select().from(users);
  },
  
  async findById(id: string) {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  },
  
  async findByEmail(email: string) {
    const db = getDb();
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0] || null;
  },
  
  async findByRole(role: string) {
    const db = getDb();
    return await db.select().from(users).where(eq(users.role, role));
  },
  
  // With relations
  async findWithTasks(id: string) {
    const db = getDb();
    const user = await this.findById(id);
    if (!user) return null;
    
    const userTasks = await db.select().from(tasks)
      .where(eq(tasks.assigneeId, id))
      .orderBy(desc(tasks.createdAt));
    
    return { ...user, tasks: userTasks };
  },
  
  async findWithProjects(id: string) {
    const db = getDb();
    const user = await this.findById(id);
    if (!user) return null;
    
    const userProjects = await db.select().from(projects)
      .where(eq(projects.ownerId, id))
      .orderBy(desc(projects.createdAt));
    
    return { ...user, projects: userProjects };
  },
  
  async findWithComments(id: string) {
    const db = getDb();
    const user = await this.findById(id);
    if (!user) return null;
    
    const userComments = await db.select().from(comments)
      .where(eq(comments.authorId, id))
      .orderBy(desc(comments.createdAt));
    
    return { ...user, comments: userComments };
  },
  
  // Query methods
  async findVerifiedUsers() {
    const db = getDb();
    return await db.select().from(users)
      .where(eq(users.emailVerified, true));
  },
  
  // Sync operations (read-only for sync purposes)
  async getChangesSince(timestamp: Date) {
    const db = getDb();
    return await db.select().from(users)
      .where(gte(users.updatedAt, timestamp))
      .orderBy(asc(users.updatedAt));
  },
  
  // CRDT operations for sync (Better Auth manages the actual updates)
  async upsertIfNewer(data: NewUser & { id: string }) {
    const db = getDb();
    // For sync purposes only - Better Auth should handle actual user updates
    const result = await db.insert(users)
      .values(data)
      .onConflictDoUpdate({
        target: users.id,
        set: data,
        where: sql`${users.updatedAt} < ${data.updatedAt}`
      })
      .returning();
    return result[0];
  },
};