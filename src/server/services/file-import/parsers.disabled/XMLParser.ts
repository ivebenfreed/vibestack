/**
 * XML Parser (Placeholder)
 * 
 * Note: Full XML parsing requires additional dependencies.
 * This is a placeholder implementation.
 */

import { FileParser, type ParsedData } from './FileParser';

export class XMLParser extends FileParser {
  async parse(fileBuffer: ArrayBuffer, filename: string): Promise<ParsedData> {
    throw new Error(
      'XML file support is not yet implemented. ' +
      'Please convert your XML file to CSV or JSON format for import.'
    );
  }
}