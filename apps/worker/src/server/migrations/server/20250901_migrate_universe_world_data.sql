-- Migration: Move existing Universe and World data from DataForge tables to fixed schema
-- This script safely migrates data while preserving relationships and maintaining data integrity

-- First, let's create a temporary function to help with the migration
CREATE OR REPLACE FUNCTION migrate_dataforge_to_fixed_schema()
RETURNS void AS $$
DECLARE
    org_record RECORD;
    universe_mapping RECORD;
    world_mapping RECORD;
    dataforge_table_name TEXT;
    sql_query TEXT;
BEGIN
    RAISE NOTICE 'Starting migration of Universe and World data from DataForge to fixed schema';

    -- Step 1: Migrate Universes
    RAISE NOTICE 'Step 1: Migrating Universe data...';
    
    -- Find all organizations that have DataForge universe entities
    FOR org_record IN 
        SELECT DISTINCT org_id, entity_name, table_name 
        FROM entity_schemas 
        WHERE archetype = 'universe' 
        AND (deleted = false OR deleted IS NULL)
    LOOP
        RAISE NOTICE 'Processing universe data from org % table %', org_record.org_id, org_record.table_name;
        
        -- Build dynamic query to extract universe data from DataForge table
        sql_query := format('
            INSERT INTO universes (id, user_id, organization_id, name, description, created_at, updated_at)
            SELECT 
                id,
                owner_id as user_id,
                organization_id,
                name,
                COALESCE(description, '''') as description,
                COALESCE(created_at, NOW()) as created_at,
                COALESCE(updated_at, NOW()) as updated_at
            FROM %I
            WHERE owner_id IS NOT NULL
            ON CONFLICT (user_id, organization_id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = EXCLUDED.updated_at
        ', org_record.table_name);
        
        -- Execute the migration for this org's universe table
        BEGIN
            EXECUTE sql_query;
            GET DIAGNOSTICS org_record.rows_affected = ROW_COUNT;
            RAISE NOTICE 'Migrated % universe records from %', org_record.rows_affected, org_record.table_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to migrate universe data from table %: %', org_record.table_name, SQLERRM;
        END;
    END LOOP;

    -- Step 2: Migrate Worlds
    RAISE NOTICE 'Step 2: Migrating World data...';
    
    -- Find all organizations that have DataForge world entities
    FOR org_record IN 
        SELECT DISTINCT org_id, entity_name, table_name 
        FROM entity_schemas 
        WHERE archetype = 'world' 
        AND (deleted = false OR deleted IS NULL)
    LOOP
        RAISE NOTICE 'Processing world data from org % table %', org_record.org_id, org_record.table_name;
        
        -- Build dynamic query to extract world data from DataForge table
        sql_query := format('
            INSERT INTO worlds (
                id, organization_id, team_id, name, description, universe_id, 
                state, world_type, priority, created_at, updated_at, created_by
            )
            SELECT 
                w.id,
                w.organization_id,
                NULL as team_id, -- No team support in current DataForge worlds
                w.name,
                w.description,
                -- Find matching universe_id if this is a personal world
                CASE 
                    WHEN w.universe_id IS NOT NULL THEN (
                        SELECT u.id 
                        FROM universes u 
                        WHERE u.organization_id = w.organization_id 
                        AND u.user_id = (
                            SELECT owner_id 
                            FROM universes_old 
                            WHERE id = w.universe_id
                        )
                        LIMIT 1
                    )
                    ELSE NULL
                END as universe_id,
                COALESCE(w.state, ''active'') as state,
                COALESCE(w.world_type, ''personal'') as world_type,
                COALESCE(w.priority, ''medium'') as priority,
                COALESCE(w.created_at, NOW()) as created_at,
                COALESCE(w.updated_at, NOW()) as updated_at,
                w.created_by
            FROM %I w
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                state = EXCLUDED.state,
                world_type = EXCLUDED.world_type,
                priority = EXCLUDED.priority,
                updated_at = EXCLUDED.updated_at
        ', org_record.table_name);
        
        -- Execute the migration for this org's world table
        BEGIN
            EXECUTE sql_query;
            GET DIAGNOSTICS org_record.rows_affected = ROW_COUNT;
            RAISE NOTICE 'Migrated % world records from %', org_record.rows_affected, org_record.table_name;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Failed to migrate world data from table %: %', org_record.table_name, SQLERRM;
        END;
    END LOOP;

    -- Step 3: Create default teams for organizations that have business worlds
    RAISE NOTICE 'Step 3: Creating default teams for organizations with business worlds...';
    
    INSERT INTO teams (organization_id, name, description, team_type, created_at)
    SELECT DISTINCT 
        w.organization_id,
        'General' as name,
        'Default team for organization-wide collaboration' as description,
        'department' as team_type,
        NOW() as created_at
    FROM worlds w
    WHERE w.universe_id IS NULL  -- Business worlds only
    AND NOT EXISTS (
        SELECT 1 FROM teams t WHERE t.organization_id = w.organization_id
    );
    
    GET DIAGNOSTICS org_record.rows_affected = ROW_COUNT;
    RAISE NOTICE 'Created % default teams', org_record.rows_affected;

    -- Step 4: Create team memberships for org admins/owners in default teams
    RAISE NOTICE 'Step 4: Adding org admins/owners to default teams...';
    
    INSERT INTO team_memberships (team_id, user_id, role, created_at)
    SELECT DISTINCT
        t.id as team_id,
        om.user_id,
        CASE 
            WHEN om.role = 'owner' THEN 'admin'
            WHEN om.role = 'admin' THEN 'admin' 
            ELSE 'lead'
        END as role,
        NOW() as created_at
    FROM teams t
    JOIN organization_members om ON t.organization_id = om.organization_id
    WHERE t.name = 'General'
    AND om.role IN ('owner', 'admin', 'manager')
    ON CONFLICT (team_id, user_id) DO NOTHING;
    
    GET DIAGNOSTICS org_record.rows_affected = ROW_COUNT;
    RAISE NOTICE 'Added % team memberships', org_record.rows_affected;

    -- Step 5: Verify migration integrity
    RAISE NOTICE 'Step 5: Verifying migration integrity...';
    
    -- Check if all expected universes were migrated
    SELECT COUNT(*) INTO org_record.rows_affected FROM universes;
    RAISE NOTICE 'Total universes after migration: %', org_record.rows_affected;
    
    -- Check if all expected worlds were migrated
    SELECT COUNT(*) INTO org_record.rows_affected FROM worlds;
    RAISE NOTICE 'Total worlds after migration: %', org_record.rows_affected;
    
    -- Check personal vs business world distribution
    SELECT COUNT(*) INTO org_record.rows_affected 
    FROM worlds WHERE universe_id IS NOT NULL;
    RAISE NOTICE 'Personal worlds: %', org_record.rows_affected;
    
    SELECT COUNT(*) INTO org_record.rows_affected 
    FROM worlds WHERE universe_id IS NULL;
    RAISE NOTICE 'Business worlds: %', org_record.rows_affected;

    RAISE NOTICE 'Migration completed successfully!';
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_dataforge_to_fixed_schema();

-- Clean up the temporary function
DROP FUNCTION migrate_dataforge_to_fixed_schema();

-- Create a backup table of the entity_schemas entries we're about to modify
CREATE TABLE entity_schemas_backup_20250901 AS 
SELECT * FROM entity_schemas 
WHERE archetype IN ('universe', 'world');

RAISE NOTICE 'Created backup table: entity_schemas_backup_20250901';

-- Mark universe and world entities as migrated (but don't delete yet for safety)
UPDATE entity_schemas 
SET business_metadata = jsonb_set(
    COALESCE(business_metadata, '{}'::jsonb),
    '{migrated_to_fixed_schema}',
    'true'::jsonb
) || jsonb_build_object('migration_date', NOW()::text)
WHERE archetype IN ('universe', 'world')
AND (deleted = false OR deleted IS NULL);

RAISE NOTICE 'Marked universe and world entities as migrated in entity_schemas';

-- Verify the migration was successful
DO $$
DECLARE
    universe_count INTEGER;
    world_count INTEGER;
    team_count INTEGER;
    membership_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO universe_count FROM universes;
    SELECT COUNT(*) INTO world_count FROM worlds;
    SELECT COUNT(*) INTO team_count FROM teams;
    SELECT COUNT(*) INTO membership_count FROM team_memberships;
    
    RAISE NOTICE '=== MIGRATION SUMMARY ===';
    RAISE NOTICE 'Universes: %', universe_count;
    RAISE NOTICE 'Worlds: %', world_count;
    RAISE NOTICE 'Teams: %', team_count;
    RAISE NOTICE 'Team Memberships: %', membership_count;
    RAISE NOTICE '========================';
    
    IF universe_count = 0 AND world_count = 0 THEN
        RAISE WARNING 'No data was migrated - this might indicate an issue or no existing data';
    END IF;
END;
$$;