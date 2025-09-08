/**
 * Test page for VibeGridPure with pure observables architecture
 * This demonstrates the complete XState replacement
 */

import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { VibeGridPure } from '@/components/custom/vibegrid/VibeGridPure';
import { uiLog } from '@/logger';

const log = uiLog('routes/test-vibegrid-pure');

export const Route = createFileRoute('/_authenticated/debug/test-vibegrid-pure')({
  component: TestVibeGridPure,
});

function TestVibeGridPure() {
  // Use hardcoded orgId for testing (Wide Corp)
  const orgId = '01920000-1000-7000-8000-000000000001';
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);

  // Define columns for Task entity
  const columns = [
    { id: 'id', label: 'ID', width: 300 },
    { id: 'title', label: 'Title', width: 200 },
    { id: 'description', label: 'Description', width: 250 },
    { id: 'priority', label: 'Priority', width: 100, type: 'select' },
    { id: 'status', label: 'Status', width: 120, type: 'select' },
    { id: 'due_date', label: 'Due Date', width: 150, type: 'date' },
    { id: 'estimated_hours', label: 'Est Hours', width: 100, type: 'number' },
    { id: 'actual_hours', label: 'Act Hours', width: 100, type: 'number' },
    { id: 'task_type', label: 'Type', width: 120, type: 'select' },
    { id: 'story_points', label: 'Points', width: 80, type: 'number' },
    { id: 'created_at', label: 'Created', width: 180, type: 'datetime' },
    { id: 'updated_at', label: 'Updated', width: 180, type: 'datetime' },
  ];

  const handleSelectionChange = (cells: Set<string>) => {
    log.info('Selection changed', { cellCount: cells.size });
    setSelectedCells(cells);
  };

  const handleEditingChange = (cell: { rowId: string; columnId: string } | null) => {
    log.info('Editing changed', { cell });
    setEditingCell(cell);
  };

  const handleEntityUpdate = async (rowId: string, updates: Record<string, any>) => {
    log.info('Entity update requested', { rowId, updates });
    // In a real app, this would call the entity update service
  };

  const handleBatchEntityUpdate = async (updates: Array<{ id: string; updates: Record<string, any> }>) => {
    log.info('Batch entity update requested', { updateCount: updates.length });
    // In a real app, this would call the batch entity update service
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h1 className="text-2xl font-bold">VibeGridPure Test</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Testing pure observable architecture with Task entity (XState-free)
        </p>
        
        {/* Status indicators */}
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div className="bg-blue-50 p-3 rounded">
            <div className="font-medium text-blue-900">Selected Cells</div>
            <div className="text-blue-700">
              {selectedCells.size} cell{selectedCells.size !== 1 ? 's' : ''} selected
            </div>
          </div>
          
          <div className="bg-green-50 p-3 rounded">
            <div className="font-medium text-green-900">Editing</div>
            <div className="text-green-700">
              {editingCell ? `${editingCell.rowId}:${editingCell.columnId}` : 'None'}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-4">
        <div className="border rounded-lg bg-white" style={{ height: '500px' }}>
          <VibeGridPure
            tableId="test-pure-vibegrid"
            entityType={`${orgId}_Task`}
            columns={columns}
            height="100%"
            width="100%"
            enableVirtualScrolling={true}
            enableGrouping={true}
            enableFiltering={true}
            enableSorting={true}
            enableDragAndDrop={true}
            enableSelectionColumn={true}
            onSelectionChange={handleSelectionChange}
            onEditingChange={handleEditingChange}
            onEntityUpdate={handleEntityUpdate}
            onBatchEntityUpdate={handleBatchEntityUpdate}
          />
        </div>
      </div>

      <div className="p-4 border-t bg-muted/50">
        <div className="text-sm space-y-1">
          <p><strong>🎯 Architecture Comparison:</strong></p>
          <div className="grid grid-cols-2 gap-4 mt-2">
            <div className="bg-red-50 p-3 rounded">
              <div className="font-medium text-red-900">❌ OLD: XState Architecture</div>
              <ul className="text-red-700 text-xs mt-1 space-y-1">
                <li>• 1500+ lines of state machine code</li>
                <li>• Multiple actors and complex coordination</li>
                <li>• Window bridge functions</li>
                <li>• Full re-renders on state changes</li>
                <li>• Event mapping through multiple layers</li>
              </ul>
            </div>
            
            <div className="bg-green-50 p-3 rounded">
              <div className="font-medium text-green-900">✅ NEW: Pure Observable Architecture</div>
              <ul className="text-green-700 text-xs mt-1 space-y-1">
                <li>• ~600 lines of observable code</li>
                <li>• Direct DOM → Observable → Render</li>
                <li>• No bridge functions needed</li>
                <li>• Granular DOM updates only</li>
                <li>• Single event flow</li>
              </ul>
            </div>
          </div>
          
          <p className="mt-3"><strong>🚀 Performance Targets:</strong></p>
          <ul className="text-xs mt-1 space-y-1">
            <li>• Scroll Performance: 60 FPS with 10,000 rows</li>
            <li>• Selection Speed: &lt; 16ms to update selection state</li>
            <li>• Sort/Filter: &lt; 100ms for 10,000 rows</li>
            <li>• Memory Usage: &lt; 50MB for 10,000 rows</li>
          </ul>
        </div>
      </div>
    </div>
  );
}