import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@repo/dataforge/drizzle-schema';
import { sql as drizzleSql } from 'drizzle-orm';

// Create Neon SQL client
function createNeonClient(connectionString?: string) {
  const url = connectionString || process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set');
  }
  return neon(url);
}

// Create Drizzle instance
export function createDrizzleDb(connectionString?: string) {
  const sql = createNeonClient(connectionString);
  return drizzle(sql, { schema });
}

// Default database instance
let defaultDb: ReturnType<typeof createDrizzleDb> | null = null;

export function getDb(connectionString?: string) {
  if (!defaultDb || connectionString) {
    defaultDb = createDrizzleDb(connectionString);
  }
  return defaultDb;
}

// Export for convenience - NOTE: db is now lazy-loaded
export { drizzleSql as sql };
export * from 'drizzle-orm';

// Base CRUD operations for domain entities
export function createDomainQueries<T extends typeof schema.tasks>(table: T) {
  const db = getDb();
  
  return {
    findAll: () => db.select().from(table),
    
    findById: (id: string) => 
      db.select().from(table).where(drizzleSql`${table.id} = ${id}`).limit(1),
    
    create: (data: any) => 
      db.insert(table).values(data).returning(),
    
    update: (id: string, data: any) => 
      db.update(table).set(data).where(drizzleSql`${table.id} = ${id}`).returning(),
    
    delete: (id: string) => 
      db.delete(table).where(drizzleSql`${table.id} = ${id}`),
    
    // CRDT-aware operations
    insertOrUpdateIfNewer: async (data: any) => {
      const result = await db.insert(table)
        .values(data)
        .onConflictDoUpdate({
          target: table.id,
          set: data,
          where: drizzleSql`${table.updatedAt} < ${data.updatedAt}`
        })
        .returning();
      return result[0];
    },
    
    // Sync operations
    getChangesSince: (timestamp: Date) =>
      db.select().from(table)
        .where(drizzleSql`${table.updatedAt} >= ${timestamp}`)
        .orderBy(table.updatedAt),
  };
}