import { setup, assign } from 'xstate';
import { authMachine, type AuthContext } from './machines/auth-machine';
import { appInitMachine, type AppInitContext } from './machines/app-init-machine';
import type { UserInfo } from './types';

export interface OrchestratorV2Context {
  // Pure event coordinator - no mirrored state
  lastActivity: number;
}

export type OrchestratorV2Event =
  // Event coordination only
  | { type: 'START_INIT' }
  | { type: 'RESET_INIT' };

export const orchestratorV2 = setup({
  types: {
    context: {} as OrchestratorV2Context,
    events: {} as OrchestratorV2Event,
  },
  
  actors: {
    authMachine,
    appInitMachine,
  },
  
  actions: {
    // Pure event coordination - no state mirroring
  },
}).createMachine({
  id: 'orchestratorV2',
  
  context: {
    lastActivity: Date.now(),
  },
  
  initial: 'running',
  
  invoke: [
    {
      id: 'appInitMachine',
      src: 'appInitMachine',
      // Let app init machine handle its own persistence
      // No snapshot polling - pure event coordination
    }
  ],
  
  on: {
    
    // Forward init events to init machine
    START_INIT: {
      actions: ({ self }) => {
        console.log('[OrchestratorV2] Forwarding START_INIT event to appInitMachine');
        const initActor = self.getSnapshot().children.appInitMachine;
        if (initActor) {
          initActor.send({ type: 'START_INIT' });
        } else {
          console.error('[OrchestratorV2] AppInitMachine actor not found');
        }
      }
    },
    
    RESET_INIT: {
      actions: ({ self }) => {
        console.log('[OrchestratorV2] Forwarding RESET event to appInitMachine');
        const initActor = self.getSnapshot().children.appInitMachine;
        if (initActor) {
          initActor.send({ type: 'RESET' });
        } else {
          console.error('[OrchestratorV2] AppInitMachine actor not found');
        }
      }
    },
    
    // No internal state updates - pure event coordination
  },
  
  states: {
    running: {
      entry: () => console.log('[OrchestratorV2] Started - coordinating auth and init machines'),
      
      // No complex auto-start logic - just reactive coordination
      // AppInitMachine is triggered by AUTH_STATE_CHANGED → triggerInitIfAuthenticated
    }
  },
});