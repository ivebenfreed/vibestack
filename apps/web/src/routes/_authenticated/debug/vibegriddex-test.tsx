import React, { useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { VibeGridDexWithSuspense } from '@/components/custom/vibegriddex';
import { domainServices } from '@/domain';
import { Button } from '@/components/ui/button';
import { db } from '@repo/dataforge/dexie-schema';
import type { Column } from '@/components/custom/vibegriddex/column-types';
import { Task, TaskPriority, TaskStatus } from '@repo/dataforge/client-entities';

// Type-safe column definitions with compile-time validation
const createTaskColumns = (): Column<Task>[] => {
  return [
    { 
      id: 'title', 
      field: 'title', 
      name: 'Title', 
      cellType: 'text', // Validated: string → text ✓
      editable: true 
    },
    { 
      id: 'statusId', 
      field: 'statusId', 
      name: 'Status', 
      cellType: 'relationship-single',
      editable: true,
      relationshipTable: 'status_definitions',
      relationshipDisplayField: 'name',
      // We'll add a custom filter to only show statuses for 'task' entity type
      relationshipFilter: async () => {
        // Get status definitions for tasks only
        const statusDefinitions = await domainServices.statusDefinition.getStatusDefinitionsForEntityType('task');
        return statusDefinitions.map(sd => sd.id);
      }
    },
    { 
      id: 'legacyStatus', 
      field: 'legacyStatus', 
      name: 'Legacy Status', 
      cellType: 'enum',
      editable: true,
      options: [
        { value: TaskStatus.OPEN, label: 'Open' },
        { value: TaskStatus.IN_PROGRESS, label: 'In Progress' },
        { value: TaskStatus.COMPLETED, label: 'Completed' }
      ]
    },
    { 
      id: 'priority', 
      field: 'priority', 
      name: 'Priority', 
      cellType: 'enum', // Changed from 'text' to 'enum' for TaskPriority
      editable: true,
      options: [
        { value: TaskPriority.LOW, label: 'Low' },
        { value: TaskPriority.MEDIUM, label: 'Medium' },
        { value: TaskPriority.HIGH, label: 'High' }
      ]
    },
    {
      id: 'tags',
      field: 'tags',
      name: 'Tags',
      cellType: 'relationship-multi',
      editable: true,
      relationshipTable: 'tags',
      relationshipDisplayField: 'name',
      // Junction table configuration for many-to-many
      junctionTable: 'task_tags',
      junctionSourceField: 'task_id',
      junctionTargetField: 'tag_id',
      // Filter tags based on current project context
      relationshipFilter: async (task) => {
        if (task?.projectId) {
          // Get tags available for this project
          const tags = await domainServices.tag.getTagsForProject(task.projectId);
          return tags.map(t => t.id);
        }
        // If no project, show no tags
        return [];
      }
    },
    { 
      id: 'assignee', 
      field: 'assigneeId', 
      name: 'Assignee', 
      cellType: 'relationship-single', // Validated: string → relationship-single ✓
      editable: true,
      relationshipTable: 'users',
      relationshipDisplayField: 'name' 
    },
    { 
      id: 'project', 
      field: 'projectId', 
      name: 'Project',
      cellType: 'relationship-single', // Validated: string → relationship-single ✓
      editable: true,
      relationshipTable: 'projects',
      relationshipDisplayField: 'name'
    },
    { 
      id: 'dueDate', 
      field: 'dueDate', 
      name: 'Due Date', 
      cellType: 'date' // Validated: Date → date ✓
    },
    { 
      id: 'createdAt', 
      field: 'createdAt', 
      name: 'Created', 
      cellType: 'date' // Validated: Date → date ✓
    },
    { 
      id: 'updatedAt', 
      field: 'updatedAt', 
      name: 'Updated', 
      cellType: 'date' // Validated: Date → date ✓
    }
  ];
};

export const Route = createFileRoute('/_authenticated/debug/vibegriddex-test')({
  // No loader - data fetching handled by Suspense in component
  component: VibeGridDexTestPage,
});

function VibeGridDexTestPage() {
  console.log('🟡🟡🟡 VibeGridDexTestPage: Component RENDERING with Suspense architecture');
  
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
      status: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED][i % 3],
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
      
      await domainServices.task.createUI(task);
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
      
      <VibeGridDexWithSuspense
        tableId="dexie-tasks-test"
        entityType="task"
        columns={createTaskColumns() as any}
        onEntityUpdate={(id, updates) => domainServices.task.updateUI(id, updates)}
        height={600}
        enableSelectionColumn={true}
        enableVirtualScrolling={true}
        enableSorting={true}
        enableFiltering={true}
      />
    </div>
  );
}