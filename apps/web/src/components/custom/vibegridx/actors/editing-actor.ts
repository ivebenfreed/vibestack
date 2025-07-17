// ====================================
// VIBEGRIDX EDITING ACTOR
// ====================================
//
// XState callback actor that wraps the EditingOverlay
// for proper actor model integration. Handles React portal
// editing lifecycle and editor management.
//
// This follows the exact same pattern as canvasActor
// and ensures all updates flow through XState events.
//
// ====================================

import { fromCallback } from 'xstate';
import { EditingOverlay } from '../overlays/EditingOverlay';
import type { CellRef, Column, ViewportInfo } from '../types';
import type { VisualCellPosition } from '../overlays/OverlayTypes';

// ====================================
// EVENT TYPES
// ====================================

export type EditingActorEvent = 
  | { type: 'INITIALIZE'; container: HTMLElement; config: Partial<EditingOverlayConfig> }
  | { type: 'SHOW_EDITOR'; cell: CellRef; column: Column; value: any; position: VisualCellPosition; mode?: 'single-click' | 'double-click' | 'keyboard' }
  | { type: 'HIDE_EDITOR' }
  | { type: 'UPDATE_EDITOR_VALUE'; value: any }
  | { type: 'UPDATE_EDITOR_VALIDATION'; errors: Map<string, string> }
  | { type: 'DESTROY' };

export type EditingActorResponse =
  | { type: 'EDITING_READY' }
  | { type: 'EDITING_DEFERRED_READY' }
  | { type: 'EDITOR_SHOWN' }
  | { type: 'EDITOR_HIDDEN' }
  | { type: 'EDITOR_VALUE_UPDATED' }
  | { type: 'EDITOR_VALIDATION_UPDATED' }
  | { type: 'EDIT_UPDATE'; value: any }
  | { type: 'EDIT_COMMIT'; value: any }
  | { type: 'EDIT_CANCEL' }
  | { type: 'EDITING_ERROR'; error: string };

interface EditingOverlayConfig {
  onUpdate: (value: any) => void;
  onCommit: (value: any) => void;
  onCancel: () => void;
  zIndex?: number;
  relationshipContext?: {
    relationshipResolvers?: Record<string, (id: string | string[]) => string>;
    relationshipAtoms?: Record<string, any>;
  };
}

// ====================================
// EDITING ACTOR
// ====================================

