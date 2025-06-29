/**
 * Optimized ensureLoaded utilities for domain atoms
 * 
 * These functions provide direct, performant ways to ensure atoms are loaded
 * from the database, with minimal overhead and maximum parallelization.
 */

import { getGlobalDataSource } from '@/db/global-datasource';
import { Task, Project, User, Comment } from '@repo/dataforge/client-entities';
import { tasksAtom, taskUtils } from './task';
import { projectsAtom, projectUtils } from './project';
import { usersAtom, userUtils } from './user';
import { commentsAtom, commentUtils } from './comment';

// ⚡ PERFORMANCE: Cached loaded state to avoid expensive atom reads
let _tasksLoaded = false;
let _projectsLoaded = false;
let _usersLoaded = false;
let _commentsLoaded = false;

// Check functions - truly zero overhead with caching
export const areTasksLoaded = () => _tasksLoaded || (_tasksLoaded = Object.keys(tasksAtom.get()).length > 0);
export const areProjectsLoaded = () => _projectsLoaded || (_projectsLoaded = Object.keys(projectsAtom.get()).length > 0);
export const areUsersLoaded = () => _usersLoaded || (_usersLoaded = Object.keys(usersAtom.get()).length > 0);
export const areCommentsLoaded = () => _commentsLoaded || (_commentsLoaded = Object.keys(commentsAtom.get()).length > 0);

export const areAllDomainsLoaded = () => 
  areTasksLoaded() && areProjectsLoaded() && areUsersLoaded() && areCommentsLoaded();

/**
 * Helper to create optimized loaders that skip when data is already loaded
 * Usage: createOptimizedLoader(['tasks', 'projects'])
 */
export function createOptimizedLoader(domains: Array<'tasks' | 'projects' | 'users' | 'comments'>) {
  return async () => {
    // Check if all requested domains are loaded
    const checks = {
      tasks: domains.includes('tasks') ? areTasksLoaded() : true,
      projects: domains.includes('projects') ? areProjectsLoaded() : true,
      users: domains.includes('users') ? areUsersLoaded() : true,
      comments: domains.includes('comments') ? areCommentsLoaded() : true,
    };
    
    // Fast path - return immediately if everything is loaded
    if (Object.values(checks).every(Boolean)) {
      return null;
    }
    
    // Load only what's missing
    const loadPromises = [];
    if (domains.includes('tasks') && !areTasksLoaded()) {
      loadPromises.push(ensureTasksLoaded());
    }
    if (domains.includes('projects') && !areProjectsLoaded()) {
      loadPromises.push(ensureProjectsLoaded());
    }
    if (domains.includes('users') && !areUsersLoaded()) {
      loadPromises.push(ensureUsersLoaded());
    }
    if (domains.includes('comments') && !areCommentsLoaded()) {
      loadPromises.push(ensureCommentsLoaded());
    }
    
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
    
    return null;
  };
}

// Direct ensureLoaded functions for each domain - minimal overhead
export const ensureTasksLoaded = async () => {
  if (!_tasksLoaded && Object.keys(tasksAtom.get()).length === 0) {
    const dataSource = await getGlobalDataSource();
    const tasks = await dataSource.getRepository(Task).find({
      relations: ['project', 'assignee']
    });
    taskUtils.loadTasks(tasks);
    _tasksLoaded = true;
  }
};

export const ensureProjectsLoaded = async () => {
  if (!_projectsLoaded && Object.keys(projectsAtom.get()).length === 0) {
    const dataSource = await getGlobalDataSource();
    const projects = await dataSource.getRepository(Project).find({
      relations: ['owner', 'members']
    });
    projectUtils.loadProjects(projects);
    _projectsLoaded = true;
  }
};

export const ensureUsersLoaded = async () => {
  if (!_usersLoaded && Object.keys(usersAtom.get()).length === 0) {
    const dataSource = await getGlobalDataSource();
    const users = await dataSource.getRepository(User).find();
    userUtils.loadUsers(users);
    _usersLoaded = true;
  }
};

export const ensureCommentsLoaded = async () => {
  if (!_commentsLoaded && Object.keys(commentsAtom.get()).length === 0) {
    const dataSource = await getGlobalDataSource();
    const comments = await dataSource.getRepository(Comment).find({
      relations: ['author', 'task', 'project', 'parent']
    });
    commentUtils.loadComments(comments);
    _commentsLoaded = true;
  }
};

/**
 * Load all domains in parallel - maximum performance
 * Completely bypasses async operations if all data is already loaded
 */
export async function ensureAllDomainsLoaded(): Promise<void> {
  // Fast path - if everything is loaded, return immediately (no async overhead)
  if (areAllDomainsLoaded()) {
    return;
  }
  
  // Only load what's needed
  const loadPromises = [];
  if (!areTasksLoaded()) loadPromises.push(ensureTasksLoaded());
  if (!areProjectsLoaded()) loadPromises.push(ensureProjectsLoaded());
  if (!areUsersLoaded()) loadPromises.push(ensureUsersLoaded());
  if (!areCommentsLoaded()) loadPromises.push(ensureCommentsLoaded());
  
  if (loadPromises.length > 0) {
    await Promise.all(loadPromises);
  }
}