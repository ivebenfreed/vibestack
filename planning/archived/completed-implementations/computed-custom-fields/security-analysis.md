# Security Analysis - Computed Custom Fields

## 🛡️ **Security Threat Model**

### **Potential Attack Vectors**

#### **1. Code Injection Attacks**
**Threat**: User provides malicious formula that executes arbitrary JavaScript
```javascript
// Malicious examples that must be prevented:
'{field} + (function(){return window.fetch("/api/admin/delete");})()'
'{field} + eval("malicious_code")'
'{field} + constructor.constructor("return process")().exit()'
```

**Mitigation**: Use sandboxed expression evaluator (Math.js) with restricted functions

#### **2. Resource Exhaustion**
**Threat**: Formula causes infinite loops or excessive computation
```javascript
// Problematic formulas:
'{field} + {field} + {field} + ...' // Extremely long formula
'factorial(999999)'                  // Computationally expensive
```

**Mitigation**: Formula length limits, computation timeouts, function restrictions

#### **3. Information Disclosure**
**Threat**: Computed field accesses sensitive data or reveals system information
```javascript
// Attempts to access sensitive data:
'{sensitiveField} + {secretKey}'
'{field} + JSON.stringify(window.location)'
```

**Mitigation**: Field access validation, server-only sensitive fields

#### **4. Circular Dependency DoS**
**Threat**: Circular references cause infinite computation loops
```javascript
// Field A: {fieldB} + 1
// Field B: {fieldA} + 1  // Creates infinite loop
```

**Mitigation**: Dependency cycle detection during formula validation

#### **5. Cross-Organization Data Access**
**Threat**: Formula attempts to access data from other organizations
```javascript
// Attempting cross-org access:
'{org_456_sensitive_field}'  // Wrong organization
```

**Mitigation**: Organization-scoped field validation

## 🔒 **Security Model Design**

### **Layer 1: Formula Parsing Security**

#### **Math.js Sandboxing Configuration**
```typescript
import { create } from 'mathjs';

// Create restricted Math.js instance
export const secureMath = create({
  // ALLOWED: Basic arithmetic operations
  'add': all.add,
  'subtract': all.subtract,
  'multiply': all.multiply,
  'divide': all.divide,
  'mod': all.mod,
  'pow': all.pow,
  
  // ALLOWED: Safe math functions
  'abs': all.abs,
  'round': all.round,
  'floor': all.floor,
  'ceil': all.ceil,
  'min': all.min,
  'max': all.max,
  'sqrt': all.sqrt,
  
  // ALLOWED: Comparison operators (for future conditional logic)
  'equal': all.equal,
  'larger': all.larger,
  'smaller': all.smaller,
  
  // REQUIRED: Parser components
  'parse': all.parse,
  'evaluate': all.evaluate
  
  // EXPLICITLY EXCLUDED:
  // - eval, import, createUnit
  // - subset, index, matrix operations
  // - string functions, regex
  // - file system access
  // - network functions
  // - random functions (for deterministic results)
});

// Configure for maximum security
secureMath.config({
  safeMode: true,        // Disable dangerous operations
  predictable: true      // Ensure deterministic results
});
```

#### **Input Sanitization**
```typescript
export class FormulaSanitizer {
  private readonly MAX_FORMULA_LENGTH = 1000;
  private readonly ALLOWED_CHARACTERS = /^[a-zA-Z0-9_+\-*/(){}.\s%^<>=!&|?:,]+$/;
  private readonly BLOCKED_KEYWORDS = [
    'eval', 'function', 'constructor', 'prototype', 'window', 'global', 
    'process', 'require', 'import', 'export', 'fetch', 'XMLHttpRequest'
  ];

  sanitizeFormula(formula: string): SanitizationResult {
    // Length check
    if (formula.length > this.MAX_FORMULA_LENGTH) {
      return {
        valid: false,
        error: `Formula too long (max ${this.MAX_FORMULA_LENGTH} characters)`
      };
    }

    // Character whitelist
    if (!this.ALLOWED_CHARACTERS.test(formula)) {
      return {
        valid: false,
        error: 'Formula contains invalid characters'
      };
    }

    // Keyword blacklist
    const lowerFormula = formula.toLowerCase();
    for (const keyword of this.BLOCKED_KEYWORDS) {
      if (lowerFormula.includes(keyword)) {
        return {
          valid: false,
          error: `Formula contains blocked keyword: ${keyword}`
        };
      }
    }

    return { valid: true, sanitized: formula.trim() };
  }
}
```

### **Layer 2: Field Access Control**

