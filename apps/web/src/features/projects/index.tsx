import React from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import ProjectsProvider from './context/projects-context';
import { ProjectsDialogs } from './components/projects-dialogs';
import { ProjectsPrimaryButtons } from './components/projects-primary-buttons';
import { VibeGridDex } from '@/components/custom/vibegriddex/VibeGridDex';
import { updateProjectUI } from '@/domain-dexie/project';
import type { Project } from '@repo/dataforge/client-entities';
import type { Column } from '@/components/custom/vibegriddex/column-types';
import { Route } from '@/routes/_authenticated/projects/index';

/**
 * Main Projects Feature Component
 * Using VibeGridDex for Dexie-based data grid with loader pattern
 */
const Projects: React.FC = () => {
  // Get the loader data
  const loaderData = Route.useLoaderData();
  const { initialData } = loaderData || {};
  // Define columns for Project entity
  const columns: Column<Project>[] = [
    { id: 'name', field: 'name', name: 'Name', cellType: 'text', width: 250 },
    { id: 'description', field: 'description', name: 'Description', cellType: 'text', width: 400 },
    { id: 'status', field: 'status', name: 'Status', cellType: 'enum', width: 150,
      options: [
        { value: 'active', label: 'Active' },
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'on_hold', label: 'On Hold' }
      ]
    },
    { id: 'priority', field: 'priority', name: 'Priority', cellType: 'enum', width: 120,
      options: [
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' },
        { value: 'critical', label: 'Critical' }
      ]
    },
    { id: 'startDate', field: 'startDate', name: 'Start Date', cellType: 'date', width: 150 },
    { id: 'endDate', field: 'endDate', name: 'End Date', cellType: 'date', width: 150 },
    { id: 'ownerId', field: 'ownerId', name: 'Owner', cellType: 'relationship-single',
      width: 180, relationshipTable: 'users', relationshipDisplayField: 'name' },
    { id: 'tags', field: 'tags', name: 'Tags', cellType: 'relationship-multi',
      width: 250, relationshipTable: 'tags', relationshipDisplayField: 'name' },
    { id: 'createdAt', field: 'createdAt', name: 'Created', cellType: 'date', width: 150, editable: false },
    { id: 'updatedAt', field: 'updatedAt', name: 'Updated', cellType: 'date', width: 150, editable: false }
  ]

  // Error state
  const [error, setError] = React.useState<string | null>(null)

  // Handle entity updates
  const handleEntityUpdate = React.useCallback(async (rowId: string, updates: Record<string, any>) => {
    console.log('[Projects] 🚀 Updating project:', { rowId, updates })
    try {
      setError(null)
      await updateProjectUI(rowId, updates)
      console.log('[Projects] ✅ Project updated successfully')
    } catch (err) {
      console.error('[Projects] ❌ Project update failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to update project')
      throw err
    }
  }, [])

  return (
    <ProjectsProvider>
      <ContentContainer>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-border bg-background">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-foreground">Projects</h2>
                <p className="text-sm text-muted-foreground mt-1">
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
          <div className="flex-1">
            <VibeGridDex
              tableId="projects-table"
              entityType="project"
              columns={columns}
              onEntityUpdate={handleEntityUpdate}
              height="calc(100vh - 200px)"
              className="border-0"
              enableSorting
              enableFiltering
              enableVirtualScrolling
              initialData={initialData}
            />
          </div>
        </div>
      </ContentContainer>

      <ProjectsDialogs />
    </ProjectsProvider>
  );
};

export default Projects; 