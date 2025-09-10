/**
 * React Hook for Dynamic Entity Schema Loading - OPTIMIZED VERSION
 * 
 * Provides React integration for organization-specific entity schemas.
 * Handles loading, caching, and real-time updates using Legend State schema observables.
 * 
 * MIGRATED: Now uses schema observables instead of repetitive API calls to fix rate limiting.
 * This provides the same interface but with much better performance and caching.
 */

import { useMemo } from 'react';
import { log } from '@/logger';
import { use$ } from '@legendapp/state/react';
import { 
  getSchemaObservable$,
  getSyncableFields,
  getCustomFields, 
  getRelationshipFields,
  type OrgEntitySchema,
  type EntityDefinition,
  type FieldDefinition,
  type RelationshipFieldDefinition
} from '@/legend-state';

const fileLog = log('hooks/use-entity-schema.ts');

export interface FormFieldConfig {
  name: string;
  label: string;
  type: string;
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
  options?: Array<{
    value: string;
    label: string;
  }>;
  fieldCategory?: 'syncable' | 'custom' | 'relationship';
  relationshipType?: string;
  targetEntityType?: string;
  cardinality?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

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
 * Optimized organization schema hook - MIGRATED to schema observables
 * Uses Legend State schema observable instead of universe context for better performance
 */
export function useOrgSchema(orgId: string | null): Omit<UseEntitySchemaResult, 'entitySchema' | 'syncableFields' | 'customFields' | 'relationshipFields' | 'formFields' | 'validateData'> {
  // Get reactive schema data from Legend State observable
  const schemaObservable = orgId ? getSchemaObservable$(orgId) : null;
  const schemaData = use$(schemaObservable) || [];
  
  // Extract first (and only) schema from the list
  const schema = Array.isArray(schemaData) && schemaData.length > 0 ? schemaData[0] : null;
  
  // Determine loading state - if we have observable but no data, we're loading
  const loading = !!schemaObservable && (!schemaData || schemaData.length === 0);
  
  // For now, no error handling - the observable handles retries internally
  const error = null;
  
  // Schema is cached if we have data
  const cached = !!schema;

  const refetch = async () => {
    if (orgId && schemaObservable) {
      fileLog.info(`[useOrgSchema] Manual refetch for org: ${orgId}`);
      // Trigger refresh via WebSocket event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('vibestack:reload-schema', {
          detail: { type: 'schema-reload', orgId }
        }));
      }
    }
  };

  const clearCache = () => {
    if (orgId) {
      fileLog.info(`[useOrgSchema] Clear cache requested for org: ${orgId}`);
      // The schema observable handles its own caching
      refetch();
    }
  };

  return {
    schema,
    loading,
    error,
    cached,
    refetch,
    clearCache
  };
}

/**
 * OPTIMIZED: Hook to load and manage specific entity schema
 * Single reactive data source, no multiple API calls - FIXES RATE LIMITING
 */
