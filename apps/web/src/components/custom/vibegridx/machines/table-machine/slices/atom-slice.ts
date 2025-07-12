// ====================================
// ATOM SLICE - Direct Atom Subscription Management
// ====================================

import { assign } from 'xstate';
import { tasksAtom } from '@/domain/task';
import { projectsAtom } from '@/domain/project';
import { usersAtom } from '@/domain/user';

// ====================================
// STATE INTERFACE
// ====================================

export interface AtomState {
  // Entity data from atoms
  entities: any[];
  allRowIds: string[];
  entityRecords: Record<string, any>;
  
  // Atom subscriptions
  atomUnsubscribes: {
    tasks?: () => void;
    projects?: () => void;
    users?: () => void;
  };
  
  // Tracking
  lastAtomUpdate: number;
  atomUpdateCount: number;
}

// ====================================
// INITIAL STATE
// ====================================

export const createInitialAtomState = (): AtomState => ({
  entities: [],
  allRowIds: [],
  entityRecords: {},
  atomUnsubscribes: {},
  lastAtomUpdate: 0,
  atomUpdateCount: 0
});

// ====================================
// ATOM SUBSCRIPTION SETUP
// ====================================

export const setupAtomSubscriptions = (
  entityType: string,
  onUpdate: (entities: any[]) => void
): (() => void) => {
  console.log('AtomSlice: Setting up subscriptions for', entityType);
  
  switch (entityType) {
    case 'task': {
      // Get initial data
      const initialTasks = tasksAtom.get();
      const taskArray = Object.values(initialTasks);
      console.log('AtomSlice: Initial tasks:', taskArray.length);
      
      // Send initial update
      if (taskArray.length > 0) {
        onUpdate(taskArray);
      }
      
      // Subscribe to changes
      const unsubscribe = tasksAtom.subscribe((tasksRecord) => {
        const tasks = Object.values(tasksRecord);
        console.log('AtomSlice: Tasks updated:', tasks.length);
        onUpdate(tasks);
      });
      
      return unsubscribe;
    }
    
    case 'project': {
      // Get initial data
      const initialProjects = projectsAtom.get();
      const projectArray = Object.values(initialProjects);
      console.log('AtomSlice: Initial projects:', projectArray.length);
      
      // Send initial update
      if (projectArray.length > 0) {
        onUpdate(projectArray);
      }
      
      // Subscribe to changes
      const unsubscribe = projectsAtom.subscribe((projectsRecord) => {
        const projects = Object.values(projectsRecord);
        console.log('AtomSlice: Projects updated:', projects.length);
        onUpdate(projects);
      });
      
      return unsubscribe;
    }
    
    case 'user': {
      // Get initial data
      const initialUsers = usersAtom.get();
      const userArray = Object.values(initialUsers);
      console.log('AtomSlice: Initial users:', userArray.length);
      
      // Send initial update
      if (userArray.length > 0) {
        onUpdate(userArray);
      }
      
      // Subscribe to changes
      const unsubscribe = usersAtom.subscribe((usersRecord) => {
        const users = Object.values(usersRecord);
        console.log('AtomSlice: Users updated:', users.length);
        onUpdate(users);
      });
      
      return unsubscribe;
    }
    
    default:
      console.warn('AtomSlice: Unknown entity type:', entityType);
      return () => {};
  }
};

// ====================================
// ACTIONS
// ====================================

export const atomActions = {
  setupAtomSubscription: assign({
    atomUnsubscribes: ({ context, self }: any) => {
      const entityType = context.entityType;
      
      // Set up subscription with callback that sends event to self
      const unsubscribe = setupAtomSubscriptions(entityType, (entities) => {
        self.send({
          type: 'ATOM_DATA_UPDATED',
          entities
        });
      });
      
      // Store unsubscribe function
      return {
        ...context.atomUnsubscribes,
        [entityType]: unsubscribe
      };
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
      Object.values(context.atomUnsubscribes).forEach((unsubscribe: any) => {
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      });
      
      return {};
    }
  }),

  // Helper to get related atoms for relationship resolution
  setupRelationshipAtoms: assign({
    atomUnsubscribes: ({ context, self }: any) => {
      const newUnsubscribes = { ...context.atomUnsubscribes };
      
      // Always subscribe to projects and users for relationship resolution
      if (!newUnsubscribes.projects) {
        const projectsUnsubscribe = projectsAtom.subscribe(() => {
          // Just trigger a re-render when projects change
          self.send({ type: 'RELATIONSHIP_DATA_UPDATED' });
        });
        newUnsubscribes.projects = projectsUnsubscribe;
      }
      
      if (!newUnsubscribes.users) {
        const usersUnsubscribe = usersAtom.subscribe(() => {
          // Just trigger a re-render when users change
          self.send({ type: 'RELATIONSHIP_DATA_UPDATED' });
        });
        newUnsubscribes.users = usersUnsubscribe;
      }
      
      return newUnsubscribes;
    }
  })
};

// ====================================
// ATOM DATA GETTERS
// ====================================

export const getAtomData = {
  tasks: () => tasksAtom.get(),
  projects: () => projectsAtom.get(),
  users: () => usersAtom.get(),
  
  // Get specific entity by ID
  getTaskById: (id: string) => tasksAtom.get()[id],
  getProjectById: (id: string) => projectsAtom.get()[id],
  getUserById: (id: string) => usersAtom.get()[id],
  
  // Get all as arrays
  getAllTasks: () => Object.values(tasksAtom.get()),
  getAllProjects: () => Object.values(projectsAtom.get()),
  getAllUsers: () => Object.values(usersAtom.get())
};