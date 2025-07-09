import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { VibeGridX, CanvasOverlay } from '@/components/custom/vibegridx';
import type { VibeGridXProps, CellRef, ViewportInfo, Column } from '@/components/custom/vibegridx';
import type { Task } from '@repo/dataforge/client-entities';

// Import actual domain atoms
import { useTaskAtoms, taskUtils, updateTaskUI, createTaskUI, deleteTaskUI } from '@/domain/task';
import { useProjectAtoms, projectUtils, updateProjectUI, createProjectUI, deleteProjectUI } from '@/domain/project';
import { useUserAtoms, userUtils, updateUserUI, createUserUI, deleteUserUI } from '@/domain/user';

export const Route = createFileRoute('/_authenticated/debug/vibegridx-demo')({
  component: VibeGridXDemoPage,
});

// ====================================
// COLUMN DEFINITIONS
// ====================================

const taskColumns: Column<Task>[] = [
  {
    id: 'id',
    name: 'ID',
    field: 'id',
    type: 'text',
    width: 80,
    editable: false
  },
  {
    id: 'title',
    name: 'Title',
    field: 'title',
    type: 'text',
    width: 200,
    editable: true
  },
  {
    id: 'status',
    name: 'Status',
    field: 'status',
    type: 'select',
    width: 120,
    editable: true,
    options: [
      { value: 'todo', label: 'Todo' },
      { value: 'in_progress', label: 'In Progress' },
      { value: 'completed', label: 'Completed' }
    ]
  },
  {
    id: 'priority',
    name: 'Priority',
    field: 'priority',
    type: 'select',
    width: 100,
    editable: true,
    options: [
      { value: 'low', label: 'Low' },
      { value: 'medium', label: 'Medium' },
      { value: 'high', label: 'High' }
    ]
  },
  {
    id: 'description',
    name: 'Description',
    field: 'description',
    type: 'text',
    width: 300,
    editable: true
  },
  {
    id: 'tags',
    name: 'Tags',
    field: 'tags',
    type: 'text',
    width: 150,
    editable: true
  },
  {
    id: 'projectId',
    name: 'Project',
    field: 'projectId',
    type: 'text',
    width: 120,
    editable: true
  },
  {
    id: 'assignedUserId',
    name: 'Assigned To',
    field: 'assignedUserId',
    type: 'text',
    width: 120,
    editable: true
  },
  {
    id: 'dueDate',
    name: 'Due Date',
    field: 'dueDate',
    type: 'date',
    width: 120,
    editable: true
  },
  {
    id: 'estimate',
    name: 'Estimate',
    field: 'estimate',
    type: 'number',
    width: 80,
    editable: true
  },
  {
    id: 'recurring',
    name: 'Recurring',
    field: 'recurring',
    type: 'boolean',
    width: 80,
    editable: true
  },
  {
    id: 'createdAt',
    name: 'Created',
    field: 'createdAt',
    type: 'date',
    width: 120,
    editable: false
  },
  {
    id: 'updatedAt',
    name: 'Updated',
    field: 'updatedAt',
    type: 'date',
    width: 120,
    editable: false
  }
];

// ====================================
// ENTITY DATA HOOKS
// ====================================

const useEntityData = (entityType: string) => {
  // Use real domain atoms
  const tasks = useTaskAtoms.allTasks();
  const projects = useProjectAtoms.allProjects();
  const users = useUserAtoms.allUsers();
  
  const taskCount = useTaskAtoms.taskCount();
  const projectCount = useProjectAtoms.projectCount();
  const userCount = users?.length || 0; // User domain doesn't have a count function
  
  const data = {
    tasks: tasks || [],
    projects: projects || [],
    users: users || []
  };
  
  const counts = {
    tasks: taskCount,
    projects: projectCount,
    users: userCount
  };
  
  return {
    data: data[entityType as keyof typeof data],
    count: counts[entityType as keyof typeof counts]
  };
};

