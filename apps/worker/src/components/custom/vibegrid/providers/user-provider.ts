import type { RelationshipOptionsProvider, RelationshipContext } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/providers/user-provider.ts');

/**
 * @deprecated This atom-based provider is deprecated.
 * VibeGrid now uses Dexie-based providers configured in useDexieEntityConfig.
 * 
 * User Provider
 * 
 * Provides all users as options for assignment
 * Sorted by displayName/name
 */
export const userProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  log.warn('⚠️ DEPRECATED: Atom-based user provider called. VibeGrid uses Dexie providers.');
  return [];
};