import React, { useEffect, useState, useMemo } from 'react';
import { ContentContainer } from '@/components/layout/content-container';
import ProjectsProvider from './context/projects-context';
import { ProjectGrid } from './components/project-grid';
import { ProjectsDialogs } from './components/projects-dialogs';
import { ProjectsPrimaryButtons } from './components/projects-primary-buttons';
import { usePGliteContext } from '@/db/pglite-provider';
import { Project } from '@repo/dataforge/client-entities';
import { useSelector } from '@xstate/store/react';
import { projectsAtom } from '@/domain/project';
import { shallowEqual } from '@xstate/store';
import { useLoaderData } from '@tanstack/react-router';

/**
 * Main Projects Feature Component
 * Displays projects as cards in a grid layout with real-time updates
 * Now uses XState atomic reactivity with surgical updates
 */
const Projects: React.FC = () => {
  // 🎯 XSTATE REACTIVITY: Direct connection to XState store with surgical updates
  const projects = useSelector(
    projectsAtom,
    (projectsRecord) => {
      const projectsArray = Object.values(projectsRecord);
      return projectsArray.sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime; // Latest first
      });
    },
    shallowEqual
  )
  
  // 🎯 PERFORMANCE: Memoize project IDs to prevent unnecessary re-renders
  const projectIds = useMemo(() => {
    return projects.map(p => p.id)
  }, [projects])

  // Simplified debug logging for performance
  useEffect(() => {
    if (import.meta.env.DEV && Math.random() < 0.01) { // Only 1% of renders
      console.log('[Projects] XState data flow:', {
        xstateProjects: projects.length,
        source: 'xstate-store'
      })
    }
  }, [projects.length])

  return (
    <ProjectsProvider>
      <ContentContainer>
        <div className='mb-4 flex flex-wrap items-center justify-between space-y-2 gap-x-4'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>Projects</h2>
            <p className='text-muted-foreground'>
              Manage your projects and track their progress
            </p>
          </div>
          <ProjectsPrimaryButtons />
        </div>
        <div className='py-1'>
          {/* 🎯 XSTATE REACTIVITY: Simplified loading state - XState stores are always ready */}
          {projects.length === 0 && <p>No projects found.</p>}
          <ProjectGrid projectIds={projectIds} />
        </div>
      </ContentContainer>

      <ProjectsDialogs />
    </ProjectsProvider>
  );
};

export default Projects; 