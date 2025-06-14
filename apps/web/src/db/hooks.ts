/**
 * Database hooks for PGlite integration
 * 
 * This module provides React hooks for database operations.
 * Entity-specific hooks have been moved to their respective domain contexts.
 */

import { useState, useEffect } from 'react';
import { usePGliteContext } from './pglite-provider';

interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Generic hook for executing SQL queries
 */
export function useQuery<T = any>(
  sql: string, 
  params: any[] = [], 
  options?: { enabled?: boolean }
): QueryState<T[]> {
  const { query, isLoading: dbLoading } = usePGliteContext();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || dbLoading || !query) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function executeQuery() {
      try {
        setLoading(true);
        setError(null);
        
        if (!query) {
          throw new Error('Query function not available');
        }
        
        const result = await query(sql, params);
        
        if (mounted) {
          // Handle different result types from PGlite
          const rows = Array.isArray(result) ? result : result.rows || [];
          setData(rows);
        }
      } catch (err) {
        if (mounted) {
          console.error('Query error:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    executeQuery();

    return () => {
      mounted = false;
    };
  }, [query, dbLoading, sql, JSON.stringify(params), enabled]);

  return { data, loading, error };
}

/**
 * Generic hook for executing mutations (INSERT, UPDATE, DELETE)
 */
export function useMutation<T = any>(
  sql?: string
): [
  (params?: any[]) => Promise<T[]>,
  { loading: boolean; error: Error | null; data: T[] | null }
] {
  const { query } = usePGliteContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T[] | null>(null);

  const executeMutation = async (params: any[] = []) => {
    if (!query) {
      throw new Error('Query function not available');
    }

    if (!sql) {
      throw new Error('SQL query not provided');
    }

    try {
      setLoading(true);
      setError(null);
      
      const result = await query(sql, params);
      
      // Handle different result types from PGlite
      const rows = Array.isArray(result) ? result : result.rows || [];
      setData(rows);
      return rows;
    } catch (err) {
      console.error('Mutation error:', err);
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return [executeMutation, { loading, error, data }];
}

/**
 * Hook for live queries with polling
 */
export function useLive<T = any>(
  sql: string,
  params: any[] = [],
  options?: { pollingInterval?: number; enabled?: boolean }
): QueryState<T[]> {
  const { query, isLoading: dbLoading } = usePGliteContext();
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const pollingInterval = options?.pollingInterval || 1000;
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || dbLoading || !query) {
      setLoading(false);
      return;
    }

    let mounted = true;
    let intervalId: NodeJS.Timeout;

    async function executeLiveQuery() {
      try {
        setError(null);
        
        if (!query) {
          throw new Error('Query function not available');
        }
        
        const result = await query(sql, params);
        
        if (mounted) {
          // Handle different result types from PGlite
          const rows = Array.isArray(result) ? result : result.rows || [];
          setData(rows);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error('Live query error:', err);
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    }

    // Execute initial query
    executeLiveQuery();

    // Set up polling
    intervalId = setInterval(executeLiveQuery, pollingInterval);

    return () => {
      mounted = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [query, dbLoading, sql, JSON.stringify(params), pollingInterval, enabled]);

  return { data, loading, error };
}

// Export the live changes hook and related types
export { useLiveChanges } from './hooks/useLiveChanges';
export type { EntityChange, ChangeOperation, ChangeInsert, ChangeUpdate, ChangeDelete } from './hooks/useLiveChanges'; 