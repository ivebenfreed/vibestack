-- Create table for storing computed field configurations
CREATE TABLE IF NOT EXISTS dataforge_computed_fields (
  id SERIAL PRIMARY KEY,
  org_id UUID NOT NULL,
  entity_type TEXT NOT NULL,
  field_name TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('computed_formula', 'computed_expression')),
  expression TEXT NOT NULL,
  dependencies JSONB DEFAULT '[]'::jsonb,
  compute_location TEXT NOT NULL DEFAULT 'backend' CHECK (compute_location IN ('backend', 'frontend', 'hybrid')),
  result_type TEXT NOT NULL DEFAULT 'number' CHECK (result_type IN ('number', 'text', 'boolean', 'date', 'json')),
  refresh_triggers JSONB DEFAULT '[]'::jsonb,
  cache_results BOOLEAN DEFAULT true,
  last_calculated TIMESTAMP,
  calculation_error TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  -- Unique constraint to prevent duplicate computed fields per entity
  UNIQUE(org_id, entity_type, field_name)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_dataforge_computed_fields_org_entity 
  ON dataforge_computed_fields (org_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_dataforge_computed_fields_dependencies 
  ON dataforge_computed_fields USING gin (dependencies);

CREATE INDEX IF NOT EXISTS idx_dataforge_computed_fields_triggers 
  ON dataforge_computed_fields USING gin (refresh_triggers);

CREATE INDEX IF NOT EXISTS idx_dataforge_computed_fields_active 
  ON dataforge_computed_fields (is_active) WHERE is_active = true;

-- Create table for computed field dependency tracking
CREATE TABLE IF NOT EXISTS dataforge_computed_field_dependencies (
  id SERIAL PRIMARY KEY,
  computed_field_id INTEGER REFERENCES dataforge_computed_fields(id) ON DELETE CASCADE,
  depends_on_org_id UUID NOT NULL,
  depends_on_entity_type TEXT NOT NULL,
  depends_on_field_name TEXT NOT NULL,
  dependency_type TEXT NOT NULL DEFAULT 'field' CHECK (dependency_type IN ('field', 'relationship', 'computed')),
  created_at TIMESTAMP DEFAULT now(),
  
  -- Unique constraint to prevent duplicate dependencies
  UNIQUE(computed_field_id, depends_on_org_id, depends_on_entity_type, depends_on_field_name)
);

-- Create indexes for dependency queries
CREATE INDEX IF NOT EXISTS idx_dataforge_computed_field_dependencies_source 
  ON dataforge_computed_field_dependencies (depends_on_org_id, depends_on_entity_type, depends_on_field_name);

CREATE INDEX IF NOT EXISTS idx_dataforge_computed_field_dependencies_computed 
  ON dataforge_computed_field_dependencies (computed_field_id);

-- Create table for computed field calculation history (optional for debugging/monitoring)
CREATE TABLE IF NOT EXISTS dataforge_computed_field_calculations (
  id SERIAL PRIMARY KEY,
  computed_field_id INTEGER REFERENCES dataforge_computed_fields(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL,
  calculated_value JSONB,
  calculation_error TEXT,
  calculation_duration_ms INTEGER,
  context_snapshot JSONB, -- Store computation context for debugging
  created_at TIMESTAMP DEFAULT now(),
  
  -- Keep only recent calculations per field per entity
  UNIQUE(computed_field_id, entity_id, created_at)
);

-- Create index for calculation history cleanup
CREATE INDEX IF NOT EXISTS idx_dataforge_computed_field_calculations_cleanup 
  ON dataforge_computed_field_calculations (created_at);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_dataforge_computed_fields_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_dataforge_computed_fields_updated_at_trigger 
  ON dataforge_computed_fields;
CREATE TRIGGER update_dataforge_computed_fields_updated_at_trigger
  BEFORE UPDATE ON dataforge_computed_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_dataforge_computed_fields_updated_at();

-- Add comments for documentation
COMMENT ON TABLE dataforge_computed_fields IS 'Stores configuration for computed fields including expressions and dependencies';
COMMENT ON COLUMN dataforge_computed_fields.expression IS 'The mathematical or logical expression to evaluate';
COMMENT ON COLUMN dataforge_computed_fields.dependencies IS 'JSONB array of field names this computed field depends on';
COMMENT ON COLUMN dataforge_computed_fields.compute_location IS 'Whether computation happens on backend, frontend, or hybrid';
COMMENT ON COLUMN dataforge_computed_fields.refresh_triggers IS 'JSONB array of events that trigger recalculation';
COMMENT ON COLUMN dataforge_computed_fields.cache_results IS 'Whether to store calculated values in the entity table';

COMMENT ON TABLE dataforge_computed_field_dependencies IS 'Tracks dependencies between computed fields and other fields';
COMMENT ON TABLE dataforge_computed_field_calculations IS 'Optional calculation history for monitoring and debugging';