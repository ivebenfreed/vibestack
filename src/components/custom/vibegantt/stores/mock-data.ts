import { observable } from '@legendapp/state';
import type { GanttTask, TaskDependency } from '../types';

// Extended mock data with more realistic project structure
const mockTasks: GanttTask[] = [
  {
    id: 'task-1',
    title: 'Project Planning & Requirements',
    startDate: '2025-01-01T09:00:00Z',
    dueDate: '2025-01-10T17:00:00Z',
    progress: 100,
    assignedTo: 'Project Manager',
    priority: 'high',
    description: 'Define project scope, requirements gathering, and initial planning'
  },
  {
    id: 'task-2',
    title: 'System Architecture Design',
    startDate: '2025-01-11T09:00:00Z',
    dueDate: '2025-01-20T17:00:00Z',
    progress: 85,
    assignedTo: 'Senior Architect',
    priority: 'high',
    color: '#10b981',
    description: 'Design system architecture and technical specifications'
  },
  {
    id: 'task-3',
    title: 'UI/UX Design',
    startDate: '2025-01-15T09:00:00Z',
    dueDate: '2025-01-28T17:00:00Z',
    progress: 70,
    assignedTo: 'Design Team',
    priority: 'medium',
    color: '#f59e0b',
    description: 'Create wireframes, mockups, and user interface designs'
  },
  {
    id: 'task-4',
    title: 'Database Schema Design',
    startDate: '2025-01-22T09:00:00Z',
    dueDate: '2025-01-30T17:00:00Z',
    progress: 60,
    assignedTo: 'Database Engineer',
    priority: 'high',
    color: '#8b5cf6',
    description: 'Design database schema and data models'
  },
  {
    id: 'task-5',
    title: 'Frontend Development - Core Components',
    startDate: '2025-02-01T09:00:00Z',
    dueDate: '2025-02-20T17:00:00Z',
    progress: 40,
    assignedTo: 'Frontend Team',
    priority: 'high',
    color: '#ef4444',
    description: 'Develop core frontend components and utilities'
  },
  {
    id: 'task-6',
    title: 'Backend API Development',
    startDate: '2025-02-05T09:00:00Z',
    dueDate: '2025-02-25T17:00:00Z',
    progress: 30,
    assignedTo: 'Backend Team',
    priority: 'high',
    color: '#06b6d4',
    description: 'Implement backend APIs and business logic'
  },
  {
    id: 'task-7',
    title: 'Integration Testing',
    startDate: '2025-02-26T09:00:00Z',
    dueDate: '2025-03-05T17:00:00Z',
    progress: 0,
    assignedTo: 'QA Team',
    priority: 'medium',
    color: '#84cc16',
    description: 'Test integration between frontend and backend'
  },
  {
    id: 'task-8',
    title: 'User Acceptance Testing',
    startDate: '2025-03-06T09:00:00Z',
    dueDate: '2025-03-15T17:00:00Z',
    progress: 0,
    assignedTo: 'QA Team',
    priority: 'medium',
    color: '#f97316',
    description: 'Conduct user acceptance testing and gather feedback'
  },
  {
    id: 'task-9',
    title: 'Documentation & Deployment',
    startDate: '2025-03-16T09:00:00Z',
    dueDate: '2025-03-25T17:00:00Z',
    progress: 0,
    assignedTo: 'DevOps Team',
    priority: 'low',
    color: '#6b7280',
    description: 'Finalize documentation and deploy to production'
  }
];

const mockDependencies: TaskDependency[] = [
  {
    id: 'dep-1',
    predecessorId: 'task-1',
    successorId: 'task-2',
    type: 'finish-to-start',
    lagDays: 1
  },
  {
    id: 'dep-2',
    predecessorId: 'task-2',
    successorId: 'task-3',
    type: 'start-to-start',
    lagDays: 4
  },
  {
    id: 'dep-3',
    predecessorId: 'task-2',
    successorId: 'task-4',
    type: 'finish-to-start',
    lagDays: 2
  },
  {
    id: 'dep-4',
    predecessorId: 'task-3',
    successorId: 'task-5',
    type: 'finish-to-start',
    lagDays: 3
  },
  {
    id: 'dep-5',
    predecessorId: 'task-4',
    successorId: 'task-6',
    type: 'finish-to-start',
    lagDays: 5
  },
  {
    id: 'dep-6',
    predecessorId: 'task-5',
    successorId: 'task-7',
    type: 'finish-to-start',
    lagDays: 5
  },
  {
    id: 'dep-7',
    predecessorId: 'task-6',
    successorId: 'task-7',
    type: 'finish-to-start',
    lagDays: 0
  },
  {
    id: 'dep-8',
    predecessorId: 'task-7',
    successorId: 'task-8',
    type: 'finish-to-start',
    lagDays: 1
  },
  {
    id: 'dep-9',
    predecessorId: 'task-8',
    successorId: 'task-9',
    type: 'finish-to-start',
    lagDays: 1
  }
];

export function createMockGanttData$() {
  return observable({
    tasks: [...mockTasks],
    dependencies: [...mockDependencies],
    isLoading: false,
    error: null as string | null,

    // Task operations
    addTask: (task: Partial<GanttTask>) => {
      const newTask: GanttTask = {
        id: `task-${Date.now()}`,
        title: 'New Task',
        startDate: new Date().toISOString(),
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        progress: 0,
        assignedTo: 'Unassigned',
        priority: 'medium',
        ...task
      };
      mockData$.tasks.push(newTask);
      return newTask;
    },

    updateTask: (taskId: string, updates: Partial<GanttTask>) => {
      const taskIndex = mockData$.tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        Object.assign(mockData$.tasks[taskIndex], updates);
        return true;
      }
      return false;
    },

    deleteTask: (taskId: string) => {
      const taskIndex = mockData$.tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockData$.tasks.splice(taskIndex, 1);
        // Remove dependencies involving this task
        mockData$.dependencies.filter(dep =>
          dep.predecessorId !== taskId && dep.successorId !== taskId
        );
        return true;
      }
      return false;
    },

    // Dependency operations
    addDependency: (dependency: Omit<TaskDependency, 'id'>) => {
      const newDependency: TaskDependency = {
        id: `dep-${Date.now()}`,
        ...dependency
      };
      mockData$.dependencies.push(newDependency);
      return newDependency;
    },

    deleteDependency: (dependencyId: string) => {
      const depIndex = mockData$.dependencies.findIndex(d => d.id === dependencyId);
      if (depIndex >= 0) {
        mockData$.dependencies.splice(depIndex, 1);
        return true;
      }
      return false;
    },

    // Bulk operations for testing
    generateSampleProject: () => {
      mockData$.tasks.set([...mockTasks]);
      mockData$.dependencies.set([...mockDependencies]);
    },

    clearAll: () => {
      mockData$.tasks.set([]);
      mockData$.dependencies.set([]);
    },

    // Utility functions
    getTasksByTimeRange: (startDate: Date, endDate: Date) => {
      return mockData$.tasks.get().filter(task => {
        const taskStart = new Date(task.startDate);
        const taskEnd = new Date(task.dueDate);
        return (taskStart >= startDate && taskStart <= endDate) ||
               (taskEnd >= startDate && taskEnd <= endDate) ||
               (taskStart <= startDate && taskEnd >= endDate);
      });
    },

    getDependenciesForTask: (taskId: string) => {
      return mockData$.dependencies.get().filter(dep =>
        dep.predecessorId === taskId || dep.successorId === taskId
      );
    }
  });
}

// Export singleton instance
export const mockData$ = createMockGanttData$();