import type { Env, EntityDefinition, EntitySchema, FunctionExecutionResult } from './types.js';
import { getPrimitive } from './primitives.js';

export class FunctionFactory {
  constructor(private env: Env) {}

  // Deploy a complete entity with all functions
  async deployEntity(entityDef: EntityDefinition): Promise<EntitySchema> {
    const primitive = getPrimitive(entityDef.basePrimitive);
    if (!primitive) {
      throw new Error(`Unknown primitive: ${entityDef.basePrimitive}`);
    }

    // Generate table name
    const tableName = `${entityDef.orgId}_${entityDef.name.toLowerCase()}s`;

    // Create entity schema
    const schema: EntitySchema = {
      definition: entityDef,
      tableName,
      createdAt: new Date().toISOString(),
      version: 1
    };

    // Generate and store functions
    await this.generateEntityFunctions(entityDef, primitive);

    // Store schema
    const schemaKey = `schema:${entityDef.orgId}:${entityDef.name}`;
    await this.env.ENTITY_SCHEMAS.put(schemaKey, JSON.stringify(schema));

    // Store table mapping
    const tableKey = `table:${entityDef.orgId}:${entityDef.name}`;
    await this.env.ENTITY_CONFIG.put(tableKey, tableName);

    return schema;
  }

  // Generate all functions for an entity
  private async generateEntityFunctions(entityDef: EntityDefinition, primitive: any): Promise<void> {
    const functions = {
      validate: this.generateValidationFunction(entityDef, primitive),
      save: this.generateSaveFunction(entityDef, primitive),
      query: this.generateQueryFunction(entityDef, primitive)
    };

    // Add custom business logic functions
    if (entityDef.businessLogic.validate) {
      functions.validate = entityDef.businessLogic.validate;
    }
    if (entityDef.businessLogic.onSave) {
      functions.onSave = entityDef.businessLogic.onSave;
    }
    if (entityDef.businessLogic.onStatusChange) {
      functions.onStatusChange = entityDef.businessLogic.onStatusChange;
    }

    // Store each function in KV
    for (const [fnName, code] of Object.entries(functions)) {
      const key = `fn:${entityDef.orgId}:${entityDef.name}:${fnName}`;
      await this.env.ENTITY_FUNCTIONS.put(key, code);
    }
  }

  // Generate validation function
  private generateValidationFunction(entityDef: EntityDefinition, primitive: any): string {
    const validations: string[] = [];

    // Core field validations
    Object.entries(primitive.coreFields).forEach(([fieldName, fieldType]) => {
      if (fieldName !== 'id' && fieldName !== 'created_at' && fieldName !== 'updated_at') {
        validations.push(`
          if (!data.${fieldName}) {
            errors.push('${fieldName} is required');
          }
        `);
      }
    });

    // Custom field validations
    Object.entries(entityDef.customFields).forEach(([fieldName, fieldDef]) => {
      if (fieldDef.required) {
        validations.push(`
          if (!data.${fieldName}) {
            errors.push('${fieldName} is required');
          }
        `);
      }

      if (fieldDef.type === 'email') {
        validations.push(`
          if (data.${fieldName} && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(data.${fieldName})) {
            errors.push('${fieldName} must be a valid email');
          }
        `);
      }

      if (fieldDef.type === 'url') {
        validations.push(`
          if (data.${fieldName}) {
            try {
              new URL(data.${fieldName});
            } catch {
              errors.push('${fieldName} must be a valid URL');
            }
          }
        `);
      }
    });

    return `
      function validate(data) {
        const errors = [];
        
        ${validations.join('\n')}
        
        return {
          valid: errors.length === 0,
          errors: errors
        };
      }
      
      return validate(data);
    `;
  }

  // Generate save function
  private generateSaveFunction(entityDef: EntityDefinition, primitive: any): string {
    return `
      function save(data) {
        // Auto-generate ID if not provided
        if (!data.id) {
          data.id = crypto.randomUUID();
        }
        
        // Set timestamps
        const now = new Date().toISOString();
        if (!data.created_at) {
          data.created_at = now;
        }
        data.updated_at = now;
        
        // Set default status if defined
        if (!data.status && '${primitive.defaultStatus}') {
          data.status = '${primitive.defaultStatus}';
        }
        
        // Separate core fields from custom fields
        const coreFields = {};
        const customFields = {};
        
        ${Object.keys(primitive.coreFields).map(field => `
          if (data.${field} !== undefined) {
            coreFields.${field} = data.${field};
          }
        `).join('')}
        
        ${Object.keys(entityDef.customFields).map(field => `
          if (data.${field} !== undefined) {
            customFields.${field} = data.${field};
          }
        `).join('')}
        
        return {
          ...coreFields,
          custom_data: customFields
        };
      }
      
      return save(data);
    `;
  }

  // Generate query function
  private generateQueryFunction(entityDef: EntityDefinition, primitive: any): string {
    return `
      function query(filters = {}) {
        // This would generate SQL or KV queries
        // For POC, just return the filter structure
        return {
          table: '${entityDef.orgId}_${entityDef.name.toLowerCase()}s',
          filters: filters,
          coreFields: ${JSON.stringify(Object.keys(primitive.coreFields))},
          customFields: ${JSON.stringify(Object.keys(entityDef.customFields))}
        };
      }
      
      return query(filters);
    `;
  }

  // Execute a function
  async executeFunction(orgId: string, entityName: string, operation: string, data: any): Promise<FunctionExecutionResult> {
    try {
      const functionKey = `fn:${orgId}:${entityName}:${operation}`;
      const code = await this.env.ENTITY_FUNCTIONS.get(functionKey);

      if (!code) {
        return {
          success: false,
          error: `Function not found: ${functionKey}`
        };
      }

      // Execute function in safe context
      const result = this.executeFunctionCode(code, data);

      return {
        success: true,
        result: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Safe function execution
  private executeFunctionCode(code: string, data: any): any {
    // Create safe execution context
    const safeContext = {
      console: {
        log: (...args: any[]) => console.log('[FUNCTION]', ...args),
        error: (...args: any[]) => console.error('[FUNCTION]', ...args)
      },
      crypto: globalThis.crypto,
      data: data,
      filters: data // For query functions
    };

    // Wrap code for safe execution
    const wrappedCode = `
      "use strict";
      ${code}
    `;

    try {
      return Function('console', 'crypto', 'data', 'filters', wrappedCode)(
        safeContext.console,
        safeContext.crypto,
        safeContext.data,
        safeContext.filters
      );
    } catch (error) {
      throw new Error(`Function execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get entity schema
  async getEntitySchema(orgId: string, entityName: string): Promise<EntitySchema | null> {
    const schemaKey = `schema:${orgId}:${entityName}`;
    const schemaJson = await this.env.ENTITY_SCHEMAS.get(schemaKey);
    
    if (!schemaJson) {
      return null;
    }

    return JSON.parse(schemaJson);
  }

  // List all entities for an org
  async listOrgEntities(orgId: string): Promise<string[]> {
    const prefix = `schema:${orgId}:`;
    const list = await this.env.ENTITY_SCHEMAS.list({ prefix });
    
    return list.keys.map(key => key.name.replace(prefix, ''));
  }
}