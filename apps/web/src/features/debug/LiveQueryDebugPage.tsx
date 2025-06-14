import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Activity, Zap, BarChart3, RefreshCw, Eye, TestTube } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { usePGliteContext } from '@/db/pglite-provider';
import { useLiveEntity } from '@/db/hooks/useLiveEntity';
import { useLiveEntityIncremental } from '@/db/hooks/useLiveEntityIncremental';
import { useLiveChanges, EntityChange } from '@/db/hooks/useLiveChanges';
import { Task } from '@repo/dataforge/client-entities';
import { getDatabase } from '@/db/db';

import NewEditableSelect from '@/components/custom/NewEditableSelect';
import RichEditableText from '@/components/custom/RichEditableText';

interface PerformanceMetrics {
  updateCount: number;
  totalUpdateTime: number;
  avgUpdateTime: number;
  lastUpdateTime: number;
  dataSize: number;
  startTime: number;
  queryType: 'live' | 'incremental';
}

export function LiveQueryDebugPage() {
  const { services, createQueryBuilder, isDataSourceReady } = usePGliteContext();
  
  // Main state
  const [selectedTaskId, setSelectedTaskId] = useState<string | undefined>(undefined);
  const [useIncremental, setUseIncremental] = useState(false);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [isLoadingTasks, setIsLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Debug state for detailed logging
  const [debugInfo, setDebugInfo] = useState<{
    queryBuilderStatus: string;
    hookStatus: string;
    sqlQuery: string;
    keyColumn: string;
    lastUpdate: string;
    databaseStatus: string;
    liveExtensionStatus: string;
    incrementalSupport: string;
  }>({
    queryBuilderStatus: 'Not created',
    hookStatus: 'Not initialized',
    sqlQuery: '',
    keyColumn: '',
    lastUpdate: 'Never',
    databaseStatus: 'Not checked',
    liveExtensionStatus: 'Not checked',
    incrementalSupport: 'Not checked'
  });
  
  // Performance tracking
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics>({
    updateCount: 0,
    totalUpdateTime: 0,
    avgUpdateTime: 0,
    lastUpdateTime: 0,
    dataSize: 0,
    startTime: Date.now(),
    queryType: 'live'
  });

  // State for live changes hook demo
  const [liveChanges, setLiveChanges] = useState<EntityChange<Task>[]>([]);
  const [useChangesAPI, setUseChangesAPI] = useState(false);

  // Database diagnostics
  const checkDatabaseStatus = useCallback(async () => {
    try {
      const db = await getDatabase();
      
      const hasLive = !!db.live;
      const hasLiveQuery = !!(db.live && db.live.query);
      const hasIncrementalQuery = !!(db.live && db.live.incrementalQuery);
      
      console.log('[LiveQueryDebugPage] Database diagnostic:', {
        database: !!db,
        hasLive,
        hasLiveQuery,
        hasIncrementalQuery,
        liveKeys: db.live ? Object.keys(db.live) : [],
      });
      
      setDebugInfo(prev => ({
        ...prev,
        databaseStatus: `Connected: ${!!db}`,
        liveExtensionStatus: `Available: ${hasLive}, Query: ${hasLiveQuery}`,
        incrementalSupport: `Available: ${hasIncrementalQuery}`
      }));
      
    } catch (error) {
      console.error('[LiveQueryDebugPage] Database diagnostic error:', error);
      setDebugInfo(prev => ({
        ...prev,
        databaseStatus: `Error: ${error}`,
        liveExtensionStatus: 'Error checking',
        incrementalSupport: 'Error checking'
      }));
    }
  }, []);

  // Test live queries manually
  const testLiveQuery = useCallback(async () => {
    try {
      console.log('[LiveQueryDebugPage] 🧪 Testing live query manually...');
      const db = await getDatabase();
      
      if (!db.live || !db.live.query) {
        console.error('[LiveQueryDebugPage] ❌ Live query not available');
        return;
      }
      
      let updateCount = 0;
      const sql = 'SELECT * FROM tasks ORDER BY updated_at DESC LIMIT 5';
      console.log('[LiveQueryDebugPage] 🧪 Setting up manual live query:', sql);
      
      const liveQueryResult = await db.live.query(sql, [], (results: any) => {
        updateCount++;
        console.log(`[LiveQueryDebugPage] 🧪 Manual live query update #${updateCount}:`, results);
        console.log(`[LiveQueryDebugPage] 🧪 Results count: ${results.rows?.length || 0}`);
      });
      
      console.log('[LiveQueryDebugPage] 🧪 Manual live query set up successfully');
      console.log('[LiveQueryDebugPage] 🧪 Initial results:', liveQueryResult.initialResults?.rows?.length || 0, 'rows');
      
      // Clean up after 10 seconds
      setTimeout(async () => {
        await liveQueryResult.unsubscribe();
        console.log('[LiveQueryDebugPage] 🧪 Manual live query unsubscribed');
      }, 10000);
      
    } catch (error) {
      console.error('[LiveQueryDebugPage] ❌ Manual live query test failed:', error);
    }
  }, []);

  // Check database status on mount
  useEffect(() => {
    checkDatabaseStatus();
  }, [checkDatabaseStatus]);

  // Create query builder for ALL tasks (no limit as requested)
  const allTasksQueryBuilder = useMemo(() => {
    console.log('[LiveQueryDebugPage] Creating query builder...', { isDataSourceReady, createQueryBuilder: !!createQueryBuilder, useIncremental });
    
    if (!isDataSourceReady || !createQueryBuilder) {
      console.log('[LiveQueryDebugPage] DataSource not ready for query builder creation');
      setDebugInfo(prev => ({ ...prev, queryBuilderStatus: 'DataSource not ready' }));
      return null;
    }
    
    try {
      // Use different ordering for live vs incremental queries
      // Live Query: ORDER BY updated_at DESC (realistic, shows recent changes first)
      // Incremental Query: ORDER BY id ASC (stable, doesn't change positions on updates)
      const qb = createQueryBuilder(Task, 'task');
      
      if (useIncremental) {
        // For incremental queries, use stable ordering that doesn't change when records are updated
        qb.orderBy('task.id', 'ASC');
        console.log('[LiveQueryDebugPage] Using stable ordering (id ASC) for incremental query');
      } else {
        // For live queries, use realistic ordering showing most recent first
        qb.orderBy('task.updatedAt', 'DESC');
        console.log('[LiveQueryDebugPage] Using realistic ordering (updatedAt DESC) for live query');
      }
      
      console.log('[LiveQueryDebugPage] Query builder created successfully');
      console.log('[LiveQueryDebugPage] SQL:', qb.getSql());
      console.log('[LiveQueryDebugPage] Parameters:', qb.getParameters());
      
      setDebugInfo(prev => ({ 
        ...prev, 
        queryBuilderStatus: 'Created successfully',
        sqlQuery: qb.getSql(),
        keyColumn: useIncremental ? 'task_id' : 'N/A (live query)'
      }));
      
      return qb;
    } catch (error) {
      console.error('[LiveQueryDebugPage] Error creating query builder:', error);
      setDebugInfo(prev => ({ ...prev, queryBuilderStatus: `Error: ${error}` }));
      return null;
    }
  }, [isDataSourceReady, createQueryBuilder, useIncremental]);

  // Performance tracking refs
  const updateStartTimeRef = React.useRef<number>(0);
  const queryStartTimeRef = React.useRef<number>(Date.now());

  // Live query hook with detailed logging
  const liveQueryResult = useLiveEntity<Task>(
    !useIncremental ? allTasksQueryBuilder : null,
    { 
      enabled: !useIncremental && !!allTasksQueryBuilder,
      transform: true 
    }
  );

  // Live incremental query hook with detailed logging
  // IMPORTANT: For TypeORM queries, the key column in results is prefixed with alias
  const keyColumnForIncremental = 'task_id'; // This matches the actual SQL result column name (lowercase)
  const incrementalQueryResult = useLiveEntityIncremental<Task>(
    useIncremental ? allTasksQueryBuilder : null,
    keyColumnForIncremental, // Use the correct SQL result column name
    { 
      enabled: useIncremental && !!allTasksQueryBuilder,
      transform: true 
    }
  );

  // Get the active result based on query type
  const { data: queryData, loading: queryLoading, error: queryError } = 
    useIncremental ? incrementalQueryResult : liveQueryResult;

  // Enhanced logging for hook status
  useEffect(() => {
    const hookType = useIncremental ? 'incremental' : 'live';
    const status = queryLoading ? 'Loading' : queryError ? `Error: ${queryError.message}` : queryData ? `Active (${queryData.length} tasks)` : 'No data';
    
    console.log(`[LiveQueryDebugPage] ${hookType} hook status:`, {
      loading: queryLoading,
      error: queryError?.message,
      dataCount: queryData?.length,
      enabled: useIncremental ? (useIncremental && !!allTasksQueryBuilder) : (!useIncremental && !!allTasksQueryBuilder)
    });
    
    setDebugInfo(prev => ({ 
      ...prev, 
      hookStatus: `${hookType}: ${status}`,
      keyColumn: useIncremental ? keyColumnForIncremental : 'N/A (live query)'
    }));
  }, [queryLoading, queryError, queryData, useIncremental, allTasksQueryBuilder]);

  // Track performance when data updates
  useEffect(() => {
    if (queryData) {
      const updateEndTime = Date.now();
      const updateDuration = updateStartTimeRef.current > 0 ? 
        updateEndTime - updateStartTimeRef.current : 0;
      
      console.log(`[LiveQueryDebugPage] ✅ ${useIncremental ? 'Incremental' : 'Live'} query data updated!`, {
        taskCount: queryData.length,
        updateDuration: updateDuration + 'ms',
        queryType: useIncremental ? 'incremental' : 'live',
        updateStartTime: updateStartTimeRef.current,
        updateEndTime
      });
      
      setPerformanceMetrics(prev => {
        const newUpdateCount = prev.updateCount + 1;
        const newTotalTime = prev.totalUpdateTime + updateDuration;
        
        return {
          ...prev,
          updateCount: newUpdateCount,
          totalUpdateTime: newTotalTime,
          avgUpdateTime: newTotalTime / newUpdateCount,
          lastUpdateTime: updateDuration,
          dataSize: queryData.length,
          queryType: useIncremental ? 'incremental' : 'live'
        };
      });
      
      // Update local tasks state
      setAllTasks(queryData);
      setError(null);
      setDebugInfo(prev => ({ ...prev, lastUpdate: new Date().toLocaleTimeString() }));
    }
  }, [queryData, useIncremental]);

  // Track errors
  useEffect(() => {
    if (queryError) {
      setError(queryError.message);
      console.error('[LiveQueryDebugPage] Query error:', queryError);
    }
  }, [queryError]);

  // Reset performance metrics when switching query types
  useEffect(() => {
    const now = Date.now();
    updateStartTimeRef.current = now;
    queryStartTimeRef.current = now;
    
    console.log(`[LiveQueryDebugPage] 🔄 Switched to ${useIncremental ? 'incremental' : 'live'} query mode`);
    
    setPerformanceMetrics({
      updateCount: 0,
      totalUpdateTime: 0,
      avgUpdateTime: 0,
      lastUpdateTime: 0,
      dataSize: 0,
      startTime: now,
      queryType: useIncremental ? 'incremental' : 'live'
    });
    
    setDebugInfo(prev => ({ 
      ...prev, 
      keyColumn: useIncremental ? keyColumnForIncremental : 'N/A (live query)',
      lastUpdate: 'Switched query type'
    }));
  }, [useIncremental]);

  // Prepare task options for the dropdown
  const taskOptions = useMemo(() => {
    return allTasks.map(task => ({
      value: task.id,
      label: task.title || `Task ${task.id.substring(0, 8)}`
    }));
  }, [allTasks]);

  // Get selected task
  const selectedTask = useMemo(() => {
    return allTasks.find(task => task.id === selectedTaskId) || null;
  }, [allTasks, selectedTaskId]);

  // Auto-select first task if none selected and we have tasks
  useEffect(() => {
    if (!selectedTaskId && allTasks.length > 0) {
      setSelectedTaskId(allTasks[0].id);
      console.log('[LiveQueryDebugPage] Auto-selected first task:', allTasks[0].id);
    }
  }, [selectedTaskId, allTasks]);

  // Handle task selection
  const handleTaskSelection = useCallback(async (taskId: string | undefined) => {
    console.log('[LiveQueryDebugPage] Task selected:', taskId);
    setSelectedTaskId(taskId);
  }, []);

  // Handle description update
  const handleDescriptionUpdate = useCallback(async (newDescription: string) => {
    if (!selectedTask || !services?.tasks) {
      throw new Error('No task selected or services not available');
    }

    console.log('[LiveQueryDebugPage] 🔄 Starting task description update:', {
      taskId: selectedTask.id,
      oldDescription: selectedTask.description,
      newDescription
    });

    updateStartTimeRef.current = Date.now();
    
    try {
      await services.tasks.updateTask(selectedTask.id, { 
        description: newDescription 
      });
      
      console.log('[LiveQueryDebugPage] ✅ Task description updated successfully');
      console.log('[LiveQueryDebugPage] 👀 Waiting for live query to detect the change...');
    } catch (error) {
      console.error('[LiveQueryDebugPage] ❌ Error updating task description:', error);
      throw error;
    }
  }, [selectedTask, services?.tasks]);

  // Test functions to trigger updates
  const triggerTestUpdate = useCallback(async () => {
    if (!selectedTask || !services?.tasks) return;

    console.log('[LiveQueryDebugPage] 🔄 Triggering test title update for task:', selectedTask.id);
    console.log('[LiveQueryDebugPage] 🔍 Current task state:', {
      id: selectedTask.id,
      title: selectedTask.title,
      updatedAt: selectedTask.updatedAt
    });
    
    updateStartTimeRef.current = Date.now();
    
    try {
      const updateData = {
        title: `${selectedTask.title?.replace(/ \(Updated \d+\)$/, '')} (Updated ${Date.now()})`
      };
      
      console.log('[LiveQueryDebugPage] 🔍 Update data:', updateData);
      
      await services.tasks.updateTask(selectedTask.id, updateData);
      console.log('[LiveQueryDebugPage] ✅ Test update triggered');
      console.log('[LiveQueryDebugPage] 👀 Waiting for live query to detect the change...');
      console.log('[LiveQueryDebugPage] 🔍 Expected: Only 1 row should be returned for task:', selectedTask.id);
    } catch (error) {
      console.error('[LiveQueryDebugPage] ❌ Error triggering test update:', error);
    }
  }, [selectedTask, services?.tasks]);

  // Add a test for checking what PGlite's incremental query actually returns
  const testIncrementalBehavior = useCallback(async () => {
    if (!selectedTask) return;
    
    try {
      console.log('[LiveQueryDebugPage] 🧪 Testing incremental query behavior...');
      const db = await getDatabase();
      
      if (!db.live?.incrementalQuery) {
        console.error('[LiveQueryDebugPage] ❌ Incremental query not available');
        return;
      }
      
      const sql = 'SELECT task_id, task_title, task_updated_at FROM (SELECT "task"."id" AS "task_id", "task"."title" AS "task_title", "task"."updated_at" AS "task_updated_at" FROM "tasks" "task" ORDER BY "task"."id" ASC) ORDER BY task_id ASC';
      
      console.log('[LiveQueryDebugPage] 🧪 Setting up manual incremental query...');
      
      let updateCount = 0;
      const liveQueryResult = await db.live.incrementalQuery(
        sql,
        [],
        'task_id',
        (results: any) => {
          updateCount++;
          console.log(`[LiveQueryDebugPage] 🧪 Manual incremental update #${updateCount}:`, {
            rowCount: results.rows?.length || 0,
            firstFewRows: results.rows?.slice(0, 3)
          });
        }
      );
      
      console.log('[LiveQueryDebugPage] 🧪 Manual incremental query set up, initial results:', liveQueryResult.initialResults?.rows?.length || 0);
      
      // Clean up after 30 seconds
      setTimeout(async () => {
        await liveQueryResult.unsubscribe();
        console.log('[LiveQueryDebugPage] 🧪 Manual incremental query unsubscribed');
      }, 30000);
      
    } catch (error) {
      console.error('[LiveQueryDebugPage] ❌ Manual incremental test failed:', error);
    }
  }, [selectedTask]);

  // Add a test for checking what PGlite's changes API actually returns (only changed rows)
  const testChangesAPI = useCallback(async () => {
    if (!selectedTask) return;
    
    try {
      console.log('[LiveQueryDebugPage] 🧪 Testing live.changes() API (only changed rows)...');
      const db = await getDatabase();
      
      if (!db.live?.changes) {
        console.error('[LiveQueryDebugPage] ❌ Changes API not available');
        return;
      }
      
      const sql = 'SELECT task_id, task_title, task_updated_at FROM (SELECT "task"."id" AS "task_id", "task"."title" AS "task_title", "task"."updated_at" AS "task_updated_at" FROM "tasks" "task" ORDER BY "task"."id" ASC) ORDER BY task_id ASC';
      
      console.log('[LiveQueryDebugPage] 🧪 Setting up live.changes() API...');
      
      let changeCount = 0;
      const changesResult = await db.live.changes(
        sql,
        [],
        'task_id',
        (changes: any[]) => {
          changeCount++;
          console.log(`[LiveQueryDebugPage] 🧪 Changes update #${changeCount}:`, {
            changeCount: changes.length,
            changes: changes.map(change => ({
              op: change.__op__,
              id: change.task_id,
              changedColumns: change.__changed_columns__
            }))
          });
        }
      );
      
      console.log('[LiveQueryDebugPage] 🧪 Live changes API set up, initial changes:', changesResult.initialChanges?.length || 0);
      
      // Clean up after 30 seconds
      setTimeout(async () => {
        await changesResult.unsubscribe();
        console.log('[LiveQueryDebugPage] 🧪 Live changes API unsubscribed');
      }, 30000);
      
    } catch (error) {
      console.error('[LiveQueryDebugPage] ❌ Live changes API test failed:', error);
    }
  }, [selectedTask]);

  const clearPerformanceStats = useCallback(() => {
    const now = Date.now();
    setPerformanceMetrics({
      updateCount: 0,
      totalUpdateTime: 0,
      avgUpdateTime: 0,
      lastUpdateTime: 0,
      dataSize: allTasks.length,
      startTime: now,
      queryType: useIncremental ? 'incremental' : 'live'
    });
    queryStartTimeRef.current = now;
    setDebugInfo(prev => ({ ...prev, lastUpdate: 'Stats cleared' }));
    console.log('[LiveQueryDebugPage] Performance stats cleared');
  }, [allTasks.length, useIncremental]);

  // Demo of the new useLiveChanges hook
  const liveChangesResult = useLiveChanges<Task>(
    useChangesAPI && allTasksQueryBuilder ? allTasksQueryBuilder : null,
    'task_id',
    {
      enabled: useChangesAPI && !!allTasksQueryBuilder,
      transform: true,
      onChanges: useCallback((changes: EntityChange<Task>[]) => {
        console.log('[LiveQueryDebugPage] 🔥 Live changes received via hook:', changes);
        setLiveChanges(prev => [...changes, ...prev].slice(0, 20)); // Keep last 20 changes
      }, [])
    }
  );

  return (
    <ContentContainer>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Query Debug</h1>
          <p className="text-muted-foreground">
            Monitor live query performance and status
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Live Query Monitor</CardTitle>
            <CardDescription>Real-time query tracking and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Live query debug functionality coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </ContentContainer>
  );
}

export default LiveQueryDebugPage; 