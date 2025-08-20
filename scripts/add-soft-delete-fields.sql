-- Script to add soft delete functionality to all business entity tables
-- Adds 'deleted' boolean field with default false and 'deleted_at' timestamp field

-- Function to add soft delete fields to a table
CREATE OR REPLACE FUNCTION add_soft_delete_fields(table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Add deleted boolean field (default false)
    BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted BOOLEAN DEFAULT FALSE', table_name);
        RAISE NOTICE 'Added deleted field to table: %', table_name;
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'Deleted field already exists in table: %', table_name;
    END;
    
    -- Add deleted_at timestamp field (nullable)
    BEGIN
        EXECUTE format('ALTER TABLE %I ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE', table_name);
        RAISE NOTICE 'Added deleted_at field to table: %', table_name;
    EXCEPTION WHEN duplicate_column THEN
        RAISE NOTICE 'Deleted_at field already exists in table: %', table_name;
    END;
    
    -- Add index on deleted field for efficient queries
    BEGIN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (deleted)', 
                      table_name || '_deleted_idx', 
                      table_name);
        RAISE NOTICE 'Added deleted index to table: %', table_name;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not create deleted index for table: % (may already exist)', table_name;
    END;
    
    -- Add index on deleted_at field for efficient queries
    BEGIN
        EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (deleted_at)', 
                      table_name || '_deleted_at_idx', 
                      table_name);
        RAISE NOTICE 'Added deleted_at index to table: %', table_name;
    EXCEPTION WHEN others THEN
        RAISE NOTICE 'Could not create deleted_at index for table: % (may already exist)', table_name;
    END;
END;
$$ language 'plpgsql';

-- Add soft delete fields to Wide Corp organization tables
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_project');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_client');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_contract');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_document');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_expense');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_invoice');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_meeting');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_proposal');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_resource');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_skill');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_timesheet');
SELECT add_soft_delete_fields('org_01920000_1000_7000_8000_000000000001_certification');

-- Add soft delete fields to Demo Corp organization tables
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_activity');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_attachment');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_comment');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_contact');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_custom_field_definitio');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_custom_field_value');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_deal');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_sync_configuration');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_tag');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_tagging');
SELECT add_soft_delete_fields('org_01920000_2000_7000_8000_000000000002_ticket');