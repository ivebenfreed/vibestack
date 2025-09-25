/**
 * Schema Observable - Persisted Sync Observable for Organization Schemas
 * 
 * Converts schema loading from repetitive API calls to a reactive, 
 * persisted sync observable like entity data observables.
 * 
 * Part of Legend State architecture - follows same patterns as entity observables.
 */

import { observable } from '@legendapp/state'
import { syncedCrud } from '@legendapp/state/sync-plugins/crud'
import { observablePersistIndexedDB } from '@legendapp/state/persist-plugins/indexeddb'
import { log } from '@/logger'
import { getEnhancedFieldHandler } from '@/server/dataforge/fields'

const fileLog = log('legend-state/schema-observable.ts')

export interface OrgEntitySchema {
  orgId: string;
  entities: Record<string, EntityDefinition>;
  version: string;
  created_at?: string;
  updated_at?: string;
}

export interface EntityDefinition {
  archetype: string;
  tableName: string;
  syncableFields: Record<string, FieldDefinition | EnhancedFieldDefinition>;
  customFields?: Record<string, FieldDefinition | EnhancedFieldDefinition>;
  relationshipFields?: Record<string, RelationshipFieldDefinition>;
  allFields?: Record<string, FieldDefinition | EnhancedFieldDefinition>;
  businessMetadata?: any;
}

export interface FieldDefinition {
  type: string;
  required?: boolean;
  syncable?: boolean;
  enum?: string[];
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
  };
}

// Enhanced field definition with rich metadata
export interface EnhancedFieldDefinition {
  name: string;
  type: string;
  required?: boolean;
  syncable?: boolean;
  defaultValue?: any;
  
  // Rich validation metadata
  validation: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    precision?: number;
    emailFormat?: boolean;
    urlProtocols?: string[];
    phoneFormat?: 'international' | 'national' | 'e164';
    colorFormats?: ('hex' | 'rgb' | 'hsl' | 'named')[];
    currencyCode?: string;
    fileMaxSize?: number;
    fileAllowedTypes?: string[];
    businessRules?: {
      mustBeBefore?: string;
      mustBeAfter?: string;
      dependsOn?: string[];
      conditionalRequired?: {
        when: string;
        equals: any;
      };
    };
    messages?: {
      required?: string;
      pattern?: string;
      min?: string;
      max?: string;
      custom?: Record<string, string>;
    };
  };
  
  // Display metadata
  display: {
    label?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    filterable?: boolean;
    resizable?: boolean;
    format?: string;
    prefix?: string;
    suffix?: string;
    placeholder?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontWeight?: 'normal' | 'bold';
    showColorPreview?: boolean;
    showFilePreview?: boolean;
    truncateAt?: number;
    showTooltip?: boolean;
    conditionalFormatting?: {
      condition: string;
      className: string;
      style?: Record<string, string>;
    }[];
  };
  
  // Editor metadata
  editor: {
    type: 'text' | 'textarea' | 'select' | 'multi-select' | 'date' | 'datetime' | 
          'file' | 'color' | 'currency' | 'phone' | 'email' | 'url' | 
          'relationship-select' | 'computed' | 'rollup' | 'number' | 'boolean';
    multiline?: boolean;
    rows?: number;
    cols?: number;
    maxFiles?: number;
    acceptTypes?: string[];
    allowClear?: boolean;
    searchable?: boolean;
    creatable?: boolean;
    richTextFeatures?: ('bold' | 'italic' | 'underline' | 'link' | 'list')[];
    dateFormat?: string;
    timeFormat?: string;
    showTime?: boolean;
    minDate?: string;
    maxDate?: string;
    step?: number;
    showSpinners?: boolean;
    showValidationOnBlur?: boolean;
    showValidationOnChange?: boolean;
    validateWhileTyping?: boolean;
  };
  
  // Enhanced enum options
  enumOptions?: {
    value: string;
    label: string;
    color?: string;
    backgroundColor?: string;
    icon?: string;
    iconColor?: string;
    group?: string;
    disabled?: boolean;
    description?: string;
    sortOrder?: number;
    metadata?: Record<string, any>;
  }[];
  
  // Relationship metadata
  relationship?: {
    type: 'user_reference' | 'entity_reference' | 'custom_user_reference' | 'custom_entity_reference';
    targetEntityType?: string;
    cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
    displayField?: string;
    searchFields?: string[];
    filterBy?: Record<string, any>;
    sortBy?: string;
    allowCreate?: boolean;
    createTemplate?: Record<string, any>;
    cascadeDelete?: boolean;
  };
  
  // Computed field metadata
  computed?: {
    expression: string;
    dependencies: string[];
    resultType: string;
    refreshTriggers: ('field_changed' | 'record_created' | 'record_updated')[];
    cacheResults?: boolean;
    computeLocation: 'frontend' | 'backend' | 'both';
    debugMode?: boolean;
  };
  
  // Rollup field metadata
  rollup?: {
    type: 'count' | 'sum' | 'average' | 'concat' | 'min' | 'max';
    relationshipType: string;
    targetEntityType: string;
    targetField?: string;
    conditions?: Record<string, any>;
    separator?: string;
    precision?: number;
    nullHandling?: 'ignore' | 'zero' | 'empty';
  };
  
  // Accessibility metadata
  accessibility?: {
    ariaLabel?: string;
    ariaDescription?: string;
    tabIndex?: number;
    role?: string;
  };
  
  // Capabilities
  capabilities?: {
    supportsSorting: boolean;
    supportsFiltering: boolean;
    supportsGrouping: boolean;
    supportsAggregation: boolean;
    requiresSpecialEditor: boolean;
    hasRichDisplay: boolean;
    supportsValidation: boolean;
    supportsFormatting: boolean;
  };
}

