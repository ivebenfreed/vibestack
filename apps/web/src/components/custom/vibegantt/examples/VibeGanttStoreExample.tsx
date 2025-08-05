import React from 'react';
import { VibeGanttStoreIntegrated } from '../VibeGanttStoreIntegrated';

/**
 * Example of using VibeGantt with integrated store data loading
 * 
 * This version automatically:
 * - Loads all tasks from IndexedDB
 * - Resolves relationships (assignees, projects, status, tags)
 * - Sets up live subscriptions for updates
 * - Manages hierarchical task structure
 * - Calculates critical path
 * - Persists view state (expanded tasks, zoom, date range)
 */
export function VibeGanttStoreExample({ projectId }: { projectId?: string }) {
  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">
          Project Gantt Chart {projectId ? `- ${projectId}` : '(All Projects)'}
        </h1>
      </div>
      
      <div className="flex-1">
        <VibeGanttStoreIntegrated
          projectId={projectId}
          height={800}
          viewConfig={{
            showCriticalPath: true,
            showResourceAllocation: true,
            allowTaskDrag: true,
            allowTaskResize: true,
            allowDependencyCreation: true,
          }}
          onTaskUpdate={(task) => {
            console.log('Task updated:', task);
            // In a real app, this would update the task in the database
            // The store subscriptions will automatically pick up the change
          }}
          onTaskCreate={(task) => {
            console.log('Task created:', task);
            // Create task in database
          }}
          onTaskDelete={(taskId) => {
            console.log('Task deleted:', taskId);
            // Delete task from database
          }}
          onDependencyCreate={(dependency) => {
            console.log('Dependency created:', dependency);
            // Create dependency in database
          }}
          onDependencyDelete={(dependencyId) => {
            console.log('Dependency deleted:', dependencyId);
            // Delete dependency from database
          }}
        />
      </div>
    </div>
  );
}

/**
 * Benefits of the store-based approach:
 * 
 * 1. **Pre-resolved Data**: All relationships are resolved before rendering
 *    - Assignee names, avatars, emails
 *    - Project names and colors
 *    - Status names and colors
 *    - Tag names and colors
 * 
 * 2. **Live Updates**: Changes to data are automatically reflected
 *    - Task updates
 *    - Dependency changes
 *    - User/project/status/tag updates
 * 
 * 3. **Performance**: Data is loaded once and kept in memory
 *    - No repeated queries during rendering
 *    - Efficient change detection
 *    - Pagination support for large datasets
 * 
 * 4. **Persistence**: View state is saved to localStorage
 *    - Expanded/collapsed tasks
 *    - Zoom level
 *    - Visible date range
 *    - Show weekends/dependencies preferences
 * 
 * 5. **Consistency**: Same data model as VibeGridDex
 *    - Familiar patterns for developers
 *    - Shared utilities and helpers
 *    - Consistent behavior across components
 */