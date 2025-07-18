import { useState, useEffect, useRef } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { 
  useLiveTasks, 
  useLiveTasksWithRelations, 
  useLiveTask, 
  useLiveTaskStats,
  useLiveTaskCount,
  useDexieSyncStatus,
  useLiveTags,
  useLiveTagSets,
  useLiveStatusDefinitions,
  useLiveStatusSets,
  useLiveTaskTags
} from '@/hooks/useDexieLiveTasks';
import { dexieTaskService } from '@/services/dexie-task-service';
import { db } from '@repo/dataforge/dexie-schema';
import type { Task, Tag, TagSet, StatusDefinition, StatusSet } from '@repo/dataforge/client-entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { nanoid } from 'nanoid';

// Performance tracking state
interface PerformanceMetrics {
  lastQueryTime: number;
  lastBulkCreateTime: number;
  lastSingleCreateTime: number;
  lastUpdateTime: number;
  lastDeleteTime: number;
  queryCount: number;
  renderCount: number;
  avgQueryTime: number;
}

export const Route = createFileRoute('/_authenticated/debug/dexie-poc')({
  component: DexiePOC,
});

function DexiePOC() {
  const [selectedTaskId, setSelectedTaskId] = useState<string>();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [filter, setFilter] = useState<{
    projectId?: string;
    assigneeId?: string;
    status?: string;
  }>({});
  
  // Performance tracking state
  const [perfMetrics, setPerfMetrics] = useState<PerformanceMetrics>({
    lastQueryTime: 0,
    lastBulkCreateTime: 0,
    lastSingleCreateTime: 0,
    lastUpdateTime: 0,
    lastDeleteTime: 0,
    queryCount: 0,
    renderCount: 0,
    avgQueryTime: 0,
  });
  const renderCountRef = useRef(0);
  const queryTimesRef = useRef<number[]>([]);

  // Test all the hooks with performance tracking
  const tasks = useLiveTasks(filter);
  const tasksWithRelations = useLiveTasksWithRelations();
  const selectedTask = useLiveTask(selectedTaskId);
  const taskStats = useLiveTaskStats();
  const taskCount = useLiveTaskCount();
  const syncStatus = useDexieSyncStatus();
  
  // Tags and Status hooks
  const tags = useLiveTags();
  const tagSets = useLiveTagSets();
  const statusDefinitions = useLiveStatusDefinitions();
  const statusSets = useLiveStatusSets();
  const selectedTaskTags = useLiveTaskTags(selectedTaskId);

  // Track render performance (when data actually changes)
  useEffect(() => {
    renderCountRef.current++;
    
    // Simulate a query execution time by measuring a simple DB operation
    const measureQueryTime = async () => {
      const queryStartTime = performance.now();
      try {
        // Simple count operation to measure query performance
        await db.tasks.count();
        const queryEndTime = performance.now();
        const queryTime = queryEndTime - queryStartTime;
        
        // Update query times array (keep last 50 measurements)
        queryTimesRef.current = [...queryTimesRef.current, queryTime].slice(-50);
        const avgTime = queryTimesRef.current.length > 0 
          ? queryTimesRef.current.reduce((a, b) => a + b, 0) / queryTimesRef.current.length 
          : 0;
        
        setPerfMetrics(prev => ({
          ...prev,
          lastQueryTime: queryTime,
          queryCount: prev.queryCount + 1,
          renderCount: renderCountRef.current,
          avgQueryTime: avgTime,
        }));
      } catch (error) {
        console.error('Error measuring query time:', error);
      }
    };
    
    measureQueryTime();
  }, [tasks?.length, tasksWithRelations?.length, selectedTask?.id, taskStats?.total, taskCount, tags?.length, statusDefinitions?.length]);

  // Initialize Dexie DB on mount and create default data
  useEffect(() => {
    console.log('[DexiePOC] Component mounted, DB initialized');
    initializeDefaultData();
    return () => {
      console.log('[DexiePOC] Component unmounting');
    };
  }, []);
  
  // Initialize default tags and status definitions
  const initializeDefaultData = async () => {
    try {
      // Check if we have any status sets
      const existingStatusSets = await db.status_sets.toArray();
      if (existingStatusSets.length === 0) {
        // Create default status set
        const statusSetId = nanoid();
        await db.status_sets.add({
          id: statusSetId,
          name: 'Default Status Set',
          description: 'Default task statuses',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clientId: 'dexie-poc-client',
          userId: 'test-user-id'
        });
        
        // Create default status definitions
        const statuses = [
          { name: 'Todo', color: '#94a3b8', isDefault: true },
          { name: 'In Progress', color: '#60a5fa', isDefault: false },
          { name: 'Completed', color: '#4ade80', isDefault: false },
          { name: 'Blocked', color: '#f87171', isDefault: false }
        ];
        
        for (const status of statuses) {
          await db.status_definitions.add({
            id: nanoid(),
            statusSetId,
            name: status.name,
            color: status.color,
            isDefault: status.isDefault,
            order: statuses.indexOf(status),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            clientId: 'dexie-poc-client',
            userId: 'test-user-id'
          });
        }
      }
      
      // Check if we have any tag sets
      const existingTagSets = await db.tag_sets.toArray();
      if (existingTagSets.length === 0) {
        // Create default tag set
        const tagSetId = nanoid();
        await db.tag_sets.add({
          id: tagSetId,
          name: 'Default Tag Set',
          description: 'Default task tags',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clientId: 'dexie-poc-client',
          userId: 'test-user-id'
        });
        
        // Create default tags
        const tagNames = ['Frontend', 'Backend', 'Bug', 'Feature', 'Documentation', 'Testing', 'DevOps', 'UI/UX'];
        const colors = ['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];
        
        for (let i = 0; i < tagNames.length; i++) {
          await db.tags.add({
            id: nanoid(),
            tagSetId,
            name: tagNames[i],
            color: colors[i],
            parentId: undefined,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            clientId: 'dexie-poc-client',
            userId: 'test-user-id'
          });
        }
      }
      
      console.log('[DexiePOC] Default data initialized');
    } catch (error) {
      console.error('[DexiePOC] Error initializing default data:', error);
    }
  };

  // Assign tags to a task
  const assignTagsToTask = async (taskId: string, tagIds: string[]) => {
    try {
      // Remove existing tags
      await db.task_tags.where('taskId').equals(taskId).delete();
      
      // Add new tags
      if (tagIds.length > 0) {
        const taskTags = tagIds.map(tagId => ({
          taskId,
          tagId
        }));
        await db.task_tags.bulkAdd(taskTags);
      }
      
      console.log('[DexiePOC] Tags assigned to task:', taskId, tagIds);
    } catch (error) {
      console.error('[DexiePOC] Error assigning tags:', error);
    }
  };
  
  // Create a test task with performance tracking
  const createTestTask = async () => {
    const testTask: Task = {
      id: nanoid(),
      title: `Test Task ${new Date().toLocaleTimeString()}`,
      description: 'This is a test task created from Dexie POC',
      status: 'todo',
      priority: 'medium',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientId: 'dexie-poc-client',
      userId: 'test-user-id',
      // Optional fields
      projectId: undefined,
      assigneeId: undefined,
      dueDate: undefined,
      completedAt: undefined,
      startDate: undefined,
      statusId: statusDefinitions?.[0]?.id || undefined,
      legacyStatus: 'todo',
      estimatedDuration: undefined,
      actualDuration: undefined,
      order: 0,
      blockedReason: undefined,
    };

    try {
      // Just do the operations without timing to avoid measurement overhead
      await dexieTaskService.save(testTask);
      
      // Assign random tags
      if (tags && tags.length > 0) {
        const randomTags = tags
          .sort(() => Math.random() - 0.5)
          .slice(0, Math.floor(Math.random() * 3) + 1)
          .map(t => t.id);
        await assignTagsToTask(testTask.id, randomTags);
      }
      
      console.log('[DexiePOC] Task created:', testTask);
    } catch (error) {
      console.error('[DexiePOC] Error creating task:', error);
    }
  };

  // Update a task with performance tracking
  const updateTask = async (task: Task) => {
    const updatedTask = {
      ...task,
      title: task.title + ' (updated)',
      updatedAt: new Date().toISOString(),
    };

    try {
      // Time just the database operation
      const dbStartTime = performance.now();
      await dexieTaskService.save(updatedTask);
      const dbEndTime = performance.now();
      const updateTime = dbEndTime - dbStartTime;
      
      setPerfMetrics(prev => ({
        ...prev,
        lastUpdateTime: updateTime,
      }));
      
      console.log(`[DexiePOC] Task updated in ${updateTime.toFixed(2)}ms:`, updatedTask);
    } catch (error) {
      console.error('[DexiePOC] Error updating task:', error);
    }
  };

  // Delete a task with performance tracking
  const deleteTask = async (taskId: string) => {
    try {
      // Time just the database operation
      const dbStartTime = performance.now();
      await dexieTaskService.delete(taskId);
      const dbEndTime = performance.now();
      const deleteTime = dbEndTime - dbStartTime;
      
      setPerfMetrics(prev => ({
        ...prev,
        lastDeleteTime: deleteTime,
      }));
      
      console.log(`[DexiePOC] Task deleted in ${deleteTime.toFixed(2)}ms:`, taskId);
      if (selectedTaskId === taskId) {
        setSelectedTaskId(undefined);
      }
    } catch (error) {
      console.error('[DexiePOC] Error deleting task:', error);
    }
  };

  // Clear all tasks
  const clearAllTasks = async () => {
    try {
      await db.tasks.clear();
      console.log('[DexiePOC] All tasks cleared');
    } catch (error) {
      console.error('[DexiePOC] Error clearing tasks:', error);
    }
  };
  
  // Clear all data
  const clearAllData = async () => {
    try {
      await db.tasks.clear();
      await db.task_tags.clear();
      await db.tags.clear();
      await db.tag_sets.clear();
      await db.status_definitions.clear();
      await db.status_sets.clear();
      console.log('[DexiePOC] All data cleared');
      
      // Reinitialize default data
      await initializeDefaultData();
    } catch (error) {
      console.error('[DexiePOC] Error clearing data:', error);
    }
  };

  // Create bulk tasks for performance testing
  const createBulkTasks = async (count = 100) => {
    const bulkTasks: Task[] = [];
    const statuses = ['todo', 'in_progress', 'completed'] as const;
    const priorities = ['low', 'medium', 'high'] as const;

    for (let i = 0; i < count; i++) {
      bulkTasks.push({
        id: nanoid(),
        title: `Bulk Task ${i + 1}`,
        description: `Description for bulk task ${i + 1}`,
        status: statuses[i % 3],
        priority: priorities[i % 3],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: 'dexie-poc-client',
        userId: 'test-user-id',
        legacyStatus: statuses[i % 3],
        order: i,
        projectId: undefined,
        assigneeId: undefined,
        dueDate: undefined,
        completedAt: undefined,
        startDate: undefined,
        statusId: statusDefinitions?.[i % (statusDefinitions?.length || 1)]?.id || undefined,
        estimatedDuration: undefined,
        actualDuration: undefined,
        blockedReason: undefined,
      });
    }

    try {
      const startTime = performance.now();
      await db.tasks.bulkAdd(bulkTasks);
      const endTime = performance.now();
      const bulkCreateTime = endTime - startTime;
      
      setPerfMetrics(prev => ({
        ...prev,
        lastBulkCreateTime: bulkCreateTime,
      }));
      
      console.log(`[DexiePOC] Created ${bulkTasks.length} tasks in ${bulkCreateTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('[DexiePOC] Error creating bulk tasks:', error);
    }
  };

  // Simple performance test - just bulk operations that were working well
  const testSimplePerformance = async () => {
    console.log('[SIMPLE PERF] Testing bulk operations only...');
    
    const bulkTasks: Task[] = [];
    for (let i = 0; i < 1000; i++) {
      bulkTasks.push({
        id: nanoid(),
        title: `Bulk Test ${i + 1}`,
        description: `Bulk test ${i + 1}`,
        status: 'todo',
        priority: 'medium',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: 'bulk-test-client',
        userId: 'test-user-id',
        projectId: undefined,
        assigneeId: undefined,
        dueDate: undefined,
        completedAt: undefined,
        startDate: undefined,
        statusId: statusDefinitions?.[0]?.id || undefined,
        legacyStatus: 'todo',
        estimatedDuration: undefined,
        actualDuration: undefined,
        order: i,
        blockedReason: undefined,
      });
    }

    try {
      const start = performance.now();
      await db.tasks.bulkAdd(bulkTasks);
      const end = performance.now();
      const totalTime = end - start;
      const perItem = totalTime / 1000;
      
      console.log(`[SIMPLE PERF] 1000 tasks in ${totalTime.toFixed(2)}ms = ${perItem.toFixed(3)}ms per task`);
      
      // Test a simple query
      const queryStart = performance.now();
      const count = await db.tasks.count();
      const queryEnd = performance.now();
      
      console.log(`[SIMPLE PERF] Count query (${count} tasks): ${(queryEnd - queryStart).toFixed(2)}ms`);
      
    } catch (error) {
      console.error('[SIMPLE PERF] Error:', error);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dexie POC - Task Management</h1>
      
      {/* Performance Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Last Query</div>
              <div className="text-lg font-bold">{perfMetrics.lastQueryTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Avg Query</div>
              <div className="text-lg font-bold">{perfMetrics.avgQueryTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Renders</div>
              <div className="text-lg font-bold">{perfMetrics.renderCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Queries</div>
              <div className="text-lg font-bold">{perfMetrics.queryCount}</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Single Create</div>
              <div className="text-lg font-bold">{perfMetrics.lastSingleCreateTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Bulk Create</div>
              <div className="text-lg font-bold">{perfMetrics.lastBulkCreateTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Update</div>
              <div className="text-lg font-bold">{perfMetrics.lastUpdateTime.toFixed(2)}ms</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Delete</div>
              <div className="text-lg font-bold">{perfMetrics.lastDeleteTime.toFixed(2)}ms</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span>Online Status:</span>
              <Badge variant={syncStatus.isOnline ? 'success' : 'destructive'}>
                {syncStatus.isOnline ? 'Online' : 'Offline'}
              </Badge>
            </div>
            <div>Pending Changes: {syncStatus.pendingChanges}</div>
            <div>Last Sync: {syncStatus.lastSync?.toLocaleString() || 'Never'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button onClick={createTestTask}>Create Test Task</Button>
            <Button onClick={testSimplePerformance} variant="outline">Simple Perf Test</Button>
            <Button onClick={() => createBulkTasks(100)} variant="secondary">Create 100 Tasks</Button>
            <Button onClick={() => createBulkTasks(1000)} variant="secondary">Create 1K Tasks</Button>
            <Button onClick={() => createBulkTasks(5000)} variant="secondary">Create 5K Tasks</Button>
            <Button onClick={clearAllTasks} variant="destructive">Clear All Tasks</Button>
            <Button onClick={clearAllData} variant="destructive">Clear All Data</Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Available Tags ({tags?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {tags?.map((tag) => (
              <Badge 
                key={tag.id} 
                style={{ backgroundColor: tag.color + '20', borderColor: tag.color, color: tag.color }}
                variant="outline"
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Available Status Definitions */}
      <Card>
        <CardHeader>
          <CardTitle>Status Definitions ({statusDefinitions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {statusDefinitions?.map((status) => (
              <Badge 
                key={status.id} 
                style={{ backgroundColor: status.color + '20', borderColor: status.color, color: status.color }}
                variant="outline"
              >
                {status.name} {status.isDefault && '(default)'}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Task Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Task Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
              <div className="text-2xl font-bold">{taskCount || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="text-2xl font-bold">{taskStats?.completed || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Overdue</div>
              <div className="text-2xl font-bold">{taskStats?.overdue || 0}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total (from stats)</div>
              <div className="text-2xl font-bold">{taskStats?.total || 0}</div>
            </div>
          </div>
          
          {taskStats && (
            <div className="mt-4 space-y-2">
              <h4 className="font-semibold">By Status:</h4>
              <div className="flex flex-wrap gap-2">
                {Array.from(taskStats.byStatus.entries()).map(([status, count]) => (
                  <Badge key={status} variant="outline">
                    {status}: {count}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button 
              onClick={() => setFilter({})} 
              variant={Object.keys(filter).length === 0 ? 'default' : 'outline'}
            >
              All
            </Button>
            <Button 
              onClick={() => setFilter({ status: 'todo' })} 
              variant={filter.status === 'todo' ? 'default' : 'outline'}
            >
              Todo
            </Button>
            <Button 
              onClick={() => setFilter({ status: 'in_progress' })} 
              variant={filter.status === 'in_progress' ? 'default' : 'outline'}
            >
              In Progress
            </Button>
            <Button 
              onClick={() => setFilter({ status: 'completed' })} 
              variant={filter.status === 'completed' ? 'default' : 'outline'}
            >
              Completed
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Task Count Only - No rendering of individual tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Task Count: {tasks?.length || 0}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Task list rendering disabled to avoid performance issues with large datasets.
            Use the performance tests above to measure Dexie operations.
          </p>
        </CardContent>
      </Card>

      {/* Selected Task Details */}
      {selectedTask && (
        <Card>
          <CardHeader>
            <CardTitle>Selected Task Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Task Info</h4>
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
                  {JSON.stringify(selectedTask, null, 2)}
                </pre>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Current Tags</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedTaskTags?.length > 0 ? (
                    selectedTaskTags.map((tag) => (
                      <Badge 
                        key={tag.id} 
                        style={{ backgroundColor: tag.color + '20', borderColor: tag.color, color: tag.color }}
                        variant="outline"
                      >
                        {tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">No tags assigned</span>
                  )}
                </div>
                
                <h4 className="font-semibold mb-2">Assign Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {tags?.map((tag) => {
                    const isSelected = selectedTags.includes(tag.id);
                    return (
                      <Badge 
                        key={tag.id} 
                        className="cursor-pointer"
                        style={{ 
                          backgroundColor: isSelected ? tag.color : tag.color + '20', 
                          borderColor: tag.color, 
                          color: isSelected ? 'white' : tag.color 
                        }}
                        variant="outline"
                        onClick={() => {
                          setSelectedTags(prev => 
                            isSelected 
                              ? prev.filter(id => id !== tag.id)
                              : [...prev, tag.id]
                          );
                        }}
                      >
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
                
                <Button 
                  className="mt-4"
                  onClick={() => {
                    if (selectedTask) {
                      assignTagsToTask(selectedTask.id, selectedTags);
                      setSelectedTags([]);
                    }
                  }}
                >
                  Update Tags
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks with Relations */}
      <Card>
        <CardHeader>
          <CardTitle>Tasks with Relations ({tasksWithRelations?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {tasksWithRelations?.slice(0, 5).map((task) => (
              <div key={task.id} className="p-3 border rounded-lg">
                <h3 className="font-semibold">{task.title}</h3>
                <div className="text-sm mt-2 space-y-1">
                  {task.assignee && (
                    <div>Assignee: {task.assignee.name || task.assignee.email}</div>
                  )}
                  {task.project && (
                    <div>Project: {task.project.name}</div>
                  )}
                  {task.status && (
                    <div>Status: {task.status.name}</div>
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div>Tags: {task.tags.map(t => t.name).join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}