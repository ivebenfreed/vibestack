// ====================================
// ATOM SLICE - Atom subscription management
// ====================================

import { assign } from 'xstate';
import type { TableContext, TableEvents } from '../../../types';

// ====================================
// ATOM ACTIONS
// ====================================

export const atomActions = {
  // Set up atom subscriptions
  setupAtomSubscriptions: assign({
    atomUnsubscribers: ({ context, self }) => {
      console.log('🔄 AtomSlice: Setting up atom subscriptions');
      
      const unsubscribers: TableContext['atomUnsubscribers'] = {
        relationships: {}
      };
      
      // Subscribe to primary atom if available
      if (context.primaryAtom) {
        console.log('🔄 AtomSlice: Subscribing to primary atom');
        
        // Track if this is the first callback to skip initial data
        let isFirstCallback = true;
        
        // Keep track of previous state to detect changes
        let previousState = context.primaryAtom.get() || {};
        
        unsubscribers.primary = context.primaryAtom.subscribe((state: any) => {
          // Skip the first callback since we already have initial data
          if (isFirstCallback) {
            isFirstCallback = false;
            console.log('🔄 AtomSlice: Skipping initial primary atom callback');
            return;
          }
          
          // After initial load, all updates are individual entity changes
          // Compare to find what changed
          const currentIds = new Set(Object.keys(state || {}));
          const previousIds = new Set(Object.keys(previousState));
          
          // Find added, updated, and removed entities
          const added: any[] = [];
          const updated: any[] = [];
          const removed: string[] = [];
          
          // Check for added and updated
          currentIds.forEach(id => {
            if (!previousIds.has(id)) {
              added.push(state[id]);
            } else if (state[id] !== previousState[id]) {
              // Reference equality check - atoms typically replace objects
              updated.push(state[id]);
            }
          });
          
          // Check for removed
          previousIds.forEach(id => {
            if (!currentIds.has(id)) {
              removed.push(id);
            }
          });
          
          console.log('🔄 AtomSlice: Primary atom changes detected', {
            added: added.length,
            updated: updated.length,
            removed: removed.length,
            timestamp: performance.now()
          });
          
          // Send individual update events for each change
          updated.forEach(entity => {
            self.send({
              type: 'UPDATE_ENTITY',
              entity,
              entityId: entity.id
            });
          });
          
          added.forEach(entity => {
            self.send({
              type: 'ADD_ENTITY',
              entity
            });
          });
          
          removed.forEach(entityId => {
            self.send({
              type: 'REMOVE_ENTITY',
              entityId
            });
          });
          
          // Update previous state for next comparison
          previousState = state;
        });
      }
      
      // Subscribe to relationship atoms
      if (context.relationshipAtoms) {
        Object.entries(context.relationshipAtoms).forEach(([key, atom]) => {
          if (!atom) return;
          
          console.log(`🔄 AtomSlice: Subscribing to relationship atom: ${key}`);
          
          let isFirstCallback = true;
          
          unsubscribers.relationships[key] = atom.subscribe((state: any) => {
            if (isFirstCallback) {
              isFirstCallback = false;
              console.log(`🔄 AtomSlice: Skipping initial ${key} atom callback`);
              return;
            }
            
            console.log(`🔄 AtomSlice: ${key} atom updated`);
            
            // Determine relationship table name from key
            const relationshipTable = key === 'projects' ? 'project' : 
                                    key === 'users' ? 'user' : 
                                    key;
            
            // Send event to update relationship data
            self.send({
              type: 'UPDATE_RELATIONSHIP_DATA',
              relationshipTable,
              data: state || {}
            });
          });
        });
      }
      
      return unsubscribers;
    }
  }),
  
  // Clean up atom subscriptions
  cleanupAtomSubscriptions: ({ context }) => {
    console.log('🔄 AtomSlice: Cleaning up atom subscriptions');
    
    if (context.atomUnsubscribers) {
      // Unsubscribe from primary atom
      if (context.atomUnsubscribers.primary) {
        console.log('🔄 AtomSlice: Unsubscribing from primary atom');
        context.atomUnsubscribers.primary();
      }
      
      // Unsubscribe from relationship atoms
      Object.entries(context.atomUnsubscribers.relationships).forEach(([key, unsub]) => {
        console.log(`🔄 AtomSlice: Unsubscribing from ${key} atom`);
        if (typeof unsub === 'function') {
          unsub();
        }
      });
    }
  },
  
  // Update atoms from input (when atoms are passed from React)
  updateAtomsFromInput: assign({
    primaryAtom: (_, event: any) => event.primaryAtom,
    relationshipAtoms: (_, event: any) => event.relationshipAtoms
  })
};

// ====================================
// ATOM EVENT HANDLERS
// ====================================

export const atomHandlers = {
  // Handle atom configuration updates
  'UPDATE_ATOMS': {
    actions: [
      'cleanupAtomSubscriptions',
      'updateAtomsFromInput',
      'setupAtomSubscriptions'
    ]
  }
};