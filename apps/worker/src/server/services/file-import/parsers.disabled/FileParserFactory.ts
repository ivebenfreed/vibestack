/**
 * File Parser Factory
 * 
 * Creates appropriate parser instances based on file type.
 * Uses dynamic imports to avoid circular dependencies.
 */

// Re-export types dynamically to avoid circular dependencies
export type { ParsedData, ParseOptions, DetectedColumn } from './FileParser';

/**
 * File type enumeration
 */
export type FileType = 'csv' | 'tsv' | 'xlsx' | 'xls' | 'json' | 'xml';

/**
 * Create appropriate parser based on file type
 * Uses dynamic imports to avoid circular dependency issues
 */
export async function createFileParser(fileType: FileType, options?: any): Promise<any> {
  switch (fileType.toLowerCase()) {
    case 'csv': {
      const { CSVParser } = await import('./CSVParser');
      return new CSVParser({ delimiter: ',', ...options });
    }
    
    case 'tsv': {
      const { CSVParser } = await import('./CSVParser');
      return new CSVParser({ delimiter: '\t', ...options });
    }
    
    case 'xlsx':
    case 'xls': {
      const { ExcelParser } = await import('./ExcelParser');
      return new ExcelParser(options);
    }
    
    case 'json': {
      const { JSONParser } = await import('./JSONParser');
      return new JSONParser(options);
    }
    
    case 'xml': {
      const { XMLParser } = await import('./XMLParser');
      return new XMLParser(options);
    }
    
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
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