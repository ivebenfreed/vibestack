/**
 * Domain Index - Stub implementation for createAllDomains
 * 
 * This provides a minimal stub implementation of createAllDomains to maintain
 * backward compatibility while the codebase transitions to the new 3-path architecture.
 */

import { getNewPGliteDataSource } from '../db/newtypeorm/NewDataSource';

/**
 * Stub implementation of createAllDomains for backward compatibility
 * Returns mock domain objects that throw errors when used
 */
export function createAllDomains(dataSource: any, syncManager: any) {
  console.warn('[createAllDomains] Using stub implementation - domain services are deprecated');
  
  const stubService = {
    createFromSync: () => { throw new Error('Domain services are deprecated - use direct operations from @repo/dataforge'); },
    updateFromSync: () => { throw new Error('Domain services are deprecated - use direct operations from @repo/dataforge'); },
    deleteFromSync: () => { throw new Error('Domain services are deprecated - use direct operations from @repo/dataforge'); },
    bulkCreateFromSync: () => { throw new Error('Domain services are deprecated - use direct operations from @repo/dataforge'); }
  };
  
  const stubRepository = {
    findAll: () => { throw new Error('Domain repositories are deprecated - use direct operations from @repo/dataforge'); },
    findById: () => { throw new Error('Domain repositories are deprecated - use direct operations from @repo/dataforge'); }
  };
  
  return {
    task: { service: stubService, repository: stubRepository },
    project: { service: stubService, repository: stubRepository },
    user: { service: stubService, repository: stubRepository },
    comment: { service: stubService, repository: stubRepository }
  };
}

// Legacy exports for backward compatibility
export async function getDomains() {
  throw new Error('getDomains is deprecated - use atom actions and direct operations from @repo/dataforge');
}

export function resetDomains() {
  console.warn('[resetDomains] Deprecated function called');
}

export async function reinitializeDomainsWithSyncServices() {
  throw new Error('reinitializeDomainsWithSyncServices is deprecated');
}

export function domainsInitialized(): boolean {
  return true; // Always return true to avoid blocking
}