export interface RelationshipFieldDefinition {
  name: string;
  type: 'user_reference' | 'entity_reference';
  relationshipType?: string;
  targetEntityType?: string;
  cardinality?: 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';
  properties?: Record<string, any>;
}

/**
 * Schema sync observable - handles schema loading, caching, and real-time updates
 * Uses same patterns as entity data observables for consistency
 */
export function createSchemaObservable(orgId: string) {
  fileLog.info(`[SchemaObservable] Creating schema observable for org: ${orgId}`)

  const crudConfig = {
    // Enable differential sync for schema updates
    changesSince: 'last-sync',

    // Schema versioning fields
    fieldId: 'orgId',
    fieldUpdatedAt: 'version',
    fieldCreatedAt: 'created_at',

    // **LEGEND STATE PERSISTENCE**
    persist: {
      name: `schema_${orgId}`,
      plugin: observablePersistIndexedDB({
        databaseName: `elevra_org_${orgId.replace(/-/g, '_')}`,
        version: 1, // Schema tables use simple versioning
        tableNames: [`schema_${orgId}`]
      }),
      retrySync: true, // Retry failed schema fetches
      transform: {
        load: (cachedData: any) => {
          if (!cachedData) return null
          // Add timestamp-based cache validation
          const cacheAge = Date.now() - (cachedData.cachedAt || 0)
          const maxAge = 5 * 60 * 1000 // 5 minutes cache
          if (cacheAge > maxAge) {
            fileLog.info(`[SchemaObservable] Schema cache expired for org ${orgId}, will refresh`)
            return null // Force refresh if stale
          }
          fileLog.info(`[SchemaObservable] Using cached schema for org ${orgId}`)
          return cachedData
        },
        save: (data: any) => ({
          ...data,
          cachedAt: Date.now()
        })
      }
    },
    
    // LIST - Load organization schema from server
    list: async () => {
      try {
        fileLog.info(`🔄 [SCHEMA-LOAD] Loading schema for org: ${orgId}`)
        
        const response = await fetch(`/api/dataforge/orgs/${orgId}/schema`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        })
        
        if (!response.ok) {
          if (response.status === 404) {
            fileLog.info(`[SchemaObservable] No schema found for org ${orgId} - returning empty`)
            return []
          }
          throw new Error(`Schema fetch failed: ${response.status} ${response.statusText}`)
        }
        
        const rawData = await response.json()
        
        // Handle API response format
        let schemaArray: any[]
        if (rawData && typeof rawData === 'object' && 'success' in rawData) {
          if (!rawData.success) {
            throw new Error(rawData.error || 'Server returned error')
          }
          schemaArray = rawData.schema
        } else if (Array.isArray(rawData)) {
          schemaArray = rawData
        } else {
          throw new Error('Invalid schema format from server')
        }
        
        if (!Array.isArray(schemaArray)) {
          throw new Error('Schema must be an array of entities')
        }
        
        // Transform to schema format
        const processedSchema = processSchemaResponse(orgId, schemaArray)
        
        fileLog.info(`✅ [SCHEMA-LOAD] Loaded schema with ${Object.keys(processedSchema.entities).length} entities for org: ${orgId}`)
        
        // Note: Persistence setup is now handled globally after all schemas are loaded
        // This prevents multiple version increments from individual schema loads
        
        // Return as single-item array for syncedCrud list format
        return [processedSchema]
        
      } catch (error) {
        fileLog.error(`[SchemaObservable] Failed to load schema for org ${orgId}:`, error)
        return []
      }
    },
    
    // No CREATE/UPDATE/DELETE for schemas - they're managed server-side
    create: null,
    update: null,
    delete: null,
    
    // Initial empty state
    initial: [],
    
    // Subscribe to schema change notifications via WebSocket
    subscribe: ({ refresh }: { refresh: () => void }) => {
      const handler = (e: CustomEvent) => {
        const notification = e.detail
        
        // Listen for schema changes affecting this organization
        if (notification?.table === 'entity_schemas' && notification?.orgId === orgId) {
          fileLog.info(`[SchemaObservable] Schema change notification for org ${orgId}`)
          refresh()
        }
        
        // Also listen for general schema reload events
        if (notification?.type === 'schema-reload' && notification?.orgId === orgId) {
          fileLog.info(`[SchemaObservable] Manual schema reload for org ${orgId}`)
          refresh()
        }
      }
      
      if (typeof window !== 'undefined') {
        window.addEventListener('elevra:schema-change-notification', handler as any)
        window.addEventListener('elevra:reload-schema', handler as any)
      }
      
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('elevra:schema-change-notification', handler as any)
          window.removeEventListener('elevra:reload-schema', handler as any)
        }
      }
    },
    
    // Retry configuration for reliability  
    retry: {
      times: 3,
      delay: 1000,
      backoff: 'exponential',
      maxDelay: 10000
    }
  }
  
  return observable(syncedCrud(crudConfig))
}

