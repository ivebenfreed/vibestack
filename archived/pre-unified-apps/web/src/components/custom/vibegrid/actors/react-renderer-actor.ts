import { fromCallback } from 'xstate';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ReactRenderer } from '../renderers/ReactRenderer';
import type { RenderState, ViewportInfo } from '../types';
import { uiLog } from '@/logger';
const log = uiLog('components/custom/vibegrid/actors/react-renderer-actor.ts');

export const reactRendererActor = fromCallback(({ sendBack, receive }) => {
  let root: Root | null = null;
  let container: HTMLElement | null = null;
  let isInitialized = false;
  let lastRenderState: RenderState | null = null;
  
  log.info('🚀 ReactRendererActor: Actor created');
  
  const render = () => {
    if (!root || !container || !lastRenderState) return;
    
    root.render(
      React.createElement(ReactRenderer, {
        renderState: lastRenderState,
        container,
        onScroll: (viewport: ViewportInfo) => {
          sendBack({
            type: 'VIEWPORT_CHANGED',
            viewport
          });
        },
        onCellClick: (rowId: string, columnId: string) => {
          sendBack({
            type: 'CELL_CLICKED',
            rowId,
            columnId
          });
        },
        onCellDoubleClick: (rowId: string, columnId: string) => {
          sendBack({
            type: 'CELL_DOUBLE_CLICKED',
            rowId,
            columnId
          });
        },
        onColumnClick: (columnId: string) => {
          sendBack({
            type: 'COLUMN_CLICKED',
            columnId
          });
        }
      })
    );
  };
  
  receive((event) => {
    log.info('🚀 ReactRendererActor: Event received:', event.type);
    
    switch (event.type) {
      case 'INITIALIZE': {
        if (!isInitialized && event.options?.container) {
          try {
            container = event.options.container;
            
            // Clear any existing content
            container.innerHTML = '';
            
            // Create React root
            root = createRoot(container);
            isInitialized = true;
            
            log.info('🚀 ReactRendererActor: Initialized successfully');
            
            // Notify table machine that renderer is ready
            sendBack({ type: 'RENDERER_READY' });
            
            // Check for canvas container
            setTimeout(() => {
              const canvasContainer = container?.querySelector('.vibegridx-canvas-overlay-container');
              if (canvasContainer) {
                sendBack({
                  type: 'CANVAS_CONTAINER_READY',
                  container: canvasContainer
                });
              }
            }, 0);
          } catch (error) {
            log.error('ReactRendererActor: Failed to initialize', error);
            sendBack({
              type: 'RENDERER_ERROR',
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
        break;
      }
      
      case 'RENDER': {
        if (!root || !container) {
          log.error('ReactRendererActor: Cannot render - not initialized');
          sendBack({
            type: 'RENDERER_ERROR',
            error: 'Renderer not initialized'
          });
          return;
        }
        
        if (!event.state) {
          log.error('ReactRendererActor: Cannot render - no state provided');
          sendBack({
            type: 'RENDERER_ERROR',
            error: 'No render state provided'
          });
          return;
        }
        
        log.info('🚀 ReactRendererActor: Rendering', {
          rowCount: event.state.rows?.length || 0,
          columnCount: event.state.columns?.length || 0
        });
        
        try {
          lastRenderState = event.state;
          render();
          
          sendBack({
            type: 'RENDER_COMPLETE',
            duration: 0 // React handles timing internally
          });
        } catch (error) {
          log.error('🔥 ReactRendererActor: Render failed', error);
          sendBack({
            type: 'RENDERER_ERROR',
            error: error instanceof Error ? error.message : 'Unknown render error'
          });
        }
        break;
      }
      
      case 'SCROLL_TO_ROW': {
        // TODO: Implement scroll to row
        break;
      }
      
      case 'GET_VIEWPORT': {
        // TODO: Implement get viewport
        break;
      }
    }
  });
  
  // Cleanup
  return () => {
    log.info('🚀 ReactRendererActor: Cleaning up');
    if (root) {
      root.unmount();
      root = null;
    }
    container = null;
    isInitialized = false;
  };
});