/**
 * PostgreSQL Type Parser Library
 * 
 * Comprehensive system for detecting and parsing PostgreSQL-specific data types
 * from WAL (Write-Ahead Log) data into JavaScript equivalents.
 * 
 * Handles ALL major PostgreSQL data types:
 * - Arrays: text[], int[], varchar[], uuid[], etc.
 * - Range Types: int4range, int8range, numrange, tsrange, tstzrange, daterange
 * - JSON/JSONB: Proper JSON parsing
 * - Booleans: PostgreSQL 't'/'f' format
 * - Intervals: ISO 8601 interval format
 * - UUIDs: Universally unique identifiers
 * - Network Types: INET (IPv4/IPv6), CIDR (network addresses)
 * - MAC Addresses: MACADDR, MACADDR8 (EUI-64)
 * - Geometric Types: POINT, BOX, CIRCLE, POLYGON, PATH, LINE, LSEG
 * - Binary Data: BYTEA (hex format)
 * - Bit Strings: BIT, BIT VARYING
 * - Money: Currency amounts with various symbols
 * - XML: XML document format
 * - Text Search: TSVECTOR, TSQUERY
 * - Object Identifiers: OID, regproc, regclass, regtype, etc.
 * - Enumerated Types: User-defined ENUMs (heuristic detection)
 * - Composite Types: User-defined composite/row types
 * 
 * Based on the comprehensive PostgreSQL data types list from:
 * https://www.dbvis.com/thetable/discover-all-postgresql-data-types/
 */

import { replicationLogger } from '../middleware/logger';

const MODULE_NAME = 'postgresql-type-parser';

/**
 * Parse PostgreSQL array format string into JavaScript array
 * Handles formats like: '{}' (empty), '{tag1,tag2}' (simple), '{"tag with spaces","tag2"}' (quoted)
 * 
 * @param value - PostgreSQL array string format
 * @returns JavaScript array of strings
 */
export function parsePostgreSQLArray(value: string): string[] {
  if (!value || typeof value !== 'string') {
    return [];
  }
  
  // Handle empty array
  if (value === '{}') {
    return [];
  }
  
  // Check if it's a PostgreSQL array format
  if (!value.startsWith('{') || !value.endsWith('}')) {
    // Not a PostgreSQL array format, return as single-item array
    return [value];
  }
  
  // Extract content between braces
  const content = value.substring(1, value.length - 1);
  
  // Handle empty content
  if (content === '') {
    return [];
  }
  
  // Split by comma and handle quoted elements
  const elements: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < content.length) {
    const char = content[i];
    
    if (char === '"' && (i === 0 || content[i - 1] !== '\\')) {
      // Toggle quote state (handle unescaped quotes)
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      // End of element
      elements.push(current.trim());
      current = '';
    } else {
      // Add character to current element
      current += char;
    }
    
    i++;
  }
  
  // Add the last element
  if (current !== '') {
    elements.push(current.trim());
  }
  
  // Remove quotes from quoted elements and handle escapes
  return elements.map(element => {
    let trimmed = element.trim();
    if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
      trimmed = trimmed.substring(1, trimmed.length - 1);
      // Unescape quotes and backslashes
      trimmed = trimmed.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return trimmed;
  });
}

/**
 * Detect if a value is a PostgreSQL array format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL array format
 */
export function isPostgreSQLArray(value: any): boolean {
  return typeof value === 'string' && 
         value.startsWith('{') && 
         value.endsWith('}');
}

/**
 * Detect if a value is a PostgreSQL range type format
 * Range types are formatted like '[2010-01-01,2010-01-02)' or '(2010-01-01,2010-01-02]'
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL range format
 */
export function isPostgreSQLRange(value: any): boolean {
  return typeof value === 'string' &&
         (value.startsWith('[') || value.startsWith('(')) && 
         (value.endsWith(']') || value.endsWith(')')) &&
         value.includes(',');
}

/**
 * Detect if a value is a PostgreSQL boolean format ('t' or 'f')
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL boolean format
 */
export function isPostgreSQLBoolean(value: any): boolean {
  return typeof value === 'string' && (value === 't' || value === 'f');
}

/**
 * Parse PostgreSQL boolean format to JavaScript boolean
 * 
 * @param value - PostgreSQL boolean string ('t' or 'f')
 * @returns JavaScript boolean
 */
