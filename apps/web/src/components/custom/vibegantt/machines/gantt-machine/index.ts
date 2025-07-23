import { setup, assign, sendTo, raise } from 'xstate';
import type { 
  GanttMachineContext, 
  GanttEvent, 
  GanttTask, 
  TaskDependency,
  GanttViewConfig,
  ViewportState,
  SelectionState,
  DragState,
  HoverState,
  TaskLayout,
  TimelineLayout,
  RenderCommand,
  Region
} from '../../types';
import { DEFAULT_VIEW_CONFIG } from '../../constants';
import { ganttRendererActor } from '../../actors/gantt-renderer-actor';
import { dataSubscriptionActor } from '../../actors/gantt-data-subscription-actor';
import { timelineSlice } from './slices/timeline-slice';
import { taskSlice } from './slices/task-slice';
import { interactionSlice } from './slices/interaction-slice';
import { viewportSlice } from './slices/viewport-slice';

// Initial context factory
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

// Main machine definition
export const ganttMachine = setup({
  types: {} as {
    context: GanttMachineContext;
    events: GanttEvent;
    children: {
      renderer: 'ganttRenderer';
      dataSubscription: 'dataSubscription';
    };
  },
  actors: {
    ganttRenderer: ganttRendererActor,
    dataSubscription: dataSubscriptionActor,
  },
  actions: {
    // Initialize actions
    initializeData: assign({
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
    
    // Viewport actions
    updateViewport: assign({
      viewport: ({ context, event }) => {
        if (event.type !== 'VIEWPORT_RESIZE') return context.viewport;
        return {
          ...context.viewport,
          width: event.width,
          height: event.height,
        };
      },
    }),
    
    // Queue render command
    queueRender: assign({
      renderQueue: ({ context }, params: RenderCommand) => {
        return [...context.renderQueue, params];
      },
    }),
    
    // Clear render queue
    clearRenderQueue: assign({
      renderQueue: () => [],
    }),
    
    // Forward to renderer
    forwardToRenderer: sendTo('renderer', ({ event }) => event),
    
    // Notify external handlers
    notifyTaskUpdate: ({ context }, params: { taskId: string }) => {
      // This would call the onTaskUpdate prop
      console.log('Task updated:', params.taskId);
    },
  },
  guards: {
    // Validation guards
    canMoveTask: ({ context }, params: { taskId: string }) => {
      const task = context.tasks.get(params.taskId);
      return task !== undefined && !task.constraints?.some(c => 
        c.type === 'must-start-on' || c.type === 'must-finish-on'
      );
    },
    
    hasSelection: ({ context }) => {
      return context.selection.selectedTaskIds.size > 0;
    },
    
    isValidDependency: ({ context }, params: { source: string; target: string }) => {
      // Check for circular dependencies
      // This is a simplified check - real implementation would be more complex
      return params.source !== params.target;
    },
  },
}).createMachine({
  id: 'gantt',
  context: createInitialContext(),
  initial: 'initializing',
  states: {
    initializing: {
      on: {
        INITIALIZE_RENDERER: {
          target: 'renderer_initializing',
          actions: [
            // Start the renderer actor with merged options
            assign({
              renderer: ({ spawn, event }) => {
                console.log('GanttMachine: Starting renderer actor with options:', event.options);
                // Merge stored window options with event options (VibeGridDex pattern)
                const storedOptions = (window as any).__vibegantt_renderer_options || {};
                const mergedOptions = {
                  ...storedOptions,
                  ...event.options,
                };
                console.log('GanttMachine: Merged renderer options:', mergedOptions);
                return spawn('ganttRenderer', { input: mergedOptions, id: 'renderer' });
              },
            }),
          ],
        },
      },
    },
    
    renderer_initializing: {
      on: {
        RENDERER_READY: {
          target: 'ready',
        },
        INITIALIZE: {
          target: 'ready',
          actions: ['initializeData'],
        },
      },
    },
    
    ready: {
      type: 'parallel',
      states: {
        // Viewport management
        viewport: viewportSlice,
        
        // Timeline interactions (zoom, pan)
        timeline: timelineSlice,
        
        // Task interactions (select, drag, resize)
        tasks: taskSlice,
        
        // User interactions
        interaction: interactionSlice,
        
        // Data synchronization
        data: {
          initial: 'idle',
          invoke: {
            id: 'dataSubscription',
            src: 'dataSubscription',
          },
          states: {
            idle: {
              on: {
                TASKS_UPDATED: {
                  actions: assign({
                    tasks: ({ event }) => {
                      const taskMap = new Map<string, GanttTask>();
                      event.tasks.forEach(task => taskMap.set(task.id, task));
                      return taskMap;
                    },
                  }),
                },
                DEPENDENCIES_UPDATED: {
                  actions: assign({
                    dependencies: ({ event }) => {
                      const depMap = new Map<string, TaskDependency>();
                      event.dependencies.forEach(dep => depMap.set(dep.id, dep));
                      return depMap;
                    },
                  }),
                },
              },
            },
          },
        },
        
        // Rendering coordination
        rendering: {
          initial: 'idle',
          states: {
            idle: {
              on: {
                RENDER_FRAME: {
                  target: 'rendering',
                  guard: ({ context }) => context.renderQueue.length > 0,
                },
              },
            },
            rendering: {
              entry: ['forwardToRenderer'],
              on: {
                RENDER_COMPLETE: {
                  target: 'idle',
                  actions: ['clearRenderQueue'],
                },
              },
            },
          },
        },
      },
    },
  },
  on: {
    // Global viewport events
    VIEWPORT_RESIZE: {
      actions: ['updateViewport'],
    },
    
    // View configuration updates
    VIEW_CONFIG_UPDATE: {
      actions: assign({
        viewConfig: ({ context, event }) => ({
          ...context.viewConfig,
          ...event.config,
        }),
      }),
    },
  },
});