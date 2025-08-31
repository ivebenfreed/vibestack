-- DataForge Archetype Migration
-- Updates entity_schemas table to use DataForge archetype system
-- Migrates from universal-archetype to DataForge's 8 core archetypes

BEGIN;

-- Add archetype column if it doesn't exist
ALTER TABLE entity_schemas 
ADD COLUMN IF NOT EXISTS archetype VARCHAR(50);

-- Add index for archetype queries
CREATE INDEX IF NOT EXISTS idx_entity_schemas_archetype 
ON entity_schemas(org_id, archetype);

-- Update existing entities to use archetype field based on entity patterns
UPDATE entity_schemas 
SET archetype = 
  CASE 
    -- Map common entity patterns to archetypes
    WHEN entity_name ILIKE '%project%' THEN 'project'
    WHEN entity_name ILIKE '%task%' OR entity_name ILIKE '%todo%' THEN 'task'
    WHEN entity_name ILIKE '%doc%' OR entity_name ILIKE '%note%' THEN 'document'
    WHEN entity_name ILIKE '%file%' OR entity_name ILIKE '%asset%' OR entity_name ILIKE '%upload%' THEN 'file'
    WHEN entity_name ILIKE '%discuss%' OR entity_name ILIKE '%comment%' OR entity_name ILIKE '%thread%' THEN 'discussion'
    WHEN entity_name ILIKE '%activity%' OR entity_name ILIKE '%event%' OR entity_name ILIKE '%log%' THEN 'activity'
    WHEN entity_name ILIKE '%collection%' OR entity_name ILIKE '%group%' OR entity_name ILIKE '%list%' THEN 'collection'
    -- Default to 'record' for generic entities
    ELSE 'record'
  END
WHERE archetype IS NULL;

-- Add constraint to ensure archetype is one of the 8 valid types (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_valid_archetype' 
    OR conname = 'entity_schemas_archetype_check'
  ) THEN
    ALTER TABLE entity_schemas 
    ADD CONSTRAINT chk_valid_archetype 
    CHECK (archetype IN ('project', 'task', 'record', 'document', 'file', 'activity', 'discussion', 'collection'));
  END IF;
END $$;

-- Create schema metadata table if it doesn't exist
CREATE TABLE IF NOT EXISTS schema_metadata (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Update schema version metadata
INSERT INTO schema_metadata (key, value, updated_at)
VALUES ('dataforge_version', '1.0.0', NOW())
ON CONFLICT (key) 
DO UPDATE SET value = '1.0.0', updated_at = NOW();

-- Create archetype usage statistics view
CREATE OR REPLACE VIEW archetype_usage_stats AS
SELECT 
  org_id,
  archetype,
  COUNT(*) as entity_count,
  COUNT(DISTINCT entity_name) as unique_entities,
  MAX(created_at) as last_created,
  MIN(created_at) as first_created
FROM entity_schemas
WHERE archetype IS NOT NULL
GROUP BY org_id, archetype;

-- Grant permissions on the new view (if role exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    GRANT SELECT ON archetype_usage_stats TO authenticated;
  END IF;
END $$;

COMMIT;

-- Verification query (run separately to check migration success)
-- SELECT 
--   archetype, 
--   COUNT(*) as count,
--   array_agg(entity_name) as entities
-- FROM entity_schemas 
-- GROUP BY archetype 
-- ORDER BY count DESC;