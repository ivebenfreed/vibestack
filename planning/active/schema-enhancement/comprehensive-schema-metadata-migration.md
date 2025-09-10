# Comprehensive Schema Metadata Migration Plan

*Hard migration to enhance frontend schema loading with complete validation metadata for data grids*

## Overview

This plan outlines a complete overhaul of the schema loading system to provide comprehensive validation metadata, display configuration, and editor settings for frontend data grids. We're doing a hard migration with no backward compatibility concerns.

## Current State Analysis

### What We Have
- Basic field definitions with type, required, enum, defaultValue
- Simple validation object with pattern, min, max
- Legend State schema observables with reactive loading
- Column generation from syncableFields
- Cell type mapping for basic data grid support

### What We're Missing
- Rich validation metadata from field handlers
- Display formatting and styling configuration
- Editor type and configuration metadata
- Relationship field dropdown configuration
- Computed field expression metadata
- Rollup field configuration
- Business rule validation metadata

## Migration Strategy

### Phase 1: Enhanced Schema Interfaces

**File: `/server/dataforge/types.ts`**
```typescript
export interface EnhancedFieldDefinition {
  // Core properties
  name: string;
  type: string;
  required?: boolean;
  syncable?: boolean;
  defaultValue?: any;
  
  // Rich validation metadata extracted from field handlers
  validation: {
    // Basic constraints
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
    precision?: number;
    
    // Type-specific validation flags
    emailFormat?: boolean;
    urlProtocols?: string[];
    phoneFormat?: 'international' | 'national' | 'e164';
    colorFormats?: ('hex' | 'rgb' | 'hsl' | 'named')[];
    currencyCode?: string;
    fileMaxSize?: number;
    fileAllowedTypes?: string[];
    
    // Business logic validation
    businessRules?: {
      mustBeBefore?: string;
      mustBeAfter?: string;
      dependsOn?: string[];
      conditionalRequired?: {
        when: string;
        equals: any;
      };
    };
    
    // Custom validation messages
    messages?: {
      required?: string;
      pattern?: string;
      min?: string;
      max?: string;
      custom?: Record<string, string>;
    };
  };
  
  // Display configuration for data grids
  display: {
    // Column properties
    label?: string;
    width?: number;
    minWidth?: number;
    maxWidth?: number;
    sortable?: boolean;
    filterable?: boolean;
    resizable?: boolean;
    
    // Cell formatting
    format?: string;
    prefix?: string;
    suffix?: string;
    placeholder?: string;
    textAlign?: 'left' | 'center' | 'right';
    fontWeight?: 'normal' | 'bold';
    
    // Visual enhancements
    showColorPreview?: boolean;
    showFilePreview?: boolean;
    truncateAt?: number;
    showTooltip?: boolean;
    
    // Conditional styling
    conditionalFormatting?: {
      condition: string;
      className: string;
      style?: Record<string, string>;
    }[];
  };
  
  // Editor configuration
  editor: {
    type: 'text' | 'textarea' | 'select' | 'multi-select' | 'date' | 'datetime' | 
          'file' | 'color' | 'currency' | 'phone' | 'email' | 'url' | 
          'relationship-select' | 'computed' | 'rollup';
    
    // Editor-specific settings
    multiline?: boolean;
    rows?: number;
    cols?: number;
    maxFiles?: number;
    acceptTypes?: string[];
    allowClear?: boolean;
    searchable?: boolean;
    creatable?: boolean;
    
    // Rich text editor
    richTextFeatures?: ('bold' | 'italic' | 'underline' | 'link' | 'list')[];
    
    // Date/time picker
    dateFormat?: string;
    timeFormat?: string;
    showTime?: boolean;
    minDate?: string;
    maxDate?: string;
    
    // Number input
    step?: number;
    showSpinners?: boolean;
    
    // Validation UI
    showValidationOnBlur?: boolean;
    showValidationOnChange?: boolean;
    validateWhileTyping?: boolean;
  };
  
  // Enhanced enum/options with rich metadata
  enumOptions?: EnumOption[];
  
  // Relationship metadata (for reference fields)
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
  
  // Field accessibility
  accessibility?: {
    ariaLabel?: string;
    ariaDescription?: string;
    tabIndex?: number;
    role?: string;
  };
}

export interface EnumOption {
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
}
```