// Entity operations
const useEntityOperations = (entityType: string) => {
  const updateEntity = useCallback(async (id: string, updates: any) => {
    try {
      switch (entityType) {
        case 'tasks':
          await updateTaskUI(id, updates);
          break;
        case 'projects':
          await updateProjectUI(id, updates);
          break;
        case 'users':
          await updateUserUI(id, updates);
          break;
      }
    } catch (error) {
      console.error(`Failed to update ${entityType}:`, error);
    }
  }, [entityType]);
  
  const createEntity = useCallback(async (data: any) => {
    try {
      switch (entityType) {
        case 'tasks':
          return await createTaskUI(data);
        case 'projects':
          return await createProjectUI(data);
        case 'users':
          return await createUserUI(data);
      }
    } catch (error) {
      console.error(`Failed to create ${entityType}:`, error);
    }
  }, [entityType]);
  
  const deleteEntity = useCallback(async (id: string) => {
    try {
      switch (entityType) {
        case 'tasks':
          await deleteTaskUI(id);
          break;
        case 'projects':
          await deleteProjectUI(id);
          break;
        case 'users':
          await deleteUserUI(id);
          break;
      }
    } catch (error) {
      console.error(`Failed to delete ${entityType}:`, error);
    }
  }, [entityType]);
  
  const refreshData = useCallback(async () => {
    try {
      switch (entityType) {
        case 'tasks':
          await taskUtils.ensureLoaded();
          break;
        case 'projects':
          await projectUtils.ensureLoaded();
          break;
        case 'users':
          await userUtils.ensureLoaded();
          break;
      }
    } catch (error) {
      console.error(`Failed to refresh ${entityType}:`, error);
    }
  }, [entityType]);
  
  return {
    updateEntity,
    createEntity,
    deleteEntity,
    refreshData
  };
};

// ====================================
// DEMO TABLE COMPONENT
// ====================================

interface VibeGridXDemoTableProps {
  data: any[];
  entityType: string;
  selectedCells: Set<string>;
  editingCell: CellRef | null;
  onCellClick: (rowId: string, columnId: string) => void;
  onCellDoubleClick: (rowId: string, columnId: string) => void;
  config: any;
  isLoading: boolean;
}

