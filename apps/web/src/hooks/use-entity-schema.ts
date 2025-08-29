/**
 * React Hook for Dynamic Entity Schema Loading
 * 
 * Provides React integration for organization-specific entity schemas.
 * Handles loading, caching, and real-time updates.
 */

import { useState, useEffect, useCallback } from 'react';
import { 
import { stateLog } from '@/logger';
const log = stateLog('hooks/use-entity-schema.ts');
  orgSchemaClient, 
  type OrgEntitySchema, 
  type EntityDefinition, 
  type FieldDefinition, 
  type FormFieldConfig,
  type ValidationResult 
} from '@/lib/schema-client';

export interface UseEntitySchemaResult {
  schema: OrgEntitySchema | null;
  entitySchema: EntityDefinition | null;
  syncableFields: Record<string, FieldDefinition> | null;
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
 */
export function useOrgSchema(orgId: string | null): Omit<UseEntitySchemaResult, 'entitySchema' | 'syncableFields' | 'formFields' | 'validateData'> {
  const [schema, setSchema] = useState<OrgEntitySchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  const loadSchema = useCallback(async () => {
    if (!orgId) {
      setSchema(null);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await orgSchemaClient.loadOrgSchema(orgId);
      
      if (result.success && result.schema) {
        setSchema(result.schema);
        setCached(result.cached || false);
        setError(null);
        
        // 🎯 OPTIMIZATION: Notify app init that schema is ready for fast dashboard loading
        log.info('[Schema] ✅ Organization schema loaded - triggering app initialization');
        const appInitActor = (window as any).appInitActor;
        if (appInitActor) {
          appInitActor.send({ type: 'SCHEMA_READY' });
        } else {
          // Fallback: dispatch window event
          window.dispatchEvent(new CustomEvent('schema:ready', {
            detail: { orgId, entityCount: Object.keys(result.schema.entities).length }
          }));
        }
      } else {
        setSchema(null);
        setError(result.error || 'Failed to load schema');
        
        // Notify app init about schema loading failure
        log.error('[Schema] ❌ Schema loading failed:', result.error);
        const appInitActor = (window as any).appInitActor;
        if (appInitActor) {
          appInitActor.send({ type: 'SCHEMA_ERROR', error: result.error || 'Failed to load schema' });
        }
      }
    } catch (err) {
      setSchema(null);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  // Load schema when orgId changes
  useEffect(() => {
    loadSchema();
  }, [loadSchema]);

  // Listen for local schema ready events (from app init machine)
  useEffect(() => {
    const handleLocalSchemaReady = (event: CustomEvent) => {
      const { schema, source } = event.detail;
      if (schema && schema.orgId === orgId) {
        log.info('[useOrgSchema] 🚀 Using local schema immediately from:', source);
        setSchema(schema);
        setCached(true);
        setError(null);
        setLoading(false);
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
    schema,
    loading,
    error,
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
  const [formFields, setFormFields] = useState<FormFieldConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update entity-specific data when schema or entityName changes
  useEffect(() => {
    const updateEntityData = async () => {
      if (!schema || !entityName) {
        setEntitySchema(null);
        setSyncableFields(null);
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
          setFormFields([]);
          setError(`Entity '${entityName}' not found in organization schema`);
          return;
        }

        setEntitySchema(entity);

        // Get syncable fields
        const syncable = await orgSchemaClient.getSyncableFields(schema.orgId, entityName);
        setSyncableFields(syncable);

        // Generate form fields
        const forms = await orgSchemaClient.generateFormFields(schema.orgId, entityName);
        setFormFields(forms);

        setError(null);
      } catch (err) {
        setEntitySchema(null);
        setSyncableFields(null);
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
 */
export function usePreloadSchemas(orgIds: string[]) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preload = useCallback(async () => {
    if (orgIds.length === 0) return;

    setLoading(true);
    setError(null);

    try {
      await orgSchemaClient.preloadSchemas(orgIds);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preload schemas');
    } finally {
      setLoading(false);
    }
  }, [orgIds]);

  useEffect(() => {
    preload();
  }, [preload]);

  return {
    loading,
    error,
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

    log.info(`[Schema Updates] WebSocket connection placeholder for org: ${orgId}`);
  }, [orgId, onSchemaUpdate]);
}