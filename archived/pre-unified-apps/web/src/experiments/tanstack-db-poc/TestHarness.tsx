import React, { useState, useEffect } from 'react';
import { useLiveQuery } from '@tanstack/react-db';
import { taskCollection, taskOperations } from './task-collection';
import { Task, TaskStatus } from './task-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function TanStackDBTestHarness() {
  const [performance, setPerformance] = useState<{
    createTime?: number;
    bulkCreateTime?: number;
    queryTime?: number;
    updateTime?: number;
    deleteTime?: number;
  }>({});

  // Use live queries for reactive data
  const { data: allTasks = [], isLoading } = useLiveQuery((q) => 
    q.from({ tasks: taskCollection })
  );

  const { data: todoTasks = [] } = useLiveQuery((q) =>
    q.from({ tasks: taskCollection })
     .where(({ tasks }) => tasks.status === TaskStatus.TODO)
  );

  const { data: inProgressTasks = [] } = useLiveQuery((q) =>
    q.from({ tasks: taskCollection })
     .where(({ tasks }) => tasks.status === TaskStatus.IN_PROGRESS)
  );

  const { data: completedTasks = [] } = useLiveQuery((q) =>
    q.from({ tasks: taskCollection })
     .where(({ tasks }) => tasks.status === TaskStatus.COMPLETED)
  );

  // Performance test functions
  const runCreateTest = async () => {
    const start = performance.now();
    await taskOperations.createTask({
      title: `Test Task ${Date.now()}`,
      description: 'Created for performance testing',
      priority: Math.floor(Math.random() * 5) + 1,
    });
    const end = performance.now();
    setPerformance(prev => ({ ...prev, createTime: end - start }));
  };

  const runBulkCreateTest = async () => {
    const tasks = Array.from({ length: 1000 }, (_, i) => ({
      title: `Bulk Task ${i}`,
      description: `Bulk created task number ${i}`,
      priority: Math.floor(Math.random() * 5) + 1,
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED][Math.floor(Math.random() * 3)],
    }));

    const start = performance.now();
    await taskOperations.bulkCreate(tasks);
    const end = performance.now();
    setPerformance(prev => ({ ...prev, bulkCreateTime: end - start }));
  };

  const runQueryTest = async () => {
    const start = performance.now();
    // Since queries are reactive, we'll just measure the time to access current state
    const todos = todoTasks.length;
    const highPriority = allTasks.filter((task: Task) => task.priority >= 4).length;
    const overdue = allTasks.filter((task: Task) => {
      if (!task.dueDate) return false;
      return new Date(task.dueDate) < new Date() && task.status !== TaskStatus.COMPLETED;
    }).length;
    const end = performance.now();
    setPerformance(prev => ({ ...prev, queryTime: end - start }));
    console.log(`Queries found: ${todos} todos, ${highPriority} high priority, ${overdue} overdue`);
  };

  const runUpdateTest = async () => {
    const tasksToUpdate = allTasks.slice(0, 100);
    const start = performance.now();
    await taskOperations.bulkUpdate(
      tasksToUpdate.map((task: Task) => ({
        id: task.id,
        data: { priority: Math.floor(Math.random() * 5) + 1 },
      }))
    );
    const end = performance.now();
    setPerformance(prev => ({ ...prev, updateTime: end - start }));
  };

  const clearAllTasks = async () => {
    await taskCollection.clear();
  };

  const exportStats = async () => {
    const stats = await taskCollection.getStats();
    console.log('Collection Stats:', stats);
    console.log('Performance Metrics:', performance);
    console.log('Collection State:', {
      isReady: taskCollection.isReady(),
      size: taskCollection.state.size,
      status: taskCollection.status,
    });
  };

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>TanStack DB + Dexie POC Test Harness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Collection Status */}
          <div className="p-2 bg-muted rounded">
            <span className="text-sm">
              Collection Status: <Badge variant={isLoading ? 'secondary' : 'default'}>
                {isLoading ? 'Loading...' : 'Ready'}
              </Badge>
            </span>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{allTasks.length}</div>
              <div className="text-sm text-muted-foreground">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{todoTasks.length}</div>
              <div className="text-sm text-muted-foreground">Todo</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{inProgressTasks.length}</div>
              <div className="text-sm text-muted-foreground">In Progress</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">{completedTasks.length}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </div>
          </div>

          {/* Performance Tests */}
          <div className="space-y-2">
            <h3 className="font-semibold">Performance Tests</h3>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={runCreateTest} variant="outline">
                Test Single Create
                {performance.createTime && <span className="ml-2">({performance.createTime.toFixed(2)}ms)</span>}
              </Button>
              <Button onClick={runBulkCreateTest} variant="outline">
                Test Bulk Create (1000)
                {performance.bulkCreateTime && <span className="ml-2">({performance.bulkCreateTime.toFixed(2)}ms)</span>}
              </Button>
              <Button onClick={runQueryTest} variant="outline">
                Test Queries
                {performance.queryTime && <span className="ml-2">({performance.queryTime.toFixed(2)}ms)</span>}
              </Button>
              <Button onClick={runUpdateTest} variant="outline" disabled={allTasks.length < 100}>
                Test Bulk Update (100)
                {performance.updateTime && <span className="ml-2">({performance.updateTime.toFixed(2)}ms)</span>}
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button onClick={clearAllTasks} variant="destructive">
              Clear All Tasks
            </Button>
            <Button onClick={exportStats} variant="secondary">
              Export Stats to Console
            </Button>
          </div>

          {/* Create Task Form */}
          <CreateTaskForm />

          {/* Task List Preview */}
          <div className="space-y-2">
            <h3 className="font-semibold">Recent Tasks (First 10)</h3>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {allTasks.slice(0, 10).map((task: Task) => (
                <TaskItem key={task.id} task={task} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateTaskForm() {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.TODO);
  const [priority, setPriority] = useState('3');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      await taskOperations.createTask({
        title: title.trim(),
        status,
        priority: parseInt(priority),
      });
      setTitle('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Task title..."
        className="flex-1"
      />
      <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TaskStatus.TODO}>Todo</SelectItem>
          <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
          <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={priority} onValueChange={setPriority}>
        <SelectTrigger className="w-20">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map(p => (
            <SelectItem key={p} value={p.toString()}>P{p}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit">Create</Button>
    </form>
  );
}

function TaskItem({ task }: { task: Task }) {
  const handleStatusChange = async (newStatus: TaskStatus) => {
    await taskOperations.updateTask(task.id, { status: newStatus });
  };

  const handleDelete = async () => {
    await taskOperations.deleteTask(task.id);
  };

  return (
    <div className="flex items-center gap-2 p-2 border rounded">
      <div className="flex-1">
        <span className="font-medium">{task.title}</span>
        <Badge variant="outline" className="ml-2">P{task.priority}</Badge>
      </div>
      <Select value={task.status} onValueChange={handleStatusChange}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TaskStatus.TODO}>Todo</SelectItem>
          <SelectItem value={TaskStatus.IN_PROGRESS}>In Progress</SelectItem>
          <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
        </SelectContent>
      </Select>
      <Button onClick={handleDelete} variant="ghost" size="sm">
        Delete
      </Button>
    </div>
  );
}