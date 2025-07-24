import React from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import ProjectsProvider from './context/projects-context';
import { ProjectsDialogs } from './components/projects-dialogs';
import { ProjectsPrimaryButtons } from './components/projects-primary-buttons';
import { VibeGridDexWithSuspense } from '@/components/custom/vibegriddex/VibeGridDex';
import { domainServices } from '@/domain';
import type { Project } from '@repo/dataforge/client-entities';
import type { Column } from '@/components/custom/vibegriddex/column-types';

/**
 * Main Projects Feature Component
 * Using VibeGridDex for Dexie-based data grid with Suspense
 */
const Projects: React.FC = () => {
  // Define columns for Project entity (responsive widths to prevent overflow)
  const columns: Column<Project>[] = [
    { id: 'name', field: 'name', name: 'Name', cellType: 'text', width: 200 },
    { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 300 },
    { id: 'status', field: 'status', name: 'Status', cellType: 'enum', width: 120,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'on_hold', label: 'On Hold' }
      ]
    },
    { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 100,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' }
      ]
    },
    { id: 'startDate', field: 'startDate', name: 'Start Date', cellType: 'date', width: 130 },
    { id: 'endDate', field: 'endDate', name: 'End Date', cellType: 'date', width: 130 },
    { id: 'ownerId', field: 'ownerId', name: 'Owner', cellType: 'relationship-single',
      width: 150, relationshipTable: 'users', relationshipDisplayField: 'name' },
    { id: 'tags', field: 'tags', name: 'Tags', cellType: 'relationship-multi',
      width: 180, relationshipTable: 'tags', relationshipDisplayField: 'name' },
    { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 130, editable: false },
    { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 130, editable: false }
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
        <VibeGridDexWithSuspense
          tableId="projects-table"
          entityType="project"
          columns={columns}
          onEntityUpdate={(id, updates) => domainServices.project.updateUI(id, updates)}
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