/**
 * Process raw schema array into organized schema format
 */
function processSchemaResponse(orgId: string, schemaArray: any[]): OrgEntitySchema {
  const entities: Record<string, EntityDefinition> = {}
  
  schemaArray.forEach(entity => {
    const businessMetadata = entity.businessMetadata || {}
    // Enhanced schema API provides fields at top level with enhanced metadata
    const fields = entity.fields || businessMetadata.fields || businessMetadata.allFields || []
    
    // Process fields with enhanced metadata extraction
    const syncableFields: Record<string, EnhancedFieldDefinition> = {}
    const customFields: Record<string, EnhancedFieldDefinition> = {}
    const relationshipFields: Record<string, RelationshipFieldDefinition> = {}
    
    fields.forEach((field: any) => {
      if (field.type === 'user_reference' || field.type === 'entity_reference') {
        // Relationship field
        relationshipFields[field.name] = {
          name: field.name,
          type: field.type,
          relationshipType: field.relationshipType || field.type,
          targetEntityType: field.targetEntityType,
          cardinality: field.cardinality || 'many-to-one',
          properties: field.properties || {}
        }
      } else {
        // Enhanced field processing
        const enhancedField = processEnhancedField(field, orgId, entity.entityName)
        
        if (isCustomField(field)) {
          customFields[field.name] = enhancedField
        } else {
          syncableFields[field.name] = enhancedField
        }
      }
    })
    
    // Add default timestamp fields with enhanced metadata
    if (!syncableFields.created_at) {
      syncableFields.created_at = createEnhancedTimestampField('created_at', false)
    }
    if (!syncableFields.updated_at) {
      syncableFields.updated_at = createEnhancedTimestampField('updated_at', false)
    }
    
    entities[entity.entityName] = {
      tableName: entity.tableName,
      archetype: entity.archetype,
      syncableFields,
      customFields,
      relationshipFields,
      allFields: { ...syncableFields, ...customFields },
      businessMetadata: {
        ...businessMetadata,
        // Add computed field configurations
        computedFields: extractComputedFields(fields),
        rollupFields: extractRollupFields(fields),
        // Add validation rules for cross-field validation
        entityValidationRules: extractEntityValidationRules(fields),
        // Add display templates
        displayTemplates: generateDisplayTemplates(entity.archetype, fields)
      }
    }
  })
  
  return {
    orgId,
    version: Date.now().toString(),
    entities,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
}

/**
 * Map server field types to client field types
 */
function mapFieldType(serverType: string): string {
  const typeMap: Record<string, string> = {
    'longtext': 'text',
    'priority_set': 'priority_option', 
    'status_set': 'status_option',
    'category_set': 'category_option',
    // Enhanced field type mappings
    'custom_user_reference': 'user_reference',
    'custom_entity_reference': 'entity_reference',
    'rollup_count': 'rollup_count',
    'rollup_sum': 'rollup_sum', 
    'rollup_average': 'rollup_average',
    'rollup_concat': 'rollup_concat',
    'computed_expression': 'computed_expression',
    'computed_formula': 'computed_formula'
  }
  return typeMap[serverType] || serverType
}

/**
 * Global schema observables cache - one per organization
 * Integrated with Legend State architecture
 */
const schemaObservables = new Map<string, any>()

/**
 * Get or create schema observable for an organization
 * Follows same pattern as getEntity$() for consistency
 */
export function getSchemaObservable$(orgId: string) {
  if (!schemaObservables.has(orgId)) {
    const observable = createSchemaObservable(orgId)
    schemaObservables.set(orgId, observable)
    fileLog.info(`[SchemaObservable] Created new schema observable for org: ${orgId}`)
  }
  
  return schemaObservables.get(orgId)
}

/**
 * Get schema data from observable (reactive)
 * Returns the first (and only) schema item from the list
 */
export function getSchemaData$(orgId: string): OrgEntitySchema | null {
  const schemaObs = getSchemaObservable$(orgId)
  if (!schemaObs) return null
  
  const schemaList = schemaObs.get()
  return Array.isArray(schemaList) && schemaList.length > 0 ? schemaList[0] : null
}

/**
 * Get schema data from observable (non-reactive)
 * Use this in event handlers and async functions
 */
export function peekSchemaData$(orgId: string): OrgEntitySchema | null {
  const schemaObs = getSchemaObservable$(orgId)
  if (!schemaObs) return null
  
  const schemaList = schemaObs.peek()
  return Array.isArray(schemaList) && schemaList.length > 0 ? schemaList[0] : null
}

/**
 * Clear schema observables (for logout/org switching)
 */
export function clearSchemaObservables() {
  fileLog.info(`[SchemaObservable] Clearing ${schemaObservables.size} schema observables`)
  schemaObservables.clear()
}

/**
 * Manually trigger schema reload for an organization
 */
export function reloadSchema(orgId: string) {
  fileLog.info(`[SchemaObservable] Triggering manual schema reload for org: ${orgId}`)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('elevra:reload-schema', {
      detail: { type: 'schema-reload', orgId }
    }))
  }
}

