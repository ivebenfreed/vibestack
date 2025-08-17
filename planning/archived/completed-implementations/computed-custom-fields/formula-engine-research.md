# Formula Engine Research - Computed Custom Fields

## 🎯 **Requirements for Formula Engine**

### **Functional Requirements**
- **Mathematical Operations**: +, -, *, /, %, ^ (power)
- **Field References**: `{fieldName}` syntax for referencing other numeric fields
- **Parentheses**: Order of operations with grouping
- **Error Handling**: Division by zero, invalid references, syntax errors
- **Type Safety**: Ensure numeric operations on numeric fields only

### **Security Requirements**
- **Sandboxed Execution**: No access to global objects or functions
- **No Code Execution**: Prevent arbitrary JavaScript execution
- **Input Sanitization**: Validate and sanitize all formula expressions
- **Resource Limits**: Prevent infinite loops or excessive computation

### **Performance Requirements**
- **Fast Evaluation**: Sub-millisecond evaluation for simple formulas
- **Efficient Parsing**: Parse formula once, evaluate many times
- **Memory Efficient**: Minimal memory footprint for formula storage
- **Scalable**: Handle hundreds of computed fields per organization

## 🔍 **Formula Engine Options Analysis**

### **Option 1: Math.js** ⭐⭐⭐⭐⭐
**Repository**: https://github.com/josdejong/mathjs
**Size**: ~500KB (full), ~100KB (minimal build)

#### **Pros**
- **Comprehensive**: Full mathematical expression parser and evaluator
- **Safe Evaluation**: Built-in security features, no eval() usage
- **Custom Functions**: Can define custom functions and constants
- **Type System**: Built-in type checking and conversion
- **Well Maintained**: Active development, extensive documentation
- **Expression Parsing**: Parse once, evaluate multiple times
- **Custom Scope**: Controlled variable scope for field references

#### **Cons**
- **Large Size**: Full library is quite large (can be minimized)
- **Complex API**: More features than needed for basic calculations
- **Learning Curve**: Extensive API requires time to master

#### **Example Usage**
```javascript
import { create, all } from 'mathjs';

// Create limited math.js instance for security
const math = create({
  'add': all.add,
  'subtract': all.subtract,
  'multiply': all.multiply,
  'divide': all.divide,
  'mod': all.mod,
  'pow': all.pow,
  'parse': all.parse,
  'evaluate': all.evaluate
});

// Compile formula for reuse
const formula = math.parse('{unitPrice} * {quantity}');
const compiled = formula.compile();

// Evaluate with field values
const result = compiled.evaluate({
  unitPrice: 19.99,
  quantity: 3
}); // Result: 59.97
```

#### **Security Configuration**
```javascript
// Create restricted math.js instance
const restrictedMath = create({
  // Only allow safe mathematical operations
  'add': all.add,
  'subtract': all.subtract,
  'multiply': all.multiply,
  'divide': all.divide,
  // Exclude dangerous functions like eval, import, etc.
});

// Disable function assignment
restrictedMath.config({
  safeMode: true
});
```

### **Option 2: expr-eval** ⭐⭐⭐⭐
**Repository**: https://github.com/silentmatt/expr-eval
**Size**: ~15KB

#### **Pros**
- **Lightweight**: Very small footprint
- **Fast**: Optimized for performance
- **Safe**: No eval() usage, secure by design
- **Simple API**: Easy to integrate and use
- **Expression Compilation**: Parse once, evaluate many times
- **Custom Variables**: Easy variable substitution

#### **Cons**
- **Limited Functions**: Fewer built-in mathematical functions
- **Basic Features**: Less comprehensive than Math.js
- **Community**: Smaller community and ecosystem

#### **Example Usage**
```javascript
import { Parser } from 'expr-eval';

const parser = new Parser();

// Parse formula
const expr = parser.parse('{unitPrice} * {quantity} + {shipping}');

// Evaluate with field values
const result = expr.evaluate({
  unitPrice: 19.99,
  quantity: 2,
  shipping: 5.00
}); // Result: 44.98
```

### **Option 3: Custom Parser** ⭐⭐⭐
**Size**: ~5-10KB (custom implementation)

#### **Pros**
- **Minimal Size**: Smallest possible footprint
- **Complete Control**: Full control over features and security
- **Perfect Fit**: Designed exactly for our use case
- **No Dependencies**: No external dependencies

#### **Cons**
- **Development Time**: Significant time investment to build
- **Testing Required**: Extensive testing needed for edge cases
- **Maintenance**: Ongoing maintenance and bug fixes required
- **Limited Features**: Would need to implement all desired features

#### **Example Implementation Structure**
```javascript
class FormulaParser {
  private tokenize(formula: string): Token[] {
    // Convert formula string to tokens
  }
  
  private parse(tokens: Token[]): AST {
    // Build abstract syntax tree
  }
  
  private validate(ast: AST, availableFields: string[]): ValidationResult {
    // Validate field references and syntax
  }
  
  evaluate(ast: AST, fieldValues: Record<string, number>): number {
    // Evaluate the expression tree
  }
}
```

### **Option 4: Formula.js** ⭐⭐⭐
**Repository**: https://github.com/formulajs/formulajs
**Size**: ~100KB

#### **Pros**
- **Excel-like**: Similar to Excel formula syntax
- **Many Functions**: Extensive function library
- **Well Tested**: Good test coverage

#### **Cons**
- **Excel Focus**: Designed for spreadsheet-like functionality
- **Size**: Larger than needed for basic math
- **Complexity**: More complex than required

### **Option 5: HyperFormula** ⭐⭐
**Repository**: https://github.com/handsontable/hyperformula
**Size**: ~200KB

