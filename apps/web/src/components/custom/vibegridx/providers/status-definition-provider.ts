import type { RelationshipOptionsProvider, RelationshipContext } from '../types';
import type { StatusDefinition } from '@repo/dataforge/client-entities';

/**
 * Status Definition Provider
 * 
 * Filters StatusDefinition options based on:
 * - StatusSet with entityType 'task' 
 * - Active status definitions only
 * - Sorted by sortOrder
 */
export const statusDefinitionProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  const { atoms, currentEntity } = context;
  
  // Get status definitions and status sets from atoms
  const statusDefinitions = atoms.statusDefinitions?.get() || {};
  const statusSets = atoms.statusSets?.get() || {};
  
  // Find the appropriate status set for tasks
  const taskStatusSet = Object.values(statusSets).find((set: any) => 
    set.entityType === 'task' && set.isActive
  );
  
  if (!taskStatusSet) {
    console.warn('No active task status set found');
    return [];
  }
  
  // Filter status definitions by the task status set
  const filteredStatusDefinitions = Object.values(statusDefinitions)
    .filter((status: any) => 
      status.statusSetId === taskStatusSet.id && 
      status.isActive
    )
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  
  // Convert to EnumOption format
  return filteredStatusDefinitions.map((status: any) => ({
    value: status.id,
    label: status.label,
    color: status.color,
    icon: status.icon,
    description: status.metadata?.description
  }));
};