/**
 * Worker-compatible TypeORM metadata types
 * Minimal interfaces extracted from TypeORM without Node.js dependencies
 */

// Core metadata interfaces (simplified from TypeORM)
export interface TableMetadataArgs {
  target: Function;
  name: string;
  type?: 'regular' | 'view' | 'junction' | 'closure' | 'entity-child';
  database?: string;
  schema?: string;
  synchronize?: boolean;
  orderBy?: object;
  engine?: string;
  comment?: string;
}

export interface ColumnMetadataArgs {
  target: Function;
  propertyName: string;
  options: {
    type?: any;
    name?: string;
    length?: string | number;
    precision?: number;
    scale?: number;
    width?: number;
    primary?: boolean;
    unique?: boolean;
    nullable?: boolean;
    readonly?: boolean;
    select?: boolean;
    insert?: boolean;
    update?: boolean;
    comment?: string;
    default?: any;
    onUpdate?: string;
    enum?: any[];
    enumName?: string;
    charset?: string;
    collation?: string;
    array?: boolean;
    transformer?: any;
    spatialFeatureType?: string;
    srid?: number;
    hstoreType?: string;
    generatedType?: 'ALWAYS' | 'BY DEFAULT';
    asExpression?: string;
    generatedIdentity?: 'ALWAYS' | 'BY DEFAULT';
    zerofill?: boolean;
    unsigned?: boolean;
  };
}

export interface RelationMetadataArgs {
  target: Function;
  propertyName: string;
  relationType: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  type: any;
  options?: {
    cascade?: boolean | ('insert' | 'update' | 'remove' | 'soft-remove' | 'recover')[];
    nullable?: boolean;
    onDelete?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'DEFAULT' | 'NO ACTION';
    onUpdate?: 'RESTRICT' | 'CASCADE' | 'SET NULL' | 'DEFAULT' | 'NO ACTION';
    deferrable?: 'INITIALLY IMMEDIATE' | 'INITIALLY DEFERRED';
    primary?: boolean;
    createForeignKeyConstraints?: boolean;
    eager?: boolean;
    lazy?: boolean;
    persistence?: boolean;
    orphanedRowAction?: 'nullify' | 'delete' | 'soft-delete' | 'disable';
  };
  inverseSideProperty?: string;
  isTreeParent?: boolean;
  isTreeChildren?: boolean;
}

export interface JoinTableMetadataArgs {
  target: Function;
  propertyName: string;
  name?: string;
  database?: string;
  schema?: string;
  joinColumns?: any[];
  inverseJoinColumns?: any[];
  synchronize?: boolean;
}

export interface JoinColumnMetadataArgs {
  target: Function;
  propertyName: string;
  name?: string;
  referencedColumnName?: string;
  foreignKeyConstraintName?: string;
}

export interface IndexMetadataArgs {
  target: Function;
  name?: string;
  columns?: string[];
  synchronize?: boolean;
  where?: string;
  unique?: boolean;
  spatial?: boolean;
  fulltext?: boolean;
  parser?: string;
  sparse?: boolean;
  background?: boolean;
  expireAfterSeconds?: number;
}

// Simplified metadata storage interface
export interface WorkerMetadataStorage {
  tables: TableMetadataArgs[];
  columns: ColumnMetadataArgs[];
  relations: RelationMetadataArgs[];
  joinTables: JoinTableMetadataArgs[];
  joinColumns: JoinColumnMetadataArgs[];
  indices: IndexMetadataArgs[];
}

// Global metadata storage (populated by decorators)
let globalMetadataStorage: WorkerMetadataStorage = {
  tables: [],
  columns: [],
  relations: [],
  joinTables: [],
  joinColumns: [],
  indices: []
};

export function getWorkerMetadataStorage(): WorkerMetadataStorage {
  return globalMetadataStorage;
}

export function addTableMetadata(args: TableMetadataArgs): void {
  const existing = globalMetadataStorage.tables.findIndex(t => t.target === args.target);
  if (existing >= 0) {
    globalMetadataStorage.tables[existing] = args;
  } else {
    globalMetadataStorage.tables.push(args);
  }
}

export function addColumnMetadata(args: ColumnMetadataArgs): void {
  globalMetadataStorage.columns.push(args);
}

export function addRelationMetadata(args: RelationMetadataArgs): void {
  globalMetadataStorage.relations.push(args);
}

export function addJoinTableMetadata(args: JoinTableMetadataArgs): void {
  globalMetadataStorage.joinTables.push(args);
}

export function addJoinColumnMetadata(args: JoinColumnMetadataArgs): void {
  globalMetadataStorage.joinColumns.push(args);
}

export function addIndexMetadata(args: IndexMetadataArgs): void {
  globalMetadataStorage.indices.push(args);
}

// Clear metadata (useful for testing)
export function clearMetadata(): void {
  globalMetadataStorage.tables = [];
  globalMetadataStorage.columns = [];
  globalMetadataStorage.relations = [];
  globalMetadataStorage.joinTables = [];
  globalMetadataStorage.joinColumns = [];
  globalMetadataStorage.indices = [];
}