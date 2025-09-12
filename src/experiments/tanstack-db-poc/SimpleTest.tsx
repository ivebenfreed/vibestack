import React, { useEffect, useState } from 'react';
import { taskCollection } from './task-collection';
import { TaskStatus } from './task-schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function SimpleTest() {
  const [collectionInfo, setCollectionInfo] = useState<any>({});
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    // Check collection properties
    const updateInfo = () => {
      const info = {
        id: taskCollection.id,
        isReady: taskCollection.isReady(),
        status: taskCollection.status,
        hasInsert: typeof taskCollection.insert === 'function',
        hasUpdate: typeof taskCollection.update === 'function',
        hasDelete: typeof taskCollection.delete === 'function',
        hasState: taskCollection.state !== undefined,
        stateSize: taskCollection.state?.size || 0,
        hasSubscribeChanges: typeof taskCollection.subscribeChanges === 'function',
        hasStartSyncImmediate: typeof taskCollection.startSyncImmediate === 'function',
        hasLoadFromDexie: typeof (taskCollection as any).loadFromDexie === 'function',
      };
      setCollectionInfo(info);
    };

    // Update info initially
    updateInfo();

    // Manually trigger load from Dexie when collection is ready
    if (taskCollection.isReady() && typeof (taskCollection as any).loadFromDexie === 'function') {
      console.log('Manually triggering loadFromDexie...');
      (taskCollection as any).loadFromDexie().then(() => {
        console.log('Manual loadFromDexie completed');
        updateInfo();
        setTasks(Array.from(taskCollection.state.values()));
      });
    }

    // Subscribe to changes
    const unsubscribe = taskCollection.subscribeChanges((changes) => {
      console.log('Collection changed:', changes);
      console.log('Collection state size:', taskCollection.state.size);
      console.log('Collection state values:', Array.from(taskCollection.state.values()));
      
      updateInfo();
      setTasks(Array.from(taskCollection.state.values()));
    });

    // Set initial tasks
    console.log('Initial tasks:', Array.from(taskCollection.state.values()));
    setTasks(Array.from(taskCollection.state.values()));

    // Also check Dexie directly
    taskCollection.dexieTable.toArray().then(dexieTasks => {
      console.log('Tasks in Dexie:', dexieTasks);
    });

    return () => unsubscribe();
  }, []);

  const addTestTask = () => {
    const task = {
      id: crypto.randomUUID(),
      title: `Test Task ${Date.now()}`,
      description: 'Created from simple test',
      status: TaskStatus.TODO,
      priority: 3,
      projectId: null,
      assigneeId: null,
      dueDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      completedAt: null,
      tags: [],
    };
    
    console.log('Adding task:', task);
    try {
      const transaction = taskCollection.insert(task);
      console.log('Insert transaction created:', transaction);
      
      // The transaction is auto-committed when we have onInsert handler
      // Just wait for it to complete
      transaction.isPersisted.promise
        .then(() => {
          console.log('Task successfully persisted!');
        })
        .catch((error) => {
          console.error('Error persisting task:', error);
        });
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Simple Collection Test</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold mb-2">Collection Info:</h3>
          <pre className="bg-muted p-2 rounded text-xs">
            {JSON.stringify(collectionInfo, null, 2)}
          </pre>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Tasks ({tasks.length}):</h3>
          <div className="space-y-1">
            {tasks.map(task => (
              <div key={task.id} className="p-2 border rounded">
                {task.title}
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={addTestTask}>Add Test Task</Button>
          <Button 
            onClick={async () => {
              if (typeof (taskCollection as any).loadFromDexie === 'function') {
                console.log('Manually loading from Dexie...');
                await (taskCollection as any).loadFromDexie();
                console.log('Load complete, updating state...');
                setTasks(Array.from(taskCollection.state.values()));
              }
            }}
            variant="outline"
          >
            Load from Dexie
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}