#### **Organization-Scoped Field Validation**
```typescript
export class FieldAccessValidator {
  validateFieldAccess(
    fieldName: string, 
    organizationId: string, 
    availableFields: string[],
    userPermissions: UserPermissions
  ): FieldAccessResult {
    
    // Check if field exists in organization schema
    if (!availableFields.includes(fieldName)) {
      return {
        allowed: false,
        reason: `Field '${fieldName}' does not exist in organization schema`
      };
    }

    // Check organization scope
    if (!this.isFieldInOrganization(fieldName, organizationId)) {
      return {
        allowed: false,
        reason: `Field '${fieldName}' is not accessible in organization ${organizationId}`
      };
    }

    // Check user permissions for sensitive fields
    if (this.isSensitiveField(fieldName) && !userPermissions.canAccessSensitiveFields) {
      return {
        allowed: false,
        reason: `Insufficient permissions to access sensitive field '${fieldName}'`
      };
    }

    // Check field syncability (only syncable fields available in client-side formulas)
    const fieldDefinition = this.getFieldDefinition(fieldName, organizationId);
    if (fieldDefinition?.serverOnly && !userPermissions.isServerContext) {
      return {
        allowed: false,
        reason: `Field '${fieldName}' is server-only and cannot be used in client formulas`
      };
    }

    return { allowed: true };
  }

  private isFieldInOrganization(fieldName: string, organizationId: string): boolean {
    // Check if field belongs to current organization
    return fieldName.startsWith(`${organizationId}_`) || 
           this.isBaseArchetypeField(fieldName);
  }
}
```

### **Layer 3: Dependency Cycle Detection**

#### **Circular Reference Prevention**
```typescript
export class DependencyValidator {
  detectCircularDependency(
    fieldName: string,
    newDependencies: string[],
    existingFormulas: Map<string, string[]>
  ): CircularDependencyResult {
    
    // Build dependency graph
    const dependencyGraph = new Map(existingFormulas);
    dependencyGraph.set(fieldName, newDependencies);

    // Detect cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const field of dependencyGraph.keys()) {
      if (this.hasCycle(field, dependencyGraph, visited, recursionStack)) {
        const cycle = this.findCycle(field, dependencyGraph);
        return {
          hasCycle: true,
          cycle,
          error: `Circular dependency detected: ${cycle.join(' → ')}`
        };
      }
    }

    return { hasCycle: false };
  }

  private hasCycle(
    field: string,
    graph: Map<string, string[]>,
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(field)) return true;
    if (visited.has(field)) return false;

    visited.add(field);
    recursionStack.add(field);

    const dependencies = graph.get(field) || [];
    for (const dep of dependencies) {
      if (this.hasCycle(dep, graph, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(field);
    return false;
  }
}
```

### **Layer 4: Resource Protection**

#### **Computation Limits**
```typescript
export class ComputationLimiter {
  private readonly MAX_COMPUTATION_TIME = 1000; // 1 second
  private readonly MAX_RECURSION_DEPTH = 100;
  private readonly MAX_DEPENDENCIES = 50;

  async evaluateFormulaWithLimits(
    compiled: any,
    fieldValues: Record<string, number>
  ): Promise<FormulaEvaluationResult> {
    
    return new Promise((resolve, reject) => {
      // Set computation timeout
      const timeoutId = setTimeout(() => {
        reject(new Error('Formula computation timed out'));
      }, this.MAX_COMPUTATION_TIME);

      try {
        // Count dependencies
        const dependencyCount = Object.keys(fieldValues).length;
        if (dependencyCount > this.MAX_DEPENDENCIES) {
          throw new Error(`Too many dependencies (${dependencyCount}, max ${this.MAX_DEPENDENCIES})`);
        }

        // Evaluate formula
        const result = compiled.evaluate(fieldValues);
        
        clearTimeout(timeoutId);
        resolve({
          success: true,
          result,
          computationTime: Date.now() - startTime
        });
      } catch (error) {
        clearTimeout(timeoutId);
        resolve({
          success: false,
          error: error.message
        });
      }
    });
  }
}
```

### **Layer 5: Data Type Validation**

#### **Type Safety Enforcement**
```typescript
export class TypeValidator {
  validateFieldTypes(
    fieldValues: Record<string, any>,
    expectedTypes: Record<string, string>
  ): TypeValidationResult {
    
    const errors: string[] = [];

    for (const [fieldName, value] of Object.entries(fieldValues)) {
      const expectedType = expectedTypes[fieldName];
      
      if (!this.isValidType(value, expectedType)) {
        errors.push(
          `Field '${fieldName}' expected ${expectedType} but got ${typeof value}`
        );
      }

      // Ensure numeric fields are actually numeric
      if (['number', 'decimal', 'integer'].includes(expectedType)) {
        if (!this.isValidNumber(value)) {
          errors.push(
            `Field '${fieldName}' is not a valid number: ${value}`
          );
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  private isValidNumber(value: any): boolean {
    return typeof value === 'number' && 
           !isNaN(value) && 
           isFinite(value);
  }
}
```

