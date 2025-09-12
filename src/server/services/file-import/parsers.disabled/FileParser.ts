/**
 * Base File Parser Abstract Class
 * 
 * Provides common functionality for all file parsers including
 * type detection and data analysis utilities.
 */

// Define DetectedColumn locally to avoid circular dependencies
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

export abstract class FileParser {
  protected options: ParseOptions;

  constructor(options: ParseOptions = {}) {
    this.options = {
      max_rows: 10000, // Reasonable limit for analysis
      sample_size: 10,
      encoding: 'utf-8',
      has_header: true,
      ...options
    };
  }

  abstract parse(fileBuffer: ArrayBuffer, filename: string): Promise<ParsedData>;

  /**
   * Detect column types based on sample data
   */
  protected detectColumnTypes(
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
      const detectedType = this.inferDataType(values);

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
  protected inferDataType(values: any[]): { type: DetectedColumn['type']; confidence: number } {
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
   * Generate sample data for preview
   */
  protected generateSampleData(rows: Record<string, any>[]): Record<string, any>[] {
    const sampleSize = Math.min(this.options.sample_size || 10, rows.length);
    return rows.slice(0, sampleSize);
  }
}