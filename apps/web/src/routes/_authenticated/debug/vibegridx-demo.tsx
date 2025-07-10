import { createFileRoute } from '@tanstack/react-router';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { VibeGridX } from '@/components/custom/vibegridx';
import type { CellRef, ViewportInfo, Column } from '@/components/custom/vibegridx';
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
// DEMO GRID COMPONENT
// ====================================

interface VibeGridXDemoGridProps {
  entityType: 'task' | 'project' | 'user';
  data: any[];
  columns: Column[];
  isLoading: boolean;
  onPerformanceUpdate?: (metrics: any) => void;
}

function VibeGridXDemoGrid({ 
  entityType,
  data, 
  columns,
  isLoading,
  onPerformanceUpdate
}: VibeGridXDemoGridProps) {
  // Original VibeGridX doesn't have a useVibeGridX hook, we'll manage state locally
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [editingCell, setEditingCell] = useState<CellRef | null>(null);
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  
  // Update performance metrics when they change
  useEffect(() => {
    if (performanceMetrics) {
      onPerformanceUpdate?.(performanceMetrics);
    }
  }, [performanceMetrics, onPerformanceUpdate]);
  
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
          <h3 className="font-semibold">VibeGridX {entityType} Grid (Atomic)</h3>
          <div className="flex gap-2">
            <Badge variant="outline" className="text-xs">XState v5</Badge>
            <Badge variant="outline" className="text-xs">Atomic Render</Badge>
            <Badge variant="outline" className="text-xs">Virtual Scroll</Badge>
            <Badge variant="outline" className="text-xs">Canvas Overlays</Badge>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          {data.length} rows • {selectedCells.size} selected • {editingCell ? 'Editing' : 'Ready'}
        </div>
      </div>
      
      {/* Grid Component */}
      <div className="flex-1">
        <VibeGridX<any>
          data={data}
          entityType={entityType}
          columns={columns}
          enableVirtualScrolling={true}
          enableCanvasOverlays={true}
          enableGrouping={true}
          enableFiltering={true}
          enableSorting={true}
          enableDragAndDrop={true}
          bufferSize={10}
          onSelectionChange={setSelectedCells}
          onEditingChange={setEditingCell}
          onCellClick={(rowId, columnId) => {
            // Cell click handled
          }}
          onCellDoubleClick={(rowId, columnId) => {
            console.log('[Demo] Cell double-clicked:', { rowId, columnId });
          }}
          onPerformanceUpdate={setPerformanceMetrics}
        />
      </div>
      
      {/* Footer */}
      <div className="bg-muted/50 border-t p-2 text-xs text-muted-foreground flex justify-between">
        <div>
          Showing {Math.min(50, data.length)} of {data.length} rows
        </div>
        <div className="flex gap-4">
          <span>Cell Renderers: Active</span>
          <span>React Editors: Active</span>
          <span>Event System: Active</span>
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
  const [performanceMetrics, setPerformanceMetrics] = useState<any>(null);
  const [events, setEvents] = useState<Array<{ type: string; data: any; timestamp: number }>>([]);
  
  // Refs
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
  
  const handlePerformanceUpdate = useCallback((metrics: any) => {
    setPerformanceMetrics(metrics);
    addEvent('performance.update', { 
      renderTime: metrics.lastRenderTime,
      cellCount: metrics.cellCount 
    });
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
              <CardTitle>VibeGridX Atomic - Tasks ({entityData.count})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <VibeGridXDemoGrid
                  entityType="task"
                  data={entityData.data}
                  columns={taskColumns}
                  isLoading={isLoading}
                  onPerformanceUpdate={handlePerformanceUpdate}
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
                <li>✅ Virtual Scrolling</li>
                <li>✅ Canvas Selection Overlays</li>
                <li>✅ Direct DOM Performance</li>
                <li>✅ Entity Integration Layer</li>
                <li>✅ Hybrid React + Direct DOM</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}