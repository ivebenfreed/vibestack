/**
 * Expression Evaluator
 * 
 * Safe mathematical expression parser and evaluator for computed fields.
 * Provides sandboxed execution of mathematical expressions with field references.
 */

export interface ExpressionContext {
  [key: string]: any;
}

export interface ExpressionResult {
  value: any;
  error?: string;
  dependencies: string[];
}

/**
 * Token types for expression parsing
 */
enum TokenType {
  NUMBER = 'NUMBER',
  IDENTIFIER = 'IDENTIFIER',
  OPERATOR = 'OPERATOR',
  PARENTHESIS = 'PARENTHESIS',
  FUNCTION = 'FUNCTION',
  STRING = 'STRING'
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

/**
 * Safe expression evaluator for computed fields
 */
export class ExpressionEvaluator {
  private allowedFunctions: Set<string>;
  private allowedOperators: Set<string>;

  constructor() {
    // Define allowed mathematical functions
    this.allowedFunctions = new Set([
      'abs', 'ceil', 'floor', 'round', 'max', 'min',
      'sqrt', 'pow', 'sin', 'cos', 'tan',
      'sum', 'avg', 'count' // Custom aggregation functions
    ]);

    // Define allowed operators
    this.allowedOperators = new Set([
      '+', '-', '*', '/', '%', '**',
      '(', ')', ',',
      '>', '<', '>=', '<=', '==', '!=', '===', '!==',
      '&&', '||', '!',
      '?', ':'  // Ternary operator
    ]);
  }

  /**
   * Evaluate a mathematical expression with given context
   */
  evaluate(expression: string, context: ExpressionContext = {}): ExpressionResult {
    try {
      // Tokenize the expression
      const tokens = this.tokenize(expression);
      
      // Extract dependencies (field references)
      const dependencies = this.extractDependencies(tokens);
      
      // Validate expression safety
      this.validateTokens(tokens);
      
      // Replace identifiers with context values
      const evaluableExpression = this.replaceIdentifiers(tokens, context);
      
      // Evaluate the expression
      const value = this.executeExpression(evaluableExpression);
      
      return {
        value,
        dependencies
      };
    } catch (error) {
      return {
        value: null,
        error: error instanceof Error ? error.message : 'Unknown evaluation error',
        dependencies: []
      };
    }
  }

