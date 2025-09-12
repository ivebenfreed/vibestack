-- Migration: Drop Worlds Table
-- Now that worlds have been converted to projects, we can safely drop the worlds table
-- This completes the transformation: Organizations = Worlds, Projects = What were formerly worlds

-- First, verify that we have no foreign key constraints pointing to worlds
SELECT 
    tc.table_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'worlds';

-- Drop the worlds table (this eliminates the micro-worlds concept entirely)
DROP TABLE worlds CASCADE;

-- Remove world archetype from system option sets since we no longer have worlds table
DELETE FROM system_options WHERE option_set_id IN (
    SELECT id FROM system_option_sets WHERE archetype = 'world'
);

DELETE FROM system_option_sets WHERE archetype = 'world';

-- Remove world entity schema entries
DELETE FROM entity_schemas WHERE archetype = 'world';

-- Log the cleanup
DO $$ 
BEGIN
    RAISE NOTICE 'Worlds table cleanup completed:';
    RAISE NOTICE '  - worlds table dropped';
    RAISE NOTICE '  - world system options removed';  
    RAISE NOTICE '  - world entity schemas removed';
    RAISE NOTICE '  - Organizations now serve as "worlds" in the universe model';
    RAISE NOTICE '  - Former worlds are now projects within organizations';
END $$;