### Phase 2: Enhanced Field Handler Interface

**File: `/server/dataforge/fields/index.ts`**
```typescript
export interface FieldHandler {
  validate(value: any, definition: FieldDefinition, context: any): ValidationResult;
  getDefaultValue(definition: FieldDefinition): any;
  getSqlType(definition: FieldDefinition): string;
  getSqlDefault(definition: FieldDefinition): string | null;
  
  // NEW: Rich metadata extraction
  getValidationMetadata(definition: FieldDefinition): ValidationMetadata;
  getDisplayMetadata(definition: FieldDefinition): DisplayMetadata;
  getEditorMetadata(definition: FieldDefinition): EditorMetadata;
  
  // NEW: Type-specific capabilities
  getCapabilities(): FieldCapabilities;
}

export interface FieldCapabilities {
  supportsSorting: boolean;
  supportsFiltering: boolean;
  supportsGrouping: boolean;
  supportsAggregation: boolean;
  requiresSpecialEditor: boolean;
  hasRichDisplay: boolean;
  supportsValidation: boolean;
  supportsFormatting: boolean;
}
```

### Phase 3: Enhanced Schema Processing

**File: `/server/dataforge/org-entity-schema.ts`**
```typescript
function processSchemaResponse(orgId: string, schemaArray: any[]): OrgEntitySchema {
  const entities: Record<string, EntityDefinition> = {}
  
  schemaArray.forEach(entity => {
    const businessMetadata = entity.businessMetadata || {}
    const fields = businessMetadata.fields || businessMetadata.allFields || []
    
    // Process fields with enhanced metadata extraction
    const syncableFields: Record<string, EnhancedFieldDefinition> = {}
    const customFields: Record<string, EnhancedFieldDefinition> = {}
    const relationshipFields: Record<string, RelationshipFieldDefinition> = {}
    
    fields.forEach((field: any) => {
      if (field.type === 'user_reference' || field.type === 'entity_reference') {
        // Process relationship fields
        relationshipFields[field.name] = processRelationshipField(field, orgId)
      } else {
        // Process regular and custom fields with rich metadata
        const enhancedField = processEnhancedField(field, orgId, entity.entityName)
        
        if (isCustomField(field)) {
          customFields[field.name] = enhancedField
        } else {
          syncableFields[field.name] = enhancedField
        }
      }
    })
    
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

function processEnhancedField(field: any, orgId: string, entityName: string): EnhancedFieldDefinition {
  const fieldHandler = getFieldHandler(field.type)
  
  if (!fieldHandler) {
    throw new Error(`Unknown field type: ${field.type}`)
  }
  
  // Extract rich metadata from field handler
  const validationMetadata = fieldHandler.getValidationMetadata(field)
  const displayMetadata = fieldHandler.getDisplayMetadata(field)
  const editorMetadata = fieldHandler.getEditorMetadata(field)
  const capabilities = fieldHandler.getCapabilities()
  
  return {
    name: field.name,
    type: mapFieldType(field.type),
    required: field.required || false,
    syncable: field.syncable !== false,
    defaultValue: field.defaultValue,
    
    validation: {
      ...validationMetadata,
      // Add field-specific validation rules
      pattern: field.regex || validationMetadata.pattern,
      min: field.min ?? validationMetadata.min,
      max: field.max ?? validationMetadata.max,
      minLength: field.minLength ?? validationMetadata.minLength,
      maxLength: field.maxLength ?? validationMetadata.maxLength,
      
      // Extract business rules from field definition
      businessRules: extractBusinessRules(field, entityName),
      
      // Custom validation messages
      messages: field.validationMessages || generateValidationMessages(field.name, field.type)
    },
    
    display: {
      ...displayMetadata,
      label: field.label || formatFieldName(field.name),
      width: field.width || calculateOptimalWidth(field.type, field.name),
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
    accessibility: {
      ariaLabel: field.ariaLabel || `${formatFieldName(field.name)} input`,
      ariaDescription: field.ariaDescription || generateAriaDescription(field),
      role: determineAriaRole(field.type)
    }
  }
}
```

