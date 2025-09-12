/**
 * JSON Parser
 * 
 * Parses JSON files and converts them to tabular format.
 * Handles nested objects and arrays intelligently.
 */

import { FileParser, type ParsedData } from './FileParser';

export class JSONParser extends FileParser {
  async parse(fileBuffer: ArrayBuffer, filename: string): Promise<ParsedData> {
    try {
      // Convert buffer to text
      const decoder = new TextDecoder(this.options.encoding || 'utf-8');
      const text = decoder.decode(fileBuffer);

      // Parse JSON
      let jsonData: any;
      try {
        jsonData = JSON.parse(text);
      } catch (error) {
        throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Parse error'}`);
      }

      // Convert JSON to tabular format
      const { headers, rows } = this.convertToTabular(jsonData);

      if (headers.length === 0) {
        throw new Error('No data structure found in JSON file');
      }

      // Clean headers for database compatibility
      const cleanHeaders = this.cleanHeaders(headers);

      // Convert to normalized row format
      const normalizedRows = this.normalizeRows(headers, rows, cleanHeaders);

      // Apply row limit for analysis
      const limitedRows = this.options.max_rows 
        ? normalizedRows.slice(0, this.options.max_rows)
        : normalizedRows;

      // Detect column types
      const detected_columns = this.detectColumnTypes(cleanHeaders, limitedRows);

      // Get sample data for preview
      const sample_data = limitedRows.slice(0, this.options.sample_size || 10);

      return {
        headers: cleanHeaders,
        rows: limitedRows,
        total_rows: normalizedRows.length,
        detected_columns,
        sample_data,
        parsing_errors: []
      };

    } catch (error) {
      throw new Error(`JSON parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert JSON data to tabular format
   */
  private convertToTabular(jsonData: any): { headers: string[]; rows: any[][] } {
    // Handle different JSON structures
    if (Array.isArray(jsonData)) {
      return this.handleArray(jsonData);
    } else if (typeof jsonData === 'object' && jsonData !== null) {
      // Check if it's an object with array properties
      const arrayProps = Object.keys(jsonData).filter(key => Array.isArray(jsonData[key]));
      
      if (arrayProps.length === 1) {
        // Single array property - use that array
        return this.handleArray(jsonData[arrayProps[0]]);
      } else if (arrayProps.length > 1) {
        // Multiple array properties - let user choose or take first one
        return this.handleArray(jsonData[arrayProps[0]]);
      } else {
        // Single object - convert to single row
        return this.handleObject(jsonData);
      }
    } else {
      throw new Error('JSON data must be an object or array');
    }
  }

  /**
   * Handle array of objects/values
   */
  private handleArray(array: any[]): { headers: string[]; rows: any[][] } {
    if (array.length === 0) {
      return { headers: [], rows: [] };
    }

    // Check what type of array this is
    const firstItem = array[0];
    
    if (typeof firstItem === 'object' && firstItem !== null) {
      // Array of objects
      return this.handleObjectArray(array);
    } else {
      // Array of primitives
      return this.handlePrimitiveArray(array);
    }
  }

  /**
   * Handle array of objects
   */
  private handleObjectArray(objects: any[]): { headers: string[]; rows: any[][] } {
    // Collect all unique keys across all objects
    const allKeys = new Set<string>();
    
    for (const obj of objects) {
      if (typeof obj === 'object' && obj !== null) {
        this.collectKeys(obj, '', allKeys);
      }
    }

    const headers = Array.from(allKeys).sort();
    
    const rows = objects.map(obj => {
      return headers.map(header => this.getNestedValue(obj, header));
    });

    return { headers, rows };
  }

  /**
   * Handle array of primitive values
   */
  private handlePrimitiveArray(array: any[]): { headers: string[]; rows: any[][] } {
    const headers = ['value'];
    const rows = array.map((value, index) => [value]);
    
    return { headers, rows };
  }

  /**
   * Handle single object
   */
  private handleObject(obj: any): { headers: string[]; rows: any[][] } {
    const allKeys = new Set<string>();
    this.collectKeys(obj, '', allKeys);
    
    const headers = Array.from(allKeys).sort();
    const rows = [headers.map(header => this.getNestedValue(obj, header))];

    return { headers, rows };
  }

  /**
   * Recursively collect all keys from nested objects
   */
  private collectKeys(obj: any, prefix: string, keys: Set<string>): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Nested object - recurse
        this.collectKeys(value, fullKey, keys);
      } else if (Array.isArray(value)) {
        // Array - add the key and optionally flatten first few items
        keys.add(fullKey);
        
        // For arrays of objects, flatten first object's keys
        if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
          this.collectKeys(value[0], `${fullKey}[0]`, keys);
        }
      } else {
        // Primitive value
        keys.add(fullKey);
      }
    }
  }

  /**
   * Get value from nested object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    if (!obj || typeof obj !== 'object') return null;
    
    try {
      const keys = path.split('.');
      let current = obj;
      
      for (const key of keys) {
        // Handle array notation like "items[0]"
        if (key.includes('[') && key.includes(']')) {
          const [arrayKey, indexStr] = key.split('[');
          const index = parseInt(indexStr.replace(']', ''));
          
          current = current[arrayKey];
          if (Array.isArray(current)) {
            current = current[index];
          } else {
            return null;
          }
        } else {
          current = current[key];
        }
        
        if (current === undefined || current === null) {
          return null;
        }
      }
      
      // Convert arrays and objects to JSON strings for display
      if (Array.isArray(current)) {
        return JSON.stringify(current);
      } else if (typeof current === 'object') {
        return JSON.stringify(current);
      }
      
      return current;
    } catch {
      return null;
    }
  }
}