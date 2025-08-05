/**
 * Type-safe column definitions with compile-time field type validation
 */

// Map entity field types to allowed cell types
type FieldTypeToCellType<T> = 
  T extends string | null | undefined ? 'text' | 'enum' | 'relationship-single' :
  T extends number | null | undefined ? 'number' :
  T extends boolean | null | undefined ? 'boolean' :
  T extends Date | null | undefined ? 'date' :
  T extends Array<any> ? 'relationship-multi' :
  'text';

// Type-safe column that validates cellType matches field type
export interface Column<T, K extends keyof T = keyof T> {
  id: string;
  field: K & string;
  name: string;
  cellType: K extends keyof T ? FieldTypeToCellType<T[K]> : never;
  
  // Optional properties
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  editable?: boolean;
  
  // For relationships
  relationshipTable?: string;
  relationshipDisplayField?: string;
  
  // For enums
  options?: Array<{ value: string; label: string }>;
}

// Helper type to make column creation easier
export type ColumnDef<T> = {
  [K in keyof T]: Column<T, K>;
}[keyof T];

// Export cell type union for use elsewhere
export type CellType = 
  | 'text' 
  | 'number' 
  | 'boolean' 
  | 'date' 
  | 'enum' 
  | 'relationship-single' 
  | 'relationship-multi';