// Enhanced field processing helpers
function processEnhancedField(field: any, orgId: string, entityName: string): EnhancedFieldDefinition {
  // Check if field already has enhanced metadata from backend (PREFERRED)
  if (field.validation && field.display && field.editor && field.capabilities && field.accessibility) {
    fileLog.debug(`[processEnhancedField] Using comprehensive enhanced metadata from backend for field: ${field.name}`)
    
    // Extract rollup configuration if present
    const rollupConfig = extractRollupConfiguration(field)
    const computedConfig = extractComputedConfiguration(field)
    const relationshipConfig = extractRelationshipConfiguration(field)
    
    return {
      name: field.name,
      type: mapFieldType(field.type),
      required: field.required || false,
      syncable: field.syncable !== false,
      defaultValue: field.defaultValue,
      
      // Use comprehensive enhanced metadata directly from backend
      validation: {
        ...field.validation,
        // Preserve rollup/computed read-only status
        readOnly: field.validation.readOnly || isCalculatedField(field.type),
        calculatedField: field.validation.calculatedField || isCalculatedField(field.type)
      },
      display: {
        ...field.display,
        // Enhance display with calculation indicators
        showCalculationIndicator: field.display.showCalculationIndicator || isCalculatedField(field.type),
        isReadOnly: field.display.isReadOnly || isCalculatedField(field.type),
        refreshOnDependencyChange: field.display.refreshOnDependencyChange || isCalculatedField(field.type)
      },
      editor: {
        ...field.editor,
        // Set appropriate editor type for calculated fields
        type: field.editor.type === 'calculated-display' ? 'calculated-display' : field.editor.type,
        readOnly: field.editor.readOnly || isCalculatedField(field.type)
      },
      capabilities: {
        ...field.capabilities,
        // Mark calculated field capabilities
        isCalculatedField: field.capabilities.isCalculatedField || isCalculatedField(field.type),
        isRollupField: field.capabilities.isRollupField || isRollupField(field.type),
        requiresSpecialEditor: field.capabilities.requiresSpecialEditor || isCalculatedField(field.type)
      },
      accessibility: {
        ...field.accessibility,
        // Enhance accessibility for calculated fields
        ariaLive: field.accessibility.ariaLive || (isCalculatedField(field.type) ? 'polite' : undefined),
        role: field.accessibility.role || (isCalculatedField(field.type) ? 'status' : field.accessibility.role)
      },
      
      // Extract specialized field configurations
      rollup: rollupConfig,
      computed: computedConfig, 
      relationship: relationshipConfig,
      
      // Pass through any additional field properties
      ...field
    }
  }
  
  // Fallback: generate enhanced metadata using field handlers
  fileLog.debug(`[processEnhancedField] Generating enhanced metadata for field: ${field.name}`)
  const fieldHandler = getEnhancedFieldHandler(field.type)
  
  if (!fieldHandler) {
    fileLog.error(`[processEnhancedField] Unknown field type: ${field.type}`, { field, orgId, entityName })
    // Return basic field as fallback
    return createBasicEnhancedField(field)
  }
  
  try {
    // Extract rich metadata from field handler
    const validationMetadata = fieldHandler.getValidationMetadata(field)
    const displayMetadata = fieldHandler.getDisplayMetadata(field)
    const editorMetadata = fieldHandler.getEditorMetadata(field)
    const capabilities = fieldHandler.getCapabilities()
    const accessibilityMetadata = fieldHandler.getAccessibilityMetadata(field)
    
    return {
      name: field.name,
      type: mapFieldType(field.type),
      required: field.required || false,
      syncable: field.syncable !== false,
      defaultValue: field.defaultValue,
      
      validation: {
        ...validationMetadata,
        // Override with field-specific rules
        pattern: field.regex || validationMetadata.pattern,
        min: field.min ?? validationMetadata.min,
        max: field.max ?? validationMetadata.max,
        minLength: field.minLength ?? validationMetadata.minLength,
        maxLength: field.maxLength ?? validationMetadata.maxLength,
        
        // Extract business rules from field definition
        businessRules: extractBusinessRules(field, entityName),
        
        // Custom validation messages
        messages: field.validationMessages || validationMetadata.messages || generateValidationMessages(field.name, field.type)
      },
      
      display: {
        ...displayMetadata,
        label: field.label || formatFieldName(field.name),
        width: field.width || displayMetadata.width || calculateOptimalWidth(field.type, field.name),
        sortable: capabilities.supportsSorting && field.sortable !== false,
        filterable: capabilities.supportsFiltering && field.filterable !== false,
        
        // Generate conditional formatting rules
        conditionalFormatting: generateConditionalFormatting(field.type, field.name)
      },
      
      editor: {
        ...editorMetadata,
        type: determineEditorType(field.type, field.enum, field.relationship),
        
        // Add field-specific editor configuration
        ...extractEditorConfig(field)
      },
      
      // Enhanced enum options with rich metadata
      enumOptions: field.enumOptions || generateEnumOptions(field.enum, field.type),
      
      // Relationship metadata for reference fields
      relationship: field.relationship ? {
        ...field.relationship,
        displayField: field.relationship.displayField || 'name',
        searchFields: field.relationship.searchFields || ['name', 'title'],
        sortBy: field.relationship.sortBy || 'name'
      } : undefined,
      
      // Computed field metadata
      computed: field.computed ? {
        ...field.computed,
        refreshTriggers: field.computed.refreshTriggers || ['field_changed'],
        computeLocation: field.computed.computeLocation || 'backend'
      } : undefined,
      
      // Rollup field metadata
      rollup: field.rollup ? {
        ...field.rollup,
        precision: field.rollup.precision || 2,
        nullHandling: field.rollup.nullHandling || 'ignore'
      } : undefined,
      
      // Accessibility metadata
      accessibility: accessibilityMetadata,
      
      // Field capabilities
      capabilities
    }
  } catch (error) {
    fileLog.error(`[processEnhancedField] Error processing field ${field.name}:`, error)
    return createBasicEnhancedField(field)
  }
}

