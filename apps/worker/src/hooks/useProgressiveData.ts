/**
 * Progressive Data Loading Hook
 * 
 * Shows cached/local data immediately, then updates when fresh data arrives.
 * Perfect for the optimized init flow where dashboard shows fast with loading states.
 */

import { useState, useEffect, useRef } from 'react';
import { log } from '@/logger';
const fileLog = log('hooks/useProgressiveData.ts');

export interface ProgressiveDataState<T> {
  data: T | null;
  isLoading: boolean;
  isFresh: boolean;  // True if data is from server, false if cached/local
  error: string | null;
  backgroundSync: boolean;  // True if fresh data is loading in background
}

export interface ProgressiveDataOptions<T> {
  // Local/cached data loader (immediate)
  loadLocal?: () => Promise<T | null> | T | null;
  // Fresh data loader (background)
  loadFresh?: () => Promise<T>;
  // Fallback data when no local data exists
  fallback?: T;
  // Auto-refresh interval (optional)
  refreshInterval?: number;
  // Cache key for debugging
  cacheKey?: string;
}

/**
 * Hook for progressive data loading pattern:
 * 1. Show local/cached data immediately (fast dashboard)
 * 2. Load fresh data in background
 * 3. Update UI when fresh data arrives
 * 4. Show appropriate loading states
 */
export function useProgressiveData<T>(
  options: ProgressiveDataOptions<T>
): ProgressiveDataState<T> & {
  refresh: () => Promise<void>;
  clearCache: () => void;
} {
  const {
    loadLocal,
    loadFresh,
    fallback,
    refreshInterval,
    cacheKey = 'unknown'
  } = options;

  const [state, setState] = useState<ProgressiveDataState<T>>({
    data: fallback || null,
    isLoading: true,
    isFresh: false,
    error: null,
    backgroundSync: false
  });

  const mountedRef = useRef(true);
  const refreshTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, []);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) {
      fileLog.info(`[ProgressiveData:${cacheKey}] 🚀 Starting progressive load`);
    }

    try {
      // Phase 1: Load local data immediately (show something fast)
      let localData: T | null = null;
      if (loadLocal && !isRefresh) {
        fileLog.info(`[ProgressiveData:${cacheKey}] 📊 Loading local data...`);
        try {
          const localResult = await loadLocal();
          localData = localResult;
          
          if (mountedRef.current && localData) {
            fileLog.info(`[ProgressiveData:${cacheKey}] ✅ Local data loaded, showing immediately`);
            setState(prev => ({
              ...prev,
              data: localData,
              isLoading: false,
              isFresh: false,
              backgroundSync: true, // Fresh data loading in background
              error: null
            }));
          }
        } catch (err) {
          fileLog.warn(`[ProgressiveData:${cacheKey}] ⚠️ Local data load failed:`, err);
        }
      }

      // Phase 2: Load fresh data (background or immediate if no local)
      if (loadFresh) {
        const hasLocalData = localData !== null;
        fileLog.info(`[ProgressiveData:${cacheKey}] ${hasLocalData ? '🔄 Background' : '🌐 Primary'}: Loading fresh data...`);
        
        if (!hasLocalData) {
          // No local data - show loading state
          setState(prev => ({
            ...prev,
            isLoading: true,
            backgroundSync: false,
            error: null
          }));
        }

        const freshData = await loadFresh();
        
        if (mountedRef.current) {
          fileLog.info(`[ProgressiveData:${cacheKey}] ✅ Fresh data loaded${hasLocalData ? ' (background complete)' : ''}`);
          setState(prev => ({
            ...prev,
            data: freshData,
            isLoading: false,
            isFresh: true,
            backgroundSync: false,
            error: null
          }));
        }
      } else if (localData === null) {
        // No fresh loader and no local data - show not loading
        if (mountedRef.current) {
          setState(prev => ({
            ...prev,
            isLoading: false,
            backgroundSync: false
          }));
        }
      }

      // Schedule next refresh if interval is set
      if (refreshInterval && mountedRef.current) {
        refreshTimeoutRef.current = setTimeout(() => {
          loadData(true);
        }, refreshInterval);
      }

    } catch (error) {
      fileLog.error(`[ProgressiveData:${cacheKey}] ❌ Fresh data load failed:`, error);
      if (mountedRef.current) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          backgroundSync: false,
          error: error instanceof Error ? error.message : 'Failed to load data'
        }));
      }
    }
  };

  const refresh = async () => {
    fileLog.info(`[ProgressiveData:${cacheKey}] 🔄 Manual refresh triggered`);
    await loadData(true);
  };

  const clearCache = () => {
    fileLog.info(`[ProgressiveData:${cacheKey}] 🧹 Cache cleared`);
    setState(prev => ({
      ...prev,
      isFresh: false,
      data: fallback || null
    }));
  };

  // Start loading on mount
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ...state,
    refresh,
    clearCache
  };
}

/**
 * Simplified version for basic local-first data loading
 */
export function useLocalFirst<T>(
  loadLocal: () => Promise<T | null> | T | null,
  loadFresh?: () => Promise<T>,
  cacheKey?: string
): ProgressiveDataState<T> & { refresh: () => Promise<void> } {
  return useProgressiveData({
    loadLocal,
    loadFresh,
    cacheKey
  });
}

/**
 * Example usage patterns:
 * 
 * // 1. Tasks with local cache
 * const tasksData = useProgressiveData({
 *   loadLocal: () => taskCache.getAll(),
 *   loadFresh: () => api.getTasks(),
 *   cacheKey: 'tasks'
 * });
 * 
 * // 2. Projects with fallback
 * const projectsData = useProgressiveData({
 *   loadLocal: () => localStorage.getItem('projects') ? JSON.parse(localStorage.getItem('projects')!) : null,
 *   loadFresh: () => api.getProjects(),
 *   fallback: [],
 *   cacheKey: 'projects'
 * });
 * 
 * // 3. Simple local-first
 * const userData = useLocalFirst(
 *   () => userCache.get(userId),
 *   () => api.getUser(userId),
 *   'user'
 * );
 */