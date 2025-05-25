import { TableChange, RelationshipUpdate } from '@repo/sync-types';
import { createSyncAdapters } from './sync-adapters';
import { createRepositories } from './repositories';
import { createServices } from './services';
import { SyncManager } from '../sync/SyncManager';
import { getNewPGliteDataSource } from './newtypeorm/NewDataSource';

/**
 * Change Processor for handling database changes
 */
export class ChangeProcessor {
  private syncAdapters: ReturnType<typeof createSyncAdapters> | null = null;
  private repositories: Awaited<ReturnType<typeof createRepositories>> | null = null;
  private initialized = false;
  
  constructor() {}
  
  /**
   * Initialize the change processor with all dependencies
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // Get DataSource
    const dataSource = await getNewPGliteDataSource();
    
    // Create repositories
    const repositories = await createRepositories();
    this.repositories = repositories;
    
    // Get SyncChangeManager
    const syncManager = SyncManager.getInstance();
    const outgoingChangeProcessor = syncManager.getOutgoingChangeProcessor();
    
    // Create services using the service factory
    const services = createServices(repositories, outgoingChangeProcessor);
    
    // Create sync adapters
    this.syncAdapters = createSyncAdapters(services);
    
    this.initialized = true;
  }
  
  /**
   * Process a single table change
   */
  async processChange(change: TableChange): Promise<void> {
    // Initialize if not already initialized
    if (!this.initialized && !this.syncAdapters) {
      await this.initialize();
    }
    
    if (!this.syncAdapters) {
      throw new Error('Change processor not initialized');
    }

    const { table, operation, data } = change;
    console.log(`[ChangeProcessor] Processing change for table: ${table}, operation: ${operation}, ID: ${data.id}`);
    
    // ✨ NEW: Check if this change includes relationship updates
    if (this.hasRelationshipUpdates(change)) {
      await this.processRelationshipChange(change);
      return;
    }
    
    const legacyType = operation.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE';
    
    const legacyChange = {
      type: legacyType,
      entity: table,
      data: data as Record<string, any>
    };
    
    try {
      switch (table) {
        case 'users':
          await this.syncAdapters.users.processChange(legacyChange);
          break;
        case 'projects':
          await this.syncAdapters.projects.processChange(legacyChange);
          break;
        case 'tasks':
          await this.syncAdapters.tasks.processChange(legacyChange);
          break;
        case 'comments':
          await this.syncAdapters.comments.processChange(legacyChange);
          break;
        default:
          throw new Error(`Unsupported entity type: ${table}`);
      }
      console.log(`[ChangeProcessor] Successfully processed change for table: ${table}, ID: ${data.id}`);
    } catch (error) {
      console.error(`[ChangeProcessor] Error processing change for table: ${table}, ID: ${data.id}`);
      console.error(`[ChangeProcessor] Error details:`,
        error instanceof Error ? { message: error.message, stack: error.stack } : String(error));
      throw error;
    }
  }
  
