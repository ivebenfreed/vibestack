// ====================================
// CONTEXT MENU EVENT HANDLERS
// ====================================

import { assign } from 'xstate';
import type { TableContext, TableEvents } from '../../../types';
import { ContextMenuManager, type ContextMenuProps } from '../../../components/ContextMenu';

// Global context menu manager instance - managed directly without actor wrapper
let globalContextMenuManager: ContextMenuManager | null = null;

// Helper function to ensure context menu manager is initialized
function ensureContextMenuManager(context: any): ContextMenuManager {
  // Always check if container has changed - recreate manager if needed
  let container = context.canvasContainer || context.containerElement;
  
  if (!container) {
    // Try to find the vibegridx body container
    container = document.querySelector('[data-vibegridx-container]') || 
               document.querySelector('.vibegridx-body') ||
               document.querySelector('.vibegridx-container') ||
               document.querySelector('.vibegridx-renderer');
  }
  
  if (!container) {
    throw new Error('ContextMenuHandlers: No container found for context menu overlay. Available containers: ' + 
      Array.from(document.querySelectorAll('[class*="vibegridx"]')).map(el => el.className).join(', '));
  }
  
  // Check if we need to recreate the manager (container changed or not initialized)
  const needsRecreation = !globalContextMenuManager || 
                         (globalContextMenuManager as any).container !== container ||
                         !document.contains((globalContextMenuManager as any).container);
  
  if (needsRecreation) {
    // Clean up existing manager if any
    if (globalContextMenuManager) {
      console.log('ContextMenuHandlers: Container changed, cleaning up old ContextMenuManager');
      globalContextMenuManager.destroy();
      globalContextMenuManager = null;
    }
    
    console.log('ContextMenuHandlers: Creating new ContextMenuManager', {
      container,
      containerClass: container.className,
      containerInDOM: document.contains(container),
      containerVisible: container.offsetWidth > 0 && container.offsetHeight > 0,
      containerBounds: container.getBoundingClientRect()
    });
    
    globalContextMenuManager = new ContextMenuManager(container);
    
    console.log('ContextMenuHandlers: Created new ContextMenuManager instance', {
      manager: globalContextMenuManager,
      hasPortal: !!(globalContextMenuManager as any).portal,
      containerChildCount: container.childNodes.length
    });
  }
  
  return globalContextMenuManager;
}

// Cleanup function for context menu manager
function cleanupContextMenuManager(): void {
  if (globalContextMenuManager) {
    globalContextMenuManager.destroy();
    globalContextMenuManager = null;
    console.log('ContextMenuHandlers: Cleaned up ContextMenuManager instance');
  }
}

export const contextMenuHandlers = {
  'contextmenu.show': {
    actions: [
      assign({
        contextMenu: ({ event }) => ({
          isVisible: true,
          position: {
            x: event.x,
            y: event.y,
            clientX: event.clientX,
            clientY: event.clientY
          },
          context: {
            type: 'cell' as const,
            rowId: event.rowId,
            columnId: event.columnId
          }
        })
      }),
      // Log that context menu state was updated - the UI will reactively show the menu
      ({ context, event }) => {
        console.log('🎯 ContextMenuHandlers: Context menu state updated', { 
          event, 
          contextMenu: {
            isVisible: true,
            position: { x: event.x, y: event.y, clientX: event.clientX, clientY: event.clientY },
            context: { type: 'cell', rowId: event.rowId, columnId: event.columnId }
          }
        });
      }
    ]
  },

  'contextmenu.show.header': {
    actions: [
      assign({
        contextMenu: ({ event }) => ({
          isVisible: true,
          position: {
            x: event.x,
            y: event.y,
            clientX: event.clientX,
            clientY: event.clientY
          },
          context: {
            type: 'header' as const,
            columnId: event.columnId
          }
        })
      })
    ]
  },

  'contextmenu.show.general': {
    actions: [
      assign({
        contextMenu: ({ event }) => ({
          isVisible: true,
          position: {
            x: event.x,
            y: event.y,
            clientX: event.clientX,
            clientY: event.clientY
          },
          context: {
            type: 'general' as const
          }
        })
      })
    ]
  },

  'contextmenu.hide': {
    actions: [
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // Log that context menu was hidden - the UI will reactively hide the menu
      () => {
        console.log('🎯 ContextMenuHandlers: Context menu hidden');
      }
    ]
  },

  // Context menu actions - these delegate to existing handlers
  'contextmenu.copy': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // Delegate to existing copy handler by sending the event
      ({ self }) => {
        self.send({ type: 'keyboard.copy' });
      }
    ]
  },

  'contextmenu.paste': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // Delegate to existing paste handler by sending the event
      ({ self }) => {
        self.send({ type: 'keyboard.paste' });
      }
    ]
  },

  'contextmenu.cut': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // Copy first, then delete by sending the events
      ({ self }) => {
        self.send({ type: 'keyboard.copy' });
        self.send({ type: 'keyboard.delete' });
      }
    ]
  },

  'contextmenu.insert.row': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // TODO: Implement row insertion
      ({ context }: { context: TableContext }) => {
        console.log('🎯 ContextMenu: Insert row requested', { context: context.contextMenu.context });
        // This would delegate to row insertion logic
      }
    ]
  },

  'contextmenu.delete.row': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // TODO: Implement row deletion
      ({ context }: { context: TableContext }) => {
        console.log('🎯 ContextMenu: Delete row requested', { context: context.contextMenu.context });
        // This would delegate to row deletion logic
      }
    ]
  },

  'contextmenu.insert.column': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // TODO: Implement column insertion
      ({ context }: { context: TableContext }) => {
        console.log('🎯 ContextMenu: Insert column requested', { context: context.contextMenu.context });
        // This would delegate to column insertion logic
      }
    ]
  },

  'contextmenu.delete.column': {
    actions: [
      // Hide context menu first
      assign({
        contextMenu: {
          isVisible: false,
          position: null,
          context: null
        }
      }),
      // TODO: Implement column deletion
      ({ context }: { context: TableContext }) => {
        console.log('🎯 ContextMenu: Delete column requested', { context: context.contextMenu.context });
        // This would delegate to column deletion logic
      }
    ]
  }
} as const;

export { cleanupContextMenuManager };