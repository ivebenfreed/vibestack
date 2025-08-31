import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { ganttMachineStoreIntegrated } from './machines/gantt-machine/gantt-machine-store-integrated';
import { GanttEventDelegationManager } from './systems/GanttEventDelegationManager';
import { useGanttData } from './hooks/useGanttData';
import type { VibeGanttProps, GanttEvent } from './types';
import { DEFAULT_VIEW_CONFIG } from './constants';

/**
 * VibeGantt component with integrated store data loading
 * This version uses the atomic store pattern like VibeGridDex
 */
export function VibeGanttStoreIntegrated({
  projectId,
  viewConfig = {},
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onDependencyCreate,
  onDependencyDelete,
  className = '',
  height = 600,
}: Omit<VibeGanttProps, 'tasks' | 'dependencies' | 'resources'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eventManagerRef = useRef<GanttEventDelegationManager | null>(null);
  const rendererInitializedRef = useRef(false);
  
  // Use the store hook to get pre-loaded and resolved data
  const {
    taskTree,
    taskMap,
    dependencies,
    dependencyMap,
    criticalPath,
    loading,
    error,
    expandedTasks,
    selectedTasks,
    visibleDateRange,
    zoom,
    showWeekends,
    showDependencies,
    toggleTaskExpanded,
    setSelectedTasks,
    setVisibleDateRange,
    setZoom,
    setShowWeekends,
    setShowDependencies,
    getVisibleTasks,
    storeActor
  } = useGanttData(projectId);
  
  // Create merged view config
  const mergedViewConfig = useMemo(
    () => ({ 
      ...DEFAULT_VIEW_CONFIG, 
      ...viewConfig,
      zoom,
      showWeekends,
      showDependencies
    }),
    [viewConfig, zoom, showWeekends, showDependencies]
  );
  
  // Initialize machine with store reference
  const [state, send, actor] = useMachine(ganttMachineStoreIntegrated, {
    input: { projectId, storeActor }
  });
  
  // Handle event delegation
  const handleGanttEvent = useCallback((event: GanttEvent) => {
    // Some events should go to the store, others to the machine
    switch (event.type) {
      case 'TOGGLE_TASK_EXPANDED':
        toggleTaskExpanded(event.taskId);
        break;
      case 'SELECT_TASK':
        setSelectedTasks([event.taskId]);
        break;
      case 'MULTI_SELECT_TASK':
        // Add to existing selection
        const newSelection = new Set(selectedTasks);
        if (newSelection.has(event.taskId)) {
          newSelection.delete(event.taskId);
        } else {
          newSelection.add(event.taskId);
        }
        setSelectedTasks(Array.from(newSelection));
        break;
      case 'SET_ZOOM':
        setZoom(event.zoom);
        break;
      case 'SET_VISIBLE_DATE_RANGE':
        setVisibleDateRange(event.range);
        break;
      default:
        // Forward other events to the machine
        send(event);
    }
  }, [send, toggleTaskExpanded, setSelectedTasks, selectedTasks, setZoom, setVisibleDateRange]);
  
  // Container ref callback - follows VibeGridDex pattern
  const containerRefCallback = useCallback((node: HTMLDivElement | null) => {
    if (node && !rendererInitializedRef.current) {
      // Store options globally for actor access (VibeGridDex pattern)
      (window as any).__vibegantt_renderer_options = {
        container: node,
        width: node.clientWidth || 1000,
        height: height,
      };
      
      // Send synchronous initialization to gantt machine
      send({
        type: 'INITIALIZE_RENDERER',
        options: {
          container: node,
          width: node.clientWidth || 1000,
          height: height,
        }
      });
      
      // Initialize event manager
      if (!eventManagerRef.current) {
        eventManagerRef.current = new GanttEventDelegationManager(node, handleGanttEvent);
      }
      
      rendererInitializedRef.current = true;
    }
    containerRef.current = node;
  }, [send, handleGanttEvent, height]);
  
  // The machine subscribes to store updates directly - no need to send data manually
  
  // Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        send({
          type: 'VIEWPORT_RESIZE',
          width,
          height,
        });
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => {
      resizeObserver.disconnect();
    };
  }, [send]);
  
  // Subscribe to machine events for external callbacks
  useEffect(() => {
    const subscription = actor.subscribe((snapshot) => {
      // Handle task updates
      if (snapshot.event?.type === 'TASK_UPDATE' && onTaskUpdate) {
        const task = taskMap.get(snapshot.event.taskId);
        if (task) {
          onTaskUpdate({
            id: task.id,
            name: task.title || 'Untitled Task',
            plannedStartDate: task.plannedStartDate,
            plannedEndDate: task.plannedEndDate,
            progress: task.progress || 0,
            assigneeId: task.assigneeId,
            parentId: task.parentId,
            color: task.color,
            priority: task.priority || 'medium',
          });
        }
      }
      
      // Handle other events...
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [actor, taskMap, onTaskUpdate, onTaskCreate, onTaskDelete, onDependencyCreate, onDependencyDelete]);
  
  // Loading state
  if (loading) {
    return (
      <div className={`vibegantt ${className}`} style={{ height: `${height}px` }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading gantt data...</div>
        </div>
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className={`vibegantt ${className}`} style={{ height: `${height}px` }}>
        <div className="flex items-center justify-center h-full">
          <div className="text-destructive">Error: {error}</div>
        </div>
      </div>
    );
  }
  
  // Render
  return (
    <div
      ref={containerRefCallback}
      className={`vibegantt ${className}`}
      tabIndex={0}
      style={{
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
        outline: 'none',
      }}
    >
      {/* The renderer actor will handle all DOM rendering */}
      {/* This component just provides the container */}
    </div>
  );
}

// Export types for consumers
export type { GanttTask, TaskDependency, GanttViewConfig } from './types';