export function parsePostgreSQLBoolean(value: string): boolean {
  return value === 't';
}

/**
 * Detect if a value is a PostgreSQL interval format (ISO 8601)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL interval format
 */
export function isPostgreSQLInterval(value: any): boolean {
  return typeof value === 'string' &&
         value.startsWith('P') && 
         /^P(\d+Y)?(\d+M)?(\d+W)?(\d+D)?(T(\d+H)?(\d+M)?(\d+S)?)?$/.test(value);
}

/**
 * Detect if a value might be JSON/JSONB format
 * 
 * @param value - Value to check
 * @returns true if value might be JSON format
 */
export function isPostgreSQLJSON(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Check for JSON object or array format
  return ((value.startsWith('{') && value.endsWith('}')) || 
          (value.startsWith('[') && value.endsWith(']'))) &&
         // Exclude PostgreSQL array format
         (!value.match(/^{[^}]*}$/) || value.includes(':'));
}

/**
 * Parse PostgreSQL JSON/JSONB format to JavaScript object
 * 
 * @param value - PostgreSQL JSON string
 * @returns Parsed JavaScript object or original value if parsing fails
 */
export function parsePostgreSQLJSON(value: string): any {
  try {
    return JSON.parse(value);
  } catch (e) {
    // Return original value if parsing fails
    return value;
  }
}

/**
 * Comprehensive PostgreSQL type detection and parsing system
 * Detects PostgreSQL-specific data types and converts them to JavaScript equivalents
 * 
 * @param columnName - Name of the column (for logging)
 * @param value - Raw value from PostgreSQL WAL
 * @param tableName - Name of the table (for logging)
 * @returns Parsed JavaScript value
 */
