import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { VibeGridDex } from '@/components/custom/vibegriddex';
import { useTaskQueries, useProjectQueries, taskService } from '@/domain-dexie';
import { Button } from '@/components/ui/button';
import { db } from '@repo/dataforge/dexie-schema';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Column, RelationshipOptionsProvider } from '@/components/custom/vibegriddex/types';
import { createGenericRelationshipProvider } from '@/components/custom/vibegriddex/providers/generic-relationship-provider-dexie';

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
    { id: 'createdAt', field: 'createdAt', label: 'Created', cellType: 'date', editable: false },
    { id: 'updatedAt', field: 'updatedAt', label: 'Updated', cellType: 'date', editable: false }
  ];
};


export const Route = createFileRoute('/_authenticated/debug/vibegriddex-test')({
  component: VibeGridDexTestPage,
});

function VibeGridDexTestPage() {
  // Dexie live queries
  const tasks = useTaskQueries.allTasks();
  const projects = useProjectQueries.allProjects();
  const taskCount = useTaskQueries.taskCount();
  
  // Also get user count to debug relationship resolution
  const users = useLiveQuery(() => db.users.toArray());
  
  // Load status sets and definitions
  const statusSets = useLiveQuery(() => db.status_sets.toArray());
  const statusDefinitions = useLiveQuery(() => db.status_definitions.toArray());
  
  // Compute status options for tasks
  const taskStatusOptions = React.useMemo(() => {
    if (!statusSets || !statusDefinitions) return [];
    
    // Find the active task status set
    const taskStatusSet = statusSets.find(set => 
      set.entityType === 'task' && set.isActive
    );
    
    if (!taskStatusSet) {
      console.log('No active task status set found');
      return [];
    }
    
    // Filter and map status definitions
    return statusDefinitions
      .filter(status => 
        status.statusSetId === taskStatusSet.id && 
        status.isActive
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(status => ({
        value: status.id,
        label: status.name,
        metadata: {
          color: status.color,
          variant: status.variant,
          icon: status.icon
        }
      }));
  }, [statusSets, statusDefinitions]);
  
  // Compute user options
  const userOptions = React.useMemo(() => {
    if (!users) return [];
    return users.map(user => ({
      value: user.id,
      label: user.name || user.id
    }));
  }, [users]);
  
  // Compute project options  
  const projectOptions = React.useMemo(() => {
    if (!projects) return [];
    return projects.map(project => ({
      value: project.id,
      label: project.name || project.id
    }));
  }, [projects]);
  
  // Create test status data
  const createTestStatusData = async () => {
    console.log('Creating test status data...');
    
    // Check if we already have a task status set
    const existingStatusSets = await db.status_sets.toArray();
    let taskStatusSet = existingStatusSets.find(set => 
      set.entityType === 'task' && set.isActive
    );
    
    if (!taskStatusSet) {
      // Create a task status set
      const statusSetId = crypto.randomUUID();
      await db.status_sets.add({
        id: statusSetId,
        name: 'Task Workflow',
        entityType: 'task',
        isSystem: true,
        isActive: true,
        displayOrder: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        clientId: crypto.randomUUID()
      });
      
      // Create status definitions for the task workflow
      const statuses = [
        { name: 'Backlog', value: 'backlog', color: 'gray', sortOrder: 1, isDefault: true },
        { name: 'To Do', value: 'todo', color: 'blue', sortOrder: 2 },
        { name: 'In Progress', value: 'in_progress', color: 'yellow', sortOrder: 3 },
        { name: 'In Review', value: 'in_review', color: 'purple', sortOrder: 4 },
        { name: 'Completed', value: 'completed', color: 'green', sortOrder: 5, isFinal: true },
        { name: 'Cancelled', value: 'cancelled', color: 'red', sortOrder: 6, isFinal: true }
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
    } else {
      console.log('Task status set already exists');
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
      projectCount: existingProjects.length,
      sampleUser: existingUsers[0],
      sampleProject: existingProjects[0]
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
    
    console.log('Available statuses:', {
      statusSetId: taskStatusSet?.id,
      statusCount: availableStatuses.length,
      statuses: availableStatuses.map(s => ({ id: s.id, name: s.name }))
    });
    
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
        projectId: task.projectId
      });
      await taskService.create(task);
    }
    console.log('Test tasks created with relationships!');
  };
  
  
  
  
  return (
    <div className="container mx-auto p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold mb-2">VibeGridDex Test</h1>
        <div className="flex gap-4 items-center text-sm text-muted-foreground mb-2">
          <span>Tasks: {taskCount ?? 0}</span>
          <span>Users: {users?.length ?? 0}</span>
          <span>Projects: {projects?.length ?? 0}</span>
          <span>Status Sets: {statusSets?.length ?? 0}</span>
          <span>Status Defs: {statusDefinitions?.length ?? 0}</span>
        </div>
        {statusSets && statusSets.length > 0 && (
          <div className="text-xs text-muted-foreground">
            Active Task Status Set: {statusSets.find(s => s.entityType === 'task' && s.isActive)?.name || 'None'}
          </div>
        )}
        <div className="flex gap-2">
          {statusSets && statusSets.length === 0 && (
            <Button onClick={createTestStatusData} size="sm" variant="outline">
              Create Status Data
            </Button>
          )}
          <Button onClick={createTestTasks} size="sm">
            Create Test Tasks
          </Button>
        </div>
      </div>
      
      {tasks && tasks.length > 0 && users && projects && statusSets && statusDefinitions ? (
        <VibeGridDex
          tableId="dexie-tasks-test"
          columns={createTaskColumns()}
          data={tasks}
          relationshipData={{
            users: Object.fromEntries(users.map(u => [u.id, u])),
            projects: Object.fromEntries(projects.map(p => [p.id, p])),
            statusDefinitions: Object.fromEntries(statusDefinitions.map(s => [s.id, s])),
            statusSets: Object.fromEntries(statusSets.map(s => [s.id, s]))
          }}
          relationshipResolvers={{
            assignee: (id: string) => {
              const user = users.find(u => u.id === id);
              return user?.name || id;
            },
            project: (id: string) => {
              const project = projects.find(p => p.id === id);
              return project?.name || id;
            },
            status: (id: string) => {
              const status = statusDefinitions.find(s => s.id === id);
              return status?.name || id;
            }
          }}
          relationshipOptionsProviders={{
            status: createGenericRelationshipProvider(
              { 
                id: 'status',
                relationshipTable: 'status_definitions',
                relationshipDisplayField: 'name'
              } as any,
              {
                status_definitions: Object.fromEntries(statusDefinitions.map(s => [s.id, s])),
                statusDefinitions: Object.fromEntries(statusDefinitions.map(s => [s.id, s]))
              }
            ),
            assignee: createGenericRelationshipProvider(
              { 
                id: 'assignee',
                relationshipTable: 'users',
                relationshipDisplayField: 'name'
              } as any,
              {
                users: Object.fromEntries(users.map(u => [u.id, u])),
                user: Object.fromEntries(users.map(u => [u.id, u]))
              }
            ),
            project: createGenericRelationshipProvider(
              { 
                id: 'project',
                relationshipTable: 'projects',
                relationshipDisplayField: 'name'
              } as any,
              {
                projects: Object.fromEntries(projects.map(p => [p.id, p])),
                project: Object.fromEntries(projects.map(p => [p.id, p]))
              }
            )
          }}
          onEntityUpdate={async (rowId, updates) => {
            await taskService.update(rowId, updates);
          }}
          height={600}
          enableSelectionColumn={true}
          enableVirtualScrolling={true}
          enableSorting={true}
          enableFiltering={true}
        />
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          No tasks found. Create some test tasks to see the grid.
        </div>
      )}
    </div>
  );
}