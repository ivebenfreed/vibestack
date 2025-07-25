import type { ActorRefFrom, ActorLogicFrom } from 'xstate';
import type { createTableStoreLogic } from './table-data-store';

// ====================================
// STORE TYPES
// ====================================

export interface TableDataStore {
  entities: Map<string, any>;
  relationships: {
    projects: Map<string, any>;
    users: Map<string, any>;
    [key: string]: Map<string, any>;
  };
}

export interface RelationshipData {
  id: string;
  name: string;
  [key: string]: any;
}

// Note: TableStoreEvent is now imported from table-data-store.ts

// ====================================
// STORE ACTOR TYPES
// ====================================

export type TableStoreLogic = ReturnType<typeof createTableStoreLogic>;
export type TableStoreActor = ActorRefFrom<TableStoreLogic>;

export interface TableStoreInput {
  entityType: string;
}

// ====================================
// SUSPENSE DATA TYPES
// ====================================

export interface TableDataResult {
  store: TableStoreActor; // The started store actor with initial data loaded
  relationshipData: {
    projects: RelationshipData[];
    users: RelationshipData[];
  };
}

// ====================================
// OPTIMIZED QUERY TYPES
// ====================================

export interface OptimizedRelationshipQuery {
  table: string;
  ids: string[];
  fields: string[];
}

export interface RelationshipUsage {
  projects: Set<string>;
  users: Set<string>;
  [key: string]: Set<string>;
}

// Re-export types from table-data-store
export { 
  TableStoreContext, 
  TableStoreEvent as TableStoreEventType, 
  SortConfig, 
  FilterConfig, 
  TableRow,
  EntityChange,
  getVisibleColumns 
} from './table-data-store';