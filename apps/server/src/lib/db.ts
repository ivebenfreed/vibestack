import { Client, QueryResultRow, neonConfig } from '@neondatabase/serverless';
import type { Context } from 'hono';
import type { Env } from '../types/env';
import type { AppContext, MinimalContext } from '../types/hono';

/**
 * Add connect_timeout to URL if not present
 * @param url The database URL to process
 * @returns The processed URL with connect_timeout parameter
 */
export function addConnectTimeout(url: string): string {
  if (url.includes('connect_timeout=')) {
    return url;
  }
  return url + (url.includes('?') ? '&' : '?') + 'connect_timeout=10';
}

// Initialize database client
export const getDBClient = (c: AppContext | MinimalContext | { env: { DATABASE_URL: string } }) => {
  try {
    const url = 'env' in c && typeof c.env === 'object' && c.env !== null 
      ? c.env.DATABASE_URL
      : undefined;
      
    if (!url) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    
    // Check if this is a local development URL
    const isLocal = url.includes('localtest.me');
    
    // Configure for local HTTP proxy if needed
    if (isLocal) {
      
      // Configure for single SQL queries (HTTP)
      neonConfig.fetchEndpoint = (host) => {
        const [protocol, port] = host === 'db.localtest.me' ? ['http', 4444] : ['https', 443];
        return `${protocol}://${host}:${port}/sql`;
      };
      neonConfig.fetchFunction = fetch;
      
      // Configure for Pool connections (WebSocket) - needed for replication
      const connectionStringUrl = new URL(url);
      neonConfig.useSecureWebSocket = connectionStringUrl.hostname !== 'db.localtest.me';
      neonConfig.wsProxy = connectionStringUrl.hostname === 'db.localtest.me' 
        ? (host) => `${host}:4444/v1` 
        : undefined;
      
      // In Cloudflare Workers, WebSocket is available globally
      neonConfig.webSocketConstructor = WebSocket;
    }
    
    const urlWithTimeout = addConnectTimeout(url);
    
    const clientConfig: any = {
      connectionString: urlWithTimeout,
      ssl: !isLocal // No SSL for local connections
    };
    
    // For local development, force HTTP-only mode
    if (isLocal) {
      clientConfig.forceHttp = true;
      clientConfig.webSocketConstructor = null;
    }
    
    const client = new Client(clientConfig);
    return client;
  } catch (error) {
    console.error('Error creating database client:', error);
    throw error;
  }
};

// Direct query execution with proper connection management
export async function sql<T extends QueryResultRow = QueryResultRow>(
  c: AppContext | MinimalContext,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const client = getDBClient(c);
  try {
    await client.connect();
    const result = await client.query<T>(query, params);
    return result.rows;
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
}

// Query execution helpers
export async function executeQuery<T extends QueryResultRow = QueryResultRow>(
  client: Client,
  query: string,
  params: any[] = []
): Promise<T[]> {
  const result = await client.query<T>(query, params);
  return result.rows;
}

export async function executeQuerySingle<T extends QueryResultRow = QueryResultRow>(
  client: Client,
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
  try {
    await client.connect();
    const tableData = [];

    // Fetch data from each domain table
    for (const tableName of DOMAIN_TABLES) {
      const rows = await client.query(`
        SELECT * FROM "${tableName}";
      `);
      
      tableData.push({
        tableName,
        rows: rows.rows
      });
    }

    return tableData;
  } finally {
    await client.end();
  }
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
    await client.connect();
    await client.query('SELECT 1');
    
    // Get table information
    const tablesResult = await client.query<{ tablename: string }>(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename;
    `);
    
    const tables = [];
    
    // Get row count for each table
    for (const { tablename } of tablesResult.rows) {
      const countResult = await client.query<{ count: number }>(`
        SELECT COUNT(*) as count FROM "${tablename}";
      `);
      
      const rowCount = Number(countResult.rows[0]?.count || 0);
      
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
  } finally {
    try {
      await client.end();
    } catch (err) {
      console.error('Error closing connection:', err);
    }
  }
} 