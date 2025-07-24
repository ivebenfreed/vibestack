/**
 * Optimized ensureLoaded utilities for domain atoms
 * 
 * These functions provide direct, performant ways to ensure atoms are loaded
 * from the database, with minimal overhead and maximum parallelization.
 */

// import { getGlobalDataSource } from '@/db/global-datasource'; // DISABLED - TypeORM removal
import { DOMAIN_REGISTRY, getDomainAtom, type DomainKey } from './registry';

// ⚡ PERFORMANCE: Cached loaded state to avoid expensive atom reads
const _domainLoadedState = new Map<DomainKey, boolean>();

// Helper to check if a domain is loaded
function isDomainLoaded(domainKey: DomainKey): boolean {
  if (_domainLoadedState.has(domainKey)) {
    return _domainLoadedState.get(domainKey)!;
  }
  
  const atom = getDomainAtom(domainKey);
  if (!atom) {
    _domainLoadedState.set(domainKey, false);
    return false;
  }
  
  const isLoaded = Object.keys(atom.get()).length > 0;
  _domainLoadedState.set(domainKey, isLoaded);
  return isLoaded;
}

// Check functions - using dynamic domain registry
export const areTasksLoaded = () => isDomainLoaded('task');
export const areProjectsLoaded = () => isDomainLoaded('project');
export const areUsersLoaded = () => isDomainLoaded('user');
export const areCommentsLoaded = () => isDomainLoaded('comment');

// Check all domains dynamically
export const areAllDomainsLoaded = () => {
  const allDomainKeys = Object.keys(DOMAIN_REGISTRY) as DomainKey[];
  return allDomainKeys.every(domainKey => isDomainLoaded(domainKey));
};

/**
 * Helper to create optimized loaders that skip when data is already loaded
 * Usage: createOptimizedLoader(['task', 'project'])
 */
export function createOptimizedLoader(domains: DomainKey[]) {
  return async () => {
    // Check if all requested domains are loaded
    const allLoaded = domains.every(domain => isDomainLoaded(domain));
    if (allLoaded) {
      return;
    }
    
    // Load only the domains that aren't loaded yet
    const loadPromises = domains
      .filter(domain => !isDomainLoaded(domain))
      .map(domain => ensureDomainLoaded(domain));
    
    if (loadPromises.length > 0) {
      await Promise.all(loadPromises);
    }
  };
}

/**
 * Generic function to ensure a domain is loaded
 */
async function ensureDomainLoaded(domainKey: DomainKey): Promise<void> {
  // Check if already loaded
  if (isDomainLoaded(domainKey)) {
    return;
  }
  
  const domain = DOMAIN_REGISTRY[domainKey];
  if (!domain) {
    console.warn(`Domain ${domainKey} not found in registry`);
    return;
  }
  
  // Get the utils object that should have ensureLoaded
  const utilsName = `${domainKey}Utils`;
  const utils = (domain as any)[utilsName];
  
  if (utils?.ensureLoaded) {
    await utils.ensureLoaded();
    _domainLoadedState.set(domainKey, true);
  } else {
    console.warn(`No ensureLoaded function found for domain ${domainKey}`);
  }
}

/**
 * Load all domains in parallel - maximum performance
 * Completely bypasses async operations if all data is already loaded
 */
export async function ensureAllDomainsLoaded(): Promise<void> {
  // Fast path - if everything is loaded, return immediately (no async overhead)
  if (areAllDomainsLoaded()) {
    return;
  }
  
  // Load all domains that aren't loaded yet
  const allDomainKeys = Object.keys(DOMAIN_REGISTRY) as DomainKey[];
  const loadPromises = allDomainKeys
    .filter(domainKey => !isDomainLoaded(domainKey))
    .map(domainKey => ensureDomainLoaded(domainKey));
  
  if (loadPromises.length > 0) {
    await Promise.all(loadPromises);
  }
}