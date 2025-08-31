-- Add soft delete support to entity_schemas table
-- This allows WAL replication to properly track entity deletions

-- Add deleted column
ALTER TABLE entity_schemas 
ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;

-- Add deleted_at timestamp for audit trail
ALTER TABLE entity_schemas
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

-- Create index for efficient filtering of non-deleted entities
CREATE INDEX IF NOT EXISTS idx_entity_schemas_deleted 
ON entity_schemas(org_id, deleted) 
WHERE deleted = FALSE;

-- Update any existing rows to ensure they're marked as not deleted
UPDATE entity_schemas SET deleted = FALSE WHERE deleted IS NULL;

-- Make deleted column NOT NULL after setting defaults
ALTER TABLE entity_schemas 
ALTER COLUMN deleted SET NOT NULL;