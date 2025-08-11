/**
 * Kysely Query Service
 * 
 * Provides unified database access using Kysely
 * Replaces DrizzleQueryService for consistency with Better Auth
 * Works with Neon serverless connection model in Cloudflare Workers
 */

import { Kysely } from 'kysely';
import { NeonHTTPDialectV1 } from './kysely-neon-v1-adapter';
import type { Database } from '@repo/dataforge/kysely-types';
import type { Context } from 'hono';
import type { Env } from '../types/env';

export class KyselyQueryService {
  public db: Kysely<Database>;
  private context: Context<{ Bindings: Env }>;

  constructor(context: Context<{ Bindings: Env }>) {
    this.context = context;
    
    // Get database URL from environment
    const databaseUrl = context.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is required');
    }

    // Initialize Kysely with custom Neon dialect
    this.db = new Kysely<Database>({
      dialect: new NeonHTTPDialectV1(databaseUrl),
    });
  }

  /**
   * Get the Kysely database instance
   */
  getDatabase() {
    return this.db;
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(callback: (trx: Kysely<Database>) => Promise<T>): Promise<T> {
    return await this.db.transaction().execute(callback);
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

  /**
   * Destroy the connection (if needed for cleanup)
   */
  async destroy() {
    await this.db.destroy();
  }
}