  /**
   * Process a batch of table changes
   */
  async processBatch(changes: TableChange[]): Promise<void> {
    // Initialize if not already initialized
    if (!this.initialized && !this.syncAdapters) {
      await this.initialize();
    }
    
    // Optimize changes (deduplicate, order by dependencies)
    const optimizedChanges = this.optimizeChanges(changes);
    
    // Process in batches using a transaction
    const dataSource = await getNewPGliteDataSource();
    const queryRunner = dataSource.createQueryRunner();
    
    try {
      await queryRunner.startTransaction();
      
      for (const change of optimizedChanges) {
        await this.processChange(change);
      }
      
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  
  /**
   * Optimize changes for processing
   */
  private optimizeChanges(changes: TableChange[]): TableChange[] {
    // Remove duplicates
    const uniqueChanges = new Map<string, TableChange>();
    for (const change of changes) {
      const key = `${change.table}_${change.data.id}`;
      uniqueChanges.set(key, change);
    }
    
    // Order by dependencies
    return Array.from(uniqueChanges.values())
      .sort((a, b) => this.getDependencyOrder(a) - this.getDependencyOrder(b));
  }
  
  /**
   * Get dependency order for a change
   * Lower number means higher priority
   */
  private getDependencyOrder(change: TableChange): number {
    // Define dependency order for different entity types
    const entityOrder: Record<string, number> = {
      'users': 1,
      'projects': 2,
      'tasks': 3,
      'comments': 4
    };

    return entityOrder[change.table] || 999;
  }

  // ✨ NEW: Relationship processing methods
  
  /**
   * Check if a change includes relationship updates
   */
  private hasRelationshipUpdates(change: TableChange): boolean {
    return !!(change.relationshipUpdates && change.relationshipUpdates.length > 0);
  }
  
  /**
   * Process a change that includes relationship updates
   */
  private async processRelationshipChange(change: TableChange): Promise<void> {
    if (!this.repositories) {
      throw new Error('Repositories not initialized');
    }

    console.log(`[ChangeProcessor] Processing relationship updates for ${change.table}:${change.data.id}`);
    
    try {
      // Handle regular entity data first (if present)
      if (Object.keys(change.data).length > 1) { // More than just 'id'
        await this.processRegularEntityChange(change);
      }
      
      // Then handle relationship updates
      await this.applyRelationshipUpdates(change);
      console.log(`[ChangeProcessor] Successfully applied relationship updates`);
    } catch (error) {
      console.error(`[ChangeProcessor] Error applying relationship updates:`, error);
      throw error;
    }
  }
  
  /**
   * Process regular entity data changes
   */
  private async processRegularEntityChange(change: TableChange): Promise<void> {
    // Process entity data changes using existing sync adapters
    const legacyType = change.operation.toUpperCase() as 'INSERT' | 'UPDATE' | 'DELETE';
    const legacyChange = {
      type: legacyType,
      entity: change.table,
      data: change.data as Record<string, any>
    };
    
    if (!this.syncAdapters) {
      throw new Error('Sync adapters not initialized');
    }
    
    // Call existing entity processing logic
    switch (change.table) {
      case 'users':
        await this.syncAdapters.users.processChange(legacyChange);
        break;
      case 'projects':
        await this.syncAdapters.projects.processChange(legacyChange);
        break;
      case 'tasks':
        await this.syncAdapters.tasks.processChange(legacyChange);
        break;
      case 'comments':
        await this.syncAdapters.comments.processChange(legacyChange);
        break;
      default:
        console.warn(`[ChangeProcessor] Unknown entity table: ${change.table}`);
    }
  }
  
  /**
   * Apply relationship updates to entities
   */
  private async applyRelationshipUpdates(change: TableChange): Promise<void> {
    if (!this.repositories || !change.relationshipUpdates) {
      return;
    }

    const entityId = change.data.id as string;
    
    switch (change.table) {
      case 'projects':
        await this.applyProjectRelationshipUpdates(entityId, change.relationshipUpdates);
        break;
      case 'tasks':
        await this.applyTaskRelationshipUpdates(entityId, change.relationshipUpdates);
        break;
      default:
        console.warn(`[ChangeProcessor] Unknown entity table: ${change.table}`);
    }
  }
  
  /**
   * Apply project relationship updates
   */
  private async applyProjectRelationshipUpdates(
    projectId: string,
    relationshipUpdates: RelationshipUpdate[]
  ): Promise<void> {
    if (!this.repositories) return;

    for (const relUpdate of relationshipUpdates) {
      switch (relUpdate.relationName) {
        case 'members':
          await this.updateProjectMembers(projectId, relUpdate);
          break;
        default:
          console.warn(`Unknown project relationship: ${relUpdate.relationName}`);
      }
    }
  }
  
  /**
   * Apply task relationship updates
   */
  private async applyTaskRelationshipUpdates(
    taskId: string,
    relationshipUpdates: RelationshipUpdate[]
  ): Promise<void> {
    if (!this.repositories) return;

    for (const relUpdate of relationshipUpdates) {
      switch (relUpdate.relationName) {
        case 'dependencies':
          await this.updateTaskDependencies(taskId, relUpdate);
          break;
        default:
          console.warn(`Unknown task relationship: ${relUpdate.relationName}`);
      }
    }
  }
  
  /**
   * Update project members based on relationship update
   */
  private async updateProjectMembers(
    projectId: string,
    relUpdate: RelationshipUpdate
  ): Promise<void> {
    if (!this.repositories) return;

    switch (relUpdate.operation) {
      case 'set':
        // Replace entire member list
        await this.repositories.projects.updateMembers(projectId, relUpdate.targetIds);
        break;
      case 'add':
        // Add specific members
        for (const userId of relUpdate.targetIds) {
          await this.repositories.projects.addMember(projectId, userId);
        }
        break;
      case 'remove':
        // Remove specific members
        for (const userId of relUpdate.targetIds) {
          await this.repositories.projects.removeMember(projectId, userId);
        }
        break;
    }
    
    // Dispatch UI update event
    const updatedMembers = await this.repositories.projects.getMembers(projectId);
    const event = new CustomEvent('project-members-updated', { 
      detail: { projectId, members: updatedMembers } 
    });
    window.dispatchEvent(event);
  }
  
  /**
   * Update task dependencies based on relationship update
   * TODO: Implement dependency methods in TaskRepository
   */
  private async updateTaskDependencies(
    taskId: string,
    relUpdate: RelationshipUpdate
  ): Promise<void> {
    if (!this.repositories) return;

    console.log(`[ChangeProcessor] Task dependency updates not yet implemented for task ${taskId}`, {
      operation: relUpdate.operation,
      targetIds: relUpdate.targetIds
    });
    
    // TODO: Implement when TaskRepository has dependency methods
    // switch (relUpdate.operation) {
    //   case 'set':
    //     await this.repositories.tasks.updateDependencies(taskId, relUpdate.targetIds);
    //     break;
    //   case 'add':
    //     for (const depId of relUpdate.targetIds) {
    //       await this.repositories.tasks.addDependency(taskId, depId);
    //     }
    //     break;
    //   case 'remove':
    //     for (const depId of relUpdate.targetIds) {
    //       await this.repositories.tasks.removeDependency(taskId, depId);
    //     }
    //     break;
    // }
    
    // Dispatch UI update event when implemented
    // const updatedDependencies = await this.repositories.tasks.getDependencies(taskId);
    // const event = new CustomEvent('task-dependencies-updated', { 
    //   detail: { taskId, dependencies: updatedDependencies } 
    // });
    // window.dispatchEvent(event);
  }
} 