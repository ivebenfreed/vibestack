/**
 * File Parser - Clean Implementation
 * 
 * A single, self-contained file parser that handles CSV, TSV, JSON, and Excel files
 * without circular dependencies. Uses composition instead of inheritance.
 */

export interface DetectedColumn {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'url' | 'phone';
  sample_values: string[];
  nullable: boolean;
  unique_count?: number;
  confidence?: number; // 0-1 confidence in type detection
}

export interface ParsedData {
  headers: string[];
  rows: Record<string, any>[];
  total_rows: number;
  detected_columns: DetectedColumn[];
  sample_data: Record<string, any>[];
  parsing_errors?: string[];
}

export interface ParseOptions {
  max_rows?: number; // Limit for initial analysis
  sample_size?: number; // Number of rows to sample for preview
  encoding?: string; // File encoding (default: utf-8)
  delimiter?: string; // For CSV/TSV
  has_header?: boolean; // Whether first row contains headers
  sheet_name?: string; // For Excel files
}

export type FileType = 'csv' | 'tsv' | 'xlsx' | 'xls' | 'json' | 'xml';

/**
 * Parse file based on file type
 */
export async function parseFile(
  fileType: FileType, 
  fileBuffer: ArrayBuffer, 
  filename: string,
  options: ParseOptions = {}
): Promise<ParsedData> {
  const normalizedOptions: Required<ParseOptions> = {
    max_rows: 10000,
    sample_size: 10,
    encoding: 'utf-8',
    delimiter: fileType === 'tsv' ? '\t' : ',',
    has_header: true,
    sheet_name: '',
    ...options
  };

  switch (fileType.toLowerCase()) {
    case 'csv':
    case 'tsv':
      return parseCSV(fileBuffer, filename, normalizedOptions);
    
    case 'json':
      return parseJSON(fileBuffer, filename, normalizedOptions);
      
    case 'xlsx':
    case 'xls':
      throw new Error('Excel file support is not yet implemented. Please convert your Excel file to CSV format for import.');
      
    case 'xml':
      throw new Error('XML file support is not yet implemented. Please convert your XML file to CSV or JSON format for import.');
      
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Parse CSV/TSV files
 */
function parseCSV(fileBuffer: ArrayBuffer, filename: string, options: Required<ParseOptions>): ParsedData {
  const decoder = new TextDecoder(options.encoding);
  const text = decoder.decode(fileBuffer);
  
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) {
    throw new Error('File appears to be empty');
  }

  // Parse lines with proper CSV handling
  const rows: string[][] = [];
  const parseErrors: string[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    try {
      const parsed = parseCSVLine(lines[i], options.delimiter);
      rows.push(parsed);
    } catch (error) {
      parseErrors.push(`Line ${i + 1}: ${error instanceof Error ? error.message : 'Parse error'}`);
    }
  }

  if (rows.length === 0) {
    throw new Error('No valid rows found in file');
  }

  // Extract headers
  let headers: string[];
  let dataRows: string[][];
  
  if (options.has_header && rows.length > 1) {
    headers = rows[0].map((h, i) => h.trim() || `column_${i + 1}`);
    dataRows = rows.slice(1);
  } else {
    headers = rows[0].map((_, i) => `column_${i + 1}`);
    dataRows = rows;
  }

  // Clean headers for database compatibility
  const cleanHeaders = cleanHeaderNames(headers);

  // Limit rows for analysis
  const limitedRows = options.max_rows ? dataRows.slice(0, options.max_rows) : dataRows;

  // Convert to normalized row format
  const normalizedRows = limitedRows.map(row => {
    const obj: Record<string, any> = {};
    cleanHeaders.forEach((header, index) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });

  // Detect column types
  const detected_columns = detectColumnTypes(cleanHeaders, normalizedRows, Math.min(100, normalizedRows.length));

  // Get sample data for preview
  const sample_data = normalizedRows.slice(0, options.sample_size);

  return {
    headers: cleanHeaders,
    rows: normalizedRows,
    total_rows: normalizedRows.length,
    detected_columns,
    sample_data,
    parsing_errors: parseErrors
  };
}

/**
 * Parse JSON files
 */
function parseJSON(fileBuffer: ArrayBuffer, filename: string, options: Required<ParseOptions>): ParsedData {
  const decoder = new TextDecoder(options.encoding);
  const text = decoder.decode(fileBuffer);

  // Parse JSON
  let jsonData: any;
  try {
    jsonData = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Parse error'}`);
  }

  // Convert JSON to tabular format
  const { headers, rows } = convertJSONToTabular(jsonData);

  if (headers.length === 0) {
    throw new Error('No data structure found in JSON file');
  }

  // Clean headers for database compatibility
  const cleanHeaders = cleanHeaderNames(headers);

  // Convert to normalized row format
  const normalizedRows = rows.map(row => {
    const obj: Record<string, any> = {};
    cleanHeaders.forEach((header, index) => {
      obj[header] = row[index] || null;
    });
    return obj;
  });

  // Apply row limit for analysis
  const limitedRows = options.max_rows 
    ? normalizedRows.slice(0, options.max_rows)
    : normalizedRows;

  // Detect column types
  const detected_columns = detectColumnTypes(cleanHeaders, limitedRows, Math.min(100, limitedRows.length));

  // Get sample data for preview
  const sample_data = limitedRows.slice(0, options.sample_size);

  return {
    headers: cleanHeaders,
    rows: limitedRows,
    total_rows: normalizedRows.length,
    detected_columns,
    sample_data,
    parsing_errors: []
  };
}

/**
 * Parse CSV line with proper quote handling
 */
function parseCSVLine(line: string, delimiter: string = ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (nextChar === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Convert JSON data to tabular format
 */
function convertJSONToTabular(jsonData: any): { headers: string[]; rows: any[][] } {
  if (Array.isArray(jsonData)) {
    return handleArray(jsonData);
  } else if (typeof jsonData === 'object' && jsonData !== null) {
    // Check if it's an object with array properties
    const arrayProps = Object.keys(jsonData).filter(key => Array.isArray(jsonData[key]));
    
    if (arrayProps.length === 1) {
      // Single array property - use that array
      return handleArray(jsonData[arrayProps[0]]);
    } else if (arrayProps.length > 1) {
      // Multiple array properties - take first one
      return handleArray(jsonData[arrayProps[0]]);
    } else {
      // Single object - convert to single row
      return handleObject(jsonData);
    }
  } else {
    throw new Error('JSON data must be an object or array');
  }
}

/**
 * Handle array of objects/values
 */
function handleArray(array: any[]): { headers: string[]; rows: any[][] } {
  if (array.length === 0) {
    return { headers: [], rows: [] };
  }

  const firstItem = array[0];
  
  if (typeof firstItem === 'object' && firstItem !== null) {
    // Array of objects
    return handleObjectArray(array);
  } else {
    // Array of primitives
    return { headers: ['value'], rows: array.map(value => [value]) };
  }
}

/**
 * Handle array of objects
 */
function handleObjectArray(objects: any[]): { headers: string[]; rows: any[][] } {
  // Collect all unique keys across all objects
  const allKeys = new Set<string>();
  
  for (const obj of objects) {
    if (typeof obj === 'object' && obj !== null) {
      collectKeys(obj, '', allKeys);
    }
  }

  const headers = Array.from(allKeys).sort();
  
  const rows = objects.map(obj => {
    return headers.map(header => getNestedValue(obj, header));
  });

  return { headers, rows };
}

/**
 * Handle single object
 */
function handleObject(obj: any): { headers: string[]; rows: any[][] } {
  const allKeys = new Set<string>();
  collectKeys(obj, '', allKeys);
  
  const headers = Array.from(allKeys).sort();
  const rows = [headers.map(header => getNestedValue(obj, header))];

  return { headers, rows };
}

/**
 * Recursively collect all keys from nested objects
 */
function collectKeys(obj: any, prefix: string, keys: Set<string>): void {
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Nested object - recurse
      collectKeys(value, fullKey, keys);
    } else if (Array.isArray(value)) {
      // Array - add the key and optionally flatten first few items
      keys.add(fullKey);
      
      // For arrays of objects, flatten first object's keys
      if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
        collectKeys(value[0], `${fullKey}[0]`, keys);
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
function getNestedValue(obj: any, path: string): any {
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

/**
 * Clean header names for database compatibility
 */
function cleanHeaderNames(headers: string[]): string[] {
  return headers.map((header, index) => {
    // Replace spaces and special characters with underscores
    let cleaned = header
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .toLowerCase();
    
    // Ensure it starts with a letter or underscore
    if (!/^[a-zA-Z_]/.test(cleaned)) {
      cleaned = `col_${cleaned}`;
    }
    
    // Fallback for empty names
    if (!cleaned) {
      cleaned = `column_${index + 1}`;
    }
    
    return cleaned;
  });
}

/**
 * Detect column types based on sample data
 */
function detectColumnTypes(
  headers: string[],
  rows: Record<string, any>[],
  sampleSize: number = 100
): DetectedColumn[] {
  const sampleRows = rows.slice(0, sampleSize);
  
  return headers.map(header => {
    const values = sampleRows
      .map(row => row[header])
      .filter(val => val !== null && val !== undefined && val !== '');

    const nonNullCount = values.length;
    const totalCount = sampleRows.length;
    const nullable = nonNullCount < totalCount;

    // Get unique values for analysis
    const uniqueValues = [...new Set(values.map(v => String(v).trim()))];
    const unique_count = uniqueValues.length;

    // Sample values for preview (max 5)
    const sample_values = uniqueValues.slice(0, 5);

    // Type detection logic
    const detectedType = inferDataType(values);

    return {
      name: header,
      type: detectedType.type,
      sample_values,
      nullable,
      unique_count,
      confidence: detectedType.confidence
    };
  });
}

/**
 * Infer data type from sample values
 */
function inferDataType(values: any[]): { type: DetectedColumn['type']; confidence: number } {
  if (values.length === 0) {
    return { type: 'string', confidence: 0 };
  }

  const stringValues = values.map(v => String(v).trim());
  
  // Email detection
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailMatches = stringValues.filter(v => emailPattern.test(v)).length;
  if (emailMatches / stringValues.length > 0.8) {
    return { type: 'email', confidence: emailMatches / stringValues.length };
  }

  // Phone number detection (basic patterns)
  const phonePattern = /^[\+]?[1-9][\d]{0,15}$|^[\+]?[(]?[\d\s\-\(\)]{7,20}$/;
  const phoneMatches = stringValues.filter(v => phonePattern.test(v.replace(/[\s\-\(\)]/g, ''))).length;
  if (phoneMatches / stringValues.length > 0.8) {
    return { type: 'phone', confidence: phoneMatches / stringValues.length };
  }

  // URL detection
  const urlPattern = /^https?:\/\/[^\s]+$/;
  const urlMatches = stringValues.filter(v => urlPattern.test(v)).length;
  if (urlMatches / stringValues.length > 0.8) {
    return { type: 'url', confidence: urlMatches / stringValues.length };
  }

  // Date detection
  const dateMatches = stringValues.filter(v => {
    const parsed = new Date(v);
    return !isNaN(parsed.getTime()) && v.length > 6; // Avoid matching simple numbers
  }).length;
  if (dateMatches / stringValues.length > 0.8) {
    return { type: 'date', confidence: dateMatches / stringValues.length };
  }

  // Number detection
  const numberMatches = stringValues.filter(v => {
    const num = parseFloat(v);
    return !isNaN(num) && isFinite(num);
  }).length;
  if (numberMatches / stringValues.length > 0.8) {
    return { type: 'number', confidence: numberMatches / stringValues.length };
  }

  // Boolean detection
  const booleanValues = ['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'];
  const booleanMatches = stringValues.filter(v => 
    booleanValues.includes(v.toLowerCase())
  ).length;
  if (booleanMatches / stringValues.length > 0.8) {
    return { type: 'boolean', confidence: booleanMatches / stringValues.length };
  }

  // Default to string
  return { type: 'string', confidence: 1.0 };
}

/**
 * Detect file type from filename extension
 */
export function detectFileType(filename: string): FileType {
  const extension = filename.toLowerCase().split('.').pop();
  
  switch (extension) {
    case 'csv':
      return 'csv';
    case 'tsv':
      return 'tsv';
    case 'xlsx':
      return 'xlsx';
    case 'xls':
      return 'xls';
    case 'json':
      return 'json';
    case 'xml':
      return 'xml';
    default:
      throw new Error(`Cannot detect file type from extension: ${extension}`);
  }
}

/**
 * Get supported file extensions
 */
export function getSupportedExtensions(): string[] {
  return ['csv', 'tsv', 'xlsx', 'xls', 'json', 'xml'];
}

/**
 * Check if a file type is supported
 */
export function isFileTypeSupported(fileType: string): boolean {
  return getSupportedExtensions().includes(fileType.toLowerCase());
}