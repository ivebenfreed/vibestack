# JSON Type Guards Generation Plan

## Overview

Enhance the existing `RuntimeSchemaGenerator` to produce JSON type guards for dynamic schema validation with full TypeScript type safety.

## Current State Analysis

### What We Have ✅
- `RuntimeSchemaGenerator` with TypeScript interface generation
- `OrgSchemaClient` with runtime validation
- Field type mapping (`fieldTypeToTSType()`)
- Schema caching (memory + localStorage)
- Dynamic entity definitions from server

### What's Missing ⚠️
- JSON Schema generation from entity definitions
- TypeScript type guard functions
- Runtime type narrowing with compile-time safety
- Validation result types with proper error handling

## Implementation Plan

### Phase 1: Extend RuntimeSchemaGenerator

#### 1.1 Add JSON Schema Generation
```typescript
/**
 * Generate JSON Schema from entity definition
 */
generateJSONSchema(definition: OrgEntityDefinition): object {
  const baseSchema = this.getBaseArchetypeSchema(definition.extends);
  const customSchema = this.getCustomFieldsSchema(definition.customFields);
  
  return {
    type: "object",
    properties: {
      ...baseSchema.properties,
      ...customSchema
    },
    required: [
      ...baseSchema.required,
      ...this.getRequiredCustomFields(definition.customFields)
    ],
    additionalProperties: false
  };
}
```

#### 1.2 Add Type Guard Generation
```typescript
/**
 * Generate TypeScript type guard functions
 */
generateTypeGuards(orgId: string, entityName: string, definition: OrgEntityDefinition): {
  jsonSchema: object;
  typeGuardCode: string;
  validatorCode: string;
} {
  const jsonSchema = this.generateJSONSchema(definition);
  const pascalName = this.toPascal(entityName);
  
  const typeGuardCode = `
export function is${pascalName}(data: unknown): data is ${pascalName} {
  return validateEntitySchema('${entityName}', data);
}