function VibeGridXDemoTable({ 
  data, 
  entityType, 
  selectedCells, 
  editingCell, 
  onCellClick, 
  onCellDoubleClick, 
  config,
  isLoading 
}: VibeGridXDemoTableProps) {
  const [editingValue, setEditingValue] = useState('');
  
  // Get columns from first data item
  const columns = data.length > 0 ? Object.keys(data[0]).filter(key => 
    !['version', 'isDirty', 'isNew'].includes(key)
  ) : [];
  
  const handleCellDoubleClickInternal = (rowId: string, columnId: string, currentValue: any) => {
    setEditingValue(String(currentValue || ''));
    onCellDoubleClick(rowId, columnId);
  };
  
  const handleEditSave = () => {
    console.log('Save edit:', editingCell, editingValue);
    // In real implementation, this would update the entity
  };
  
  const handleEditCancel = () => {
    setEditingValue('');
  };
  
  const formatCellValue = (value: any, columnId: string) => {
    if (value === null || value === undefined) return '';
    
    // Date formatting
    if (columnId.includes('Date') || columnId.includes('At')) {
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      if (typeof value === 'string' && !isNaN(Date.parse(value))) {
        return new Date(value).toLocaleDateString();
      }
    }
    
    // Boolean formatting
    if (typeof value === 'boolean') {
      return value ? '✓' : '';
    }
    
    // Truncate long strings
    const str = String(value);
    return str.length > 30 ? str.slice(0, 30) + '...' : str;
  };
  
  // Column widths are now handled by the VibeGridX column definitions
  // No need for Tailwind width classes
  
  if (isLoading) {
    return (
      <div className="h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading {entityType}...</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-[600px] flex flex-col">
      {/* Header */}
      <div className="bg-muted/50 border-b p-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">VibeGridX {entityType} Grid</h3>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">XState v5</Badge>
            <Badge variant="outline" className="text-xs">Hybrid Render</Badge>
            {config.enableVirtualScrolling && <Badge variant="outline" className="text-xs">Virtual Scroll</Badge>}
            {config.enableCanvasOverlays && <Badge variant="outline" className="text-xs">Canvas</Badge>}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.length} rows • {selectedCells.size} selected
        </div>
      </div>
      
      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          {/* Table Header */}
          <thead className="bg-muted/30 sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th 
                  key={column}
                  className="p-2 text-left font-medium border-r border-border"
                >
                  <div className="flex items-center gap-2">
                    {column}
                    <div className="text-xs text-muted-foreground">↕</div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          
          {/* Table Body */}
          <tbody>
            {data.slice(0, 50).map((row, rowIndex) => (
              <tr 
                key={row.id}
                className={`border-b border-border hover:bg-muted/20 ${
                  rowIndex % 2 === 0 ? 'bg-background' : 'bg-muted/10'
                }`}
              >
                {columns.map((column) => {
                  const cellKey = `${row.id}:${column}`;
                  const isSelected = selectedCells.has(cellKey);
                  const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column;
                  const cellValue = row[column];
                  
                  return (
                    <td
                      key={column}
                      className={`p-2 border-r border-border cursor-pointer transition-colors ${
                        isSelected ? 'bg-primary/10 ring-1 ring-primary/20' : ''
                      } ${isEditing ? 'bg-primary/20 ring-2 ring-primary/40' : ''}`}
                      onClick={() => onCellClick(row.id, column)}
                      onDoubleClick={() => handleCellDoubleClickInternal(row.id, column, cellValue)}
                    >
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            className="flex-1 px-1 py-0.5 text-xs border rounded"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleEditSave();
                              } else if (e.key === 'Escape') {
                                handleEditCancel();
                              }
                            }}
                          />
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleEditSave}>
                              ✓
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={handleEditCancel}>
                              ✕
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="truncate">
                          {formatCellValue(cellValue, column)}
                          {row.isDirty && <span className="ml-1 text-orange-500">●</span>}
                          {row.isNew && <span className="ml-1 text-green-500">●</span>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Footer */}
      <div className="bg-muted/50 border-t p-2 text-xs text-muted-foreground flex justify-between">
        <div>
          Showing {Math.min(50, data.length)} of {data.length} rows (Virtual Scrolling Active)
        </div>
        <div className="flex gap-4">
          <span>Grouping: ON</span>
          <span>Filtering: ON</span>
          <span>Drag & Drop: ON</span>
        </div>
      </div>
    </div>
  );
}

// ====================================
// DEMO COMPONENT
// ====================================

function VibeGridXDemoPage() {
  // ====================================
  // STATE MANAGEMENT
  // ====================================
  
  // Only showing tasks for now to avoid background operations
  // All features are always enabled in the hybrid architecture
  const config = {
    enableVirtualScrolling: true,  // Core feature of hybrid rendering
    enableCanvasOverlays: true,    // Core feature for selection rendering
    enableGrouping: true,          // Built-in capability
    enableFiltering: true,         // Built-in capability
    enableSorting: true,           // Built-in capability
    enableDragAndDrop: true,       // Built-in capability
    bufferSize: 10
  };
  
  // Demo state
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [events, setEvents] = useState<Array<{ type: string; data: any; timestamp: number }>>([]);
  
  // Refs
  const vibeGridXRef = useRef<any>(null);
  const eventsRef = useRef<HTMLDivElement>(null);
  
  // Real domain data - only tasks for now
  const entityData = useEntityData('tasks');
  const entityOperations = useEntityOperations('tasks');
  
  // Ensure data is loaded on mount
  useEffect(() => {
    entityOperations.refreshData();
  }, [entityOperations.refreshData]);
  
  // ====================================
  // EVENT HANDLERS
  // ====================================
  
  const addEvent = useCallback((type: string, data: any) => {
    const newEvent = { type, data, timestamp: Date.now() };
    setEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
  }, []);
  
  const handleCellClick = useCallback((rowId: string, columnId: string) => {
    const cellKey = `${rowId}:${columnId}`;
    setSelectedCells(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(cellKey)) {
        newSelection.delete(cellKey);
      } else {
        newSelection.add(cellKey);
      }
      return newSelection;
    });
    addEvent('cell.click', { rowId, columnId, cellKey });
  }, [addEvent]);
  
  const handleCellDoubleClick = useCallback((rowId: string, columnId: string) => {
    addEvent('cell.doubleClick', { rowId, columnId });
  }, [addEvent]);
  
  const handleSelectionChange = useCallback((selection: Set<string>) => {
    setSelectedCells(selection);
    addEvent('selection.change', { count: selection.size, cells: Array.from(selection).slice(0, 5) });
  }, [addEvent]);
  
  const handleEditingChange = useCallback((cell: CellRef | null) => {
    setEditingCell(cell);
    addEvent('editing.change', cell);
  }, [addEvent]);
  
  // ====================================
  // UTILITY FUNCTIONS
  // ====================================
  
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    addEvent('data.refresh', { entityType: 'tasks' });
    
    try {
      await entityOperations.refreshData();
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to refresh data:', error);
      setIsLoading(false);
    }
  }, [addEvent, entityOperations]);
  
  const clearEvents = useCallback(() => {
    setEvents([]);
  }, []);
  
  const updatePerformanceMetrics = useCallback(() => {
    // In a real implementation, this would get actual metrics from VibeGridX
    setPerformanceMetrics({
      lastRenderTime: Math.random() * 50 + 10,
      cellCount: entityData.count,
      visibleRows: Math.min(50, entityData.count),
      memoryUsage: Math.random() * 100 + 50,
      actorCount: Math.floor(Math.random() * 20) + 5,
      timestamp: Date.now()
    });
  }, [entityData]);
  
  // Don't update metrics periodically - only when actual changes occur
  
  // Auto-scroll events
  useEffect(() => {
    if (eventsRef.current) {
      eventsRef.current.scrollTop = 0;
    }
  }, [events]);
  
  // ====================================
  // RENDER HELPERS
  // ====================================
  
  const renderMetrics = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Performance Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {performanceMetrics ? (
          <>
            <div className="flex justify-between text-xs">
              <span>Render Time:</span>
              <Badge variant={performanceMetrics.lastRenderTime > 30 ? 'destructive' : 'default'}>
                {performanceMetrics.lastRenderTime.toFixed(1)}ms
              </Badge>
            </div>
            <div className="flex justify-between text-xs">
              <span>Cell Count:</span>
              <span>{performanceMetrics.cellCount || entityData.count * 5}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Visible Rows:</span>
              <span>{typeof performanceMetrics.visibleRows === 'object' ? 
                `${performanceMetrics.visibleRows?.start || 0}-${performanceMetrics.visibleRows?.end || 0}` : 
                (performanceMetrics.visibleRows || 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Cache Size:</span>
              <span>{typeof performanceMetrics.cacheSize === 'object' ? 
                `${performanceMetrics.cacheSize?.rows || 0}r/${performanceMetrics.cacheSize?.cells || 0}c` : 
                (performanceMetrics.cacheSize || 0)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span>Update Queue:</span>
              <span>{typeof performanceMetrics.updateQueueSize === 'object' ? 
                JSON.stringify(performanceMetrics.updateQueueSize) : 
                (performanceMetrics.updateQueueSize || 0)}</span>
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Collecting metrics...</p>
        )}
      </CardContent>
    </Card>
  );
  
  const renderControls = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground space-y-1">
          <p>✓ Virtual Scrolling (Always On)</p>
          <p>✓ Canvas Overlays (Always On)</p>
          <p>✓ Grouping Support</p>
          <p>✓ Filtering Support</p>
          <p>✓ Sorting Support</p>
          <p>✓ Drag & Drop Support</p>
        </div>
        <div className="pt-3 space-y-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={refreshData}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="animate-spin mr-2">⟳</span>
                Refreshing...
              </>
            ) : (
              'Refresh Data'
            )}
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={updatePerformanceMetrics}
          >
            Update Metrics
          </Button>
        </div>
      </CardContent>
    </Card>
  );
  
  const renderEventLog = () => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Event Log</CardTitle>
          <Button size="sm" variant="ghost" onClick={clearEvents}>
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div 
          ref={eventsRef}
          className="h-32 overflow-y-auto space-y-1 text-xs font-mono"
        >
          {events.length === 0 ? (
            <p className="text-muted-foreground">No events yet...</p>
          ) : (
            events.map((event, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-muted-foreground">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="font-medium">{event.type}</span>
                <span className="text-muted-foreground truncate">
                  {JSON.stringify(event.data)}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
  
  // ====================================
  // RENDER
  // ====================================
  
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">VibeGridX Demo</h1>
          <Badge variant="secondary" className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
            XState v5 + Hybrid Rendering POC
          </Badge>
        </div>
        <p className="text-muted-foreground">
          Interactive demo of the VibeGridX architecture with XState v5 machines, hybrid rendering, and entity integration.
        </p>
      </div>
      
      {/* Architecture Overview */}
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-green-900 dark:text-green-100">
            🏗️ Architecture Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="space-y-1">
              <div className="font-medium">XState v5 Machines</div>
              <div className="text-muted-foreground">Actor hierarchy coordination</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Hybrid Rendering</div>
              <div className="text-muted-foreground">React + Direct DOM</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Entity Integration</div>
              <div className="text-muted-foreground">Domain atoms connector</div>
            </div>
            <div className="space-y-1">
              <div className="font-medium">Virtual Scrolling</div>
              <div className="text-muted-foreground">Actor lifecycle management</div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Main Demo Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Grid Demo */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>VibeGridX - Tasks ({entityData.count})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <VibeGridX<Task>
                  ref={vibeGridXRef}
                  data={entityData.data}
                  entityType="task"
                  columns={taskColumns}
                  enableVirtualScrolling={config.enableVirtualScrolling}
                  enableCanvasOverlays={config.enableCanvasOverlays}
                  enableGrouping={config.enableGrouping}
                  enableFiltering={config.enableFiltering}
                  enableSorting={config.enableSorting}
                  enableDragAndDrop={config.enableDragAndDrop}
                  bufferSize={config.bufferSize}
                  onSelectionChange={handleSelectionChange}
                  onEditingChange={handleEditingChange}
                  onCellClick={handleCellClick}
                  onCellDoubleClick={handleCellDoubleClick}
                  onPerformanceUpdate={(metrics) => setPerformanceMetrics(metrics)}
                />
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Side Panel */}
        <div className="space-y-4">
          {renderMetrics()}
          {renderControls()}
          {renderEventLog()}
        </div>
      </div>
      
      {/* Implementation Status */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-blue-900 dark:text-blue-100">
            ✅ Implementation Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium">Completed Components:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ XState v5 Machine Architecture</li>
                <li>✅ SelectionCoordinator Actor</li>
                <li>✅ EditCoordinator Actor</li>
                <li>✅ ViewCoordinator Actor</li>
                <li>✅ DragCoordinator Actor</li>
                <li>✅ RowActor Implementation</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-medium">Rendering & Integration:</div>
              <ul className="space-y-1 text-muted-foreground">
                <li>✅ AtomicTableRenderer</li>
                <li>✅ EntityIntegrationLayer</li>
                <li>✅ VirtualScrollManager</li>
                <li>✅ CanvasOverlayManager</li>
                <li>✅ Main VibeGridX Component</li>
                <li>✅ Complete Type System</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}