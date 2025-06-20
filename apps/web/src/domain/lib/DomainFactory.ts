import { NewPGliteDataSource } from '../../db/newtypeorm/NewDataSource';
import { OutgoingChangeService } from '../../sync/OutgoingChangeService';

// Import domain modules
import { createUserDomain } from '../user';
import { createCommentDomain } from '../comment';
import { createTaskDomain } from '../task';
import { createProjectDomain } from '../project';

/**
 * Creates all domain modules using centralized datasource
 * Integrates with pure services architecture using OutgoingChangeService
 */
export function createAllDomains(
  dataSource: NewPGliteDataSource, 
  outgoingChangeService: OutgoingChangeService | null
) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating domains');
  }

  // If outgoingChangeService is null (e.g., for incoming sync processing), create a no-op version
  let effectiveOutgoingChangeService: OutgoingChangeService;
  
  if (!outgoingChangeService) {
    console.log('[DomainFactory] Creating domains with no-op outgoing change service (incoming sync mode)');
    // Create a no-op outgoing change service for incoming sync processing
    effectiveOutgoingChangeService = {
      trackEntityChange: async (table: string, operation: string, entity: any) => {
        // No-op: incoming sync changes should not track outgoing changes
        console.debug(`[DomainFactory] No-op trackEntityChange called: ${table}:${operation} (incoming sync mode)`);
      }
    } as any;
  } else {
    console.log('[DomainFactory] Creating domains with real outgoing change service (outgoing sync mode)');
    effectiveOutgoingChangeService = outgoingChangeService;
  }

  return {
    user: createUserDomain(dataSource, effectiveOutgoingChangeService),
    comment: createCommentDomain(dataSource, effectiveOutgoingChangeService),
    task: createTaskDomain(dataSource, effectiveOutgoingChangeService),
    project: createProjectDomain(dataSource, effectiveOutgoingChangeService),
  };
}

/**
 * Service adapter interface that sync adapters expect
 */
interface SyncServiceAdapter {
  createFromSync(data: any): Promise<any>;
  updateFromSync(id: string, data: any): Promise<any>;
  deleteFromSync(id: string): Promise<boolean>;
  getRepo(): any;
  repository?: any; // For CommentSyncAdapter compatibility
  
  // New clearer method names for regular operations with sync tracking
  createWithProcessing?(data: any): Promise<any>;
  updateWithProcessing?(id: string, data: any): Promise<any>;
  deleteWithProcessing?(id: string): Promise<boolean>;
  
  // Old confusing method names (deprecated)
  createFromSyncWithProcessing?(data: any): Promise<any>;
  updateFromSyncWithProcessing?(id: string, data: any): Promise<any>;
  deleteFromSyncWithProcessing?(id: string): Promise<boolean>;
}

/**
 * Creates sync-compatible service adapters from domain services
 * These adapters bridge the gap between domain services and sync adapters
 */
