import React, { useCallback } from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import ProjectsProvider from './context/projects-context';
import { ProjectsDialogs } from './components/projects-dialogs';
import { ProjectsPrimaryButtons } from './components/projects-primary-buttons';
import { VibeGridDex } from '@/components/custom/vibegriddex/VibeGridDex';
import { domainServices } from '@/domain';
import { useTheme } from '@/context/theme-context';
import { createEntityTagFilter } from '@/domain/helpers/tag-filters';
import type { Project } from '@repo/dataforge/client-entities';
import type { Column } from '@/components/custom/vibegriddex/column-types';

/**
 * Main Projects Feature Component
 * Using VibeGridDex for Dexie-based data grid
 */
const Projects: React.FC = () => {
  
  // Get theme and resolve 'system' to actual theme
  const { theme } = useTheme()
  const effectiveTheme = theme === 'system' 
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme

  // Define batch update handler for better performance with fill operations
  const handleBatchUpdate = useCallback(async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
    try {
      await domainServices.project.batchUpdateUI(updates);
      console.log('ProjectsTableView: Batch update completed', { count: updates.length });
    } catch (error) {
      console.error('ProjectsTableView: Batch update failed', error);
      throw error; // Re-throw to let VibeGridDex handle the error
    }
  }, []);

  // Define columns for Project entity
  const columns: Column<Project>[] = [
    { id: 'name', field: 'name', name: 'Name', cellType: 'text', width: 300, editable: true },
    { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 400, editable: true },
    { id: 'status', field: 'status', name: 'Status', cellType: 'enum', width: 150, editable: true,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'on_hold', label: 'On Hold' }
      ]
    },
    { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 120, editable: true,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' }
      ]
    },
    { id: 'tagSets', field: 'tagSets', name: 'Tag Sets', cellType: 'relationship-multi',
      width: 250, editable: true, sortable: false,
      relationshipTable: 'tag_sets',
      relationshipDisplayField: 'name',
      junctionTable: 'project_tag_sets',
      junctionSourceField: 'project_id',
      junctionTargetField: 'tag_set_id'
    },
    { id: 'startDate', field: 'startDate', name: 'Start Date', cellType: 'date', width: 150, editable: true },
    { id: 'endDate', field: 'endDate', name: 'End Date', cellType: 'date', width: 150, editable: true },
    { id: 'ownerId', field: 'ownerId', name: 'Owner', cellType: 'relationship-single',
      width: 180, relationshipTable: 'users', relationshipDisplayField: 'name', editable: true },
    { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 150, editable: false },
    { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 150, editable: false }
  ]

  // Error state
  const [error, setError] = React.useState<string | null>(null)

  return (
    <ProjectsProvider>
      <div className="flex flex-col h-full">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight mb-2">Projects</h1>
              <p className="text-muted-foreground">
                Manage your projects and track their progress
              </p>
            </div>
            <div className="flex items-center gap-4">
              <ProjectsPrimaryButtons />
            </div>
          </div>
          {error && (
            <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <div className="text-sm text-destructive">{error}</div>
            </div>
          )}
        </div>

        {/* Data Grid */}
        <VibeGridDex
          tableId="projects-table-v2"
          entityType="project"
          columns={columns}
          onEntityUpdate={(id, updates) => domainServices.project.updateUI(id, updates)}
          onBatchEntityUpdate={handleBatchUpdate}
          height={600}
          className="border border-border rounded-lg"
          enableSorting
          enableFiltering
          enableVirtualScrolling
        />
      </div>

      <ProjectsDialogs />
    </ProjectsProvider>
  );
};

export default Projects; 