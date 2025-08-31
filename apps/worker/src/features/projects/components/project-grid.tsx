import React from 'react';
import { Project } from '@repo/dataforge/client-entities';
import { ProjectCard } from './project-card';
import { FolderPlus } from 'lucide-react';
import { useProjects } from '../context/projects-context';

interface ProjectGridProps {
  // 🎯 PERFORMANCE: Pass only project IDs for granular atomic binding
  projectIds: string[];
}

// 🎯 PERFORMANCE: Memoize ProjectGrid to prevent unnecessary re-renders during navigation
export const ProjectGrid = React.memo(function ProjectGrid({ projectIds }: ProjectGridProps) {
  // 🎯 PERFORMANCE: Get context handlers once instead of in each card (34 times)
  const { 
    setSelectedProject,
    setIsUpdateDrawerOpen,
    setIsDeleteDialogOpen,
    setIsCreateDrawerOpen 
  } = useProjects();

  // 🎯 PERFORMANCE: Memoize handlers to prevent unnecessary re-renders
  const handleEdit = React.useCallback((project: Project) => {
    setSelectedProject(project);
    setIsUpdateDrawerOpen(true);
  }, [setSelectedProject, setIsUpdateDrawerOpen]);

  const handleDelete = React.useCallback((project: Project) => {
    setSelectedProject(project);
    setIsDeleteDialogOpen(true);
  }, [setSelectedProject, setIsDeleteDialogOpen]);

  if (projectIds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FolderPlus className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
        <p className="text-muted-foreground">Create your first project to get started</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
      {/* 🎯 PERFORMANCE: Each card gets only ID and shared handlers */}
      {projectIds.map((projectId) => (
        <ProjectCard 
          key={projectId} 
          projectId={projectId}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
}); 