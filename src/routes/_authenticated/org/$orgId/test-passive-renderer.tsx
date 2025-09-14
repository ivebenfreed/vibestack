/**
 * Test page for PassiveTableRenderer with pure observables
 * This allows us to test the new architecture alongside the existing implementation
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { getEntity$ } from '@/legend-state/observables';
import { SimplePassiveRenderer } from '@/components/custom/vibegrid/renderers/core/SimplePassiveRenderer';
import { createPureObservables } from '@/components/custom/vibegrid/stores/pure-observables';
import { createEntityColumnsObservable } from '@/legend-state';
import { log } from '@/logger';

const fileLog = log('routes/test-passive-renderer');

export const Route = createFileRoute('/_authenticated/org/$orgId/test-passive-renderer')({
  component: TestPassiveRenderer,
});

function TestPassiveRenderer() {
  const { orgId } = Route.useParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<SimplePassiveRenderer | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    try {
      fileLog.info('🧪 Initializing PassiveTableRenderer test', { orgId });

      // Get columns from schema - no hardcoding!
      const columnsObservable = createEntityColumnsObservable('Task');
      const columns = columnsObservable.get();
      
      if (!columns || columns.length === 0) {
        throw new Error('No columns available for Task entity - schema may not be loaded yet');
      }
      
      fileLog.info('🧪 Using schema-driven columns', { 
        columnCount: columns.length,
        columnIds: columns.map(c => c.id),
        referenceFields: columns.filter(c => c.referenceType).map(c => ({ id: c.id, type: c.referenceType }))
      });

      // Create the three-layer observables
      const entityType = `${orgId}_Task`;
      const { tableCore$, tableInteraction$, tableViewport$ } = createPureObservables(
        entityType,
        columns
      );

      fileLog.info('🧪 Created pure observables', { entityType });

      // Create the SimplePassiveRenderer
      const renderer = new SimplePassiveRenderer({
        container: containerRef.current,
        tableCore$,
        tableInteraction$,
        tableViewport$,
      });

      rendererRef.current = renderer;
      setIsInitialized(true);
      setError(null);

      fileLog.info('🧪 SimplePassiveRenderer initialized successfully');

      // Test interactions
      setTimeout(() => {
        fileLog.info('🧪 Testing observable methods');
        
        // Test sorting
        tableCore$.toggleSort('priority');
        
        // Test filtering
        tableCore$.setFilter('status', 'todo', 'equals');
        
        // Update viewport
        tableViewport$.updateViewport(
          containerRef.current?.clientWidth || 800,
          containerRef.current?.clientHeight || 600
        );
      }, 1000);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      fileLog.error('🧪 Failed to initialize PassiveTableRenderer', err);
      setError(errorMsg);
    }

    // Cleanup
    return () => {
      if (rendererRef.current) {
        fileLog.info('🧪 Cleaning up SimplePassiveRenderer');
        rendererRef.current.destroy();
        rendererRef.current = null;
      }
    };
  }, [orgId]);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">SimplePassiveRenderer Test</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Testing pure observable architecture with Task entity
        </p>
        {error && (
          <div className="mt-2 p-2 bg-red-100 text-red-700 rounded">
            Error: {error}
          </div>
        )}
        {isInitialized && !error && (
          <div className="mt-2 p-2 bg-green-100 text-green-700 rounded">
            ✅ SimplePassiveRenderer initialized successfully
          </div>
        )}
      </div>
      
      <div className="flex-1 p-4">
        <div className="border rounded-lg h-full bg-white">
          <div 
            ref={containerRef}
            className="h-full w-full relative"
            style={{ minHeight: '600px' }}
          />
        </div>
      </div>

      <div className="p-4 border-t bg-muted/50">
        <div className="text-sm space-y-1">
          <p><strong>Architecture:</strong> Pure Observables (tableCore$, tableInteraction$, tableViewport$)</p>
          <p><strong>Renderer:</strong> SimplePassiveRenderer with granular observers</p>
          <p><strong>Columns:</strong> Schema-driven from universeSchema$ observable (no hardcoding)</p>
          <p><strong>Event Binding:</strong> Direct DOM → Observable methods</p>
          <p><strong>Overlays:</strong> 100% reused from existing implementation</p>
        </div>
      </div>
    </div>
  );
}