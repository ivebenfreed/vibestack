import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePGliteContext } from '@/db/pglite-provider';
import { Task, Project, User, Comment } from '@repo/dataforge/client-entities';
import { useLiveEntity } from '@/db/hooks/useLiveEntity';
import { useLiveEntityIncremental } from '@/db/hooks/useLiveEntityIncremental';
import { getNewPGliteDataSource } from '@/db/newtypeorm/NewDataSource';
import { SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

interface QueryConfig {
  id: string;
  name: string;
  entityType: 'tasks' | 'projects' | 'users' | 'comments';
  limit: number;
  keyColumn: string;
  enabled: boolean;
}

interface QueryPerformance {
  updateCount: number;
  totalUpdateTime: number;
  avgUpdateTime: number;
  lastUpdateTime: number;
  dataSize: number;
}

export function MultiQueryPerformanceTest() {
  const { services } = usePGliteContext();
  
  // Multiple query configurations
  const [queryConfigs] = useState<QueryConfig[]>([
    { id: '1', name: 'Recent Tasks', entityType: 'tasks', limit: 10, keyColumn: 'task_id', enabled: true },
    { id: '2', name: 'All Tasks', entityType: 'tasks', limit: 50, keyColumn: 'task_id', enabled: true },
    { id: '3', name: 'Projects', entityType: 'projects', limit: 20, keyColumn: 'project_id', enabled: true },
    { id: '4', name: 'Users', entityType: 'users', limit: 30, keyColumn: 'user_id', enabled: true },
    { id: '5', name: 'Top Tasks', entityType: 'tasks', limit: 5, keyColumn: 'task_id', enabled: true },
  ]);

  // Control whether to use incremental or regular queries
  const [useIncremental, setUseIncremental] = useState(true);
  
  // Global performance tracking
  const [globalStats, setGlobalStats] = useState({
    totalQueries: 0,
    totalUpdates: 0,
    avgResponseTime: 0,
    memoryUsage: 0
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Multi-Query Performance Test</h1>
        <p className="text-muted-foreground">
          Test multiple live queries running simultaneously to compare regular vs incremental performance
        </p>
      </div>

      {/* Global Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Test Configuration</CardTitle>
          <CardDescription>
            Configure how the queries should run
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="use-incremental"
              checked={useIncremental}
              onCheckedChange={setUseIncremental}
            />
            <Label htmlFor="use-incremental">
              Use Incremental Queries ({useIncremental ? 'ON' : 'OFF'})
            </Label>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Active Queries</div>
              <div className="text-2xl font-bold">{queryConfigs.filter(q => q.enabled).length}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Total Updates</div>
              <div className="text-2xl font-bold">{globalStats.totalUpdates}</div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Avg Response</div>
              <div className="text-2xl font-bold">
                {globalStats.avgResponseTime > 0 ? `${globalStats.avgResponseTime.toFixed(2)}ms` : 'N/A'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-sm text-muted-foreground">Query Type</div>
              <div className="text-2xl font-bold">
                <Badge variant={useIncremental ? "default" : "secondary"}>
                  {useIncremental ? 'Incremental' : 'Regular'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <TriggerUpdatesButton services={services} />
            <CreateTestDataButton services={services} />
            <Button 
              variant="outline" 
              onClick={() => window.location.reload()}
            >
              Reset Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Query Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {queryConfigs.map(config => (
          <QueryCard
            key={config.id}
            config={config}
            useIncremental={useIncremental}
            onPerformanceUpdate={(perf) => {
              setGlobalStats(prev => ({
                ...prev,
                totalUpdates: prev.totalUpdates + 1,
                avgResponseTime: perf.avgUpdateTime
              }));
            }}
          />
        ))}
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              <strong>Testing Multiple Queries:</strong> This simulates a real application with multiple live data feeds. 
              Incremental queries should show better performance with multiple concurrent subscriptions, 
              especially when dealing with frequent updates and large datasets.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}

// Individual Query Card Component
function QueryCard({ 
  config, 
  useIncremental, 
  onPerformanceUpdate 
}: { 
  config: QueryConfig;
  useIncremental: boolean;
  onPerformanceUpdate: (perf: QueryPerformance) => void;
}) {
  const [queryBuilder, setQueryBuilder] = useState<SelectQueryBuilder<any> | null>(null);
  const [performance, setPerformance] = useState<QueryPerformance>({
    updateCount: 0,
    totalUpdateTime: 0,
    avgUpdateTime: 0,
    lastUpdateTime: 0,
    dataSize: 0
  });
  
  // Add state to track when updates are triggered
  const [lastTriggerTime, setLastTriggerTime] = useState<number>(0);
  const [triggerTimeRef, setTriggerTimeRef] = useState<number>(0);

  // Initialize query builder
  useEffect(() => {
    const initializeQueryBuilder = async () => {
      try {
        const dataSource = await getNewPGliteDataSource();
        if (!dataSource.isInitialized) {
          await dataSource.initialize();
        }

        let qb: SelectQueryBuilder<any> | null = null;

        switch (config.entityType) {
          case 'tasks':
            qb = dataSource.getRepository(Task)
              .createQueryBuilder("task")
              .orderBy("task.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'projects':
            qb = dataSource.getRepository(Project)
              .createQueryBuilder("project")
              .orderBy("project.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'users':
            qb = dataSource.getRepository(User)
              .createQueryBuilder("user")
              .orderBy("user.updatedAt", "DESC")
              .limit(config.limit);
            break;
          case 'comments':
            qb = dataSource.getRepository(Comment)
              .createQueryBuilder("comment")
              .orderBy("comment.updatedAt", "DESC")
              .limit(config.limit);
            break;
        }

        setQueryBuilder(qb);
      } catch (error) {
        console.error('Error initializing query builder:', error);
      }
    };

    if (config.enabled) {
      initializeQueryBuilder();
    }
  }, [config]);

  // Listen for global update triggers to track timing
  useEffect(() => {
    const handleUpdateTrigger = () => {
      const triggerTime = Date.now();
      setTriggerTimeRef(triggerTime);
      console.log(`[${config.name}] Update triggered at:`, triggerTime);
    };

    // Listen for both task creation and update events
    window.addEventListener('task-created', handleUpdateTrigger);
    window.addEventListener('task-updated', handleUpdateTrigger);
    
    return () => {
      window.removeEventListener('task-created', handleUpdateTrigger);
      window.removeEventListener('task-updated', handleUpdateTrigger);
    };
  }, [config.name]);

  // Use the appropriate hook based on configuration
  const regularResult = useLiveEntity<any>(
    !useIncremental ? queryBuilder : null,
    { 
      enabled: !useIncremental && config.enabled && !!queryBuilder,
      transform: true 
    }
  );

  const incrementalResult = useLiveEntityIncremental<any>(
    useIncremental ? queryBuilder : null,
    config.keyColumn,
    { 
      enabled: useIncremental && config.enabled && !!queryBuilder,
      transform: true 
    }
  );

  const { data, loading, error } = useIncremental ? incrementalResult : regularResult;

  // Update performance metrics when data changes (response received)
  useEffect(() => {
    if (data !== null && triggerTimeRef > 0) {
      const responseTime = Date.now();
      const queryDuration = responseTime - triggerTimeRef;
      
      console.log(`[${config.name}] Response received, duration: ${queryDuration}ms`);
      
      const newPerformance = {
        updateCount: performance.updateCount + 1,
        totalUpdateTime: performance.totalUpdateTime + queryDuration,
        avgUpdateTime: (performance.totalUpdateTime + queryDuration) / (performance.updateCount + 1),
        lastUpdateTime: queryDuration,
        dataSize: data.length
      };
      
      setPerformance(newPerformance);
      onPerformanceUpdate(newPerformance);
      
      // Reset trigger time after measurement
      setTriggerTimeRef(0);
    }
  }, [data, triggerTimeRef, performance.updateCount, performance.totalUpdateTime, config.name, onPerformanceUpdate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          {config.name}
          <Badge variant={loading ? "secondary" : error ? "destructive" : "default"}>
            {loading ? "Loading" : error ? "Error" : "Connected"}
          </Badge>
        </CardTitle>
        <CardDescription>
          {config.entityType} • Limit: {config.limit} • Key: {config.keyColumn}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Data Size</div>
            <div className="font-semibold">{performance.dataSize} rows</div>
          </div>
          <div>
            <div className="text-muted-foreground">Updates</div>
            <div className="font-semibold">{performance.updateCount}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Avg Time</div>
            <div className="font-semibold">
              {performance.avgUpdateTime > 0 ? `${performance.avgUpdateTime.toFixed(1)}ms` : 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Last Update</div>
            <div className="font-semibold">
              {performance.lastUpdateTime > 0 ? `${performance.lastUpdateTime}ms` : 'N/A'}
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription className="text-xs">{error.message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

// Helper Components
function TriggerUpdatesButton({ services }: { services: any }) {
  const triggerRandomUpdate = async () => {
    if (!services?.tasks) return;
    
    try {
      // Trigger multiple updates to test concurrent performance
      const tasks = await services.tasks.getAll();
      if (tasks.length > 0) {
        const randomTask = tasks[Math.floor(Math.random() * tasks.length)];
        await services.tasks.updateTask(randomTask.id, {
          title: `Multi-Query Test ${Date.now()}`,
          description: 'Concurrent update test'
        });
      }
    } catch (error) {
      console.error('Error triggering update:', error);
    }
  };

  return (
    <Button onClick={triggerRandomUpdate}>
      Trigger Random Update
    </Button>
  );
}

function CreateTestDataButton({ services }: { services: any }) {
  const createTestData = async () => {
    if (!services?.tasks || !services?.projects) return;
    
    try {
      // First, try to get an existing project or create one
      let projectId = null;
      const projects = await services.projects.getAll();
      if (projects.length > 0) {
        projectId = projects[0].id;
      } else {
        // Create a project if none exists
        const newProject = await services.projects.createProject({
          name: `Test Project ${Date.now()}`,
          description: 'Created for multi-query testing'
        });
        projectId = newProject.id;
      }

      await services.tasks.createTask({
        id: uuidv4(),
        title: `Test Task ${Date.now()}`,
        description: 'Created for multi-query performance testing',
        status: 'TODO' as any,
        priority: 'MEDIUM' as any,
        projectId: projectId,
        assigneeId: null,
        createdBy: 'test-user',
        createdAt: new Date(),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error creating test data:', error);
    }
  };

  return (
    <Button variant="outline" onClick={createTestData}>
      Create Test Data
    </Button>
  );
} 