function createBasicEnhancedField(field: any): EnhancedFieldDefinition {
  return {
    name: field.name,
    type: mapFieldType(field.type),
    required: field.required || false,
    syncable: field.syncable !== false,
    defaultValue: field.defaultValue,
    
    validation: {
      pattern: field.regex,
      min: field.min,
      max: field.max,
      messages: {
        required: `${field.name} is required`
      }
    },
    
    display: {
      label: formatFieldName(field.name),
      width: 200,
      textAlign: 'left'
    },
    
    editor: {
      type: mapTypeToEditorType(field.type)
    },
    
    enumOptions: field.enumOptions || generateEnumOptions(field.enum, field.type),
    
    accessibility: {
      ariaLabel: `${field.name} input`,
      role: 'textbox'
    },
    
    capabilities: {
      supportsSorting: true,
      supportsFiltering: true,
      supportsGrouping: false,
      supportsAggregation: false,
      requiresSpecialEditor: false,
      hasRichDisplay: false,
      supportsValidation: true,
      supportsFormatting: false
    }
  }
}

function createEnhancedTimestampField(fieldName: string, required: boolean): EnhancedFieldDefinition {
  return {
    name: fieldName,
    type: 'timestamp',
    required,
    syncable: false,
    defaultValue: undefined,
    
    validation: {
      messages: {
        required: `${formatFieldName(fieldName)} is required`
      }
    },
    
    display: {
      label: formatFieldName(fieldName),
      width: 150,
      textAlign: 'left',
      format: 'datetime'
    },
    
    editor: {
      type: 'datetime'
    },
    
    accessibility: {
      ariaLabel: `${formatFieldName(fieldName)} timestamp`,
      role: 'textbox'
    },
    
    capabilities: {
      supportsSorting: true,
      supportsFiltering: true,
      supportsGrouping: false,
      supportsAggregation: false,
      requiresSpecialEditor: false,
      hasRichDisplay: false,
      supportsValidation: false,
      supportsFormatting: true
    }
  }
}

