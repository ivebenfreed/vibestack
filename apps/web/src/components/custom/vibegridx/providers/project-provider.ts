import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * Project Provider
 * 
 * Provides all active projects as options
 * Sorted by name
 */
export const projectProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  const { atoms } = context;
  
  // Get projects from atoms
  const projects = atoms.projects?.get() || {};
  
  // Get all projects (no filtering needed for now)
  const allProjects = Object.values(projects)
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  
  // Convert to EnumOption format
  return allProjects.map((project: any) => ({
    value: project.id,
    label: project.name,
    description: project.description
  }));
};