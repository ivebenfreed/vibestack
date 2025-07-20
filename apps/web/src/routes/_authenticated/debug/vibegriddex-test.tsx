import React, { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { VibeGridDex } from '@/components/custom/vibegriddex';
import { updateTaskUI } from '@/domain-dexie';
import { Button } from '@/components/ui/button';
import { db } from '@repo/dataforge/dexie-schema';
import type { Column } from '@/components/custom/vibegriddex/types';

// Type-safe column definitions
const createTaskColumns = (): Column[] => {
  return [
    { id: 'title', field: 'title', label: 'Title', cellType: 'text', editable: true },
    { 
      id: 'status', 
      field: 'statusId', 
      label: 'Status', 
      cellType: 'relationship-single',
      editable: true,
      relationshipTable: 'status_definitions',
      relationshipDisplayField: 'name'
    },
    { id: 'priority', field: 'priority', label: 'Priority', cellType: 'text', editable: true },
    { 
      id: 'assignee', 
      field: 'assigneeId', 
      label: 'Assignee', 
      cellType: 'relationship-single',
      editable: true,
      relationshipTable: 'users',
      relationshipDisplayField: 'name' 
    },
    { 
      id: 'project', 
      field: 'projectId', 
      label: 'Project',
      cellType: 'relationship-single',
      editable: true,
      relationshipTable: 'projects',
      relationshipDisplayField: 'name'
    },
    { id: 'createdAt', field: 'createdAt', label: 'Created', cellType: 'date' },
    { id: 'updatedAt', field: 'updatedAt', label: 'Updated', cellType: 'date' }
  ];
};

// Import syncProcessView for processing data in the loader
import { syncProcessView } from '@/components/custom/vibegriddex/utils/syncViewProcessor';

export const Route = createFileRoute('/_authenticated/debug/vibegriddex-test')({
  staleTime: 60_000, // Cache for 1 minute
  loader: async () => {
    console.log('🔴🔴🔴 VibeGridDex Test Loader: STARTING - This should appear in console!');
    console.log('📋 VibeGridDex Test Loader: Loading all data...');
    
    // Load all data in parallel
    const [tasks, users, projects, statusDefinitions, statusSets] = await Promise.all([
      db.tasks.toArray(),
      db.users.toArray(),
      db.projects.toArray(),
      db.status_definitions.toArray(),
      db.status_sets.toArray()
    ]);
    
    // Build relationship data map
    const relationshipData = {
      users: users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}),
      projects: projects.reduce((acc, project) => ({ ...acc, [project.id]: project }), {}),
      status_definitions: statusDefinitions.reduce((acc, status) => ({ ...acc, [status.id]: status }), {}),
      statusDefinitions: statusDefinitions.reduce((acc, status) => ({ ...acc, [status.id]: status }), {}),
      status: statusDefinitions.reduce((acc, status) => ({ ...acc, [status.id]: status }), {})
    };
    
    // Create relationship resolvers
    const relationshipResolvers = {
      assignee: (id: string) => {
        const user = relationshipData.users[id];
        return user?.name || id;
      },
      project: (id: string) => {
        const project = relationshipData.projects[id];
        return project?.name || id;
      },
      status: (id: string) => {
        const status = relationshipData.status_definitions[id];
        return status?.name || id;
      }
    };
    
    // Process the view data
    const columns = createTaskColumns();
    const processedData = syncProcessView({
      entities: tasks,
      columns,
      relationshipResolvers,
      sortBy: [],
      filters: [],
      groupBy: [],
      columnWidths: {},
      columnVisibility: {},
      columnOrder: [],
      enableSelectionColumn: true,
      rowHeight: 40
    });
    
    console.log('📋 VibeGridDex Test Loader: Data loaded and processed', {
      taskCount: tasks.length,
      userCount: users.length,
      projectCount: projects.length,
      processedRowCount: processedData.processedRows.length,
      columnCount: processedData.visibleColumns.length
    });
    
    return {
      tasks,
      relationshipData,
      initialData: {
        processedRows: processedData.processedRows,
        visibleColumns: processedData.visibleColumns,
        coordinateMapping: processedData.coordinateMapping,
        relationshipData, // Include relationship data directly in initialData
        relationshipResolvers // Include resolvers too
      }
    };
  },
  component: VibeGridDexTestPage,
});

