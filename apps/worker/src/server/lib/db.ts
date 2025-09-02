/**
 * @deprecated Use centralized database-manager instead
 * 
 * This file is deprecated. Use the new centralized database manager:
 * import { createDatabaseConnection, pgClient, sql } from './database-manager';
 * 
 * The new pattern prevents connection leaks and provides unified access.
 */

import postgres from 'postgres';
import type { Env } from '../types/env';
import type { AppContext, MinimalContext } from '../types/hono';
import { createDatabaseConnection, getPostgresClient, executeSQL } from './database-manager';

export interface QueryResultRow {
  [column: string]: any;
}

/**
 * @deprecated This function creates connection leaks! Use withPostgresClient() instead
 * 
 * Legacy function - creates new connections which can leak.
 * New pattern: 
 * import { withPostgresClient } from './database-manager';
 * const result = await withPostgresClient(async (client) => {
 *   return await client.unsafe('SELECT * FROM users');
 * });
 */
export const getDBClient = (c: AppContext | MinimalContext | { env: Env }) => {
  console.error('❌ getDBClient() is disabled to prevent connection leaks! Use withPostgresClient() instead');
  throw new Error('getDBClient() is disabled to prevent connection leaks. Use withPostgresClient() pattern from database-manager instead.');
};

/**
 * @deprecated Use executeSQL() from database-manager instead
 * 
 * Legacy function - creates new connections which can leak.
 * New pattern: 
 * import { createDatabaseConnection, sql } from './database-manager';
 * createDatabaseConnection(env); // Once per Worker
 * const result = await sql(query, params); // Reuse connection
 */
export async function sql<T extends QueryResultRow = QueryResultRow>(
  c: AppContext | MinimalContext,
  query: string,
  params: any[] = []
): Promise<T[]> {
  console.warn('⚠️ sql(c, query, params) is deprecated. Use createDatabaseConnection() and sql(query, params) from database-manager');
  
  const env = 'env' in c && typeof c.env === 'object' && c.env !== null 
    ? c.env as Env
    : undefined;
    
  if (!env) {
    throw new Error('Environment variables not available');
  }
  
  // For backward compatibility, try to use centralized connection
  try {
    return await executeSQL<T>(query, params);
  } catch (error) {
    // Connection not initialized, initialize it
    createDatabaseConnection(env);
    return await executeSQL<T>(query, params);
  }
}

// Query execution helpers using postgres.js client
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  client: ReturnType<typeof postgres>,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const result = await client.unsafe(query, params);
  return result as T[];
}

export async function executeQuerySingle<T extends QueryResultRow = QueryResultRow>(
  client: ReturnType<typeof postgres>,
  query: string,
  params: any[] = []
): Promise<T | null> {
  const results = await executeQuery<T>(client, query, params);
  return results[0] || null;
}

// Pagination
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export function buildPaginationClause(options?: QueryOptions): string {
  if (!options) return '';
  
  const clauses: string[] = [];
  
  if (options.orderBy) {
    clauses.push(`ORDER BY ${options.orderBy} ${options.orderDir || 'asc'}`);
  }
  
  if (options.limit) {
    clauses.push(`LIMIT ${options.limit}`);
  }
  
  if (options.offset) {
    clauses.push(`OFFSET ${options.offset}`);
  }
  
  return clauses.join(' ');
}

// Case conversion utilities
export function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function transformKeys<T extends Record<string, any>>(
  obj: T,
  transform: (key: string) => string
): Record<string, any> {
  return Object.fromEntries(
    Object.entries(obj).map(([key, value]) => [transform(key), value])
  );
}

export interface TableData {
  tableName: string;
  rows: Record<string, any>[];
}

export async function fetchAllTableData(c: AppContext): Promise<TableData[]> {
  // Get list of tables in public schema (excluding system tables)
  interface TableRow {
    tablename: string;
  }
  
  const tablesResult = await sql<TableRow>(c, `
    SELECT tablename 
    FROM pg_tables 
    WHERE schemaname = 'public'
    AND tablename NOT IN ('client_migration', 'wal_changes')
    ORDER BY tablename;
  `);

  const tables = tablesResult.map(r => r.tablename);
  const tableData: TableData[] = [];

  // Fetch data from each table
  for (const tableName of tables) {
    const rows = await sql(c, `
      SELECT * FROM "${tableName}";
    `);
    
    tableData.push({
      tableName,
      rows
    });
  }

  return tableData;
}

// Domain tables that can be queried
export const DOMAIN_TABLES = [
  'user',
  'project',
  'task',
  'task_comment',
  'time_tracking_entry'
] as const;

// Fetch data from all domain tables
export async function fetchDomainTableData(c: AppContext | MinimalContext): Promise<TableData[]> {
  console.error('❌ fetchDomainTableData() is deprecated and uses connection leaks! Use withPostgresClient() pattern instead');
  throw new Error('fetchDomainTableData() is disabled to prevent connection leaks. Use withPostgresClient() pattern from database-manager instead.');
}

// Health check
export async function checkDatabaseHealth(c: AppContext | MinimalContext): Promise<{
  healthy: boolean;
  latency: number;
  tables?: Array<{ name: string; rowCount: number }>;
  tableCount?: number;
  error?: string;
}> {
  console.error('❌ checkDatabaseHealth() is deprecated and uses connection leaks! Use withPostgresClient() pattern instead');
  throw new Error('checkDatabaseHealth() is disabled to prevent connection leaks. Use withPostgresClient() pattern from database-manager instead.');
} 