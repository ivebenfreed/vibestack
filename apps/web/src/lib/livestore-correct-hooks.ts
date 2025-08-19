/**
 * Correct LiveStore v0.3.1 React Hooks
 * Uses proper query-based approach with useQuery hook
 */

import React from 'react';
import { useStore, useQuery } from '@livestore/react';
import { 
  initializeLiveStoreForOrg, 
  getLiveStoreForOrg,
  tasksForOrg$,
  projectsForOrg$,
  usersForOrg$,
  taskById$,
  projectById$,
  tasksInProject$,
  taskOperations,
  projectOperations
} from './livestore-correct-client';

/**
 * Hook to initialize and get LiveStore for organization
 */
export function useLiveStore(organizationId: string | null) {
  const [store, setStore] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!organizationId) {
      setStore(null);
      setLoading(false);
      return;
    }

    const initStore = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Try to get existing store first
        let storeInstance = getLiveStoreForOrg(organizationId);
        
        // Initialize if not exists
        if (!storeInstance) {
          storeInstance = await initializeLiveStoreForOrg(organizationId);
        }
        
        setStore(storeInstance);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize LiveStore';
        setError(errorMessage);
        console.error(`Failed to initialize LiveStore for org ${organizationId}:`, err);
      } finally {
        setLoading(false);
      }
    };

    initStore();
  }, [organizationId]);

  return { store, loading, error };
}

/**
 * Hook for querying tasks in organization
 */
export function useTasks(organizationId: string | null, projectId?: string) {
  const { store, loading: storeLoading, error: storeError } = useLiveStore(organizationId);
  
  // Use the appropriate query based on whether projectId is provided
  const query = React.useMemo(() => {
    if (!organizationId) return null;
    return projectId 
      ? tasksInProject$(organizationId, projectId)
      : tasksForOrg$(organizationId);
  }, [organizationId, projectId]);
  
  const queryResult = useQuery(query);

  return {
    data: queryResult?.data || [],
    loading: storeLoading || queryResult?.loading || false,
    error: storeError || queryResult?.error || null,
    refetch: queryResult?.refetch || (() => {})
  };
}

/**
 * Hook for querying projects in organization
 */
export function useProjects(organizationId: string | null) {
  const { store, loading: storeLoading, error: storeError } = useLiveStore(organizationId);
  
  const query = React.useMemo(() => {
    return organizationId ? projectsForOrg$(organizationId) : null;
  }, [organizationId]);
  
  const queryResult = useQuery(query);

  return {
    data: queryResult?.data || [],
    loading: storeLoading || queryResult?.loading || false,
    error: storeError || queryResult?.error || null,
    refetch: queryResult?.refetch || (() => {})
  };
}

/**
 * Hook for querying users in organization
 */
export function useUsers(organizationId: string | null) {
  const { store, loading: storeLoading, error: storeError } = useLiveStore(organizationId);
  
  const query = React.useMemo(() => {
    return organizationId ? usersForOrg$(organizationId) : null;
  }, [organizationId]);
  
  const queryResult = useQuery(query);

  return {
    data: queryResult?.data || [],
    loading: storeLoading || queryResult?.loading || false,
    error: storeError || queryResult?.error || null,
    refetch: queryResult?.refetch || (() => {})
  };
}

/**
 * Hook for querying single task
 */
export function useTask(organizationId: string | null, taskId: string | null) {
  const { store, loading: storeLoading, error: storeError } = useLiveStore(organizationId);
  
  const query = React.useMemo(() => {
    return (organizationId && taskId) ? taskById$(organizationId, taskId) : null;
  }, [organizationId, taskId]);
  
  const queryResult = useQuery(query);

  return {
    data: queryResult?.data || null,
    loading: storeLoading || queryResult?.loading || false,
    error: storeError || queryResult?.error || null,
    refetch: queryResult?.refetch || (() => {})
  };
}

/**
 * Hook for querying single project
 */
export function useProject(organizationId: string | null, projectId: string | null) {
  const { store, loading: storeLoading, error: storeError } = useLiveStore(organizationId);
  
  const query = React.useMemo(() => {
    return (organizationId && projectId) ? projectById$(organizationId, projectId) : null;
  }, [organizationId, projectId]);
  
  const queryResult = useQuery(query);

  return {
    data: queryResult?.data || null,
    loading: storeLoading || queryResult?.loading || false,
    error: storeError || queryResult?.error || null,
    refetch: queryResult?.refetch || (() => {})
  };
}

/**
 * Hook for task operations (create, update, delete)
 */
export function useTaskOperations(organizationId: string | null) {
  const { store } = useLiveStore(organizationId);

  const createTask = React.useCallback(async (taskData: {
    id: string;
    title: string;
    description?: string;
    status?: string;
    projectId?: string;
    assignedUserId?: string;
    priority?: 'low' | 'medium' | 'high';
  }) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return taskOperations.create(store, {
      ...taskData,
      organizationId
    });
  }, [store, organizationId]);

  const updateTask = React.useCallback(async (taskId: string, updates: Record<string, any>) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return taskOperations.update(store, taskId, organizationId, updates);
  }, [store, organizationId]);

  const deleteTask = React.useCallback(async (taskId: string) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return taskOperations.delete(store, taskId, organizationId);
  }, [store, organizationId]);

  return {
    createTask,
    updateTask,
    deleteTask,
    available: !!store
  };
}

/**
 * Hook for project operations (create, update, delete)
 */
export function useProjectOperations(organizationId: string | null) {
  const { store } = useLiveStore(organizationId);

  const createProject = React.useCallback(async (projectData: {
    id: string;
    name: string;
    description?: string;
    status?: string;
  }) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return projectOperations.create(store, {
      ...projectData,
      organizationId
    });
  }, [store, organizationId]);

  const updateProject = React.useCallback(async (projectId: string, updates: Record<string, any>) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return projectOperations.update(store, projectId, organizationId, updates);
  }, [store, organizationId]);

  const deleteProject = React.useCallback(async (projectId: string) => {
    if (!store || !organizationId) {
      throw new Error('Store not available');
    }
    
    return projectOperations.delete(store, projectId, organizationId);
  }, [store, organizationId]);

  return {
    createProject,
    updateProject,
    deleteProject,
    available: !!store
  };
}

/**
 * Hook to get the store instance directly (for advanced usage)
 */
export function useStoreInstance(organizationId: string | null) {
  const { store, loading, error } = useLiveStore(organizationId);
  
  return {
    store,
    loading,
    error,
    ready: !!store
  };
}

/**
 * Search hook using LiveStore queries
 */
export function useSearch(organizationId: string | null, searchTerm: string) {
  const [results, setResults] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  const { store } = useLiveStore(organizationId);

  React.useEffect(() => {
    if (!store || !organizationId || !searchTerm.trim()) {
      setResults([]);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      try {
        // Note: This would need a custom query for full-text search
        // For now, we'll combine task and project results
        const taskQuery = tasksForOrg$(organizationId);
        const projectQuery = projectsForOrg$(organizationId);
        
        // Get current data (this would ideally be reactive)
        // This is a simplified implementation
        const allResults: any[] = [];
        
        setResults(allResults);
      } catch (err) {
        console.error('Search failed:', err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();
  }, [store, organizationId, searchTerm]);

  return { results, loading };
}

// Export all hooks
export default {
  useLiveStore,
  useTasks,
  useProjects,
  useUsers,
  useTask,
  useProject,
  useTaskOperations,
  useProjectOperations,
  useStoreInstance,
  useSearch
};