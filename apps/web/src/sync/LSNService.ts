/**
 * LSNService - Pure LSN utility functions
 * 
 * Pure utility functions for LSN parsing, comparison, and manipulation.
 * No state storage - replaced the stateful LSNManager.
 */

export class LSNService {
  /**
   * Compare two LSNs
   * @param lsn1 First LSN to compare
   * @param lsn2 Second LSN to compare
   * @returns -1 if lsn1 < lsn2, 0 if equal, 1 if lsn1 > lsn2
   */
  static compare(lsn1: string, lsn2: string): number {
    if (lsn1 === lsn2) return 0;
    
    const [file1, offset1] = lsn1.split('/').map(x => parseInt(x, 16));
    const [file2, offset2] = lsn2.split('/').map(x => parseInt(x, 16));
    
    if (file1 !== file2) {
      return file1 < file2 ? -1 : 1;
    }
    
    return offset1 < offset2 ? -1 : (offset1 > offset2 ? 1 : 0);
  }

  /**
   * Validate LSN format
   * @param lsn LSN string to validate
   * @returns true if valid LSN format
   */
  static isValid(lsn: string): boolean {
    if (!lsn || typeof lsn !== 'string') return false;
    
    const parts = lsn.split('/');
    if (parts.length !== 2) return false;
    
    const [file, offset] = parts;
    
    // Check if both parts are valid hex numbers
    return /^[0-9A-Fa-f]+$/.test(file) && /^[0-9A-Fa-f]+$/.test(offset);
  }

  /**
   * Increment LSN by the minimum amount (used for testing/debugging)
   * @param lsn Current LSN
   * @returns Incremented LSN
   */
  static increment(lsn: string): string {
    if (!LSNService.isValid(lsn)) {
      throw new Error(`Invalid LSN format: ${lsn}`);
    }
    
    const [file, offset] = lsn.split('/');
    const offsetNum = parseInt(offset, 16);
    const newOffset = (offsetNum + 1).toString(16).toUpperCase();
    
    return `${file}/${newOffset}`;
  }

  /**
   * Get a reset LSN (0/0)
   * @returns Reset LSN string
   */
  static reset(): string {
    return '0/0';
  }

  /**
   * Parse LSN into file and offset components
   * @param lsn LSN string to parse
   * @returns Object with file and offset as numbers
   */
  static parse(lsn: string): { file: number; offset: number } {
    if (!LSNService.isValid(lsn)) {
      throw new Error(`Invalid LSN format: ${lsn}`);
    }
    
    const [file, offset] = lsn.split('/');
    return {
      file: parseInt(file, 16),
      offset: parseInt(offset, 16)
    };
  }

  /**
   * Format file and offset into LSN string
   * @param file File number
   * @param offset Offset number  
   * @returns Formatted LSN string
   */
  static format(file: number, offset: number): string {
    return `${file.toString(16).toUpperCase()}/${offset.toString(16).toUpperCase()}`;
  }

  /**
   * Check if first LSN is greater than second LSN
   * @param lsn1 First LSN
   * @param lsn2 Second LSN  
   * @returns true if lsn1 > lsn2
   */
  static isGreater(lsn1: string, lsn2: string): boolean {
    return LSNService.compare(lsn1, lsn2) > 0;
  }

  /**
   * Check if first LSN is less than second LSN
   * @param lsn1 First LSN
   * @param lsn2 Second LSN
   * @returns true if lsn1 < lsn2  
   */
  static isLess(lsn1: string, lsn2: string): boolean {
    return LSNService.compare(lsn1, lsn2) < 0;
  }

  /**
   * Check if two LSNs are equal
   * @param lsn1 First LSN
   * @param lsn2 Second LSN
   * @returns true if LSNs are equal
   */
  static isEqual(lsn1: string, lsn2: string): boolean {
    return LSNService.compare(lsn1, lsn2) === 0;
  }

  /**
   * Get the maximum of two LSNs
   * @param lsn1 First LSN
   * @param lsn2 Second LSN
   * @returns The greater LSN
   */
  static max(lsn1: string, lsn2: string): string {
    return LSNService.isGreater(lsn1, lsn2) ? lsn1 : lsn2;
  }

  /**
   * Get the minimum of two LSNs
   * @param lsn1 First LSN
   * @param lsn2 Second LSN
   * @returns The smaller LSN
   */
  static min(lsn1: string, lsn2: string): string {
    return LSNService.isLess(lsn1, lsn2) ? lsn1 : lsn2;
  }
} 