export function parsePostgreSQLValue(columnName: string, value: any, tableName: string): any {
  if (value === null || value === undefined) {
    return value;
  }
  
  // Only process string values that might be PostgreSQL-formatted
  if (typeof value !== 'string') {
    return value;
  }
  
  // Detect and parse PostgreSQL array format (any type ending with [])
  // Arrays in PostgreSQL are represented as strings like '{}', '{1,2,3}', '{"a","b","c"}'
  if (isPostgreSQLArray(value)) {
    const parsedArray = parsePostgreSQLArray(value);
    
    replicationLogger.debug('PostgreSQL array parsed', {
      table: tableName,
      column: columnName,
      original: value,
      parsed: parsedArray,
      isArray: Array.isArray(parsedArray),
      elementCount: parsedArray.length
    }, MODULE_NAME);
    
    return parsedArray;
  }
  
  // Detect PostgreSQL range types (tsrange, daterange, etc.)
  if (isPostgreSQLRange(value)) {
    const rangeInfo = parsePostgreSQLRangeType(value);
    
    replicationLogger.debug('PostgreSQL range type detected', {
      table: tableName,
      column: columnName,
      original: value,
      rangeType: rangeInfo?.type || 'unknown',
      bounds: rangeInfo?.bounds,
      type: 'range'
    }, MODULE_NAME);
    
    // Keep as string for now - ranges are complex and need specific handling
    return value;
  }
  
  // Detect PostgreSQL JSON/JSONB (if it looks like JSON but isn't an array)
  if (isPostgreSQLJSON(value)) {
    const parsed = parsePostgreSQLJSON(value);
    
    if (parsed !== value) { // Only log if parsing succeeded
      replicationLogger.debug('PostgreSQL JSON parsed', {
        table: tableName,
        column: columnName,
        original: value,
        parsed: typeof parsed,
        type: 'json'
      }, MODULE_NAME);
    }
    
    return parsed;
  }
  
  // Detect PostgreSQL XML format
  if (isPostgreSQLXML(value)) {
    replicationLogger.debug('PostgreSQL XML detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'xml'
    }, MODULE_NAME);
    
    return value; // Keep XML as string
  }
  
  // Detect PostgreSQL text search types
  if (isPostgreSQLTSVector(value)) {
    replicationLogger.debug('PostgreSQL TSVector detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'tsvector'
    }, MODULE_NAME);
    
    return value; // Keep TSVector as string
  }
  
  if (isPostgreSQLTSQuery(value)) {
    replicationLogger.debug('PostgreSQL TSQuery detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'tsquery'
    }, MODULE_NAME);
    
    return value; // Keep TSQuery as string
  }
  
  // Detect PostgreSQL boolean representations
  if (isPostgreSQLBoolean(value)) {
    const boolValue = parsePostgreSQLBoolean(value);
    
    replicationLogger.debug('PostgreSQL boolean parsed', {
      table: tableName,
      column: columnName,
      original: value,
      parsed: boolValue,
      type: 'boolean'
    }, MODULE_NAME);
    
    return boolValue;
  }
  
  // Detect PostgreSQL interval format (P1Y2M3DT4H5M6S, etc.)
  if (isPostgreSQLInterval(value)) {
    replicationLogger.debug('PostgreSQL interval detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'interval'
    }, MODULE_NAME);
    
    // Keep as string - intervals are handled by the client
    return value;
  }
  
  // Detect PostgreSQL UUID format
  if (isPostgreSQLUUID(value)) {
    replicationLogger.debug('PostgreSQL UUID detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'uuid'
    }, MODULE_NAME);
    
    return value; // UUIDs are kept as strings
  }
  
  // Detect PostgreSQL network address types (INET/CIDR)
  if (isPostgreSQLCIDR(value) || isPostgreSQLINET(value)) {
    const type = isPostgreSQLCIDR(value) ? 'cidr' : 'inet';
    
    replicationLogger.debug('PostgreSQL network address detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: type
    }, MODULE_NAME);
    
    return value; // Keep network addresses as strings
  }
  
  // Detect PostgreSQL MAC address types
  if (isPostgreSQLMACAddr8(value) || isPostgreSQLMACAddr(value)) {
    const type = isPostgreSQLMACAddr8(value) ? 'macaddr8' : 'macaddr';
    
    replicationLogger.debug('PostgreSQL MAC address detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: type
    }, MODULE_NAME);
    
    return value; // Keep MAC addresses as strings
  }
  
  // Detect PostgreSQL object identifier types
  if (isPostgreSQLOID(value)) {
    replicationLogger.debug('PostgreSQL OID detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'oid'
    }, MODULE_NAME);
    
    return parseInt(value, 10); // Convert OID to number
  }
  
  if (isPostgreSQLRegType(value)) {
    replicationLogger.debug('PostgreSQL reg type detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'regtype'
    }, MODULE_NAME);
    
    return value; // Keep reg types as strings
  }
  
  // Detect PostgreSQL geometric types
  if (isPostgreSQLPoint(value)) {
    const parsed = parsePostgreSQLPoint(value);
    
    replicationLogger.debug('PostgreSQL point parsed', {
      table: tableName,
      column: columnName,
      original: value,
      parsed: parsed,
      type: 'point'
    }, MODULE_NAME);
    
    return parsed;
  }
  
  if (isPostgreSQLLine(value)) {
    replicationLogger.debug('PostgreSQL line detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'line'
    }, MODULE_NAME);
    
    return value; // Keep line as string for now
  }
  
  if (isPostgreSQLLSeg(value)) {
    replicationLogger.debug('PostgreSQL line segment detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'lseg'
    }, MODULE_NAME);
    
    return value; // Keep line segment as string for now
  }
  
  if (isPostgreSQLPath(value)) {
    replicationLogger.debug('PostgreSQL path detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'path'
    }, MODULE_NAME);
    
    return value; // Keep path as string for now
  }
  
  if (isPostgreSQLBox(value)) {
    replicationLogger.debug('PostgreSQL box detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'box'
    }, MODULE_NAME);
    
    return value; // Keep complex geometric types as strings for now
  }
  
  if (isPostgreSQLCircle(value)) {
    replicationLogger.debug('PostgreSQL circle detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'circle'
    }, MODULE_NAME);
    
    return value; // Keep complex geometric types as strings for now
  }
  
  if (isPostgreSQLPolygon(value)) {
    replicationLogger.debug('PostgreSQL polygon detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'polygon'
    }, MODULE_NAME);
    
    return value; // Keep complex geometric types as strings for now
  }
  
  // Detect PostgreSQL composite types
  if (isPostgreSQLComposite(value)) {
    replicationLogger.debug('PostgreSQL composite type detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'composite'
    }, MODULE_NAME);
    
    return value; // Keep composite types as strings for now
  }
  
  // Detect PostgreSQL binary data (BYTEA)
  if (isPostgreSQLBytea(value)) {
    const parsed = parsePostgreSQLBytea(value);
    
    replicationLogger.debug('PostgreSQL bytea parsed', {
      table: tableName,
      column: columnName,
      original: value,
      parsed: parsed instanceof Buffer ? 'Buffer' : typeof parsed,
      type: 'bytea'
    }, MODULE_NAME);
    
    return parsed;
  }
  
  // Detect PostgreSQL bit strings
  if (isPostgreSQLBit(value)) {
    replicationLogger.debug('PostgreSQL bit string detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'bit'
    }, MODULE_NAME);
    
    return value; // Keep bit strings as strings
  }
  
  // Detect PostgreSQL money format
  if (isPostgreSQLMoney(value)) {
    const parsed = parsePostgreSQLMoney(value);
    
    replicationLogger.debug('PostgreSQL money parsed', {
      table: tableName,
      column: columnName,
      original: value,
      parsed: parsed,
      type: 'money'
    }, MODULE_NAME);
    
    return parsed;
  }
  
  // Detect PostgreSQL enum types (heuristic)
  if (isPostgreSQLEnum(value, columnName)) {
    replicationLogger.debug('PostgreSQL enum detected', {
      table: tableName,
      column: columnName,
      original: value,
      type: 'enum'
    }, MODULE_NAME);
    
    return value; // Keep enums as strings
  }
  
  // For all other cases, return the original value
  return value;
}

