import { createFileRoute } from '@tanstack/react-router';
import { VibeGridX } from '@/components/custom/vibegridx';
import { tasksAtom } from '@/domain/task';
import { projectsAtom } from '@/domain/project'; 
import { usersAtom } from '@/domain/user';
import type { Column } from '@/components/custom/vibegridx';
import type { Task } from '@repo/dataforge/client-entities';
import { TaskColumns } from '@repo/dataforge/vibegridx-columns';
import { createOptimizedLoader } from '@/domain/ensure-loaded';
import { syncProcessView } from '@/components/custom/vibegridx/utils/syncViewProcessor';
import type { ViewActorInput } from '@/components/custom/vibegridx/machines/view-actor';

// Enhanced loader that processes data synchronously
async function vibegridxDemoLoader() {
  const startTime = performance.now();
  console.log('🚀 Route Loader: Starting synchronous data processing');
  
  // 1. Load entities using the optimized loader
  await createOptimizedLoader(['tasks', 'projects', 'users'])();
  
  // 2. Get entities from atoms (synchronously)
  const tasks = Object.values(tasksAtom.get() || {});
  const projects = projectsAtom.get() || {};
  const users = usersAtom.get() || {};
  
  // 3. Load persisted view state from localStorage
  const tableId = 'vibegridx-demo-v2';
  const persistenceKey = `vibegridx-${tableId}-state`;
  let persistedViewState = null;
  
  try {
    const stored = localStorage.getItem(persistenceKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      persistedViewState = parsed.context;
      console.log('🚀 Route Loader: Found persisted state', {
        hasColumnWidths: !!persistedViewState?.columnWidths,
        hasSortBy: !!persistedViewState?.sortBy,
        hasFilters: !!persistedViewState?.filters
      });
    }
  } catch (error) {
    console.warn('Route Loader: Failed to load persisted state', error);
  }
  
  // 4. Create relationship resolvers
  const relationshipResolvers: Record<string, (id: string | string[]) => string> = {
    project: (id: string | string[]) => {
      if (Array.isArray(id)) {
        return id.map(i => projects[i]?.name || i).join(', ');
      }
      return projects[id]?.name || id;
    },
    assignee: (id: string | string[]) => {
      if (Array.isArray(id)) {
        return id.map(i => users[i]?.displayName || users[i]?.name || i).join(', ');
      }
      return users[id]?.displayName || users[id]?.name || id;
    }
  };
  
  // 5. Process view data synchronously
  const selectedColumnIds = [
    'title',
    'status', 
    'priority',
    'description',
    'project',
    'assignee',
    'dueDate',
    'createdAt',
    'updatedAt'
  ];
  
  const taskColumns: Column<Task>[] = TaskColumns
    .filter(col => selectedColumnIds.includes(col.id))
    .map(col => ({
      id: col.id,
      name: col.name,
      field: col.field,
      type: col.type,
      width: col.width,
      editable: col.editable,
      minWidth: col.minWidth,
      maxWidth: col.maxWidth,
      resizable: col.resizable,
      sortable: col.sortable,
      filterable: col.filterable,
      ...(col.options && { options: col.options }),
      ...(col.cellType && { cellType: col.cellType }),
      ...(col.relationshipTable && { relationshipTable: col.relationshipTable }),
      ...(col.relationshipDisplayField && { relationshipDisplayField: col.relationshipDisplayField }),
      ...(col.enumOptions && { enumOptions: col.enumOptions }),
      ...(col.placeholder && { placeholder: col.placeholder }),
      ...(col.dateFormat && { dateFormat: col.dateFormat }),
      ...(col.maxLength && { maxLength: col.maxLength }),
      ...(col.required && { required: col.required }),
      ...(col.meta && { metadata: col.meta })
    }));
  
  const viewActorInput: ViewActorInput = {
    entities: tasks,
    columns: taskColumns,
    relationshipResolvers,
    enableSelectionColumn: true,
    sortBy: persistedViewState?.sortBy || [],
    filters: persistedViewState?.filters || [],
    groupBy: persistedViewState?.groupBy || [],
    columnVisibility: persistedViewState?.columnVisibility || {},
    columnOrder: persistedViewState?.columnOrder || [],
    columnWidths: persistedViewState?.columnWidths
  };
  
  // Process data synchronously
  const processedData = syncProcessView(viewActorInput);
  
  const loadTime = performance.now() - startTime;
  console.log(`🚀 Route Loader: Completed in ${loadTime.toFixed(2)}ms`, {
    taskCount: tasks.length,
    processedRowCount: processedData.processedRows.length,
    visibleColumnCount: processedData.visibleColumns.length
  });
  
  return {
    tableId,
    initialData: processedData,
    persistedViewState,
    taskColumns
  };
}

export const Route = createFileRoute('/_authenticated/debug/vibegridx-demo')({
  loader: vibegridxDemoLoader,
  component: VibeGridXDemoPage,
});


// ====================================
// DEMO COMPONENT
// ====================================

function VibeGridXDemoPage() {
  // Get pre-processed data from route loader
  const { tableId, initialData, persistedViewState, taskColumns } = Route.useLoaderData();
  
  // ====================================
  // RENDER
  // ====================================
  
  return (
    <div className="h-screen flex flex-col p-4">
      {/* Simple header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">VibeGridX Demo - Simplified Entity-Based Usage</h1>
        <p className="text-gray-600 mt-2">
          Using entityType="task" with auto-configuration from DataForge
        </p>
      </div>
      
      {/* Full height table - Now using simplified entity-based configuration */}
      <div className="flex-1 overflow-hidden">
        <VibeGridX<Task>
          entityType="task"
          tableId={tableId}
          selectedColumns={[
            'title',
            'status', 
            'priority',
            'description',
            'project',
            'assignee',
            'dueDate',
            'createdAt',
            'updatedAt'
          ]}
          height="100%"
          initialData={initialData}
          enableVirtualScrolling={true}
          enableCanvasOverlays={true}
          enableGrouping={true}
          enableFiltering={true}
          enableSorting={true}
          enableDragAndDrop={true}
          enableSelectionColumn={true}
          bufferSize={10}
        />
      </div>
    </div>
  );
}