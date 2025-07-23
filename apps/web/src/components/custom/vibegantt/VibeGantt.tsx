import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { ganttMachine } from './machines/gantt-machine';
import { GanttEventDelegationManager } from './systems/GanttEventDelegationManager';
import type { VibeGanttProps, GanttEvent } from './types';
import { DEFAULT_VIEW_CONFIG } from './constants';

export function VibeGantt({
  tasks,
  dependencies = [],
  resources = [],
  viewConfig = {},
  onTaskUpdate,
  onTaskCreate,
  onTaskDelete,
  onDependencyCreate,
  onDependencyDelete,
  className = '',
  height = 600,
}: VibeGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const eventManagerRef = useRef<GanttEventDelegationManager | null>(null);
  const rendererInitializedRef = useRef(false);
  
  // Create merged view config
  const mergedViewConfig = useMemo(
    () => ({ ...DEFAULT_VIEW_CONFIG, ...viewConfig }),
    [viewConfig]
  );
  
  // Initialize machine
  const [state, send, actor] = useMachine(ganttMachine);
  
  // Handle event delegation
  const handleGanttEvent = useCallback((event: GanttEvent) => {
    send(event);
  }, [send]);
  
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
  
  // Initialize with data after renderer is ready
  useEffect(() => {
    if (rendererInitializedRef.current) {
      send({
        type: 'INITIALIZE',
        tasks,
        dependencies,
      });
    }
  }, [tasks, dependencies, send]);
  
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
        const task = snapshot.context.tasks.get(snapshot.event.taskId);
        if (task) {
          onTaskUpdate(task);
        }
      }
      
      // Handle other events...
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, [actor, onTaskUpdate, onTaskCreate, onTaskDelete, onDependencyCreate, onDependencyDelete]);
  
  // Render
  return (
    <div
      ref={containerRefCallback}
      className={`vibegantt ${className}`}
      style={{
        height: `${height}px`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* The renderer actor will handle all DOM rendering */}
      {/* This component just provides the container */}
    </div>
  );
}

// Export types for consumers
export type { GanttTask, TaskDependency, GanttViewConfig } from './types';