// Helper functions
function isCustomField(field: any): boolean {
  // Custom fields are those not in the base archetype
  const baseFields = ['id', 'organization_id', 'created_at', 'updated_at', 'created_by']
  return !baseFields.includes(field.name)
}

function extractBusinessRules(field: any, entityName: string): any {
  // Extract business validation rules from field definition
  return field.businessRules || {}
}

function generateValidationMessages(fieldName: string, fieldType: string): any {
  return {
    required: `${formatFieldName(fieldName)} is required`,
    pattern: `Please enter a valid ${fieldType.replace('_', ' ')}`,
    min: `Value is too small`,
    max: `Value is too large`
  }
}

function calculateOptimalWidth(fieldType: string, fieldName: string): number {
  // Calculate optimal column width based on field type and name
  if (fieldType === 'boolean') return 80
  if (fieldType.includes('timestamp') || fieldType.includes('date')) return 150
  if (fieldName === 'id') return 200
  if (fieldType === 'email' || fieldName.includes('email')) return 250
  if (fieldType === 'url' || fieldName.includes('url')) return 250
  if (fieldType === 'phone' || fieldName.includes('phone')) return 150
  if (fieldName.includes('description') || fieldType === 'longtext') return 300
  if (fieldType === 'number' || fieldType === 'integer' || fieldType === 'decimal') return 120
  if (fieldType === 'currency') return 150
  if (fieldType === 'color') return 100
  if (fieldType === 'file') return 200
  if (fieldType.includes('reference') || fieldType.includes('rollup')) return 180
  if (fieldType.includes('select')) return 150
  return 200
}

function generateConditionalFormatting(fieldType: string, fieldName: string): any[] {
  // Generate conditional formatting rules based on field type
  return []
}

function determineEditorType(fieldType: string, enumOptions: any[], relationship: any): string {
  if (enumOptions && enumOptions.length > 0) return 'select'
  if (relationship) return 'relationship-select'
  return mapTypeToEditorType(fieldType)
}

function extractEditorConfig(field: any): any {
  return field.editorConfig || {}
}

function generateEnumOptions(enumValues: string[] | undefined, fieldType: string): any[] | undefined {
  if (!enumValues || !Array.isArray(enumValues)) return undefined
  
  return enumValues.map((value, index) => ({
    value,
    label: formatFieldName(value),
    sortOrder: index
  }))
}

function mapTypeToEditorType(fieldType: string): string {
  const typeMap: Record<string, string> = {
    'text': 'text',
    'longtext': 'textarea',
    'rich-text': 'textarea',
    'rich_text': 'textarea',
    'number': 'number',
    'integer': 'number',
    'decimal': 'number',
    'boolean': 'boolean',
    'date': 'date',
    'datetime': 'datetime',
    'timestamp': 'datetime',
    'email': 'email',
    'url': 'url',
    'phone': 'phone',
    'file': 'file',
    'currency': 'currency',
    'color': 'color',
    'single-select': 'select',
    'single_select': 'select',
    'multi-select': 'multi-select',
    'multi_select': 'multi-select'
  }
  return typeMap[fieldType] || 'text'
}

function formatFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/Id$/, '')
    .replace(/_/g, ' ')
    .trim()
}

function extractComputedFields(fields: any[]): any[] {
  return fields.filter(f => f.computed || f.type.includes('computed'))
}

function extractRollupFields(fields: any[]): any[] {
  return fields.filter(f => f.rollup || f.type.includes('rollup'))
}

function extractEntityValidationRules(fields: any[]): any[] {
  return fields
    .map(f => f.businessRules)
    .filter(Boolean)
    .flat()
}

