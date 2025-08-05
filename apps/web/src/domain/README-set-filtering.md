# Set-Filtered Relationship Resolvers

This document explains how the special set-filtered resolvers work for StatusDefinitions and Tags.

## Overview

The Dexie domain services include special filtering logic for:
- **StatusDefinitions** - filtered by entity type (e.g., 'task', 'project')
- **Tags** - filtered by project context

## Generated Convenience Methods

The enhanced generator now creates these convenience methods automatically:

### StatusDefinition Service:
- `getStatusDefinitionsForEntityType(entityType)` - Get all status definitions for an entity type

### Tag Service:
- `getTagsForProject(projectId)` - Get all tags available for a project
- `getTagsByTagSet(tagSetId)` - Get all tags in a specific tag set

### TagSet Service:
- `getTagSetsForProject(projectId)` - Get all tag sets associated with a project

## StatusDefinition Filtering

StatusDefinitions are grouped into StatusSets, and each StatusSet is associated with a specific entity type.

### Example Usage:

```typescript
import { domainServices } from '@/domain';

// Get available status sets for tasks
const taskStatusSets = await domainServices.statusDefinition.getStatusSetsForEntityType('task');

// Get available status sets for projects
const projectStatusSets = await domainServices.statusDefinition.getStatusSetsForEntityType('project');

// Get all status definitions for tasks
const taskStatuses = await domainServices.statusDefinition.getStatusDefinitionsForEntityType('task');

// Using context object
const statusSets = await domainServices.statusDefinition.getAvailableStatusSets({
  entityType: 'task',
  // Could include other context like userId, etc.
});
```

## Tag Filtering

Tags are grouped into TagSets, and TagSets can be associated with specific projects.

### Example Usage:

```typescript
import { domainServices } from '@/domain';

// Get available tag sets for a specific project
const projectTagSets = await domainServices.tag.getTagSetsForProject('project-123');

// Get all active tag sets (no project filter)
const allActiveTagSets = await domainServices.tag.getActiveTagSets();

// Get all tags available for a project
const projectTags = await domainServices.tag.getTagsForProject('project-123');

// Using context object
const tagSets = await domainServices.tag.getAvailableTagSets({
  projectId: 'project-123',
  // Could include other context like userId, etc.
});
```

## Integration with VibeGridDex

When using these filtered relationships in VibeGridDex, you can pass the context to the relationship providers:

```typescript
// In a component using VibeGridDex
const statusContext = {
  entityType: 'task' // Filter status definitions to only show task statuses
};

const tagContext = {
  projectId: currentProjectId // Filter tags to only show project-specific tags
};

// Pass these contexts to your grid configuration
```

## Database Schema

The filtering works through these junction tables:
- `project_tag_sets` - Links projects to tag sets
- StatusSets have an `entityType` field directly

### StatusSet Schema:
```typescript
interface StatusSet {
  id: string;
  name: string;
  entityType: string; // 'task', 'project', etc.
  isActive: boolean;
  // ...
}
```

### Tag/Project Association:
```typescript
interface ProjectTagSets {
  projectId: string;
  tagSetId: string;
}
```

## Benefits

1. **Context-Aware Filtering**: Only show relevant options based on current context
2. **Type Safety**: Full TypeScript support for context objects
3. **Performance**: Efficient database queries with proper indexing
4. **Flexibility**: Easy to extend with additional context parameters