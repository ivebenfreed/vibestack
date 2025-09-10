/**
 * React Hook for Dynamic Entity Schema Loading
 * 
 * Provides React integration for organization-specific entity schemas.
 * Handles loading, caching, and real-time updates.
 * 
 * IMPORTANT: This hook uses Legend State's universe context to ensure
 * schemas are only loaded after authentication is ready.
 */

import { useState, useEffect, useCallback } from 'react';
import { log } from '@/logger';
import { use$ } from '@legendapp/state/react';
import { universeContext$, universeSchema$ } from '@/legend-state';
import { 
  orgSchemaClient, 
  type OrgEntitySchema, 
  type EntityDefinition, 
  type FieldDefinition,
  type RelationshipFieldDefinition, 
  type FormFieldConfig,
  type ValidationResult 
} from '@/lib/schema-client';

const fileLog = log('hooks/use-entity-schema.ts');

export interface UseEntitySchemaResult {
  schema: OrgEntitySchema | null;
  entitySchema: EntityDefinition | null;
  syncableFields: Record<string, FieldDefinition> | null;
  customFields: Record<string, FieldDefinition> | null;
  relationshipFields: Record<string, RelationshipFieldDefinition> | null;
  formFields: FormFieldConfig[];
  loading: boolean;
  error: string | null;
  cached: boolean;
  // Actions
  refetch: () => Promise<void>;
  validateData: (data: any) => Promise<ValidationResult>;
  clearCache: () => void;
}

/**
 * Hook to load and manage organization schema
 * Uses Legend State's universe context to ensure schema is loaded after auth
 */
export function useOrgSchema(orgId: string | null): Omit<UseEntitySchemaResult, 'entitySchema' | 'syncableFields' | 'customFields' | 'relationshipFields' | 'formFields' | 'validateData'> {
  // Get schema from Legend State's universe context (loaded by Legend State init machine)
  const universeLoading = use$(universeContext$.loading);
  const universeError = use$(universeContext$.error);
  const orgContext = orgId ? use$(universeContext$.organizations[orgId]) : null;
  
  // For primary org, use the universeSchema$ directly
  const primarySchema = use$(universeSchema$);
  const isPrimaryOrg = primarySchema?.orgId === orgId;
  
  const [cached, setCached] = useState(false);

  // Get schema from Legend State context or primary schema
  const schema = isPrimaryOrg ? primarySchema : orgContext?.schema || null;
  const loading = universeLoading || (orgContext?.loading ?? false);
  const error = universeError || orgContext?.error || null;

  // No need to load - Legend State init machine handles all loading
  const loadSchema = useCallback(async () => {
    // Schema is loaded by Legend State init machine after auth is ready
    // This ensures we never try to fetch before authentication
    fileLog.info('[useOrgSchema] Schema request for org:', orgId, 'Already loaded:', !!schema);
  }, [orgId, schema]);

  // Listen for local schema ready events (from Legend State init machine)
  useEffect(() => {
    const handleLocalSchemaReady = (event: CustomEvent) => {
      const { schema: eventSchema, source } = event.detail;
      if (eventSchema && eventSchema.orgId === orgId) {
        fileLog.info('[useOrgSchema] 🚀 Schema ready from:', source);
        setCached(true);
      }
    };

    window.addEventListener('schema:local-ready', handleLocalSchemaReady as EventListener);
    return () => {
      window.removeEventListener('schema:local-ready', handleLocalSchemaReady as EventListener);
    };
  }, [orgId]);

  const clearCache = useCallback(() => {
    if (orgId) {
      orgSchemaClient.clearCache(orgId);
      setCached(false);
    }
  }, [orgId]);

  return {
    schema: schema as OrgEntitySchema | null,
    loading,
    error: error as string | null,
    cached,
    refetch: loadSchema,
    clearCache
  };
}

/**
 * Hook to load and manage specific entity schema
 */