function generateDisplayTemplates(archetype: string, fields: any[]): any {
  // Find the best primary field based on enhanced metadata
  const primaryFieldCandidates = fields.filter(f => 
    f.name === 'title' || 
    f.name === 'name' || 
    f.display?.isPrimaryField ||
    (f.capabilities?.supportsGrouping && !isCalculatedField(f.type))
  )
  
  // Filter out calculated fields from display template
  const displayableFields = fields.filter(f => 
    !isCalculatedField(f.type) || 
    (f.capabilities?.hasRichDisplay && f.type.includes('rollup'))
  )
  
  return {
    archetype,
    primaryField: primaryFieldCandidates[0]?.name || displayableFields[0]?.name || 'id',
    displayFields: displayableFields.slice(0, 6).map(f => f.name),
    // Add calculated fields separately for dashboard/summary views
    calculatedFields: fields.filter(f => isCalculatedField(f.type)).map(f => f.name),
    // Group fields by capabilities for better UI organization
    sortableFields: fields.filter(f => f.capabilities?.supportsSorting).map(f => f.name),
    filterableFields: fields.filter(f => f.capabilities?.supportsFiltering).map(f => f.name),
    aggregatableFields: fields.filter(f => f.capabilities?.supportsAggregation).map(f => f.name)
  }
}

/**
 * Helper functions for common schema operations (replaces schema-client methods)
 */
export function getEntitySchema(orgId: string, entityName: string): EntityDefinition | null {
  const schema = peekSchemaData$(orgId)
  return schema?.entities?.[entityName] || null
}

export function getSyncableFields(orgId: string, entityName: string): Record<string, FieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  if (!entitySchema) return null
  
  // Filter only syncable fields
  const syncableFields: Record<string, FieldDefinition> = {}
  for (const [fieldName, fieldDef] of Object.entries(entitySchema.syncableFields || {})) {
    if (fieldDef.syncable !== false) {
      syncableFields[fieldName] = fieldDef
    }
  }
  return syncableFields
}

export function getCustomFields(orgId: string, entityName: string): Record<string, FieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  return entitySchema?.customFields || {}
}

export function getRelationshipFields(orgId: string, entityName: string): Record<string, RelationshipFieldDefinition> | null {
  const entitySchema = getEntitySchema(orgId, entityName)
  return entitySchema?.relationshipFields || {}
}

// Enhanced field processing helper functions
function isCalculatedField(fieldType: string): boolean {
  return fieldType.includes('rollup_') || 
         fieldType.includes('computed_') || 
         fieldType === 'rollup_count' ||
         fieldType === 'rollup_sum' ||
         fieldType === 'rollup_average' ||
         fieldType === 'rollup_concat' ||
         fieldType === 'computed_expression' ||
         fieldType === 'computed_formula'
}

function isRollupField(fieldType: string): boolean {
  return fieldType.includes('rollup_') ||
         fieldType === 'rollup_count' ||
         fieldType === 'rollup_sum' ||
         fieldType === 'rollup_average' ||
         fieldType === 'rollup_concat'
}

function extractRollupConfiguration(field: any): any {
  if (!isRollupField(field.type)) return undefined
  
  // Extract rollup config from field definition
  const rollupConfig = field.rollupConfig || {}
  
  return {
    type: field.type.replace('rollup_', ''), // 'count', 'sum', 'average', 'concat'
    relationshipType: rollupConfig.relationshipType || 'relates_to',
    targetEntityType: rollupConfig.targetEntityType || 'Unknown',
    targetField: rollupConfig.targetField,
    conditions: rollupConfig.conditions || {},
    separator: rollupConfig.separator,
    precision: field.precision || rollupConfig.precision || 2,
    nullHandling: rollupConfig.nullHandling || 'ignore',
    // Frontend calculation metadata
    calculationType: field.type.replace('rollup_', ''),
    aggregationFunction: field.type.replace('rollup_', ''),
    realTimeUpdates: true
  }
}

function extractComputedConfiguration(field: any): any {
  if (!field.type.includes('computed_')) return undefined
  
  const computedConfig = field.computedConfig || field.computed || {}
  
  return {
    expression: computedConfig.expression || '',
    dependencies: computedConfig.dependencies || [],
    resultType: computedConfig.resultType || 'string',
    refreshTriggers: computedConfig.refreshTriggers || ['field_changed'],
    cacheResults: computedConfig.cacheResults !== false,
    computeLocation: computedConfig.computeLocation || 'frontend',
    debugMode: computedConfig.debugMode || false
  }
}

