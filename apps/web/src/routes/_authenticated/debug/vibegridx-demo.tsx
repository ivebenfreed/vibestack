import { createFileRoute } from '@tanstack/react-router';
import { VibeGridX } from '@/components/custom/vibegridx';
import type { Task } from '@repo/dataforge/client-entities';
import { createOptimizedLoader } from '@/domain/ensure-loaded';

// Enhanced loader that processes data synchronously
async function vibegridxDemoLoader() {
  const startTime = performance.now();
  console.log('🚀 Route Loader: Starting synchronous data processing');
  
  // 1. Load entities using the optimized loader
  await createOptimizedLoader(['task', 'project', 'user', 'comment', 'statusDefinition', 'statusSet', 'tag', 'tagSet'])();
  
  // 2. Load persisted view state from localStorage
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
  
  const loadTime = performance.now() - startTime;
  console.log(`🚀 Route Loader: Completed in ${loadTime.toFixed(2)}ms`);
  
  return {
    tableId,
    persistedViewState
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
  const { tableId, persistedViewState } = Route.useLoaderData();
  
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
            'priority',
            'status',
            'description',
            'project',
            'assignee',
            'dueDate',
            'createdAt',
            'updatedAt'
          ]}
          height="100%"
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