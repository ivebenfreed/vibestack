/**
 * Project Domain Service
 * 
 * Implements project-specific CRUD operations with business logic and sync tracking.
 * Uses the Project entity type from DataForge for full type safety.
 */

import { Project, ProjectStatus } from '@repo/dataforge/client-entities';
import { db } from '@repo/dataforge/dexie-schema';
import { projectDexieService } from '@repo/dataforge/dexie-domain';
import type { CreateProjectInput, UpdateProjectInput } from '@repo/dataforge/project-operations';
import { nanoid } from 'nanoid';
import { BaseDomainService } from './base-domain-service';
import { trackOutgoingChange } from '@/db/dexie-change-tracking';

// Re-export types from DataForge
export type { CreateProjectInput, UpdateProjectInput } from '@repo/dataforge/project-operations';

// ============================================================================
// Project Domain Service Implementation
// ============================================================================

export class ProjectDomainService extends BaseDomainService<Project, CreateProjectInput, UpdateProjectInput> {
  tableName = 'projects';
  entityName = 'Project';
  
  protected getTable() {
    return db.projects;
  }
  
  // ============================================================================
  // UI Operations (with sync tracking)
  // ============================================================================
  
  async createUI(input: CreateProjectInput): Promise<Project> {
    // Validate input
    if (this.validateCreate) {
      this.validateCreate(input);
    }
    
    // Apply defaults and transformations
    const processedInput = this.beforeCreate ? this.beforeCreate(input) : input;
    
    const now = new Date().toISOString();
    const project: Project = {
      id: nanoid(),
      name: processedInput.name,
      description: processedInput.description || '',
      status: processedInput.status || ProjectStatus.ACTIVE,
      priority: processedInput.priority || 'medium',
      startDate: processedInput.startDate || null,
      endDate: processedInput.endDate || null,
      budget: processedInput.budget || null,
      actualCost: null,
      ownerId: processedInput.ownerId || null,
      tags: processedInput.tags || [],
      completedAt: null,
      createdAt: now,
      updatedAt: now,
      clientId: nanoid(),
    } as Project;
    
    // Save to Dexie
    await db.projects.add(project);
    
    // Track for outgoing sync
    await trackOutgoingChange('projects', 'insert', project);
    
    console.log('[ProjectService] Created project', {
      id: project.id,
      name: project.name,
      trackingSync: true
    });
    
    // Call after hook if defined
    if (this.afterCreate) {
      await this.afterCreate(project);
    }
    
    return project;
  }
  
  async updateUI(id: string, updates: UpdateProjectInput): Promise<Project> {
    const existing = await db.projects.get(id);
    if (!existing) {
      throw new Error(`Project ${id} not found`);
    }
    
    // Validate input
    if (this.validateUpdate) {
      this.validateUpdate(id, updates);
    }
    
    // Apply transformations
    const processedUpdates = this.beforeUpdate 
      ? this.beforeUpdate(id, updates, existing) 
      : updates;
    
    // Handle special business logic
    const finalUpdates: Partial<Project> = {
      ...processedUpdates,
      // Auto-set completedAt when marking as completed
      completedAt: processedUpdates.status === ProjectStatus.COMPLETED && !existing.completedAt
        ? new Date().toISOString()
        : processedUpdates.completedAt !== undefined 
          ? processedUpdates.completedAt 
          : existing.completedAt,
    };
    
    // Use base class helper for common update logic
    const updated = await this.performUpdate(id, finalUpdates);
    
    // Call after hook if defined
    if (this.afterUpdate) {
      await this.afterUpdate(updated, existing);
    }
    
    return updated;
  }
  
  async deleteUI(id: string): Promise<boolean> {
    // Check if project has tasks before deleting
    const taskCount = await db.tasks.where('projectId').equals(id).count();
    if (taskCount > 0) {
      throw new Error(`Cannot delete project ${id} - it has ${taskCount} associated tasks`);
    }
    
    return this.performDelete(id);
  }
  
  // ============================================================================
  // Incoming Operations (no sync tracking)
  // ============================================================================
  
  async createIncoming(project: Project): Promise<Project> {
    await db.projects.put(project);
    console.log('[ProjectService] Created project from incoming sync', {
      id: project.id,
      name: project.name
    });
    return project;
  }
  