export const editingActor = fromCallback<EditingActorEvent, EditingActorResponse>(({ sendBack, receive }) => {
  let editingOverlay: EditingOverlay | null = null;
  let isInitializing = false;
  let isInitialized = false;
  let pendingShowEditor: EditingActorEvent | null = null;
  
  console.log('EditingActor: Created for embedded mode');
  
  receive((event) => {
    console.log('EditingActor: Received event:', event.type, event);
    
    try {
      switch (event.type) {
        case 'INITIALIZE':
          const initStartTime = performance.now();
          console.log('EditingActor: Deferring editing overlay initialization', {
            container: event.container,
            containerClass: event.container.className,
            containerInDOM: document.contains(event.container),
            containerVisible: event.container.offsetWidth > 0 && event.container.offsetHeight > 0,
            containerBounds: event.container.getBoundingClientRect(),
            config: event.config
          });
          
          // Store config for deferred initialization
          const storedConfig = event.config;
          const storedContainer = event.container;
          
          // Mark as initializing
          isInitializing = true;
          
          // Send ready immediately to unblock table rendering
          sendBack({ type: 'EDITING_READY' });
          
          // Initialize editing overlay when browser is idle
          const initializeEditingOverlay = async () => {
            try {
              console.log('EditingActor: Starting deferred editing overlay initialization');
              const deferredStartTime = performance.now();
              
              // Create the editing overlay with callbacks
              const editingOverlayConfig = {
                // Don't pass onUpdate - we don't need real-time updates
                // This prevents re-renders on every keypress
                onCommit: (value: any) => sendBack({ type: 'EDIT_COMMIT', value }),
                onCancel: () => sendBack({ type: 'EDIT_CANCEL' }),
                zIndex: 1000,
                relationshipContext: storedConfig.relationshipContext,
                ...storedConfig
              };
              
              editingOverlay = new EditingOverlay(storedContainer, editingOverlayConfig);
              
              const deferredInitTime = performance.now() - deferredStartTime;
              console.log('🔥 EditingActor: Deferred editing overlay initialization complete', {
                initTime: `${deferredInitTime.toFixed(2)}ms`,
                totalTimeFromInitialize: `${(performance.now() - initStartTime).toFixed(2)}ms`
              });
              
              isInitialized = true;
              isInitializing = false;
              sendBack({ type: 'EDITING_DEFERRED_READY' });
              
              // Process any pending show editor event
              if (pendingShowEditor && pendingShowEditor.type === 'SHOW_EDITOR') {
                console.log('EditingActor: Processing pending SHOW_EDITOR event');
                const pending = pendingShowEditor;
                pendingShowEditor = null;
                
                editingOverlay.showAt(
                  pending.position,
                  pending.cell,
                  pending.column,
                  pending.value,
                  undefined, // validationErrors
                  pending.mode
                );
                
                sendBack({ type: 'EDITOR_SHOWN' });
              }
            } catch (error) {
              console.error('EditingActor: Failed to create editing overlay:', error);
              sendBack({ 
                type: 'EDITING_ERROR', 
                error: `Failed to initialize editing overlay: ${error.message}` 
              });
            }
          };
          
          // Use requestIdleCallback if available, otherwise fall back to setTimeout
          if ('requestIdleCallback' in window) {
            requestIdleCallback(initializeEditingOverlay, { timeout: 100 });
          } else {
            setTimeout(initializeEditingOverlay, 16); // ~1 frame
          }
          break;
          
        case 'SHOW_EDITOR':
          if (!editingOverlay) {
            if (isInitializing && !isInitialized) {
              // Queue the event to be processed after initialization
              console.log('EditingActor: Queueing SHOW_EDITOR event during initialization');
              pendingShowEditor = event;
              return;
            } else {
              console.warn('EditingActor: Cannot show editor - editing overlay not initialized');
              sendBack({ type: 'EDITING_ERROR', error: 'Editing overlay not initialized' });
              return;
            }
          }
          
          console.log('EditingActor: Showing editor:', {
            cell: event.cell,
            column: event.column.id,
            position: event.position,
            mode: event.mode
          });
          
          editingOverlay.showAt(
            event.position,
            event.cell,
            event.column,
            event.value,
            undefined, // validationErrors
            event.mode
          );
          
          sendBack({ type: 'EDITOR_SHOWN' });
          break;
          
        case 'HIDE_EDITOR':
          if (!editingOverlay) {
            console.warn('EditingActor: Cannot hide editor - editing overlay not initialized');
            return;
          }
          
          console.log('EditingActor: Hiding editor');
          editingOverlay.hide();
          sendBack({ type: 'EDITOR_HIDDEN' });
          break;
          
        case 'UPDATE_EDITOR_VALUE':
          if (!editingOverlay) {
            console.warn('EditingActor: Cannot update editor value - editing overlay not initialized');
            return;
          }
          
          console.log('EditingActor: Updating editor value:', event.value);
          // EditingOverlay doesn't have an updateValue method, so we'll skip this for now
          // The editor will handle its own value updates
          sendBack({ type: 'EDITOR_VALUE_UPDATED' });
          break;
          
        case 'UPDATE_EDITOR_VALIDATION':
          if (!editingOverlay) {
            console.warn('EditingActor: Cannot update editor validation - editing overlay not initialized');
            return;
          }
          
          console.log('EditingActor: Updating editor validation:', event.errors);
          // EditingOverlay doesn't have a validation update method, so we'll skip this for now
          sendBack({ type: 'EDITOR_VALIDATION_UPDATED' });
          break;
          
        case 'DESTROY':
          console.log('EditingActor: Destroying editing overlay');
          
          if (editingOverlay) {
            editingOverlay.destroy();
            editingOverlay = null;
          }
          break;
          
        default:
          console.warn('EditingActor: Unknown event type:', event);
          sendBack({ type: 'EDITING_ERROR', error: `Unknown event: ${event.type}` });
      }
    } catch (error) {
      console.error('EditingActor: Error processing event:', error);
      sendBack({ 
        type: 'EDITING_ERROR', 
        error: `Error processing ${event.type}: ${error.message}` 
      });
    }
  });
  
  // Cleanup function - called when actor is stopped
  return () => {
    console.log('EditingActor: Cleanup - destroying editing overlay');
    
    if (editingOverlay) {
      editingOverlay.destroy();
      editingOverlay = null;
    }
  };
});

// ====================================
// UTILITY FUNCTIONS
// ====================================

/**
 * Type guard to check if an event is an editing actor event
 */
export function isEditingActorEvent(event: any): event is EditingActorEvent {
  return event && typeof event.type === 'string' && 
    [
      'INITIALIZE', 'SHOW_EDITOR', 'HIDE_EDITOR', 'UPDATE_EDITOR_VALUE',
      'UPDATE_EDITOR_VALIDATION', 'DESTROY'
    ].includes(event.type);
}

/**
 * Type guard to check if a response is an editing actor response
 */
export function isEditingActorResponse(response: any): response is EditingActorResponse {
  return response && typeof response.type === 'string' && 
    [
      'EDITING_READY', 'EDITING_DEFERRED_READY', 'EDITOR_SHOWN', 'EDITOR_HIDDEN',
      'EDITOR_VALUE_UPDATED', 'EDITOR_VALIDATION_UPDATED', 'EDIT_UPDATE', 'EDIT_COMMIT', 
      'EDIT_CANCEL', 'EDITING_ERROR'
    ].includes(response.type);
}