## 🔐 **Security Configuration**

### **Client-Side Security**
```typescript
// Client-side formula processor with maximum restrictions
export class ClientFormulaProcessor {
  private sanitizer = new FormulaSanitizer();
  private validator = new FieldAccessValidator();
  private limiter = new ComputationLimiter();

  async processFormula(
    formula: string,
    organizationId: string,
    availableFields: string[],
    fieldValues: Record<string, number>,
    userPermissions: UserPermissions
  ): Promise<FormulaResult> {
    
    // Step 1: Sanitize input
    const sanitized = this.sanitizer.sanitizeFormula(formula);
    if (!sanitized.valid) {
      return { success: false, error: sanitized.error };
    }

    // Step 2: Validate field access
    const dependencies = this.extractDependencies(formula);
    for (const field of dependencies) {
      const access = this.validator.validateFieldAccess(
        field, organizationId, availableFields, userPermissions
      );
      if (!access.allowed) {
        return { success: false, error: access.reason };
      }
    }

    // Step 3: Parse and evaluate with limits
    try {
      const parsed = secureMath.parse(this.preprocessFormula(sanitized.sanitized));
      const compiled = parsed.compile();
      
      return await this.limiter.evaluateFormulaWithLimits(compiled, fieldValues);
    } catch (error) {
      return { success: false, error: `Formula evaluation failed: ${error.message}` };
    }
  }
}
```

### **Server-Side Security**
```typescript
// Server-side with additional validation and logging
export class ServerFormulaProcessor extends ClientFormulaProcessor {
  private auditLogger = new AuditLogger();

  async processFormulaWithAudit(
    formula: string,
    organizationId: string,
    userId: string,
    context: FormulaContext
  ): Promise<FormulaResult> {
    
    // Log formula execution attempt
    this.auditLogger.logFormulaExecution({
      formula,
      organizationId,
      userId,
      timestamp: new Date(),
      context
    });

    const result = await super.processFormula(formula, organizationId, ...args);

    // Log result
    this.auditLogger.logFormulaResult({
      success: result.success,
      error: result.error,
      computationTime: result.computationTime
    });

    return result;
  }
}
```

## 🧪 **Security Testing Plan**

### **Penetration Testing Scenarios**
```typescript
const securityTests = [
  // Code injection attempts
  {
    name: 'JavaScript injection',
    formula: '{field} + eval("console.log(1)")',
    expectError: true
  },
  {
    name: 'Constructor exploitation',
    formula: '{field} + constructor.constructor("return process")()',
    expectError: true
  },

  // Resource exhaustion
  {
    name: 'Long computation',
    formula: 'pow(9999, 9999)',
    expectTimeout: true
  },
  {
    name: 'Circular reference',
    formulas: {
      fieldA: '{fieldB} + 1',
      fieldB: '{fieldA} + 1'
    },
    expectError: true
  },

  // Data access violations
  {
    name: 'Cross-org field access',
    formula: '{other_org_field}',
    expectError: true
  },
  {
    name: 'Server-only field access',
    formula: '{serverOnlyField}',
    expectError: true
  }
];
```

## ✅ **Security Checklist**

### **Pre-Deployment Security Verification**
- [ ] **Input Sanitization**: All formulas sanitized for malicious content
- [ ] **Expression Sandboxing**: Math.js configured with minimal, safe functions only
- [ ] **Field Access Control**: Organization and permission-based field validation
- [ ] **Circular Dependency Prevention**: Cycle detection prevents infinite loops
- [ ] **Resource Limits**: Timeouts and limits prevent DoS attacks
- [ ] **Type Validation**: Ensure only numeric operations on numeric fields
- [ ] **Audit Logging**: All formula executions logged for security monitoring
- [ ] **Error Handling**: Secure error messages that don't leak sensitive information

### **Ongoing Security Monitoring**
- [ ] **Performance Monitoring**: Track formula execution times
- [ ] **Error Rate Monitoring**: Monitor for suspicious error patterns
- [ ] **Access Pattern Analysis**: Detect unusual field access patterns
- [ ] **Security Updates**: Keep Math.js and dependencies updated

---

*This security model provides defense-in-depth protection against code injection, resource exhaustion, and data access violations while maintaining the flexibility needed for computed custom fields.*