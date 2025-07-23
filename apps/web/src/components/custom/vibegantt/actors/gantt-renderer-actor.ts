import { fromCallback, setup } from 'xstate';
import type { GanttMachineContext, RenderCommand } from '../types';
import { GanttRenderer } from '../renderers/core/GanttRenderer';

interface RendererInput {
  container?: HTMLElement;
  width?: number;
  height?: number;
  context?: GanttMachineContext;
  commands?: RenderCommand[];
}

interface RendererOutput {
  type: 'RENDER_COMPLETE' | 'RENDER_ERROR';
  error?: Error;
  metrics?: {
    renderTime: number;
    frameRate: number;
    commandsProcessed: number;
  };
}

export const ganttRendererActor = fromCallback<any, RendererInput>(({ 
  sendBack, 
  receive, 
  input,
  self
}) => {
  let renderer: GanttRenderer | null = null;
  let animationFrameId: number | null = null;
  let lastFrameTime = performance.now();
  let frameCount = 0;
  let containerReady = false;
  
  // Initialize renderer - follows VibeGridDex pattern
  const initRenderer = () => {
    // Get stored options from window (VibeGridDex pattern)
    const storedOptions = (window as any).__vibegantt_renderer_options || {};
    
    // Merge input with stored options, preferring input
    const mergedOptions = {
      ...storedOptions,
      ...input,
    };
    
    const container = mergedOptions.container;
    
    if (!container) {
      console.warn('GanttRendererActor: Container not yet available, waiting...');
      return;
    }
    
    if (containerReady) {
      console.warn('GanttRendererActor: Already initialized');
      return;
    }
    
    try {
      console.log('GanttRendererActor: Initializing with container:', {
        container,
        width: mergedOptions.width,
        height: mergedOptions.height,
        containerBounds: container.getBoundingClientRect()
      });
      
      renderer = new GanttRenderer(container);
      renderer.initialize();
      containerReady = true;
      
      // Notify parent that renderer is ready
      sendBack({ type: 'RENDERER_READY' });
      
      // Start render loop
      startRenderLoop();
      
      console.log('GanttRendererActor: Initialization complete');
    } catch (error) {
      console.error('GanttRendererActor: Initialization failed:', error);
      sendBack({
        type: 'RENDER_ERROR',
        error: error as Error,
      });
    }
  };
  
  // Render loop using requestAnimationFrame
  const startRenderLoop = () => {
    const renderFrame = (currentTime: number) => {
      // Calculate frame rate
      frameCount++;
      const deltaTime = currentTime - lastFrameTime;
      
      if (deltaTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / deltaTime);
        frameCount = 0;
        lastFrameTime = currentTime;
        
        // Update frame rate in renderer
        if (renderer) {
          renderer.setFrameRate(fps);
        }
      }
      
      // Continue render loop
      animationFrameId = requestAnimationFrame(renderFrame);
    };
    
    animationFrameId = requestAnimationFrame(renderFrame);
  };
  
  // Process render commands
  const processCommands = (commands: RenderCommand[]) => {
    if (!renderer) return;
    
    const startTime = performance.now();
    let processedCount = 0;
    
    try {
      // Sort commands by priority
      const sortedCommands = [...commands].sort((a, b) => b.priority - a.priority);
      
      // Process each command
      for (const command of sortedCommands) {
        switch (command.type) {
          case 'timeline':
            renderer.renderTimeline(command.data);
            break;
          case 'task':
            if (command.action === 'create') {
              renderer.createTask(command.data);
            } else if (command.action === 'update') {
              renderer.updateTask(command.data);
            } else if (command.action === 'delete') {
              renderer.deleteTask(command.data.id);
            }
            break;
          case 'dependency':
            if (command.action === 'create') {
              renderer.createDependency(command.data);
            } else if (command.action === 'delete') {
              renderer.deleteDependency(command.data.id);
            }
            break;
          case 'selection':
            renderer.updateSelection(command.data);
            break;
          case 'overlay':
            renderer.updateOverlay(command.data);
            break;
        }
        processedCount++;
      }
      
      const renderTime = performance.now() - startTime;
      
      sendBack({
        type: 'RENDER_COMPLETE',
        metrics: {
          renderTime,
          frameRate: Math.round(1000 / renderTime),
          commandsProcessed: processedCount,
        },
      });
    } catch (error) {
      sendBack({
        type: 'RENDER_ERROR',
        error: error as Error,
      });
    }
  };
  
  // Handle incoming events
  receive((event) => {
    switch (event.type) {
      case 'RENDER_FRAME':
        if (event.commands && event.commands.length > 0) {
          processCommands(event.commands);
        }
        break;
        
      case 'UPDATE_CONTEXT':
        if (renderer && event.context) {
          renderer.updateContext(event.context);
        }
        break;
        
      case 'RESIZE':
        if (renderer && event.width && event.height) {
          renderer.resize(event.width, event.height);
        }
        break;
        
      case 'DESTROY':
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        if (renderer) {
          renderer.destroy();
          renderer = null;
        }
        break;
    }
  });
  
  // Initialize on start
  initRenderer();
  
  // Cleanup function
  return () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    if (renderer) {
      renderer.destroy();
    }
  };
});