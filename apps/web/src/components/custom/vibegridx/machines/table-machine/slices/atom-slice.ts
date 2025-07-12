// ====================================
// ATOM SLICE - Generic Atom Subscription Management
// ====================================

import { assign } from 'xstate';

// ====================================
// CONFIGURATION TYPES
// ====================================

export interface AtomGetter {
  get: () => Record<string, any>;
  subscribe: (callback: (value: Record<string, any>) => void) => () => void;
}

export interface AtomSliceConfig {
  primaryAtom: AtomGetter;
  relationshipAtoms?: Record<string, AtomGetter>;
}

// ====================================
// STATE INTERFACE
// ====================================

export interface AtomState {
  // Entity data from atoms
  entities: any[];
  allRowIds: string[];
  entityRecords: Record<string, any>;
  
  // Atom configuration
  atomConfig: AtomSliceConfig | null;
  
  // Atom subscriptions
  atomUnsubscribes: Map<string, () => void>;
  
  // Tracking
  lastAtomUpdate: number;
  atomUpdateCount: number;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialAtomState = (atomConfig?: AtomSliceConfig | null): AtomState => ({
  entities: [],
  allRowIds: [],
  entityRecords: {},
  atomConfig: atomConfig || null,
  atomUnsubscribes: new Map(),
  lastAtomUpdate: 0,
  atomUpdateCount: 0
});

// ====================================
// ACTIONS
// ====================================

export const atomActions = {
  setupPrimaryAtomSubscription: assign({
    atomUnsubscribes: ({ context, self }: any) => {
      const atomConfig = context.atomConfig;
      if (!atomConfig?.primaryAtom) {
        console.log('AtomSlice: No primary atom configured');
        return context.atomUnsubscribes;
      }

      console.log('AtomSlice: Setting up primary atom subscription');
      
      // Get initial data
      const initialData = atomConfig.primaryAtom.get();
      const dataArray = Object.values(initialData);
      console.log('AtomSlice: Initial data:', dataArray.length);
      
      // Delay initial update to ensure machine is in active state
      if (dataArray.length > 0) {
        setTimeout(() => {
          console.log('AtomSlice: Sending initial data update');
          self.send({
            type: 'ATOM_DATA_UPDATED',
            entities: dataArray
          });
        }, 150); // After the 100ms timeout for active state transition
      }
      
      // Subscribe to changes
      const unsubscribe = atomConfig.primaryAtom.subscribe((dataRecord) => {
        const entities = Object.values(dataRecord);
        console.log('AtomSlice: Data updated:', entities.length);
        self.send({
          type: 'ATOM_DATA_UPDATED',
          entities
        });
      });
      
      // Store unsubscribe function
      const newUnsubscribes = new Map(context.atomUnsubscribes);
      newUnsubscribes.set('primary', unsubscribe);
      
      return newUnsubscribes;
    }
  }),

  setupRelationshipAtoms: assign({
    atomUnsubscribes: ({ context, self }: any) => {
      const atomConfig = context.atomConfig;
      if (!atomConfig?.relationshipAtoms) {
        console.log('AtomSlice: No relationship atoms configured');
        return context.atomUnsubscribes;
      }

      console.log('AtomSlice: Setting up relationship atom subscriptions');
      const newUnsubscribes = new Map(context.atomUnsubscribes);
      
      Object.entries(atomConfig.relationshipAtoms).forEach(([key, atom]) => {
        if (!newUnsubscribes.has(key)) {
          const unsubscribe = atom.subscribe(() => {
            // Just trigger a re-render when relationship data changes
            self.send({ type: 'RELATIONSHIP_DATA_UPDATED' });
          });
          newUnsubscribes.set(key, unsubscribe);
          console.log(`AtomSlice: Subscribed to relationship atom: ${key}`);
        }
      });
      
      return newUnsubscribes;
    }
  }),

  updateEntitiesFromAtom: assign(({ context, event }: any) => {
    const entities = event.entities || [];
    const records: Record<string, any> = {};
    entities.forEach((entity: any) => {
      records[entity.id] = entity;
    });
    
    return {
      entities: entities,
      allRowIds: entities.map((e: any) => e.id),
      entityRecords: records,
      lastAtomUpdate: Date.now(),
      atomUpdateCount: (context.atomUpdateCount || 0) + 1,
      version: (context.version || 0) + 1
    };
  }),

  cleanupAtomSubscriptions: assign({
    atomUnsubscribes: ({ context }: any) => {
      // Unsubscribe from all atoms
      context.atomUnsubscribes.forEach((unsubscribe: () => void) => {
        unsubscribe();
      });
      
      console.log('AtomSlice: Cleaned up all atom subscriptions');
      return new Map();
    }
  })
};

// ====================================
// ATOM DATA GETTERS
// ====================================

export const getAtomData = (atomConfig: AtomSliceConfig | null) => {
  if (!atomConfig) {
    return {
      primary: () => ({}),
      relationships: {} as Record<string, () => Record<string, any>>
    };
  }

  return {
    primary: () => atomConfig.primaryAtom.get(),
    relationships: Object.entries(atomConfig.relationshipAtoms || {}).reduce(
      (acc, [key, atom]) => ({
        ...acc,
        [key]: () => atom.get()
      }),
      {} as Record<string, () => Record<string, any>>
    )
  };
};