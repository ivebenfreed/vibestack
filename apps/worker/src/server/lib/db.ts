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
 * @deprecated Use getPostgresClient() from database-manager instead
 * 
 * Legacy function - creates new connections which can leak.
 * New pattern: 
 * import { createDatabaseConnection, pgClient } from './database-manager';
 * createDatabaseConnection(env); // Once per Worker
 * const client = pgClient(); // Reuse connection
 */
export const getDBClient = (c: AppContext | MinimalContext | { env: Env }) => {
  console.warn('⚠️ getDBClient() is deprecated. Use createDatabaseConnection() and pgClient() from database-manager');
  
  const env = 'env' in c && typeof c.env === 'object' && c.env !== null 
    ? c.env as Env
    : undefined;
    
  if (!env) {
    throw new Error('Environment variables not available');
  }
  
  // For backward compatibility, create connection if not exists and return client
  try {
    return getPostgresClient();
  } catch (error) {
    // Connection not initialized, initialize it
    createDatabaseConnection(env);
    return getPostgresClient();
  }
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
  const client = getDBClient(c);
  const tableData = [];

  // Fetch data from each domain table
  for (const tableName of DOMAIN_TABLES) {
    const rows = await client.unsafe(`
      SELECT * FROM "${tableName}";
    `);
    
    tableData.push({
      tableName,
      rows: rows as any[]
    });
  }

  return tableData;
}

// Health check
export async function checkDatabaseHealth(c: AppContext | MinimalContext): Promise<{
  healthy: boolean;
  latency: number;
  tables?: Array<{ name: string; rowCount: number }>;
  tableCount?: number;
  error?: string;
}> {
  const start = Date.now();
  const client = getDBClient(c);
  
  try {
    await client.unsafe('SELECT 1');
    
    // Get table information
    const tablesResult = await client.unsafe<{ tablename: string }>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    const tables = [];
    
    // Get row count for each table
    for (const { tablename } of tablesResult) {
      const countResult = await client.unsafe<{ count: number }>(`
        SELECT COUNT(*) as count FROM "${tablename}";
      `);
      
      const rowCount = Number(countResult[0]?.count || 0);
      
      tables.push({
        name: tablename,
        rowCount
      });
    }
    
    return {
      healthy: true,
      latency: Date.now() - start,
      tables,
      tableCount: tables.length
    };
  } catch (error) {
    return {
      healthy: false,
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
} 