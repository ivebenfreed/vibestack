-- Migration: Remove Universe abstraction - use user_id directly in worlds
-- This eliminates the unnecessary universe table and simplifies the data model

-- First, migrate existing data from universe_id to user_id in worlds table
-- Personal worlds: Set user_id from the referenced universe
-- Business worlds: Keep user_id as NULL

-- Update personal worlds to use user_id directly
UPDATE worlds 
SET created_by = u.user_id
FROM universes u 
WHERE worlds.universe_id = u.id 
AND worlds.universe_id IS NOT NULL;

-- Add user_id column to worlds table for personal world ownership
-- NULL = business world (shared), NOT NULL = personal world (owned by user)
ALTER TABLE worlds 
ADD COLUMN owner_user_id UUID;

-- Update the new column with user IDs from universes
UPDATE worlds 
SET owner_user_id = u.user_id
FROM universes u 
WHERE worlds.universe_id = u.id;

-- Drop the universe_id column (no longer needed)
ALTER TABLE worlds 
DROP COLUMN universe_id;

-- Drop the universes table (no longer needed)
DROP TABLE universes CASCADE;

-- Create index for the new owner_user_id column
CREATE INDEX idx_worlds_owner_user_id ON worlds(owner_user_id);

-- Update composite indexes
DROP INDEX IF EXISTS idx_worlds_universe_state;
CREATE INDEX idx_worlds_personal_active ON worlds(owner_user_id, state) WHERE owner_user_id IS NOT NULL;

-- Update RLS policies for worlds
DROP POLICY IF EXISTS worlds_universe_isolation ON worlds;

-- Personal worlds: users can only see their own
CREATE POLICY worlds_personal_isolation ON worlds
    FOR ALL
    USING (
        (owner_user_id IS NOT NULL AND owner_user_id = auth.uid()::uuid)
        OR 
        (owner_user_id IS NULL) -- Business worlds are visible to all org members
    );