### Phase 4: Enhanced Field Handlers

**Example: Enhanced Email Field Handler**
**File: `/server/dataforge/fields/email.ts`**
```typescript
export function getValidationMetadata(definition: FieldDefinition): ValidationMetadata {
  return {
    emailFormat: true,
    maxLength: 254, // RFC 5321 limit
    pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
    messages: {
      required: `${definition.name} is required`,
      pattern: 'Please enter a valid email address',
      maxLength: 'Email address is too long (maximum 254 characters)'
    }
  }
}

export function getDisplayMetadata(definition: FieldDefinition): DisplayMetadata {
  return {
    width: 250,
    minWidth: 150,
    textAlign: 'left',
    showTooltip: true,
    format: 'lowercase',
    placeholder: 'user@example.com'
  }
}

export function getEditorMetadata(definition: FieldDefinition): EditorMetadata {
  return {
    type: 'email',
    validateWhileTyping: true,
    showValidationOnBlur: true,
    allowClear: true
  }
}

export function getCapabilities(): FieldCapabilities {
  return {
    supportsSorting: true,
    supportsFiltering: true,
    supportsGrouping: true,
    supportsAggregation: false,
    requiresSpecialEditor: true,
    hasRichDisplay: false,
    supportsValidation: true,
    supportsFormatting: true
  }
}
```

### Phase 5: Enhanced Frontend Column Generation

**File: `/legend-state/hooks/use-entity-columns.ts`**
```typescript
function generateColumnsFromSyncableFields<T>(syncableFields: Record<string, EnhancedFieldDefinition>, entityName: string): EnhancedColumn<T>[] {
  return Object.entries(syncableFields).map(([fieldName, fieldDef]) => {
    
    return {
      id: fieldName,
      field: fieldName as keyof T & string,
      name: fieldDef.display.label || formatFieldName(fieldName),
      cellType: mapFieldTypeToCell(fieldDef.type),
      
      // Enhanced sizing
      width: fieldDef.display.width,
      minWidth: fieldDef.display.minWidth,
      maxWidth: fieldDef.display.maxWidth,
      resizable: fieldDef.display.resizable !== false,
      
      // Enhanced interaction
      editable: isFieldEditable(fieldName, fieldDef),
      sortable: fieldDef.display.sortable,
      filterable: fieldDef.display.filterable,
      
      // Rich validation metadata
      validation: {
        required: fieldDef.required,
        rules: fieldDef.validation,
        messages: fieldDef.validation.messages,
        businessRules: fieldDef.validation.businessRules
      },
      
      // Enhanced editor configuration
      editor: {
        ...fieldDef.editor,
        component: getEditorComponent(fieldDef.editor.type),
        props: generateEditorProps(fieldDef)
      },
      
      // Rich display configuration
      display: {
        ...fieldDef.display,
        formatter: getFormatter(fieldDef.type, fieldDef.display.format),
        renderer: getCellRenderer(fieldDef.type),
        className: generateCellClassName(fieldDef)
      },
      
      // Enhanced options for select fields
      options: fieldDef.enumOptions?.map(opt => ({
        value: opt.value,
        label: opt.label,
        color: opt.color,
        backgroundColor: opt.backgroundColor,
        icon: opt.icon,
        iconColor: opt.iconColor,
        group: opt.group,
        disabled: opt.disabled,
        metadata: opt.metadata
      })),
      
      // Relationship metadata
      relationship: fieldDef.relationship ? {
        ...fieldDef.relationship,
        provider: createRelationshipProvider(fieldDef.relationship),
        searchConfig: createSearchConfig(fieldDef.relationship)
      } : undefined,
      
      // Computed field metadata
      computed: fieldDef.computed ? {
        expression: fieldDef.computed.expression,
        dependencies: fieldDef.computed.dependencies,
        calculator: createCalculator(fieldDef.computed),
        refreshOn: fieldDef.computed.refreshTriggers
      } : undefined,
      
      // Rollup field metadata
      rollup: fieldDef.rollup ? {
        type: fieldDef.rollup.type,
        config: fieldDef.rollup,
        calculator: createRollupCalculator(fieldDef.rollup)
      } : undefined,
      
      // Accessibility
      accessibility: fieldDef.accessibility
    }
  })
}
```