/**
 * Parse multiple PostgreSQL values in batch
 * Useful for processing entire rows of data
 * 
 * @param data - Object with column names as keys and PostgreSQL values
 * @param tableName - Name of the table (for logging)
 * @returns Object with parsed JavaScript values
 */
export function parsePostgreSQLRow(data: Record<string, any>, tableName: string): Record<string, any> {
  const parsed: Record<string, any> = {};
  
  for (const [columnName, value] of Object.entries(data)) {
    parsed[columnName] = parsePostgreSQLValue(columnName, value, tableName);
  }
  
  return parsed;
}

/**
 * Get statistics about PostgreSQL type parsing for a batch of data
 * Useful for monitoring and debugging
 * 
 * @param data - Array of objects with PostgreSQL data
 * @param tableName - Name of the table
 * @returns Statistics object
 */
export function getPostgreSQLParsingStats(data: Record<string, any>[], tableName: string): {
  totalFields: number;
  arrayFields: number;
  booleanFields: number;
  jsonFields: number;
  rangeFields: number;
  intervalFields: number;
  uuidFields: number;
  networkFields: number;
  macAddrFields: number;
  geometricFields: number;
  byteaFields: number;
  bitFields: number;
  moneyFields: number;
  xmlFields: number;
  textSearchFields: number;
  oidFields: number;
  regTypeFields: number;
  enumFields: number;
  compositeFields: number;
  parsedFields: number;
} {
  let totalFields = 0;
  let arrayFields = 0;
  let booleanFields = 0;
  let jsonFields = 0;
  let rangeFields = 0;
  let intervalFields = 0;
  let uuidFields = 0;
  let networkFields = 0;
  let macAddrFields = 0;
  let geometricFields = 0;
  let byteaFields = 0;
  let bitFields = 0;
  let moneyFields = 0;
  let xmlFields = 0;
  let textSearchFields = 0;
  let oidFields = 0;
  let regTypeFields = 0;
  let enumFields = 0;
  let compositeFields = 0;
  let parsedFields = 0;
  
  for (const row of data) {
    for (const [columnName, value] of Object.entries(row)) {
      totalFields++;
      
      if (typeof value === 'string') {
        if (isPostgreSQLArray(value)) {
          arrayFields++;
          parsedFields++;
        } else if (isPostgreSQLBoolean(value)) {
          booleanFields++;
          parsedFields++;
        } else if (isPostgreSQLJSON(value)) {
          jsonFields++;
          parsedFields++;
        } else if (isPostgreSQLRange(value)) {
          rangeFields++;
          parsedFields++;
        } else if (isPostgreSQLInterval(value)) {
          intervalFields++;
          parsedFields++;
        } else if (isPostgreSQLUUID(value)) {
          uuidFields++;
          parsedFields++;
        } else if (isPostgreSQLCIDR(value) || isPostgreSQLINET(value)) {
          networkFields++;
          parsedFields++;
        } else if (isPostgreSQLMACAddr8(value) || isPostgreSQLMACAddr(value)) {
          macAddrFields++;
          parsedFields++;
        } else if (isPostgreSQLPoint(value) || isPostgreSQLBox(value) || 
                   isPostgreSQLCircle(value) || isPostgreSQLPolygon(value) ||
                   isPostgreSQLLine(value) || isPostgreSQLLSeg(value) || 
                   isPostgreSQLPath(value)) {
          geometricFields++;
          parsedFields++;
        } else if (isPostgreSQLBytea(value)) {
          byteaFields++;
          parsedFields++;
        } else if (isPostgreSQLBit(value)) {
          bitFields++;
          parsedFields++;
        } else if (isPostgreSQLMoney(value)) {
          moneyFields++;
          parsedFields++;
        } else if (isPostgreSQLXML(value)) {
          xmlFields++;
          parsedFields++;
        } else if (isPostgreSQLTSVector(value) || isPostgreSQLTSQuery(value)) {
          textSearchFields++;
          parsedFields++;
        } else if (isPostgreSQLOID(value)) {
          oidFields++;
          parsedFields++;
        } else if (isPostgreSQLRegType(value)) {
          regTypeFields++;
          parsedFields++;
        } else if (isPostgreSQLEnum(value, columnName)) {
          enumFields++;
          parsedFields++;
        } else if (isPostgreSQLComposite(value)) {
          compositeFields++;
          parsedFields++;
        }
      }
    }
  }
  
  return {
    totalFields,
    arrayFields,
    booleanFields,
    jsonFields,
    rangeFields,
    intervalFields,
    uuidFields,
    networkFields,
    macAddrFields,
    geometricFields,
    byteaFields,
    bitFields,
    moneyFields,
    xmlFields,
    textSearchFields,
    oidFields,
    regTypeFields,
    enumFields,
    compositeFields,
    parsedFields
  };
}