  /**
   * Check if an expression is safe to evaluate
   */
  validateExpression(expression: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const tokens = this.tokenize(expression);
      this.validateTokens(tokens);
      return { valid: true, errors: [] };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'Validation error');
      return { valid: false, errors };
    }
  }

  /**
   * Extract field dependencies from an expression
   */
  extractExpressionDependencies(expression: string): string[] {
    try {
      const tokens = this.tokenize(expression);
      return this.extractDependencies(tokens);
    } catch {
      return [];
    }
  }

  // Private methods

  private tokenize(expression: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;

    while (i < expression.length) {
      const char = expression[i];

      // Skip whitespace
      if (/\s/.test(char)) {
        i++;
        continue;
      }

      // Numbers (including decimals)
      if (/\d/.test(char)) {
        let numStr = '';
        while (i < expression.length && /[\d.]/.test(expression[i])) {
          numStr += expression[i];
          i++;
        }
        tokens.push({ type: TokenType.NUMBER, value: numStr, position: i - numStr.length });
        continue;
      }

      // Identifiers (field names, function names)
      if (/[a-zA-Z_]/.test(char)) {
        let identifier = '';
        while (i < expression.length && /[a-zA-Z0-9_.$]/.test(expression[i])) {
          identifier += expression[i];
          i++;
        }
        
        // Check if it's a function call
        const nextNonSpace = this.skipWhitespace(expression, i);
        if (nextNonSpace < expression.length && expression[nextNonSpace] === '(') {
          tokens.push({ type: TokenType.FUNCTION, value: identifier, position: i - identifier.length });
        } else {
          tokens.push({ type: TokenType.IDENTIFIER, value: identifier, position: i - identifier.length });
        }
        continue;
      }

      // String literals
      if (char === '"' || char === "'") {
        const quote = char;
        let str = '';
        i++; // Skip opening quote
        while (i < expression.length && expression[i] !== quote) {
          if (expression[i] === '\\' && i + 1 < expression.length) {
            // Handle escaped characters
            i++;
            str += expression[i];
          } else {
            str += expression[i];
          }
          i++;
        }
        if (i >= expression.length) {
          throw new Error('Unterminated string literal');
        }
        i++; // Skip closing quote
        tokens.push({ type: TokenType.STRING, value: str, position: i - str.length - 2 });
        continue;
      }

      // Multi-character operators
      if (i + 1 < expression.length) {
        const twoChar = expression.slice(i, i + 2);
        if (['==', '!=', '<=', '>=', '&&', '||', '**', '===', '!=='].includes(twoChar)) {
          tokens.push({ type: TokenType.OPERATOR, value: twoChar, position: i });
          i += 2;
          continue;
        }
      }

      // Single-character operators and parentheses
      if ('+-*/%()>,<!?:'.includes(char)) {
        const type = '()'.includes(char) ? TokenType.PARENTHESIS : TokenType.OPERATOR;
        tokens.push({ type, value: char, position: i });
        i++;
        continue;
      }

      throw new Error(`Unexpected character '${char}' at position ${i}`);
    }

    return tokens;
  }

  private skipWhitespace(str: string, start: number): number {
    while (start < str.length && /\s/.test(str[start])) {
      start++;
    }
    return start;
  }

  private validateTokens(tokens: Token[]): void { // Fixed duplicate method name
    for (const token of tokens) {
      switch (token.type) {
        case TokenType.FUNCTION:
          if (!this.allowedFunctions.has(token.value.toLowerCase())) {
            throw new Error(`Function '${token.value}' is not allowed`);
          }
          break;
        case TokenType.OPERATOR:
          if (!this.allowedOperators.has(token.value)) {
            throw new Error(`Operator '${token.value}' is not allowed`);
          }
          break;
        case TokenType.IDENTIFIER:
          // Field names are allowed - they'll be replaced with values
          if (!/^[a-zA-Z_][a-zA-Z0-9_.$]*$/.test(token.value)) {
            throw new Error(`Invalid identifier '${token.value}'`);
          }
          break;
      }
    }
  }

  private extractDependencies(tokens: Token[]): string[] {
    const dependencies = new Set<string>();
    
    for (const token of tokens) {
      if (token.type === TokenType.IDENTIFIER) {
        // Skip common constants
        if (!['true', 'false', 'null', 'undefined', 'PI', 'E'].includes(token.value)) {
          dependencies.add(token.value);
        }
      }
    }
    
    return Array.from(dependencies);
  }

  private replaceIdentifiers(tokens: Token[], context: ExpressionContext): string {
    let result = '';
    
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      
      if (token.type === TokenType.IDENTIFIER) {
        const value = context[token.value];
        if (value !== undefined && value !== null) {
          // Handle different value types
          if (typeof value === 'string') {
            result += `"${value.replace(/"/g, '\\"')}"`;
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            result += String(value);
          } else {
            result += 'null';
          }
        } else {
          // If identifier not found in context, treat as 0 or throw error
          throw new Error(`Undefined field reference: ${token.value}`);
        }
      } else if (token.type === TokenType.FUNCTION) {
        // Handle custom functions
        result += this.replaceFunction(token.value, tokens, i, context);
      } else {
        result += token.value;
      }
    }
    
    return result;
  }

  private replaceFunction(funcName: string, tokens: Token[], index: number, context: ExpressionContext): string {
    const lowerFunc = funcName.toLowerCase();
    
    // Handle custom aggregation functions
    switch (lowerFunc) {
      case 'sum':
      case 'avg':
      case 'count':
        // These would need special handling for array arguments
        return funcName; // For now, pass through
      default:
        // Standard Math functions
        if (this.allowedFunctions.has(lowerFunc)) {
          return `Math.${lowerFunc}`;
        }
        return funcName;
    }
  }

  private executeExpression(expression: string): any {
    try {
      // Create a sandboxed execution environment
      const sandboxedFunction = new Function(`
        "use strict";
        
        // Provide safe Math functions
        const { abs, ceil, floor, round, max, min, sqrt, pow, sin, cos, tan, PI, E } = Math;
        
        // Custom functions
        const sum = (...args) => args.flat().reduce((a, b) => a + b, 0);
        const avg = (...args) => {
          const values = args.flat();
          return values.length ? sum(...values) / values.length : 0;
        };
        const count = (...args) => args.flat().length;
        
        return (${expression});
      `);
      
      return sandboxedFunction();
    } catch (error) {
      throw new Error(`Expression execution failed: ${error}`);
    }
  }
}