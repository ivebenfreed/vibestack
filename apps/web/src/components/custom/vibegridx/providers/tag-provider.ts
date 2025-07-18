import type { RelationshipOptionsProvider, RelationshipContext } from '../types';

/**
 * Tag Provider
 * 
 * Filters Tag options based on:
 * - Associated TagSets for the current project (if available)
 * - Active tags only
 * - Sorted by sortOrder
 */
export const tagProvider: RelationshipOptionsProvider = async (context: RelationshipContext) => {
  const { atoms, currentEntity } = context;
  
  // Get tags and tag sets from atoms
  const tags = atoms.tags?.get() || {};
  const tagSets = atoms.tagSets?.get() || {};
  const projects = atoms.projects?.get() || {};
  
  // Get available tag sets (either from current project or all active ones)
  let availableTagSets: any[] = [];
  
  if (currentEntity?.projectId && projects[currentEntity.projectId]) {
    // If we have a project context, use its tag sets
    const project = projects[currentEntity.projectId];
    // Note: This would need to be implemented based on project-tagset relationship
    // For now, fall back to all active tag sets
    availableTagSets = Object.values(tagSets).filter((set: any) => set.isActive);
  } else {
    // Use all active tag sets
    availableTagSets = Object.values(tagSets).filter((set: any) => set.isActive);
  }
  
  const availableTagSetIds = availableTagSets.map(set => set.id);
  
  // Filter tags by available tag sets
  const filteredTags = Object.values(tags)
    .filter((tag: any) => 
      availableTagSetIds.includes(tag.tagSetId) && 
      tag.isActive
    )
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  
  // Convert to EnumOption format
  return filteredTags.map((tag: any) => ({
    value: tag.id,
    label: tag.name,
    color: tag.color,
    icon: tag.icon,
    description: tag.metadata?.description,
    group: tagSets[tag.tagSetId]?.name // Group by tag set
  }));
};