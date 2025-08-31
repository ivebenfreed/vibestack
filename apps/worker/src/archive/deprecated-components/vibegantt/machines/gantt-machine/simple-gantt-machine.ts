import { setup, assign } from 'xstate';
import type { 
  GanttMachineContext, 
  GanttEvent, 
  GanttTask, 
  TaskDependency,
  GanttViewConfig,
  ViewportState,
  SelectionState
} from '../../types';
import { DEFAULT_VIEW_CONFIG } from '../../constants';

// Simplified initial context
const createInitialContext = (): GanttMachineContext => ({
  // Data
  tasks: new Map(),
  dependencies: new Map(),
  resources: new Map(),
  resourceAllocations: new Map(),
  
  // View State
  viewConfig: DEFAULT_VIEW_CONFIG,
  viewport: {
    scrollX: 0,
    scrollY: 0,
    width: 1000,
    height: 600,
    zoom: 1,
    visibleDateRange: {
      start: new Date(),
      end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
    visibleTaskIds: new Set(),
  },
  timelineLayout: {
    totalWidth: 0,
    totalHeight: 0,
    dayWidth: 50,
    headerHeight: 60,
    visibleStartX: 0,
    visibleEndX: 1000,
  },
  
  // Interaction State
  selection: {
    selectedTaskIds: new Set(),
    focusedTaskId: null,
    selectionMode: 'single',
  },
  dragState: null,
  hoverState: null,
  editingTaskId: null,
  
  // Computed
  criticalPath: new Set(),
  taskLayout: new Map(),
  dependencyPaths: new Map(),
  
  // Performance
  renderQueue: [],
  dirtyRegions: new Set(),
  lastRenderTime: 0,
  frameRate: 60,
  
  // UI State
  contextMenu: null,
  tooltip: null,
});

// Simplified machine
export const simpleGanttMachine = setup({
  types: {} as {
    context: GanttMachineContext;
    events: GanttEvent;
  },
  actions: {
    // Initialize with data
    loadTasks: assign({
      tasks: ({ event }) => {
        if (event.type !== 'INITIALIZE') return new Map();
        const taskMap = new Map<string, GanttTask>();
        event.tasks.forEach(task => taskMap.set(task.id, task));
        return taskMap;
      },
      dependencies: ({ event }) => {
        if (event.type !== 'INITIALIZE') return new Map();
        const depMap = new Map<string, TaskDependency>();
        event.dependencies.forEach(dep => depMap.set(dep.id, dep));
        return depMap;
      },
    }),
    
    // Task selection
    selectTask: assign({
      selection: ({ context, event }) => {
        if (event.type !== 'TASK_SELECT') return context.selection;
        
        const newSelection = new Set(context.selection.selectedTaskIds);
        
        if (event.multi) {
          if (newSelection.has(event.taskId)) {
            newSelection.delete(event.taskId);
          } else {
            newSelection.add(event.taskId);
          }
        } else {
          newSelection.clear();
          newSelection.add(event.taskId);
        }
        
        return {
          ...context.selection,
          selectedTaskIds: newSelection,
          focusedTaskId: event.taskId,
        };
      },
    }),
    
    // Viewport updates
    updateViewport: assign({
      viewport: ({ context, event }) => {
        if (event.type === 'VIEWPORT_RESIZE') {
          return {
            ...context.viewport,
            width: event.width,
            height: event.height,
          };
        }
        if (event.type === 'SCROLL') {
          return {
            ...context.viewport,
            scrollX: event.scrollX,
            scrollY: event.scrollY,
          };
        }
        return context.viewport;
      },
    }),
    
    // View configuration updates
    updateViewConfig: assign({
      viewConfig: ({ context, event }) => {
        if (event.type !== 'VIEW_CONFIG_UPDATE') return context.viewConfig;
        return {
          ...context.viewConfig,
          ...event.config,
        };
      },
    }),
  },
}).createMachine({
  id: 'simpleGantt',
  context: createInitialContext(),
  initial: 'ready',
  states: {
    ready: {
      on: {
        // Data events
        INITIALIZE: {
          actions: ['loadTasks'],
        },
        
        // Task events
        TASK_SELECT: {
          actions: ['selectTask'],
        },
        
        // View events
        VIEWPORT_RESIZE: {
          actions: ['updateViewport'],
        },
        SCROLL: {
          actions: ['updateViewport'],
        },
        VIEW_CONFIG_UPDATE: {
          actions: ['updateViewConfig'],
        },
        
        // Zoom and pan
        ZOOM: {
          actions: ['updateViewConfig'],
        },
        PAN: {
          // Handle pan logic
        },
      },
    },
  },
});