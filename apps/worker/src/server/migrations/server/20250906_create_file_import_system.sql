-- Migration: Create file import system
-- This creates tables for handling CSV, Excel, JSON and other file-based data imports

-- File import jobs table
CREATE TABLE IF NOT EXISTS file_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  
  -- File metadata
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('csv', 'tsv', 'xlsx', 'xls', 'json', 'xml')),
  file_size INTEGER NOT NULL,
  file_path TEXT NOT NULL, -- Cloudflare R2/storage path
  file_hash TEXT, -- For duplicate detection
  
  -- Import status and progress
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'analyzing', 'mapped', 'importing', 'completed', 'failed', 'cancelled')),
  
  -- Schema analysis results
  detected_columns JSONB, -- Auto-detected column info: [{name, type, sample_values, nullable}]
  row_count INTEGER,
  sample_data JSONB, -- First 5-10 rows for preview
  
  -- Mapping configuration
  target_entity TEXT, -- Which VibeStack entity to import to (from entity_schemas)
  column_mappings JSONB, -- Source column -> target field mappings
  transformation_rules JSONB, -- Data cleanup/transformation rules
  import_mode TEXT DEFAULT 'create' CHECK (import_mode IN ('create', 'update', 'upsert')),
  
  -- Import results and metrics
  records_processed INTEGER DEFAULT 0,
  records_imported INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  error_details JSONB, -- Detailed error information
  validation_errors JSONB, -- Schema validation errors
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  
  -- User context
  created_by TEXT, -- User ID who initiated import
  
  CONSTRAINT fk_file_imports_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
);

-- Import mapping templates for reusability
CREATE TABLE IF NOT EXISTS import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id TEXT NOT NULL,
  
  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,
  file_type TEXT NOT NULL,
  target_entity TEXT NOT NULL,
  
  -- Mapping configuration
  column_mappings JSONB NOT NULL,
  transformation_rules JSONB,
  import_mode TEXT DEFAULT 'create',
  
  -- Sharing and permissions
  is_shared BOOLEAN DEFAULT false, -- Share across organization
  is_public BOOLEAN DEFAULT false, -- Share across all organizations
  
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,
  
  -- User context
  created_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_import_templates_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT unique_template_name_per_org UNIQUE (org_id, name)
);

-- Import field mappings for granular mapping history
CREATE TABLE IF NOT EXISTS import_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_import_id UUID NOT NULL,
  
  -- Mapping details
  source_column TEXT NOT NULL,
  target_field TEXT NOT NULL,
  field_type TEXT NOT NULL, -- Expected data type
  
  -- Transformation rules
  transformation_function TEXT, -- 'trim', 'lowercase', 'date_format', 'currency_parse', etc.
  transformation_params JSONB, -- Parameters for transformation function
  default_value TEXT, -- Default value if source is empty
  
  -- Validation rules
  is_required BOOLEAN DEFAULT false,
  validation_rules JSONB, -- Custom validation rules
  
  -- Results
  values_processed INTEGER DEFAULT 0,
  values_transformed INTEGER DEFAULT 0,
  validation_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_field_mappings_import FOREIGN KEY (file_import_id) REFERENCES file_imports(id) ON DELETE CASCADE
);

-- Import error log for detailed error tracking
CREATE TABLE IF NOT EXISTS import_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_import_id UUID NOT NULL,
  
  -- Error context
  row_number INTEGER, -- Which row caused the error
  column_name TEXT, -- Which column (if applicable)
  error_type TEXT NOT NULL, -- 'validation', 'transformation', 'constraint', 'system'
  error_code TEXT, -- Specific error code for categorization
  error_message TEXT NOT NULL,
  
  -- Raw data context
  source_value TEXT, -- The problematic value
  source_row_data JSONB, -- Full row data for context
  
  -- Resolution
  resolution_status TEXT DEFAULT 'unresolved' CHECK (resolution_status IN ('unresolved', 'ignored', 'fixed')),
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  resolved_by TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_import_errors_import FOREIGN KEY (file_import_id) REFERENCES file_imports(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_file_imports_org_id ON file_imports(org_id);
CREATE INDEX IF NOT EXISTS idx_file_imports_status ON file_imports(status);
CREATE INDEX IF NOT EXISTS idx_file_imports_created_at ON file_imports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_file_imports_target_entity ON file_imports(target_entity);

CREATE INDEX IF NOT EXISTS idx_import_templates_org_id ON import_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_import_templates_file_type ON import_templates(file_type);
CREATE INDEX IF NOT EXISTS idx_import_templates_target_entity ON import_templates(target_entity);
CREATE INDEX IF NOT EXISTS idx_import_templates_shared ON import_templates(is_shared) WHERE is_shared = true;

CREATE INDEX IF NOT EXISTS idx_import_errors_import_id ON import_errors(file_import_id);
CREATE INDEX IF NOT EXISTS idx_import_errors_type ON import_errors(error_type);
CREATE INDEX IF NOT EXISTS idx_import_errors_resolution ON import_errors(resolution_status);

-- Comments for documentation
COMMENT ON TABLE file_imports IS 'File-based data import jobs with status tracking and results';
COMMENT ON TABLE import_templates IS 'Reusable import mapping templates for common file structures';
COMMENT ON TABLE import_field_mappings IS 'Granular field mapping configurations for imports';
COMMENT ON TABLE import_errors IS 'Detailed error tracking and resolution for import issues';

COMMENT ON COLUMN file_imports.detected_columns IS 'Auto-detected schema: [{name: string, type: string, sample_values: string[], nullable: boolean, unique_count?: number}]';
COMMENT ON COLUMN file_imports.sample_data IS 'First 5-10 rows as array of objects for preview UI';
COMMENT ON COLUMN file_imports.column_mappings IS 'Source to target mapping: {source_column: {target_field, transformation?, validation?}}';
COMMENT ON COLUMN file_imports.transformation_rules IS 'Global transformation rules: {trim_whitespace: boolean, handle_empty_strings: "null"|"empty"|"skip"}';