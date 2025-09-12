/**
 * CSV/TSV Parser
 * 
 * Parses CSV and TSV files with configurable delimiters,
 * auto-detects headers, and handles various CSV formatting quirks.
 */

import { FileParser, type ParsedData, type ParseOptions } from './FileParser';

export class CSVParser extends FileParser {
  private delimiter: string;

  constructor(options: ParseOptions = {}) {
    super(options);
    this.delimiter = options.delimiter || ',';
  }

  async parse(fileBuffer: ArrayBuffer, filename: string): Promise<ParsedData> {
    try {
      // Convert buffer to text
      const decoder = new TextDecoder(this.options.encoding || 'utf-8');
      const text = decoder.decode(fileBuffer);

      // Parse CSV with our custom parser (handles quoted fields, escaped delimiters)
      const { headers, rows } = this.parseCSVText(text);

      if (headers.length === 0) {
        throw new Error('No headers found in CSV file');
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
      throw new Error(`CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse CSV text with proper handling of quoted fields and escaped characters
   */
  private parseCSVText(text: string): { headers: string[]; rows: any[][] } {
    const lines = this.splitLines(text);
    
    if (lines.length === 0) {
      return { headers: [], rows: [] };
    }

    const allRows = lines.map(line => this.parseLine(line));

    // Determine if first row is headers
    let headers: string[];
    let dataRows: any[][];

    if (this.options.has_header !== false) {
      // Try to detect if first row contains headers
      const firstRow = allRows[0] || [];
      const secondRow = allRows[1] || [];
      
      const hasHeaders = this.looksLikeHeaders(firstRow, secondRow);
      
      if (hasHeaders) {
        headers = firstRow.map(h => String(h || '').trim());
        dataRows = allRows.slice(1);
      } else {
        // Generate column names
        headers = firstRow.map((_, index) => `column_${index + 1}`);
        dataRows = allRows;
      }
    } else {
      // Generate column names based on first row length
      const columnCount = allRows[0]?.length || 0;
      headers = Array.from({ length: columnCount }, (_, i) => `column_${i + 1}`);
      dataRows = allRows;
    }

    return { headers, rows: dataRows };
  }

  /**
   * Split text into lines, handling different line endings
   */
  private splitLines(text: string): string[] {
    // Handle different line endings (CRLF, LF, CR)
    return text
      .replace(/\r\n/g, '\n') // Convert CRLF to LF
      .replace(/\r/g, '\n')   // Convert CR to LF
      .split('\n')
      .filter(line => line.trim().length > 0); // Remove empty lines
  }

  /**
   * Parse a single CSV line, handling quoted fields properly
   */
  private parseLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote within quoted field
          current += '"';
          i += 2; // Skip both quotes
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
          i++;
        }
      } else if (char === this.delimiter && !inQuotes) {
        // Field separator found outside of quotes
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += char;
        i++;
      }
    }

    // Add the last field
    result.push(current.trim());

    return result;
  }

  /**
   * Heuristic to detect if first row contains headers
   */
  private looksLikeHeaders(firstRow: any[], secondRow: any[]): boolean {
    if (!firstRow || !secondRow || firstRow.length === 0) {
      return true; // Default to treating first row as headers
    }

    let headerScore = 0;
    const maxScore = firstRow.length;

    for (let i = 0; i < Math.min(firstRow.length, secondRow.length); i++) {
      const first = String(firstRow[i] || '').trim();
      const second = String(secondRow[i] || '').trim();

      // Headers are more likely to be text, data more likely to be numbers/dates
      if (first && second) {
        // Check if first row value looks like a header (text, no numbers)
        const firstIsText = !/^\d+\.?\d*$/.test(first) && !/^\d{4}-\d{2}-\d{2}/.test(first);
        const secondIsData = /^\d+\.?\d*$/.test(second) || /^\d{4}-\d{2}-\d{2}/.test(second);
        
        if (firstIsText && secondIsData) {
          headerScore++;
        } else if (firstIsText && first.length > 2) {
          headerScore += 0.5; // Partial points for text-like headers
        }
      } else if (first && !second) {
        // Header present but no data - likely a header
        headerScore += 0.5;
      }
    }

    // If more than half the columns look like headers, treat first row as headers
    return headerScore / maxScore > 0.5;
  }

  /**
   * Auto-detect delimiter if not specified
   */
  static detectDelimiter(text: string): string {
    const sample = text.slice(0, 1000); // Use first 1KB for detection
    const delimiters = [',', '\t', ';', '|', ':'];
    
    let bestDelimiter = ',';
    let maxCount = 0;

    for (const delimiter of delimiters) {
      const count = (sample.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = delimiter;
      }
    }

    return bestDelimiter;
  }
}