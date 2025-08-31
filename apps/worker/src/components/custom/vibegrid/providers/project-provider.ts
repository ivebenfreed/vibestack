import type { RelationshipOptionsProvider, RelationshipContext } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/providers/project-provider.ts');

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGrid now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * Project Provider
 * 
 * Provides all active projects as options
 * Sorted by name
 */
export const projectProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  log.warn('⚠️ DEPRECATED: Atom-based project provider called. VibeGrid uses Dexie providers.');
  return [];
};