#### **Pros**
- **Excel Compatible**: Full Excel formula compatibility
- **Performance**: Optimized for large datasets
- **Dependency Tracking**: Built-in dependency management

#### **Cons**
- **Overkill**: Designed for full spreadsheet engines
- **Size**: Much larger than needed
- **Complexity**: Complex API for simple use cases

## 🏆 **Recommendation: Math.js with Restricted Configuration**

### **Why Math.js?**
1. **Security First**: Built-in security features with configurable restrictions
2. **Performance**: Compile-once, evaluate-many pattern for efficiency
3. **Flexibility**: Can start simple and add features as needed
4. **Reliability**: Mature, well-tested library with active maintenance
5. **Documentation**: Excellent documentation and examples

### **Implementation Strategy**

#### **1. Minimal Math.js Build**
```javascript
import { create } from 'mathjs';

// Create minimal, secure math instance
export const formulaMath = create({
  // Arithmetic
  'add': all.add,
  'subtract': all.subtract,
  'multiply': all.multiply,
  'divide': all.divide,
  'mod': all.mod,
  'pow': all.pow,
  
  // Comparison (for future conditional logic)
  'equal': all.equal,
  'larger': all.larger,
  'smaller': all.smaller,
  
  // Utilities
  'parse': all.parse,
  'evaluate': all.evaluate,
  
  // Math functions
  'abs': all.abs,
  'round': all.round,
  'min': all.min,
  'max': all.max,
  'sqrt': all.sqrt
});

// Configure for safety
formulaMath.config({
  safeMode: true
});
```

#### **2. Formula Processor Class**
```typescript
export class FormulaProcessor {
  private compiledFormulas = new Map<string, any>();
  
  parseFormula(formula: string): FormulaParseResult {
    try {
      // Replace {fieldName} with proper variable syntax
      const processedFormula = this.preprocessFieldReferences(formula);
      
      // Parse and compile
      const parsed = formulaMath.parse(processedFormula);
      const compiled = parsed.compile();
      
      return {
        success: true,
        compiled,
        dependencies: this.extractDependencies(formula)
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  evaluateFormula(compiled: any, fieldValues: Record<string, number>): number {
    return compiled.evaluate(fieldValues);
  }
  
  private preprocessFieldReferences(formula: string): string {
    // Convert {fieldName} to fieldName for math.js
    return formula.replace(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, '$1');
  }
  
  private extractDependencies(formula: string): string[] {
    const matches = formula.match(/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g);
    return matches ? matches.map(m => m.slice(1, -1)) : [];
  }
}
```

#### **3. Security Validation**
```typescript
export class FormulaValidator {
  validateFormula(formula: string, availableFields: string[]): ValidationResult {
    // Check syntax
    const syntaxResult = this.validateSyntax(formula);
    if (!syntaxResult.valid) return syntaxResult;
    
    // Check field references
    const dependencies = this.extractDependencies(formula);
    const invalidFields = dependencies.filter(field => !availableFields.includes(field));
    
    if (invalidFields.length > 0) {
      return {
        valid: false,
        errors: [`Unknown fields: ${invalidFields.join(', ')}`]
      };
    }
    
    // Check for circular dependencies (when validating in context)
    return { valid: true, errors: [] };
  }
  
  detectCircularDependency(fieldName: string, dependencies: string[], 
                          allFormulas: Record<string, string[]>): boolean {
    // Implement cycle detection algorithm
    return this.hasCircularReference(fieldName, dependencies, allFormulas, new Set());
  }
}
```

## 🧪 **Proof of Concept Implementation**

```typescript
// Example usage
const processor = new FormulaProcessor();
const validator = new FormulaValidator();

// Define available fields
const availableFields = ['unitPrice', 'quantity', 'discount', 'taxRate'];

// Create formula
const formula = '({unitPrice} * {quantity}) * (1 - {discount}/100) * (1 + {taxRate}/100)';

// Validate
const validation = validator.validateFormula(formula, availableFields);
if (!validation.valid) {
  throw new Error(validation.errors.join(', '));
}

// Parse and compile
const parseResult = processor.parseFormula(formula);
if (!parseResult.success) {
  throw new Error(parseResult.error);
}

// Evaluate with real data
const result = processor.evaluateFormula(parseResult.compiled, {
  unitPrice: 100,
  quantity: 2,
  discount: 10,     // 10% discount
  taxRate: 8.5      // 8.5% tax
});

console.log(result); // 195.30
```

## 📊 **Performance Testing Plan**

### **Benchmarks to Run**
1. **Parse Time**: How long to parse and compile formulas
2. **Evaluation Time**: How long to evaluate compiled formulas
3. **Memory Usage**: Memory footprint of compiled formulas
4. **Complex Formulas**: Performance with nested expressions
5. **Batch Evaluation**: Performance when evaluating many formulas

### **Test Cases**
```javascript
const testFormulas = [
  // Simple arithmetic
  '{a} + {b}',
  '{price} * {quantity}',
  
  // Complex business logic
  '({revenue} - {costs}) / {revenue} * 100',
  '{hours} * {rate} + ({hours} > 40 ? ({hours} - 40) * {overtimeRate} : 0)',
  
  // Mathematical functions
  'sqrt({a}^2 + {b}^2)',
  'min({budget}, max({minBudget}, {requestedBudget}))'
];
```

## 🎯 **Next Steps**

1. **Prototype Implementation**: Build basic FormulaProcessor with Math.js
2. **Security Testing**: Verify sandboxing and safety measures
3. **Performance Benchmarking**: Test with realistic formula complexity
4. **Integration Planning**: Design integration with current field system
5. **UI Design**: Plan formula creation interface

---

*Math.js provides the best balance of security, performance, and features for implementing computed custom fields in a production environment.*