export function useEntitySchema(orgId: string | null, entityName: string | null): UseEntitySchemaResult {
  const { schema, loading: schemaLoading, error: schemaError, cached, refetch, clearCache } = useOrgSchema(orgId);
  
  const [entitySchema, setEntitySchema] = useState<EntityDefinition | null>(null);
  const [syncableFields, setSyncableFields] = useState<Record<string, FieldDefinition> | null>(null);
  const [customFields, setCustomFields] = useState<Record<string, FieldDefinition> | null>(null);
  const [relationshipFields, setRelationshipFields] = useState<Record<string, RelationshipFieldDefinition> | null>(null);
  const [formFields, setFormFields] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update entity-specific data when schema or entityName changes
  useEffect(() => {
    const updateEntityData = async () => {
      if (!schema || !entityName) {
        setEntitySchema(null);
        setSyncableFields(null);
        setCustomFields(null);
        setRelationshipFields(null);
        setFormFields([]);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Get entity schema
        const entity = schema.entities[entityName];
        if (!entity) {
          setEntitySchema(null);
          setSyncableFields(null);
          setCustomFields(null);
          setRelationshipFields(null);
          setFormFields([]);
          setError(`Entity '${entityName}' not found in organization schema`);
          return;
        }

        setEntitySchema(entity);

        // Get all field types from enhanced schema client
        const syncable = await orgSchemaClient.getSyncableFields(schema.orgId, entityName);
        const custom = await orgSchemaClient.getCustomFields(schema.orgId, entityName);
        const relationships = await orgSchemaClient.getRelationshipFields(schema.orgId, entityName);
        
        setSyncableFields(syncable);
        setCustomFields(custom);
        setRelationshipFields(relationships);

        // Generate enhanced form fields including relationships
        const forms = await orgSchemaClient.generateFormFields(schema.orgId, entityName);
        setFormFields(forms);

        setError(null);
      } catch (err) {
        setEntitySchema(null);
        setSyncableFields(null);
        setCustomFields(null);
        setRelationshipFields(null);
        setFormFields([]);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    updateEntityData();
  }, [schema, entityName]);

  const validateData = useCallback(async (data: any): Promise<ValidationResult> => {
    if (!orgId || !entityName) {
      return {
        valid: false,
        errors: ['Organization ID and entity name are required for validation']
      };
    }

    return await orgSchemaClient.validateEntityData(orgId, entityName, data);
  }, [orgId, entityName]);

  return {
    schema,
    entitySchema,
    syncableFields,
    customFields,
    relationshipFields,
    formFields,
    loading: schemaLoading || loading,
    error: schemaError || error,
    cached,
    refetch,
    validateData,
    clearCache
  };
}

/**
 * Hook to preload schemas for multiple organizations
 * Note: Schemas are now loaded by Legend State init machine after auth
 */
export function usePreloadSchemas(orgIds: string[]) {
  // Schemas are preloaded by Legend State init machine
  // This hook is kept for backward compatibility but doesn't need to do anything
  const universeLoading = use$(universeContext$.loading);
  const universeError = use$(universeContext$.error);

  const preload = useCallback(async () => {
    // No-op: Legend State init machine handles all schema loading
    fileLog.info('[usePreloadSchemas] Schema preloading handled by Legend State init machine');
  }, []);

  return {
    loading: universeLoading || false,
    error: universeError as string | null,
    preload
  };
}

/**
 * Hook to get available entities for an organization
 */
export function useOrgEntities(orgId: string | null): {
  entities: string[];
  loading: boolean;
  error: string | null;
} {
  const { schema, loading, error } = useOrgSchema(orgId);

  const entities = schema ? Object.keys(schema.entities) : [];

  return {
    entities,
    loading,
    error
  };
}

/**
 * Hook for real-time schema updates (placeholder for future WebSocket integration)
 */
export function useSchemaUpdates(orgId: string | null, onSchemaUpdate?: (entityName: string) => void) {
  useEffect(() => {
    if (!orgId || !onSchemaUpdate) return;

    // TODO: Implement WebSocket connection for real-time schema updates
    // const ws = new WebSocket(`ws://localhost:8787/ws/schema/${orgId}`);
    // 
    // ws.onmessage = (event) => {
    //   const update = JSON.parse(event.data);
    //   if (update.type === 'schema_change') {
    //     onSchemaUpdate(update.entityName);
    //     // Clear cache to force reload
    //     orgSchemaClient.clearCache(orgId);
    //   }
    // };
    //
    // return () => ws.close();

    fileLog.info(`[Schema Updates] WebSocket connection placeholder for org: ${orgId}`);
  }, [orgId, onSchemaUpdate]);
}