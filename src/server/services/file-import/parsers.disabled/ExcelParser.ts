/**
 * Excel Parser (Placeholder)
 * 
 * Note: Full Excel parsing requires additional dependencies like 'xlsx' package.
 * This is a placeholder implementation that can be extended when needed.
 */

import { FileParser, type ParsedData } from './FileParser';

export class ExcelParser extends FileParser {
  async parse(fileBuffer: ArrayBuffer, filename: string): Promise<ParsedData> {
    // For now, throw an error indicating Excel support is not yet implemented
    // In a full implementation, this would use a library like 'xlsx' to parse Excel files
    
    throw new Error(
      'Excel file support is not yet implemented. ' +
      'Please convert your Excel file to CSV format for import. ' +
      'You can do this by opening the file in Excel/Google Sheets and using "Save As" > "CSV".'
    );

    // Future implementation would look something like:
    /*
    try {
      const XLSX = await import('xlsx'); // Dynamic import
      const workbook = XLSX.read(fileBuffer, { type: 'array' });
      
      // Get first sheet or specified sheet
      const sheetName = this.options.sheet_name || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert to JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // Process similar to CSV...
      
    } catch (error) {
      throw new Error(`Excel parsing failed: ${error.message}`);
    }
    */
  }
}