# VibeGridDex Usage Guide

## Required: Route Loader Pattern

All routes using VibeGridDex MUST implement a loader that pre-processes data for optimal performance. This is not optional.

### Example Implementation

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { db } from '@repo/dataforge/dexie-schema';
import { syncProcessView } from '@/components/custom/vibegriddex/utils/syncViewProcessor';

export const Route = createFileRoute('/your-route')({
  loader: async () => {
    // Load all data in parallel
    const [tasks, users, projects, statusDefinitions] = await Promise.all([
      db.tasks.toArray(),
      db.users.toArray(),
      db.projects.toArray(),
      db.status_definitions.toArray()
    ]);
    
    // Build relationship data map
    const relationshipData = {
      users: users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}),
      projects: projects.reduce((acc, project) => ({ ...acc, [project.id]: project }), {}),
      status_definitions: statusDefinitions.reduce((acc, status) => ({ ...acc, [status.id]: status }), {})
    };
    
    // Create relationship resolvers
    const relationshipResolvers = {
      assignee: (id: string) => relationshipData.users[id]?.name || id,
      project: (id: string) => relationshipData.projects[id]?.name || id,
      status: (id: string) => relationshipData.status_definitions[id]?.name || id
    };
    
    // Process the view data
    const columns = getColumns(); // Your column definitions
    const processedData = syncProcessView({
      entities: tasks,
      columns,
      relationshipResolvers,
      sortBy: [],
      filters: [],
      groupBy: [],
      columnWidths: {},
      columnVisibility: {},
      columnOrder: [],
      enableSelectionColumn: true,
      rowHeight: 40
    });
    
    return {
      initialData: {
        processedRows: processedData.processedRows,
        visibleColumns: processedData.visibleColumns,
        coordinateMapping: processedData.coordinateMapping
      }
    };
  },
  component: YourComponent
});
```

### Component Usage

```typescript
function YourComponent() {
  const { initialData } = Route.useLoaderData();
  
  return (
    <VibeGridDex
      tableId="unique-table-id"
      entityType="task"
      columns={columns}
      initialData={initialData}
      height={600}
    />
  );
}
```

## Architecture Benefits

1. **Instant rendering** - Pre-processed data displays immediately
2. **No relationship resolution delays** - All relationships pre-resolved in loader
3. **Optimal performance** - No "Loading..." placeholders or resolver warnings
4. **Live updates** - XState subscriptions handle all updates after initial render

## Important Notes

- The loader pattern is REQUIRED for all VibeGridDex usage
- Initial data is pre-resolved, subsequent updates use XState subscriptions
- This eliminates all relationship resolver warnings
- Provides the best user experience with instant data display