export function assertIs${pascalName}(data: unknown): asserts data is ${pascalName} {
  if (!is${pascalName}(data)) {
    throw new ValidationError(\`Invalid ${entityName} data\`, getValidationErrors('${entityName}', data));
  }
}`;

  const validatorCode = `
export function validate${pascalName}(data: unknown): ValidationResult<${pascalName}> {
  const errors = getValidationErrors('${entityName}', data);
  return {
    valid: errors.length === 0,
    data: errors.length === 0 ? data as ${pascalName} : undefined,
    errors
  };
}

export function parse${pascalName}(data: unknown): ${pascalName} {
  const result = validate${pascalName}(data);
  if (!result.valid) {
    throw new ValidationError(\`Invalid ${entityName} data\`, result.errors);
  }
  return result.data!;
}`;

  return { jsonSchema, typeGuardCode, validatorCode };
}
```

### Phase 2: Update API Endpoints

#### 2.1 Enhance Schema API Response
Update `/api/dataforge/orgs/{orgId}/schema` to include:
```json
{
  "success": true,
  "schema": {
    "orgId": "01920000-1000-7000-8000-000000000001",
    "entities": {
      "Project": {
        "tableName": "org_..._project",
        "extends": "base_projects",
        "syncableFields": { ... },
        "jsonSchema": { "type": "object", ... },
        "typeGuardCode": "export function isProject...",
        "validatorCode": "export function validateProject..."
      }
    },
    "version": "1.0.0"
  }
}
```

#### 2.2 Add Type Guard Endpoint
New endpoint: `/api/dataforge/orgs/{orgId}/type-guards`
```typescript
// Returns executable JavaScript/TypeScript code
{
  "success": true,
  "code": "// Generated type guards\nexport function isProject...",
  "schemas": { "Project": { ... } },
  "version": "1.0.0"
}
```

### Phase 3: Update Client-Side Integration

#### 3.1 Enhance OrgSchemaClient
```typescript
export class OrgSchemaClient {
  private typeGuards = new Map<string, TypeGuardCollection>();
  private validationSchemas = new Map<string, object>();

  /**
   * Load type guards and validation schemas
   */
  async loadTypeGuards(orgId: string): Promise<TypeGuardLoadResult> {
    const response = await fetch(`${this.BASE_URL}/orgs/${orgId}/type-guards`);
    const result = await response.json();
    
    if (result.success) {
      // Execute the generated code to register type guards
      this.executeTypeGuardCode(orgId, result.code);
      this.cacheTypeGuards(orgId, result);
    }
    
    return result;
  }

  /**
   * Runtime validation with type narrowing
   */
  validateWithTypeGuard<T>(orgId: string, entityName: string, data: unknown): ValidationResult<T> {
    const typeGuards = this.typeGuards.get(orgId);
    if (!typeGuards || !typeGuards[entityName]) {
      throw new Error(`Type guard not loaded for ${entityName}`);
    }
    
    return typeGuards[entityName].validate(data);
  }

  /**
   * Type-safe parsing
   */
  parseEntity<T>(orgId: string, entityName: string, data: unknown): T {
    const result = this.validateWithTypeGuard<T>(orgId, entityName, data);
    if (!result.valid) {
      throw new ValidationError(`Invalid ${entityName}`, result.errors);
    }
    return result.data!;
  }
}
```

#### 3.2 Usage in Client Code
```typescript
// Load schemas and type guards
await orgSchemaClient.loadOrgSchema(orgId);
await orgSchemaClient.loadTypeGuards(orgId);

// Type-safe validation
function handleProjectData(rawData: unknown) {
  // Runtime validation with compile-time type safety
  const result = orgSchemaClient.validateWithTypeGuard<Project>(orgId, 'Project', rawData);
  
  if (result.valid) {
    // TypeScript knows result.data is Project
    console.log(result.data.name); // ✅ Type-safe
    console.log(result.data.status); // ✅ Type-safe
  } else {
    console.error('Validation failed:', result.errors);
  }
}

// Alternative: Parse with exception
try {
  const project = orgSchemaClient.parseEntity<Project>(orgId, 'Project', rawData);
  // project is guaranteed to be Project type
  console.log(project.name); // ✅ Type-safe
} catch (error) {
  // Handle validation error
}
```

### Phase 4: Integration with Existing Systems

#### 4.1 Legend State Integration
```typescript
// Type-safe observables with runtime validation
const projectStore = observable({
  projects: [] as Project[],
  
  addProject(rawData: unknown) {
    const project = orgSchemaClient.parseEntity<Project>(orgId, 'Project', rawData);
    this.projects.push(project); // ✅ Type-safe
  }
});
```

#### 4.2 Form Integration
```typescript
// Generate forms with validation
const formConfig = await orgSchemaClient.generateFormFields(orgId, 'Project');
const validator = (data: unknown) => 
  orgSchemaClient.validateWithTypeGuard<Project>(orgId, 'Project', data);
```

## Implementation Details

### Field Type to JSON Schema Mapping
```typescript
private fieldTypeToJSONSchema(fieldDef: FieldDefinition): object {
  const base = {
    type: this.mapFieldTypeToJSONType(fieldDef.type)
  };
  
  // Add validation constraints
  if (fieldDef.enum) base.enum = fieldDef.enum;
  if (fieldDef.validation?.pattern) base.pattern = fieldDef.validation.pattern;
  if (fieldDef.validation?.min) base.minimum = fieldDef.validation.min;
  if (fieldDef.validation?.max) base.maximum = fieldDef.validation.max;
  
  return base;
}
```

### Validation Engine
```typescript
class ValidationEngine {
  private schemas = new Map<string, object>();
  
  validateEntitySchema(entityName: string, data: unknown): boolean {
    const schema = this.schemas.get(entityName);
    if (!schema) return false;
    
    return this.validateAgainstJSONSchema(schema, data);
  }
  
  getValidationErrors(entityName: string, data: unknown): string[] {
    // JSON Schema validation with detailed error messages
  }
}
```

## Benefits

### ✅ Runtime Type Safety
- Full TypeScript type checking for dynamic schemas
- Compile-time safety with runtime validation
- Type narrowing with validation

### ✅ Performance
- Cached type guards and schemas
- Fast validation without external dependencies
- Minimal runtime overhead

### ✅ Developer Experience
- Auto-completion for dynamic entities
- Clear error messages
- Type-safe form generation

### ✅ Dynamic Schema Support
- Updates without rebuilds
- Schema versioning
- Cache invalidation

## Migration Strategy

### Phase 1: Add to Existing (No Breaking Changes)
- Extend current APIs with optional type guard fields
- Add new type guard endpoints
- Enhance client with backward compatibility

### Phase 2: Gradual Adoption
- Convert existing validation calls
- Update form generators
- Add type guards to critical paths

### Phase 3: Full Integration
- Use type guards everywhere
- Remove old validation methods
- Optimize performance

## File Structure
```
apps/server/src/dataforge/
├── kysely-generator/
│   ├── runtime-schema-generator.ts (enhanced)
│   ├── json-schema-generator.ts (new)
│   └── type-guard-generator.ts (new)
├── validation/
│   ├── validation-engine.ts (new)
│   └── json-schema-validator.ts (new)

apps/web/src/lib/
├── schema-client.ts (enhanced)
├── type-guards.ts (new)
└── validation-types.ts (new)
```

## Success Metrics

- ✅ All dynamic entities have type guards
- ✅ Zero runtime type errors in production
- ✅ Form validation uses generated schemas
- ✅ Client-server type alignment 100%
- ✅ Schema updates work without rebuilds

## Next Steps

1. **Implement JSON Schema generation** in `RuntimeSchemaGenerator`
2. **Add type guard code generation** methods
3. **Update API endpoints** to include type guards
4. **Enhance OrgSchemaClient** with validation
5. **Test with existing entities** (Project, Task, etc.)
6. **Integrate with Legend State** observables
7. **Add comprehensive tests** for all scenarios

This plan maintains your current architecture while adding the missing piece: **runtime type safety for dynamic schemas**.