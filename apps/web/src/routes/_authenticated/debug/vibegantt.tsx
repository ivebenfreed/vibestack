import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { VibeGantt } from '@/components/custom/vibegantt/VibeGantt';
import type { GanttTask, TaskDependency, GanttViewConfig } from '@/components/custom/vibegantt/types';
import { addDays, addWeeks, startOfDay } from 'date-fns';
import { taskService } from '@/domain/task-service';
import { entityDependencyService } from '@/domain/entity-dependency-service';
import type { Task } from '@repo/dataforge/client-entities';
import type { UpdateTaskInput, CreateTaskInput } from '@repo/dataforge/task-operations';
import { usePlaywrightReady } from '@/hooks/use-playwright-ready';

export const Route = createFileRoute('/_authenticated/debug/vibegantt')({
  component: VibeGanttDebug,
});

function VibeGanttDebug() {
  console.log('🎯 VibeGanttDebug: Using original VibeGantt with atomic store');
  
  // Signal to Playwright that the VibeGantt debug page is ready
  usePlaywrightReady('[PLAYWRIGHT_READY] VibeGantt debug page loaded');
  
  // Tasks will be loaded from the database by VibeGantt
  
  // Project selection state - use the test project ID we created
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>('ddfb9da6-32cf-49cc-be72-14a919850dcd');
  
  // Domain service implementation for write operations
  const domainService = {
    updateTask: async (taskId: string, updates: Partial<GanttTask>) => {
      console.log('Updating task via domain service:', taskId, updates);
      try {
        // Build type-safe UpdateTaskInput, filtering out visualization metadata
        const taskUpdates: UpdateTaskInput = {};
        
        // Only include fields that exist in UpdateTaskInput
        if (updates.title !== undefined) taskUpdates.title = updates.title;
        if (updates.description !== undefined) taskUpdates.description = updates.description;
        if (updates.priority !== undefined) taskUpdates.priority = updates.priority;
        if (updates.startDate !== undefined) {
          taskUpdates.startDate = updates.startDate instanceof Date 
            ? updates.startDate 
            : updates.startDate ? new Date(updates.startDate) : undefined;
        }
        if (updates.dueDate !== undefined) {
          taskUpdates.dueDate = updates.dueDate instanceof Date 
            ? updates.dueDate 
            : updates.dueDate ? new Date(updates.dueDate) : undefined;
        }
        if (updates.completedAt !== undefined) taskUpdates.completedAt = updates.completedAt;
        if (updates.assigneeId !== undefined) taskUpdates.assigneeId = updates.assigneeId;
        
        const updatedTask = await taskService.updateUI(taskId, taskUpdates);
        console.log('Task updated successfully:', updatedTask);
        return updatedTask;
      } catch (error) {
        console.error('Error updating task:', error);
        throw error;
      }
    },
    
    createTask: async (task: Partial<GanttTask>) => {
      console.log('Creating task via domain service:', task);
      try {
        const createInput: CreateTaskInput = {
          title: task.title || 'New Task',
          priority: task.priority || 'medium', // Required field
          description: task.description,
          projectId: task.projectId || selectedProjectId,
          startDate: task.startDate instanceof Date 
            ? task.startDate
            : task.startDate ? new Date(task.startDate) : undefined,
          dueDate: task.dueDate instanceof Date 
            ? task.dueDate
            : task.dueDate ? new Date(task.dueDate) : undefined,
        };
        
        const newTask = await taskService.createUI(createInput);
        console.log('Task created successfully:', newTask);
        return newTask;
      } catch (error) {
        console.error('Error creating task:', error);
        throw error;
      }
    },
    
    deleteTask: async (taskId: string) => {
      console.log('Deleting task via domain service:', taskId);
      try {
        const success = await taskService.deleteUI(taskId);
        console.log('Task deleted successfully:', success);
        return success;
      } catch (error) {
        console.error('Error deleting task:', error);
        throw error;
      }
    },
    
    createDependency: async (dependency: Partial<TaskDependency>) => {
      console.log('Creating dependency via domain service:', dependency);
      try {
        // Use EntityDependency format directly
        const newDep = await entityDependencyService.createTaskDependency(
          dependency.predecessorId || '',
          dependency.successorId || '',
          dependency.type || 'finish-to-start',
          dependency.lagDays,
          dependency.metadata
        );
        console.log('Dependency created successfully:', newDep);
        return newDep;
      } catch (error) {
        console.error('Error creating dependency:', error);
        throw error;
      }
    },
    
    deleteDependency: async (dependencyId: string) => {
      console.log('Deleting dependency via domain service:', dependencyId);
      try {
        const success = await entityDependencyService.deleteUI(dependencyId);
        console.log('Dependency deleted successfully:', success);
        return success;
      } catch (error) {
        console.error('Error deleting dependency:', error);
        throw error;
      }
    },
  };
  
  // View configuration state
  const [viewConfig, setViewConfig] = useState<Partial<GanttViewConfig>>({
    zoomLevel: 'week',
    showWeekends: true,
    showDependencies: true,
    showCriticalPath: false,
    showProgress: true,
    showToday: true,
  });
  
  // Debug state
  const [showDebugInfo, setShowDebugInfo] = useState(true);
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  
  // Handlers
  const handleTaskUpdate = (task: GanttTask) => {
    console.log('Task updated:', task);
    setSelectedTask(task);
  };
  
  const handleTaskCreate = (task: Partial<GanttTask>) => {
    console.log('Task created:', task);
  };
  
  const handleTaskDelete = (taskId: string) => {
    console.log('Task deleted:', taskId);
  };
  
  const handleDependencyCreate = (dependency: Partial<TaskDependency>) => {
    console.log('Dependency created:', dependency);
  };
  
  const handleDependencyDelete = (dependencyId: string) => {
    console.log('Dependency deleted:', dependencyId);
  };
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-2">📊 VibeGantt Debug</h1>
        <p className="text-gray-600">
          Test the high-performance CustomDOM-based Gantt chart component
        </p>
      </div>
      
      {/* Debug Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Debug Controls</h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {/* Zoom Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Zoom Level
            </label>
            <select
              value={viewConfig.zoomLevel}
              onChange={(e) => setViewConfig({ ...viewConfig, zoomLevel: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="quarter">Quarter</option>
              <option value="year">Year</option>
            </select>
          </div>
          
          {/* Toggle Options */}
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={viewConfig.showWeekends}
                onChange={(e) => setViewConfig({ ...viewConfig, showWeekends: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Weekends</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={viewConfig.showDependencies}
                onChange={(e) => setViewConfig({ ...viewConfig, showDependencies: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Dependencies</span>
            </label>
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={viewConfig.showProgress}
                onChange={(e) => setViewConfig({ ...viewConfig, showProgress: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Progress</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={viewConfig.showToday}
                onChange={(e) => setViewConfig({ ...viewConfig, showToday: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Today Line</span>
            </label>
          </div>
          
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={viewConfig.showCriticalPath}
                onChange={(e) => setViewConfig({ ...viewConfig, showCriticalPath: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Show Critical Path</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showDebugInfo}
                onChange={(e) => setShowDebugInfo(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm">Show Debug Info</span>
            </label>
          </div>
        </div>
        
        {/* Stats will be populated from the store */}
      </div>
      
      {/* Gantt Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Gantt Chart</h2>
        
        <VibeGantt
          projectId={selectedProjectId} // Filter to test project with EntityDependency data
          domainService={domainService}
          viewConfig={viewConfig}
          onTaskUpdate={handleTaskUpdate}
          onTaskCreate={handleTaskCreate}
          onTaskDelete={handleTaskDelete}
          onDependencyCreate={handleDependencyCreate}
          onDependencyDelete={handleDependencyDelete}
          height={600}
        />
      </div>
      
      {/* Debug Info */}
      {showDebugInfo && selectedTask && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">Selected Task Debug Info</h2>
          <pre className="bg-gray-50 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(selectedTask, null, 2)}
          </pre>
        </div>
      )}
      
      {/* Instructions */}
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">Instructions</h3>
        <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
          <li>Click and drag tasks to move them along the timeline</li>
          <li>Drag task edges to resize (change duration)</li>
          <li>Click tasks to select them (Ctrl/Cmd+Click for multi-select)</li>
          <li>Use Shift+Drag or Middle Mouse to pan the timeline</li>
          <li>Use Ctrl/Cmd+Scroll to zoom in/out</li>
          <li>Dependencies will automatically update when tasks move</li>
        </ul>
      </div>
    </div>
  );
}