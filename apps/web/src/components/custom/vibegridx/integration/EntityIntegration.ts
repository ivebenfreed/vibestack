import { useSelector } from '@xstate/store/react';
import { useMemo } from 'react';
import { shallowEqual } from '@/lib/utils';
import type { TableRow, Column, TableConfig } from '../types';
import type { ActorRefFrom } from 'xstate';

// Direct imports matching standard patterns used in routes
import { tasksAtom, updateTaskUI, createTaskUI, deleteTaskUI } from '@/domain/task';
import { projectsAtom, updateProjectUI, createProjectUI, deleteProjectUI } from '@/domain/project';
import { usersAtom, updateUserUI, createUserUI, deleteUserUI } from '@/domain/user';

// ====================================
// DOMAIN ATOM ADAPTERS
// ====================================

interface DomainAtomAdapter<T = any> {
  // Data access
  getAll: () => Record<string, T>;
  getById: (id: string) => T | undefined;
  
  // Data modification
  update: (id: string, updates: Partial<T>) => Promise<void>;
  create: (data: Omit<T, 'id'>) => Promise<T>;
  delete: (id: string) => Promise<void>;
  
  // Bulk operations
  bulkUpdate: (updates: Array<{ id: string; data: Partial<T> }>) => Promise<void>;
  
  // Metadata
  getEntityType: () => string;
  getColumns: () => Column[];
}

// Task domain adapter - using direct imports like TasksTableView
export const createTaskAdapter = (): DomainAtomAdapter => {
  return {
    getAll: () => {
      // Direct atom access - same pattern as TasksTableView
      const tasks = tasksAtom.get();
      return tasks;
    },
    
    getById: (id: string) => {
      const tasks = tasksAtom.get();
      return tasks[id];
    },
    
    update: async (id: string, updates: any) => {
      // Direct function call - same pattern as TasksTableView
      await updateTaskUI(id, updates);
    },
    
    create: async (data: any) => {
      return await createTaskUI(data);
    },
    
    delete: async (id: string) => {
      await deleteTaskUI(id);
    },
    
    bulkUpdate: async (updates: any[]) => {
      for (const update of updates) {
        await updateTaskUI(update.id, update.data);
      }
    },
    
    getEntityType: () => 'task',
    
    getColumns: (): Column[] => []  // Columns now come from component props
  };
};

// Project domain adapter - using direct imports
export const createProjectAdapter = (): DomainAtomAdapter => {
  return {
    getAll: () => {
      const projects = projectsAtom.get();
      return projects;
    },
    
    getById: (id: string) => {
      const projects = projectsAtom.get();
      return projects[id];
    },
    
    update: async (id: string, updates: any) => {
      await updateProjectUI(id, updates);
    },
    
    create: async (data: any) => {
      return await createProjectUI(data);
    },
    
    delete: async (id: string) => {
      await deleteProjectUI(id);
    },
    
    bulkUpdate: async (updates: any[]) => {
      for (const update of updates) {
        await updateProjectUI(update.id, update.data);
      }
    },
    
    getEntityType: () => 'project',
    
    getColumns: (): Column[] => []  // Columns now come from component props
  };
};

// User domain adapter - using direct imports
export const createUserAdapter = (): DomainAtomAdapter => {
  return {
    getAll: () => {
      const users = usersAtom.get();
      return users;
    },
    
    getById: (id: string) => {
      const users = usersAtom.get();
      return users[id];
    },
    
    update: async (id: string, updates: any) => {
      await updateUserUI(id, updates);
    },
    
    create: async (data: any) => {
      return await createUserUI(data);
    },
    
    delete: async (id: string) => {
      await deleteUserUI(id);
    },
    
    bulkUpdate: async (updates: any[]) => {
      for (const update of updates) {
        await updateUserUI(update.id, update.data);
      }
    },
    
    getEntityType: () => 'user',
    
    getColumns: (): Column[] => []  // Columns now come from component props
  };
};

// ====================================
// ADAPTER FACTORY
// ====================================