  async updateIncoming(id: string, updates: Partial<Project>): Promise<Project> {
    const existing = await db.projects.get(id);
    if (!existing) {
      throw new Error(`Project ${id} not found`);
    }
    
    const updated: Project = {
      ...existing,
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString()
    };
    
    await db.projects.put(updated);
    console.log('[ProjectService] Updated project from incoming sync', {
      id: updated.id,
      updates
    });
    
    return updated;
  }
  
  async deleteIncoming(id: string): Promise<boolean> {
    const existing = await db.projects.get(id);
    if (!existing) {
      return false;
    }
    
    await db.projects.delete(id);
    console.log('[ProjectService] Deleted project from incoming sync', { id });
    
    return true;
  }
  
  // ============================================================================
  // Validation Hooks
  // ============================================================================
  
  protected validateCreate(input: CreateProjectInput): void {
    if (!input.name || input.name.trim().length === 0) {
      throw new Error('Project name is required');
    }
    
    if (input.name.length > 255) {
      throw new Error('Project name cannot exceed 255 characters');
    }
    
    // Validate dates
    if (input.startDate && input.endDate) {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      if (end < start) {
        throw new Error('Project end date cannot be before start date');
      }
    }
  }
  
  protected validateUpdate(id: string, updates: UpdateProjectInput): void {
    if (updates.name !== undefined) {
      if (updates.name.trim().length === 0) {
        throw new Error('Project name cannot be empty');
      }
      
      if (updates.name.length > 255) {
        throw new Error('Project name cannot exceed 255 characters');
      }
    }
    
    // Validate dates
    if (updates.startDate || updates.endDate) {
      // Need to fetch existing to validate date range
      // This is handled in the update method
    }
  }
  
  // ============================================================================
  // Business Logic Hooks
  // ============================================================================
  
  protected beforeCreate(input: CreateProjectInput): CreateProjectInput {
    // Apply any default transformations
    return {
      ...input,
      // Ensure description is never null
      description: input.description || '',
      // Default to medium priority if not specified
      priority: input.priority || 'medium',
      // Default to active status if not specified
      status: input.status || ProjectStatus.ACTIVE,
    };
  }
  
  protected beforeUpdate(id: string, updates: UpdateProjectInput, existing: Project): UpdateProjectInput {
    const processed = { ...updates };
    
    // Validate date range if either date is being updated
    if (updates.startDate || updates.endDate) {
      const newStart = updates.startDate || existing.startDate;
      const newEnd = updates.endDate || existing.endDate;
      
      if (newStart && newEnd) {
        const start = new Date(newStart);
        const end = new Date(newEnd);
        if (end < start) {
          throw new Error('Project end date cannot be before start date');
        }
      }
    }
    
    // Clear completedAt when reopening
    if (updates.status && updates.status !== ProjectStatus.COMPLETED && existing.completedAt) {
      processed.completedAt = null;
    }
    
    return processed;
  }
  
  // ============================================================================
  // Additional Project-Specific Methods
  // ============================================================================
  
  /**
   * Add a project member
   */
  async addProjectMemberUI(projectId: string, userId: string, role: string = 'member'): Promise<void> {
    const project = await db.projects.get(projectId);
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }
    
    const member = {
      id: nanoid(),
      projectId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clientId: nanoid(),
    };
    
    await db.project_members.add(member);
    await trackOutgoingChange('project_members', 'insert', member);
    
    console.log('[ProjectService] Added project member', {
      projectId,
      userId,
      role
    });
  }
  
  /**
   * Remove a project member
   */
  async removeProjectMemberUI(projectId: string, userId: string): Promise<void> {
    const member = await db.project_members
      .where('[projectId+userId]')
      .equals([projectId, userId])
      .first();
    
    if (member) {
      await db.project_members.delete(member.id);
      await trackOutgoingChange('project_members', 'delete', member);
      
      console.log('[ProjectService] Removed project member', {
        projectId,
        userId
      });
    }
  }
  
  /**
   * Update project status with business logic
   */
  async updateStatus(projectId: string, status: ProjectStatus): Promise<Project> {
    return this.updateUI(projectId, { status });
  }
}