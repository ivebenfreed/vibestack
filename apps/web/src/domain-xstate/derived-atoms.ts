/**
 * Derived atoms for computed values across domains
 * 
 * These atoms automatically update when the underlying atoms change,
 * providing reactive computed values without additional functions.
 */

import { createAtom } from '@xstate/store';
import { tasksAtom } from './task';
import { projectsAtom } from './project';
import { usersAtom } from './user';
import { commentsAtom } from './comment';

/**
 * Derived atom for entity counts
 * Automatically updates when any entity atom changes
 */
export const entityCountsAtom = createAtom(
  {
    tasks: 0,
    projects: 0,
    users: 0,
    comments: 0
  },
  {
    computeValue: () => {
      const tasks = Object.keys(tasksAtom.get()).length;
      const projects = Object.keys(projectsAtom.get()).length;
      const users = Object.keys(usersAtom.get()).length;
      const comments = Object.keys(commentsAtom.get()).length;
      
      return {
        tasks,
        projects,
        users,
        comments
      };
    }
  }
);

/**
 * Derived atom for comment statistics
 * Provides total count and other stats if needed
 */
export const commentStatsAtom = createAtom(
  {
    total: 0,
    // Add more stats as needed (e.g., byUser, byTask, etc.)
  },
  {
    computeValue: () => {
      const comments = Object.values(commentsAtom.get());
      
      return {
        total: comments.length
      };
    }
  }
);

/**
 * Derived atom for task statistics
 */
export const taskStatsAtom = createAtom(
  {
    total: 0,
    todo: 0,
    inProgress: 0,
    completed: 0
  },
  {
    computeValue: () => {
      const tasks = Object.values(tasksAtom.get());
      
      const todo = tasks.filter(t => t.status === 'todo').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const completed = tasks.filter(t => t.status === 'completed').length;
      
      return {
        total: tasks.length,
        todo,
        inProgress,
        completed
      };
    }
  }
);

/**
 * Derived atom for project statistics
 */
export const projectStatsAtom = createAtom(
  {
    total: 0,
    active: 0,
    archived: 0,
    planning: 0,
    onHold: 0
  },
  {
    computeValue: () => {
      const projects = Object.values(projectsAtom.get());
      
      const active = projects.filter(p => p.status === 'active').length;
      const archived = projects.filter(p => p.status === 'archived').length;
      const planning = projects.filter(p => p.status === 'planning').length;
      const onHold = projects.filter(p => p.status === 'on_hold').length;
      
      return {
        total: projects.length,
        active,
        archived,
        planning,
        onHold
      };
    }
  }
);