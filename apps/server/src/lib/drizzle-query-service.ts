/**
 * Drizzle Query Service
 * 
 * Provides unified database access using Drizzle ORM
 * Works with Neon serverless connection model in Cloudflare Workers
 */

import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '@repo/dataforge/drizzle-schema';
import type { Context } from 'hono';
import type { Env } from '../types/env';

export class DrizzleQueryService {
  public db: ReturnType<typeof drizzle>;
  private context: Context<{ Bindings: Env }>;

  constructor(context: Context<{ Bindings: Env }>) {
    this.context = context;
    
    // Get database URL from environment
    const databaseUrl = context.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Create Neon HTTP connection
    const client = neon(databaseUrl);
    
    // Initialize Drizzle with schema
    this.db = drizzle(client, { schema });
  }

  /**
   * Get the Drizzle database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Get the schema for type checking
   */
  getSchema() {
    return schema;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (tx: typeof this.db) => Promise<T>): Promise<T> {
    return await this.db.transaction(callback);
  }

  /**
   * Get user context for permissions/filtering
   */
  getUser() {
    return this.context.get('user');
  }

  /**
   * Get full context if needed
   */
  getContext() {
    return this.context;
  }
}