export const createDomainAdapter = (entityType: string): DomainAtomAdapter => {
  switch (entityType) {
    case 'task':
      return createTaskAdapter();
    case 'project':
      return createProjectAdapter();
    case 'user':
      return createUserAdapter();
    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
};

// ====================================
// INTEGRATION LAYER
// ====================================

export class EntityIntegrationLayer {
  private adapter: DomainAtomAdapter;
  private tableActor: ActorRefFrom<any> | null = null;
  private atomSubscription: (() => void) | null = null;
  private isInitialized = false;
  private lastEntityCount = 0;
  private columns: Column[] = [];
  
  constructor(entityType: string) {
    this.adapter = createDomainAdapter(entityType);
  }
  
  // Connect to table machine
  connectToTable(tableActor: ActorRefFrom<any>, columns?: Column[]) {
    this.tableActor = tableActor;
    if (columns) {
      this.columns = columns;
    }
    
    
    // No need to initialize - table machine already has config from input
    this.setupEntityDataSubscription();
  }
  
  // Set columns (can be called separately if needed)
  setColumns(columns: Column[]) {
    this.columns = columns;
  }
  
  // Set up subscription to entity data changes
  private setupEntityDataSubscription() {
    const entityType = this.adapter.getEntityType();
    
    // Set up real domain atom subscription for event-driven updates
    this.setupRealAtomSubscription(entityType);
    
    console.log(`EntityIntegration: Set up real atom subscription for ${entityType} entities`);
  }
  
  // Set up actual domain atom subscription (event-driven, not polling)
  private setupRealAtomSubscription(entityType: string) {
    // Use direct imports - atoms are already loaded since we're using the same pattern as routes
    switch (entityType) {
      case 'task':
        console.log('EntityIntegration: Setting up task domain subscription');
        
        // Get initial data and send it
        const initialTasks = tasksAtom.get();
        const taskCount = Object.keys(initialTasks).length;
        
        // Send initial entity data to table machine for ViewActor processing
        if (this.tableActor && taskCount > 0) {
          const entityIds = Object.keys(initialTasks);
          const entities = Object.values(initialTasks);
          this.tableActor.send({
            type: 'SET_VISIBLE_ENTITIES',
            entityIds,
            entities  // Entity data from parent component domain atoms
          });
        }
        
        this.handleEntityDataChange(initialTasks);
        
        // Subscribe to tasksAtom changes using XState store subscription
        const taskUnsubscribe = tasksAtom.subscribe((newTasks) => {
          this.handleEntityDataChange(newTasks);
        });
        
        // Store unsubscribe function for cleanup
        this.atomSubscription = taskUnsubscribe;
        break;
        
      case 'project':
        console.log('EntityIntegration: Setting up project domain subscription');
        
        // Get initial data and send it
        const initialProjects = projectsAtom.get();
        this.handleEntityDataChange(initialProjects);
        
        // Subscribe to projectsAtom changes
        const projectUnsubscribe = projectsAtom.subscribe((newProjects) => {
          this.handleEntityDataChange(newProjects);
        });
        this.atomSubscription = projectUnsubscribe;
        break;
        
      case 'user':
        console.log('EntityIntegration: Setting up user domain subscription');
        
        // Get initial data and send it
        const initialUsers = usersAtom.get();
        this.handleEntityDataChange(initialUsers);
        
        // Subscribe to usersAtom changes
        const userUnsubscribe = usersAtom.subscribe((newUsers) => {
          this.handleEntityDataChange(newUsers);
        });
        this.atomSubscription = userUnsubscribe;
        break;
        
      default:
        console.warn(`EntityIntegration: Unknown entity type for subscription: ${entityType}`);
    }
  }
  
  // Handle entity data changes from domain layer - data flows directly to renderer via useSelector
  private handleEntityDataChange(entities: Record<string, any>) {
    // No XState events needed - renderer subscribes directly to atoms
    const entityCount = Object.keys(entities).length;
    console.log(`EntityIntegration: ${entityCount} ${this.adapter.getEntityType()} entities updated in atoms`);
  }
  
  // Convert domain entity to table row
  private entityToTableRow(entity: any): TableRow {
    return {
      id: entity.id,
      data: { ...entity },
      metadata: {
        createdAt: entity.createdAt || new Date(),
        updatedAt: entity.updatedAt || new Date(),
        version: entity.version || 1,
        isNew: entity.isNew || false,
        isDirty: entity.isDirty || false
      }
    };
  }
  
  // ====================================
  // TABLE-TO-ENTITY OPERATIONS
  // ====================================
  
  // Handle cell update from table
  async handleCellUpdate(rowId: string, field: string, value: any): Promise<void> {
    try {
      await this.adapter.update(rowId, { [field]: value });
    } catch (error) {
      console.error('Failed to update entity:', error);
      throw error;
    }
  }
  
  // Handle row creation from table
  async handleRowCreate(data: Record<string, any>): Promise<TableRow> {
    try {
      const newEntity = await this.adapter.create(data);
      return this.entityToTableRow(newEntity);
    } catch (error) {
      console.error('Failed to create entity:', error);
      throw error;
    }
  }
  
  // Handle row deletion from table
  async handleRowDelete(rowId: string): Promise<void> {
    try {
      await this.adapter.delete(rowId);
    } catch (error) {
      console.error('Failed to delete entity:', error);
      throw error;
    }
  }
  
  // Handle bulk operations from table
  async handleBulkUpdate(updates: Array<{ id: string; field: string; value: any }>): Promise<void> {
    try {
      const groupedUpdates = updates.reduce((acc, update) => {
        if (!acc[update.id]) {
          acc[update.id] = { id: update.id, data: {} };
        }
        acc[update.id].data[update.field] = update.value;
        return acc;
      }, {} as Record<string, { id: string; data: Record<string, any> }>);
      
      await this.adapter.bulkUpdate(Object.values(groupedUpdates));
    } catch (error) {
      console.error('Failed to bulk update entities:', error);
      throw error;
    }
  }
  
  // ====================================
  // DATA ACCESS HELPERS
  // ====================================
  
  // Get entity data for cell rendering
  getEntityData(rowId: string, field: string): any {
    const entity = this.adapter.getById(rowId);
    return entity?.[field];
  }
  
  // Get all entity data for table
  getAllEntityData(): Record<string, any> {
    return this.adapter.getAll();
  }
  
  // Get columns configuration
  getColumns(): Column[] {
    return this.columns;
  }
  
  // Get entity type
  getEntityType(): string {
    return this.adapter.getEntityType();
  }
  
  // ====================================
  // CONFIGURATION
  // ====================================
  
  // Create table configuration from entity adapter
  createTableConfig(tableId: string): TableConfig {
    const entities = this.adapter.getAll();
    const entityType = this.adapter.getEntityType();
    
    const initialData: TableRow[] = Object.values(entities).map(entity => 
      this.entityToTableRow(entity)
    );
    
    return {
      id: tableId,
      entityType,
      columns: [], // Columns will come from component props
      initialData,
      settings: {
        enableVirtualScrolling: true,
        enableGrouping: true,
        enableFiltering: true,
        enableFormulas: false,
        pageSize: 50,
        rowHeight: 40,
        bufferSize: 10
      }
    };
  }
  
  // ====================================
  // CLEANUP
  // ====================================
  
  disconnect() {
    // Clean up atom subscription
    if (this.atomSubscription && typeof this.atomSubscription === 'function') {
      try {
        this.atomSubscription();
        console.log('EntityIntegration: Successfully unsubscribed from atom');
      } catch (error) {
        console.error('EntityIntegration: Error during atom unsubscribe:', error);
      }
      this.atomSubscription = null;
    }
    
    this.tableActor = null;
    console.log('EntityIntegration: Disconnected and cleaned up');
  }
}

// ====================================
// REACT HOOKS
// ====================================

// Hook to create and manage entity integration
export const useEntityIntegration = (entityType: string) => {
  const integration = new EntityIntegrationLayer(entityType);
  
  return {
    integration,
    getTableConfig: (tableId: string) => integration.createTableConfig(tableId),
    connectToTable: (tableActor: ActorRefFrom<any>) => integration.connectToTable(tableActor),
    disconnect: () => integration.disconnect()
  };
};

// Hook to create table configuration from existing domain atoms
export const useTableConfigFromAtoms = (entityType: string, tableId: string): TableConfig => {
  const adapter = createDomainAdapter(entityType);
  
  // Use selectors to get current data
  const entities = adapter.getAll();
  
  const initialData: TableRow[] = Object.values(entities).map(entity => ({
    id: entity.id,
    data: { ...entity },
    metadata: {
      createdAt: entity.createdAt || new Date(),
      updatedAt: entity.updatedAt || new Date(), 
      version: entity.version || 1,
      isNew: entity.isNew || false,
      isDirty: entity.isDirty || false
    }
  }));

  return {
    id: tableId,
    entityType,
    columns: [], // Columns will come from component props
    initialData,
    settings: {
      enableVirtualScrolling: true,
      enableGrouping: true,
      enableFiltering: true,
      enableFormulas: false,
      pageSize: 50,
      rowHeight: 40,
      bufferSize: 10
    }
  };
};