function createSyncServiceAdapters(domains: ReturnType<typeof createAllDomains>) {
  return {
    users: {
      createFromSync: (data: any) => domains.user.service.createFromSync(data),
      updateFromSync: (id: string, data: any) => domains.user.service.updateFromSync(id, data),
      deleteFromSync: (id: string) => domains.user.service.deleteFromSync(id),
      getRepo: () => domains.user.service.getRepo(),
      repository: domains.user.repository, // For compatibility
      
      // New clearer method names for regular operations with sync tracking
      createWithProcessing: (data: any) => domains.user.service.createWithProcessing(data),
      updateWithProcessing: (id: string, data: any) => domains.user.service.updateWithProcessing(id, data),
      deleteWithProcessing: (id: string) => domains.user.service.deleteWithProcessing(id),
      
      // Old confusing method names (deprecated but maintained for compatibility)
      createFromSyncWithProcessing: (data: any) => domains.user.service.createFromSyncWithProcessing(data),
      updateFromSyncWithProcessing: (id: string, data: any) => domains.user.service.updateFromSyncWithProcessing(id, data),
      deleteFromSyncWithProcessing: (id: string) => domains.user.service.deleteFromSyncWithProcessing(id),
    } as SyncServiceAdapter,
    
    projects: {
      createFromSync: (data: any) => domains.project.service.createFromSync(data),
      updateFromSync: (id: string, data: any) => domains.project.service.updateFromSync(id, data),
      deleteFromSync: (id: string) => domains.project.service.deleteFromSync(id),
      getRepo: () => domains.project.service.getRepo(),
      repository: domains.project.repository, // For compatibility
      
      // New clearer method names for regular operations with sync tracking
      createWithProcessing: (data: any) => domains.project.service.createWithProcessing(data),
      updateWithProcessing: (id: string, data: any) => domains.project.service.updateWithProcessing(id, data),
      deleteWithProcessing: (id: string) => domains.project.service.deleteWithProcessing(id),
      
      // Old confusing method names (deprecated but maintained for compatibility)
      createFromSyncWithProcessing: (data: any) => domains.project.service.createFromSyncWithProcessing(data),
      updateFromSyncWithProcessing: (id: string, data: any) => domains.project.service.updateFromSyncWithProcessing(id, data),
      deleteFromSyncWithProcessing: (id: string) => domains.project.service.deleteFromSyncWithProcessing(id),
    } as SyncServiceAdapter,
    
    tasks: {
      createFromSync: (data: any) => domains.task.service.createFromSync(data),
      updateFromSync: (id: string, data: any) => domains.task.service.updateFromSync(id, data),
      deleteFromSync: (id: string) => domains.task.service.deleteFromSync(id),
      getRepo: () => domains.task.service.getRepo(),
      repository: domains.task.repository, // For compatibility
      
      // New clearer method names for regular operations with sync tracking
      createWithProcessing: (data: any) => domains.task.service.createWithProcessing(data),
      updateWithProcessing: (id: string, data: any) => domains.task.service.updateWithProcessing(id, data),
      deleteWithProcessing: (id: string) => domains.task.service.deleteWithProcessing(id),
      
      // Old confusing method names (deprecated but maintained for compatibility)
      createFromSyncWithProcessing: (data: any) => domains.task.service.createFromSyncWithProcessing(data),
      updateFromSyncWithProcessing: (id: string, data: any) => domains.task.service.updateFromSyncWithProcessing(id, data),
      deleteFromSyncWithProcessing: (id: string) => domains.task.service.deleteFromSyncWithProcessing(id),
    } as SyncServiceAdapter,
    
    comments: {
      createFromSync: (data: any) => domains.comment.service.createFromSync(data),
      updateFromSync: (id: string, data: any) => domains.comment.service.updateFromSync(id, data),
      deleteFromSync: (id: string) => domains.comment.service.deleteFromSync(id),
      getRepo: () => domains.comment.service.getRepo(),
      repository: domains.comment.repository, // For compatibility with CommentSyncAdapter
      
      // New clearer method names for regular operations with sync tracking
      createWithProcessing: (data: any) => domains.comment.service.createWithProcessing(data),
      updateWithProcessing: (id: string, data: any) => domains.comment.service.updateWithProcessing(id, data),
      deleteWithProcessing: (id: string) => domains.comment.service.deleteWithProcessing(id),
      
      // Old confusing method names (deprecated but maintained for compatibility)
      createFromSyncWithProcessing: (data: any) => domains.comment.service.createFromSyncWithProcessing(data),
      updateFromSyncWithProcessing: (id: string, data: any) => domains.comment.service.updateFromSyncWithProcessing(id, data),
      deleteFromSyncWithProcessing: (id: string) => domains.comment.service.deleteFromSyncWithProcessing(id),
    } as SyncServiceAdapter,
  };
}

// Legacy compatibility exports (for gradual migration)
export function createRepositories(dataSource: NewPGliteDataSource) {
  if (!dataSource.isInitialized) {
    throw new Error('DataSource must be initialized before creating repositories');
  }
  
  console.warn('[DomainFactory] DEPRECATED: createRepositories() called - this creates domains with null syncManager!');
  console.warn('[DomainFactory] This is a legacy function that should not be used for services that need sync tracking.');
  console.warn('[DomainFactory] Use createServices() instead for proper sync integration.');
  
  // Create a dummy syncManager for repository-only usage
  const dummySyncManager = {
    trackChange: () => {
      console.warn('[DomainFactory] Dummy syncManager.trackChange() called - sync tracking disabled for legacy repositories');
      return Promise.resolve();
    }
  } as any;
  
  const domains = createAllDomains(dataSource, dummySyncManager);
  return {
    users: domains.user.repository,
    comments: domains.comment.repository,
    tasks: domains.task.repository,
    projects: domains.project.repository,
  };
}

/**
 * Creates domain-based services for sync adapters
 * This replaces the deprecated createServices from db/services.ts
 */
export function createServices(dataSource: NewPGliteDataSource, outgoingChangeService: OutgoingChangeService) {
  console.log('[DomainFactory] Creating domain-based services for sync adapters');
  
  // Create all domain modules
  const domains = createAllDomains(dataSource, outgoingChangeService);
  
  // Create sync-compatible service adapters
  const syncServices = createSyncServiceAdapters(domains);
  
  console.log('[DomainFactory] Successfully created domain-based sync services');
  return syncServices;
} 