### Phase 6: Enhanced Data Grid Integration

**File: `/components/custom/vibegrid/types.ts`**
```typescript
export interface EnhancedColumn<T> extends Column<T> {
  // Rich validation
  validation: {
    required: boolean;
    rules: ValidationMetadata;
    messages: Record<string, string>;
    businessRules?: BusinessRules;
  };
  
  // Enhanced editor
  editor: {
    type: string;
    component: React.ComponentType<any>;
    props: Record<string, any>;
  };
  
  // Rich display
  display: {
    formatter?: (value: any) => string;
    renderer?: React.ComponentType<any>;
    className?: string;
    conditionalFormatting?: ConditionalFormat[];
  };
  
  // Enhanced options
  options?: EnhancedEnumOption[];
  
  // Relationship support
  relationship?: EnhancedRelationshipConfig;
  
  // Computed field support
  computed?: ComputedFieldConfig;
  
  // Rollup field support
  rollup?: RollupFieldConfig;
  
  // Accessibility
  accessibility?: AccessibilityConfig;
}
```

### Phase 7: Migration Execution Plan

**Step 1: Update Field Handlers (1-2 days)**
- Enhance all field handlers in `/server/dataforge/fields/` with new methods
- Add validation, display, and editor metadata extraction
- Update field capabilities

**Step 2: Update Schema Processing (1 day)**
- Modify `processSchemaResponse` to use enhanced field processing
- Add business rule extraction
- Add conditional formatting generation

**Step 3: Update Frontend Interfaces (1 day)**
- Update TypeScript interfaces in both frontend and backend
- Update column generation hooks
- Update data grid column types

**Step 4: Update Data Grid Components (2-3 days)**
- Enhance cell renderers to use rich metadata
- Update editors to use enhanced configuration
- Add validation feedback components
- Add relationship dropdown components

**Step 5: Update Legend State Integration (1 day)**
- Update schema observables to handle enhanced metadata
- Update column generation from enhanced fields
- Update reactive column recalculation

**Step 6: Testing and Validation (1-2 days)**
- Test schema loading with enhanced metadata
- Validate column generation
- Test data grid functionality
- Verify validation feedback

### Migration Benefits

**Rich Data Grid Experience:**
- Type-aware editors (email validation, date pickers, color previews)
- Real-time validation with custom messages
- Smart column sizing and formatting
- Enhanced relationship dropdowns
- Computed field displays
- Rollup field calculations

**Developer Experience:**
- Comprehensive TypeScript typing
- Self-documenting field capabilities
- Consistent validation across frontend/backend
- Rich metadata for custom components

**Performance:**
- Cached metadata reduces API calls
- Efficient validation rules
- Smart editor selection
- Optimized column rendering

### Rollout Strategy

1. **Development Environment:** Implement and test entire migration
2. **Schema Regeneration:** Run migration to convert existing schemas
3. **Frontend Updates:** Update all data grid components
4. **Testing:** Comprehensive validation of enhanced functionality
5. **Deployment:** Single deployment with all enhancements

This hard migration will transform the basic schema system into a comprehensive metadata platform that provides data grids with everything needed for rich, validated, accessible editing experiences.