import React from 'react';
import { useSelector } from '@xstate/react';
import { ContextMenuManager } from './ContextMenu';

interface ContextMenuRendererProps {
  tableActor: any;
  containerRef: React.RefObject<HTMLDivElement>;
}

// Global context menu manager instance
let globalContextMenuManager: ContextMenuManager | null = null;

export function ContextMenuRenderer({ tableActor, containerRef }: ContextMenuRendererProps) {
  // Subscribe to context menu state from XState machine
  const contextMenuState = useSelector(tableActor, (state: any) => state.context.contextMenu);
  
  // Initialize context menu manager
  React.useEffect(() => {
    if (!containerRef.current) return;
    
    // Create or recreate manager if container changed
    if (!globalContextMenuManager || 
        (globalContextMenuManager as any).container !== containerRef.current) {
      
      if (globalContextMenuManager) {
        globalContextMenuManager.destroy();
      }
      
      console.log('🎯 ContextMenuRenderer: Creating ContextMenuManager', {
        container: containerRef.current,
        containerClass: containerRef.current.className
      });
      
      globalContextMenuManager = new ContextMenuManager(containerRef.current);
    }
    
    return () => {
      // Don't destroy on unmount - let it persist for the session
    };
  }, [containerRef.current]);
  
  // React to context menu state changes
  React.useEffect(() => {
    if (!globalContextMenuManager || !contextMenuState) return;
    
    console.log('🎯 ContextMenuRenderer: Context menu state changed', {
      isVisible: contextMenuState.isVisible,
      hasPosition: !!contextMenuState.position,
      hasContext: !!contextMenuState.context
    });
    
    if (contextMenuState.isVisible && contextMenuState.position && contextMenuState.context) {
      // Show context menu
      const contextMenuProps = {
        isVisible: true,
        position: contextMenuState.position,
        context: contextMenuState.context,
        onClose: () => tableActor.send({ type: 'contextmenu.hide' }),
        onCopy: () => tableActor.send({ type: 'contextmenu.copy' }),
        onPaste: () => tableActor.send({ type: 'contextmenu.paste' }),
        onCut: () => tableActor.send({ type: 'contextmenu.cut' }),
        onInsertRow: () => tableActor.send({ type: 'contextmenu.insert.row' }),
        onDeleteRow: () => tableActor.send({ type: 'contextmenu.delete.row' })
      };
      
      console.log('🎯 ContextMenuRenderer: Showing context menu with props', contextMenuProps);
      globalContextMenuManager.show(contextMenuProps);
    } else if (!contextMenuState.isVisible) {
      // Hide context menu
      console.log('🎯 ContextMenuRenderer: Hiding context menu');
      globalContextMenuManager.hide();
    }
  }, [contextMenuState, tableActor]);
  
  // This component renders nothing - it just manages the context menu state
  return null;
}