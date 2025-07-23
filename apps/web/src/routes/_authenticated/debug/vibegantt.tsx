import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { VibeGantt } from '@/components/custom/vibegantt/VibeGantt';
import type { GanttTask, TaskDependency, GanttViewConfig } from '@/components/custom/vibegantt/types';
import { addDays, addWeeks, startOfDay } from 'date-fns';

export const Route = createFileRoute('/_authenticated/debug/vibegantt')({
  component: VibeGanttDebug,
});

function VibeGanttDebug() {
  // Generate sample tasks
  const sampleTasks = useMemo<GanttTask[]>(() => {
    const today = startOfDay(new Date());
    
    return [
      // Phase 1: Foundation
      {
        id: '1',
        name: 'Project Foundation',
        plannedStartDate: today,
        plannedEndDate: addWeeks(today, 2),
        progress: 100,
        priority: 'high',
        color: '#3b82f6',
      },
      {
        id: '1.1',
        name: 'Setup Development Environment',
        plannedStartDate: today,
        plannedEndDate: addDays(today, 3),
        progress: 100,
        priority: 'high',
        parentId: '1',
      },
      {
        id: '1.2',
        name: 'Create Project Structure',
        plannedStartDate: addDays(today, 3),
        plannedEndDate: addDays(today, 7),
        progress: 100,
        priority: 'high',
        parentId: '1',
      },
      {
        id: '1.3',
        name: 'Configure Build Tools',
        plannedStartDate: addDays(today, 7),
        plannedEndDate: addDays(today, 14),
        progress: 100,
        priority: 'medium',
        parentId: '1',
      },
      
      // Phase 2: Core Features
      {
        id: '2',
        name: 'Core Features Implementation',
        plannedStartDate: addWeeks(today, 2),
        plannedEndDate: addWeeks(today, 6),
        progress: 75,
        priority: 'critical',
        color: '#ef4444',
      },
      {
        id: '2.1',
        name: 'User Authentication',
        plannedStartDate: addWeeks(today, 2),
        plannedEndDate: addWeeks(today, 3),
        progress: 100,
        priority: 'critical',
        parentId: '2',
      },
      {
        id: '2.2',
        name: 'Database Schema Design',
        plannedStartDate: addWeeks(today, 2),
        plannedEndDate: addDays(addWeeks(today, 2), 4),
        progress: 100,
        priority: 'high',
        parentId: '2',
      },
      {
        id: '2.3',
        name: 'API Development',
        plannedStartDate: addWeeks(today, 3),
        plannedEndDate: addWeeks(today, 5),
        progress: 60,
        priority: 'high',
        parentId: '2',
      },
      {
        id: '2.4',
        name: 'Frontend Components',
        plannedStartDate: addDays(addWeeks(today, 3), 3),
        plannedEndDate: addWeeks(today, 6),
        progress: 40,
        priority: 'medium',
        parentId: '2',
      },
      
      // Phase 3: Advanced Features
      {
        id: '3',
        name: 'Advanced Features',
        plannedStartDate: addWeeks(today, 5),
        plannedEndDate: addWeeks(today, 9),
        progress: 20,
        priority: 'medium',
        color: '#f59e0b',
      },
      {
        id: '3.1',
        name: 'Real-time Sync',
        plannedStartDate: addWeeks(today, 5),
        plannedEndDate: addWeeks(today, 7),
        progress: 30,
        priority: 'high',
        parentId: '3',
      },
      {
        id: '3.2',
        name: 'Analytics Dashboard',
        plannedStartDate: addWeeks(today, 6),
        plannedEndDate: addWeeks(today, 8),
        progress: 10,
        priority: 'medium',
        parentId: '3',
      },
      {
        id: '3.3',
        name: 'Export/Import Features',
        plannedStartDate: addWeeks(today, 7),
        plannedEndDate: addWeeks(today, 9),
        progress: 0,
        priority: 'low',
        parentId: '3',
      },
      
      // Phase 4: Testing & Deployment
      {
        id: '4',
        name: 'Testing & Deployment',
        plannedStartDate: addWeeks(today, 8),
        plannedEndDate: addWeeks(today, 12),
        progress: 0,
        priority: 'high',
        color: '#10b981',
      },
      {
        id: '4.1',
        name: 'Unit Testing',
        plannedStartDate: addWeeks(today, 8),
        plannedEndDate: addWeeks(today, 9),
        progress: 0,
        priority: 'high',
        parentId: '4',
      },
      {
        id: '4.2',
        name: 'Integration Testing',
        plannedStartDate: addWeeks(today, 9),
        plannedEndDate: addWeeks(today, 10),
        progress: 0,
        priority: 'high',
        parentId: '4',
      },
      {
        id: '4.3',
        name: 'Performance Optimization',
        plannedStartDate: addWeeks(today, 10),
        plannedEndDate: addWeeks(today, 11),
        progress: 0,
        priority: 'medium',
        parentId: '4',
      },
      {
        id: '4.4',
        name: 'Production Deployment',
        plannedStartDate: addWeeks(today, 11),
        plannedEndDate: addWeeks(today, 12),
        progress: 0,
        priority: 'critical',
        parentId: '4',
      },
    ];
  }, []);
  
  // Sample dependencies
  const sampleDependencies = useMemo<TaskDependency[]>(() => [
    { id: 'd1', sourceTaskId: '1.1', targetTaskId: '1.2', type: 'finish-to-start', lag: 0 },
    { id: 'd2', sourceTaskId: '1.2', targetTaskId: '1.3', type: 'finish-to-start', lag: 0 },
    { id: 'd3', sourceTaskId: '1', targetTaskId: '2', type: 'finish-to-start', lag: 0 },
    { id: 'd4', sourceTaskId: '2.1', targetTaskId: '2.3', type: 'finish-to-start', lag: 0 },
    { id: 'd5', sourceTaskId: '2.2', targetTaskId: '2.3', type: 'finish-to-start', lag: 0 },
    { id: 'd6', sourceTaskId: '2.3', targetTaskId: '2.4', type: 'start-to-start', lag: 3 },
    { id: 'd7', sourceTaskId: '2.3', targetTaskId: '3.1', type: 'finish-to-start', lag: -7 },
    { id: 'd8', sourceTaskId: '3.1', targetTaskId: '3.2', type: 'start-to-start', lag: 7 },
    { id: 'd9', sourceTaskId: '3.2', targetTaskId: '3.3', type: 'start-to-start', lag: 7 },
    { id: 'd10', sourceTaskId: '2', targetTaskId: '4.1', type: 'finish-to-start', lag: 14 },
    { id: 'd11', sourceTaskId: '4.1', targetTaskId: '4.2', type: 'finish-to-start', lag: 0 },
    { id: 'd12', sourceTaskId: '4.2', targetTaskId: '4.3', type: 'finish-to-start', lag: 0 },
    { id: 'd13', sourceTaskId: '4.3', targetTaskId: '4.4', type: 'finish-to-start', lag: 0 },
  ], []);
  
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
        
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-medium text-gray-700">Total Tasks</div>
            <div className="text-2xl font-bold">{sampleTasks.length}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-medium text-gray-700">Dependencies</div>
            <div className="text-2xl font-bold">{sampleDependencies.length}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-medium text-gray-700">In Progress</div>
            <div className="text-2xl font-bold">
              {sampleTasks.filter(t => t.progress > 0 && t.progress < 100).length}
            </div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-medium text-gray-700">Completed</div>
            <div className="text-2xl font-bold">
              {sampleTasks.filter(t => t.progress === 100).length}
            </div>
          </div>
        </div>
      </div>
      
      {/* Gantt Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Gantt Chart</h2>
        
        <VibeGantt
          tasks={sampleTasks}
          dependencies={sampleDependencies}
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