import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePGliteContext } from '@/db/pglite-provider';
import { Task, Project, User, Comment } from '@repo/dataforge/client-entities';
import { useLiveEntity } from '@/db/hooks/useLiveEntity';
import { useLiveEntityIncremental } from '@/db/hooks/useLiveEntityIncremental';
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource';
import { SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

interface PerformanceMetrics {
  updateCount: number;
  totalUpdateTime: number;
  avgUpdateTime: number;
  lastUpdateTime: number;
  dataSize: number;
  startTime: number;
}

interface QueryConfig {
  entityType: 'tasks' | 'projects' | 'users' | 'comments';
  limit: number;
  keyColumn: string;
}

export function LiveQueryPerformanceComparison() {
  const { services } = usePGliteContext();
  
  // Query configuration state
  const [config, setConfig] = useState<QueryConfig>({
    entityType: 'tasks',
    limit: 20,
    keyColumn: 'task_id'
  });

  // Query builders for both hooks
  const [queryBuilders, setQueryBuilders] = useState<{
    regular: SelectQueryBuilder<any> | null;
    incremental: SelectQueryBuilder<any> | null;
  }>({
    regular: null,
    incremental: null
  });

  // Performance metrics for both approaches
  const [regularMetrics, setRegularMetrics] = useState<PerformanceMetrics>({
    updateCount: 0,
    totalUpdateTime: 0,
    avgUpdateTime: 0,
    lastUpdateTime: 0,
    dataSize: 0,
    startTime: Date.now()
  });

  const [incrementalMetrics, setIncrementalMetrics] = useState<PerformanceMetrics>({
    updateCount: 0,
    totalUpdateTime: 0,
    avgUpdateTime: 0,
    lastUpdateTime: 0,
    dataSize: 0,
    startTime: Date.now()
  });

  // Performance measurement refs
  const regularUpdateStartRef = useRef<number>(0);
  const incrementalUpdateStartRef = useRef<number>(0);

  // Initialize query builders when config changes
  useEffect(() => {
    const initializeQueryBuilders = async () => {
      try {
        const dataSource = await getNewPGliteDataSource();
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }

        let regularQB: SelectQueryBuilder<any> | null = null;
        let incrementalQB: SelectQueryBuilder<any> | null = null;

        switch (config.entityType) {
          case 'tasks':
            regularQB = dataSource.getRepository(Task)
              .createQueryBuilder("task")
              .orderBy("task.updatedAt", "DESC")
              .limit(config.limit);
            incrementalQB = dataSource.getRepository(Task)
              .createQueryBuilder("task")
              .orderBy("task.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'projects':
            regularQB = dataSource.getRepository(Project)
              .createQueryBuilder("project")
              .orderBy("project.updatedAt", "DESC")
              .limit(config.limit);
            incrementalQB = dataSource.getRepository(Project)
              .createQueryBuilder("project")
              .orderBy("project.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'users':
            regularQB = dataSource.getRepository(User)
              .createQueryBuilder("user")
              .orderBy("user.updatedAt", "DESC")
              .limit(config.limit);
            incrementalQB = dataSource.getRepository(User)
              .createQueryBuilder("user")
              .orderBy("user.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'comments':
            regularQB = dataSource.getRepository(Comment)
              .createQueryBuilder("comment")
              .orderBy("comment.updatedAt", "DESC")
              .limit(config.limit);
            incrementalQB = dataSource.getRepository(Comment)
              .createQueryBuilder("comment")
              .orderBy("comment.updatedAt", "DESC")
              .limit(config.limit);
            break;
        }

        setQueryBuilders({
          regular: regularQB,
          incremental: incrementalQB
        });

        // Reset metrics when query changes
        const now = Date.now();
        setRegularMetrics({
          updateCount: 0,
          totalUpdateTime: 0,
          avgUpdateTime: 0,
          lastUpdateTime: 0,
          dataSize: 0,
          startTime: now
        });
        setIncrementalMetrics({
          updateCount: 0,
          totalUpdateTime: 0,
          avgUpdateTime: 0,
          lastUpdateTime: 0,
          dataSize: 0,
          startTime: now
        });

      } catch (error) {
        console.error('Error initializing query builders for performance comparison:', error);
      }
    };

    if (services) {
      initializeQueryBuilders();
    }
  }, [config, services]);

  // Hook for regular live query with performance tracking
  const { 
    data: regularData, 
    loading: regularLoading, 
    error: regularError 
  } = useLiveEntity<any>(
    queryBuilders.regular,
    { 
      enabled: !!queryBuilders.regular,
      transform: true 
    }
  );

  // Hook for incremental live query with performance tracking
  const { 
    data: incrementalData, 
    loading: incrementalLoading, 
    error: incrementalError 
  } = useLiveEntityIncremental<any>(
    queryBuilders.incremental,
    config.keyColumn,
    { 
      enabled: !!queryBuilders.incremental,
      transform: true 
    }
  );

  // Debug logging for incremental hook
  useEffect(() => {
    console.log('[LiveQueryPerformanceComparison] Incremental hook debug:', {
      incrementalQueryBuilder: !!queryBuilders.incremental,
      keyColumn: config.keyColumn,
      enabled: !!queryBuilders.incremental,
      incrementalData: incrementalData?.length || 'null',
      incrementalLoading,
      incrementalError: incrementalError?.message || 'none'
    });
  }, [queryBuilders.incremental, config.keyColumn, incrementalData, incrementalLoading, incrementalError]);

  // Track performance metrics for regular query
  useEffect(() => {
    if (regularData !== null) {
      const now = Date.now();
      if (regularUpdateStartRef.current > 0) {
        const updateTime = now - regularUpdateStartRef.current;
        setRegularMetrics(prev => {
          const newUpdateCount = prev.updateCount + 1;
          const newTotalTime = prev.totalUpdateTime + updateTime;
          return {
            updateCount: newUpdateCount,
            totalUpdateTime: newTotalTime,
            avgUpdateTime: newTotalTime / newUpdateCount,
            lastUpdateTime: updateTime,
            dataSize: regularData?.length || 0,
            startTime: prev.startTime
          };
        });
        regularUpdateStartRef.current = 0; // Reset after measurement
      } else {
        // First load - just update data size
        setRegularMetrics(prev => ({
          ...prev,
          dataSize: regularData?.length || 0
        }));
      }
    }
  }, [regularData]);

  // Track performance metrics for incremental query
  useEffect(() => {
    if (incrementalData !== null) {
      const now = Date.now();
      if (incrementalUpdateStartRef.current > 0) {
        const updateTime = now - incrementalUpdateStartRef.current;
        setIncrementalMetrics(prev => {
          const newUpdateCount = prev.updateCount + 1;
          const newTotalTime = prev.totalUpdateTime + updateTime;
          return {
            updateCount: newUpdateCount,
            totalUpdateTime: newTotalTime,
            avgUpdateTime: newTotalTime / newUpdateCount,
            lastUpdateTime: updateTime,
            dataSize: incrementalData?.length || 0,
            startTime: prev.startTime
          };
        });
        incrementalUpdateStartRef.current = 0; // Reset after measurement
      } else {
        // First load - just update data size
        setIncrementalMetrics(prev => ({
          ...prev,
          dataSize: incrementalData?.length || 0
        }));
      }
    }
  }, [incrementalData]);

  // Helper function to get the proper key column for each entity type
  const getKeyColumnForEntity = (entityType: string) => {
    switch (entityType) {
      case 'tasks': return 'task_id';
      case 'projects': return 'project_id';
      case 'users': return 'user_id';
      case 'comments': return 'comment_id';
      default: return 'id';
    }
  };

  // Helper function to trigger updates for testing
  const triggerTestUpdate = async () => {
    if (!services) return;

    try {
      // Mark the start time for both queries when we trigger an update
      regularUpdateStartRef.current = Date.now();
      incrementalUpdateStartRef.current = Date.now();
      
      switch (config.entityType) {
        case 'tasks':
          if (services.tasks && regularData && regularData.length > 0) {
            const randomTask = regularData[Math.floor(Math.random() * regularData.length)];
            await services.tasks.updateTask(randomTask.id, {
              title: `Updated Task ${Date.now()}`,
              description: 'Performance test update'
            });
          }
          break;
        case 'projects':
          if (services.projects && regularData && regularData.length > 0) {
            const randomProject = regularData[Math.floor(Math.random() * regularData.length)];
            await services.projects.updateProject(randomProject.id, {
              name: `Updated Project ${Date.now()}`,
              description: 'Performance test update'
            });
          }
          break;
        // Add other entity types as needed
      }
    } catch (error) {
      console.error('Error triggering test update:', error);
    }
  };

  // Helper function to create test data
  const createTestData = async () => {
    if (!services) return;

    try {
      switch (config.entityType) {
        case 'tasks':
          if (services.tasks) {
            await services.tasks.createTask({
              id: uuidv4(),
              title: `Test Task ${Date.now()}`,
              description: 'Created for performance testing',
              status: 'TODO' as any,
              priority: 'MEDIUM' as any,
              projectId: null,
              assigneeId: null,
              createdBy: 'test-user',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          break;
        case 'projects':
          if (services.projects) {
            await services.projects.createProject({
              id: uuidv4(),
              name: `Test Project ${Date.now()}`,
              description: 'Created for performance testing',
              status: 'ACTIVE' as any,
              createdBy: 'test-user',
              createdAt: new Date(),
              updatedAt: new Date()
            });
          }
          break;
        // Add other entity types as needed
      }
    } catch (error) {
      console.error('Error creating test data:', error);
    }
  };

  const renderMetricsCard = (title: string, metrics: PerformanceMetrics, loading: boolean, error: Error | null, data: any[] | null) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <Badge variant={loading ? "secondary" : error ? "destructive" : "default"}>
            {loading ? "Loading" : error ? "Error" : "Connected"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm font-medium">Data Size</Label>
            <div className="text-2xl font-bold">{metrics.dataSize} rows</div>
          </div>
          <div>
            <Label className="text-sm font-medium">Updates</Label>
            <div className="text-2xl font-bold">{metrics.updateCount}</div>
          </div>
          <div>
            <Label className="text-sm font-medium">Avg Update Time</Label>
            <div className="text-2xl font-bold">
              {metrics.avgUpdateTime > 0 ? `${metrics.avgUpdateTime.toFixed(2)}ms` : 'N/A'}
            </div>
          </div>
          <div>
            <Label className="text-sm font-medium">Last Update</Label>
            <div className="text-2xl font-bold">
              {metrics.lastUpdateTime > 0 ? `${metrics.lastUpdateTime}ms` : 'N/A'}
            </div>
          </div>
        </div>

        {data && data.length > 0 && (
          <div>
            <Label className="text-sm font-medium">Sample Data</Label>
            <div className="text-xs bg-muted p-2 rounded max-h-32 overflow-y-auto">
              <pre>{JSON.stringify(data[0], null, 2)}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Live Query Performance Comparison</h1>
        <p className="text-muted-foreground">
          Compare the performance of regular live queries vs incremental live queries
        </p>
      </div>

      {/* Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Configure the query parameters to test performance differences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="entityType">Entity Type</Label>
              <Select
                value={config.entityType}
                onValueChange={(value: 'tasks' | 'projects' | 'users' | 'comments') =>
                  setConfig(prev => ({ 
                    ...prev, 
                    entityType: value,
                    keyColumn: getKeyColumnForEntity(value)
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tasks">Tasks</SelectItem>
                  <SelectItem value="projects">Projects</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="comments">Comments</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="limit">Result Limit</Label>
              <Input
                id="limit"
                type="number"
                value={config.limit}
                onChange={(e) =>
                  setConfig(prev => ({ ...prev, limit: parseInt(e.target.value) || 20 }))
                }
                min="1"
                max="1000"
              />
            </div>
            
            <div>
              <Label htmlFor="keyColumn">Key Column (for incremental)</Label>
              <Input
                id="keyColumn"
                value={config.keyColumn}
                onChange={(e) =>
                  setConfig(prev => ({ ...prev, keyColumn: e.target.value }))
                }
                placeholder="id"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={createTestData}>Create Test Data</Button>
            <Button onClick={triggerTestUpdate} variant="outline">
              Trigger Update
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Performance Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderMetricsCard(
          "Regular Live Query", 
          regularMetrics, 
          regularLoading, 
          regularError, 
          regularData
        )}
        
        {renderMetricsCard(
          "Incremental Live Query", 
          incrementalMetrics, 
          incrementalLoading, 
          incrementalError, 
          incrementalData
        )}
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Update Count Difference</div>
              <div className="text-2xl font-bold">
                {incrementalMetrics.updateCount - regularMetrics.updateCount}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Avg Time Difference</div>
              <div className="text-2xl font-bold">
                {regularMetrics.avgUpdateTime > 0 && incrementalMetrics.avgUpdateTime > 0
                  ? `${(regularMetrics.avgUpdateTime - incrementalMetrics.avgUpdateTime).toFixed(2)}ms`
                  : 'N/A'
                }
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Performance Winner</div>
              <div className="text-2xl font-bold">
                {regularMetrics.avgUpdateTime > 0 && incrementalMetrics.avgUpdateTime > 0
                  ? (incrementalMetrics.avgUpdateTime < regularMetrics.avgUpdateTime ? 'Incremental' : 'Regular')
                  : 'TBD'
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 