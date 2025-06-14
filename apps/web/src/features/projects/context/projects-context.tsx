import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { usePGliteContext } from '@/db/pglite-provider';

interface ProjectContextType {
  selectedProject: Project | null;
  setSelectedProject: (project: Project | null) => void;
  isCreateDrawerOpen: boolean;
  setIsCreateDrawerOpen: (isOpen: boolean) => void;
  isUpdateDrawerOpen: boolean;
  setIsUpdateDrawerOpen: (isOpen: boolean) => void;
  isDeleteDialogOpen: boolean;
  setIsDeleteDialogOpen: (isOpen: boolean) => void;
  createProject: (projectData: { name: string; description?: string; status?: ProjectStatus }) => Promise<Project>;
  updateProject: (id: string, changes: Partial<Project>) => Promise<Project>;
  deleteProject: (id: string) => Promise<boolean>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const useProjects = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjects must be used within a ProjectsProvider');
  }
  return context;
};

interface ProjectsProviderProps {
  children: ReactNode;
}

const ProjectsProvider: React.FC<ProjectsProviderProps> = ({ children }) => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [isUpdateDrawerOpen, setIsUpdateDrawerOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  
  // Use service directly from context - this already includes proper sync handling
  const { services } = usePGliteContext();
  const projectService = services?.projects;

  // Create a new project
  const createProject = useCallback(async (projectData: { name: string; description?: string; status?: ProjectStatus }) => {
    console.log('Creating project with data:', projectData);
    
    if (!projectService) {
      throw new Error('Project service not available');
    }
    
    console.log('Using project service to create project');
    const created = await projectService.createProject({
      name: projectData.name,
      description: projectData.description || '',
      status: projectData.status || ProjectStatus.ACTIVE
    });
    
    // Dispatch a custom event to notify that a project was created
    const event = new CustomEvent('project-created', { 
      detail: { project: created } 
    });
    window.dispatchEvent(event);
    console.log('Dispatched project-created event');
    
    return created;
  }, [projectService]);

  // Update an existing project
  const updateProject = useCallback(async (id: string, changes: Partial<Project>) => {
    console.log('Updating project with id:', id, 'and changes:', changes);
    
    if (!projectService) {
      throw new Error('Project service not available');
    }
    
    console.log('Using project service to update project');
    const updated = await projectService.updateProject(id, changes);
    
    // Dispatch a custom event to notify that a project was updated
    const event = new CustomEvent('project-updated', { 
      detail: { project: updated } 
    });
    window.dispatchEvent(event);
    console.log('Dispatched project-updated event');
    
    return updated;
  }, [projectService]);

  // Delete a project
  const deleteProject = useCallback(async (id: string) => {
    console.log('Deleting project with id:', id);
    
    if (!projectService) {
      throw new Error('Project service not available');
    }
    
    console.log('Using project service to delete project');
    const success = await projectService.deleteProject(id);
    
    if (success) {
      // Dispatch a custom event to notify that a project was deleted
      const event = new CustomEvent('project-deleted', { 
        detail: { projectId: id } 
      });
      window.dispatchEvent(event);
      console.log('Dispatched project-deleted event');
    }
    
    return success;
  }, [projectService]);

  const value = {
    selectedProject,
    setSelectedProject,
    isCreateDrawerOpen,
    setIsCreateDrawerOpen,
    isUpdateDrawerOpen,
    setIsUpdateDrawerOpen,
    isDeleteDialogOpen,
    setIsDeleteDialogOpen,
    createProject,
    updateProject,
    deleteProject
  };

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  );
};

export default ProjectsProvider; 