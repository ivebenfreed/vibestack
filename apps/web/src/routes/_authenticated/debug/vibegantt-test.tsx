import { createFileRoute } from '@tanstack/react-router';
import { VibeGantt, type GanttTask, type TaskDependency } from '@/components/custom/vibegantt/VibeGantt';
import { useState } from 'react';

export const Route = createFileRoute('/_authenticated/debug/vibegantt-test')({
  component: VibeGanttTest,
});

function VibeGanttTest() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // Domain service implementation with mock functions for testing
  const domainService = {
    updateTask: async (taskId: string, updates: Partial<GanttTask>) => {
      console.log('Mock updateTask:', taskId, updates);
      // In a real implementation, this would update the task in Dexie
    },
    
    createTask: async (task: Partial<GanttTask>) => {
      console.log('Mock createTask:', task);
      // In a real implementation, this would create a task in Dexie
    },
    
    deleteTask: async (taskId: string) => {
      console.log('Mock deleteTask:', taskId);
      // In a real implementation, this would delete the task from Dexie
    },
    
    createDependency: async (dependency: Partial<TaskDependency>) => {
      // This would need to be implemented in the task API
      console.log('Creating dependency:', dependency);
      // For now, just log it
    },
    
    deleteDependency: async (dependencyId: string) => {
      // This would need to be implemented in the task API
      console.log('Deleting dependency:', dependencyId);
      // For now, just log it
    },
  };
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <h1 className="text-2xl font-semibold text-gray-900">VibeGantt Test</h1>
        <p className="mt-1 text-sm text-gray-600">
          Testing the new Gantt component with XState Store architecture
        </p>
      </div>
      
      <div className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-4">
              <label className="text-sm font-medium text-gray-700">
                Project ID (optional):
              </label>
              <input
                type="text"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value || null)}
                placeholder="Enter project ID to filter tasks"
                className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="p-4" style={{ height: 'calc(100% - 73px)' }}>
            <VibeGantt
              projectId={selectedProjectId}
              domainService={domainService}
              height={600}
              viewConfig={{
                showWeekends: true,
                showDependencies: true,
                showCriticalPath: true,
                showProgress: true,
                showToday: true,
                zoomLevel: 'week',
              }}
            />
          </div>
        </div>
      </div>
      
      <div className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="text-sm text-gray-600">
          <p>Features:</p>
          <ul className="mt-1 space-y-1 list-disc list-inside">
            <li>Reactive data updates via XState Store</li>
            <li>Pre-resolved relationships (assignees, parent tasks)</li>
            <li>Domain service pattern for write operations</li>
            <li>Surgical row-level updates</li>
            <li>Drag and drop task scheduling</li>
            <li>Dependency management</li>
            <li>Critical path visualization</li>
          </ul>
        </div>
      </div>
    </div>
  );
}