function VibeGridDexTestPage() {
  console.log('🟡🟡🟡 VibeGridDexTestPage: Component RENDERING');
  
  // Use direct destructuring to ensure we get the loader data
  const loaderData = Route.useLoaderData();
  
  console.log('VibeGridDexTestPage: Raw loader data', loaderData);
  
  const { tasks, relationshipData, initialData } = loaderData || {};
  
  console.log('VibeGridDexTestPage: Loader data check', {
    hasLoaderData: !!loaderData,
    loaderDataKeys: loaderData ? Object.keys(loaderData) : [],
    tasksFromLoader: tasks?.length || 0,
    hasRelationshipData: !!relationshipData,
    hasInitialData: !!initialData,
    initialDataKeys: initialData ? Object.keys(initialData) : [],
    processedRowCount: initialData?.processedRows?.length || 0,
    visibleColumnCount: initialData?.visibleColumns?.length || 0
  });
  
  // Setup task status set if it doesn't exist
  const ensureTaskStatusSet = async () => {
    // Check if task status set exists
    const existingStatusSets = await db.status_sets.toArray();
    const hasTaskStatusSet = existingStatusSets.some(set => 
      set.entityType === 'task' && set.isActive
    );
    
    if (!hasTaskStatusSet) {
      console.log('Creating task status set...');
      
      // Create status set
      const statusSetId = crypto.randomUUID();
      await db.status_sets.add({
        id: statusSetId,
        name: 'Task Status',
        entityType: 'task',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: crypto.randomUUID()
      });
      
      // Create default status definitions
      const statuses = [
        { name: 'Todo', value: 'todo', color: '#6B7280', sortOrder: 1, isDefault: true },
        { name: 'In Progress', value: 'in_progress', color: '#3B82F6', sortOrder: 2 },
        { name: 'Done', value: 'done', color: '#10B981', sortOrder: 3, isFinal: true },
        { name: 'Blocked', value: 'blocked', color: '#EF4444', sortOrder: 4 }
      ];
      
      for (const status of statuses) {
        await db.status_definitions.add({
          id: crypto.randomUUID(),
          name: status.name,
          value: status.value,
          statusSetId,
          color: status.color,
          sortOrder: status.sortOrder,
          isDefault: status.isDefault || false,
          isFinal: status.isFinal || false,
          isActive: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          clientId: crypto.randomUUID()
        });
      }
      
      console.log('Created task status set and definitions');
    }
  };

  // Test data creation
  const createTestTasks = async () => {
    console.log('Creating test tasks...');
    
    // Get some users and projects to assign
    const existingUsers = await db.users.toArray();
    const existingProjects = await db.projects.toArray();
    
    console.log('Available for assignment:', {
      userCount: existingUsers.length,
      projectCount: existingProjects.length
    });
    
    // Get status definitions for tasks
    const statusSets = await db.status_sets.toArray();
    const taskStatusSet = statusSets.find(set => 
      set.entityType === 'task' && set.isActive
    );
    
    let availableStatuses = [];
    if (taskStatusSet) {
      const allStatusDefs = await db.status_definitions.toArray();
      availableStatuses = allStatusDefs.filter(status => 
        status.statusSetId === taskStatusSet.id && status.isActive
      );
    }
    
    console.log('Available statuses:', availableStatuses.length);
    
    const testTasks = Array.from({ length: 5 }, (_, i) => ({
      title: `Test Task ${Date.now()}-${i}`,
      description: `Created from VibeGridDex test page`,
      statusId: availableStatuses.length > 0 ? availableStatuses[i % availableStatuses.length].id : null,
      priority: ['low', 'medium', 'high'][i % 3] as any,
      assigneeId: existingUsers.length > 0 ? existingUsers[i % existingUsers.length].id : null,
      projectId: existingProjects.length > 0 ? existingProjects[i % existingProjects.length].id : null,
    }));
    
    for (const task of testTasks) {
      console.log('Creating task with relationships:', {
        title: task.title,
        assigneeId: task.assigneeId,
        projectId: task.projectId,
        statusId: task.statusId
      });
      
      await updateTaskUI(crypto.randomUUID(), task);
    }
    
    console.log('Test tasks created');
  };

  const clearAllTasks = async () => {
    console.log('Clearing all tasks...');
    await db.tasks.clear();
    console.log('All tasks cleared');
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">VibeGridDex Test</h1>
        <div className="text-sm text-muted-foreground mb-2">
          Using entity type: task with manual columns
        </div>
        <div className="flex gap-2">
          <Button onClick={createTestTasks} size="sm">Create Test Tasks</Button>
          <Button onClick={clearAllTasks} variant="destructive" size="sm">Clear All Tasks</Button>
          <Button onClick={ensureTaskStatusSet} variant="outline" size="sm">Setup Status Set</Button>
        </div>
      </div>
      
      <VibeGridDex
        tableId="dexie-tasks-test"
        entityType="task"
        columns={createTaskColumns()}
        height={600}
        enableSelectionColumn={true}
        enableVirtualScrolling={true}
        enableSorting={true}
        enableFiltering={true}
        initialData={initialData}
        {...console.log('🟢🟢🟢 Passing initialData to VibeGridDex:', { 
          hasInitialData: !!initialData,
          processedRowCount: initialData?.processedRows?.length || 0,
          visibleColumnCount: initialData?.visibleColumns?.length || 0,
          hasRelationshipData: !!(initialData as any)?.relationshipData,
          relationshipDataKeys: Object.keys((initialData as any)?.relationshipData || {})
        })}
      />
    </div>
  );
}