/**
 * Detect if a value is a PostgreSQL UUID format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL UUID format
 */
export function isPostgreSQLUUID(value: any): boolean {
  return typeof value === 'string' && 
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Detect if a value is a PostgreSQL INET format (IPv4/IPv6 host address)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL INET format
 */
export function isPostgreSQLINET(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // IPv4 format: 192.168.1.1 or 192.168.1.1/24
  const ipv4Pattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  
  // IPv6 format: 2001:db8::1 or 2001:db8::1/64
  const ipv6Pattern = /^([0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(\/\d{1,3})?$/i;
  
  return ipv4Pattern.test(value) || ipv6Pattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL CIDR format (network address)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL CIDR format
 */
export function isPostgreSQLCIDR(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // CIDR must have a subnet mask
  return value.includes('/') && isPostgreSQLINET(value);
}

/**
 * Detect if a value is a PostgreSQL MACADDR format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL MACADDR format
 */
export function isPostgreSQLMACAddr(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Standard MAC address: 08:00:2b:01:02:03 or 08-00-2b-01-02-03
  const macPattern = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
  
  return macPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL MACADDR8 format (EUI-64)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL MACADDR8 format
 */
export function isPostgreSQLMACAddr8(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // EUI-64 MAC address: 08:00:2b:ff:fe:01:02:03
  const mac8Pattern = /^([0-9a-f]{2}[:-]){7}[0-9a-f]{2}$/i;
  
  return mac8Pattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL geometric POINT format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL POINT format
 */
export function isPostgreSQLPoint(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Point format: (x,y)
  const pointPattern = /^\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*$/;
  
  return pointPattern.test(value);
}

/**
 * Parse PostgreSQL POINT format to JavaScript object
 * 
 * @param value - PostgreSQL POINT string
 * @returns Object with x and y coordinates
 */
export function parsePostgreSQLPoint(value: string): { x: number; y: number } | string {
  const match = value.match(/^\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)\s*$/);
  if (match) {
    return {
      x: parseFloat(match[1]),
      y: parseFloat(match[2])
    };
  }
  return value; // Return original if parsing fails
}

/**
 * Detect if a value is a PostgreSQL BOX format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL BOX format
 */
export function isPostgreSQLBox(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Box format: ((x1,y1),(x2,y2))
  const boxPattern = /^\s*\(\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*\)\s*$/;
  
  return boxPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL CIRCLE format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL CIRCLE format
 */
export function isPostgreSQLCircle(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Circle format: <(x,y),r>
  const circlePattern = /^\s*<\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,\s*\d+(\.\d+)?\s*>\s*$/;
  
  return circlePattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL POLYGON format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL POLYGON format
 */
export function isPostgreSQLPolygon(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Polygon format: ((x1,y1),...,(xn,yn))
  const polygonPattern = /^\s*\(\s*(\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,?\s*)+\)\s*$/;
  
  return polygonPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL BYTEA format (binary data)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL BYTEA format
 */
export function isPostgreSQLBytea(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Bytea hex format: \x followed by hex digits
  const byteaPattern = /^\\x[0-9a-f]*$/i;
  
  return byteaPattern.test(value);
}

/**
 * Parse PostgreSQL BYTEA format to Buffer
 * 
 * @param value - PostgreSQL BYTEA string
 * @returns Buffer or original string if parsing fails
 */
export function parsePostgreSQLBytea(value: string): Buffer | string {
  if (value.startsWith('\\x')) {
    try {
      const hexString = value.substring(2);
      return Buffer.from(hexString, 'hex');
    } catch (e) {
      return value; // Return original if parsing fails
    }
  }
  return value;
}

/**
 * Detect if a value is a PostgreSQL BIT string format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL BIT format
 */
export function isPostgreSQLBit(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Bit string format: only 0s and 1s
  const bitPattern = /^[01]+$/;
  
  return bitPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL MONEY format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL MONEY format
 */
export function isPostgreSQLMoney(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Money format: $1,234.56 or -$1,234.56 or various currency symbols
  const moneyPattern = /^[+-]?[\$£€¥₹₽]?[\d,]+\.?\d*$/;
  
  return moneyPattern.test(value);
}

/**
 * Parse PostgreSQL MONEY format to number
 * 
 * @param value - PostgreSQL MONEY string
 * @returns Number or original string if parsing fails
 */
export function parsePostgreSQLMoney(value: string): number | string {
  try {
    // Remove currency symbols and commas, then parse
    const cleanValue = value.replace(/[\$£€¥₹₽,]/g, '');
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? value : parsed;
  } catch (e) {
    return value;
  }
}

/**
 * Detect if a value is a PostgreSQL XML format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL XML format
 */
export function isPostgreSQLXML(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Basic XML detection - starts with < and contains XML-like structure
  const xmlPattern = /^\s*<[^>]+>.*<\/[^>]+>\s*$/s;
  const xmlDeclPattern = /^\s*<\?xml\s+version\s*=\s*["'][^"']*["']/i;
  
  return xmlPattern.test(value) || xmlDeclPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL TSVECTOR format (text search vector)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL TSVECTOR format
 */
export function isPostgreSQLTSVector(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // TSVector format: 'word':position 'word2':position1,position2
  // Example: 'fat':2 'cat':3 'rat':1
  const tsvectorPattern = /^('([^'\\]|\\.)*':\d+(,\d+)*\s*)+$/;
  
  return tsvectorPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL TSQUERY format (text search query)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL TSQUERY format
 */
export function isPostgreSQLTSQuery(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // TSQuery format: 'word' & 'word2' | !'word3'
  // Contains quoted words with operators &, |, !, ()
  const tsqueryPattern = /^['\w\s&|!()]+$/;
  const hasQuotedWords = /'[^']*'/.test(value);
  const hasOperators = /[&|!()]/.test(value);
  
  return tsqueryPattern.test(value) && (hasQuotedWords || hasOperators);
}

/**
 * Detect if a value is a PostgreSQL OID format (object identifier)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL OID format
 */
export function isPostgreSQLOID(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // OID is a positive integer
  const oidPattern = /^\d+$/;
  
  return oidPattern.test(value) && parseInt(value, 10) > 0;
}

/**
 * Detect if a value is a PostgreSQL REG* type (regproc, regclass, etc.)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL REG* format
 */
export function isPostgreSQLRegType(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Reg types can be names, OIDs, or qualified names
  // Examples: "sum", "pg_catalog.sum", "sum(integer,integer)", "1234"
  const regTypePattern = /^([a-zA-Z_][a-zA-Z0-9_]*\.)?[a-zA-Z_][a-zA-Z0-9_]*(\([^)]*\))?$|^\d+$/;
  
  return regTypePattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL ENUM format
 * Note: ENUMs appear as their string values, so this is a heuristic check
 * 
 * @param value - Value to check
 * @param columnName - Column name for context
 * @returns true if value might be PostgreSQL ENUM format
 */
export function isPostgreSQLEnum(value: any, columnName: string = ''): boolean {
  if (typeof value !== 'string') return false;
  
  // Heuristic: if column name suggests enum or value looks like enum value
  const enumColumnPattern = /(status|state|type|kind|mode|level|priority)$/i;
  const enumValuePattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  
  return (enumColumnPattern.test(columnName) && enumValuePattern.test(value)) ||
         // Common enum-like values
         /^(active|inactive|pending|approved|rejected|draft|published|archived|enabled|disabled|public|private|open|closed|new|processing|completed|failed|success|error|warning|info|debug|trace|low|medium|high|critical|urgent|normal|admin|user|guest|read|write|execute|create|update|delete)$/i.test(value);
}

/**
 * Detect if a value is a PostgreSQL PATH format (geometric path)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL PATH format
 */
export function isPostgreSQLPath(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Path format: [(x1,y1),...,(xn,yn)] (closed) or ((x1,y1),...,(xn,yn)) (open)
  const pathPattern = /^\s*[\[\(]\s*(\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,?\s*)+[\]\)]\s*$/;
  
  return pathPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL LINE format (infinite line)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL LINE format
 */
export function isPostgreSQLLine(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Line format: {A,B,C} where Ax + By + C = 0
  const linePattern = /^\s*\{\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\}\s*$/;
  
  return linePattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL LSEG format (line segment)
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL LSEG format
 */
export function isPostgreSQLLSeg(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Line segment format: [(x1,y1),(x2,y2)]
  const lsegPattern = /^\s*\[\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*,\s*\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)\s*\]\s*$/;
  
  return lsegPattern.test(value);
}

/**
 * Detect if a value is a PostgreSQL composite type format
 * 
 * @param value - Value to check
 * @returns true if value is PostgreSQL composite type format
 */
export function isPostgreSQLComposite(value: any): boolean {
  if (typeof value !== 'string') return false;
  
  // Composite type format: (value1,value2,value3) - similar to ROW constructor
  // But distinguish from geometric points by having more than 2 elements or quoted strings
  const compositePattern = /^\s*\(\s*([^,)]+\s*,\s*){2,}[^,)]*\s*\)\s*$/;
  const hasQuotedElements = /"[^"]*"/.test(value);
  const elementCount = (value.match(/,/g) || []).length + 1;
  
  return compositePattern.test(value) && (elementCount > 2 || hasQuotedElements);
}

/**
 * Enhanced range type detection with specific range type identification
 * 
 * @param value - Value to check
 * @returns Object with range type info or null
 */
export function parsePostgreSQLRangeType(value: string): { type: string; bounds: string; start: string; end: string } | null {
  if (!isPostgreSQLRange(value)) return null;
  
  const match = value.match(/^([\[\(])\s*([^,]*)\s*,\s*([^,]*)\s*([\]\)])$/);
  if (!match) return null;
  
  const [, startBound, start, end, endBound] = match;
  const bounds = startBound + endBound;
  
  // Try to determine range type based on content
  let rangeType = 'unknown';
  if (/^\d{4}-\d{2}-\d{2}/.test(start) || /^\d{4}-\d{2}-\d{2}/.test(end)) {
    if (start.includes(' ') || end.includes(' ')) {
      rangeType = start.includes('+') || end.includes('+') ? 'tstzrange' : 'tsrange';
    } else {
      rangeType = 'daterange';
    }
  } else if (/^-?\d+$/.test(start) || /^-?\d+$/.test(end)) {
    rangeType = 'int4range';
  } else if (/^-?\d+\.\d+$/.test(start) || /^-?\d+\.\d+$/.test(end)) {
    rangeType = 'numrange';
  }
  
  return {
    type: rangeType,
    bounds,
    start: start.trim(),
    end: end.trim()
  };
} 