export function useEntitySchema(orgId: string | null, entityName: string | null): UseEntitySchemaResult {
  const { schema, loading: schemaLoading, error: schemaError, cached, refetch, clearCache } = useOrgSchema(orgId);
  
  // Derive entity-specific data from the schema using useMemo for performance
  const derivedData = useMemo(() => {
    if (!schema || !entityName || !orgId) {
      return {
        entitySchema: null,
        syncableFields: null,
        customFields: null,
        relationshipFields: null,
        formFields: [],
        error: null
      };
    }

    try {
      // Get entity schema from the loaded schema
      const entitySchema = schema.entities?.[entityName] || null;
      
      if (!entitySchema) {
        return {
          entitySchema: null,
          syncableFields: null,
          customFields: null,
          relationshipFields: null,
          formFields: [],
          error: `Entity '${entityName}' not found in organization schema`
        };
      }

      // Use the helper functions from schema-observable (NO API CALLS!)
      const syncableFields = getSyncableFields(orgId, entityName);
      const customFields = getCustomFields(orgId, entityName);
      const relationshipFields = getRelationshipFields(orgId, entityName);

      // Generate form fields from all field types
      const formFields = generateFormFields(syncableFields, customFields, relationshipFields);

      return {
        entitySchema,
        syncableFields,
        customFields,
        relationshipFields,
        formFields,
        error: null
      };
      
    } catch (err) {
      fileLog.error(`[useEntitySchema] Error processing entity ${entityName}:`, err);
      return {
        entitySchema: null,
        syncableFields: null,
        customFields: null,
        relationshipFields: null,
        formFields: [],
        error: err instanceof Error ? err.message : 'Unknown error processing entity schema'
      };
    }
  }, [schema, entityName, orgId]);

  const validateData = async (data: any): Promise<ValidationResult> => {
    if (!orgId || !entityName || !derivedData.syncableFields) {
      return {
        valid: false,
        errors: ['Schema not loaded - cannot validate']
      };
    }

    const errors: string[] = [];
    const syncableFields = derivedData.syncableFields;

    // Validate required fields
    for (const [fieldName, fieldDef] of Object.entries(syncableFields)) {
      if (fieldDef.required && (data[fieldName] === undefined || data[fieldName] === null || data[fieldName] === '')) {
        errors.push(`Field ${fieldName} is required`);
      }

      // Validate field types and constraints
      if (data[fieldName] !== undefined && data[fieldName] !== null) {
        const typeError = validateFieldType(fieldName, data[fieldName], fieldDef);
        if (typeError) {
          errors.push(typeError);
        }
      }

      // Validate enums
      if (fieldDef.enum && data[fieldName] && !fieldDef.enum.includes(data[fieldName])) {
        errors.push(`Field ${fieldName} must be one of: ${fieldDef.enum.join(', ')}`);
      }

      // Validate patterns
      if (fieldDef.validation?.pattern && data[fieldName]) {
        const regex = new RegExp(fieldDef.validation.pattern);
        if (!regex.test(data[fieldName])) {
          errors.push(`Field ${fieldName} does not match required pattern`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  };

  return {
    schema,
    entitySchema: derivedData.entitySchema,
    syncableFields: derivedData.syncableFields,
    customFields: derivedData.customFields,
    relationshipFields: derivedData.relationshipFields,
    formFields: derivedData.formFields,
    loading: schemaLoading,
    error: schemaError || derivedData.error,
    cached,
    refetch,
    validateData,
    clearCache
  };
}

/**
 * OPTIMIZED: Hook for preloading schemas (now a no-op since schemas load automatically)
 */
export function usePreloadSchemas(orgIds: string[]) {
  // Schema observables are created on-demand and cached
  // No need for explicit preloading
  
  const loading = false; // Always false since schemas load reactively
  const error = null;
  
  const preload = async () => {
    // No-op - schemas are loaded automatically when accessed
    fileLog.info('[usePreloadSchemas] Schema preloading is automatic with observables');
  };

  return {
    loading,
    error,
    preload
  };
}

/**
 * OPTIMIZED: Hook to get available entities for an organization
 */
export function useOrgEntities(orgId: string | null): {
  entities: string[];
  loading: boolean;
  error: string | null;
} {
  const { schema, loading, error } = useOrgSchema(orgId);

  const entities = schema?.entities ? Object.keys(schema.entities) : [];

  return {
    entities,
    loading,
    error
  };
}

/**
 * OPTIMIZED: Hook for real-time schema updates - now uses WebSocket integration
 */
export function useSchemaUpdates(orgId: string | null, onSchemaUpdate?: (entityName: string) => void) {
  // The schema observables automatically handle WebSocket updates
  // This hook is kept for backward compatibility
  fileLog.info(`[useSchemaUpdates] Schema updates are handled automatically by schema observables for org: ${orgId}`);
}

/**
 * Helper functions for form generation and validation
 */

/**
 * Generate form field configurations from schema fields
 */
function generateFormFields(
  syncableFields: Record<string, FieldDefinition> | null,
  customFields: Record<string, FieldDefinition> | null,
  relationshipFields: Record<string, RelationshipFieldDefinition> | null
): FormFieldConfig[] {
  const formFields: FormFieldConfig[] = [];

  // Process syncable fields
  if (syncableFields) {
    for (const [fieldName, fieldDef] of Object.entries(syncableFields)) {
      if (fieldDef.syncable !== false) {
        const formField: FormFieldConfig = {
          name: fieldName,
          label: generateFieldLabel(fieldName),
          type: mapFieldTypeToInputType(fieldDef.type),
          required: fieldDef.required || false,
          validation: fieldDef.validation,
          fieldCategory: 'syncable'
        };

        if (fieldDef.enum) {
          formField.options = fieldDef.enum.map(value => ({
            value,
            label: generateOptionLabel(value)
          }));
        }

        formFields.push(formField);
      }
    }
  }

  // Process custom fields
  if (customFields) {
    for (const [fieldName, fieldDef] of Object.entries(customFields)) {
      const formField: FormFieldConfig = {
        name: fieldName,
        label: generateFieldLabel(fieldName),
        type: mapFieldTypeToInputType(fieldDef.type),
        required: fieldDef.required || false,
        validation: fieldDef.validation,
        fieldCategory: 'custom'
      };

      if (fieldDef.enum) {
        formField.options = fieldDef.enum.map(value => ({
          value,
          label: generateOptionLabel(value)
        }));
      }

      formFields.push(formField);
    }
  }

  // Process relationship fields
  if (relationshipFields) {
    for (const [fieldName, relationshipDef] of Object.entries(relationshipFields)) {
      const formField: FormFieldConfig = {
        name: fieldName,
        label: generateFieldLabel(fieldName),
        type: mapRelationshipTypeToInputType(relationshipDef.type),
        required: false, // Relationships are typically optional
        fieldCategory: 'relationship',
        relationshipType: relationshipDef.relationshipType,
        targetEntityType: relationshipDef.targetEntityType,
        cardinality: relationshipDef.cardinality
      };

      formFields.push(formField);
    }
  }

  return formFields;
}

/**
 * Helper functions for form generation
 */
function generateFieldLabel(fieldName: string): string {
  return fieldName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function generateOptionLabel(value: string): string {
  return value
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function mapFieldTypeToInputType(fieldType: string): string {
  switch (fieldType) {
    case 'string': return 'text';
    case 'number': return 'number';
    case 'boolean': return 'checkbox';
    case 'text': return 'textarea';
    case 'array': return 'select';
    case 'date': return 'date';
    case 'datetime': return 'datetime-local';
    case 'email': return 'email';
    case 'url': return 'url';
    case 'json': return 'textarea';
    case 'jsonb': return 'textarea';
    default: return 'text';
  }
}

function mapRelationshipTypeToInputType(relationshipType: 'user_reference' | 'entity_reference'): string {
  switch (relationshipType) {
    case 'user_reference': return 'user-select';
    case 'entity_reference': return 'entity-select';
    default: return 'select';
  }
}

function validateFieldType(fieldName: string, value: any, fieldDef: FieldDefinition): string | null {
  switch (fieldDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Field ${fieldName} must be a string`;
      }
      break;
    case 'number':
      if (typeof value !== 'number' && isNaN(Number(value))) {
        return `Field ${fieldName} must be a number`;
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Field ${fieldName} must be a boolean`;
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return `Field ${fieldName} must be an array`;
      }
      break;
  }
  return null;
}