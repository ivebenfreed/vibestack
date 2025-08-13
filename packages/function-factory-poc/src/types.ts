// Environment interface for POC worker
export interface Env {
  ENTITY_FUNCTIONS: KVNamespace;
  ENTITY_SCHEMAS: KVNamespace;
  ENTITY_CONFIG: KVNamespace;
  DB: D1Database;
  ORG_OBJECTS: DurableObjectNamespace;
  ENTITY_OBJECTS: DurableObjectNamespace;
  ROUTER_OBJECTS: DurableObjectNamespace;
}

// Base primitives - hardcoded entity archetypes
export interface BasePrimitive {
  name: string;
  coreFields: Record<string, FieldType>;
  defaultStatus?: string;
  statusTransitions?: string[];
}

export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'url' | 'email';

export interface CustomField {
  type: FieldType;
  required?: boolean;
  default?: any;
  options?: string[]; // For enum fields
}

export interface EntityDefinition {
  name: string;
  orgId: string;
  basePrimitive: string;
  customFields: Record<string, CustomField>;
  businessLogic: {
    validate?: string;
    onSave?: string;
    onStatusChange?: string;
    onFieldChange?: string;
  };
}

export interface EntitySchema {
  definition: EntityDefinition;
  tableName: string;
  createdAt: string;
  version: number;
}

export interface FunctionExecutionResult {
  success: boolean;
  result?: any;
  error?: string;
}

// Durable Object Configuration Types
export interface OrganizationConfig {
  orgId: string;
  isolationLevel: 'entity-level' | 'org-level' | 'shared' | 'auto';
  entities?: Record<string, EntityIsolationConfig>;
  scaling?: {
    minInstances?: number;
    maxInstances?: number;
    scaleUpThreshold?: { requestsPerSecond: number };
    scaleDownThreshold?: { idleMinutes: number };
  };
  storage?: {
    persistent: boolean;
    caching?: { ttl: number; strategy: 'write-through' | 'write-back' };
  };
  compliance?: {
    dataRetention?: string;
    encryption?: 'at-rest' | 'in-transit' | 'both';
    auditLogging?: boolean;
  };
}

export interface EntityIsolationConfig {
  durableObjectId?: string;
  persistentStorage: boolean;
  caching?: { ttl: number; strategy: 'write-through' | 'write-back' };
  scaling?: {
    minInstances: number;
    maxInstances: number;
  };
  realTime?: {
    webSocketSupport: boolean;
    broadcastUpdates: boolean;
  };
}

export interface DurableObjectStats {
  objectId: string;
  orgId: string;
  entityName?: string;
  recordCount: number;
  storageKeys: number;
  lastActivity: string;
  memoryUsage?: any;
  requestsPerMinute: number;
  averageResponseTime: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  data?: any;
}