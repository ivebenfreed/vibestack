/**
 * Tag Filter Helpers
 * 
 * Reusable filter functions for tag columns across different entity types
 */

import { domainServices } from '../index';

/**
 * Creates a relationship filter for tags based on entity type
 * @param entityType - The entity type (e.g., 'task', 'project', 'user')
 * @returns A filter function that returns appropriate tag IDs
 */
export function createEntityTagFilter(entityType: string) {
  return async () => {
    const tags = await domainServices.tag.getTagsForEntityType(entityType);
    return tags.map(tag => tag.id);
  };
}

/**
 * Creates a relationship filter for tags based on specific tag set name
 * @param tagSetName - The exact tag set name
 * @returns A filter function that returns tag IDs from that set
 */
export function createTagSetFilter(tagSetName: string) {
  return async () => {
    const tagSet = await domainServices.tagSet.getTagSetByName(tagSetName);
    if (!tagSet) {
      console.warn(`TagSetFilter: Tag set '${tagSetName}' not found`);
      return [];
    }
    const tags = await domainServices.tag.getTagsByTagSet(tagSet.id);
    return tags.map(tag => tag.id);
  };
}

/**
 * Creates a relationship filter for tags based on tag category
 * @param category - The tag category (e.g., 'priority', 'type', 'component')
 * @returns A filter function that returns tag IDs from that category
 */
export function createCategoryTagFilter(category: string) {
  return async () => {
    const tagSets = await domainServices.tagSet.getActiveTagSets();
    const matchingTagSets = tagSets.filter(ts => ts.category === category);
    
    if (matchingTagSets.length === 0) {
      console.warn(`CategoryTagFilter: No tag sets found for category '${category}'`);
      return [];
    }
    
    const tagSetIds = matchingTagSets.map(ts => ts.id);
    const allTags = await domainServices.tag.getAllTags();
    const filteredTags = allTags.filter(tag => tagSetIds.includes(tag.tagSetId));
    
    return filteredTags.map(tag => tag.id);
  };
}