import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMachine } from '@xstate/react';
import { ganttMachine } from './machines/gantt-machine';
import type { VibeGanttProps, GanttEvent } from './types';
import { DEFAULT_VIEW_CONFIG } from './constants';
import './vibegantt.css';

export function VibeGantt({
  projectId,
  domainService,
  viewConfig = {},
  className = '',
  height = 600,
  initialData,
}: VibeGanttProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererInitializedRef = useRef(false);
  
  // Create merged view config
  const mergedViewConfig = useMemo(
    () => ({ ...DEFAULT_VIEW_CONFIG, ...viewConfig }),
    [viewConfig]
  );
  
  // Initialize machine with project ID and domain service
  const [state, send, actor] = useMachine(ganttMachine, {
    input: {
      projectId,
      domainService,
      initialData,
    },
  });
  
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
      
      // Event manager is now handled by the renderer itself
      // The renderer has direct access to the task elements it creates
      
      rendererInitializedRef.current = true;
    }
    containerRef.current = node;
  }, [send, handleGanttEvent, height]);
  
  // The store will handle data loading, no need to pass tasks/dependencies
  
  // Zoom is now handled directly by the renderer

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
  
  // Domain service handles all updates through the machine
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Event manager cleanup not needed - handled by renderer
      
      // Clean up global references
      delete (window as any).__vibegantt_renderer_options;
      delete (window as any).__vibegantt_store_actor;
    };
  }, []);
  
  // Render
  return (
    <div
      ref={containerRefCallback}
      className={`vibegantt ${className}`}
      data-testid="vibegantt-container"
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
export type { GanttTask, TaskDependency, GanttViewConfig, Resource } from './types';