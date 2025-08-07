import { setup, assign, sendTo, raise, createActor } from 'xstate';
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
import { DEFAULT_VIEW_CONFIG, TIME_SCALE_CONFIG, ZOOM_UTILS } from '../../constants';
import { ganttRendererActor } from '../../actors/gantt-renderer-actor';
import { createGanttStoreLogic } from '../../stores/gantt-data-store';
import { createGanttStoreLogic as createAtomicGanttStoreLogic, loadInitialGanttData, setupGranularGanttSubscriptions } from '../../stores/gantt-data-store-atomic';
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
    dayWidth: 50, // Default 50px per day - single source of truth
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
  selectedDependencyIds: new Set(),
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
    input: { projectId?: string; domainService?: any; initialData?: any };
    children: {
      renderer: 'ganttRenderer';
      dataStore: 'ganttDataStore';
    };
  },
  actors: {
    ganttRenderer: ganttRendererActor,
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
    
    // Handle drag visual updates
    updateDragPreview: ({ context, event }) => {
      if (event.type === 'TASK_DRAG_MOVE' && event.taskId && event.deltaX !== undefined) {
        if (context.renderer) {
          context.renderer.send({
            type: 'HANDLE_DRAG_MOVE',
            taskId: event.taskId,
            deltaX: event.deltaX
          });
        }
      }
    },
    
    // Handle resize visual updates
    updateResizePreview: ({ context, event }) => {
      if (event.type === 'TASK_RESIZE_MOVE' && event.taskId && event.handle && event.deltaX !== undefined) {
        if (context.renderer) {
          context.renderer.send({
            type: 'HANDLE_RESIZE_MOVE',
            taskId: event.taskId,
            handle: event.handle === 'start' ? 'left' : 'right',
            deltaX: event.deltaX
          });
        }
      }
    },
    
    // Apply task move (calculate new dates)
    applyTaskMove: ({ context, event }) => {
      if (event.type === 'TASK_DRAG_END' && context.dragState && context.renderer) {
        // Don't reset visual state immediately - let the new coordinates arrive first
        // The live query update will trigger a re-render with correct coordinates
        
        // Calculate new dates based on deltaX
        if (event.deltaX !== undefined && context.dataStore) {
          const storeSnapshot = context.dataStore.getSnapshot();
          const coordinateMapping = storeSnapshot.context.coordinateMapping;
          const tasks = storeSnapshot.context.tasks;
          
          if (coordinateMapping && tasks) {
            const dayWidth = coordinateMapping.timeline.dayWidth;
            const daysDelta = Math.round(event.deltaX / dayWidth);
            
            // Check if there's any actual movement
            if (daysDelta === 0) {
              console.log('GanttMachine: No movement detected, skipping update', {
                taskId: event.taskId,
                deltaX: event.deltaX,
                dayWidth: dayWidth,
                daysDelta
              });
              return;
            }
            
            const task = tasks[event.taskId];
            if (task && task.startDate && task.dueDate) {
              console.log('GanttMachine: BEFORE move calculation', {
                taskId: task.id,
                originalStartDate: task.startDate,
                originalDueDate: task.dueDate,
                deltaX: event.deltaX,
                dayWidth: dayWidth,
                daysDelta
              });
              
              // Create new dates with proper snapping to day boundaries
              const originalStart = new Date(task.startDate);
              const originalEnd = new Date(task.dueDate);
              
              // Snap to start of day for consistent calculations
              const newStartDate = new Date(originalStart);
              newStartDate.setDate(originalStart.getDate() + daysDelta);
              // Keep the original time of day to avoid timezone issues
              newStartDate.setHours(originalStart.getHours(), originalStart.getMinutes(), originalStart.getSeconds(), originalStart.getMilliseconds());
              
              const newDueDate = new Date(originalEnd);
              newDueDate.setDate(originalEnd.getDate() + daysDelta);
              // Keep the original time of day to avoid timezone issues
              newDueDate.setHours(originalEnd.getHours(), originalEnd.getMinutes(), originalEnd.getSeconds(), originalEnd.getMilliseconds());
              
              // Check if dates actually changed
              const originalStartTime = new Date(task.startDate).getTime();
              const originalEndTime = new Date(task.dueDate).getTime();
              const newStartTime = newStartDate.getTime();
              const newEndTime = newDueDate.getTime();
              
              if (originalStartTime === newStartTime && originalEndTime === newEndTime) {
                console.log('GanttMachine: No date changes detected, skipping update', {
                  taskId: task.id,
                  originalStartDate: task.startDate,
                  originalDueDate: task.dueDate,
                  newStartDate: newStartDate.toISOString(),
                  newDueDate: newDueDate.toISOString()
                });
                return;
              }
              
              console.log('GanttMachine: AFTER move calculation', {
                taskId: task.id,
                newStartDate: newStartDate.toISOString(),
                newDueDate: newDueDate.toISOString(),
                daysDelta
              });
              
              // Only update through domain service - live query will update store automatically
              if (context.domainService?.updateTask) {
                console.log('GanttMachine: Calling domain service updateTask', {
                  taskId: task.id,
                  updateData: {
                    startDate: newStartDate,
                    dueDate: newDueDate
                  }
                });
                
                // Make the call async and handle the promise
                context.domainService.updateTask(task.id, {
                  startDate: newStartDate,
                  dueDate: newDueDate
                }).then((updateResult) => {
                  console.log('GanttMachine: Domain service updateTask SUCCESS', {
                    taskId: task.id,
                    result: updateResult,
                    updatedStartDate: updateResult?.startDate,
                    updatedDueDate: updateResult?.dueDate
                  });
                }).catch((error) => {
                  console.error('GanttMachine: Domain service updateTask ERROR', {
                    taskId: task.id,
                    error: error.message,
                    stack: error.stack
                  });
                });
              } else {
                console.error('GanttMachine: No domain service available for updateTask');
              }
            } else {
              console.error('GanttMachine: Invalid task data', {
                taskId: event.taskId,
                hasTask: !!task,
                hasStartDate: task?.startDate,
                hasDueDate: task?.dueDate
              });
            }
          }
        }
      }
    },
    
    // Apply task resize (calculate new dates)
    applyTaskResize: ({ context, event }) => {
      if (event.type === 'TASK_RESIZE_END' && context.dragState && context.renderer) {
        // Don't reset visual state immediately - let the new coordinates arrive first
        // The live query update will trigger a re-render with correct coordinates
        
        // Calculate new dates based on deltaX
        if (event.deltaX !== undefined && context.dataStore) {
          const storeSnapshot = context.dataStore.getSnapshot();
          const coordinateMapping = storeSnapshot.context.coordinateMapping;
          const tasks = storeSnapshot.context.tasks;
          
          if (coordinateMapping && tasks) {
            const dayWidth = coordinateMapping.timeline.dayWidth;
            const daysDelta = Math.round(event.deltaX / dayWidth);
            
            const task = tasks[event.taskId];
            if (task && task.startDate && task.dueDate) {
              // Only update through domain service - live query will update store automatically
              if (context.domainService?.updateTask) {
                const updates: any = {};
                if (event.handle === 'start' || event.handle === 'left') {
                  const newStartDate = new Date(task.startDate);
                  newStartDate.setDate(newStartDate.getDate() + daysDelta);
                  updates.startDate = newStartDate;
                } else {
                  const newDueDate = new Date(task.dueDate);
                  newDueDate.setDate(newDueDate.getDate() + daysDelta);
                  updates.dueDate = newDueDate;
                }
                
                console.log('GanttMachine: Applying task resize via domain service', {
                  taskId: task.id,
                  handle: event.handle,
                  deltaX: event.deltaX,
                  daysDelta,
                  updates
                });
                context.domainService.updateTask(task.id, updates);
              }
            }
          }
        }
      }
    },
    
    // Queue render for selection updates
    queueSelectionRender: ({ context, self }) => {
      if (context.renderer) {
        context.renderer.send({
          type: 'UPDATE_CONTEXT',
          context: {
            ...context,
            selection: context.selection
          }
        });
      }
    },
    
    // Queue timeline render after zoom changes
    queueTimelineRender: ({ context }) => {
      console.log('GanttMachine: Queueing timeline render after zoom', {
        zoomLevel: context.viewConfig.zoomLevel,
        zoomFactor: context.viewConfig.zoomFactor,
        dayWidth: context.timelineLayout.dayWidth
      });
      
      if (context.renderer) {
        context.renderer.send({
          type: 'UPDATE_CONTEXT',
          context: {
            ...context,
            viewConfig: context.viewConfig,
            timelineLayout: context.timelineLayout,
            tasks: context.tasks,
            dependencies: context.dependencies,
            viewport: context.viewport,
            selection: context.selection,
            criticalPath: context.criticalPath,
            taskLayout: context.taskLayout,
          }
        });
      }
    },
    
    // Update visible range after viewport changes
    updateVisibleRange: assign({
      viewport: ({ context }) => {
        // Calculate visible date range based on scroll position and zoom
        const dayWidth = context.timelineLayout.dayWidth;
        const visibleStartDays = Math.floor(context.viewport.scrollX / dayWidth);
        const visibleEndDays = Math.ceil((context.viewport.scrollX + context.viewport.width) / dayWidth);
        
        const baseDate = context.viewConfig.timeRange.start;
        const visibleStartDate = new Date(baseDate);
        visibleStartDate.setDate(baseDate.getDate() + visibleStartDays);
        
        const visibleEndDate = new Date(baseDate);
        visibleEndDate.setDate(baseDate.getDate() + visibleEndDays);
        
        return {
          ...context.viewport,
          visibleDateRange: {
            start: visibleStartDate,
            end: visibleEndDate
          }
        };
      }
    }),
    
    // Queue viewport render
    queueViewportRender: ({ context }) => {
      if (context.renderer) {
        context.renderer.send({
          type: 'UPDATE_CONTEXT',
          context: {
            ...context,
            viewport: context.viewport
          }
        });
      }
    },
    
    // Create dependency action
    createDependency: ({ context, event }) => {
      if (event.type === 'DEPENDENCY_CREATE_END' && context.dragState?.taskId) {
        const predecessorId = context.dragState.taskId;
        const successorId = event.targetTaskId;
        
        console.log('GanttMachine: Creating dependency', { predecessorId, successorId });
        
        // Create a new dependency
        const newDependency = {
          id: `dep-${Date.now()}`,
          entityType: 'Task' as const,
          predecessorId,
          successorId,
          type: 'finish-to-start' as const,
          lagDays: 0
        };
        
        // Send to store
        if (context.dataStore) {
          context.dataStore.send({
            type: 'updateDependencies',
            dependencies: [...Object.values(context.dependencies), newDependency]
          });
        }
      }
    },
    
    // Cancel drag
    cancelDrag: ({ context }) => {
      if (context.renderer && context.dragState) {
        context.renderer.send({
          type: 'RESET_DRAG_STATE',
          taskId: context.dragState.taskId
        });
      }
    },
    
    // Cancel resize
    cancelResize: ({ context }) => {
      if (context.renderer && context.dragState) {
        context.renderer.send({
          type: 'RESET_DRAG_STATE',
          taskId: context.dragState.taskId
        });
      }
    },
    
    // Handle keyboard shortcuts
    handleKeyboardShortcut: async ({ context, event }) => {
      if (event.type !== 'KEYBOARD_SHORTCUT') return;
      
      // Handle Delete key
      if (event.key === 'Delete') {
        console.log('GanttMachine: Delete key pressed', {
          selectedTasks: context.selection.selectedTaskIds.size,
          selectedDependencies: context.selectedDependencyIds.size
        });
        
        // Delete selected tasks
        if (context.selection.selectedTaskIds.size > 0) {
          context.selection.selectedTaskIds.forEach(taskId => {
            if (context.domainService?.deleteTask) {
              context.domainService.deleteTask(taskId);
            }
          });
        }
        
        // Delete selected dependencies
        if (context.selectedDependencyIds && context.selectedDependencyIds.size > 0) {
          console.log('GanttMachine: Deleting selected dependencies', {
            count: context.selectedDependencyIds.size,
            ids: Array.from(context.selectedDependencyIds)
          });
          
          try {
            // Import the service
            const { entityDependencyService } = await import('@/domain/entity-dependency-service');
            
            // Delete each selected dependency
            for (const depId of context.selectedDependencyIds) {
              console.log('GanttMachine: Calling entityDependencyService.deleteUI', { depId });
              await entityDependencyService.deleteUI(depId);
            }
            
            console.log('GanttMachine: All selected dependencies deleted successfully');
            
            // Clear selection after deletion
            context.selectedDependencyIds.clear();
            
            // Trigger a data refresh to update the UI
            if (context.dataStore) {
              context.dataStore.send({ type: 'REFRESH' });
            }
          } catch (error) {
            console.error('GanttMachine: Failed to delete dependencies:', error);
          }
        }
      }
    },
    
  },
  guards: {
    // Validation guards
    canMoveTask: ({ context, event }) => {
      // Extract taskId from the event
      const taskId = event.type === 'TASK_DRAG_START' || event.type === 'TASK_RESIZE_START' 
        ? event.taskId 
        : null;
      
      if (!taskId) return false;
      
      const task = context.tasks.get(taskId);
      return task !== undefined && !task.constraints?.some(c => 
        c.type === 'must-start-on' || c.type === 'must-finish-on'
      );
    },
    
    hasSelection: ({ context }) => {
      return context.selection.selectedTaskIds.size > 0;
    },
    
    isValidDependency: ({ context, event }) => {
      // Check for circular dependencies
      // This is a simplified check - real implementation would be more complex
      if (event.type === 'DEPENDENCY_CREATE_END') {
        const predecessorId = context.dragState?.taskId;
        const successorId = event.targetTaskId;
        return predecessorId !== successorId;
      }
      return false;
    },
  },
}).createMachine({
  id: 'gantt',
  context: ({ input }) => ({
    ...createInitialContext(),
    domainService: input?.domainService || null,
    projectId: input?.projectId || null,
  }),
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
                console.log('GanttMachine: Starting renderer actor');
                // Create renderer actor and send INITIALIZE event
                const rendererRef = spawn('ganttRenderer', { id: 'renderer' });
                
                // Send initialize event with options
                rendererRef.send({
                  type: 'INITIALIZE',
                  options: event.options
                });
                
                return rendererRef;
              },
            }),
            // Spawn the atomic data store actor
            assign({
              dataStore: ({ spawn, context }) => {
                console.log('GanttMachine: Creating atomic data store with projectId:', context.projectId);
                
                // Create the atomic store logic with domainService and initial dayWidth
                const storeLogic = createAtomicGanttStoreLogic(
                  context.projectId, 
                  context.domainService,
                  context.timelineLayout.dayWidth // Pass initial dayWidth from machine
                );
                
                // Spawn the store actor
                const store = spawn(storeLogic, { id: 'dataStore' });
                
                // Store globally for debugging
                (window as any).__vibegantt_store_actor = store;
                
                // Load initial data into the store
                loadInitialGanttData(context.projectId, context.domainService).then(({ tasks, dependencies, relationships, pagination }) => {
                  console.log('GanttMachine: Loading initial data for store');
                  
                  // Send initial data to store
                  store.send({
                    type: 'setInitialData',
                    tasks,
                    relationships
                  });
                  
                  // Set dependencies
                  store.send({
                    type: 'updateDependencies',
                    dependencies: Object.values(dependencies)
                  });
                  
                  // Set pagination if needed
                  if (pagination) {
                    store.send({
                      type: 'setPagination',
                      pagination
                    });
                  }
                  
                  console.log('GanttMachine: Initial data loaded', {
                    taskCount: Object.keys(tasks).length,
                    depCount: Object.keys(dependencies).length
                  });
                  
                  // Set up live query subscriptions for reactive updates
                  if (!pagination?.enabled) {
                    console.log('GanttMachine: Setting up live query subscriptions');
                    const cleanup = setupGranularGanttSubscriptions(store, context.projectId, context.domainService);
                    // Store cleanup function for later cleanup
                    (context as any).__subscriptionsCleanup = cleanup;
                  }
                }).catch(error => {
                  console.error('GanttMachine: Error loading initial data', error);
                  store.send({
                    type: 'setError',
                    error: error instanceof Error ? error.message : 'Failed to load data'
                  });
                });
                
                return store;
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
          actions: [
            // Send initial data to renderer from store
            ({ context }) => {
              console.log('GanttMachine: Renderer ready');
              
              if (context.dataStore) {
                // Get current store snapshot
                const storeSnapshot = context.dataStore.getSnapshot();
                const storeContext = storeSnapshot.context;
                
                // Check if data is still loading
                if (storeContext.loading) {
                  console.log('GanttMachine: Data still loading, will send when ready');
                  return; // Don't send empty data, wait for store update
                }
                
                // Extract tasks and dependencies from atomic store
                const tasks = Object.values(storeContext.tasks || {});
                const dependencies = Object.values(storeContext.dependencies || {});
                
                console.log('GanttMachine: Sending data to renderer', {
                  taskCount: tasks.length,
                  depCount: dependencies.length
                });
                
                // Update machine context with store data
                context.tasks.clear();
                tasks.forEach((task: any) => context.tasks.set(task.id, task));
                
                context.dependencies.clear();
                dependencies.forEach((dep: any) => context.dependencies.set(dep.id, dep));
                
                // Send coordinate update to renderer
                if (context.renderer) {
                  if (storeContext.coordinateMapping) {
                    console.log('GanttMachine: Sending coordinate mapping to renderer');
                    context.renderer.send({
                      type: 'RENDER_COORDINATES',
                      mapping: storeContext.coordinateMapping,
                      tasks: storeContext.tasks,
                      dependencies: storeContext.dependencies
                    });
                  } else {
                    console.warn('GanttMachine: No coordinate mapping available yet');
                  }
                }
              }
            }
          ],
        },
        INITIALIZE: {
          target: 'ready',
          actions: ['initializeData'],
        },
      },
    },
    
    ready: {
      entry: [
        // Subscribe to store changes
        ({ context }) => {
          if (context.dataStore) {
            console.log('GanttMachine: Setting up store subscription');
            
            // Track if we've sent initial data
            let hasSentInitialData = false;
            
            // Subscribe to store changes
            const unsubscribe = context.dataStore.subscribe((snapshot) => {
              // Check if this is the initial data load completing
              if (!hasSentInitialData && !snapshot.context.loading && Object.keys(snapshot.context.tasks).length > 0) {
                hasSentInitialData = true;
                console.log('GanttMachine: Initial data loaded, sending to renderer');
              } else if (hasSentInitialData) {
                // Skip if we haven't changed since initial load
                const taskCount = Object.keys(snapshot.context.tasks).length;
                const depCount = Object.keys(snapshot.context.dependencies).length;
                if (taskCount === 0 && depCount === 0) {
                  return; // Skip empty updates
                }
              }
              
              const storeContext = snapshot.context;
              const tasks = Object.values(storeContext.tasks || {});
              const dependencies = Object.values(storeContext.dependencies || {});
              
              console.log('GanttMachine: Store data changed, updating renderer', {
                taskCount: tasks.length,
                depCount: dependencies.length
              });
              
              // Update machine context
              context.tasks.clear();
              tasks.forEach((task: any) => context.tasks.set(task.id, task));
              
              context.dependencies.clear();
              dependencies.forEach((dep: any) => context.dependencies.set(dep.id, dep));
              
              // Send coordinate update to renderer
              if (context.renderer) {
                if (storeContext.coordinateMapping) {
                  console.log('GanttMachine: Sending updated coordinate mapping to renderer');
                  context.renderer.send({
                    type: 'RENDER_COORDINATES',
                    mapping: storeContext.coordinateMapping,
                    tasks: storeContext.tasks,
                    dependencies: storeContext.dependencies
                  });
                } else {
                  console.warn('GanttMachine: No coordinate mapping in store update');
                }
              }
            });
            
            // Store unsubscribe function for cleanup
            (context as any).__storeUnsubscribe = unsubscribe;
          }
        }
      ],
      exit: [
        // Clean up store subscription
        ({ context }) => {
          if ((context as any).__storeUnsubscribe) {
            (context as any).__storeUnsubscribe();
            delete (context as any).__storeUnsubscribe;
          }
        },
        // Clean up live query subscriptions
        ({ context }) => {
          if ((context as any).__subscriptionsCleanup) {
            console.log('GanttMachine: Cleaning up live query subscriptions');
            (context as any).__subscriptionsCleanup();
            delete (context as any).__subscriptionsCleanup;
          }
        }
      ],
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
                // Handle events from renderer
                TASK_SELECT: {
                  actions: [
                    assign({
                      selection: ({ context, event }) => {
                        console.log('GanttMachine: Handling TASK_SELECT event', { taskId: event.taskId, multi: event.multi });
                        const newSelection = new Set(context.selection.selectedTaskIds);
                        
                        if (event.multi) {
                          // Toggle selection in multi-select mode
                          if (newSelection.has(event.taskId)) {
                            newSelection.delete(event.taskId);
                          } else {
                            newSelection.add(event.taskId);
                          }
                        } else {
                          // Single selection mode
                          newSelection.clear();
                          newSelection.add(event.taskId);
                        }
                        
                        console.log('GanttMachine: Updated selection', { selectedCount: newSelection.size });
                        
                        return {
                          ...context.selection,
                          selectedTaskIds: newSelection,
                          focusedTaskId: event.taskId,
                        };
                      },
                    }),
                    'queueSelectionRender',
                  ],
                },
                TASK_DRAG_END: {
                  // Handled by task slice
                },
                TASK_RESIZE_END: {
                  // Handled by task slice
                },
                DEPENDENCY_SELECT: {
                  actions: [
                    assign({
                      selectedDependencyIds: ({ context, event }) => {
                        console.log('GanttMachine: Handling DEPENDENCY_SELECT event', { dependencyId: event.dependencyId, multi: event.multi });
                        const newSelection = new Set(context.selectedDependencyIds);
                        
                        // Handle null dependencyId to clear selection
                        if (event.dependencyId === null) {
                          newSelection.clear();
                          console.log('GanttMachine: Cleared dependency selection');
                          return newSelection;
                        }
                        
                        if (event.multi) {
                          // Toggle selection in multi-select mode
                          if (newSelection.has(event.dependencyId)) {
                            newSelection.delete(event.dependencyId);
                          } else {
                            newSelection.add(event.dependencyId);
                          }
                        } else {
                          // Single selection mode
                          newSelection.clear();
                          newSelection.add(event.dependencyId);
                        }
                        
                        console.log('GanttMachine: Updated dependency selection', { selectedCount: newSelection.size });
                        
                        return newSelection;
                      },
                    }),
                    // Send selection update to renderer
                    ({ context, event }) => {
                      if (context.renderer && !event.skipRender) {
                        console.log('GanttMachine: Sending dependency selection to renderer');
                        context.renderer.send({
                          type: 'UPDATE_DEPENDENCY_SELECTION',
                          dependencyId: event.dependencyId
                        });
                      }
                    },
                  ],
                },
                DEPENDENCY_DELETE: {
                  actions: [
                    async ({ context, event }) => {
                      console.log('GanttMachine: Deleting dependency', event.dependencyId);
                      
                      try {
                        // Import the service
                        const { entityDependencyService } = await import('@/domain/entity-dependency-service');
                        
                        // Delete the dependency
                        const deleted = await entityDependencyService.deleteUI(event.dependencyId);
                        
                        console.log('GanttMachine: Dependency deletion result:', deleted);
                        
                        if (deleted) {
                          console.log('GanttMachine: Dependency deleted successfully');
                          
                          // Clear selection after successful deletion
                          assign({
                            selectedDependencyIds: (context) => {
                              const newSet = new Set(context.selectedDependencyIds);
                              newSet.delete(event.dependencyId);
                              return newSet;
                            }
                          });
                          
                          // Update the renderer to clear the selection
                          if (context.renderer) {
                            context.renderer.send({
                              type: 'UPDATE_DEPENDENCY_SELECTION',
                              dependencyId: null
                            });
                          }
                        } else {
                          console.error('GanttMachine: Dependency deletion returned false');
                        }
                      } catch (error) {
                        console.error('GanttMachine: Failed to delete dependency:', error);
                      }
                    },
                  ],
                },
                // Handle zoom events forwarded from renderer actor
                ZOOM_REQUEST: {
                  actions: [
                    // Calculate viewport anchoring and new day width
                    ({ context, event }) => {
                      console.log('GanttMachine: Received ZOOM_REQUEST from renderer actor', event);
                      
                      const currentDayWidth = context.timelineLayout.dayWidth;
                      const currentScrollX = context.viewport.scrollX;
                      const anchorX = event.anchorX || 0;
                      
                      // Calculate new day width first
                      const ZOOM_STEP = 10; // pixels per day
                      let newDayWidth = event.direction === 'in' 
                        ? currentDayWidth + ZOOM_STEP 
                        : currentDayWidth - ZOOM_STEP;
                      
                      // Reasonable limits for day width (5px to 500px per day)
                      newDayWidth = Math.max(5, Math.min(500, newDayWidth));
                      
                      // Simplified viewport anchoring: maintain same content position
                      // The key insight: after zoom, we want the same visual content at the anchor point
                      // This is simply a ratio calculation: new_scroll = old_scroll * (new_width / old_width)
                      
                      const scrollRatio = newDayWidth / currentDayWidth;
                      const newScrollX = currentScrollX * scrollRatio;
                      
                      console.log('GanttMachine: Simplified viewport anchoring', {
                        currentScrollX,
                        currentDayWidth,
                        newDayWidth,
                        scrollRatio,
                        newScrollX
                      });
                      
                      console.log(`GanttMachine: Time Scale Zoom: ${currentDayWidth}px/day -> ${newDayWidth}px/day`);
                      console.log(`GanttMachine: Scroll adjustment: ${currentScrollX} -> ${newScrollX} (maintaining anchor)`);
                      
                      // Store calculated values for use in assign actions
                      (event as any)._calculatedDayWidth = newDayWidth;
                      (event as any)._newScrollX = Math.max(0, newScrollX);
                    },
                    // Update timeline layout with new day width and viewport scroll for anchoring
                    assign({
                      timelineLayout: ({ context, event }) => {
                        const newDayWidth = (event as any)._calculatedDayWidth;
                        return {
                          ...context.timelineLayout,
                          dayWidth: newDayWidth
                        };
                      },
                      viewport: ({ context, event }) => {
                        const newScrollX = (event as any)._newScrollX;
                        return {
                          ...context.viewport,
                          scrollX: newScrollX
                        };
                      },
                      viewConfig: ({ context, event }) => {
                        const newDayWidth = (event as any)._calculatedDayWidth;
                        // Update zoom factor for consistency (derived from day width)
                        const zoomFactor = newDayWidth / TIME_SCALE_CONFIG.day.minPixelsPerUnit;
                        return {
                          ...context.viewConfig,
                          zoomFactor: zoomFactor
                        };
                      }
                    }),
                    // Trigger coordinate recalculation in store (which will update renderer via subscription)
                    ({ context, event }) => {
                      console.log('GanttMachine: Triggering coordinate recalculation with new time scale');
                      
                      const newDayWidth = (event as any)._calculatedDayWidth;
                      const newScrollX = (event as any)._newScrollX;
                      
                      // Send dayWidth update to store for coordinate recalculation
                      if (context.dataStore) {
                        console.log('GanttMachine: Sending dayWidth to store for timeline label recalculation', {
                          dayWidth: newDayWidth
                        });
                        context.dataStore.send({
                          type: 'setDayWidth',
                          dayWidth: newDayWidth
                        });
                      }
                      
                      // Send scroll position update directly to renderer
                      if (context.renderer) {
                        console.log('GanttMachine: Updating renderer scroll position', {
                          scrollX: newScrollX,
                          scrollY: context.viewport.scrollY
                        });
                        context.renderer.send({
                          type: 'UPDATE_SCROLL',
                          scrollX: newScrollX,
                          scrollY: context.viewport.scrollY
                        });
                      }
                    }
                  ]
                },
                DEPENDENCY_DRAG_START: {
                  actions: [
                    ({ context, event }) => {
                      console.log('GanttMachine: Dependency drag started', {
                        dependencyId: event.dependencyId,
                        handleType: event.handleType,
                        x: event.x,
                        y: event.y
                      });
                      // Store drag state for potential cancellation or completion
                    },
                  ],
                },
                DEPENDENCY_REASSIGN: {
                  actions: [
                    async ({ context, event }) => {
                      console.log('GanttMachine: Reassigning dependency', {
                        dependencyId: event.dependencyId,
                        handleType: event.handleType,
                        newTaskId: event.newTaskId
                      });
                      
                      // Use the entityDependencyService to reassign
                      try {
                        // Import the service
                        const { entityDependencyService } = await import('@/domain/entity-dependency-service');
                        
                        // Call the reassign method
                        await entityDependencyService.reassignDependency(
                          event.dependencyId,
                          event.handleType,
                          event.newTaskId
                        );
                        
                        console.log('GanttMachine: Dependency reassigned successfully');
                        
                        // Trigger a data refresh to update the UI
                        if (context.dataStore) {
                          context.dataStore.send({ type: 'REFRESH' });
                        }
                      } catch (error) {
                        console.error('GanttMachine: Failed to reassign dependency:', error);
                      }
                    },
                  ],
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
    
    // Scroll events - update viewport state directly
    SCROLL: {
      actions: [
        assign({
          viewport: ({ context, event }) => ({
            ...context.viewport,
            scrollX: event.scrollX,
            scrollY: event.scrollY,
          }),
        }),
        // Forward to renderer for visual updates
        ({ context, event }) => {
          if (context.renderer) {
            context.renderer.send({
              type: 'UPDATE_SCROLL',
              scrollX: event.scrollX,
              scrollY: event.scrollY,
            });
          }
        }
      ],
    },
    
    // Zoom events - handle directly with current scroll position
    ZOOM_REQUEST: {
      actions: [
        ({ context, event }) => {
          console.log('GanttMachine: Handling ZOOM_REQUEST directly', {
            direction: event.direction,
            anchorX: event.anchorX,
            currentScrollX: context.viewport.scrollX,
            currentScrollY: context.viewport.scrollY
          });
          
          const currentDayWidth = context.timelineLayout.dayWidth;
          const currentScrollX = context.viewport.scrollX;
          const anchorX = event.anchorX || 0;
          
          // Calculate new day width
          const ZOOM_STEP = 10;
          let newDayWidth = event.direction === 'in' 
            ? currentDayWidth + ZOOM_STEP 
            : currentDayWidth - ZOOM_STEP;
          
          newDayWidth = Math.max(5, Math.min(500, newDayWidth));
          
          console.log('GanttMachine: Zoom calculation', {
            currentDayWidth,
            newDayWidth,
            currentScrollX,
            anchorX
          });
          
          // Calculate viewport anchoring
          const scrollRatio = newDayWidth / currentDayWidth;
          const newScrollX = currentScrollX * scrollRatio;
          
          console.log('GanttMachine: Anchoring calculation', {
            scrollRatio,
            newScrollX
          });
          
          // Update timeline layout
          context.timelineLayout.dayWidth = newDayWidth;
          
          // Update viewport scroll position
          context.viewport.scrollX = newScrollX;
          
          // Note: The coordinate recalculation and renderer updates are handled
          // in the nested ZOOM_REQUEST action within the main state machine
          
          console.log('GanttMachine: Zoom complete, new state:', {
            dayWidth: context.timelineLayout.dayWidth,
            scrollX: context.viewport.scrollX
          });
        }
      ],
    },
    
    // Forward events from renderer
    SELECT_TASK: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received SELECT_TASK at root level', event),
        raise(({ event }) => ({
          type: 'TASK_SELECT',
          taskId: event.taskId,
          multi: event.multi
        }))
      ]
    },
    
    TASK_DRAG_START: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_DRAG_START at root level', event),
        raise(({ event }) => event)
      ]
    },
    
    TASK_DRAG_MOVE: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_DRAG_MOVE at root level', event),
        raise(({ event }) => event)
      ]
    },
    
    TASK_DRAG_END: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_DRAG_END at root level', event),
        raise(({ event }) => event)
      ]
    },
    
    TASK_RESIZE_START: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_RESIZE_START at root level', event),
        raise(({ event }) => event)
      ]
    },
    
    TASK_RESIZE_MOVE: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_RESIZE_MOVE at root level', event),
        raise(({ event }) => event)
      ]
    },
    
    TASK_RESIZE_END: {
      actions: [
        ({ event }) => console.log('GanttMachine: Received TASK_RESIZE_END at root level', event),
        raise(({ event }) => event)
      ]
    },
  },
});