function extractRelationshipConfiguration(field: any): any {
  if (!field.type.includes('reference')) return undefined
  
  return {
    type: field.type,
    targetEntityType: field.targetEntityType || field.relationshipType,
    cardinality: field.cardinality || 'many-to-one',
    displayField: field.displayField || 'name',
    searchFields: field.searchFields || ['name', 'title'],
    filterBy: field.filterBy || {},
    sortBy: field.sortBy || 'name',
    allowCreate: field.allowCreate || false,
    createTemplate: field.createTemplate || {},
    cascadeDelete: field.cascadeDelete || false,
    // Relationship metadata from enhanced handler
    relationshipType: field.relationshipType,
    relationshipContext: field.editor?.relationshipContext
  }
}

/**
 * Enhanced schema validation and optimization
 */
export function validateSchemaIntegrity(schema: OrgEntitySchema): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  optimizations: string[];
} {
  const errors: string[] = []
  const warnings: string[] = []
  const optimizations: string[] = []
  
  // Validate entity definitions
  Object.entries(schema.entities).forEach(([entityName, definition]) => {
    // Check for required fields
    if (!definition.syncableFields.id) {
      errors.push(`Entity ${entityName} missing required 'id' field`)
    }
    
    // Check for orphaned rollup fields
    Object.entries(definition.allFields || {}).forEach(([fieldName, field]) => {
      if (isRollupField(field.type) && field.rollup) {
        const targetEntity = field.rollup.targetEntityType
        if (targetEntity && !schema.entities[targetEntity]) {
          warnings.push(`Rollup field ${entityName}.${fieldName} references missing entity ${targetEntity}`)
        }
      }
    })
    
    // Suggest optimizations
    const calculatedFields = Object.values(definition.allFields || {}).filter(f => isCalculatedField(f.type))
    if (calculatedFields.length > 5) {
      optimizations.push(`Entity ${entityName} has ${calculatedFields.length} calculated fields - consider grouping in summary entity`)
    }
  })
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    optimizations
  }
}

/**
 * Enhanced schema utilities for frontend consumption
 */
export function getFieldsByCapability(orgId: string, entityName: string, capability: keyof FieldCapabilities): EnhancedFieldDefinition[] {
  const schema = peekSchemaData$(orgId)
  const entity = schema?.entities?.[entityName]
  if (!entity) return []
  
  return Object.values(entity.allFields || {})
    .filter((field): field is EnhancedFieldDefinition => {
      return field.capabilities?.[capability] === true
    })
}

export function getCalculatedFields(orgId: string, entityName: string): {
  rollupFields: EnhancedFieldDefinition[];
  computedFields: EnhancedFieldDefinition[];
  calculationMetadata: Record<string, any>;
} {
  const schema = peekSchemaData$(orgId)
  const entity = schema?.entities?.[entityName]
  if (!entity) return { rollupFields: [], computedFields: [], calculationMetadata: {} }
  
  const allFields = Object.values(entity.allFields || {})
  
  return {
    rollupFields: allFields.filter(f => isRollupField(f.type)),
    computedFields: allFields.filter(f => f.type.includes('computed_')),
    calculationMetadata: {
      rollupConfigs: allFields.filter(f => f.rollup).map(f => ({ field: f.name, config: f.rollup })),
      computedConfigs: allFields.filter(f => f.computed).map(f => ({ field: f.name, config: f.computed }))
    }
  }
}

export function getFieldDisplayConfiguration(orgId: string, entityName: string): {
  columns: Array<{
    field: string;
    header: string;
    width: number;
    sortable: boolean;
    filterable: boolean;
    type: string;
    format?: string;
    align: string;
  }>;
  defaultSort: string;
  primaryField: string;
} {
  const schema = peekSchemaData$(orgId)
  const entity = schema?.entities?.[entityName]
  if (!entity) return { columns: [], defaultSort: 'created_at', primaryField: 'id' }
  
  const allFields = Object.values(entity.allFields || {})
  const displayTemplate = entity.businessMetadata?.displayTemplates || {}
  
  return {
    columns: allFields.map(field => ({
      field: field.name,
      header: field.display?.label || formatFieldName(field.name),
      width: field.display?.width || 200,
      sortable: field.capabilities?.supportsSorting || false,
      filterable: field.capabilities?.supportsFiltering || false,
      type: field.type,
      format: field.display?.format,
      align: field.display?.textAlign || 'left'
    })),
    defaultSort: displayTemplate.sortableFields?.[0] || 'created_at',
    primaryField: displayTemplate.primaryField || 'id'
  }
}

/**
 * Integration with existing legend-state patterns
 * Add schema observables to global clearing function
 */
export function integrateWithLegendState() {
  // This will be called from observables.ts clearContext function
  return {
    clearSchemaObservables,
    validateSchemaIntegrity,
    getFieldsByCapability,
    getCalculatedFields,
    getFieldDisplayConfiguration
  }
}