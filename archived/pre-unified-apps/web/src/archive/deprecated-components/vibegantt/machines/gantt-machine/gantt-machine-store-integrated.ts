import { setup, assign, sendTo, createActor } from 'xstate';
import type { 
  GanttMachineContext, 
  GanttEvent, 
  GanttTask, 
  TaskDependency,
  GanttViewConfig,
  RenderCommand
} from '../../types';
import { DEFAULT_VIEW_CONFIG } from '../../constants';
import { ganttRendererActor } from '../../actors/gantt-renderer-actor';
import { timelineSlice } from './slices/timeline-slice';
import { taskSlice } from './slices/task-slice';
import { interactionSlice } from './slices/interaction-slice';
import { viewportSlice } from './slices/viewport-slice';
import { debugLog } from '@/logger';
const log = debugLog('archive/deprecated-components/vibegantt/machines/gantt-machine/gantt-machine-store-integrated.ts');

// Initial context factory
const createInitialContext = (projectId?: string, storeActor?: any): GanttMachineContext => ({
  // Store reference (following VibeGridDex pattern)
  storeActor: storeActor || null,
  projectId: projectId || null,
  
  // Data from store (will be synced)
  tasks: new Map(),
  dependencies: new Map(),
  resources: new Map(),
  resourceAllocations: new Map(),
  
  // Computed data from store
  taskTree: [],
  taskMap: new Map(),
  dependencyMap: new Map(),
  criticalPath: new Set(),
  taskHierarchy: new Map(),
  dependencyGraph: new Map(),
  
  // View State
  viewConfig: DEFAULT_VIEW_CONFIG,
  viewport: {
    scrollX: 0,
    scrollY: 0,
    width: 0,
    height: 0,
    zoom: 1,
    visibleDateRange: {
      start: new Date(),
      end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    },
    visibleTaskIds: new Set(),
  },
  timelineLayout: {
    totalWidth: 0,
    totalHeight: 0,
    dayWidth: 50,
    headerHeight: 60,
    visibleStartX: 0,
    visibleEndX: 0,
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
  
  // Computed task layout
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

// Main machine definition
export const ganttMachineStoreIntegrated = setup({
  types: {} as {
    context: GanttMachineContext;
    events: GanttEvent;
    input: { projectId?: string; storeActor?: any };
    children: {
      renderer: 'ganttRenderer';
    };
  },
  actors: {
    ganttRenderer: ganttRendererActor,
  },
  actions: {
    // Subscribe to store updates
    subscribeToStore: ({ context, self }) => {
      if (!context.storeActor) return;
      
      log.info('GanttMachine: Subscribing to store updates');
      
      // Subscribe to store state changes
      const subscription = context.storeActor.subscribe((snapshot: any) => {
        if (snapshot?.context && !snapshot.context.loading) {
          // Send store data to machine
          self.send({
            type: 'STORE_DATA_UPDATED',
            taskTree: snapshot.context.taskTree,
            taskMap: snapshot.context.taskMap,
            dependencies: snapshot.context.dependencies,
            dependencyMap: snapshot.context.dependencyMap,
            criticalPath: snapshot.context.criticalPath,
            expandedTasks: snapshot.context.expandedTasks,
            selectedTasks: snapshot.context.selectedTasks,
            visibleDateRange: snapshot.context.visibleDateRange,
            zoom: snapshot.context.zoom,
            showWeekends: snapshot.context.showWeekends,
            showDependencies: snapshot.context.showDependencies,
          });
        }
      });
      
      // Store subscription for cleanup
      (context as any).__storeSubscription = subscription;
    },
    
    // Update context with store data
    updateFromStore: assign(({ event }) => {
      if (event.type !== 'STORE_DATA_UPDATED') return {};
      
      log.info('GanttMachine: Updating from store', {
        taskCount: event.taskTree?.length || 0,
        dependencyCount: Object.keys(event.dependencies || {}).length,
      });
      
      // Convert store data to machine format
      const tasks = new Map<string, GanttTask>();
      const taskHierarchy = new Map<string, string[]>();
      
      // Flatten task tree into map and build hierarchy
      const flattenTasks = (taskList: any[], parentId?: string) => {
        taskList.forEach(task => {
          tasks.set(task.id, task);
          
          // Build hierarchy
          if (parentId) {
            const siblings = taskHierarchy.get(parentId) || [];
            siblings.push(task.id);
            taskHierarchy.set(parentId, siblings);
          } else {
            const rootSiblings = taskHierarchy.get('root') || [];
            rootSiblings.push(task.id);
            taskHierarchy.set('root', rootSiblings);
          }
          
          // Process children
          if (task.children && task.children.length > 0) {
            flattenTasks(task.children, task.id);
          }
        });
      };
      
      if (event.taskTree) {
        flattenTasks(event.taskTree);
      }
      
      // Convert dependencies
      const dependencies = new Map<string, TaskDependency>();
      if (event.dependencies) {
        Object.values(event.dependencies).forEach((dep: any) => {
          dependencies.set(dep.id, dep);
        });
      }
      
      return {
        tasks,
        taskTree: event.taskTree || [],
        taskMap: event.taskMap || new Map(),
        dependencies,
        dependencyMap: event.dependencyMap || new Map(),
        criticalPath: event.criticalPath || new Set(),
        taskHierarchy,
        // Update view state from store
        selection: {
          selectedTaskIds: event.selectedTasks || new Set(),
          focusedTaskId: null,
          selectionMode: 'single',
        },
        viewport: {
          scrollX: 0,
          scrollY: 0,
          width: 0,
          height: 0,
          zoom: 1,
          visibleDateRange: event.visibleDateRange || {
            start: new Date(),
            end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
          visibleTaskIds: new Set(),
        },
      };
    }),
    
    // Send render commands to renderer
    sendRenderCommands: sendTo('renderer', ({ context }) => {
      const commands: RenderCommand[] = [];
      
      // Convert visible tasks to render commands
      const visibleTasks = getVisibleTasks(context.taskTree, context.taskMap);
      
      visibleTasks.forEach(task => {
        commands.push({
          type: 'task',
          action: 'update',
          data: task,
          priority: 5,
        });
      });
      
      // Add dependency render commands
      context.dependencies.forEach(dep => {
        commands.push({
          type: 'dependency',
          action: 'update',
          data: dep,
          priority: 3,
        });
      });
      
      // Add timeline render command
      commands.push({
        type: 'timeline',
        action: 'update',
        data: {
          visibleDateRange: context.viewport.visibleDateRange,
          dayWidth: context.timelineLayout.dayWidth,
          zoom: context.viewport.zoom,
        },
        priority: 10,
      });
      
      return {
        type: 'RENDER',
        commands,
      };
    }),
    
    // Initialize renderer
    initializeRenderer: assign({
      renderer: ({ spawn, event }) => {
        if (event.type !== 'INITIALIZE_RENDERER') return undefined;
        
        log.info('GanttMachine: Starting renderer actor');
        
        // Merge stored window options with event options (VibeGridDex pattern)
        const storedOptions = (window as any).__vibegantt_renderer_options || {};
        const mergedOptions = {
          ...storedOptions,
          ...event.options,
        };
        
        return spawn('ganttRenderer', { 
          input: mergedOptions, 
          id: 'renderer' 
        });
      },
    }),
    
    // Forward events to store
    forwardToStore: ({ context, event }) => {
      if (!context.storeActor) return;
      
      // Forward certain events to the store
      switch (event.type) {
        case 'TOGGLE_TASK_EXPANDED':
          context.storeActor.send({ type: 'toggleTaskExpanded', taskId: event.taskId });
          break;
        case 'SET_SELECTED_TASKS':
          context.storeActor.send({ type: 'setSelectedTasks', taskIds: event.taskIds });
          break;
        case 'SET_VISIBLE_DATE_RANGE':
          context.storeActor.send({ type: 'setVisibleDateRange', range: event.range });
          break;
        case 'SET_ZOOM':
          context.storeActor.send({ type: 'setZoom', zoom: event.zoom });
          break;
      }
    },
    
    // Cleanup
    cleanup: ({ context }) => {
      // Unsubscribe from store
      const subscription = (context as any).__storeSubscription;
      if (subscription) {
        subscription.unsubscribe();
      }
    },
  },
}).createMachine({
  id: 'gantt-store-integrated',
  context: ({ input }) => createInitialContext(input?.projectId, input?.storeActor),
  initial: 'initializing',
  states: {
    initializing: {
      entry: ['subscribeToStore'],
      on: {
        INITIALIZE_RENDERER: {
          target: 'ready',
          actions: ['initializeRenderer'],
        },
      },
    },
    
    ready: {
      type: 'parallel',
      states: {
        // Data synchronization from store
        data: {
          initial: 'syncing',
          states: {
            syncing: {
              on: {
                STORE_DATA_UPDATED: {
                  actions: ['updateFromStore', 'sendRenderCommands'],
                },
              },
            },
          },
        },
        
        // Viewport management
        viewport: viewportSlice,
        
        // Timeline interactions
        timeline: timelineSlice,
        
        // Task interactions
        tasks: taskSlice,
        
        // User interactions
        interaction: interactionSlice,
        
        // Rendering coordination
        rendering: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                RENDER_REQUESTED: 'rendering',
              },
            },
            rendering: {
              entry: 'sendRenderCommands',
              on: {
                RENDER_COMPLETE: 'idle',
                RENDER_ERROR: 'error',
              },
            },
            error: {
              on: {
                RETRY_RENDER: 'rendering',
              },
            },
          },
        },
      },
      
      // Forward events to store
      on: {
        TOGGLE_TASK_EXPANDED: {
          actions: 'forwardToStore',
        },
        SET_SELECTED_TASKS: {
          actions: 'forwardToStore',
        },
        SET_VISIBLE_DATE_RANGE: {
          actions: 'forwardToStore',
        },
        SET_ZOOM: {
          actions: 'forwardToStore',
        },
      },
    },
  },
  
  exit: 'cleanup',
});

// Helper function to get visible tasks
function getVisibleTasks(taskTree: any[], taskMap: Map<string, any>): any[] {
  const visible: any[] = [];
  const expandedTasks = new Set<string>();
  
  // Get expanded state from task map
  taskMap.forEach(task => {
    if (task.isExpanded) {
      expandedTasks.add(task.id);
    }
  });
  
  const processTask = (task: any, level: number) => {
    visible.push({ ...task, level });
    
    if (task.children && task.children.length > 0 && expandedTasks.has(task.id)) {
      task.children.forEach((child: any) => processTask(child, level + 1));
    }
  };
  
  taskTree.forEach(task => processTask(task, 0));
  
  return visible;
}