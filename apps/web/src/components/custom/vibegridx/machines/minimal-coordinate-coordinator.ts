/**
 * Minimal Coordinate Coordinator
 * 
 * This is a temporary placeholder that satisfies the architectural requirement
 * for a coordinate coordinator actor.
 * 
 * Key findings from investigation:
 * - The coordinator MUST be spawned for rendering to work
 * - The coordinator MUST be initialized with 'coordinate.initialize' event
 * - The coordinator does NOT need async initialization
 * - The coordinator does NOT need to send 'coordinate.manager.ready'
 * - The rendering actually depends on:
 *   1. Version change (from SET_VISIBLE_ENTITIES)
 *   2. View coordinator being in 'idle' state
 * 
 * The coordinator appears to be a vestigial architectural component that
 * should be removed in a future refactor. The real coordinate management
 * is handled by the coordinateManager in the table machine context.
 */

import { setup } from 'xstate';

// Minimal coordinator that does nothing but satisfy the spawn requirement
export const minimalCoordinateCoordinatorMachine = setup({
  types: {
    context: {} as {},
    events: {} as 
      | { type: 'coordinate.initialize' }
      | { type: '*' }
  }
}).createMachine({
  id: 'minimalCoordinateCoordinator',
  
  initial: 'ready',
  
  context: {},
  
  states: {
    ready: {
      on: {
        // Accept all events but do nothing
        '*': {}
      }
    }
  }
});